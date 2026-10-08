import { useState, useEffect, useMemo } from 'react';
import {
  Landmark,
  Scale,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Building2,
  TrendingUp,
  CreditCard,
  Wallet,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Info,
  Sparkles,
  Layers,
  Store,
  Eye,
  RotateCcw,
} from 'lucide-react';
import api from '../api/client';
import { rupiah, LoadingState, PageHeader } from '../components/ui';
import { getTodayStr, getMonthStartStr, getMonthEndStr } from '../utils/date';
import { useOutlet } from '../context/OutletContext';
import { exportBalanceSheetToExcel, printBalanceSheetReport } from '../utils/exportReport';
import NeracaInlineDrilldown from '../components/NeracaInlineDrilldown';
import BalanceSheetDetailModal from '../components/BalanceSheetDetailModal';
import JournalVoucherModal from '../components/JournalVoucherModal';
import ReportPreviewModal from '../components/ReportPreviewModal';
import toast from 'react-hot-toast';

export default function Neraca() {
  const { currentBusiness, dateFrom, dateTo, dateRange } = useOutlet();

  const effectiveDateFrom = dateFrom || dateRange?.from || getMonthStartStr();
  const effectiveDateTo = dateTo || dateRange?.to || getMonthEndStr();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [neracaData, setNeracaData] = useState(null);
  const [viewMode, setViewMode] = useState('stacked'); // 'stacked' | 'two_column'
  const [expandedAccountCode, setExpandedAccountCode] = useState(null);
  const [branchModal, setBranchModal] = useState({
    isOpen: false,
    accountCode: null,
    accountName: null,
    outletId: null,
    outletName: null,
  });
  const [voucherModal, setVoucherModal] = useState({
    isOpen: false,
    journalId: null,
    entryNo: null,
  });

  const toggleExpandAccount = (code) => {
    setExpandedAccountCode((prev) => (prev === code ? null : code));
  };

  const renderAccountRow = (acc, themeColor = '#10b981') => {
    const isExpanded = expandedAccountCode === acc.code;
    return (
      <div key={acc.code || acc.name} style={{ marginBottom: 4 }}>
        <div
          onClick={() => toggleExpandAccount(acc.code)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            borderBottom: isExpanded ? 'none' : '1px solid rgba(165, 180, 252, 0.06)',
            fontSize: 13,
            cursor: 'pointer',
            borderRadius: isExpanded ? '8px 8px 0 0' : 8,
            background: isExpanded ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
            borderLeft: isExpanded ? `3px solid ${themeColor}` : '3px solid transparent',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!isExpanded) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          }}
          onMouseLeave={(e) => {
            if (!isExpanded) e.currentTarget.style.background = 'transparent';
          }}
          title={`Klik untuk drill-down cabang & transaksi: ${acc.name}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="mono" style={{ width: 75, color: isExpanded ? themeColor : 'var(--text-muted)', fontSize: 12, fontWeight: isExpanded ? 700 : 500 }}>
              {acc.code || ''}
            </span>
            <span style={{ color: '#ffffff', fontWeight: isExpanded ? 700 : 500 }}>
              {acc.name}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="mono" style={{ fontWeight: 700, color: acc.amount < 0 ? '#f43f5e' : (isExpanded ? themeColor : 'var(--text-primary)') }}>
              {rupiah(acc.amount)}
            </span>
            <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', transition: 'transform 0.2s ease', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
              <ChevronRight size={15} color={isExpanded ? themeColor : 'var(--text-muted)'} />
            </span>
          </div>
        </div>

        {isExpanded && (
          <div style={{ marginBottom: 6 }}>
            <NeracaInlineDrilldown
              accountCode={acc.code}
              accountName={acc.name}
              period={neracaData?.period || { from: effectiveDateFrom, to: effectiveDateTo }}
              onSelectBranch={(out) => {
                setBranchModal({
                  isOpen: true,
                  accountCode: acc.code,
                  accountName: `${acc.name} - ${out.outlet_name}`,
                  outletId: out.outlet_id,
                  outletName: out.outlet_name,
                });
              }}
            />
          </div>
        )}
      </div>
    );
  };

  const outletTitle = 'Semua Cabang (Konsolidasi)';

  // Fetch Neraca Data from API (Selalu 1 Neraca Konsolidasi Seluruh Entitas Bisnis)
  const fetchNeraca = async () => {
    setLoading(true);
    try {
      const params = {
        from: effectiveDateFrom,
        to: effectiveDateTo,
      };

      const res = await api.get('/reports/balance-sheet', { params });
      setNeracaData(res.data);
    } catch (err) {
      console.error('Gagal mengambil laporan neraca:', err);
      toast.error('Gagal memuat laporan neraca');
    } finally {
      setLoading(false);
    }
  };

  // Sync historical journals on demand
  const handleSyncJournals = async () => {
    setSyncing(true);
    const toastId = toast.loading('Melakukan sinkronisasi & hitung ulang seluruh jurnal...');
    try {
      const res = await api.post('/reports/balance-sheet/sync');
      toast.success(res.data?.message || 'Sinkronisasi jurnal berhasil diselesaikan!', { id: toastId });
      await fetchNeraca();
    } catch (err) {
      console.error('Sync journals error:', err);
      toast.error('Gagal melakukan sinkronisasi jurnal', { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchNeraca();
  }, [effectiveDateFrom, effectiveDateTo]);

  // Export to Excel
  const handleExportExcel = async () => {
    if (!neracaData) return;
    setExporting(true);
    try {
      const businessName = currentBusiness?.name || 'MOVA POS';
      const outletName = 'Semua Cabang (Konsolidasi)';

      await exportBalanceSheetToExcel({
        data: neracaData,
        period: neracaData.period || { from: effectiveDateFrom, to: effectiveDateTo },
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
    const outletName = 'Semua Cabang (Konsolidasi)';

    printBalanceSheetReport({
      data: neracaData,
      period: neracaData.period || { from: effectiveDateFrom, to: effectiveDateTo },
      businessName,
      outletName,
    });
  };

  const periodSubtitle = useMemo(() => {
    if (neracaData?.period?.from_formatted && neracaData?.period?.to_formatted) {
      return `Per ${neracaData.period.from_formatted} s/d ${neracaData.period.to_formatted}`;
    }
    return `Per ${effectiveDateFrom} s/d ${effectiveDateTo}`;
  }, [neracaData, effectiveDateFrom, effectiveDateTo]);

  const previewSheets = useMemo(() => {
    if (!neracaData) return [];

    const sheetRows = [];

    const appendSection = (title, accounts = []) => {
      accounts.forEach((acc) => {
        sheetRows.push({
          code: acc.code || '',
          name: acc.name || '',
          classification: title,
          amount: Number(acc.amount ?? acc.balance ?? acc.saldo_akhir) || 0,
        });
      });
    };

    appendSection('1. Aset Lancar', neracaData.current_assets?.accounts);
    if (neracaData.fixed_assets?.accounts?.length > 0) {
      appendSection('2. Aset Tetap', neracaData.fixed_assets?.accounts);
    }
    appendSection('2. Liabilitas (Kewajiban)', neracaData.liabilities?.accounts || neracaData.current_liabilities?.accounts);
    appendSection('3. Ekuitas / Modal', neracaData.equity?.accounts);

    const sheets = [
      {
        id: 'neraca_summary',
        name: 'Neraca Komprehensif',
        columns: [
          { key: 'code', label: 'Kode Akun', align: 'center', width: 14 },
          { key: 'name', label: 'Pos Neraca / Nama Akun', align: 'left', width: 34 },
          { key: 'classification', label: 'Kelompok Posisi', align: 'left', width: 26 },
          { key: 'amount', label: 'Nilai Saldo (Rp)', align: 'right', format: 'currency', width: 22 },
        ],
        data: sheetRows,
        totals: [
          {
            label: 'TOTAL ASET (AKTIVA)',
            amount: Number(neracaData.total_assets?.amount || neracaData.total_assets) || 0,
          },
          {
            label: 'TOTAL LIABILITAS & EKUITAS (PASIVA)',
            amount: Number(neracaData.total_liabilities_and_equity?.amount || ((Number(neracaData.total_liabilities) || 0) + (Number(neracaData.total_equity) || 0))) || 0,
          },
        ],
      },
      {
        id: 'neraca_aktiva',
        name: '1. Aktiva (Aset)',
        columns: [
          { key: 'code', label: 'Kode Akun', align: 'center', width: 14 },
          { key: 'name', label: 'Nama Akun Aset', align: 'left', width: 34 },
          { key: 'classification', label: 'Golongan', align: 'left', width: 22 },
          { key: 'amount', label: 'Saldo Aset (Rp)', align: 'right', format: 'currency', width: 22 },
        ],
        data: [
          ...(neracaData.current_assets?.accounts || []).map(a => ({ code: a.code, name: a.name, classification: 'Aset Lancar', amount: Number(a.amount) || 0 })),
          ...(neracaData.fixed_assets?.accounts || []).map(a => ({ code: a.code, name: a.name, classification: 'Aset Tetap', amount: Number(a.amount) || 0 })),
        ],
        totals: [
          {
            label: 'TOTAL AKTIVA / ASET',
            amount: Number(neracaData.total_assets?.amount || neracaData.total_assets) || 0,
          },
        ],
      },
      {
        id: 'neraca_pasiva',
        name: '2. Pasiva (Kewajiban & Modal)',
        columns: [
          { key: 'code', label: 'Kode Akun', align: 'center', width: 14 },
          { key: 'name', label: 'Nama Akun Pasiva', align: 'left', width: 34 },
          { key: 'classification', label: 'Golongan', align: 'left', width: 24 },
          { key: 'amount', label: 'Saldo (Rp)', align: 'right', format: 'currency', width: 22 },
        ],
        data: [
          ...((neracaData.liabilities?.accounts || neracaData.current_liabilities?.accounts || []).map(a => ({ code: a.code, name: a.name, classification: 'Liabilitas / Hutang', amount: Number(a.amount) || 0 }))),
          ...(neracaData.equity?.accounts || []).map(a => ({ code: a.code, name: a.name, classification: 'Ekuitas / Modal', amount: Number(a.amount) || 0 })),
        ],
        totals: [
          {
            label: 'TOTAL PASIVA (KEWAJIBAN & EKUITAS)',
            amount: Number(neracaData.total_liabilities_and_equity?.amount || ((Number(neracaData.total_liabilities) || 0) + (Number(neracaData.total_equity) || 0))) || 0,
          },
        ],
      },
    ];

    return sheets;
  }, [neracaData]);

  const previewKpis = useMemo(() => {
    if (!neracaData) return [];
    const totAssets = Number(neracaData.total_assets?.amount || neracaData.total_assets) || 0;
    const totLiab = Number(neracaData.total_liabilities?.amount || neracaData.total_liabilities || neracaData.liabilities?.subtotal) || 0;
    const totEq = Number(neracaData.total_equity?.amount || neracaData.total_equity || neracaData.equity?.subtotal) || 0;
    const diff = Number(neracaData.difference) || 0;

    return [
      {
        label: 'Total Aset (Aktiva)',
        value: totAssets,
        format: 'currency',
        color: '#10b981',
      },
      {
        label: 'Total Liabilitas (Hutang)',
        value: totLiab,
        format: 'currency',
        color: '#f59e0b',
      },
      {
        label: 'Total Modal / Ekuitas',
        value: totEq,
        format: 'currency',
        color: '#38bdf8',
      },
      {
        label: 'Status Keseimbangan',
        value: neracaData.is_balanced ? 'SEIMBANG (Rp 0)' : `SELISIH: ${rupiah(diff)}`,
        color: neracaData.is_balanced ? '#10b981' : '#f43f5e',
        subtext: 'Aset = Kewajiban + Ekuitas',
      },
    ];
  }, [neracaData]);

  return (
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* 1. Page Header & Actions */}
      <div className="flex-between mb-4 flex-wrap gap-3">
        <PageHeader
          title="Laporan Neraca (Balance Sheet)"
          subtitle="Posisi Keuangan Komprehensif Perusahaan: Aset (Aktiva), Liabilitas (Kewajiban), dan Modal (Ekuitas)"
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
            disabled={loading || syncing}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
            <span>Refresh</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSyncJournals}
            disabled={loading || syncing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#10b981',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              background: 'rgba(16, 185, 129, 0.08)',
              fontWeight: 600,
            }}
            title="Kalkulasi dan posting ulang seluruh jurnal pembukuan dari seluruh riwayat transaksi"
          >
            <RotateCcw size={14} className={syncing ? 'spin-anim' : ''} />
            <span>{syncing ? 'Menyinkronkan...' : 'Sinkronkan Jurnal'}</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPreviewModalOpen(true)}
            disabled={loading || !neracaData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#38bdf8',
              borderColor: 'rgba(56, 189, 248, 0.35)',
              background: 'rgba(56, 189, 248, 0.08)',
              fontWeight: 600,
            }}
          >
            <Eye size={14} />
            <span>Pratinjau Laporan</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handlePrint}
            disabled={loading || !neracaData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#a78bfa',
              borderColor: 'rgba(167, 139, 250, 0.35)',
              background: 'rgba(167, 139, 250, 0.08)',
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



      {loading ? (
        <LoadingState message="Menghitung posisi aset, liabilitas & modal neraca..." />
      ) : !neracaData ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Tidak ada data neraca untuk periode ini.
        </div>
      ) : (
        <>
          {/* Interactive Audit Trail Notice Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 10,
              background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontSize: 12.5,
              color: '#e0f2fe',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} color="#38bdf8" style={{ flexShrink: 0 }} />
              <span>
                <strong style={{ color: '#ffffff' }}>Audit Trail Interaktif:</strong> Klik pada pos akun, subtotal, atau kartu ringkasan mana saja di bawah ini untuk melihat rincian sumber nilai, rumus perhitungan, dan riwayat transaksi lengkapnya.
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              Klik akun untuk bedah data <ChevronRight size={13} />
            </span>
          </div>

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
                  Konsolidasi
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
                  Konsolidasi
                </span>
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#f43f5e', margin: '4px 0 8px 0' }}>
                {rupiah(neracaData.liabilities?.subtotal || 0)}
              </div>
              <div className="flex-between" style={{ fontSize: 11.5, color: 'var(--text-muted)', borderTop: '1px solid rgba(165, 180, 252, 0.08)', paddingTop: 6 }}>
                <span>Hutang Usaha:</span>
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
                  Konsolidasi
                </span>
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8', margin: '4px 0 8px 0' }}>
                {rupiah(neracaData.equity?.subtotal || 0)}
              </div>
              <div className="flex-between" style={{ fontSize: 11.5, color: 'var(--text-muted)', borderTop: '1px solid rgba(165, 180, 252, 0.08)', paddingTop: 6 }}>
                <span>Laba Tahun Ini:</span>
                <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {rupiah(neracaData.equity?.accounts?.find((a) => a.code === '3-30003' || a.code === '3-31003')?.amount || 0)}
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
                LAPORAN POSISI KEUANGAN (NERACA)
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                {periodSubtitle}
              </div>
              <div style={{ fontSize: 12.5, color: '#38bdf8', fontWeight: 700, marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 14px', borderRadius: 20, background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                <Building2 size={14} /> {currentBusiness?.name || 'Perusahaan'}
              </div>
            </div>

            {viewMode === 'stacked' ? (
              /* FORMAT STANDAR (STACKED / ACCORDION DRILL-DOWN) */
              <div style={{ padding: '24px 28px', maxWidth: 960, margin: '0 auto' }}>
                {/* 1. ASET LANCAR */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#10b981', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Wallet size={16} /> 1. Aset Lancar
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(neracaData.current_assets?.accounts || []).map((acc) =>
                      renderAccountRow(acc, '#10b981')
                    )}

                    {/* Subtotal Aset Lancar */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderTop: '1px solid var(--border-strong)',
                        background: 'rgba(16, 185, 129, 0.06)',
                        borderRadius: 8,
                        marginTop: 6,
                        fontWeight: 700,
                        fontSize: 13.5,
                      }}
                    >
                      <span style={{ color: '#ffffff' }}>Jumlah Aset Lancar</span>
                      <span className="mono" style={{ color: '#10b981', fontSize: 14 }}>
                        {rupiah(neracaData.current_assets?.subtotal || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. ASET TETAP (Jika Ada) */}
                {neracaData.fixed_assets?.accounts?.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#10b981', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Landmark size={16} /> 2. Aset Tetap
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {(neracaData.fixed_assets?.accounts || []).map((acc) =>
                        renderAccountRow(acc, '#10b981')
                      )}

                      {/* Subtotal Aset Tetap */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 14px',
                          borderTop: '1px solid var(--border-strong)',
                          background: 'rgba(16, 185, 129, 0.06)',
                          borderRadius: 8,
                          marginTop: 6,
                          fontWeight: 700,
                          fontSize: 13.5,
                        }}
                      >
                        <span style={{ color: '#ffffff' }}>Jumlah Aset Tetap</span>
                        <span className="mono" style={{ color: '#10b981', fontSize: 14 }}>
                          {rupiah(neracaData.fixed_assets?.subtotal || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

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
                    marginBottom: 36,
                  }}
                >
                  <span style={{ color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    JUMLAH ASET (AKTIVA)
                  </span>
                  <span className="mono" style={{ color: '#10b981', fontSize: 18 }}>
                    {rupiah(neracaData.total_assets?.amount || 0)}
                  </span>
                </div>

                {/* 3. LIABILITAS (KEWAJIBAN) */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#f43f5e', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CreditCard size={16} /> {neracaData.fixed_assets?.accounts?.length > 0 ? '3' : '2'}. Liabilitas (Hutang & Kewajiban)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(neracaData.liabilities?.accounts || []).map((acc) =>
                      renderAccountRow(acc, '#f43f5e')
                    )}

                    {/* Subtotal Liabilitas */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderTop: '1px solid var(--border-strong)',
                        background: 'rgba(244, 63, 94, 0.06)',
                        borderRadius: 8,
                        marginTop: 6,
                        fontWeight: 700,
                        fontSize: 13.5,
                      }}
                    >
                      <span style={{ color: '#ffffff' }}>Jumlah Liabilitas</span>
                      <span className="mono" style={{ color: '#f43f5e', fontSize: 14 }}>
                        {rupiah(neracaData.liabilities?.subtotal || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. MODAL & EKUITAS */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#38bdf8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TrendingUp size={16} /> {neracaData.fixed_assets?.accounts?.length > 0 ? '4' : '3'}. Modal & Ekuitas
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(neracaData.equity?.accounts || []).map((acc) =>
                      renderAccountRow(acc, '#38bdf8')
                    )}

                    {/* Subtotal Modal */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderTop: '1px solid var(--border-strong)',
                        background: 'rgba(56, 189, 248, 0.06)',
                        borderRadius: 8,
                        marginTop: 6,
                        fontWeight: 700,
                        fontSize: 13.5,
                      }}
                    >
                      <span style={{ color: '#ffffff' }}>Jumlah Modal & Ekuitas</span>
                      <span className="mono" style={{ color: '#38bdf8', fontSize: 14 }}>
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
                  <span className="mono" style={{ color: '#38bdf8', fontSize: 18 }}>
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
                    gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                    gap: 24,
                    alignItems: 'start',
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
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#10b981', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>ASET (AKTIVA)</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Klik baris untuk drill-down</span>
                      </div>

                      {/* Aset Lancar */}
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                          Aset Lancar
                        </div>
                        {(neracaData.current_assets?.accounts || []).map((acc) =>
                          renderAccountRow(acc, '#10b981')
                        )}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '9px 10px',
                            borderTop: '1px dashed var(--border)',
                            fontWeight: 700,
                            fontSize: 12.5,
                            color: '#10b981',
                            marginTop: 4,
                          }}
                        >
                          <span>Subtotal Aset Lancar</span>
                          <span className="mono">{rupiah(neracaData.current_assets?.subtotal || 0)}</span>
                        </div>
                      </div>

                      {/* Aset Tetap */}
                      {neracaData.fixed_assets?.accounts?.length > 0 && (
                        <div style={{ marginBottom: 18 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                            Aset Tetap
                          </div>
                          {(neracaData.fixed_assets?.accounts || []).map((acc) =>
                            renderAccountRow(acc, '#10b981')
                          )}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '9px 10px',
                              borderTop: '1px dashed var(--border)',
                              fontWeight: 700,
                              fontSize: 12.5,
                              color: '#10b981',
                              marginTop: 4,
                            }}
                          >
                            <span>Subtotal Aset Tetap</span>
                            <span className="mono">{rupiah(neracaData.fixed_assets?.subtotal || 0)}</span>
                          </div>
                        </div>
                      )}
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
                      <span className="mono" style={{ color: '#10b981', fontSize: 16 }}>
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
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#38bdf8', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>KEWAJIBAN & EKUITAS (PASSIVA)</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Klik baris untuk drill-down</span>
                      </div>

                      {/* Liabilitas */}
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                          1. Liabilitas (Kewajiban)
                        </div>
                        {(neracaData.liabilities?.accounts || []).map((acc) =>
                          renderAccountRow(acc, '#f43f5e')
                        )}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '9px 10px',
                            borderTop: '1px dashed var(--border)',
                            fontWeight: 700,
                            fontSize: 12.5,
                            color: '#f43f5e',
                            marginTop: 4,
                          }}
                        >
                          <span>Subtotal Liabilitas</span>
                          <span className="mono">{rupiah(neracaData.liabilities?.subtotal || 0)}</span>
                        </div>
                      </div>

                      {/* Modal */}
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                          2. Modal & Ekuitas
                        </div>
                        {(neracaData.equity?.accounts || []).map((acc) =>
                          renderAccountRow(acc, '#38bdf8')
                        )}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '9px 10px',
                            borderTop: '1px dashed var(--border)',
                            fontWeight: 700,
                            fontSize: 12.5,
                            color: '#38bdf8',
                            marginTop: 4,
                          }}
                        >
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
                      <span className="mono" style={{ color: '#38bdf8', fontSize: 16 }}>
                        {rupiah(neracaData.total_liabilities_and_equity?.amount || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Unforced Real Discrepancy Notice Banner */}
          {!neracaData.is_balanced && Math.abs(neracaData.difference || 0) >= 1 && (
            <div
              style={{
                marginTop: 18,
                padding: '16px 20px',
                borderRadius: 12,
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1.5px dashed rgba(245, 158, 11, 0.45)',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14.5, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>Selisih Neraca Riil: {rupiah(neracaData.difference || 0)}</span>
                      <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 12, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontWeight: 700 }}>
                        TIDAK DIREKAYASA / DISAJIKAN RIIL
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 4, lineHeight: 1.5 }}>
                      Laporan Neraca menyajikan data murni apa adanya tanpa dipaksa seimbang secara buatan.
                      <br />
                      <strong>Total Aset (Aktiva):</strong> {rupiah(neracaData.total_assets?.amount || 0)} &nbsp;|&nbsp; 
                      <strong>Total Kewajiban & Modal:</strong> {rupiah(neracaData.total_liabilities_and_equity?.amount || 0)} &nbsp;|&nbsp; 
                      <strong>Selisih:</strong> <span style={{ color: '#f59e0b', fontWeight: 700 }}>{rupiah(neracaData.difference || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Branch Journal Audit Detail Modal */}
          <BalanceSheetDetailModal
            isOpen={branchModal.isOpen}
            onClose={() => setBranchModal((prev) => ({ ...prev, isOpen: false }))}
            accountCode={branchModal.accountCode}
            accountName={branchModal.accountName}
            period={neracaData?.period || { from: effectiveDateFrom, to: effectiveDateTo }}
            outletId={branchModal.outletId}
            outletName={branchModal.outletName}
            businessName={currentBusiness?.name || 'MOVA POS'}
            onSyncSuccess={fetchNeraca}
          />

          {/* Journal Voucher Modal (for printing voucher slip from drilldown) */}
          <JournalVoucherModal
            isOpen={voucherModal.isOpen}
            onClose={() => setVoucherModal({ isOpen: false, journalId: null, entryNo: null })}
            journalId={voucherModal.journalId}
            entryNo={voucherModal.entryNo}
          />

          {/* Report Preview & Export Modal */}
          <ReportPreviewModal
            isOpen={previewModalOpen}
            onClose={() => setPreviewModalOpen(false)}
            title="Pratinjau Laporan Neraca"
            reportTitle="LAPORAN POSISI KEUANGAN (NERACA)"
            businessName={currentBusiness?.name || 'MOVA POS'}
            outletName="Semua Cabang (Konsolidasi)"
            periodText={periodSubtitle}
            kpis={previewKpis}
            sheets={previewSheets}
            onExportExcel={handleExportExcel}
            onPrint={handlePrint}
            exporting={exporting}
          />
        </>
      )}
    </div>
  );
}

