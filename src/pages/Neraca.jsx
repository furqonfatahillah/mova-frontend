import { useState, useEffect, useMemo } from 'react';
import {
  Landmark,
  Scale,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Building2,
  TrendingUp,
  CreditCard,
  Wallet,
  ArrowRight,
  Info,
  Sparkles,
  Layers,
  Store,
} from 'lucide-react';
import api from '../api/client';
import { rupiah, LoadingState, PageHeader } from '../components/ui';
import { getTodayStr, getMonthStartStr, getMonthEndStr } from '../utils/date';
import { useOutlet } from '../context/OutletContext';
import { exportBalanceSheetToExcel, printBalanceSheetReport } from '../utils/exportReport';
import toast from 'react-hot-toast';

export default function Neraca() {
  const { activeOutletId, activeOutlet, currentBusiness } = useOutlet();

  const [dateFrom, setDateFrom] = useState(() => getMonthStartStr());
  const [dateTo, setDateTo] = useState(() => getMonthEndStr());
  const [presetPeriod, setPresetPeriod] = useState('this_month'); // 'this_month' | 'last_month' | 'this_year' | 'custom'

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [neracaData, setNeracaData] = useState(null);
  const [viewMode, setViewMode] = useState('stacked'); // 'stacked' | 'two_column'

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
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* 1. Page Header & Actions */}
      <div className="flex-between mb-4 flex-wrap gap-3">
        <PageHeader
          title="Laporan Neraca (Balance Sheet)"
          subtitle="Posisi Keuangan Komprehensif: Aset (Aktiva), Liabilitas (Kewajiban), dan Modal (Ekuitas) sesuai Standar Akuntansi Keuangan."
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View Mode Toggle Switch */}
          <div
            style={{
              display: 'inline-flex',
              background: 'rgba(15, 20, 41, 0.8)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 3,
              gap: 4,
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('stacked')}
              className={`btn btn-sm ${viewMode === 'stacked' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              Format Standar
            </button>
            <button
              type="button"
              onClick={() => setViewMode('two_column')}
              className={`btn btn-sm ${viewMode === 'two_column' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              Format Skontro (2 Kolom)
            </button>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchNeraca}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
            <span>Refresh</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handlePrint}
            disabled={loading || !neracaData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#38bdf8',
              borderColor: 'rgba(56, 189, 248, 0.35)',
              background: 'rgba(56, 189, 248, 0.08)',
            }}
          >
            <Printer size={14} />
            <span>Cetak / PDF</span>
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleExportExcel}
            disabled={loading || exporting || !neracaData}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <FileSpreadsheet size={15} />
            <span>{exporting ? 'Mengekspor...' : 'Export Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* 2. Filter & Period Toolbar */}
      <div className="card mb-4" style={{ padding: '14px 18px' }}>
        <div className="flex-between flex-wrap gap-3">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Calendar size={14} color="var(--accent-bright)" />
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
                type="button"
                onClick={() => handlePeriodChange(p.id)}
                className={`btn btn-sm ${presetPeriod === p.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 12px', fontSize: 12 }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="date"
              className="form-control form-control-sm"
              style={{ width: 140 }}
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPresetPeriod('custom');
              }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>s/d</span>
            <input
              type="date"
              className="form-control form-control-sm"
              style={{ width: 140 }}
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPresetPeriod('custom');
              }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Menghitung posisi aset, liabilitas & modal neraca..." />
      ) : !neracaData ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Tidak ada data neraca untuk periode ini.
        </div>
      ) : (
        <>
          {/* 3. Executive KPI Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 14,
              marginBottom: 20,
            }}
          >
            {/* Total Aset */}
            <div
              className="card"
              style={{
                padding: '16px 18px',
                borderLeft: '4px solid #10b981',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(20, 26, 52, 0.72) 100%)',
              }}
            >
              <div className="flex-between mb-1">
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Landmark size={15} color="#10b981" />
                  Total Aset (Aktiva)
                </span>
                <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700 }}>
                  Kekayaan Usaha
                </span>
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#10b981', margin: '4px 0 8px 0' }}>
                {rupiah(neracaData.total_assets?.amount || 0)}
              </div>
              <div className="flex-between" style={{ fontSize: 11.5, color: 'var(--text-muted)', borderTop: '1px solid rgba(165, 180, 252, 0.08)', paddingTop: 6 }}>
                <span>Aset Lancar:</span>
                <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {rupiah(neracaData.current_assets?.subtotal || 0)}
                </span>
              </div>
            </div>

            {/* Total Liabilitas */}
            <div
              className="card"
              style={{
                padding: '16px 18px',
                borderLeft: '4px solid #f43f5e',
                background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(20, 26, 52, 0.72) 100%)',
              }}
            >
              <div className="flex-between mb-1">
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CreditCard size={15} color="#f43f5e" />
                  Total Liabilitas (Hutang)
                </span>
                <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 6, background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', fontWeight: 700 }}>
                  Kewajiban
                </span>
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#f43f5e', margin: '4px 0 8px 0' }}>
                {rupiah(neracaData.liabilities?.subtotal || 0)}
              </div>
              <div className="flex-between" style={{ fontSize: 11.5, color: 'var(--text-muted)', borderTop: '1px solid rgba(165, 180, 252, 0.08)', paddingTop: 6 }}>
                <span>Hutang Supplier:</span>
                <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {rupiah(neracaData.liabilities?.accounts?.find((a) => a.code === '2-20100')?.amount || 0)}
                </span>
              </div>
            </div>

            {/* Total Modal & Ekuitas */}
            <div
              className="card"
              style={{
                padding: '16px 18px',
                borderLeft: '4px solid #38bdf8',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(20, 26, 52, 0.72) 100%)',
              }}
            >
              <div className="flex-between mb-1">
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrendingUp size={15} color="#38bdf8" />
                  Total Modal & Ekuitas
                </span>
                <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 6, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 700 }}>
                  Kepemilikan
                </span>
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8', margin: '4px 0 8px 0' }}>
                {rupiah(neracaData.equity?.subtotal || 0)}
              </div>
              <div className="flex-between" style={{ fontSize: 11.5, color: 'var(--text-muted)', borderTop: '1px solid rgba(165, 180, 252, 0.08)', paddingTop: 6 }}>
                <span>Laba Tahun Ini:</span>
                <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {rupiah(neracaData.equity?.accounts?.find((a) => a.code === '3-30003')?.amount || 0)}
                </span>
              </div>
            </div>

            {/* Status Keseimbangan Neraca */}
            <div
              className="card"
              style={{
                padding: '16px 18px',
                borderLeft: `4px solid ${neracaData.is_balanced ? '#10b981' : '#f59e0b'}`,
                background: neracaData.is_balanced
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(20, 26, 52, 0.72) 100%)'
                  : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(20, 26, 52, 0.72) 100%)',
              }}
            >
              <div className="flex-between mb-1">
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Scale size={15} color={neracaData.is_balanced ? '#10b981' : '#f59e0b'} />
                  Status Neraca
                </span>
                {neracaData.is_balanced ? (
                  <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={12} /> SEIMBANG
                  </span>
                ) : (
                  <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 6, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={12} /> SELISIH
                  </span>
                )}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', margin: '6px 0 8px 0' }}>
                Aset = Kewajiban + Modal
              </div>
              <div className="flex-between" style={{ fontSize: 11.5, color: 'var(--text-muted)', borderTop: '1px solid rgba(165, 180, 252, 0.08)', paddingTop: 6 }}>
                <span>Selisih Rekonsiliasi:</span>
                <span className="mono" style={{ color: neracaData.is_balanced ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                  {rupiah(neracaData.difference || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* 4. MAIN BALANCE SHEET STATEMENT CARD */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Statement Header */}
            <div
              style={{
                padding: '24px 20px',
                textAlign: 'center',
                borderBottom: '1px solid var(--border)',
                background: 'rgba(15, 20, 41, 0.65)',
              }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '0.05em', color: '#ffffff', margin: 0 }}>
                LAPORAN NERACA
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                {periodSubtitle}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--accent-bright)', fontWeight: 600, marginTop: 2 }}>
                {neracaData?.period?.outlet_name || 'Semua Cabang (Konsolidasi)'}
              </div>
            </div>

            {viewMode === 'stacked' ? (
              /* FORMAT STANDAR (STACKED ACCORDION / LEDGER) */
              <div style={{ padding: '24px 28px', maxWidth: 860, margin: '0 auto' }}>
                {/* 1. ASET LANCAR */}
                <div style={{ marginBottom: 26 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-bright)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Aset Lancar
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(neracaData.current_assets?.accounts || []).map((acc, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          borderBottom: '1px solid rgba(165, 180, 252, 0.06)',
                          fontSize: 13,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span className="mono" style={{ width: 75, color: 'var(--text-muted)', fontSize: 12 }}>
                            {acc.code || ''}
                          </span>
                          <span style={{ color: '#ffffff', fontWeight: 500 }}>
                            {acc.name}
                          </span>
                        </div>
                        <span className="mono" style={{ fontWeight: 600, color: acc.amount < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                          {rupiah(acc.amount)}
                        </span>
                      </div>
                    ))}
                    {/* Subtotal Aset Lancar */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderTop: '1px solid var(--border-strong)',
                        background: 'rgba(165, 180, 252, 0.04)',
                        borderRadius: 6,
                        marginTop: 4,
                        fontWeight: 700,
                        fontSize: 13.5,
                      }}
                    >
                      <span style={{ color: '#ffffff' }}>Jumlah Aset Lancar</span>
                      <span className="mono" style={{ color: '#10b981' }}>
                        {rupiah(neracaData.current_assets?.subtotal || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. ASET TETAP */}
                <div style={{ marginBottom: 26 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-bright)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Aset Tetap
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(neracaData.fixed_assets?.accounts || []).map((acc, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          borderBottom: '1px solid rgba(165, 180, 252, 0.06)',
                          fontSize: 13,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span className="mono" style={{ width: 75, color: 'var(--text-muted)', fontSize: 12 }}>
                            {acc.code || ''}
                          </span>
                          <span style={{ color: '#ffffff', fontWeight: 500 }}>
                            {acc.name}
                          </span>
                        </div>
                        <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {rupiah(acc.amount)}
                        </span>
                      </div>
                    ))}
                    {/* Subtotal Aset Tetap */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderTop: '1px solid var(--border-strong)',
                        background: 'rgba(165, 180, 252, 0.04)',
                        borderRadius: 6,
                        marginTop: 4,
                        fontWeight: 700,
                        fontSize: 13.5,
                      }}
                    >
                      <span style={{ color: '#ffffff' }}>Jumlah Aset Tetap</span>
                      <span className="mono" style={{ color: '#10b981' }}>
                        {rupiah(neracaData.fixed_assets?.subtotal || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* GRAND TOTAL ASET (AKTIVA) */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 18px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(20, 26, 52, 0.88) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    fontWeight: 800,
                    fontSize: 15,
                    marginBottom: 32,
                  }}
                >
                  <span style={{ color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    JUMLAH ASET (AKTIVA)
                  </span>
                  <span className="mono" style={{ color: '#10b981', fontSize: 17 }}>
                    {rupiah(neracaData.total_assets?.amount || 0)}
                  </span>
                </div>

                {/* 3. LIABILITAS (KEWAJIBAN) */}
                <div style={{ marginBottom: 26 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-bright)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Liabilitas (Hutang & Kewajiban)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(neracaData.liabilities?.accounts || []).map((acc, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          borderBottom: '1px solid rgba(165, 180, 252, 0.06)',
                          fontSize: 13,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span className="mono" style={{ width: 75, color: 'var(--text-muted)', fontSize: 12 }}>
                            {acc.code || ''}
                          </span>
                          <span style={{ color: '#ffffff', fontWeight: 500 }}>
                            {acc.name}
                          </span>
                        </div>
                        <span className="mono" style={{ fontWeight: 600, color: '#f43f5e' }}>
                          {rupiah(acc.amount)}
                        </span>
                      </div>
                    ))}
                    {/* Subtotal Liabilitas */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderTop: '1px solid var(--border-strong)',
                        background: 'rgba(165, 180, 252, 0.04)',
                        borderRadius: 6,
                        marginTop: 4,
                        fontWeight: 700,
                        fontSize: 13.5,
                      }}
                    >
                      <span style={{ color: '#ffffff' }}>Jumlah Liabilitas</span>
                      <span className="mono" style={{ color: '#f43f5e' }}>
                        {rupiah(neracaData.liabilities?.subtotal || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. MODAL & EKUITAS */}
                <div style={{ marginBottom: 26 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-bright)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Modal & Ekuitas
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(neracaData.equity?.accounts || []).map((acc, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          borderBottom: '1px solid rgba(165, 180, 252, 0.06)',
                          fontSize: 13,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span className="mono" style={{ width: 75, color: 'var(--text-muted)', fontSize: 12 }}>
                            {acc.code || ''}
                          </span>
                          <span style={{ color: '#ffffff', fontWeight: 500 }}>
                            {acc.name}
                          </span>
                        </div>
                        <span className="mono" style={{ fontWeight: 600, color: '#38bdf8' }}>
                          {rupiah(acc.amount)}
                        </span>
                      </div>
                    ))}
                    {/* Subtotal Modal */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderTop: '1px solid var(--border-strong)',
                        background: 'rgba(165, 180, 252, 0.04)',
                        borderRadius: 6,
                        marginTop: 4,
                        fontWeight: 700,
                        fontSize: 13.5,
                      }}
                    >
                      <span style={{ color: '#ffffff' }}>Jumlah Modal & Ekuitas</span>
                      <span className="mono" style={{ color: '#38bdf8' }}>
                        {rupiah(neracaData.equity?.subtotal || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* GRAND TOTAL KEWAJIBAN & MODAL (PASSIVA) */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 18px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.16) 0%, rgba(20, 26, 52, 0.88) 100%)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    fontWeight: 800,
                    fontSize: 15,
                  }}
                >
                  <span style={{ color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    JUMLAH KEWAJIBAN DAN MODAL (PASSIVA)
                  </span>
                  <span className="mono" style={{ color: '#38bdf8', fontSize: 17 }}>
                    {rupiah(neracaData.total_liabilities_and_equity?.amount || 0)}
                  </span>
                </div>
              </div>
            ) : (
              /* FORMAT SKONTRO (2 KOLOM SIDE-BY-SIDE) */
              <div style={{ padding: '24px 24px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                    gap: 24,
                  }}
                >
                  {/* LEFT COLUMN: AKTIVA (ASET) */}
                  <div
                    style={{
                      background: 'rgba(15, 20, 41, 0.5)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '18px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#10b981', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 14 }}>
                        ASET (AKTIVA)
                      </div>

                      {/* Aset Lancar */}
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                          1. Aset Lancar
                        </div>
                        {(neracaData.current_assets?.accounts || []).map((acc, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', fontSize: 12.5 }}>
                            <span style={{ color: '#cbd5e1' }}>{acc.code} {acc.name}</span>
                            <span className="mono" style={{ color: '#ffffff' }}>{rupiah(acc.amount)}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderTop: '1px dashed var(--border)', fontWeight: 700, fontSize: 12.5, color: '#10b981' }}>
                          <span>Subtotal Aset Lancar</span>
                          <span className="mono">{rupiah(neracaData.current_assets?.subtotal || 0)}</span>
                        </div>
                      </div>

                      {/* Aset Tetap */}
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                          2. Aset Tetap
                        </div>
                        {(neracaData.fixed_assets?.accounts || []).map((acc, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', fontSize: 12.5 }}>
                            <span style={{ color: '#cbd5e1' }}>{acc.code} {acc.name}</span>
                            <span className="mono" style={{ color: '#ffffff' }}>{rupiah(acc.amount)}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderTop: '1px dashed var(--border)', fontWeight: 700, fontSize: 12.5, color: '#10b981' }}>
                          <span>Subtotal Aset Tetap</span>
                          <span className="mono">{rupiah(neracaData.fixed_assets?.subtotal || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Total Aktiva Footer */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        background: 'rgba(16, 185, 129, 0.14)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: 8,
                        fontWeight: 800,
                        fontSize: 14,
                        marginTop: 14,
                      }}
                    >
                      <span style={{ color: '#ffffff' }}>TOTAL ASET (AKTIVA)</span>
                      <span className="mono" style={{ color: '#10b981', fontSize: 15 }}>
                        {rupiah(neracaData.total_assets?.amount || 0)}
                      </span>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: PASSIVA (KEWAJIBAN & MODAL) */}
                  <div
                    style={{
                      background: 'rgba(15, 20, 41, 0.5)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '18px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#38bdf8', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 14 }}>
                        KEWAJIBAN & EKUITAS (PASSIVA)
                      </div>

                      {/* Liabilitas */}
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                          1. Liabilitas (Kewajiban)
                        </div>
                        {(neracaData.liabilities?.accounts || []).map((acc, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', fontSize: 12.5 }}>
                            <span style={{ color: '#cbd5e1' }}>{acc.code} {acc.name}</span>
                            <span className="mono" style={{ color: '#f43f5e' }}>{rupiah(acc.amount)}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderTop: '1px dashed var(--border)', fontWeight: 700, fontSize: 12.5, color: '#f43f5e' }}>
                          <span>Subtotal Liabilitas</span>
                          <span className="mono">{rupiah(neracaData.liabilities?.subtotal || 0)}</span>
                        </div>
                      </div>

                      {/* Modal */}
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                          2. Modal & Ekuitas
                        </div>
                        {(neracaData.equity?.accounts || []).map((acc, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', fontSize: 12.5 }}>
                            <span style={{ color: '#cbd5e1' }}>{acc.code} {acc.name}</span>
                            <span className="mono" style={{ color: '#38bdf8' }}>{rupiah(acc.amount)}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderTop: '1px dashed var(--border)', fontWeight: 700, fontSize: 12.5, color: '#38bdf8' }}>
                          <span>Subtotal Modal & Ekuitas</span>
                          <span className="mono">{rupiah(neracaData.equity?.subtotal || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Total Passiva Footer */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        background: 'rgba(56, 189, 248, 0.14)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        borderRadius: 8,
                        fontWeight: 800,
                        fontSize: 14,
                        marginTop: 14,
                      }}
                    >
                      <span style={{ color: '#ffffff' }}>TOTAL KEWAJIBAN & MODAL</span>
                      <span className="mono" style={{ color: '#38bdf8', fontSize: 15 }}>
                        {rupiah(neracaData.total_liabilities_and_equity?.amount || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
