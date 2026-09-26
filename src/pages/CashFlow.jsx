import { useState, useEffect, useMemo } from 'react';
import {
  Wallet, DollarSign, TrendingUp, TrendingDown, ArrowDownLeft,
  ArrowUpRight, RefreshCw, Printer, Plus, Search, Filter,
  Building2, Layers, CheckCircle2, AlertCircle, Sparkles,
  HelpCircle, Store, Edit3, Trash, Info, Package, Landmark, Flame
} from 'lucide-react';
import api from '../api/client';
import { rupiah, num, pct, LoadingState, PageHeader, PeriodPicker } from '../components/ui';
import { getTodayStr, getMonthStartStr, getMonthEndStr } from '../utils/date';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import { printElement } from '../utils/print';

export const ACTIVITY_TYPES = [
  { value: 'OPERATING', label: 'Operasi (Operating)', color: '#10b981' },
  { value: 'INVESTING', label: 'Investasi (CapEx)',   color: '#8b5cf6' },
  { value: 'FINANCING', label: 'Pendanaan (Financing)', color: '#ec4899' },
];

export const CASH_CATEGORIES = [
  // CapEx / Investing
  { value: 'EQUIPMENT',         label: 'Peralatan & Mesin Dapur (CapEx)',       activity: 'INVESTING', defaultType: 'OUT' },
  { value: 'RENOVATION',        label: 'Renovasi Bangunan & Interior (CapEx)',   activity: 'INVESTING', defaultType: 'OUT' },
  { value: 'FURNITURE',         label: 'Furnitur & Peralatan Saji (CapEx)',      activity: 'INVESTING', defaultType: 'OUT' },
  { value: 'TECH_POS',          label: 'Perangkat POS & IT Hardware (CapEx)',    activity: 'INVESTING', defaultType: 'OUT' },
  { value: 'ASSET_SALE',        label: 'Penjualan Aset Bekas (Kas Masuk)',      activity: 'INVESTING', defaultType: 'IN' },

  // Financing
  { value: 'CAPITAL_INJECTION', label: 'Setoran Modal Owner / Investor',        activity: 'FINANCING', defaultType: 'IN' },
  { value: 'OWNER_WITHDRAWAL',  label: 'Prive / Penarikan Kas Pribadi Owner',    activity: 'FINANCING', defaultType: 'OUT' },
  { value: 'LOAN_RECEIPT',      label: 'Penerimaan Pinjaman Usaha',             activity: 'FINANCING', defaultType: 'IN' },
  { value: 'LOAN_REPAYMENT',    label: 'Pembayaran Pokok Pinjaman',             activity: 'FINANCING', defaultType: 'OUT' },

  // Operating Extra
  { value: 'SUPPLIER_PURCHASE', label: 'Belanja Bahan Baku Langsung',           activity: 'OPERATING', defaultType: 'OUT' },
  { value: 'OTHER_INCOME',      label: 'Pendapatan Kas Operasional Lain',       activity: 'OPERATING', defaultType: 'IN' },
  { value: 'OTHER_EXPENSE',     label: 'Biaya Kas Operasional Lain',            activity: 'OPERATING', defaultType: 'OUT' },
];

export const ACCOUNT_TYPES = [
  { value: 'BANK_MAIN',   label: 'Rekening Bank Utama Resto' },
  { value: 'CASH_DRAWER', label: 'Kas Toko / Laci Kasir' },
  { value: 'PETTY_CASH',  label: 'Kas Kecil (Petty Cash)' },
];

export default function CashFlow() {
  const { activeOutletId, activeOutlet, outlets, currentBusiness, dateFrom, dateTo } = useOutlet();
  const currentUser = JSON.parse(localStorage.getItem('pos_user') || '{}');

  const todayStr = getTodayStr();
  const [activeTab, setActiveTab] = useState('statement'); // 'statement' | 'reconciliation' | 'journal'

  const [loading, setLoading] = useState(true);
  const [statementData, setStatementData] = useState(null);
  const [journalEntries, setJournalEntries] = useState([]);

  // Detail Drilldown Modal State
  const [detailModal, setDetailModal] = useState({
    open: false,
    type: null, // 'OPERATING' | 'SALES_INFLOW' | 'PURCHASES_OUTFLOW' | 'OPEX_OUTFLOW' | 'INVESTING' | 'FINANCING' | 'NET_CASH' | 'INVENTORY_TRAPPED'
    title: '',
    loading: false,
    items: [],
    extraData: null,
  });

  async function handleCardClick(type) {
    const targetOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all'
      ? activeOutletId
      : undefined;

    if (type === 'SALES_INFLOW') {
      setDetailModal({ open: true, type: 'SALES_INFLOW', title: 'Rincian Kas Masuk dari Penjualan Langsung Kasir (POS)', loading: true, items: [], extraData: statementData?.operating?.inflows });
      try {
        const res = await api.get('/transactions', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet, status: 'PAID', exclude_kasbon: 1, limit: 200 }
        });
        setDetailModal(p => ({ ...p, loading: false, items: res.data?.data || res.data || [] }));
      } catch {
        toast.error('Gagal memuat rincian transaksi kasir');
        setDetailModal(p => ({ ...p, loading: false }));
      }
    } else if (type === 'RECEIVABLE_INFLOW') {
      setDetailModal({
        open: true,
        type: 'RECEIVABLE_INFLOW',
        title: 'Rincian Kas Masuk dari Pembayaran / Pelunasan Kasbon Pelanggan',
        loading: false,
        items: statementData?.operating?.inflows?.receivable_payments || [],
        extraData: statementData?.operating?.inflows?.receivable_breakdown,
      });
    } else if (type === 'PURCHASES_OUTFLOW') {
      setDetailModal({ open: true, type: 'PURCHASES_OUTFLOW', title: 'Rincian Kas Keluar untuk Pembelian Stok Bahan Baku', loading: true, items: [], extraData: statementData?.operating?.top_purchases });
      try {
        const res = await api.get('/movements', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet, type: 'PURCHASE' }
        });
        setDetailModal(p => ({ ...p, loading: false, items: res.data || [] }));
      } catch {
        toast.error('Gagal memuat rincian pembelian stok');
        setDetailModal(p => ({ ...p, loading: false }));
      }
    } else if (type === 'OPEX_OUTFLOW') {
      setDetailModal({ open: true, type: 'OPEX_OUTFLOW', title: 'Rincian Kas Keluar untuk Beban Operasional Toko (OPEX)', loading: true, items: [] });
      try {
        const res = await api.get('/expenses', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet }
        });
        setDetailModal(p => ({ ...p, loading: false, items: res.data || [] }));
      } catch {
        toast.error('Gagal memuat rincian biaya operasional');
        setDetailModal(p => ({ ...p, loading: false }));
      }
    } else if (type === 'OPERATING') {
      setDetailModal({ open: true, type: 'OPERATING', title: 'Rincian & Formula Arus Kas Operasi (Operating Cash Flow / OCF)', loading: false, items: [] });
    } else if (type === 'INVESTING') {
      setDetailModal({ open: true, type: 'INVESTING', title: 'Rincian Belanja Modal & Investasi Aset (CapEx)', loading: true, items: [] });
      try {
        const res = await api.get('/cash-transactions', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet, activity_type: 'INVESTING' }
        });
        setDetailModal(p => ({ ...p, loading: false, items: res.data || [] }));
      } catch {
        toast.error('Gagal memuat rincian belanja modal');
        setDetailModal(p => ({ ...p, loading: false }));
      }
    } else if (type === 'FINANCING') {
      setDetailModal({ open: true, type: 'FINANCING', title: 'Rincian Arus Kas Pendanaan, Modal & Prive Owner', loading: true, items: [] });
      try {
        const res = await api.get('/cash-transactions', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet, activity_type: 'FINANCING' }
        });
        setDetailModal(p => ({ ...p, loading: false, items: res.data || [] }));
      } catch {
        toast.error('Gagal memuat rincian mutasi pendanaan');
        setDetailModal(p => ({ ...p, loading: false }));
      }
    } else if (type === 'NET_CASH') {
      setDetailModal({ open: true, type: 'NET_CASH', title: 'Jembatan Total Perubahan Bersih Kas Riil (Net Cash Flow)', loading: false, items: [] });
    } else if (type === 'INVENTORY_TRAPPED') {
      setDetailModal({ open: true, type: 'INVENTORY_TRAPPED', title: 'Rincian Analisis Kas Terkunci di Persediaan Bahan Baku', loading: false, items: [] });
    }
  }

  // Journal filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState('ALL');

  // Modal form state
  const [modalOpen, setModalOpen] = useState(false);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const initialForm = {
    date: todayStr,
    outlet_id: activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : '',
    activity_type: 'INVESTING',
    category: 'EQUIPMENT',
    type: 'OUT',
    name: '',
    amount: '',
    account: 'BANK_MAIN',
    payment_method: 'TRANSFER',
    notes: '',
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo, activeOutletId]);

  async function fetchData() {
    setLoading(true);
    try {
      const targetOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all'
        ? activeOutletId
        : undefined;

      const [resStatement, resJournal] = await Promise.all([
        api.get('/cash-flow/statement', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet },
        }),
        api.get('/cash-transactions', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet },
        }),
      ]);

      setStatementData(resStatement.data);
      setJournalEntries(resJournal.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat Laporan Arus Kas');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreateModal() {
    setEditingId(null);
    setFormData({
      ...initialForm,
      outlet_id: activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : '',
    });
    setModalOpen(true);
  }

  function handleOpenEditModal(item) {
    setEditingId(item.id);
    setFormData({
      date: item.date ? item.date.slice(0, 10) : todayStr,
      outlet_id: item.outlet_id ? item.outlet_id.toString() : '',
      activity_type: item.activity_type || 'INVESTING',
      category: item.category || 'EQUIPMENT',
      type: item.type || 'OUT',
      name: item.name || '',
      amount: item.amount || '',
      account: item.account || 'BANK_MAIN',
      payment_method: item.payment_method || 'TRANSFER',
      notes: item.notes || '',
    });
    setModalOpen(true);
  }

  // Handle activity change in modal to update default category & type
  function handleActivityChange(newAct) {
    const defaultCat = CASH_CATEGORIES.find(c => c.activity === newAct);
    setFormData({
      ...formData,
      activity_type: newAct,
      category: defaultCat ? defaultCat.value : 'EQUIPMENT',
      type: defaultCat ? defaultCat.defaultType : 'OUT',
    });
  }

  function handleCategoryChange(newCat) {
    const meta = CASH_CATEGORIES.find(c => c.value === newCat);
    setFormData({
      ...formData,
      category: newCat,
      type: meta ? meta.defaultType : formData.type,
    });
  }

  async function handleSubmitTransaction(e) {
    e.preventDefault();
    if (!formData.name || !formData.amount || Number(formData.amount) <= 0) {
      toast.error('Harap lengkapi nama transaksi dan nominal dengan benar');
      return;
    }

    setSavingTransaction(true);
    try {
      const payload = {
        date: formData.date,
        outlet_id: formData.outlet_id ? Number(formData.outlet_id) : null,
        activity_type: formData.activity_type,
        category: formData.category,
        type: formData.type,
        name: formData.name,
        amount: Number(formData.amount),
        account: formData.account,
        payment_method: formData.payment_method,
        notes: formData.notes,
      };

      if (editingId) {
        await api.put(`/cash-transactions/${editingId}`, payload);
        toast.success('Catatan transaksi kas berhasil diperbarui');
      } else {
        await api.post('/cash-transactions', payload);
        toast.success('Transaksi kas berhasil dicatat');
      }

      setModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Gagal menyimpan transaksi kas');
    } finally {
      setSavingTransaction(false);
    }
  }

  async function handleDeleteTransaction(id, name) {
    if (!window.confirm(`Yakin ingin menghapus mutasi kas "${name}"?`)) return;
    try {
      await api.delete(`/cash-transactions/${id}`);
      toast.success('Catatan kas berhasil dihapus');
      fetchData();
    } catch {
      toast.error('Gagal menghapus catatan kas');
    }
  }

  const filteredJournal = useMemo(() => {
    return journalEntries.filter(item => {
      const matchAct = activityFilter === 'ALL' || item.activity_type === activityFilter;
      const matchSearch = !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.transaction_no && item.transaction_no.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchAct && matchSearch;
    });
  }, [journalEntries, activityFilter, searchQuery]);

  // Aggregate multi-item sales transactions by order_number for transparent drill-down
  const groupedSalesOrders = useMemo(() => {
    if (!detailModal.items || detailModal.type !== 'SALES_INFLOW') return [];
    const map = new Map();
    detailModal.items.forEach(t => {
      const pm = (t.payment_method || t.payment_type || 'CASH').toUpperCase();
      if (pm === 'KASBON' || pm === 'PIUTANG') return;

      const key = t.order_number || `TRX-${t.id}`;
      if (!map.has(key)) {
        map.set(key, {
          id: t.id,
          order_number: key,
          date: t.date,
          created_at: t.created_at,
          customer_name: t.customer_name,
          table_number: t.table_number,
          payment_method: t.payment_method || t.payment_type || 'CASH',
          user_name: t.user?.name || t.creator?.name || t.cashier?.name || 'Kasir',
          total_price: 0,
          items: [],
        });
      }
      const entry = map.get(key);
      const price = Number(t.total_price != null ? t.total_price : (t.subtotal != null ? t.subtotal : (t.amount_paid != null ? t.amount_paid : 0)));
      entry.total_price += price;
      if (t.menu?.name) {
        entry.items.push(`${t.qty || 1}x ${t.menu.name}`);
      }
    });
    return Array.from(map.values());
  }, [detailModal.items, detailModal.type]);

  function handlePrint() {
    printElement(
      'printable-cashflow-statement',
      `Laporan Arus Kas Nyata - ${dateFrom} sd ${dateTo}`,
      { orientation: 'portrait' }
    );
  }

  const businessTitle = currentBusiness?.name || currentUser?.business?.name || 'MOVA POS F&B Management';
  const outletTitle = (activeOutlet && activeOutletId !== 'ALL' && activeOutletId !== 'all')
    ? activeOutlet.name
    : 'Semua Cabang (Konsolidasi Usaha)';

  if (loading && !statementData) return <LoadingState />;

  const sum = statementData?.summary || {
    net_operating_cash_flow: 0,
    net_investing_cash_flow: 0,
    net_financing_cash_flow: 0,
    net_cash_flow: 0,
    accrual_net_profit: 0,
    inventory_cash_trapped: 0,
    liquidity_status: 'SURPLUS',
    liquidity_label: 'Kas Surplus',
    liquidity_color: '#10B981',
  };
  const op = statementData?.operating || { inflows: {}, outflows: {}, net: 0, top_purchases: [] };
  const inv = statementData?.investing || { inflows: 0, outflows: 0, breakdown: [], net: 0 };
  const fin = statementData?.financing || { inflows: 0, outflows: 0, breakdown: [], net: 0 };
  const recon = statementData?.reconciliation || { steps: [], discrepancy_explanation: '', inventory_capital_change: 0 };

  return (
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* 1. Header & Controls */}
      <div className="flex-between mb-4 flex-wrap gap-3">
        <PageHeader
          title="Laporan Arus Kas Nyata (Cash Flow Statement)"
          subtitle="Membedah aliran uang kas fisik riil vs laba akrual: Memisahkan Arus Kas Operasi (OCF), Belanja Modal (CapEx), Pendanaan (Prive/Modal), dan Rekonsiliasi Kas."
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchData}
            title="Refresh Kalkulasi"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderColor: 'rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.08)',
              fontWeight: 600,
            }}
          >
            <Printer size={15} /> Cetak Laporan Kas
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleOpenCreateModal}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Plus size={16} /> Catat Mutasi Kas (CapEx / Prive)
          </button>
        </div>
      </div>

      {/* 2. Top 4 Cash Flow KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        {/* Card 1: Operating Cash Flow */}
        <div
          className="card"
          onClick={() => handleCardClick('OPERATING')}
          style={{
            padding: 18,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title="Klik untuk melihat rincian arus kas operasional (penjualan, belanja stok, beban OPEX)"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Arus Kas Operasi (OCF)
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: sum.net_operating_cash_flow >= 0 ? '#ffffff' : '#f43f5e', letterSpacing: -0.5, marginBottom: 4 }}>
            {rupiah(sum.net_operating_cash_flow)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Masuk: {rupiah(op.inflows?.total_inflows)}</span>
            <span>Keluar: {rupiah(op.outflows?.total_outflows)}</span>
          </div>
          <div style={{ fontSize: 10, color: '#34d399', fontWeight: 600, marginTop: 4 }}>
            Lihat rincian aliran kas operasi →
          </div>
        </div>

        {/* Card 2: Investing / CapEx */}
        <div
          className="card"
          onClick={() => handleCardClick('INVESTING')}
          style={{
            padding: 18,
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title="Klik untuk melihat rincian belanja modal (CapEx: kulkas, chiller, renovasi, POS)"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Belanja Modal (CapEx)
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: -0.5, marginBottom: 4 }}>
            {rupiah(sum.net_investing_cash_flow)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Mesin, Kulkas & Renovasi</span>
            <span>{inv.breakdown?.length || 0} pos aset</span>
          </div>
          <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 600, marginTop: 4 }}>
            Lihat rincian belanja modal →
          </div>
        </div>

        {/* Card 3: Financing Cash Flow */}
        <div
          className="card"
          onClick={() => handleCardClick('FINANCING')}
          style={{
            padding: 18,
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(236, 72, 153, 0.25)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title="Klik untuk melihat rincian mutasi modal, pinjaman, dan prive owner"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f472b6', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Arus Kas Pendanaan (FCF)
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: -0.5, marginBottom: 4 }}>
            {rupiah(sum.net_financing_cash_flow)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Prive vs Modal Baru</span>
            <span>{fin.breakdown?.length || 0} transaksi</span>
          </div>
          <div style={{ fontSize: 10, color: '#f472b6', fontWeight: 600, marginTop: 4 }}>
            Lihat rincian pendanaan & prive →
          </div>
        </div>

        {/* Card 4: Net Cash Flow (Total Perubahan Kas) */}
        <div
          className="card"
          onClick={() => handleCardClick('NET_CASH')}
          style={{
            padding: 18,
            background: `linear-gradient(135deg, ${sum.liquidity_color}18 0%, rgba(15, 23, 42, 0.9) 100%)`,
            border: `1.5px solid ${sum.liquidity_color}45`,
            boxShadow: `0 8px 25px ${sum.liquidity_color}18`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title="Klik untuk melihat formula kalkulasi perubahan bersih kas riil"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: sum.liquidity_color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Perubahan Kas Bersih
            </span>
            <div
              style={{
                padding: '2px 8px',
                borderRadius: 20,
                fontSize: 10,
                fontWeight: 800,
                background: `${sum.liquidity_color}25`,
                color: sum.liquidity_color,
                border: `1px solid ${sum.liquidity_color}40`,
              }}
            >
              {sum.liquidity_status}
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: sum.net_cash_flow >= 0 ? '#ffffff' : '#f43f5e', letterSpacing: -0.5, marginBottom: 4 }}>
            {rupiah(sum.net_cash_flow)}
          </div>
          <div style={{ fontSize: 11.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: sum.liquidity_color, fontWeight: 700 }}>
              {sum.liquidity_label}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saldo Riil Bertambah/Berkurang</span>
          </div>
          <div style={{ fontSize: 10, color: sum.liquidity_color, fontWeight: 600, marginTop: 4 }}>
            Lihat rincian formula kas riil →
          </div>
        </div>
      </div>

      {/* 3. Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          borderBottom: '1px solid rgba(165, 180, 252, 0.15)',
          marginBottom: 20,
        }}
      >
        <button
          className={`btn ${activeTab === 'statement' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('statement')}
          style={{
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
          }}
        >
          <Wallet size={16} /> Laporan Arus Kas Formal (Direct Method)
        </button>
        <button
          className={`btn ${activeTab === 'reconciliation' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('reconciliation')}
          style={{
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
          }}
        >
          <Sparkles size={16} /> Jembatan Rekonsiliasi (Laba P&L vs Kas Nyata)
        </button>
        <button
          className={`btn ${activeTab === 'journal' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('journal')}
          style={{
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
          }}
        >
          <Layers size={16} /> Jurnal Mutasi Kas Ekstra (CapEx & Prive)
          <span
            style={{
              padding: '2px 7px',
              borderRadius: 12,
              fontSize: 11,
              background: activeTab === 'journal' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
            }}
          >
            {journalEntries.length}
          </span>
        </button>
      </div>

      {/* 4. TAB 1: FORMAL CASH FLOW STATEMENT (DIRECT METHOD) */}
      {activeTab === 'statement' && (
        <div className="card" style={{ padding: 24, background: 'rgba(15, 23, 42, 0.85)' }}>
          <div style={{ borderBottom: '2px solid rgba(165, 180, 252, 0.2)', paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                  {businessTitle}
                </h2>
                <div style={{ fontSize: 13, color: '#38bdf8', fontWeight: 600, marginTop: 2 }}>
                  LAPORAN ARUS KAS NYATA (CASH FLOW STATEMENT)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Cabang: <strong>{outletTitle}</strong> &nbsp;|&nbsp; Periode: <strong>{dateFrom}</strong> s/d <strong>{dateTo}</strong>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    background: `${sum.liquidity_color}20`,
                    color: sum.liquidity_color,
                    border: `1px solid ${sum.liquidity_color}40`,
                  }}
                >
                  Status Kas: {sum.liquidity_label}
                </span>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Metode: Langsung (Direct Real Cash)
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* I. ARUS KAS DARI AKTIVITAS OPERASI */}
            <div
              className="card"
              onClick={() => handleCardClick('OPERATING')}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 10,
                padding: '14px 18px',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Klik untuk melihat rincian arus kas operasional (penjualan, belanja stok, beban OPEX)"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#34d399', letterSpacing: 0.5 }}>
                  I. ARUS KAS DARI AKTIVITAS OPERASI (OPERATING ACTIVITIES)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="btn btn-sm"
                    style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      borderRadius: 6,
                      background: 'rgba(52, 211, 153, 0.15)',
                      color: '#34d399',
                      border: '1px solid rgba(52, 211, 153, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontWeight: 700,
                    }}
                    onClick={(e) => { e.stopPropagation(); handleCardClick('OPERATING'); }}
                  >
                    <Search size={12} /> Rincian Operasi
                  </button>
                  <span style={{ fontSize: 15, fontWeight: 800, color: op.net >= 0 ? '#34d399' : '#f43f5e' }}>
                    {rupiah(op.net)}
                  </span>
                </div>
              </div>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ fontWeight: 600, color: '#f8fafc' }}>
                    <td colSpan={2} style={{ padding: '6px 0 2px' }}>Penerimaan Kas Operasi (Cash Inflows):</td>
                  </tr>
                  <tr
                    style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.06)', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); handleCardClick('SALES_INFLOW'); }}
                    title="Klik untuk melihat rincian transaksi kas masuk penjualan langsung kasir"
                  >
                    <td style={{ padding: '6px 0 6px 16px', color: '#cbd5e1' }}>
                      Penerimaan Kas dari Penjualan Langsung Kasir (Tunai, QRIS, Transfer, EDC)
                      <span style={{ fontSize: 11, color: '#38bdf8', marginLeft: 8, background: 'rgba(56, 189, 248, 0.12)', padding: '2px 6px', borderRadius: 4 }}>
                        🔍 Rincian Penjualan Langsung
                      </span>
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#34d399' }}>
                      {rupiah(op.inflows?.direct_sales_total != null ? op.inflows?.direct_sales_total : (op.inflows?.cash_sales + op.inflows?.qris_sales + op.inflows?.transfer_sales + op.inflows?.debit_sales + (op.inflows?.other_sales || 0)))}
                    </td>
                  </tr>
                  <tr
                    style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.06)', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); handleCardClick('RECEIVABLE_INFLOW'); }}
                    title="Klik untuk melihat rincian uang kas masuk dari pembayaran / pelunasan kasbon pelanggan"
                  >
                    <td style={{ padding: '6px 0 6px 16px', color: '#cbd5e1' }}>
                      Penerimaan Kas dari Pembayaran Kasbon Pelanggan (Pelunasan Piutang)
                      <span style={{ fontSize: 11, color: '#a78bfa', marginLeft: 8, background: 'rgba(167, 139, 250, 0.12)', padding: '2px 6px', borderRadius: 4 }}>
                        🔍 Rincian Kasbon Terbayar
                      </span>
                      {op.inflows?.unpaid_kasbon_omzet > 0 && (
                        <span style={{ fontSize: 10.5, color: '#f59e0b', marginLeft: 8, background: 'rgba(245, 158, 11, 0.12)', padding: '1px 6px', borderRadius: 4 }}>
                          Kasbon baru belum lunas ({rupiah(op.inflows?.unpaid_kasbon_omzet)}) tidak dihitung kas
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#34d399' }}>
                      {rupiah(op.inflows?.receivable_collections || 0)}
                    </td>
                  </tr>
                  {op.inflows?.extra_income > 0 && (
                    <tr style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.06)' }}>
                      <td style={{ padding: '4px 0 4px 16px', color: '#cbd5e1' }}>Penerimaan Kas Operasional Lain-lain</td>
                      <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, color: '#34d399' }}>{rupiah(op.inflows?.extra_income)}</td>
                    </tr>
                  )}
                  
                  <tr style={{ fontWeight: 600, color: '#f8fafc' }}>
                    <td colSpan={2} style={{ padding: '10px 0 2px' }}>Pengeluaran Kas Operasi (Cash Outflows):</td>
                  </tr>
                  <tr
                    style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.06)', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); handleCardClick('PURCHASES_OUTFLOW'); }}
                    title="Klik untuk melihat rincian pembelian stok bahan baku fisik"
                  >
                    <td style={{ padding: '6px 0 6px 16px', color: '#cbd5e1' }}>
                      Pembelian Persediaan Bahan Baku Riil (Stok Masuk Gudang / Chiller)
                      <span style={{ fontSize: 11, color: '#f87171', marginLeft: 8, background: 'rgba(248, 113, 113, 0.12)', padding: '2px 6px', borderRadius: 4 }}>
                        🔍 Rincian Pembelian Stok
                      </span>
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#f87171' }}>
                      ({rupiah(op.outflows?.stock_purchases)})
                    </td>
                  </tr>
                  <tr
                    style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.06)', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); handleCardClick('OPEX_OUTFLOW'); }}
                    title="Klik untuk melihat rincian pembayaran biaya operasional toko (gaji, listrik, sewa, dll)"
                  >
                    <td style={{ padding: '6px 0 6px 16px', color: '#cbd5e1' }}>
                      Pembayaran Beban Operasional Toko (Gaji, Listrik, Gas LPG, Sewa, dll)
                      <span style={{ fontSize: 11, color: '#fbbf24', marginLeft: 8, background: 'rgba(251, 191, 36, 0.12)', padding: '2px 6px', borderRadius: 4 }}>
                        🔍 Rincian Beban OPEX
                      </span>
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#f87171' }}>
                      ({rupiah(op.outflows?.opex_expenses)})
                    </td>
                  </tr>
                  <tr style={{ fontWeight: 700, color: op.net >= 0 ? '#34d399' : '#f43f5e' }}>
                    <td style={{ padding: '8px 0 4px' }}>ARUS KAS BERSIH DARI OPERASI (NET OPERATING CASH FLOW)</td>
                    <td style={{ padding: '8px 0 4px', textAlign: 'right' }}>{rupiah(op.net)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Top ingredient purchases chip */}
              {op.top_purchases && op.top_purchases.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.04)', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Top 5 Belanja Pembelian Stok Terbesar:</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {op.top_purchases.map((p, idx) => (
                      <span key={idx} style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '2px 8px', borderRadius: 6 }}>
                        {p.name}: <strong>{rupiah(p.total)}</strong> ({num(p.qty, 1)} {p.unit})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* II. ARUS KAS DARI AKTIVITAS INVESTASI / CAPEX */}
            <div
              className="card"
              onClick={() => handleCardClick('INVESTING')}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 10,
                padding: '14px 18px',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Klik untuk melihat rincian belanja modal (CapEx: kulkas, chiller, renovasi, POS)"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa', letterSpacing: 0.5 }}>
                  II. ARUS KAS DARI AKTIVITAS INVESTASI / CAPEX (INVESTING ACTIVITIES)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="btn btn-sm"
                    style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      borderRadius: 6,
                      background: 'rgba(139, 92, 246, 0.15)',
                      color: '#a78bfa',
                      border: '1px solid rgba(139, 92, 246, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontWeight: 700,
                    }}
                    onClick={(e) => { e.stopPropagation(); handleCardClick('INVESTING'); }}
                  >
                    <Search size={12} /> Rincian CapEx
                  </button>
                  <span style={{ fontSize: 15, fontWeight: 800, color: inv.net >= 0 ? '#a78bfa' : '#f87171' }}>
                    {rupiah(inv.net)}
                  </span>
                </div>
              </div>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <tbody>
                  {inv.breakdown && inv.breakdown.length > 0 ? (
                    inv.breakdown.map((b, i) => (
                      <tr key={i} style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.06)' }}>
                        <td style={{ padding: '6px 0', color: '#cbd5e1' }}>
                          {b.label} ({b.count} transaksi)
                        </td>
                        <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: b.type === 'IN' ? '#34d399' : '#f87171' }}>
                          {b.type === 'IN' ? `+${rupiah(b.amount)}` : `(${rupiah(b.amount)})`}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} style={{ padding: '6px 0', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Tidak ada transaksi belanja modal (CapEx) pada periode ini ({rupiah(0)}). Klik "+ Catat Mutasi Kas" untuk mencatat pembelian kulkas, chiller, atau renovasi.
                      </td>
                    </tr>
                  )}
                  <tr style={{ fontWeight: 700, color: '#a78bfa' }}>
                    <td style={{ padding: '8px 0 4px' }}>ARUS KAS BERSIH DARI INVESTASI (NET INVESTING CASH FLOW)</td>
                    <td style={{ padding: '8px 0 4px', textAlign: 'right' }}>{rupiah(inv.net)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* III. ARUS KAS DARI AKTIVITAS PENDANAAN */}
            <div
              className="card"
              onClick={() => handleCardClick('FINANCING')}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 10,
                padding: '14px 18px',
                border: '1px solid rgba(236, 72, 153, 0.25)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Klik untuk melihat rincian mutasi pendanaan, modal baru, dan prive owner"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#f472b6', letterSpacing: 0.5 }}>
                  III. ARUS KAS DARI AKTIVITAS PENDANAAN (FINANCING ACTIVITIES)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="btn btn-sm"
                    style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      borderRadius: 6,
                      background: 'rgba(236, 72, 153, 0.15)',
                      color: '#f472b6',
                      border: '1px solid rgba(236, 72, 153, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontWeight: 700,
                    }}
                    onClick={(e) => { e.stopPropagation(); handleCardClick('FINANCING'); }}
                  >
                    <Search size={12} /> Rincian Prive & Modal
                  </button>
                  <span style={{ fontSize: 15, fontWeight: 800, color: fin.net >= 0 ? '#f472b6' : '#f87171' }}>
                    {rupiah(fin.net)}
                  </span>
                </div>
              </div>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <tbody>
                  {fin.breakdown && fin.breakdown.length > 0 ? (
                    fin.breakdown.map((b, i) => (
                      <tr key={i} style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.06)' }}>
                        <td style={{ padding: '6px 0', color: '#cbd5e1' }}>
                          {b.label} ({b.count} transaksi)
                        </td>
                        <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: b.type === 'IN' ? '#34d399' : '#f87171' }}>
                          {b.type === 'IN' ? `+${rupiah(b.amount)}` : `(${rupiah(b.amount)})`}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} style={{ padding: '6px 0', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Tidak ada transaksi pendanaan / prive owner pada periode ini ({rupiah(0)})
                      </td>
                    </tr>
                  )}
                  <tr style={{ fontWeight: 700, color: '#f472b6' }}>
                    <td style={{ padding: '8px 0 4px' }}>ARUS KAS BERSIH DARI PENDANAAN (NET FINANCING CASH FLOW)</td>
                    <td style={{ padding: '8px 0 4px', textAlign: 'right' }}>{rupiah(fin.net)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* GRAND TOTAL: PERUBAHAN BERSIH KAS RIIL */}
            <div
              className="card"
              onClick={() => handleCardClick('NET_CASH')}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px',
                borderRadius: 12,
                background: `linear-gradient(135deg, ${sum.liquidity_color}25 0%, rgba(15, 23, 42, 0.95) 100%)`,
                border: `2px solid ${sum.liquidity_color}60`,
                boxShadow: `0 10px 30px ${sum.liquidity_color}20`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Klik untuk melihat formula kalkulasi perubahan bersih kas riil"
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Wallet size={22} color={sum.liquidity_color} />
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', letterSpacing: 0.5 }}>
                    KENAIKAN / (PENURUNAN) BERSIH KAS RIIL (NET CASH FLOW)
                  </span>
                  <span style={{ fontSize: 11, color: sum.liquidity_color, background: `${sum.liquidity_color}25`, padding: '2px 6px', borderRadius: 4, marginLeft: 4 }}>
                    🔍 Formula
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Total Realisasi Kas: Arus Kas Operasi + Arus Kas Investasi + Arus Kas Pendanaan
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: sum.net_cash_flow >= 0 ? sum.liquidity_color : '#f43f5e' }}>
                  {rupiah(sum.net_cash_flow)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: sum.liquidity_color, marginTop: 2 }}>
                  {sum.liquidity_label}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 2: JEMBATAN REKONSILIASI (LABA AKRUAL VS KAS NYATA) */}
      {activeTab === 'reconciliation' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={20} color="#38bdf8" /> Jembatan Rekonsiliasi: Laba Akrual (P&L) vs Arus Kas Nyata
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Memecahkan misteri klasik F&B: Mengapa di atas kertas laporan Laba Rugi tercatat untung, tetapi saldo uang kas fisik di rekening bank berkurang?
            </p>
          </div>

          {/* Educational Insight Box */}
          <div
            className="card"
            onClick={() => handleCardClick('INVENTORY_TRAPPED')}
            style={{
              padding: '16px 20px',
              borderRadius: 10,
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              marginBottom: 24,
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="Klik untuk melihat rincian modal kas yang terkunci di persediaan bahan baku"
          >
            <HelpCircle size={22} color="#38bdf8" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, lineHeight: 1.6, color: '#e2e8f0', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <strong style={{ color: '#38bdf8' }}>Penjelasan Analisis Bisnis:</strong>
                <span style={{ fontSize: 11, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                  🔍 Klik Detail Kas Terkunci
                </span>
              </div>
              {recon.discrepancy_explanation}
              <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
                Laba P&L hanya menghitung porsi bahan makanan yang sudah dimasak/terjual (*COGS*). Sementara Arus Kas menghitung seluruh uang tunai yang keluar untuk belanja stok karungan/dus di awal (*purchases*), belanja kulkas/chiller (*CapEx*), serta penarikan kas oleh pemilik (*prive*).
              </div>
            </div>
          </div>

          {/* Step-by-Step Reconciliation Table / Waterfall */}
          <div style={{ background: 'rgba(15, 23, 42, 0.8)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <table style={{ width: '100%', fontSize: 13.5, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0' }}>Langkah Rekonsiliasi Kas</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Penjelasan Aliran Dana</th>
                  <th style={{ textAlign: 'right', padding: '8px 0' }}>Jumlah Penyesuaian</th>
                </tr>
              </thead>
              <tbody>
                {recon.steps?.map((step, idx) => {
                  const isTotal = step.effect === 'TOTAL';
                  const isStart = step.effect === 'START';
                  const isAdd = step.effect === 'ADD';
                  const isSub = step.effect === 'SUBTRACT';

                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: isTotal ? 'none' : '1px dashed rgba(255, 255, 255, 0.06)',
                        background: isTotal
                          ? 'rgba(16, 185, 129, 0.12)'
                          : isStart
                          ? 'rgba(56, 189, 248, 0.08)'
                          : 'transparent',
                        fontWeight: isTotal || isStart ? 700 : 400,
                      }}
                    >
                      <td style={{ padding: '10px 0', color: isTotal ? '#ffffff' : isStart ? '#38bdf8' : '#cbd5e1' }}>
                        {step.title}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {step.description}
                      </td>
                      <td
                        style={{
                          padding: '10px 0',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: isTotal ? 16 : 14,
                          color: isTotal
                            ? (step.amount >= 0 ? '#34d399' : '#f43f5e')
                            : isAdd
                            ? '#34d399'
                            : isSub
                            ? '#f87171'
                            : '#f8fafc',
                        }}
                      >
                        {isAdd && step.amount > 0 ? `+${rupiah(step.amount)}` : rupiah(step.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB 3: BUKU JURNAL KAS EKSTRA (CAPEX & PENDANAAN) */}
      {activeTab === 'journal' && (
        <div className="card" style={{ padding: 20 }}>
          <div className="flex-between mb-3 flex-wrap gap-3">
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Buku Jurnal Kas Ekstra (CapEx, Prive & Pendanaan)
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Catatan mutasi kas non-operasional: belanja kulkas/chiller baru, renovasi resto, penarikan dana owner (prive), atau setoran modal.
              </p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleOpenCreateModal}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              <Plus size={16} /> Catat Mutasi Baru
            </button>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 32, fontSize: 13, height: 36 }}
                placeholder="Cari transaksi, nomor dokumen, atau catatan..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={15} color="var(--text-muted)" />
              <select
                className="form-control"
                style={{ fontSize: 13, height: 36, minWidth: 160 }}
                value={activityFilter}
                onChange={e => setActivityFilter(e.target.value)}
              >
                <option value="ALL">Semua Aktivitas</option>
                {ACTIVITY_TYPES.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>No. Dokumen</th>
                  <th>Tanggal</th>
                  <th>Cabang</th>
                  <th>Aktivitas</th>
                  <th>Kategori</th>
                  <th>Uraian Transaksi</th>
                  <th>Akun Kas</th>
                  <th style={{ textAlign: 'right' }}>Nominal</th>
                  <th>Pencatat</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredJournal.length > 0 ? (
                  filteredJournal.map(item => {
                    const isOut = item.type === 'OUT';
                    const actMeta = ACTIVITY_TYPES.find(a => a.value === item.activity_type) || { color: '#94a3b8' };

                    return (
                      <tr key={item.id}>
                        <td className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
                          {item.transaction_no}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {item.date ? item.date.slice(0, 10) : '—'}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Store size={13} color="var(--text-muted)" />
                            {item.outlet_name || 'Semua Cabang'}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              background: `${actMeta.color}15`,
                              color: actMeta.color,
                              border: `1px solid ${actMeta.color}35`,
                            }}
                          >
                            {item.activity_label || item.activity_type}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {item.category_label || item.category}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>{item.name}</div>
                          {item.notes && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {item.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {item.account_label || item.account}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 13.5, color: isOut ? '#f43f5e' : '#10b981' }}>
                          {isOut ? `-${rupiah(item.amount)}` : `+${rupiah(item.amount)}`}
                        </td>
                        <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {item.user_name || 'Admin'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 6px', color: '#38bdf8' }}
                              onClick={() => handleOpenEditModal(item)}
                              title="Edit Transaksi"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 6px', color: '#f43f5e' }}
                              onClick={() => handleDeleteTransaction(item.id, item.name)}
                              title="Hapus Transaksi"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                      Belum ada catatan mutasi kas ekstra pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. MODAL: CATAT / EDIT MUTASI KAS EKSTRA */}
      {modalOpen && (
        <div className="modal-overlay">
          <div
            className="modal-card"
            style={{
              maxWidth: 540,
              background: '#0f172a',
              border: '1px solid rgba(165, 180, 252, 0.25)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wallet size={18} color="#8b5cf6" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                  {editingId ? 'Edit Transaksi Kas' : 'Catat Mutasi Kas (CapEx / Prive / Modal)'}
                </h3>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setModalOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitTransaction}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Tanggal & Cabang */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12 }}>Tanggal Transaksi *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12 }}>Cabang Resto</label>
                    <select
                      className="form-control"
                      value={formData.outlet_id}
                      onChange={e => setFormData({ ...formData, outlet_id: e.target.value })}
                    >
                      <option value="">Semua Cabang / Kantor Pusat</option>
                      {outlets.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Aktivitas & Arah Kas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12 }}>Aktivitas Arus Kas *</label>
                    <select
                      className="form-control"
                      value={formData.activity_type}
                      onChange={e => handleActivityChange(e.target.value)}
                      required
                    >
                      {ACTIVITY_TYPES.map(a => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12 }}>Arah Aliran Kas *</label>
                    <select
                      className="form-control"
                      value={formData.type}
                      onChange={e => setFormData({ ...formData, type: e.target.value })}
                      required
                    >
                      <option value="OUT">Kas Keluar (Outflow)</option>
                      <option value="IN">Kas Masuk (Inflow)</option>
                    </select>
                  </div>
                </div>

                {/* Kategori */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>Kategori Mutasi Kas *</label>
                  <select
                    className="form-control"
                    value={formData.category}
                    onChange={e => handleCategoryChange(e.target.value)}
                    required
                  >
                    {CASH_CATEGORIES
                      .filter(c => c.activity === formData.activity_type)
                      .map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                  </select>
                </div>

                {/* Nama Transaksi */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>Nama / Uraian Transaksi *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Beli Kulkas Chiller 4 Pintu Kitchen, Prive Dividen Owner..."
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                {/* Nominal & Akun */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12 }}>Nominal (Rp) *</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="0"
                      min="1"
                      step="any"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      required
                      style={{ fontSize: 15, fontWeight: 700, color: formData.type === 'OUT' ? '#f87171' : '#34d399' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12 }}>Akun Kas / Bank *</label>
                    <select
                      className="form-control"
                      value={formData.account}
                      onChange={e => setFormData({ ...formData, account: e.target.value })}
                    >
                      {ACCOUNT_TYPES.map(acc => (
                        <option key={acc.value} value={acc.value}>{acc.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Catatan */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>Catatan Tambahan (Opsional)</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Keterangan nomor faktur aset, nama penerima, nomor rekening, dll."
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setModalOpen(false)}
                  disabled={savingTransaction}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={savingTransaction}
                  style={{ fontWeight: 700 }}
                >
                  {savingTransaction ? 'Menyimpan...' : (editingId ? 'Simpan Perubahan' : 'Simpan Transaksi')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7.5 DRILLDOWN / BREAKDOWN EXPLANATION MODAL */}
      {detailModal.open && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div
            className="modal-card"
            style={{
              maxWidth: 820,
              width: '94%',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#0b1329',
              border: '1px solid rgba(165, 180, 252, 0.3)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              className="modal-header"
              style={{
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(15, 23, 42, 0.95)',
                padding: '16px 22px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    padding: 8,
                    borderRadius: 10,
                    background:
                      detailModal.type === 'SALES_INFLOW' || detailModal.type === 'OPERATING'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : detailModal.type === 'PURCHASES_OUTFLOW' || detailModal.type === 'OPEX_OUTFLOW'
                        ? 'rgba(248, 113, 113, 0.15)'
                        : detailModal.type === 'INVESTING'
                        ? 'rgba(139, 92, 246, 0.15)'
                        : detailModal.type === 'FINANCING'
                        ? 'rgba(236, 72, 153, 0.15)'
                        : 'rgba(56, 189, 248, 0.15)',
                    color:
                      detailModal.type === 'SALES_INFLOW' || detailModal.type === 'OPERATING'
                        ? '#34d399'
                        : detailModal.type === 'PURCHASES_OUTFLOW' || detailModal.type === 'OPEX_OUTFLOW'
                        ? '#f87171'
                        : detailModal.type === 'INVESTING'
                        ? '#a78bfa'
                        : detailModal.type === 'FINANCING'
                        ? '#f472b6'
                        : '#38bdf8',
                  }}
                >
                  <Search size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
                    {detailModal.title}
                  </h3>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    Periode: <strong>{dateFrom}</strong> s/d <strong>{dateTo}</strong> &nbsp;|&nbsp; Cabang: <strong>{outletTitle}</strong>
                  </div>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setDetailModal({ open: false, type: null, title: '', loading: false, items: [], extraData: null })}
                style={{ fontSize: 20, lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div
              className="modal-body"
              style={{
                padding: '20px 22px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {detailModal.loading ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <LoadingState message="Memuat rincian data mutasi..." />
                </div>
              ) : (
                <>
                  {/* TYPE: SALES_INFLOW */}
                  {detailModal.type === 'SALES_INFLOW' && (
                    <>
                      {/* Summary Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          <div style={{ fontSize: 11, color: '#a7f3d0' }}>Tunai (Cash)</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#34d399', marginTop: 2 }}>
                            {rupiah(op.inflows?.cash_sales)}
                          </div>
                        </div>
                        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                          <div style={{ fontSize: 11, color: '#bae6fd' }}>QRIS</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
                            {rupiah(op.inflows?.qris_sales)}
                          </div>
                        </div>
                        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                          <div style={{ fontSize: 11, color: '#e9d5ff' }}>Transfer Bank</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#c084fc', marginTop: 2 }}>
                            {rupiah(op.inflows?.transfer_sales)}
                          </div>
                        </div>
                        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(251, 146, 60, 0.1)', border: '1px solid rgba(251, 146, 60, 0.2)' }}>
                          <div style={{ fontSize: 11, color: '#fed7aa' }}>Debit / EDC</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#fb923c', marginTop: 2 }}>
                            {rupiah(op.inflows?.debit_sales)}
                          </div>
                        </div>
                        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Kas Masuk</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#f8fafc', marginTop: 2 }}>
                            {rupiah(op.inflows?.total_inflows)}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: 6 }}>
                        💡 <strong>Dari mana angka ini berasal?</strong> Diambil secara real-time dari seluruh order kasir yang berstatus <em>PAID / Selesai</em>. Uang masuk langsung dihitung berdasarkan metode bayar riil.
                      </div>

                      <div className="table-responsive" style={{ maxHeight: 340, overflowY: 'auto' }}>
                        <table className="table" style={{ fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th>No. Invoice / Order</th>
                              <th>Waktu Order</th>
                              <th>Metode Bayar</th>
                              <th>Pelanggan / Meja</th>
                              <th>Item Menu Terjual</th>
                              <th>Kasir</th>
                              <th style={{ textAlign: 'right' }}>Total Bayar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupedSalesOrders.length > 0 ? (
                              groupedSalesOrders.map((ord, idx) => (
                                <tr key={ord.order_number || idx}>
                                  <td className="mono" style={{ color: '#38bdf8', fontWeight: 600 }}>
                                    {ord.order_number}
                                  </td>
                                  <td>
                                    {ord.created_at
                                      ? new Date(ord.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
                                      : ord.date}
                                  </td>
                                  <td>
                                    <span
                                      style={{
                                        padding: '2px 7px',
                                        borderRadius: 4,
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        fontWeight: 700,
                                        fontSize: 11,
                                        color: ord.payment_method === 'CASH' ? '#34d399' : '#38bdf8'
                                      }}
                                    >
                                      {ord.payment_method}
                                    </span>
                                  </td>
                                  <td>
                                    {ord.customer_name || (ord.table_number ? `Meja ${ord.table_number}` : 'Pelanggan Walk-in')}
                                  </td>
                                  <td style={{ color: '#cbd5e1', maxWidth: 220, fontSize: 11.5 }}>
                                    {ord.items.length > 0 ? ord.items.join(', ') : 'Menu Penjualan'}
                                  </td>
                                  <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                    {ord.user_name}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399', fontSize: 13 }}>
                                    {rupiah(ord.total_price)}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                                  Tidak ada transaksi kasir pada periode ini.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* TYPE: RECEIVABLE_INFLOW */}
                  {detailModal.type === 'RECEIVABLE_INFLOW' && (
                    <>
                      {/* Summary Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          <div style={{ fontSize: 11, color: '#a7f3d0' }}>Pembayaran Tunai</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#34d399', marginTop: 2 }}>
                            {rupiah(detailModal.extraData?.cash || 0)}
                          </div>
                        </div>
                        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                          <div style={{ fontSize: 11, color: '#e9d5ff' }}>Transfer Bank</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#c084fc', marginTop: 2 }}>
                            {rupiah(detailModal.extraData?.transfer || 0)}
                          </div>
                        </div>
                        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                          <div style={{ fontSize: 11, color: '#bae6fd' }}>QRIS / Debit</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
                            {rupiah((detailModal.extraData?.qris || 0) + (detailModal.extraData?.debit || 0))}
                          </div>
                        </div>
                        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Kas Masuk Kasbon</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#34d399', marginTop: 2 }}>
                            {rupiah(op.inflows?.receivable_collections || 0)}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '10px 14px', borderRadius: 6 }}>
                        💡 <strong>Prinsip Arus Kas Riil:</strong> Penjualan kasbon saat nota dibuat <em>TIDAK</em> masuk ke Arus Kas karena uang belum diterima. Uang hanya diakui masuk ke Arus Kas ketika pelanggan benar-benar membayar/mencicil kasbon tersebut di kasir.
                      </div>

                      <div className="table-responsive" style={{ maxHeight: 340, overflowY: 'auto' }}>
                        <table className="table" style={{ fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th>No. Bukti Bayar</th>
                              <th>No. Kasbon</th>
                              <th>Tanggal Bayar</th>
                              <th>Nama Pelanggan</th>
                              <th>Metode Bayar</th>
                              <th>Penerima (Kasir)</th>
                              <th>Keterangan / Catatan</th>
                              <th style={{ textAlign: 'right' }}>Nominal Kas Masuk</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailModal.items && detailModal.items.length > 0 ? (
                              detailModal.items.map((item, idx) => (
                                <tr key={item.id || idx}>
                                  <td className="mono" style={{ color: '#38bdf8', fontWeight: 600 }}>
                                    {item.payment_no}
                                  </td>
                                  <td className="mono" style={{ color: '#cbd5e1' }}>
                                    {item.receivable_no || '-'}
                                  </td>
                                  <td>{item.payment_date}</td>
                                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>
                                    {item.customer_name}
                                  </td>
                                  <td>
                                    <span
                                      style={{
                                        padding: '2px 7px',
                                        borderRadius: 4,
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        fontWeight: 700,
                                        fontSize: 11,
                                        color: item.payment_method === 'CASH' ? '#34d399' : '#38bdf8'
                                      }}
                                    >
                                      {item.payment_method}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                    {item.receiver_name}
                                  </td>
                                  <td style={{ fontSize: 11.5, color: '#cbd5e1', maxWidth: 180 }}>
                                    {item.notes || '-'}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399', fontSize: 13 }}>
                                    {rupiah(item.amount)}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                                  Tidak ada catatan pembayaran kasbon pelanggan pada periode ini.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* TYPE: PURCHASES_OUTFLOW */}
                  {detailModal.type === 'PURCHASES_OUTFLOW' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.25)', padding: '14px 18px', borderRadius: 10 }}>
                        <div>
                          <div style={{ fontSize: 12, color: '#fca5a5', fontWeight: 600 }}>Total Belanja Stok Bahan Baku Riil</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#f87171', marginTop: 2 }}>
                            {rupiah(op.outflows?.stock_purchases)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                          <div>{detailModal.items?.length || 0} Riwayat Mutasi Stok Masuk</div>
                          <div style={{ color: '#fca5a5', fontSize: 11, marginTop: 2 }}>Fisik barang masuk gudang/chiller</div>
                        </div>
                      </div>

                      {/* Top 5 Purchases Highlights */}
                      {op.top_purchases && op.top_purchases.length > 0 && (
                        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: 8 }}>
                            Top Belanja Stok Bahan Baku Terbesar:
                          </span>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {op.top_purchases.map((p, idx) => (
                              <div key={idx} style={{ background: 'rgba(248, 113, 113, 0.12)', border: '1px solid rgba(248, 113, 113, 0.25)', padding: '4px 10px', borderRadius: 6, fontSize: 11.5 }}>
                                <span style={{ color: '#f8fafc', fontWeight: 600 }}>{p.name}: </span>
                                <strong style={{ color: '#f87171' }}>{rupiah(p.total)}</strong>
                                <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({num(p.qty, 1)} {p.unit})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: 6 }}>
                        💡 <strong>Dari mana angka ini berasal?</strong> Berasal dari mutasi stok tipe <em>PURCHASE / Belanja Masuk</em> pada menu Inventori & Kartu Stok. Ini mencerminkan 100% uang kas yang benar-benar keluar saat beli bahan, terlepas bahan tersebut sudah habis dimasak atau belum.
                      </div>

                      <div className="table-responsive" style={{ maxHeight: 320, overflowY: 'auto' }}>
                        <table className="table" style={{ fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th>Tanggal</th>
                              <th>Nama Bahan Baku</th>
                              <th style={{ textAlign: 'center' }}>Jumlah / Qty</th>
                              <th style={{ textAlign: 'right' }}>Harga Satuan</th>
                              <th style={{ textAlign: 'right' }}>Total Belanja</th>
                              <th>Keterangan / Supplier</th>
                              <th>Pencatat</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailModal.items && detailModal.items.length > 0 ? (
                              detailModal.items.map((m, idx) => {
                                const qty = Number(m.quantity || m.qty || 0);
                                const unitPrice = Number(m.unit_price || m.price || 0);
                                const total = Number(m.total_cost || m.total_price || (qty * unitPrice));
                                return (
                                  <tr key={m.id || idx}>
                                    <td>{m.date ? m.date.slice(0, 10) : (m.created_at ? m.created_at.slice(0, 10) : '—')}</td>
                                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>
                                      {m.ingredient?.name || m.ingredient_name || m.name || 'Bahan Baku'}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      {num(qty, 1)} {m.unit || m.ingredient?.unit || ''}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      {rupiah(unitPrice)}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#f87171' }}>
                                      {rupiah(total)}
                                    </td>
                                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                      {m.notes || m.supplier_name || m.reference || 'Restock'}
                                    </td>
                                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                      {m.user?.name || m.creator?.name || 'Staff'}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                                  Tidak ada catatan pembelian stok fisik pada periode ini.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* TYPE: OPEX_OUTFLOW */}
                  {detailModal.type === 'OPEX_OUTFLOW' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.25)', padding: '14px 18px', borderRadius: 10 }}>
                        <div>
                          <div style={{ fontSize: 12, color: '#fde68a', fontWeight: 600 }}>Total Beban Operasional Toko (OPEX)</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#fbbf24', marginTop: 2 }}>
                            {rupiah(op.outflows?.opex_expenses)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                          <div>{detailModal.items?.length || 0} Pengeluaran Tercatat</div>
                          <div style={{ color: '#fde68a', fontSize: 11, marginTop: 2 }}>Gaji, utilitas, sewa, listrik, gas dll.</div>
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: 6 }}>
                        💡 <strong>Dari mana angka ini berasal?</strong> Diambil dari seluruh pencatatan biaya kas keluar di menu <em>Pengeluaran Toko / OPEX</em>.
                      </div>

                      <div className="table-responsive" style={{ maxHeight: 320, overflowY: 'auto' }}>
                        <table className="table" style={{ fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th>Tanggal</th>
                              <th>Kategori Beban</th>
                              <th>Uraian Pengeluaran</th>
                              <th>Metode Bayar</th>
                              <th style={{ textAlign: 'right' }}>Nominal (Rp)</th>
                              <th>Petugas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailModal.items && detailModal.items.length > 0 ? (
                              detailModal.items.map((exp, idx) => (
                                <tr key={exp.id || idx}>
                                  <td>{exp.date ? exp.date.slice(0, 10) : (exp.created_at ? exp.created_at.slice(0, 10) : '—')}</td>
                                  <td>
                                    <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24', fontWeight: 600, fontSize: 11 }}>
                                      {exp.category || exp.expense_category?.name || 'OPEX'}
                                    </span>
                                  </td>
                                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>
                                    {exp.name || exp.title || exp.description}
                                    {exp.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{exp.notes}</div>}
                                  </td>
                                  <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                    {exp.payment_method || exp.account || 'Tunai'}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#f87171' }}>
                                    {rupiah(exp.amount)}
                                  </td>
                                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {exp.user?.name || exp.creator?.name || 'Admin'}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                                  Tidak ada catatan pengeluaran OPEX pada periode ini.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* TYPE: OPERATING */}
                  {detailModal.type === 'OPERATING' && (
                    <>
                      <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '16px 20px', borderRadius: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>
                              Arus Kas Bersih Operasi (Net OCF)
                            </span>
                            <div style={{ fontSize: 24, fontWeight: 900, color: op.net >= 0 ? '#34d399' : '#f43f5e', marginTop: 2 }}>
                              {rupiah(op.net)}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ padding: '4px 10px', borderRadius: 20, background: op.net >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)', color: op.net >= 0 ? '#34d399' : '#f43f5e', fontSize: 11, fontWeight: 800 }}>
                              {op.net >= 0 ? 'OPERASIONAL SEHAT / POSITIF' : 'OPERASIONAL DEFISIT'}
                            </span>
                          </div>
                        </div>

                        {/* Waterfall Breakdown Formula */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(0, 0, 0, 0.2)', padding: 12, borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                            <span style={{ color: '#cbd5e1' }}>
                              (+) Kas Masuk Penjualan Kasir (POS)
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '2px 8px', fontSize: 11, color: '#38bdf8' }}
                                onClick={() => handleCardClick('SALES_INFLOW')}
                              >
                                🔍 Lihat Rincian
                              </button>
                              <strong style={{ color: '#34d399' }}>+{rupiah(op.inflows?.total_inflows)}</strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                            <span style={{ color: '#cbd5e1' }}>
                              (-) Kas Keluar Belanja Stok Bahan Riil
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '2px 8px', fontSize: 11, color: '#f87171' }}
                                onClick={() => handleCardClick('PURCHASES_OUTFLOW')}
                              >
                                🔍 Lihat Rincian
                              </button>
                              <strong style={{ color: '#f87171' }}>-{rupiah(op.outflows?.stock_purchases)}</strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                            <span style={{ color: '#cbd5e1' }}>
                              (-) Kas Keluar Biaya Operasional Toko (OPEX)
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '2px 8px', fontSize: 11, color: '#fbbf24' }}
                                onClick={() => handleCardClick('OPEX_OUTFLOW')}
                              >
                                🔍 Lihat Rincian
                              </button>
                              <strong style={{ color: '#f87171' }}>-{rupiah(op.outflows?.opex_expenses)}</strong>
                            </div>
                          </div>

                          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, fontWeight: 800 }}>
                            <span style={{ color: '#f8fafc' }}>(=) Net Operating Cash Flow</span>
                            <span style={{ color: op.net >= 0 ? '#34d399' : '#f43f5e' }}>{rupiah(op.net)}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: 12.5, lineHeight: 1.6, color: '#e2e8f0', background: 'rgba(255, 255, 255, 0.03)', padding: 14, borderRadius: 8 }}>
                        💡 <strong>Makna Bagi Pemilik Resto / Cafe:</strong><br />
                        Arus Kas Operasi (OCF) adalah ukuran utama kesehatan mesin bisnis Anda. Jika OCF bernilai <strong>positif</strong>, artinya operasional harian resto sudah mandiri dan menghasilkan uang tunai bersih tanpa harus disubsidi dana pemilik.
                      </div>
                    </>
                  )}

                  {/* TYPE: INVESTING */}
                  {detailModal.type === 'INVESTING' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', padding: '14px 18px', borderRadius: 10 }}>
                        <div>
                          <div style={{ fontSize: 12, color: '#c4b5fd', fontWeight: 600 }}>Arus Kas Investasi / CapEx Bersih</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: inv.net >= 0 ? '#a78bfa' : '#f87171', marginTop: 2 }}>
                            {rupiah(inv.net)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                          <div>{detailModal.items?.length || 0} Transaksi Aset</div>
                          <div style={{ color: '#c4b5fd', fontSize: 11, marginTop: 2 }}>Kulkas, chiller, mesin kopi, renovasi</div>
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: 6 }}>
                        💡 <strong>Dari mana angka ini berasal?</strong> Berasal dari pencatatan transaksi kas bertipe <em>Investasi (CapEx)</em> di Tab "Jurnal Mutasi Kas Ekstra". CapEx adalah belanja aset berumur panjang yang tidak habis sekali pakai.
                      </div>

                      <div className="table-responsive" style={{ maxHeight: 320, overflowY: 'auto' }}>
                        <table className="table" style={{ fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th>No. Dokumen</th>
                              <th>Tanggal</th>
                              <th>Kategori</th>
                              <th>Uraian Aset / Belanja Modal</th>
                              <th>Akun Kas/Bank</th>
                              <th style={{ textAlign: 'right' }}>Nominal (Rp)</th>
                              <th>Pencatat</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailModal.items && detailModal.items.length > 0 ? (
                              detailModal.items.map((item, idx) => (
                                <tr key={item.id || idx}>
                                  <td className="mono" style={{ color: '#a78bfa', fontWeight: 600 }}>{item.transaction_no || `#${item.id}`}</td>
                                  <td>{item.date ? item.date.slice(0, 10) : '—'}</td>
                                  <td>
                                    <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd', fontWeight: 600, fontSize: 11 }}>
                                      {item.category_label || item.category}
                                    </span>
                                  </td>
                                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>
                                    {item.name}
                                    {item.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.notes}</div>}
                                  </td>
                                  <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{item.account_label || item.account}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: item.type === 'IN' ? '#34d399' : '#f87171' }}>
                                    {item.type === 'IN' ? `+${rupiah(item.amount)}` : `-${rupiah(item.amount)}`}
                                  </td>
                                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.user_name || 'Admin'}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                                  Tidak ada catatan transaksi CapEx pada periode ini. Klik tombol "+ Catat Mutasi Kas" untuk menambahkannya.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* TYPE: FINANCING */}
                  {detailModal.type === 'FINANCING' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(236, 72, 153, 0.08)', border: '1px solid rgba(236, 72, 153, 0.25)', padding: '14px 18px', borderRadius: 10 }}>
                        <div>
                          <div style={{ fontSize: 12, color: '#f472b6', fontWeight: 600 }}>Arus Kas Pendanaan & Prive Bersih</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: fin.net >= 0 ? '#f472b6' : '#f87171', marginTop: 2 }}>
                            {rupiah(fin.net)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                          <div>{detailModal.items?.length || 0} Transaksi Pendanaan</div>
                          <div style={{ color: '#f472b6', fontSize: 11, marginTop: 2 }}>Prive owner, setoran modal, hutang bank</div>
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: 6 }}>
                        💡 <strong>Dari mana angka ini berasal?</strong> Berasal dari mutasi kas tipe <em>Pendanaan (Financing)</em> pada Tab "Jurnal Mutasi Kas Ekstra", seperti penarikan uang pribadi (prive) atau setoran modal pemilik baru.
                      </div>

                      <div className="table-responsive" style={{ maxHeight: 320, overflowY: 'auto' }}>
                        <table className="table" style={{ fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th>No. Dokumen</th>
                              <th>Tanggal</th>
                              <th>Kategori</th>
                              <th>Uraian Transaksi</th>
                              <th>Akun Kas/Bank</th>
                              <th style={{ textAlign: 'right' }}>Nominal (Rp)</th>
                              <th>Pencatat</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailModal.items && detailModal.items.length > 0 ? (
                              detailModal.items.map((item, idx) => (
                                <tr key={item.id || idx}>
                                  <td className="mono" style={{ color: '#f472b6', fontWeight: 600 }}>{item.transaction_no || `#${item.id}`}</td>
                                  <td>{item.date ? item.date.slice(0, 10) : '—'}</td>
                                  <td>
                                    <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', fontWeight: 600, fontSize: 11 }}>
                                      {item.category_label || item.category}
                                    </span>
                                  </td>
                                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>
                                    {item.name}
                                    {item.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.notes}</div>}
                                  </td>
                                  <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{item.account_label || item.account}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: item.type === 'IN' ? '#34d399' : '#f87171' }}>
                                    {item.type === 'IN' ? `+${rupiah(item.amount)}` : `-${rupiah(item.amount)}`}
                                  </td>
                                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.user_name || 'Admin'}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                                  Tidak ada catatan transaksi pendanaan / prive pada periode ini.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* TYPE: NET_CASH */}
                  {detailModal.type === 'NET_CASH' && (
                    <>
                      <div style={{ background: `linear-gradient(135deg, ${sum.liquidity_color}18 0%, rgba(15, 23, 42, 0.9) 100%)`, border: `1.5px solid ${sum.liquidity_color}45`, padding: '18px 22px', borderRadius: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 800, color: sum.liquidity_color, textTransform: 'uppercase' }}>
                              Perubahan Kas Bersih (Total Net Cash Flow)
                            </span>
                            <div style={{ fontSize: 26, fontWeight: 900, color: sum.net_cash_flow >= 0 ? sum.liquidity_color : '#f43f5e', marginTop: 2 }}>
                              {rupiah(sum.net_cash_flow)}
                            </div>
                          </div>
                          <span style={{ padding: '6px 14px', borderRadius: 20, background: `${sum.liquidity_color}25`, color: sum.liquidity_color, border: `1px solid ${sum.liquidity_color}50`, fontWeight: 800, fontSize: 12 }}>
                            {sum.liquidity_label}
                          </span>
                        </div>

                        {/* Equation Box */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(0, 0, 0, 0.3)', padding: 14, borderRadius: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5 }}>
                            <span>1. Arus Kas dari Aktivitas Operasi (OCF)</span>
                            <strong style={{ color: op.net >= 0 ? '#34d399' : '#f43f5e' }}>{op.net >= 0 ? `+${rupiah(op.net)}` : rupiah(op.net)}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5 }}>
                            <span>2. Arus Kas dari Aktivitas Investasi (CapEx)</span>
                            <strong style={{ color: inv.net >= 0 ? '#34d399' : '#f87171' }}>{inv.net >= 0 ? `+${rupiah(inv.net)}` : rupiah(inv.net)}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5 }}>
                            <span>3. Arus Kas dari Aktivitas Pendanaan (FCF & Prive)</span>
                            <strong style={{ color: fin.net >= 0 ? '#34d399' : '#f87171' }}>{fin.net >= 0 ? `+${rupiah(fin.net)}` : rupiah(fin.net)}</strong>
                          </div>
                          <div style={{ borderTop: '2px solid rgba(255, 255, 255, 0.15)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15, fontWeight: 900 }}>
                            <span style={{ color: '#ffffff' }}>(=) Total Kenaikan / (Penurunan) Saldo Kas Riil</span>
                            <span style={{ color: sum.net_cash_flow >= 0 ? sum.liquidity_color : '#f43f5e' }}>{rupiah(sum.net_cash_flow)}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: 12.5, lineHeight: 1.6, color: '#cbd5e1', background: 'rgba(255, 255, 255, 0.03)', padding: 14, borderRadius: 8 }}>
                        💡 <strong>Mengapa ini penting?</strong> Angka ini mencerminkan secara presisi berapa rupiah saldo uang nyata yang bertambah atau berkurang di brankas laci kasir dan rekening bank operasional Anda selama periode ini.
                      </div>
                    </>
                  )}

                  {/* TYPE: INVENTORY_TRAPPED */}
                  {detailModal.type === 'INVENTORY_TRAPPED' && (
                    <>
                      <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '16px 20px', borderRadius: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                              Kas Terkunci di Persediaan Stok Gudang
                            </span>
                            <div style={{ fontSize: 24, fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>
                              {rupiah(recon.inventory_capital_change || 0)}
                            </div>
                          </div>
                          <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: 11, fontWeight: 700 }}>
                            Working Capital Inventory
                          </span>
                        </div>

                        {/* Comparison Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>1. Total Uang Keluar Beli Bahan Baku (Kas Riil)</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#f87171', marginTop: 4 }}>
                              {rupiah(op.outflows?.stock_purchases)}
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Faktur pembelian riil masuk gudang/chiller</div>
                          </div>
                          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>2. HPP Resep Bahan Terpakai (COGS di P&L)</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>
                              {rupiah(Math.max(0, (op.outflows?.stock_purchases || 0) - (recon.inventory_capital_change || 0)))}
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Porsi bahan yang sudah termasak & terjual</div>
                          </div>
                        </div>
                      </div>

                      {/* Top 5 Purchased items */}
                      {op.top_purchases && op.top_purchases.length > 0 && (
                        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: 8 }}>
                            Top 5 Bahan Baku Penyerap Kas Terbesar Periode Ini:
                          </span>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {op.top_purchases.map((p, idx) => (
                              <div key={idx} style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '4px 10px', borderRadius: 6, fontSize: 11.5 }}>
                                <span style={{ color: '#f8fafc', fontWeight: 600 }}>{p.name}: </span>
                                <strong style={{ color: '#38bdf8' }}>{rupiah(p.total)}</strong>
                                <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({num(p.qty, 1)} {p.unit})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ fontSize: 12.5, lineHeight: 1.6, color: '#cbd5e1', background: 'rgba(255, 255, 255, 0.03)', padding: 14, borderRadius: 8 }}>
                        💡 <strong>Penjelasan Konsep F&B:</strong><br />
                        Ketika Anda menyetok daging frozen, beras, keju, atau sirup dalam jumlah besar, uang kas fisik Anda langsung terpotong 100%. Namun laporan Laba Rugi hanya membebankan porsi bahan yang sudah terjual. Selisih <strong>{rupiah(recon.inventory_capital_change || 0)}</strong> ini menjadi modal kerja yang saat ini aman tersimpan dalam bentuk persediaan fisik di gudang.
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div
              className="modal-footer"
              style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(15, 23, 42, 0.95)',
                padding: '12px 22px',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDetailModal({ open: false, type: null, title: '', loading: false, items: [], extraData: null })}
                style={{ fontWeight: 600 }}
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. HIDDEN PRINTABLE CONTAINER FOR A4 REPORT */}
      <div id="printable-cashflow-statement" style={{ display: 'none' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", color: '#000000', padding: 20 }}>
          <div style={{ borderBottom: '2px solid #000', paddingBottom: 12, marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {businessTitle}
            </h2>
            <div style={{ fontSize: 13, fontWeight: 'bold', marginTop: 2 }}>
              LAPORAN ARUS KAS NYATA (CASH FLOW STATEMENT)
            </div>
            <div style={{ fontSize: 11, color: '#333', marginTop: 4 }}>
              Cabang: {outletTitle} | Periode: {dateFrom} s/d {dateTo} | Dicetak: {new Date().toLocaleString('id-ID')}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #000' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>URAIAN AKTIVITAS ARUS KAS</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>JUMLAH (IDR)</th>
              </tr>
            </thead>
            <tbody>
              {/* I. OPERATING */}
              <tr style={{ fontWeight: 'bold', background: '#f8fafc' }}>
                <td style={{ padding: '6px 8px' }}>I. ARUS KAS DARI AKTIVITAS OPERASI</td>
                <td style={{ textAlign: 'right', padding: '6px 8px' }}></td>
              </tr>
              <tr>
                <td style={{ padding: '4px 8px 4px 20px' }}>Penerimaan Kas dari Penjualan Kasir</td>
                <td style={{ textAlign: 'right', padding: '4px 8px' }}>{rupiah(op.inflows?.total_inflows)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 8px 4px 20px', color: '#b91c1c' }}>Pembelian Persediaan Bahan Baku Riil (-)</td>
                <td style={{ textAlign: 'right', padding: '4px 8px', color: '#b91c1c' }}>({rupiah(op.outflows?.stock_purchases)})</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 8px 4px 20px', color: '#b91c1c' }}>Pembayaran Beban Operasional Toko (OPEX) (-)</td>
                <td style={{ textAlign: 'right', padding: '4px 8px', color: '#b91c1c' }}>({rupiah(op.outflows?.opex_expenses)})</td>
              </tr>
              <tr style={{ fontWeight: 'bold', borderBottom: '1px solid #ccc' }}>
                <td style={{ padding: '6px 8px' }}>Arus Kas Bersih dari Aktivitas Operasi</td>
                <td style={{ textAlign: 'right', padding: '6px 8px' }}>{rupiah(op.net)}</td>
              </tr>

              {/* II. INVESTING */}
              <tr style={{ fontWeight: 'bold', background: '#f8fafc' }}>
                <td style={{ padding: '6px 8px' }}>II. ARUS KAS DARI AKTIVITAS INVESTASI (CAPEX)</td>
                <td style={{ textAlign: 'right', padding: '6px 8px' }}></td>
              </tr>
              {inv.breakdown?.map((b, i) => (
                <tr key={i}>
                  <td style={{ padding: '4px 8px 4px 20px' }}>{b.label}</td>
                  <td style={{ textAlign: 'right', padding: '4px 8px' }}>
                    {b.type === 'IN' ? rupiah(b.amount) : `(${rupiah(b.amount)})`}
                  </td>
                </tr>
              ))}
              <tr style={{ fontWeight: 'bold', borderBottom: '1px solid #ccc' }}>
                <td style={{ padding: '6px 8px' }}>Arus Kas Bersih dari Aktivitas Investasi</td>
                <td style={{ textAlign: 'right', padding: '6px 8px' }}>{rupiah(inv.net)}</td>
              </tr>

              {/* III. FINANCING */}
              <tr style={{ fontWeight: 'bold', background: '#f8fafc' }}>
                <td style={{ padding: '6px 8px' }}>III. ARUS KAS DARI AKTIVITAS PENDANAAN</td>
                <td style={{ textAlign: 'right', padding: '6px 8px' }}></td>
              </tr>
              {fin.breakdown?.map((b, i) => (
                <tr key={i}>
                  <td style={{ padding: '4px 8px 4px 20px' }}>{b.label}</td>
                  <td style={{ textAlign: 'right', padding: '4px 8px' }}>
                    {b.type === 'IN' ? rupiah(b.amount) : `(${rupiah(b.amount)})`}
                  </td>
                </tr>
              ))}
              <tr style={{ fontWeight: 'bold', borderBottom: '1px solid #000' }}>
                <td style={{ padding: '6px 8px' }}>Arus Kas Bersih dari Aktivitas Pendanaan</td>
                <td style={{ textAlign: 'right', padding: '6px 8px' }}>{rupiah(fin.net)}</td>
              </tr>

              {/* GRAND TOTAL */}
              <tr style={{ fontWeight: 'bold', fontSize: 13, background: '#cbd5e1', borderBottom: '3px double #000' }}>
                <td style={{ padding: '8px' }}>KENAIKAN / (PENURUNAN) BERSIH KAS RIIL</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{rupiah(sum.net_cash_flow)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', padding: '0 40px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, marginBottom: 50 }}>Dibuat Oleh (Finance / Kasir):</div>
              <div style={{ borderTop: '1px solid #000', paddingTop: 4, fontWeight: 'bold', fontSize: 11 }}>
                {currentUser?.name || 'Staff Finance'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, marginBottom: 50 }}>Disetujui Oleh (Owner Resto):</div>
              <div style={{ borderTop: '1px solid #000', paddingTop: 4, fontWeight: 'bold', fontSize: 11 }}>
                ( Pemilik Usaha / Owner )
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
