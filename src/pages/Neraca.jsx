import { useState, useEffect, useMemo } from 'react';
import {
  Landmark,
  Scale,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Calendar,
  Building2,
  TrendingUp,
  CreditCard,
  Wallet,
  ArrowRight,
  Info,
  Sparkles,
} from 'lucide-react';
import api from '../api/client';
import { rupiah, LoadingState, PageHeader } from '../components/ui';
import { getTodayStr, getMonthStartStr, getMonthEndStr } from '../utils/date';
import { useOutlet } from '../context/OutletContext';
import { exportBalanceSheetToExcel, printBalanceSheetReport } from '../utils/exportReport';
import toast from 'react-hot-toast';

export default function Neraca() {
  const { activeOutletId, activeOutlet, outlets, currentBusiness } = useOutlet();

  const [dateFrom, setDateFrom] = useState(() => getMonthStartStr());
  const [dateTo, setDateTo] = useState(() => getMonthEndStr());
  const [presetPeriod, setPresetPeriod] = useState('this_month'); // 'this_month' | 'last_month' | 'this_year' | 'custom'

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [neracaData, setNeracaData] = useState(null);
  const [viewMode, setViewMode] = useState('stacked'); // 'stacked' (sesuai gambar) | 'two_column' (skontro)

  // Handle Preset Period Changes
  const handlePeriodChange = (val) => {
    setPresetPeriod(val);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (val === 'this_month') {
      setDateFrom(getMonthStartStr());
      setDateTo(getMonthEndStr());
    } else if (val === 'last_month') {
      const prevStart = new Date(y, m - 1, 1);
      const prevEnd = new Date(y, m, 0);
      setDateFrom(prevStart.toISOString().slice(0, 10));
      setDateTo(prevEnd.toISOString().slice(0, 10));
    } else if (val === 'this_year') {
      setDateFrom(`${y}-01-01`);
      setDateTo(getTodayStr());
    }
  };

  // Fetch Neraca Data from API
  const fetchNeraca = async () => {
    setLoading(true);
    try {
      const params = {
        from: dateFrom,
        to: dateTo,
      };
      if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
        params.outlet_id = activeOutletId;
      }

      const res = await api.get('/reports/balance-sheet', { params });
      setNeracaData(res.data);
    } catch (err) {
      console.error('Gagal mengambil laporan neraca:', err);
      toast.error('Gagal memuat laporan neraca');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNeraca();
  }, [dateFrom, dateTo, activeOutletId]);

  // Export to Excel
  const handleExportExcel = async () => {
    if (!neracaData) return;
    setExporting(true);
    try {
      const businessName = currentBusiness?.name || 'MOVA POS';
      const outletName =
        activeOutlet?.name || (activeOutletId ? 'Cabang Terpilih' : 'Semua Cabang (Konsolidasi)');

      await exportBalanceSheetToExcel({
        data: neracaData,
        period: neracaData.period || { from: dateFrom, to: dateTo },
        businessName,
        outletName,
      });
      toast.success('Laporan Neraca berhasil diexport ke Excel!');
    } catch (err) {
      console.error('Export Excel error:', err);
      toast.error('Gagal mengekspor laporan ke Excel');
    } finally {
      setExporting(false);
    }
  };

  // Print PDF
  const handlePrint = () => {
    if (!neracaData) return;
    const businessName = currentBusiness?.name || 'MOVA POS';
    const outletName =
      activeOutlet?.name || (activeOutletId ? 'Cabang Terpilih' : 'Semua Cabang (Konsolidasi)');

    printBalanceSheetReport({
      data: neracaData,
      period: neracaData.period || { from: dateFrom, to: dateTo },
      businessName,
      outletName,
    });
  };

  const periodSubtitle = useMemo(() => {
    if (neracaData?.period?.from_formatted && neracaData?.period?.to_formatted) {
      return `Per ${neracaData.period.from_formatted} s/d ${neracaData.period.to_formatted}`;
    }
    return `Per ${dateFrom} s/d ${dateTo}`;
  }, [neracaData, dateFrom, dateTo]);

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/40 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Laporan Neraca (Balance Sheet)
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 italic">
                {periodSubtitle} — {neracaData?.period?.outlet_name || 'Semua Cabang'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 hidden sm:flex">
            <button
              onClick={() => setViewMode('stacked')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'stacked'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Format Standar
            </button>
            <button
              onClick={() => setViewMode('two_column')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'two_column'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Format Skontro (2 Kolom)
            </button>
          </div>

          <button
            onClick={fetchNeraca}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={loading || !neracaData}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cetak / PDF</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={loading || exporting || !neracaData}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{exporting ? 'Mengekspor...' : 'Export Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* Filter Period Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            Periode:
          </span>
          {[
            { id: 'this_month', label: 'Bulan Ini' },
            { id: 'last_month', label: 'Bulan Lalu' },
            { id: 'this_year', label: 'Tahun Ini' },
            { id: 'custom', label: 'Kustom' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => handlePeriodChange(p.id)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                presetPeriod === p.id
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700/70 border border-slate-700/60'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date Inputs if Custom or Fine Tune */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPresetPeriod('custom');
            }}
            className="bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
          <span className="text-slate-500 text-xs">s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPresetPeriod('custom');
            }}
            className="bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {loading ? (
        <LoadingState message="Menghitung posisi aset, liabilitas & modal neraca..." />
      ) : !neracaData ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900/60 rounded-xl border border-slate-800">
          Tidak ada data neraca untuk periode ini.
        </div>
      ) : (
        <>
          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Aset */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-800/80 border border-slate-800 rounded-xl p-4.5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium flex items-center gap-1.5 text-slate-300">
                  <Landmark className="w-4 h-4 text-emerald-400" />
                  Total Aset (Aktiva)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Kekayaan Usaha
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-emerald-400 tracking-tight">
                {rupiah(neracaData.total_assets?.amount || 0)}
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/70 pt-2">
                <span>Aset Lancar:</span>
                <span className="text-slate-200 font-medium">
                  {rupiah(neracaData.current_assets?.subtotal || 0)}
                </span>
              </div>
            </div>

            {/* Total Liabilitas */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-800/80 border border-slate-800 rounded-xl p-4.5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium flex items-center gap-1.5 text-slate-300">
                  <CreditCard className="w-4 h-4 text-rose-400" />
                  Total Liabilitas (Hutang)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                  Kewajiban
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-rose-400 tracking-tight">
                {rupiah(neracaData.liabilities?.subtotal || 0)}
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/70 pt-2">
                <span>Hutang Supplier:</span>
                <span className="text-slate-200 font-medium">
                  {rupiah(
                    neracaData.liabilities?.accounts?.find((a) => a.code === '2-20100')?.amount || 0
                  )}
                </span>
              </div>
            </div>

            {/* Total Modal */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-800/80 border border-slate-800 rounded-xl p-4.5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium flex items-center gap-1.5 text-slate-300">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  Total Modal & Ekuitas
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                  Kepemilikan
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-cyan-400 tracking-tight">
                {rupiah(neracaData.equity?.subtotal || 0)}
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/70 pt-2">
                <span>Laba Tahun Ini:</span>
                <span className="text-slate-200 font-medium">
                  {rupiah(
                    neracaData.equity?.accounts?.find((a) => a.code === '3-30003')?.amount || 0
                  )}
                </span>
              </div>
            </div>

            {/* Status Keseimbangan */}
            <div
              className={`bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-800/80 border rounded-xl p-4.5 shadow-sm relative overflow-hidden ${
                neracaData.is_balanced ? 'border-emerald-500/40' : 'border-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-medium flex items-center gap-1.5 text-slate-300">
                  <Scale className="w-4 h-4 text-emerald-400" />
                  Status Neraca
                </span>
                {neracaData.is_balanced ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    SEIMBANG
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    SELISIH
                  </span>
                )}
              </div>
              <div className="text-base sm:text-lg font-bold text-white tracking-tight">
                Aset = Kewajiban + Modal
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/70 pt-2">
                <span>Selisih Rekonsiliasi:</span>
                <span
                  className={`font-semibold ${
                    neracaData.is_balanced ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {rupiah(neracaData.difference || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* MAIN BALANCE SHEET STATEMENT */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            {/* Sheet Header (matches user layout) */}
            <div className="p-6 text-center border-b border-slate-800 bg-slate-950/40">
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-wider">
                LAPORAN NERACA
              </h2>
              <p className="text-sm text-slate-400 italic mt-1 font-serif">{periodSubtitle}</p>
            </div>

            {viewMode === 'stacked' ? (
              /* FORMAT STANDAR (EXACTLY MATCHING USER SCREENSHOT) */
              <div className="p-4 sm:p-8 space-y-6 max-w-4xl mx-auto">
                {/* 1. ASET LANCAR */}
                <div>
                  <h3 className="text-sm font-bold text-slate-200 mb-2.5 tracking-wide">
                    Aset Lancar
                  </h3>
                  <div className="divide-y divide-slate-800/50">
                    {(neracaData.current_assets?.accounts || []).map((acc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-2 text-xs sm:text-sm hover:bg-slate-800/30 px-3 rounded transition"
                      >
                        <div className="flex items-center gap-4 sm:gap-8">
                          <span className="w-20 font-mono text-slate-400 text-xs">
                            {acc.code || ''}
                          </span>
                          <span className="text-slate-200 font-medium">{acc.name}</span>
                        </div>
                        <div
                          className={`font-mono text-right font-medium ${
                            acc.amount < 0 ? 'text-rose-400' : 'text-slate-100'
                          }`}
                        >
                          {rupiah(acc.amount)}
                        </div>
                      </div>
                    ))}
                    {/* Subtotal Aset Lancar */}
                    <div className="flex items-center justify-between pt-3 pb-1 px-3 font-bold text-xs sm:text-sm border-t border-slate-700/80">
                      <span className="text-slate-100">Jumlah Aset Lancar</span>
                      <span className="font-mono text-emerald-400">
                        {rupiah(neracaData.current_assets?.subtotal || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. ASET TETAP */}
                <div>
                  <h3 className="text-sm font-bold text-slate-200 mb-2.5 tracking-wide">
                    Aset Tetap
                  </h3>
                  <div className="divide-y divide-slate-800/50">
                    {(neracaData.fixed_assets?.accounts || []).map((acc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-2 text-xs sm:text-sm hover:bg-slate-800/30 px-3 rounded transition"
                      >
                        <div className="flex items-center gap-4 sm:gap-8">
                          <span className="w-20 font-mono text-slate-400 text-xs">
                            {acc.code || ''}
                          </span>
                          <span className="text-slate-200 font-medium">{acc.name}</span>
                        </div>
                        <div className="font-mono text-right font-medium text-slate-100">
                          {rupiah(acc.amount)}
                        </div>
                      </div>
                    ))}
                    {/* Subtotal Aset Tetap */}
                    <div className="flex items-center justify-between pt-3 pb-1 px-3 font-bold text-xs sm:text-sm border-t border-slate-700/80">
                      <span className="text-slate-100">Jumlah Aset Tetap</span>
                      <span className="font-mono text-emerald-400">
                        {rupiah(neracaData.fixed_assets?.subtotal || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. LIABILITAS */}
                <div>
                  <h3 className="text-sm font-bold text-slate-200 mb-2.5 tracking-wide">
                    Liabilitas
                  </h3>
                  <div className="divide-y divide-slate-800/50">
                    {(neracaData.liabilities?.accounts || []).length > 0 &&
                    neracaData.liabilities?.accounts.some((a) => a.amount !== 0) ? (
                      neracaData.liabilities.accounts.map((acc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-2 text-xs sm:text-sm hover:bg-slate-800/30 px-3 rounded transition"
                        >
                          <div className="flex items-center gap-4 sm:gap-8">
                            <span className="w-20 font-mono text-slate-400 text-xs">
                              {acc.code || ''}
                            </span>
                            <span className="text-slate-200 font-medium">{acc.name}</span>
                          </div>
                          <div className="font-mono text-right font-medium text-rose-400">
                            {rupiah(acc.amount)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-2 text-xs sm:text-sm text-slate-500 italic px-3">
                        Tidak ada kewajiban / hutang aktif
                      </div>
                    )}
                    {/* Subtotal Liabilitas */}
                    <div className="flex items-center justify-between pt-3 pb-1 px-3 font-bold text-xs sm:text-sm border-t border-slate-700/80">
                      <span className="text-slate-100">Jumlah Hutang</span>
                      <span className="font-mono text-rose-400">
                        {rupiah(neracaData.liabilities?.subtotal || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. MODAL */}
                <div>
                  <h3 className="text-sm font-bold text-slate-200 mb-2.5 tracking-wide">Modal</h3>
                  <div className="divide-y divide-slate-800/50">
                    {(neracaData.equity?.accounts || []).map((acc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-2 text-xs sm:text-sm hover:bg-slate-800/30 px-3 rounded transition"
                      >
                        <div className="flex items-center gap-4 sm:gap-8">
                          <span className="w-20 font-mono text-slate-400 text-xs">
                            {acc.code || ''}
                          </span>
                          <span className="text-slate-200 font-medium">{acc.name}</span>
                        </div>
                        <div className="font-mono text-right font-medium text-cyan-400">
                          {rupiah(acc.amount)}
                        </div>
                      </div>
                    ))}
                    {/* Subtotal Modal */}
                    <div className="flex items-center justify-between pt-3 pb-1 px-3 font-bold text-xs sm:text-sm border-t border-slate-700/80">
                      <span className="text-slate-100">Jumlah Modal</span>
                      <span className="font-mono text-cyan-400">
                        {rupiah(neracaData.equity?.subtotal || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* GRAND TOTALS (EXACT BOTTOM ROW IN SCREENSHOT) */}
                <div className="mt-8 pt-6 border-t-2 border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 px-3 bg-slate-950/60 py-4 rounded-xl">
                  <div className="flex items-center justify-between sm:justify-start gap-4 w-full sm:w-auto">
                    <span className="text-sm sm:text-base font-extrabold text-white">
                      Jumlah Aset
                    </span>
                    <span className="font-mono text-base sm:text-lg font-bold text-emerald-400">
                      {rupiah(neracaData.total_assets?.amount || 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-start gap-4 w-full sm:w-auto">
                    <span className="text-sm sm:text-base font-extrabold text-white">
                      Jumlah Kewajiban dan Modal
                    </span>
                    <span className="font-mono text-base sm:text-lg font-bold text-cyan-400">
                      {rupiah(neracaData.total_liabilities_and_equity?.amount || 0)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* FORMAT 2 KOLOM (SKONTRO: AKTIVA KIRI vs PASIVA KANAN) */
              <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
                {/* KOLOM KIRI: AKTIVA / ASET */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                      AKTIVA (ASET)
                    </span>
                    <span className="font-mono text-xs text-slate-400">Kode & Nominal</span>
                  </div>

                  {/* Aset Lancar */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 mb-2">Aset Lancar</h4>
                    <div className="space-y-1.5">
                      {(neracaData.current_assets?.accounts || []).map((acc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-slate-800/40"
                        >
                          <span className="text-slate-300">
                            <span className="font-mono text-slate-500 mr-2">{acc.code}</span>
                            {acc.name}
                          </span>
                          <span
                            className={`font-mono ${
                              acc.amount < 0 ? 'text-rose-400' : 'text-slate-100'
                            }`}
                          >
                            {rupiah(acc.amount)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 font-semibold text-xs px-2">
                        <span className="text-slate-400">Subtotal Aset Lancar</span>
                        <span className="font-mono text-emerald-400">
                          {rupiah(neracaData.current_assets?.subtotal || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Aset Tetap */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 mb-2">Aset Tetap</h4>
                    <div className="space-y-1.5">
                      {(neracaData.fixed_assets?.accounts || []).map((acc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-slate-800/40"
                        >
                          <span className="text-slate-300">
                            <span className="font-mono text-slate-500 mr-2">{acc.code}</span>
                            {acc.name}
                          </span>
                          <span className="font-mono text-slate-100">{rupiah(acc.amount)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 font-semibold text-xs px-2">
                        <span className="text-slate-400">Subtotal Aset Tetap</span>
                        <span className="font-mono text-emerald-400">
                          {rupiah(neracaData.fixed_assets?.subtotal || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total Aktiva */}
                  <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-lg flex items-center justify-between font-bold text-sm">
                    <span className="text-white">TOTAL ASET (AKTIVA)</span>
                    <span className="font-mono text-emerald-400">
                      {rupiah(neracaData.total_assets?.amount || 0)}
                    </span>
                  </div>
                </div>

                {/* KOLOM KANAN: PASIVA (LIABILITAS + MODAL) */}
                <div className="space-y-6 pt-6 lg:pt-0 lg:pl-8">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
                      PASIVA (KEWAJIBAN & EKUITAS)
                    </span>
                    <span className="font-mono text-xs text-slate-400">Kode & Nominal</span>
                  </div>

                  {/* Liabilitas */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 mb-2">Liabilitas (Hutang)</h4>
                    <div className="space-y-1.5">
                      {(neracaData.liabilities?.accounts || []).map((acc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-slate-800/40"
                        >
                          <span className="text-slate-300">
                            <span className="font-mono text-slate-500 mr-2">{acc.code}</span>
                            {acc.name}
                          </span>
                          <span className="font-mono text-rose-400">{rupiah(acc.amount)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 font-semibold text-xs px-2">
                        <span className="text-slate-400">Subtotal Liabilitas</span>
                        <span className="font-mono text-rose-400">
                          {rupiah(neracaData.liabilities?.subtotal || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Modal */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 mb-2">Modal & Ekuitas</h4>
                    <div className="space-y-1.5">
                      {(neracaData.equity?.accounts || []).map((acc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-slate-800/40"
                        >
                          <span className="text-slate-300">
                            <span className="font-mono text-slate-500 mr-2">{acc.code}</span>
                            {acc.name}
                          </span>
                          <span className="font-mono text-cyan-400">{rupiah(acc.amount)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 font-semibold text-xs px-2">
                        <span className="text-slate-400">Subtotal Modal</span>
                        <span className="font-mono text-cyan-400">
                          {rupiah(neracaData.equity?.subtotal || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total Pasiva */}
                  <div className="p-3 bg-cyan-950/20 border border-cyan-500/30 rounded-lg flex items-center justify-between font-bold text-sm">
                    <span className="text-white">TOTAL KEWAJIBAN & MODAL</span>
                    <span className="font-mono text-cyan-400">
                      {rupiah(neracaData.total_liabilities_and_equity?.amount || 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Educational Accounting Guidance Box */}
          <div className="bg-slate-900/60 border border-slate-800/70 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-400">
            <Info className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <span className="font-semibold text-slate-200">
                Prinsip Keseimbangan Akuntansi Standar F&B (Neraca):
              </span>
              <p className="leading-relaxed">
                Neraca menyajikan posisi keuangan usaha pada titik waktu tertentu. Aset Lancar
                mencakup kas fisik laci toko, saldo rekening/QRIS, piutang bon pelanggan, dan nilai
                aset persediaan bahan baku di gudang. Modal bertambah dari laba bersih periode berjalan
                yang otomatis terhubung dari laporan Laba Rugi (P&L).
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
