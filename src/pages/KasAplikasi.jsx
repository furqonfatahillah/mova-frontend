import { useState, useEffect, useMemo } from 'react';
import {
  Sparkles, Wallet, Landmark, ArrowUpRight, ArrowDownLeft,
  RefreshCw, Plus, Search, Filter, Building2,
  CheckCircle2, AlertCircle, QrCode, Download, Printer,
  FileSpreadsheet, ExternalLink, ArrowRight, Eye, Info,
  DollarSign, Check, X, ShieldCheck, ShoppingBag
} from 'lucide-react';
import api, { getMediaUrl } from '../api/client';
import { rupiah, LoadingState, PageHeader } from '../components/ui';
import { getTodayStr } from '../utils/date';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import * as XLSX from 'xlsx';

export default function KasAplikasi() {
  const { activeOutletId, activeOutlet, outlets, currentBusiness } = useOutlet();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    current_balance: 0,
    all_time_qris_sales: 0,
    all_time_deposits: 0,
    period_qris_sales: 0,
    period_deposits: 0,
    today_qris_sales: 0,
    today_deposits: 0,
    month_qris_sales: 0,
    month_deposits: 0,
    by_method: {},
    qris_image_url: null,
    primary_bank_account: null,
    bank_accounts: [],
    history: [],
    qris_history: [],
    deposit_history: [],
  });

  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'QRIS' | 'GRAB' | 'GOFOOD' | 'SHOPEEFOOD' | 'DEPOSIT'
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Setor ke Bank
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [depositForm, setDepositForm] = useState({
    amount: '',
    bank_account_id: '',
    date: getTodayStr(),
    notes: '',
  });

  // Modal Preview QRIS
  const [qrisPreviewModal, setQrisPreviewModal] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, [activeOutletId]);

  async function fetchSummary() {
    setLoading(true);
    try {
      const params = {};
      if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
        params.outlet_id = activeOutletId;
      }

      const res = await api.get('/kas-aplikasi/summary', { params });
      if (res.data?.status === 'success') {
        setData(res.data.data);
        // Default bank account for deposit form
        if (res.data.data.bank_accounts?.length > 0 && !depositForm.bank_account_id) {
          const primary = res.data.data.bank_accounts.find(b => b.is_primary) || res.data.data.bank_accounts[0];
          setDepositForm(prev => ({ ...prev, bank_account_id: String(primary.id) }));
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat data Kas Aplikasi');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenDepositModal() {
    if (data.current_balance <= 0) {
      toast.error('Saldo Kas Aplikasi saat ini Rp 0. Tidak ada saldo untuk disetor.');
      return;
    }
    setDepositForm({
      amount: String(Math.floor(data.current_balance)),
      bank_account_id: data.primary_bank_account ? String(data.primary_bank_account.id) : (data.bank_accounts[0]?.id ? String(data.bank_accounts[0].id) : ''),
      date: getTodayStr(),
      notes: '',
    });
    setDepositModalOpen(true);
  }

  async function handleSubmitDeposit(e) {
    e.preventDefault();
    const amt = Number(depositForm.amount);
    if (!amt || amt <= 0) {
      toast.error('Masukkan nominal setoran yang valid');
      return;
    }
    if (amt > data.current_balance) {
      toast.error(`Nominal setoran (${rupiah(amt)}) melebihi saldo Kas Aplikasi (${rupiah(data.current_balance)})`);
      return;
    }

    setDepositSubmitting(true);
    try {
      const res = await api.post('/kas-aplikasi/setor', {
        amount: amt,
        bank_account_id: depositForm.bank_account_id ? Number(depositForm.bank_account_id) : null,
        date: depositForm.date,
        notes: depositForm.notes,
        outlet_id: activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : null,
      });

      if (res.data?.status === 'success') {
        toast.success(res.data.message || 'Setoran Kas Aplikasi ke Bank berhasil!');
        setDepositModalOpen(false);
        fetchSummary();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gagal memproses setoran kas aplikasi');
    } finally {
      setDepositSubmitting(false);
    }
  }

  // Method Statistics calculation
  const methodStats = useMemo(() => {
    const list = data.history || [];
    const getStats = (catKey) => {
      const items = list.filter(item => {
        if (catKey === 'DEPOSIT') return item.type === 'OUT' || item.method_category === 'DEPOSIT';
        return item.type === 'IN' && item.method_category === catKey;
      });
      const total = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const count = items.length;
      return { items, total, count };
    };

    return {
      ALL: {
        total: data.all_time_qris_sales,
        count: list.filter(i => i.type === 'IN').length,
        balance: data.current_balance,
        deposits: data.all_time_deposits,
      },
      QRIS: getStats('QRIS'),
      GRAB: getStats('GRAB'),
      GOFOOD: getStats('GOFOOD'),
      SHOPEEFOOD: getStats('SHOPEEFOOD'),
      DEPOSIT: getStats('DEPOSIT'),
    };
  }, [data]);

  // Tab definitions
  const TABS = [
    { key: 'ALL', label: 'Semua Mutasi', count: data.history?.length || 0, icon: Sparkles, color: 'var(--accent-bright)' },
    { key: 'QRIS', label: 'QRIS', count: methodStats.QRIS.count, icon: QrCode, color: '#38bdf8' },
    { key: 'GRAB', label: 'GrabFood', count: methodStats.GRAB.count, icon: ShoppingBag, color: '#00B14F' },
    { key: 'GOFOOD', label: 'GoFood', count: methodStats.GOFOOD.count, icon: ShoppingBag, color: '#EE2737' },
    { key: 'SHOPEEFOOD', label: 'ShopeeFood', count: methodStats.SHOPEEFOOD.count, icon: ShoppingBag, color: '#EE4D2D' },
    { key: 'DEPOSIT', label: 'Setor ke Bank', count: methodStats.DEPOSIT.count, icon: Landmark, color: '#a78bfa' },
  ];

  // Filtered transactions
  const filteredHistory = useMemo(() => {
    let list = data.history || [];
    if (filterTab === 'QRIS') {
      list = list.filter(item => item.method_category === 'QRIS' && item.type === 'IN');
    } else if (filterTab === 'GRAB') {
      list = list.filter(item => item.method_category === 'GRAB' && item.type === 'IN');
    } else if (filterTab === 'GOFOOD') {
      list = list.filter(item => item.method_category === 'GOFOOD' && item.type === 'IN');
    } else if (filterTab === 'SHOPEEFOOD') {
      list = list.filter(item => item.method_category === 'SHOPEEFOOD' && item.type === 'IN');
    } else if (filterTab === 'DEPOSIT') {
      list = list.filter(item => item.type === 'OUT' || item.method_category === 'DEPOSIT');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item =>
        (item.reference_no && item.reference_no.toLowerCase().includes(q)) ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.outlet_name && item.outlet_name.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        (item.payment_method && item.payment_method.toLowerCase().includes(q))
      );
    }
    return list;
  }, [data.history, filterTab, searchQuery]);

  function handleExportExcel() {
    if (!filteredHistory || filteredHistory.length === 0) {
      toast.error('Tidak ada data untuk diexport');
      return;
    }

    const rows = filteredHistory.map((item, idx) => ({
      No: idx + 1,
      Tanggal: item.date || '',
      Waktu: item.time || '',
      Tipe: item.type_label || (item.type === 'IN' ? 'Penerimaan Aplikasi' : 'Setor ke Bank'),
      'No. Referensi': item.reference_no || '',
      Keterangan: item.name || '',
      Cabang: item.outlet_name || '',
      'Nominal (Rp)': item.amount || 0,
      'Metode/Akun': item.payment_method || item.account || '',
      Status: item.status || '',
      Catatan: item.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kas_Aplikasi');
    XLSX.writeFile(wb, `Laporan_Kas_Aplikasi_${filterTab}_${getTodayStr()}.xlsx`);
    toast.success('File Excel berhasil diunduh!');
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 60 }}>
      {/* Top Page Header */}
      <PageHeader
        title="Kas Aplikasi"
        subtitle="Penerimaan transaksi non-tunai aplikasi (QRIS, GrabFood, GoFood, ShopeeFood, E-Commerce) & penyetoran saldo ke rekening bank operasional"
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={fetchSummary}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportExcel}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <FileSpreadsheet size={14} color="#10b981" />
            Export Excel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenDepositModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)',
              border: 'none',
              padding: '10px 18px',
            }}
          >
            <Landmark size={16} />
            Setor ke Bank
          </button>
        </div>
      </PageHeader>

      {/* ======================================================== */}
      {/* DYNAMIC KPI CARDS (MENYESUAIKAN TAB METODE PEMBAYARAN) */}
      {/* ======================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        {/* CARD 1: MAIN METRIC */}
        <div style={{
          background: filterTab === 'GRAB'
            ? 'linear-gradient(135deg, rgba(0, 177, 79, 0.2), rgba(0, 177, 79, 0.08))'
            : filterTab === 'GOFOOD'
              ? 'linear-gradient(135deg, rgba(238, 39, 55, 0.2), rgba(238, 39, 55, 0.08))'
              : filterTab === 'SHOPEEFOOD'
                ? 'linear-gradient(135deg, rgba(238, 77, 45, 0.2), rgba(238, 77, 45, 0.08))'
                : filterTab === 'DEPOSIT'
                  ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.08))'
                  : 'linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(37, 99, 235, 0.12))',
          border: `1px solid ${
            filterTab === 'GRAB' ? 'rgba(0, 177, 79, 0.4)' :
            filterTab === 'GOFOOD' ? 'rgba(238, 39, 55, 0.4)' :
            filterTab === 'SHOPEEFOOD' ? 'rgba(238, 77, 45, 0.4)' :
            filterTab === 'DEPOSIT' ? 'rgba(139, 92, 246, 0.4)' :
            'rgba(56, 189, 248, 0.4)'
          }`,
          borderRadius: 16,
          padding: 22,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                color: filterTab === 'GRAB' ? '#4ade80' :
                       filterTab === 'GOFOOD' ? '#f87171' :
                       filterTab === 'SHOPEEFOOD' ? '#fb923c' :
                       filterTab === 'DEPOSIT' ? '#c4b5fd' :
                       '#38bdf8',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <Sparkles size={15} />
                {filterTab === 'ALL' ? 'Saldo Kas Aplikasi (Tersedia)' :
                 filterTab === 'DEPOSIT' ? 'Total Disetor ke Bank' :
                 `Total Penerimaan ${filterTab === 'GRAB' ? 'GrabFood' : filterTab === 'GOFOOD' ? 'GoFood' : filterTab === 'SHOPEEFOOD' ? 'ShopeeFood' : 'QRIS'}`}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#ffffff', marginTop: 4, letterSpacing: -0.5 }}>
                {rupiah(
                  filterTab === 'ALL' ? data.current_balance :
                  filterTab === 'DEPOSIT' ? data.all_time_deposits :
                  (methodStats[filterTab]?.total || 0)
                )}
              </div>
            </div>
            <div style={{
              width: 44, height: 44,
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: filterTab === 'GRAB' ? '#4ade80' :
                     filterTab === 'GOFOOD' ? '#f87171' :
                     filterTab === 'SHOPEEFOOD' ? '#fb923c' :
                     filterTab === 'DEPOSIT' ? '#c4b5fd' :
                     '#38bdf8'
            }}>
              {filterTab === 'DEPOSIT' ? <Landmark size={22} /> : filterTab === 'ALL' ? <Wallet size={22} /> : filterTab === 'QRIS' ? <QrCode size={22} /> : <ShoppingBag size={22} />}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Akun Akuntansi: <strong style={{ color: '#e0f2fe' }}>1-11004 (Kas Aplikasi)</strong>
            </span>
            <button
              type="button"
              onClick={handleOpenDepositModal}
              disabled={data.current_balance <= 0}
              style={{
                background: data.current_balance > 0 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${data.current_balance > 0 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: data.current_balance > 0 ? '#38bdf8' : 'var(--text-muted)',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: data.current_balance > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              Setor Sekarang <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* CARD 2: FREKUENSI & PENERIMAAN */}
        <div style={{
          background: 'rgba(17, 22, 45, 0.7)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 16,
          padding: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowDownLeft size={15} />
                {filterTab === 'ALL' ? 'Total Penerimaan Aplikasi' :
                 filterTab === 'DEPOSIT' ? 'Frekuensi Penyetoran' :
                 `Frekuensi Transaksi ${filterTab === 'GRAB' ? 'GrabFood' : filterTab === 'GOFOOD' ? 'GoFood' : filterTab === 'SHOPEEFOOD' ? 'ShopeeFood' : 'QRIS'}`}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
                {filterTab === 'ALL'
                  ? rupiah(data.all_time_qris_sales)
                  : filterTab === 'DEPOSIT'
                    ? `${methodStats.DEPOSIT.count} Kali Setor`
                    : `${methodStats[filterTab]?.count || 0} Transaksi`
                }
              </div>
            </div>
            <div style={{
              width: 40, height: 40,
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#34d399'
            }}>
              {filterTab === 'ALL' ? <QrCode size={20} /> : <CheckCircle2 size={20} />}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
            {filterTab === 'ALL' ? (
              <>
                <span>Hari ini: <strong style={{ color: '#34d399' }}>{rupiah(data.today_qris_sales)}</strong></span>
                <span>•</span>
                <span>Bulan ini: <strong style={{ color: '#ffffff' }}>{rupiah(data.month_qris_sales)}</strong></span>
              </>
            ) : filterTab === 'DEPOSIT' ? (
              <>
                <span>Hari ini: <strong style={{ color: '#a78bfa' }}>{rupiah(data.today_deposits)}</strong></span>
                <span>•</span>
                <span>Bulan ini: <strong style={{ color: '#ffffff' }}>{rupiah(data.month_deposits)}</strong></span>
              </>
            ) : (
              <span>Rata-rata: <strong style={{ color: '#34d399' }}>{rupiah(methodStats[filterTab]?.count ? methodStats[filterTab].total / methodStats[filterTab].count : 0)} / trx</strong></span>
            )}
          </div>
        </div>

        {/* CARD 3: SETORAN / STATUS CHANNEL */}
        <div style={{
          background: 'rgba(17, 22, 45, 0.7)',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          borderRadius: 16,
          padding: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowUpRight size={15} />
                {filterTab === 'ALL' ? 'Total Disetor ke Bank' :
                 filterTab === 'DEPOSIT' ? 'Rekening Bank Penampung' :
                 'Status Channel Kasir'}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
                {filterTab === 'ALL'
                  ? rupiah(data.all_time_deposits)
                  : filterTab === 'DEPOSIT'
                    ? (data.primary_bank_account ? data.primary_bank_account.bank_name : 'Bank Toko')
                    : 'Terhubung Aktif'}
              </div>
            </div>
            <div style={{
              width: 40, height: 40,
              borderRadius: 10,
              background: 'rgba(139, 92, 246, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#a78bfa'
            }}>
              <Landmark size={20} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
            {filterTab === 'ALL' ? (
              <>
                <span>Hari ini: <strong style={{ color: '#a78bfa' }}>{rupiah(data.today_deposits)}</strong></span>
                <span>•</span>
                <span>Bulan ini: <strong style={{ color: '#ffffff' }}>{rupiah(data.month_deposits)}</strong></span>
              </>
            ) : filterTab === 'DEPOSIT' ? (
              <span>No. Rek: <strong style={{ color: '#a78bfa' }}>{data.primary_bank_account?.account_number || '-'}</strong> ({data.primary_bank_account?.account_holder || 'Owner'})</span>
            ) : (
              <span>Semua penjualan <strong style={{ color: '#ffffff' }}>{filterTab}</strong> otomatis dicatat ke Kas Aplikasi</span>
            )}
          </div>
        </div>

        {/* CARD 4: QRIS PREVIEW / ACTION CARD */}
        <div style={{
          background: 'rgba(17, 22, 45, 0.7)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div
            onClick={() => data.qris_image_url && setQrisPreviewModal(true)}
            style={{
              width: 64, height: 64,
              borderRadius: 10,
              background: '#ffffff',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: data.qris_image_url ? 'pointer' : 'default',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              position: 'relative',
            }}
            title={data.qris_image_url ? 'Klik untuk memperbesar QRIS' : 'Belum ada gambar QRIS'}
          >
            {data.qris_image_url ? (
              <img
                src={getMediaUrl(data.qris_image_url)}
                alt="QRIS Toko"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  if (!e.target.dataset.triedFallback && data.qris_image_url?.startsWith('/storage/')) {
                    e.target.dataset.triedFallback = 'true';
                    e.target.src = getMediaUrl('/api' + data.qris_image_url);
                  }
                }}
              />
            ) : (
              <QrCode size={36} color="#64748b" />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', marginBottom: 2 }}>
              QRIS Toko Aktif
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
              {data.primary_bank_account
                ? `${data.primary_bank_account.bank_name} (${data.primary_bank_account.account_number})`
                : 'QRIS Statis Toko'}
            </div>
            {data.qris_image_url ? (
              <button
                type="button"
                onClick={() => setQrisPreviewModal(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Eye size={12} /> Lihat QRIS Stiker
              </button>
            ) : (
              <a
                href="/payment-settings"
                style={{
                  color: '#f59e0b',
                  fontSize: 11,
                  fontWeight: 600,
                  textDecoration: 'underline'
                }}
              >
                Upload QRIS di Rekening
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TABS METODE PEMBAYARAN & FILTER HISTORY TABLE */}
      {/* ======================================================== */}
      <div className="card" style={{ padding: 20 }}>
        {/* Controls Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
          paddingBottom: 14,
          borderBottom: '1px solid var(--border)'
        }}>
          {/* Tabs Filter Berdasarkan Metode Pembayaran */}
          <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.25)', padding: 4, borderRadius: 10, flexWrap: 'wrap' }}>
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = filterTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterTab(tab.key)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: '1px solid',
                    borderColor: isActive ? (tab.color || 'var(--primary)') : 'transparent',
                    background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    fontSize: 12.5,
                    fontWeight: isActive ? 800 : 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} style={{ color: isActive ? tab.color : 'inherit' }} />
                  {tab.label} ({tab.count})
                </button>
              );
            })}
          </div>

          {/* Search Input (No Date Filter) */}
          <div style={{ position: 'relative', width: 260 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Cari order / rincian / cabang..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="form-control"
              style={{ paddingLeft: 30, fontSize: 12.5, height: 38 }}
            />
          </div>
        </div>

        {/* Mutasi Table */}
        {loading ? (
          <LoadingState message="Memuat mutasi Kas Aplikasi..." />
        ) : filteredHistory.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Sparkles size={36} color="#38bdf8" style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>
              Belum Ada Mutasi {filterTab !== 'ALL' ? `untuk ${filterTab}` : 'Kas Aplikasi'}
            </div>
            <p style={{ fontSize: 12, margin: 0 }}>
              Transaksi penjualan kasir atau setoran bank untuk metode ini akan tercatat di sini.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: 130 }}>Tanggal & Waktu</th>
                  <th style={{ width: 160 }}>Tipe Mutasi / Channel</th>
                  <th style={{ width: 160 }}>No. Referensi</th>
                  <th>Keterangan / Rincian</th>
                  <th>Cabang</th>
                  <th style={{ textAlign: 'right', width: 150 }}>Nominal</th>
                  <th style={{ width: 110, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => {
                  const isIncoming = item.type === 'IN';
                  const cat = item.method_category;
                  const badgeColor = cat === 'GRAB' ? '#00B14F' :
                                     cat === 'GOFOOD' ? '#EE2737' :
                                     cat === 'SHOPEEFOOD' ? '#EE4D2D' :
                                     cat === 'DEPOSIT' ? '#a78bfa' :
                                     '#38bdf8';
                  return (
                    <tr key={item.id}>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        <div style={{ fontWeight: 600, color: '#ffffff' }}>{item.date}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.time || '-'}</div>
                      </td>
                      <td>
                        {isIncoming ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 9px',
                            borderRadius: 6,
                            background: `${badgeColor}20`,
                            color: badgeColor,
                            fontSize: 11.5,
                            fontWeight: 700,
                            border: `1px solid ${badgeColor}40`
                          }}>
                            <ArrowDownLeft size={13} /> {item.type_label || item.payment_method}
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 9px',
                            borderRadius: 6,
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: '#a78bfa',
                            fontSize: 11.5,
                            fontWeight: 700,
                            border: '1px solid rgba(139, 92, 246, 0.35)'
                          }}>
                            <ArrowUpRight size={13} /> Setor Bank
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        <span className="mono" style={{ color: '#38bdf8', fontWeight: 600 }}>
                          {item.reference_no}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#ffffff' }}>
                          {item.name}
                        </div>
                        {item.notes && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {item.notes}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {item.outlet_name}
                      </td>
                      <td style={{
                        textAlign: 'right',
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: isIncoming ? '#34d399' : '#f87171'
                      }}>
                        {isIncoming ? '+' : '-'}{rupiah(item.amount)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: '#34d399',
                          fontSize: 11,
                          fontWeight: 700
                        }}>
                          <CheckCircle2 size={11} /> {item.status || 'Lunas'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL: SETOR KAS APLIKASI KE BANK */}
      {/* ========================================================= */}
      {depositModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36,
                  borderRadius: 10,
                  background: 'rgba(2, 132, 199, 0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#38bdf8'
                }}>
                  <Landmark size={20} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ margin: 0 }}>Setor Kas Aplikasi ke Bank</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Pindahkan saldo QRIS aplikasi ke rekening bank operasional
                  </div>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setDepositModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitDeposit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Available Balance Box */}
                <div style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 11.5, color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                      Saldo Kas Aplikasi Tersedia
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', marginTop: 2 }}>
                      {rupiah(data.current_balance)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDepositForm(prev => ({ ...prev, amount: String(Math.floor(data.current_balance)) }))}
                    style={{
                      background: 'rgba(56, 189, 248, 0.2)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      color: '#38bdf8',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Setor Semua Saldo
                  </button>
                </div>

                {/* Input Nominal Setoran */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Nominal yang Disetor (Rp) <span style={{ color: '#f43f5e' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1000"
                    max={data.current_balance}
                    step="1000"
                    className="form-control"
                    placeholder="Contoh: 500000"
                    value={depositForm.amount}
                    onChange={e => setDepositForm({ ...depositForm, amount: e.target.value })}
                    required
                    style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8' }}
                  />

                  {/* Nominal Quick Buttons */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {[100000, 250000, 500000, 1000000, 2000000].map(amt => {
                      if (amt > data.current_balance) return null;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDepositForm(prev => ({ ...prev, amount: String(amt) }))}
                          style={{
                            background: Number(depositForm.amount) === amt ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${Number(depositForm.amount) === amt ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                            color: Number(depositForm.amount) === amt ? '#38bdf8' : 'var(--text-secondary)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          +{rupiah(amt)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pilihan Rekening Bank Tujuan */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Rekening Bank Tujuan Setoran <span style={{ color: '#f43f5e' }}>*</span>
                  </label>
                  {data.bank_accounts && data.bank_accounts.length > 0 ? (
                    <select
                      className="form-control"
                      value={depositForm.bank_account_id}
                      onChange={e => setDepositForm({ ...depositForm, bank_account_id: e.target.value })}
                      required
                    >
                      {data.bank_accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.bank_name} - {acc.account_number} (a.n. {acc.account_holder}) {acc.is_primary ? '★ UTAMA' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{
                      padding: 12,
                      borderRadius: 8,
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      color: '#fbbf24',
                      fontSize: 12
                    }}>
                      Belum ada nomor rekening bank terdaftar.{' '}
                      <a href="/payment-settings" style={{ color: '#ffffff', fontWeight: 700, textDecoration: 'underline' }}>
                        Daftarkan Rekening di Sini
                      </a>
                    </div>
                  )}
                </div>

                {/* Tanggal Setor */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Tanggal Setoran</label>
                  <input
                    type="date"
                    className="form-control"
                    value={depositForm.date}
                    onChange={e => setDepositForm({ ...depositForm, date: e.target.value })}
                    required
                  />
                </div>

                {/* Catatan */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Catatan / Keterangan (Opsional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Setor omset QRIS akhir pekan ke BCA"
                    value={depositForm.notes}
                    onChange={e => setDepositForm({ ...depositForm, notes: e.target.value })}
                  />
                </div>

                {/* Accounting Impact Info */}
                <div style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  fontSize: 11.5,
                  color: '#a7f3d0'
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <ShieldCheck size={14} color="#34d399" /> Efek Jurnal Akuntansi Otomatis:
                  </div>
                  <div>
                    • Debit: <strong>1-11003 (BANK)</strong> (+ bertambah {rupiah(Number(depositForm.amount || 0))})
                  </div>
                  <div>
                    • Kredit: <strong>1-11004 (KAS APLIKASI)</strong> (- berkurang {rupiah(Number(depositForm.amount || 0))})
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDepositModalOpen(false)}
                  disabled={depositSubmitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={depositSubmitting || data.current_balance <= 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'linear-gradient(135deg, #0284c7, #2563eb)'
                  }}
                >
                  {depositSubmitting ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Konfirmasi Setor ({rupiah(Number(depositForm.amount || 0))})
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PREVIEW QRIS STIKER TOKO */}
      {/* ========================================================= */}
      {qrisPreviewModal && data.qris_image_url && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <QrCode size={18} color="#38bdf8" />
                <h3 className="modal-title" style={{ margin: 0 }}>QRIS Toko Resmi</h3>
              </div>
              <button type="button" className="btn-close" onClick={() => setQrisPreviewModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '24px 20px' }}>
              <div style={{
                background: '#ffffff',
                borderRadius: 14,
                padding: 14,
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                margin: '0 auto 16px',
                width: 260,
                height: 260,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img
                  src={getMediaUrl(data.qris_image_url)}
                  alt="QRIS Toko"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={(e) => {
                    if (!e.target.dataset.triedFallback && data.qris_image_url?.startsWith('/storage/')) {
                      e.target.dataset.triedFallback = 'true';
                      e.target.src = getMediaUrl('/api' + data.qris_image_url);
                    }
                  }}
                />
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', marginBottom: 4 }}>
                {data.primary_bank_account?.bank_name || 'QRIS Pembayaran Toko'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {data.primary_bank_account?.account_number} • a.n. {data.primary_bank_account?.account_holder}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                QRIS ini ditampilkan pada layar POS kasir saat memilih metode pembayaran QRIS.
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setQrisPreviewModal(false)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
