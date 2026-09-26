import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Package, Trash2,
  Calendar, Printer, Plus, Search, Filter, RefreshCw,
  Landmark, AlertCircle, CheckCircle2, ChevronRight,
  Layers, FileText, ArrowDownRight, Edit3, Trash, Info,
  Store, CreditCard, PieChart, ShieldAlert, Sparkles, Building2, Flame,
  ArrowUpRight, ArrowDownLeft, AlertTriangle, GitCompare, HelpCircle,
  BarChart3, Award, Trophy, ArrowUpDown, ChevronUp, ChevronDown, Check, Zap, Tag
} from 'lucide-react';
import api from '../api/client';
import { rupiah, num, pct, LoadingState, PageHeader, PeriodPicker } from '../components/ui';
import { getTodayStr, getMonthStartStr, getMonthEndStr } from '../utils/date';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import { printElement } from '../utils/print';
import { confirmDialog } from '../utils/swal';

export const EXPENSE_CATEGORIES = [
  { value: 'SALARY',      label: 'Gaji & Upah Karyawan',          color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  { value: 'UTILITIES',   label: 'Listrik, Air & Internet',        color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)' },
  { value: 'GAS',         label: 'Gas Masak (LPG)',                color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)' },
  { value: 'RENT',        label: 'Sewa Tempat / Bangunan',         color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)' },
  { value: 'MAINTENANCE', label: 'Pemeliharaan, Sanitasi & Servis', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' },
  { value: 'MARKETING',   label: 'Pemasaran & Promosi',            color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' },
  { value: 'LOGISTICS',   label: 'Logistik & Transportasi',        color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  { value: 'OTHER',       label: 'Beban Operasional Lain-lain',    color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)' },
];

export const PAYMENT_METHODS = [
  { value: 'CASH',       label: 'Kas Operasional / Tunai' },
  { value: 'TRANSFER',   label: 'Transfer Bank' },
  { value: 'PETTY_CASH', label: 'Kas Kecil (Petty Cash)' },
  { value: 'DEBIT',      label: 'Debit / Kartu EDC' },
];

export const COMPARISON_OPTIONS = [
  { value: 'previous_month',  label: 'Bulan Sebelumnya (MoM)' },
  { value: 'previous_year',   label: 'Tahun Sebelumnya (YoY)' },
  { value: 'previous_period', label: 'Periode Sebelumnya yang Berdurasi Sama' },
  { value: 'custom',          label: 'Rentang Tanggal Kustom' },
];

export default function ProfitLoss() {
  const { activeOutletId, activeOutlet, outlets, currentBusiness, dateFrom, dateTo } = useOutlet();
  const currentUser = JSON.parse(localStorage.getItem('pos_user') || '{}');

  const todayStr = getTodayStr();
  const [activeTab, setActiveTab] = useState('statement'); // 'statement' | 'expenses'
  const [notaTypeFilter, setNotaTypeFilter] = useState('ALL'); // 'ALL' | 'GENERATE' | 'MANUAL'

  // Comparison State
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareWith, setCompareWith] = useState('previous_month');
  const [compareCustomFrom, setCompareCustomFrom] = useState('');
  const [compareCustomTo, setCompareCustomTo] = useState('');

  // Data states
  const [loading, setLoading] = useState(true);
  const [plData, setPlData] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [expenseSummary, setExpenseSummary] = useState(null);

  // Benchmark Antar Cabang State
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkSortField, setBenchmarkSortField] = useState('net_margin_pct');
  const [benchmarkSortAsc, setBenchmarkSortAsc] = useState(false);

  // Expense management state
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  // Detail Drilldown Modal State
  const [detailModal, setDetailModal] = useState({
    open: false,
    type: null, // 'REVENUE' | 'COGS' | 'WASTE' | 'OPEX' | 'NET_PROFIT' | 'DISCOUNT'
    title: '',
    loading: false,
    items: [],
  });
  const [modalFilter, setModalFilter] = useState('ALL'); // 'ALL' | 'GENERATE' | 'MANUAL' | 'DISCOUNT'
  const [modalSearch, setModalSearch] = useState('');

  async function handleCardClick(type, filter = 'ALL') {
    const targetOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all'
      ? activeOutletId
      : undefined;

    setModalSearch('');

    if (type === 'REVENUE' || type === 'DISCOUNT') {
      const isDiscountOnly = type === 'DISCOUNT' || filter === 'DISCOUNT';
      const initialFilter = isDiscountOnly ? 'DISCOUNT' : filter;
      setModalFilter(initialFilter);

      let modalTitle = 'Rincian Detail Transaksi Omset Penjualan';
      if (isDiscountOnly) {
        modalTitle = 'Rincian Pemotongan Diskon & Voucher Promo';
      } else if (filter === 'GENERATE') {
        modalTitle = 'Rincian Transaksi Penjualan Nota Generate (POS Standar)';
      } else if (filter === 'MANUAL') {
        modalTitle = 'Rincian Transaksi Penjualan Nota Manual (Nota Urgent)';
      }

      setDetailModal({
        open: true,
        type: isDiscountOnly ? 'DISCOUNT' : 'REVENUE',
        title: modalTitle,
        loading: true,
        items: []
      });

      try {
        const params = {
          from: dateFrom,
          to: dateTo,
          outlet_id: targetOutlet,
          status: 'PAID',
          limit: 500,
        };
        const res = await api.get('/transactions', { params });
        setDetailModal(p => ({ ...p, loading: false, items: res.data?.data || res.data || [] }));
      } catch {
        toast.error('Gagal memuat rincian transaksi penjualan');
        setDetailModal(p => ({ ...p, loading: false }));
      }
    } else if (type === 'COGS') {
      setDetailModal({ open: true, type: 'COGS', title: 'Rincian Detail HPP Resep & Susut Opname', loading: false, items: [] });
    } else if (type === 'WASTE') {
      setDetailModal({ open: true, type: 'WASTE', title: 'Rincian Detail Kerugian Waste (Bahan/Menu Terbuang)', loading: true, items: [] });
      try {
        const res = await api.get('/waste-logs', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet }
        });
        setDetailModal(p => ({ ...p, loading: false, items: res.data || [] }));
      } catch {
        toast.error('Gagal memuat rincian log waste');
        setDetailModal(p => ({ ...p, loading: false }));
      }
    } else if (type === 'OPEX') {
      setDetailModal({ open: true, type: 'OPEX', title: 'Rincian Detail Beban Operasional Toko (OPEX)', loading: true, items: [] });
      try {
        const res = await api.get('/expenses', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet }
        });
        setDetailModal(p => ({ ...p, loading: false, items: res.data || [] }));
      } catch {
        toast.error('Gagal memuat rincian OPEX');
        setDetailModal(p => ({ ...p, loading: false }));
      }
    } else if (type === 'GROSS_PROFIT') {
      setDetailModal({ open: true, type: 'GROSS_PROFIT', title: 'Rincian Kalkulasi Laba Kotor (Gross Profit)', loading: false, items: [] });
    } else if (type === 'NET_PROFIT') {
      setDetailModal({ open: true, type: 'NET_PROFIT', title: 'Rincian Formulasi & Sumber Kalkulasi Laba Bersih', loading: false, items: [] });
    }
  }

  // Process raw transactions into grouped orders with item details and discount metadata
  const groupedOrders = useMemo(() => {
    if (!detailModal.items || detailModal.items.length === 0) return [];
    const map = new Map();
    for (const t of detailModal.items) {
      const key = t.order_number || `TRX-${t.id}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          id: t.id,
          order_number: t.order_number || `#${t.id}`,
          date: t.date,
          created_at: t.created_at,
          customer_name: t.customer_name || 'Pelanggan Walk-in',
          table_number: t.table_number,
          payment_method: t.payment_method || 'CASH',
          is_urgent_note: Boolean(t.is_urgent_note),
          discount_name: t.discount_name || t.discount?.name || null,
          discount_type: t.discount_type,
          discount_rate: Number(t.discount_rate || 0),
          items: [],
          subtotal: 0,
          discount_amount: 0,
          total_price: 0,
        });
      }
      const order = map.get(key);
      if (t.is_urgent_note) order.is_urgent_note = true;
      if (!order.discount_name && (t.discount_name || t.discount?.name)) {
        order.discount_name = t.discount_name || t.discount?.name;
        order.discount_type = t.discount_type;
        order.discount_rate = Number(t.discount_rate || 0);
      }
      const itemSubtotal = Number(t.subtotal) > 0 ? Number(t.subtotal) : (Number(t.total_price) + Number(t.discount_amount || 0));
      order.subtotal += itemSubtotal;
      order.discount_amount += Number(t.discount_amount || 0);
      order.total_price += Number(t.total_price || 0);
      order.items.push({
        id: t.id,
        name: t.menu?.name || 'Menu',
        qty: Number(t.qty || 1),
        subtotal: itemSubtotal,
        price: Number(t.total_price || 0),
        discount_amount: Number(t.discount_amount || 0),
      });
    }
    return Array.from(map.values());
  }, [detailModal.items]);

  const generateOrdersList = useMemo(() => {
    return groupedOrders.filter(o => !o.is_urgent_note);
  }, [groupedOrders]);

  const manualOrdersList = useMemo(() => {
    return groupedOrders.filter(o => o.is_urgent_note);
  }, [groupedOrders]);

  const discountOrdersList = useMemo(() => {
    return groupedOrders.filter(o => o.discount_amount > 0);
  }, [groupedOrders]);

  const displayedOrders = useMemo(() => {
    let list = groupedOrders;
    if (modalFilter === 'GENERATE') {
      list = generateOrdersList;
    } else if (modalFilter === 'MANUAL') {
      list = manualOrdersList;
    } else if (modalFilter === 'DISCOUNT') {
      list = discountOrdersList;
    }

    if (!modalSearch.trim()) return list;
    const q = modalSearch.toLowerCase().trim();
    return list.filter(o =>
      o.order_number?.toLowerCase().includes(q) ||
      o.customer_name?.toLowerCase().includes(q) ||
      o.discount_name?.toLowerCase().includes(q) ||
      o.items?.some(it => it.name?.toLowerCase().includes(q))
    );
  }, [groupedOrders, modalFilter, modalSearch, generateOrdersList, manualOrdersList, discountOrdersList]);

  const initialForm = {
    date: todayStr,
    outlet_id: activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : '',
    category: 'UTILITIES',
    name: '',
    amount: '',
    payment_method: 'CASH',
    notes: '',
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    fetchData();
    if (activeTab === 'benchmark') {
      fetchBenchmark();
    }
  }, [dateFrom, dateTo, activeOutletId, compareEnabled, compareWith, compareCustomFrom, compareCustomTo, activeTab, notaTypeFilter]);

  async function fetchBenchmark() {
    setBenchmarkLoading(true);
    try {
      const res = await api.get('/reports/outlet-benchmark', {
        params: { from: dateFrom, to: dateTo, nota_type: notaTypeFilter }
      });
      setBenchmarkData(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat data benchmark performa antar cabang');
    } finally {
      setBenchmarkLoading(false);
    }
  }

  async function fetchData() {
    setLoading(true);
    try {
      const targetOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all'
        ? activeOutletId
        : undefined;

      const params = {
        from: dateFrom,
        to: dateTo,
        outlet_id: targetOutlet,
        nota_type: notaTypeFilter,
      };

      if (compareEnabled) {
        params.compare = 'true';
        params.compare_with = compareWith;
        if (compareWith === 'custom' && compareCustomFrom && compareCustomTo) {
          params.compare_from = compareCustomFrom;
          params.compare_to = compareCustomTo;
        }
      }

      const [resPl, resExp, resSummary] = await Promise.all([
        api.get('/reports/profit-loss', { params }),
        api.get('/expenses', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet },
        }),
        api.get('/expenses/summary', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet },
        }),
      ]);

      setPlData(resPl.data);
      setExpenses(resExp.data || []);
      setExpenseSummary(resSummary.data || null);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat data Laporan Laba Rugi');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreateModal() {
    setEditingExpenseId(null);
    setFormData({
      ...initialForm,
      outlet_id: activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : '',
    });
    setModalOpen(true);
  }

  function handleOpenEditModal(item) {
    setEditingExpenseId(item.id);
    setFormData({
      date: item.date ? item.date.slice(0, 10) : todayStr,
      outlet_id: item.outlet_id ? item.outlet_id.toString() : '',
      category: item.category || 'OTHER',
      name: item.name || '',
      amount: item.amount || '',
      payment_method: item.payment_method || 'CASH',
      notes: item.notes || '',
    });
    setModalOpen(true);
  }

  async function handleSubmitExpense(e) {
    e.preventDefault();
    if (!formData.name || !formData.amount || Number(formData.amount) <= 0) {
      toast.error('Harap lengkapi nama biaya dan nominal dengan benar');
      return;
    }

    setSavingExpense(true);
    try {
      const payload = {
        date: formData.date,
        outlet_id: formData.outlet_id ? Number(formData.outlet_id) : null,
        category: formData.category,
        name: formData.name,
        amount: Number(formData.amount),
        payment_method: formData.payment_method,
        notes: formData.notes,
      };

      if (editingExpenseId) {
        await api.put(`/expenses/${editingExpenseId}`, payload);
        toast.success('Data biaya operasional berhasil diperbarui');
      } else {
        await api.post('/expenses', payload);
        toast.success('Biaya operasional berhasil dicatat');
      }

      setModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Gagal menyimpan biaya operasional');
    } finally {
      setSavingExpense(false);
    }
  }

  async function handleDeleteExpense(id, name) {
    const confirmed = await confirmDialog({
      title: 'Hapus Biaya Operasional?',
      text: `Yakin ingin menghapus catatan biaya "${name}"?`,
      confirmText: 'Ya, Hapus Biaya',
      cancelText: 'Batal',
      isDanger: true,
    });
    if (!confirmed) return;
    try {
      await api.delete(`/expenses/${id}`);
      toast.success('Biaya operasional berhasil dihapus');
      fetchData();
    } catch {
      toast.error('Gagal menghapus biaya operasional');
    }
  }

  const filteredExpenses = useMemo(() => {
    return expenses.filter(item => {
      const matchCat = expenseCategoryFilter === 'ALL' || item.category === expenseCategoryFilter;
      const matchSearch = !expenseSearch ||
        item.name.toLowerCase().includes(expenseSearch.toLowerCase()) ||
        (item.expense_no && item.expense_no.toLowerCase().includes(expenseSearch.toLowerCase())) ||
        (item.notes && item.notes.toLowerCase().includes(expenseSearch.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [expenses, expenseCategoryFilter, expenseSearch]);

  function handlePrintReport() {
    printElement(
      'printable-pl-statement',
      `Laporan Laba Rugi Komprehensif - ${dateFrom} sd ${dateTo}`,
      { orientation: 'portrait' }
    );
  }

  function handlePrintBenchmark() {
    printElement(
      'printable-benchmark-matrix',
      `Benchmark Performa Antar-Cabang - ${dateFrom} sd ${dateTo}`,
      { orientation: 'landscape' }
    );
  }

  const sortedBenchmarkOutlets = useMemo(() => {
    if (!benchmarkData?.outlets) return [];
    const list = [...benchmarkData.outlets];
    list.sort((a, b) => {
      let valA, valB;
      if (benchmarkSortField === 'name') {
        valA = a.outlet.name.toLowerCase();
        valB = b.outlet.name.toLowerCase();
        return benchmarkSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (benchmarkSortField === 'net_sales') {
        valA = a.revenue.net_sales;
        valB = b.revenue.net_sales;
      } else if (benchmarkSortField === 'cogs_ratio_pct') {
        valA = a.cogs.cogs_ratio_pct;
        valB = b.cogs.cogs_ratio_pct;
      } else if (benchmarkSortField === 'waste_ratio_pct') {
        valA = a.waste.waste_ratio_pct;
        valB = b.waste.waste_ratio_pct;
      } else if (benchmarkSortField === 'salary_ratio_pct') {
        valA = a.opex.salary_ratio_pct;
        valB = b.opex.salary_ratio_pct;
      } else if (benchmarkSortField === 'opex_ratio_pct') {
        valA = a.opex.opex_ratio_pct;
        valB = b.opex.opex_ratio_pct;
      } else if (benchmarkSortField === 'net_profit') {
        valA = a.bottom_line.net_profit;
        valB = b.bottom_line.net_profit;
      } else if (benchmarkSortField === 'net_margin_pct') {
        valA = a.bottom_line.net_margin_pct;
        valB = b.bottom_line.net_margin_pct;
      } else if (benchmarkSortField === 'transaction_count') {
        valA = a.revenue.transaction_count;
        valB = b.revenue.transaction_count;
      } else {
        valA = a.bottom_line.net_margin_pct;
        valB = b.bottom_line.net_margin_pct;
      }
      return benchmarkSortAsc ? valA - valB : valB - valA;
    });
    return list;
  }, [benchmarkData, benchmarkSortField, benchmarkSortAsc]);

  function handleBenchmarkSort(field) {
    if (benchmarkSortField === field) {
      setBenchmarkSortAsc(!benchmarkSortAsc);
    } else {
      setBenchmarkSortField(field);
      setBenchmarkSortAsc(false);
    }
  }

  const businessTitle = currentBusiness?.name || currentUser?.business?.name || 'MOVA POS F&B Management';
  const outletTitle = (activeOutlet && activeOutletId !== 'ALL' && activeOutletId !== 'all')
    ? activeOutlet.name
    : 'Semua Cabang (Konsolidasi Usaha)';

  if (loading && !plData) return <LoadingState />;

  const rev = plData?.revenue || { gross_sales: 0, total_discount: 0, net_sales: 0, transaction_count: 0, avg_order_value: 0, payment_breakdown: [] };
  const notaGen = plData?.revenue?.nota_generate || { gross_sales: 0, discount: 0, net_sales: 0, transaction_count: 0, share_pct: 0, avg_order_value: 0 };
  const notaMan = plData?.revenue?.nota_manual || { gross_sales: 0, discount: 0, net_sales: 0, transaction_count: 0, share_pct: 0, avg_order_value: 0 };
  const combinedRev = plData?.revenue?.combined || rev;
  const cogs = plData?.cogs || { cogs_recipes: 0, cogs_variance: 0, total_cogs: 0, cogs_ratio_pct: 0, gross_profit: 0, gross_margin_pct: 0, top_ingredients_usage: [] };
  const wst = plData?.waste || { total_waste_loss: 0, waste_ratio_pct: 0, operating_profit_after_waste: 0, breakdown: [] };
  const opx = plData?.opex || { total_opex: 0, opex_ratio_pct: 0, breakdown: [], total_records: 0 };
  const bot = plData?.bottom_line || { net_profit: 0, net_margin_pct: 0, health_status: 'PRIME', health_label: 'Sangat Sehat', health_color: '#10B981' };
  const waterfall = plData?.waterfall || [];

  const notaBreakdown = plData?.nota_breakdown || null;
  const genBd = notaBreakdown?.generate || {
    gross_sales: notaGen.gross_sales || 0,
    discount: notaGen.discount || 0,
    net_sales: notaGen.net_sales || 0,
    transaction_count: notaGen.transaction_count || 0,
    share_pct: notaGen.share_pct || 0,
    cogs: 0,
    cogs_ratio_pct: 0,
    gross_profit: 0,
    gross_margin_pct: 0,
    waste: 0,
    opex: 0,
    net_profit: 0,
    net_margin_pct: 0,
  };
  const manBd = notaBreakdown?.manual || {
    gross_sales: notaMan.gross_sales || 0,
    discount: notaMan.discount || 0,
    net_sales: notaMan.net_sales || 0,
    transaction_count: notaMan.transaction_count || 0,
    share_pct: notaMan.share_pct || 0,
    cogs: 0,
    cogs_ratio_pct: 0,
    gross_profit: 0,
    gross_margin_pct: 0,
    waste: 0,
    opex: 0,
    net_profit: 0,
    net_margin_pct: 0,
  };
  const combBd = notaBreakdown?.combined || {
    gross_sales: combinedRev.gross_sales || rev.gross_sales || 0,
    discount: combinedRev.discount || rev.total_discount || 0,
    net_sales: combinedRev.net_sales || rev.net_sales || 0,
    transaction_count: combinedRev.transaction_count || rev.transaction_count || 0,
    share_pct: 100,
    cogs: cogs.total_cogs || 0,
    cogs_ratio_pct: cogs.cogs_ratio_pct || 0,
    gross_profit: cogs.gross_profit || 0,
    gross_margin_pct: cogs.gross_margin_pct || 0,
    waste: wst.total_waste_loss || 0,
    opex: opx.total_opex || 0,
    net_profit: bot.net_profit || 0,
    net_margin_pct: bot.net_margin_pct || 0,
  };

  // Comparison & Delta objects
  const isComp = plData?.is_comparison && plData?.delta;
  const prev = plData?.previous || null;
  const delta = plData?.delta || null;
  const comparePeriod = plData?.compare_period || null;

  function renderDeltaBadge(deltaObj, labelSuffix = 'vs Pembanding') {
    if (!isComp || !deltaObj) return null;
    const isGood = deltaObj.sentiment === 'GOOD';
    const isBad = deltaObj.sentiment === 'BAD';
    const color = isGood ? '#10b981' : isBad ? '#f43f5e' : '#94a3b8';
    const bg = isGood ? 'rgba(16, 185, 129, 0.14)' : isBad ? 'rgba(244, 63, 94, 0.14)' : 'rgba(255, 255, 255, 0.08)';
    const Icon = deltaObj.trend === 'UP' ? ArrowUpRight : deltaObj.trend === 'DOWN' ? ArrowDownLeft : ChevronRight;
    const prefix = deltaObj.diff_pct > 0 ? '+' : '';

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 700,
          background: bg,
          color,
          border: `1px solid ${color}35`,
          marginTop: 4,
        }}
      >
        <Icon size={13} />
        <span>{prefix}{deltaObj.diff_pct}%</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          ({deltaObj.diff_nominal > 0 ? '+' : ''}{rupiah(deltaObj.diff_nominal)})
        </span>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* 1. Header & Quick Controls */}
      <div className="flex-between mb-4 flex-wrap gap-3">
        <PageHeader
          title="Laporan Laba Rugi Komprehensif (P&L)"
          subtitle="Satu layar terintegrasi performa laba bersih riil: Omset Bersih dikurangi HPP Riil (Resep + Susut Opname), Kerugian Waste, dan Beban Operasional Toko (OPEX)."
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
            onClick={handlePrintReport}
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
            <Printer size={15} /> Cetak Laporan P&L
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleOpenCreateModal}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Plus size={16} /> Catat Biaya (OPEX)
          </button>
        </div>
      </div>

      {/* Date Range & Period Comparison Filter Bar */}
      <div
        className="card mb-4"
        style={{
          padding: '14px 18px',
          background: 'rgba(17, 22, 45, 0.75)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(165, 180, 252, 0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          {/* Nota Type Scope Control (Semua Gabungan, Nota Generate, Nota Manual) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
              Cakupan Nota:
            </span>
            <div
              style={{
                display: 'inline-flex',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 10,
                padding: 3,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                gap: 2,
              }}
            >
              <button
                type="button"
                className={`btn btn-sm ${notaTypeFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setNotaTypeFilter('ALL')}
                style={{
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '5px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                title="Tampilkan semua transaksi gabungan (Nota Generate + Manual)"
              >
                Semua Nota (Gabungan)
                {combinedRev?.transaction_count !== undefined && (
                  <span
                    style={{
                      padding: '1px 6px',
                      borderRadius: 10,
                      fontSize: 10.5,
                      background: notaTypeFilter === 'ALL' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                      fontWeight: 800,
                    }}
                  >
                    {combinedRev.transaction_count}
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`btn btn-sm ${notaTypeFilter === 'GENERATE' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setNotaTypeFilter('GENERATE')}
                style={{
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '5px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: notaTypeFilter === 'GENERATE' ? '#ffffff' : '#06b6d4',
                  borderColor: notaTypeFilter === 'GENERATE' ? undefined : 'rgba(6, 182, 212, 0.25)',
                }}
                title="Hanya tampilkan transaksi dari kasir POS standar (Nota Generate)"
              >
                Nota Generate
                {notaGen?.transaction_count !== undefined && (
                  <span
                    style={{
                      padding: '1px 6px',
                      borderRadius: 10,
                      fontSize: 10.5,
                      background: notaTypeFilter === 'GENERATE' ? 'rgba(255,255,255,0.25)' : 'rgba(6, 182, 212, 0.2)',
                      fontWeight: 800,
                      color: notaTypeFilter === 'GENERATE' ? '#ffffff' : '#22d3ee',
                    }}
                  >
                    {notaGen.transaction_count}
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`btn btn-sm ${notaTypeFilter === 'MANUAL' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setNotaTypeFilter('MANUAL')}
                style={{
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '5px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: notaTypeFilter === 'MANUAL' ? '#ffffff' : '#f59e0b',
                  borderColor: notaTypeFilter === 'MANUAL' ? undefined : 'rgba(245, 158, 11, 0.25)',
                }}
                title="Hanya tampilkan transaksi dari nota manual (Nota Urgent)"
              >
                Nota Manual
                {notaMan?.transaction_count !== undefined && (
                  <span
                    style={{
                      padding: '1px 6px',
                      borderRadius: 10,
                      fontSize: 10.5,
                      background: notaTypeFilter === 'MANUAL' ? 'rgba(255,255,255,0.25)' : 'rgba(245, 158, 11, 0.2)',
                      fontWeight: 800,
                      color: notaTypeFilter === 'MANUAL' ? '#ffffff' : '#fbbf24',
                    }}
                  >
                    {notaMan.transaction_count}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Comparison Mode Sub-Bar */}
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${compareEnabled ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
                fontSize: 12,
                borderRadius: 20,
                padding: '5px 14px',
              }}
              onClick={() => setCompareEnabled(!compareEnabled)}
            >
              <GitCompare size={14} />
              {compareEnabled ? 'Mode Komparasi: AKTIF' : 'Aktifkan Komparasi (MoM / YoY)'}
            </button>

            {compareEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bandingkan dengan:</span>
                <select
                  className="form-control"
                  style={{ fontSize: 12.5, height: 32, minWidth: 200, padding: '2px 10px' }}
                  value={compareWith}
                  onChange={e => setCompareWith(e.target.value)}
                >
                  {COMPARISON_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {compareWith === 'custom' && (
                  <PeriodPicker
                    from={compareCustomFrom}
                    to={compareCustomTo}
                    onChange={({ from, to }) => {
                      setCompareCustomFrom(from);
                      setCompareCustomTo(to);
                    }}
                    label="Pembanding"
                    align="left"
                  />
                )}
              </div>
            )}
          </div>

          {compareEnabled && comparePeriod && (
            <div style={{ fontSize: 11.5, color: '#38bdf8', fontWeight: 600 }}>
              Periode Pembanding: <strong>{comparePeriod.from}</strong> s/d <strong>{comparePeriod.to}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Cost Anomaly Alert Banner */}
      {isComp && delta?.anomalies && delta.anomalies.length > 0 && (
        <div
          className="card mb-4"
          style={{
            padding: '14px 18px',
            borderRadius: 10,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1.5px solid rgba(239, 68, 68, 0.35)',
            boxShadow: '0 6px 20px rgba(239, 68, 68, 0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <AlertTriangle size={22} color="#f43f5e" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#f87171' }}>
                Deteksi Anomali Lonjakan Biaya (Periode Ini vs Pembanding):
              </div>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5, color: '#fecdd3', lineHeight: 1.6 }}>
                {delta.anomalies.map((ano, idx) => (
                  <li key={idx}>
                    <strong>{ano.name}:</strong> {ano.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 2. Top 5 KPI Cards (Omset Bersih, HPP Riil, Waste, OPEX, Laba Bersih) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        {/* Card 1: Omset Bersih */}
        <div
          className="card"
          onClick={() => handleCardClick('REVENUE')}
          style={{
            padding: 16,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            position: 'relative',
            cursor: 'pointer',
            transition: 'transform 0.2s, boxShadow 0.2s',
          }}
          title="Klik untuk melihat rincian transaksi omset"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Omset Bersih (Net)
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: -0.5, marginBottom: 4 }}>
            {rupiah(rev.net_sales)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span>Kotor: {rupiah(rev.gross_sales)}</span>
            <span>{rev.transaction_count} pesanan</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, flexWrap: 'wrap', marginTop: 4 }}>
            <span
              onClick={(e) => { e.stopPropagation(); handleCardClick('REVENUE', 'GENERATE'); }}
              style={{ color: '#06b6d4', fontWeight: 700, cursor: 'pointer', padding: '1px 6px', borderRadius: 4, background: 'rgba(6,182,212,0.12)' }}
              title="Klik rincian Nota Generate"
            >
              Gen: {rupiah(genBd.net_sales)} ({genBd.share_pct}%)
            </span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <span
              onClick={(e) => { e.stopPropagation(); handleCardClick('REVENUE', 'MANUAL'); }}
              style={{ color: '#f59e0b', fontWeight: 700, cursor: 'pointer', padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.12)' }}
              title="Klik rincian Nota Manual"
            >
              Manual: {rupiah(manBd.net_sales)} ({manBd.share_pct}%)
            </span>
            {Number(rev.total_discount || 0) > 0 && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                <span
                  onClick={(e) => { e.stopPropagation(); handleCardClick('DISCOUNT'); }}
                  style={{ color: '#fb7185', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                  title="Klik rincian diskon"
                >
                  Diskon: ({rupiah(rev.total_discount)})
                </span>
              </>
            )}
          </div>
          <div style={{ fontSize: 10, color: '#34d399', fontWeight: 600, marginTop: 4 }}>
            Lihat rincian transaksi →
          </div>
          {renderDeltaBadge(delta?.revenue?.net_sales)}
        </div>

        {/* Card 2: HPP Riil (COGS) */}
        <div
          className="card"
          onClick={() => handleCardClick('COGS')}
          style={{
            padding: 16,
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            position: 'relative',
            cursor: 'pointer',
            transition: 'transform 0.2s, boxShadow 0.2s',
          }}
          title="Klik untuk melihat rincian HPP resep & susut opname"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              HPP Riil (COGS)
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: -0.5, marginBottom: 4 }}>
            {rupiah(cogs.total_cogs)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: cogs.cogs_ratio_pct <= 35 ? '#34d399' : '#f59e0b', fontWeight: 600 }}>
              Rasio: {cogs.cogs_ratio_pct}%
            </span>
            <span>Resep + Susut Opname</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, flexWrap: 'wrap', marginTop: 4 }}>
            <span
              onClick={(e) => { e.stopPropagation(); setNotaTypeFilter('GENERATE'); }}
              style={{ color: '#06b6d4', fontWeight: 700, cursor: 'pointer', padding: '1px 6px', borderRadius: 4, background: 'rgba(6,182,212,0.12)' }}
              title="HPP dari transaksi Generate"
            >
              Gen: {rupiah(genBd.cogs)} ({genBd.cogs_ratio_pct}%)
            </span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <span
              onClick={(e) => { e.stopPropagation(); setNotaTypeFilter('MANUAL'); }}
              style={{ color: '#f59e0b', fontWeight: 700, cursor: 'pointer', padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.12)' }}
              title="HPP dari transaksi Manual"
            >
              Manual: {rupiah(manBd.cogs)} ({manBd.cogs_ratio_pct}%)
            </span>
          </div>
          <div style={{ fontSize: 10, color: '#818cf8', fontWeight: 600, marginTop: 4 }}>
            Lihat rincian bahan terpakai →
          </div>
          {renderDeltaBadge(delta?.cogs?.total_cogs)}
        </div>

        {/* Card 3: Kerugian Waste */}
        <div
          className="card"
          onClick={() => handleCardClick('WASTE')}
          style={{
            padding: 16,
            background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            position: 'relative',
            cursor: 'pointer',
            transition: 'transform 0.2s, boxShadow 0.2s',
          }}
          title="Klik untuk melihat rincian log waste"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fb7185', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Kerugian Waste
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: -0.5, marginBottom: 4 }}>
            {rupiah(wst.total_waste_loss)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: wst.waste_ratio_pct < 2 ? '#34d399' : '#f43f5e', fontWeight: 600 }}>
              Rasio: {wst.waste_ratio_pct}%
            </span>
            <span>{wst.total_records || 0} log kejadian</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, flexWrap: 'wrap', marginTop: 4 }}>
            <span
              onClick={(e) => { e.stopPropagation(); setNotaTypeFilter('GENERATE'); }}
              style={{ color: '#06b6d4', fontWeight: 700, cursor: 'pointer', padding: '1px 6px', borderRadius: 4, background: 'rgba(6,182,212,0.12)' }}
              title="Alokasi Waste Nota Generate"
            >
              Gen: {rupiah(genBd.waste)}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <span
              onClick={(e) => { e.stopPropagation(); setNotaTypeFilter('MANUAL'); }}
              style={{ color: '#f59e0b', fontWeight: 700, cursor: 'pointer', padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.12)' }}
              title="Alokasi Waste Nota Manual"
            >
              Manual: {rupiah(manBd.waste)}
            </span>
          </div>
          <div style={{ fontSize: 10, color: '#fb7185', fontWeight: 600, marginTop: 4 }}>
            Lihat rincian log waste →
          </div>
          {renderDeltaBadge(delta?.waste?.total_waste_loss)}
        </div>

        {/* Card 4: Beban Operasional (OPEX) */}
        <div
          className="card"
          onClick={() => handleCardClick('OPEX')}
          style={{
            padding: 16,
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            position: 'relative',
            cursor: 'pointer',
            transition: 'transform 0.2s, boxShadow 0.2s',
          }}
          title="Klik untuk melihat rincian OPEX"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Beban Toko (OPEX)
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: -0.5, marginBottom: 4 }}>
            {rupiah(opx.total_opex)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#fbbf24', fontWeight: 600 }}>
              Rasio: {opx.opex_ratio_pct}%
            </span>
            <span>{opx.total_records || 0} pos biaya</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, flexWrap: 'wrap', marginTop: 4 }}>
            <span
              onClick={(e) => { e.stopPropagation(); setNotaTypeFilter('GENERATE'); }}
              style={{ color: '#06b6d4', fontWeight: 700, cursor: 'pointer', padding: '1px 6px', borderRadius: 4, background: 'rgba(6,182,212,0.12)' }}
              title="Alokasi Beban OPEX Nota Generate"
            >
              Gen: {rupiah(genBd.opex)}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <span
              onClick={(e) => { e.stopPropagation(); setNotaTypeFilter('MANUAL'); }}
              style={{ color: '#f59e0b', fontWeight: 700, cursor: 'pointer', padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.12)' }}
              title="Alokasi Beban OPEX Nota Manual"
            >
              Manual: {rupiah(manBd.opex)}
            </span>
          </div>
          <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 600, marginTop: 4 }}>
            Lihat rincian pos biaya OPEX →
          </div>
          {renderDeltaBadge(delta?.opex?.total_opex)}
        </div>

        {/* Card 5: Laba Bersih Usaha (Net Profit) */}
        <div
          className="card"
          onClick={() => handleCardClick('NET_PROFIT')}
          style={{
            padding: 16,
            background: `linear-gradient(135deg, ${bot.health_color}18 0%, rgba(15, 23, 42, 0.9) 100%)`,
            border: `1.5px solid ${bot.health_color}45`,
            position: 'relative',
            boxShadow: `0 8px 25px ${bot.health_color}1a`,
            cursor: 'pointer',
            transition: 'transform 0.2s, boxShadow 0.2s',
          }}
          title="Klik untuk melihat formula laba bersih"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: bot.health_color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Laba Bersih Usaha
            </span>
            <div
              style={{
                padding: '2px 8px',
                borderRadius: 20,
                fontSize: 10,
                fontWeight: 800,
                background: `${bot.health_color}25`,
                color: bot.health_color,
                border: `1px solid ${bot.health_color}40`,
              }}
            >
              {bot.health_status}
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: bot.net_profit >= 0 ? '#ffffff' : '#f43f5e', letterSpacing: -0.5, marginBottom: 4 }}>
            {rupiah(bot.net_profit)}
          </div>
          <div style={{ fontSize: 11.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: bot.health_color, fontWeight: 700 }}>
              Net Margin: {bot.net_margin_pct}%
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{bot.health_label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, flexWrap: 'wrap', marginTop: 4 }}>
            <span
              onClick={(e) => { e.stopPropagation(); setNotaTypeFilter('GENERATE'); }}
              style={{ color: genBd.net_profit >= 0 ? '#06b6d4' : '#f87171', fontWeight: 700, cursor: 'pointer', padding: '1px 6px', borderRadius: 4, background: 'rgba(6,182,212,0.12)' }}
              title="Laba Bersih dari Nota Generate"
            >
              Gen: {rupiah(genBd.net_profit)} ({genBd.net_margin_pct}%)
            </span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <span
              onClick={(e) => { e.stopPropagation(); setNotaTypeFilter('MANUAL'); }}
              style={{ color: manBd.net_profit >= 0 ? '#fbbf24' : '#f87171', fontWeight: 700, cursor: 'pointer', padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.12)' }}
              title="Laba Bersih dari Nota Manual"
            >
              Manual: {rupiah(manBd.net_profit)} ({manBd.net_margin_pct}%)
            </span>
          </div>
          <div style={{ fontSize: 10, color: bot.health_color, fontWeight: 600, marginTop: 4 }}>
            Lihat rincian formula laba bersih →
          </div>
          {renderDeltaBadge(delta?.bottom_line?.net_profit)}
        </div>
      </div>

      {/* 3. Visual Cash Flow Waterfall Breakdown Bar */}
      <div
        className="card mb-4"
        style={{
          padding: '16px 20px',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(165, 180, 252, 0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} color="#38bdf8" />
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
              Aliran Konversi Omset ke Laba Bersih (Waterfall Breakdown)
            </h4>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Dari setiap Rp 100.000 omset masuk, tersisa <strong>{rupiah((bot.net_margin_pct / 100) * 100000)}</strong> sebagai laba bersih
          </span>
        </div>

        {/* Multi-segment Progress Bar */}
        <div
          style={{
            height: 18,
            borderRadius: 9,
            background: 'rgba(255, 255, 255, 0.06)',
            display: 'flex',
            overflow: 'hidden',
            marginBottom: 12,
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {rev.net_sales > 0 && (
            <>
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, cogs.cogs_ratio_pct))}%`,
                  background: '#6366f1',
                  transition: 'width 0.4s ease',
                }}
                title={`HPP Riil: ${cogs.cogs_ratio_pct}% (${rupiah(cogs.total_cogs)})`}
              />
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, wst.waste_ratio_pct))}%`,
                  background: '#f43f5e',
                  transition: 'width 0.4s ease',
                }}
                title={`Kerugian Waste: ${wst.waste_ratio_pct}% (${rupiah(wst.total_waste_loss)})`}
              />
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, opx.opex_ratio_pct))}%`,
                  background: '#f59e0b',
                  transition: 'width 0.4s ease',
                }}
                title={`Beban OPEX: ${opx.opex_ratio_pct}% (${rupiah(opx.total_opex)})`}
              />
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, bot.net_margin_pct))}%`,
                  background: '#10b981',
                  transition: 'width 0.4s ease',
                }}
                title={`Laba Bersih: ${bot.net_margin_pct}% (${rupiah(bot.net_profit)})`}
              />
            </>
          )}
        </div>

        {/* Legend Chips */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#6366f1', display: 'inline-block' }} />
            <span style={{ color: 'var(--text-muted)' }}>HPP Riil:</span>
            <strong style={{ color: '#c7d2fe' }}>{cogs.cogs_ratio_pct}%</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f43f5e', display: 'inline-block' }} />
            <span style={{ color: 'var(--text-muted)' }}>Kerugian Waste:</span>
            <strong style={{ color: '#fecdd3' }}>{wst.waste_ratio_pct}%</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} />
            <span style={{ color: 'var(--text-muted)' }}>Beban Toko (OPEX):</span>
            <strong style={{ color: '#fef3c7' }}>{opx.opex_ratio_pct}%</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} />
            <span style={{ color: 'var(--text-muted)' }}>Laba Bersih Usaha:</span>
            <strong style={{ color: '#a7f3d0' }}>{bot.net_margin_pct}%</strong>
          </div>
        </div>
      </div>

      {/* 4. Tab Navigation */}
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
          <Landmark size={16} />
          {isComp ? 'Laporan Laba Rugi Komparasi (Comparative P&L)' : 'Laporan Laba Rugi Formal (Income Statement)'}
        </button>
        <button
          className={`btn ${activeTab === 'expenses' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('expenses')}
          style={{
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
          }}
        >
          <Building2 size={16} /> Beban Operasional Toko (OPEX)
          <span
            style={{
              padding: '2px 7px',
              borderRadius: 12,
              fontSize: 11,
              background: activeTab === 'expenses' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
            }}
          >
            {expenses.length}
          </span>
        </button>
        <button
          className={`btn ${activeTab === 'benchmark' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => {
            setActiveTab('benchmark');
            if (!benchmarkData) fetchBenchmark();
          }}
          style={{
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
          }}
        >
          <BarChart3 size={16} /> Benchmark Antar Cabang
          {benchmarkData?.outlets && (
            <span
              style={{
                padding: '2px 7px',
                borderRadius: 12,
                fontSize: 11,
                background: activeTab === 'benchmark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              }}
            >
              {benchmarkData.outlets.length} Cabang
            </span>
          )}
        </button>
      </div>

      {/* 5. TAB 1: FORMAL / COMPARATIVE P&L STATEMENT VIEW */}
      {activeTab === 'statement' && (
        <div className="card" style={{ padding: 24, background: 'rgba(15, 23, 42, 0.85)' }}>
          {/* Statement Header */}
          <div style={{ borderBottom: '2px solid rgba(165, 180, 252, 0.2)', paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                  {businessTitle}
                </h2>
                <div style={{ fontSize: 13, color: '#38bdf8', fontWeight: 600, marginTop: 2 }}>
                  {isComp ? 'LAPORAN LABA RUGI KOMPARASI DUA PERIODE' : 'LAPORAN LABA RUGI KOMPREHENSIF (INCOME STATEMENT)'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Cabang: <strong>{outletTitle}</strong> &nbsp;|&nbsp; Periode: <strong>{dateFrom}</strong> s/d <strong>{dateTo}</strong>
                  {isComp && comparePeriod && (
                    <span style={{ color: '#818cf8', marginLeft: 8 }}>
                      (vs <strong>{comparePeriod.from}</strong> s/d <strong>{comparePeriod.to}</strong>)
                    </span>
                  )}
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
                    background: `${bot.health_color}20`,
                    color: bot.health_color,
                    border: `1px solid ${bot.health_color}40`,
                  }}
                >
                  Status Usaha: {bot.health_label}
                </span>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Mata Uang: IDR (Rupiah)
                </div>
              </div>
            </div>
          </div>

          {/* Statement Table Structure */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Filter Scope Notice Banner if filtered */}
            {notaTypeFilter !== 'ALL' && (
              <div
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  background: notaTypeFilter === 'GENERATE' ? 'rgba(6, 182, 212, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  border: notaTypeFilter === 'GENERATE' ? '1px solid rgba(6, 182, 212, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  fontSize: 12.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Info size={16} color={notaTypeFilter === 'GENERATE' ? '#06b6d4' : '#f59e0b'} />
                  <span>
                    Sedang menampilkan laporan P&L terfokus khusus untuk{' '}
                    <strong style={{ color: notaTypeFilter === 'GENERATE' ? '#38bdf8' : '#fbbf24' }}>
                      {notaTypeFilter === 'GENERATE' ? 'Nota Generate (Kasir POS Standar)' : 'Nota Manual (Nota Urgent / Tergantung)'}
                    </strong>.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setNotaTypeFilter('ALL')}
                  style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 6, fontWeight: 700 }}
                >
                  Tampilkan Semua Nota (Gabungan)
                </button>
              </div>
            )}

            {/* Split Comparison Matrix: Nota Generate vs Nota Manual vs Total Gabungan */}
            <div
              className="card"
              style={{
                padding: '18px 22px',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(165, 180, 252, 0.2)',
                borderRadius: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ padding: 8, borderRadius: 10, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    <Layers size={18} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
                      Pemisahan Kinerja Keuangan: Nota Generate vs Nota Manual vs Total Gabungan
                    </h4>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      Analisis terpisah omset, HPP, beban operasional, dan laba bersih riil antara transaksi POS otomatis vs nota manual urgent.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: 12,
                      background: notaTypeFilter === 'ALL'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : notaTypeFilter === 'GENERATE'
                        ? 'rgba(6, 182, 212, 0.15)'
                        : 'rgba(245, 158, 11, 0.15)',
                      color: notaTypeFilter === 'ALL'
                        ? '#34d399'
                        : notaTypeFilter === 'GENERATE'
                        ? '#38bdf8'
                        : '#fbbf24',
                      border: '1px solid currentColor',
                    }}
                  >
                    Filter Aktif: {notaTypeFilter === 'ALL' ? 'Semua Nota (Gabungan)' : notaTypeFilter === 'GENERATE' ? 'Nota Generate' : 'Nota Manual'}
                  </span>
                </div>
              </div>

              {/* 3 Overview Column Cards (Generate, Manual, Gabungan) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 18 }}>
                {/* Column 1: Nota Generate */}
                <div
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(15, 23, 42, 0.85) 100%)',
                    border: notaTypeFilter === 'GENERATE' ? '2px solid #06b6d4' : '1px solid rgba(6, 182, 212, 0.3)',
                    boxShadow: notaTypeFilter === 'GENERATE' ? '0 0 20px rgba(6, 182, 212, 0.25)' : undefined,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 800, background: 'rgba(6, 182, 212, 0.2)', color: '#06b6d4' }}>
                      Nota Generate
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#38bdf8' }}>
                      {genBd.share_pct}% Omset
                    </span>
                  </div>

                  <div style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', marginBottom: 2 }}>
                    {rupiah(genBd.net_sales)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                    {genBd.transaction_count} pesanan · Rata-rata {rupiah(genBd.avg_order_value)}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>HPP Riil:</span>
                      <strong style={{ color: '#818cf8' }}>{rupiah(genBd.cogs)} ({genBd.cogs_ratio_pct}%)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Laba Kotor:</span>
                      <strong style={{ color: '#34d399' }}>{rupiah(genBd.gross_profit)} ({genBd.gross_margin_pct}%)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Waste & OPEX:</span>
                      <strong style={{ color: '#fbbf24' }}>{rupiah(genBd.waste + genBd.opex)}</strong>
                    </div>
                    <div style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#f8fafc', fontWeight: 700 }}>Laba Bersih:</span>
                      <strong style={{ color: genBd.net_profit >= 0 ? '#38bdf8' : '#f87171', fontSize: 12 }}>
                        {rupiah(genBd.net_profit)} ({genBd.net_margin_pct}%)
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleCardClick('REVENUE', 'GENERATE')}
                      style={{ flex: 1, fontSize: 11, padding: '4px 8px', borderRadius: 6, color: '#06b6d4', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.25)' }}
                    >
                      Rincian
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${notaTypeFilter === 'GENERATE' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setNotaTypeFilter(notaTypeFilter === 'GENERATE' ? 'ALL' : 'GENERATE')}
                      style={{ flex: 1.3, fontSize: 11, padding: '4px 8px', borderRadius: 6, fontWeight: 700 }}
                    >
                      {notaTypeFilter === 'GENERATE' ? '✓ Sedang Aktif' : 'Filter Tampilan'}
                    </button>
                  </div>
                </div>

                {/* Column 2: Nota Manual */}
                <div
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.85) 100%)',
                    border: notaTypeFilter === 'MANUAL' ? '2px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.3)',
                    boxShadow: notaTypeFilter === 'MANUAL' ? '0 0 20px rgba(245, 158, 11, 0.25)' : undefined,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 800, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
                      Nota Manual
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#fbbf24' }}>
                      {manBd.share_pct}% Omset
                    </span>
                  </div>

                  <div style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', marginBottom: 2 }}>
                    {rupiah(manBd.net_sales)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                    {manBd.transaction_count} pesanan · Rata-rata {rupiah(manBd.avg_order_value)}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>HPP Riil:</span>
                      <strong style={{ color: '#818cf8' }}>{rupiah(manBd.cogs)} ({manBd.cogs_ratio_pct}%)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Laba Kotor:</span>
                      <strong style={{ color: '#34d399' }}>{rupiah(manBd.gross_profit)} ({manBd.gross_margin_pct}%)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Waste & OPEX:</span>
                      <strong style={{ color: '#fbbf24' }}>{rupiah(manBd.waste + manBd.opex)}</strong>
                    </div>
                    <div style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#f8fafc', fontWeight: 700 }}>Laba Bersih:</span>
                      <strong style={{ color: manBd.net_profit >= 0 ? '#fbbf24' : '#f87171', fontSize: 12 }}>
                        {rupiah(manBd.net_profit)} ({manBd.net_margin_pct}%)
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleCardClick('REVENUE', 'MANUAL')}
                      style={{ flex: 1, fontSize: 11, padding: '4px 8px', borderRadius: 6, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)' }}
                    >
                      Rincian
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${notaTypeFilter === 'MANUAL' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setNotaTypeFilter(notaTypeFilter === 'MANUAL' ? 'ALL' : 'MANUAL')}
                      style={{ flex: 1.3, fontSize: 11, padding: '4px 8px', borderRadius: 6, fontWeight: 700 }}
                    >
                      {notaTypeFilter === 'MANUAL' ? '✓ Sedang Aktif' : 'Filter Tampilan'}
                    </button>
                  </div>
                </div>

                {/* Column 3: Total Gabungan */}
                <div
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.85) 100%)',
                    border: notaTypeFilter === 'ALL' ? '2px solid #10b981' : '1px solid rgba(16, 185, 129, 0.3)',
                    boxShadow: notaTypeFilter === 'ALL' ? '0 0 20px rgba(16, 185, 129, 0.25)' : undefined,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 800, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
                      Total Gabungan
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#34d399' }}>
                      100% Seluruh Usaha
                    </span>
                  </div>

                  <div style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', marginBottom: 2 }}>
                    {rupiah(combBd.net_sales)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                    {combBd.transaction_count} pesanan · Rata-rata {rupiah(combBd.avg_order_value)}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Total HPP:</span>
                      <strong style={{ color: '#818cf8' }}>{rupiah(combBd.cogs)} ({combBd.cogs_ratio_pct}%)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Laba Kotor:</span>
                      <strong style={{ color: '#34d399' }}>{rupiah(combBd.gross_profit)} ({combBd.gross_margin_pct}%)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Waste & OPEX:</span>
                      <strong style={{ color: '#fbbf24' }}>{rupiah(combBd.waste + combBd.opex)}</strong>
                    </div>
                    <div style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#f8fafc', fontWeight: 700 }}>Laba Bersih:</span>
                      <strong style={{ color: combBd.net_profit >= 0 ? '#34d399' : '#f87171', fontSize: 12 }}>
                        {rupiah(combBd.net_profit)} ({combBd.net_margin_pct}%)
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleCardClick('REVENUE')}
                      style={{ flex: 1, fontSize: 11, padding: '4px 8px', borderRadius: 6, color: '#34d399', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)' }}
                    >
                      Rincian
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${notaTypeFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setNotaTypeFilter('ALL')}
                      style={{ flex: 1.3, fontSize: 11, padding: '4px 8px', borderRadius: 6, fontWeight: 700 }}
                    >
                      {notaTypeFilter === 'ALL' ? '✓ Sedang Aktif' : 'Tampilkan Gabungan'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Comprehensive 3-Column Comparison Table */}
              <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid rgba(255,255,255,0.12)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 12px' }}>Komponen Finansial</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: '#38bdf8' }}>Nota Generate</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: '#fbbf24' }}>Nota Manual</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: '#34d399', fontWeight: 800 }}>Total Gabungan</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '7px 12px', color: '#cbd5e1' }}>Penjualan Kotor (Gross Sales)</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#e2e8f0' }}>{rupiah(genBd.gross_sales)}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#e2e8f0' }}>{rupiah(manBd.gross_sales)}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#f8fafc' }}>{rupiah(combBd.gross_sales)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '7px 12px', color: '#cbd5e1' }}>Diskon & Promosi</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: genBd.discount > 0 ? '#f87171' : 'var(--text-muted)' }}>{genBd.discount > 0 ? `-${rupiah(genBd.discount)}` : 'Rp 0'}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: manBd.discount > 0 ? '#f87171' : 'var(--text-muted)' }}>{manBd.discount > 0 ? `-${rupiah(manBd.discount)}` : 'Rp 0'}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: combBd.discount > 0 ? '#f87171' : 'var(--text-muted)' }}>{combBd.discount > 0 ? `-${rupiah(combBd.discount)}` : 'Rp 0'}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#ffffff' }}>Omset Bersih (Net Revenue)</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>{rupiah(genBd.net_sales)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#fbbf24' }}>{rupiah(manBd.net_sales)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#34d399' }}>{rupiah(combBd.net_sales)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '7px 12px', color: '#cbd5e1' }}>HPP Riil (COGS)</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#818cf8' }}>{rupiah(genBd.cogs)} ({genBd.cogs_ratio_pct}%)</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#818cf8' }}>{rupiah(manBd.cogs)} ({manBd.cogs_ratio_pct}%)</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#818cf8' }}>{rupiah(combBd.cogs)} ({combBd.cogs_ratio_pct}%)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '7px 12px', color: '#cbd5e1' }}>Laba Kotor (Gross Profit)</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#34d399' }}>{rupiah(genBd.gross_profit)} ({genBd.gross_margin_pct}%)</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#34d399' }}>{rupiah(manBd.gross_profit)} ({manBd.gross_margin_pct}%)</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#34d399' }}>{rupiah(combBd.gross_profit)} ({combBd.gross_margin_pct}%)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '7px 12px', color: '#cbd5e1' }}>Kerugian Waste</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#fb7185' }}>{rupiah(genBd.waste)}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#fb7185' }}>{rupiah(manBd.waste)}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#fb7185' }}>{rupiah(combBd.waste)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <td style={{ padding: '7px 12px', color: '#cbd5e1' }}>Beban Operasional (OPEX)</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#fbbf24' }}>{rupiah(genBd.opex)}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#fbbf24' }}>{rupiah(manBd.opex)}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#fbbf24' }}>{rupiah(combBd.opex)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 800, color: '#ffffff' }}>Laba Bersih Usaha (Net Profit)</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: genBd.net_profit >= 0 ? '#38bdf8' : '#f87171' }}>
                        {rupiah(genBd.net_profit)} ({genBd.net_margin_pct}%)
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: manBd.net_profit >= 0 ? '#fbbf24' : '#f87171' }}>
                        {rupiah(manBd.net_profit)} ({manBd.net_margin_pct}%)
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 900, color: combBd.net_profit >= 0 ? '#34d399' : '#f87171', fontSize: 13 }}>
                        {rupiah(combBd.net_profit)} ({combBd.net_margin_pct}%)
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '7px 12px', color: 'var(--text-muted)' }}>Jumlah Pesanan & AOV</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{genBd.transaction_count} nota · {rupiah(genBd.avg_order_value)}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{manBd.transaction_count} nota · {rupiah(manBd.avg_order_value)}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>{combBd.transaction_count} nota · {rupiah(combBd.avg_order_value)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table Header row when Comparison is active */}
            {isComp && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                  gap: 8,
                  padding: '8px 18px',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.04)',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div>URAIAN POS KEUANGAN</div>
                <div style={{ textAlign: 'right' }}>PERIODE SAAT INI</div>
                <div style={{ textAlign: 'right' }}>PERIODE PEMBANDING</div>
                <div style={{ textAlign: 'right' }}>SELISIH (Δ RP)</div>
                <div style={{ textAlign: 'right' }}>DELTA (%)</div>
              </div>
            )}

            {/* POS I: REVENUE */}
            <div
              className="card"
              onClick={() => handleCardClick('REVENUE')}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 10,
                padding: '14px 18px',
                border: '1px solid rgba(52, 211, 153, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Klik untuk melihat rincian transaksi omset penjualan"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#34d399', letterSpacing: 0.5 }}>
                    1. PENDAPATAN OPERASIONAL USAHA (REVENUE)
                  </span>
                </div>
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
                    onClick={(e) => { e.stopPropagation(); handleCardClick('REVENUE'); }}
                  >
                    <Search size={12} /> Rincian Transaksi
                  </button>
                  {!isComp && (
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#34d399' }}>
                      {rupiah(rev.net_sales)}
                    </span>
                  )}
                </div>
              </div>

              {isComp ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  {/* Nota Generate */}
                  <div
                    onClick={(e) => { e.stopPropagation(); handleCardClick('REVENUE', 'GENERATE'); }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                      gap: 8,
                      padding: '6px 6px',
                      borderBottom: '1px dashed rgba(255, 255, 255, 0.06)',
                      cursor: 'pointer',
                      borderRadius: 6,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(6, 182, 212, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    title="Klik untuk melihat rincian transaksi Nota Generate"
                  >
                    <div style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', fontSize: 10.5, fontWeight: 700 }}>
                        Generate
                      </span>
                      <span>Penjualan Nota Generate (POS Standar)</span>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 600, color: '#38bdf8' }}>{rupiah(rev.nota_generate?.net_sales)}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{rupiah(prev?.revenue?.nota_generate?.net_sales)}</div>
                    <div style={{ textAlign: 'right', color: delta?.revenue?.nota_generate_net?.diff_nominal >= 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>
                      {delta?.revenue?.nota_generate_net?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.revenue?.nota_generate_net?.diff_nominal)}
                    </div>
                    <div style={{ textAlign: 'right', color: delta?.revenue?.nota_generate_net?.diff_pct >= 0 ? '#34d399' : '#f87171', fontWeight: 700 }}>
                      {delta?.revenue?.nota_generate_net?.diff_pct >= 0 ? '+' : ''}{delta?.revenue?.nota_generate_net?.diff_pct}%
                    </div>
                  </div>

                  {/* Nota Manual */}
                  <div
                    onClick={(e) => { e.stopPropagation(); handleCardClick('REVENUE', 'MANUAL'); }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                      gap: 8,
                      padding: '6px 6px',
                      borderBottom: '1px dashed rgba(255, 255, 255, 0.06)',
                      cursor: 'pointer',
                      borderRadius: 6,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    title="Klik untuk melihat rincian transaksi Nota Manual (Urgent)"
                  >
                    <div style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: 10.5, fontWeight: 700 }}>
                        Manual
                      </span>
                      <span>Penjualan Nota Manual (Nota Urgent)</span>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 600, color: '#fbbf24' }}>{rupiah(rev.nota_manual?.net_sales)}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{rupiah(prev?.revenue?.nota_manual?.net_sales)}</div>
                    <div style={{ textAlign: 'right', color: delta?.revenue?.nota_manual_net?.diff_nominal >= 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>
                      {delta?.revenue?.nota_manual_net?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.revenue?.nota_manual_net?.diff_nominal)}
                    </div>
                    <div style={{ textAlign: 'right', color: delta?.revenue?.nota_manual_net?.diff_pct >= 0 ? '#34d399' : '#f87171', fontWeight: 700 }}>
                      {delta?.revenue?.nota_manual_net?.diff_pct >= 0 ? '+' : ''}{delta?.revenue?.nota_manual_net?.diff_pct}%
                    </div>
                  </div>

                  {/* Penjualan Kotor */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: '6px 6px', borderBottom: '1px dashed rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ color: '#94a3b8', fontSize: 12.5 }}>Total Penjualan Kotor (Gross Sales)</div>
                    <div style={{ textAlign: 'right', fontWeight: 600 }}>{rupiah(rev.gross_sales)}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{rupiah(prev?.revenue?.gross_sales)}</div>
                    <div style={{ textAlign: 'right', color: delta?.revenue?.gross_sales?.diff_nominal >= 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>
                      {delta?.revenue?.gross_sales?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.revenue?.gross_sales?.diff_nominal)}
                    </div>
                    <div style={{ textAlign: 'right', color: delta?.revenue?.gross_sales?.diff_pct >= 0 ? '#34d399' : '#f87171', fontWeight: 700 }}>
                      {delta?.revenue?.gross_sales?.diff_pct >= 0 ? '+' : ''}{delta?.revenue?.gross_sales?.diff_pct}%
                    </div>
                  </div>

                  {/* Diskon Row - CLICKABLE */}
                  <div
                    onClick={(e) => { e.stopPropagation(); handleCardClick('DISCOUNT'); }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                      gap: 8,
                      padding: '7px 6px',
                      borderBottom: '1px dashed rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                      borderRadius: 6,
                      background: 'rgba(244, 63, 94, 0.06)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(244, 63, 94, 0.14)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(244, 63, 94, 0.06)'}
                    title="Klik untuk melihat hanya rincian diskon & voucher promo"
                  >
                    <div style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(244, 63, 94, 0.2)', fontSize: 10.5, fontWeight: 700 }}>Diskon</span>
                      <span>Dikurangi: Total Diskon Kasir & Promo</span>
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(244, 63, 94, 0.25)', color: '#fecdd3', fontWeight: 700 }}>
                        Lihat rincian →
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 700, color: '#f87171' }}>({rupiah(rev.total_discount)})</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>({rupiah(prev?.revenue?.total_discount)})</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {delta?.revenue?.total_discount?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.revenue?.total_discount?.diff_nominal)}
                    </div>
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {delta?.revenue?.total_discount?.diff_pct >= 0 ? '+' : ''}{delta?.revenue?.total_discount?.diff_pct}%
                    </div>
                  </div>

                  {/* Omset Bersih */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: '8px 6px 4px', fontWeight: 800, color: '#34d399', fontSize: 13.5 }}>
                    <div>TOTAL OMSET BERSIH (NET REVENUE)</div>
                    <div style={{ textAlign: 'right' }}>{rupiah(rev.net_sales)}</div>
                    <div style={{ textAlign: 'right', color: '#cbd5e1' }}>{rupiah(prev?.revenue?.net_sales)}</div>
                    <div style={{ textAlign: 'right', color: delta?.revenue?.net_sales?.diff_nominal >= 0 ? '#34d399' : '#f87171' }}>
                      {delta?.revenue?.net_sales?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.revenue?.net_sales?.diff_nominal)}
                    </div>
                    <div style={{ textAlign: 'right', color: delta?.revenue?.net_sales?.diff_pct >= 0 ? '#34d399' : '#f87171' }}>
                      {delta?.revenue?.net_sales?.diff_pct >= 0 ? '+' : ''}{delta?.revenue?.net_sales?.diff_pct}%
                    </div>
                  </div>
                </div>
              ) : (
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <tbody>
                    {/* Nota Generate */}
                    <tr
                      onClick={(e) => { e.stopPropagation(); handleCardClick('REVENUE', 'GENERATE'); }}
                      style={{
                        borderBottom: '1px dashed rgba(255, 255, 255, 0.06)',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(6, 182, 212, 0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      title="Klik untuk melihat rincian Nota Generate"
                    >
                      <td style={{ padding: '7px 6px', color: '#cbd5e1' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ padding: '2px 7px', borderRadius: 4, background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', fontSize: 11, fontWeight: 700 }}>
                            Nota Generate
                          </span>
                          <span>Penjualan Kasir POS Standar ({notaGen.transaction_count} pesanan)</span>
                          <span style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 4, background: 'rgba(6, 182, 212, 0.2)', color: '#38bdf8', fontWeight: 700 }}>
                            {notaGen.share_pct}% omset
                          </span>
                          {notaTypeFilter === 'GENERATE' && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#0284c7', color: '#ffffff', fontWeight: 800 }}>
                              ✓ AKTIF
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>
                        {rupiah(notaGen.net_sales)}
                      </td>
                    </tr>

                    {/* Nota Manual */}
                    <tr
                      onClick={(e) => { e.stopPropagation(); handleCardClick('REVENUE', 'MANUAL'); }}
                      style={{
                        borderBottom: '1px dashed rgba(255, 255, 255, 0.06)',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      title="Klik untuk melihat rincian Nota Manual (Urgent)"
                    >
                      <td style={{ padding: '7px 6px', color: '#cbd5e1' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ padding: '2px 7px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: 11, fontWeight: 700 }}>
                            Nota Manual
                          </span>
                          <span>Penjualan Nota Urgent / Tergantung ({notaMan.transaction_count} pesanan)</span>
                          <span style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontWeight: 700 }}>
                            {notaMan.share_pct}% omset
                          </span>
                          {notaTypeFilter === 'MANUAL' && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#d97706', color: '#ffffff', fontWeight: 800 }}>
                              ✓ AKTIF
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 700, color: '#fbbf24' }}>
                        {rupiah(notaMan.net_sales)}
                      </td>
                    </tr>

                    {/* Total Gross Sales */}
                    <tr style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.06)' }}>
                      <td style={{ padding: '6px 6px', color: '#94a3b8', fontSize: 12.5 }}>
                        Total Penjualan Kotor (Gross Sales dari {rev.transaction_count} transaksi)
                      </td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 600, color: '#f8fafc' }}>
                        {rupiah(rev.gross_sales)}
                      </td>
                    </tr>

                    {/* Total Diskon Kasir & Promo - CLICKABLE */}
                    <tr
                      onClick={(e) => { e.stopPropagation(); handleCardClick('DISCOUNT'); }}
                      style={{
                        borderBottom: '1px dashed rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer',
                        background: 'rgba(244, 63, 94, 0.06)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(244, 63, 94, 0.14)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(244, 63, 94, 0.06)'}
                      title="Klik untuk melihat hanya rincian diskon & voucher promo"
                    >
                      <td style={{ padding: '7px 6px', color: '#f87171' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ padding: '2px 7px', borderRadius: 4, background: 'rgba(244, 63, 94, 0.2)', color: '#fb7185', fontSize: 11, fontWeight: 700 }}>
                            Diskon
                          </span>
                          <span>
                            <em>Dikurangi:</em> Total Diskon Kasir & Voucher Promo
                          </span>
                          <span style={{ fontSize: 10.5, padding: '1px 8px', borderRadius: 10, background: 'rgba(244, 63, 94, 0.25)', color: '#fecdd3', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            Lihat rincian →
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 700, color: '#f87171' }}>
                        ({rupiah(rev.total_discount)})
                      </td>
                    </tr>

                    {/* Total Net Revenue */}
                    <tr style={{ fontWeight: 700, color: '#34d399' }}>
                      <td style={{ padding: '10px 6px 4px', fontSize: 13.5 }}>OMSET BERSIH (NET REVENUE)</td>
                      <td style={{ padding: '10px 6px 4px', textAlign: 'right', fontSize: 15, fontWeight: 800 }}>
                        {rupiah(rev.net_sales)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* POS II: COGS (HPP RIIL) */}
            <div
              className="card"
              onClick={() => handleCardClick('COGS')}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 10,
                padding: '14px 18px',
                border: '1px solid rgba(129, 140, 248, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Klik untuk melihat rincian HPP Resep & Susut Opname"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#818cf8', letterSpacing: 0.5 }}>
                    2. HARGA POKOK PENJUALAN (COGS / HPP RIIL)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="btn btn-sm"
                    style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      borderRadius: 6,
                      background: 'rgba(129, 140, 248, 0.15)',
                      color: '#818cf8',
                      border: '1px solid rgba(129, 140, 248, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontWeight: 700,
                    }}
                    onClick={(e) => { e.stopPropagation(); handleCardClick('COGS'); }}
                  >
                    <Search size={12} /> Rincian Resep & Susut
                  </button>
                  {!isComp && (
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#818cf8' }}>
                      ({rupiah(cogs.total_cogs)})
                    </span>
                  )}
                </div>
              </div>

              {isComp ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: '6px 0', borderBottom: '1px dashed rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ color: '#cbd5e1' }}>HPP Teoretis Resep Menu</div>
                    <div style={{ textAlign: 'right', fontWeight: 600 }}>{rupiah(cogs.cogs_recipes)}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{rupiah(prev?.cogs?.cogs_recipes)}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{delta?.cogs?.cogs_recipes?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.cogs?.cogs_recipes?.diff_nominal)}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{delta?.cogs?.cogs_recipes?.diff_pct >= 0 ? '+' : ''}{delta?.cogs?.cogs_recipes?.diff_pct}%</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: '6px 0', borderBottom: '1px dashed rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ color: '#cbd5e1' }}>Selisih Opname Fisik / Susut Stok</div>
                    <div style={{ textAlign: 'right', fontWeight: 600 }}>{rupiah(cogs.cogs_variance)}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{rupiah(prev?.cogs?.cogs_variance)}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{delta?.cogs?.cogs_variance?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.cogs?.cogs_variance?.diff_nominal)}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{delta?.cogs?.cogs_variance?.diff_pct >= 0 ? '+' : ''}{delta?.cogs?.cogs_variance?.diff_pct}%</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: '8px 0 4px', fontWeight: 800, color: '#818cf8', fontSize: 13.5 }}>
                    <div>TOTAL HPP RIIL (Rasio: {cogs.cogs_ratio_pct}%)</div>
                    <div style={{ textAlign: 'right' }}>({rupiah(cogs.total_cogs)})</div>
                    <div style={{ textAlign: 'right', color: '#cbd5e1' }}>({rupiah(prev?.cogs?.total_cogs)})</div>
                    <div style={{ textAlign: 'right', color: delta?.cogs?.total_cogs?.sentiment === 'GOOD' ? '#34d399' : '#f87171' }}>
                      {delta?.cogs?.total_cogs?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.cogs?.total_cogs?.diff_nominal)}
                    </div>
                    <div style={{ textAlign: 'right', color: delta?.cogs?.total_cogs?.sentiment === 'GOOD' ? '#34d399' : '#f87171' }}>
                      {delta?.cogs?.total_cogs?.diff_pct >= 0 ? '+' : ''}{delta?.cogs?.total_cogs?.diff_pct}%
                    </div>
                  </div>
                </div>
              ) : (
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.06)' }}>
                      <td style={{ padding: '6px 0', color: '#cbd5e1' }}>
                        HPP Teoretis Resep Menu (Moving Average Cost bahan baku yang dipakai kasir)
                      </td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#f8fafc' }}>
                        {rupiah(cogs.cogs_recipes)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.06)' }}>
                      <td style={{ padding: '6px 0', color: '#cbd5e1' }}>
                        Selisih Opname Fisik / Susut Stok (Inventory Shrinkage Variance)
                      </td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: cogs.cogs_variance > 0 ? '#f87171' : '#34d399' }}>
                        {cogs.cogs_variance > 0 ? `+${rupiah(cogs.cogs_variance)} (Susut)` : rupiah(cogs.cogs_variance)}
                      </td>
                    </tr>
                    <tr style={{ fontWeight: 700, color: '#818cf8' }}>
                      <td style={{ padding: '8px 0 4px' }}>TOTAL HPP RIIL (Rasio: {cogs.cogs_ratio_pct}%)</td>
                      <td style={{ padding: '8px 0 4px', textAlign: 'right' }}>({rupiah(cogs.total_cogs)})</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* SUB-TOTAL: LABA KOTOR (GROSS PROFIT) */}
            <div
              className="card"
              onClick={() => handleCardClick('GROSS_PROFIT')}
              style={{
                display: isComp ? 'grid' : 'flex',
                gridTemplateColumns: isComp ? '2fr 1fr 1fr 1fr 1fr' : undefined,
                justifyContent: isComp ? undefined : 'space-between',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                borderRadius: 8,
                background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Klik untuk melihat rincian kalkulasi Laba Kotor"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} color="#34d399" />
                <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
                  LABA KOTOR (GROSS PROFIT)
                </span>
                <span style={{ fontSize: 12, color: '#a7f3d0', fontWeight: 600 }}>
                  ({cogs.gross_margin_pct}%)
                </span>
                <span style={{ fontSize: 11, color: '#34d399', background: 'rgba(52, 211, 153, 0.15)', padding: '2px 6px', borderRadius: 4, marginLeft: 4 }}>
                  Rincian
                </span>
              </div>
              {isComp ? (
                <>
                  <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 800, color: '#34d399' }}>{rupiah(cogs.gross_profit)}</div>
                  <div style={{ textAlign: 'right', fontSize: 14, color: '#cbd5e1' }}>{rupiah(prev?.cogs?.gross_profit)}</div>
                  <div style={{ textAlign: 'right', fontWeight: 700, color: delta?.cogs?.gross_profit?.sentiment === 'GOOD' ? '#34d399' : '#f87171' }}>
                    {delta?.cogs?.gross_profit?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.cogs?.gross_profit?.diff_nominal)}
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 800, color: delta?.cogs?.gross_profit?.sentiment === 'GOOD' ? '#34d399' : '#f87171' }}>
                    {delta?.cogs?.gross_profit?.diff_pct >= 0 ? '+' : ''}{delta?.cogs?.gross_profit?.diff_pct}%
                  </div>
                </>
              ) : (
                <span style={{ fontSize: 18, fontWeight: 800, color: '#34d399' }}>
                  {rupiah(cogs.gross_profit)}
                </span>
              )}
            </div>

            {/* POS III: KERUGIAN WASTE & SPOILAGE */}
            <div
              className="card"
              onClick={() => handleCardClick('WASTE')}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 10,
                padding: '14px 18px',
                border: '1px solid rgba(251, 113, 133, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Klik untuk melihat rincian log bahan/menu terbuang (waste)"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#fb7185', letterSpacing: 0.5 }}>
                    3. KERUGIAN BAHAN TERBUANG (WASTE & SPOILAGE LOSS)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="btn btn-sm"
                    style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      borderRadius: 6,
                      background: 'rgba(251, 113, 133, 0.15)',
                      color: '#fb7185',
                      border: '1px solid rgba(251, 113, 133, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontWeight: 700,
                    }}
                    onClick={(e) => { e.stopPropagation(); handleCardClick('WASTE'); }}
                  >
                    <Search size={12} /> Log Waste
                  </button>
                  {!isComp && (
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#fb7185' }}>
                      ({rupiah(wst.total_waste_loss)})
                    </span>
                  )}
                </div>
              </div>

              {isComp ? (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: '8px 0', fontWeight: 700, color: '#fb7185', fontSize: 13 }}>
                  <div>TOTAL KERUGIAN WASTE (Rasio: {wst.waste_ratio_pct}%)</div>
                  <div style={{ textAlign: 'right' }}>({rupiah(wst.total_waste_loss)})</div>
                  <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>({rupiah(prev?.waste?.total_waste_loss)})</div>
                  <div style={{ textAlign: 'right', color: delta?.waste?.total_waste_loss?.sentiment === 'GOOD' ? '#34d399' : '#f87171' }}>
                    {delta?.waste?.total_waste_loss?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.waste?.total_waste_loss?.diff_nominal)}
                  </div>
                  <div style={{ textAlign: 'right', color: delta?.waste?.total_waste_loss?.sentiment === 'GOOD' ? '#34d399' : '#f87171' }}>
                    {delta?.waste?.total_waste_loss?.diff_pct >= 0 ? '+' : ''}{delta?.waste?.total_waste_loss?.diff_pct}%
                  </div>
                </div>
              ) : (
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <tbody>
                    {wst.breakdown && wst.breakdown.length > 0 ? (
                      wst.breakdown.map(b => (
                        <tr key={b.category} style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.06)' }}>
                          <td style={{ padding: '6px 0', color: '#cbd5e1' }}>{b.label} ({b.count} kejadian)</td>
                          <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#fca5a5' }}>({rupiah(b.total)})</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} style={{ padding: '6px 0', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Tidak ada log bahan terbuang (waste) pada periode ini ({rupiah(0)})
                        </td>
                      </tr>
                    )}
                    <tr style={{ fontWeight: 700, color: '#fb7185' }}>
                      <td style={{ padding: '8px 0 4px' }}>TOTAL KERUGIAN WASTE (Rasio: {wst.waste_ratio_pct}%)</td>
                      <td style={{ padding: '8px 0 4px', textAlign: 'right' }}>({rupiah(wst.total_waste_loss)})</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* POS IV: BEBAN OPERASIONAL TOKO (OPEX) */}
            <div
              className="card"
              onClick={() => handleCardClick('OPEX')}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 10,
                padding: '14px 18px',
                border: '1px solid rgba(251, 191, 36, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Klik untuk melihat rincian beban operasional toko (OPEX)"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24', letterSpacing: 0.5 }}>
                    4. BEBAN OPERASIONAL TOKO (OPEX)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="btn btn-sm"
                    style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      borderRadius: 6,
                      background: 'rgba(251, 191, 36, 0.15)',
                      color: '#fbbf24',
                      border: '1px solid rgba(251, 191, 36, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontWeight: 700,
                    }}
                    onClick={(e) => { e.stopPropagation(); handleCardClick('OPEX'); }}
                  >
                    <Search size={12} /> Rincian Beban OPEX
                  </button>
                  {!isComp && (
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#fbbf24' }}>
                      ({rupiah(opx.total_opex)})
                    </span>
                  )}
                </div>
              </div>

              {isComp ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  {EXPENSE_CATEGORIES.map(cat => {
                    const currItem = opx.breakdown?.find(b => b.category === cat.value);
                    const prevItem = prev?.opex?.breakdown?.find(b => b.category === cat.value);
                    const currAmt = currItem ? currItem.total : 0;
                    const prevAmt = prevItem ? prevItem.total : 0;
                    const diffAmt = currAmt - prevAmt;
                    const diffPct = prevAmt > 0 ? round(((currAmt - prevAmt) / prevAmt) * 100, 1) : (currAmt > 0 ? 100 : 0);

                    if (currAmt === 0 && prevAmt === 0) return null;

                    return (
                      <div key={cat.value} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: '6px 0', borderBottom: '1px dashed rgba(255, 255, 255, 0.06)' }}>
                        <div style={{ color: '#cbd5e1' }}>{cat.label}</div>
                        <div style={{ textAlign: 'right', fontWeight: 600 }}>{rupiah(currAmt)}</div>
                        <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{rupiah(prevAmt)}</div>
                        <div style={{ textAlign: 'right', color: diffAmt > 0 ? '#f87171' : '#34d399' }}>
                          {diffAmt >= 0 ? '+' : ''}{rupiah(diffAmt)}
                        </div>
                        <div style={{ textAlign: 'right', color: diffAmt > 0 ? '#f87171' : '#34d399', fontWeight: 700 }}>
                          {diffPct >= 0 ? '+' : ''}{diffPct}%
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: '8px 0 4px', fontWeight: 800, color: '#fbbf24', fontSize: 13.5 }}>
                    <div>TOTAL BEBAN OPERASIONAL (Rasio: {opx.opex_ratio_pct}%)</div>
                    <div style={{ textAlign: 'right' }}>({rupiah(opx.total_opex)})</div>
                    <div style={{ textAlign: 'right', color: '#cbd5e1' }}>({rupiah(prev?.opex?.total_opex)})</div>
                    <div style={{ textAlign: 'right', color: delta?.opex?.total_opex?.sentiment === 'GOOD' ? '#34d399' : '#f87171' }}>
                      {delta?.opex?.total_opex?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.opex?.total_opex?.diff_nominal)}
                    </div>
                    <div style={{ textAlign: 'right', color: delta?.opex?.total_opex?.sentiment === 'GOOD' ? '#34d399' : '#f87171' }}>
                      {delta?.opex?.total_opex?.diff_pct >= 0 ? '+' : ''}{delta?.opex?.total_opex?.diff_pct}%
                    </div>
                  </div>
                </div>
              ) : (
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <tbody>
                    {opx.breakdown && opx.breakdown.length > 0 ? (
                      opx.breakdown.map(o => (
                        <tr key={o.category} style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.06)' }}>
                          <td style={{ padding: '6px 0', color: '#cbd5e1' }}>{o.label} ({o.count} pos pengeluaran)</td>
                          <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#fde68a' }}>({rupiah(o.total)})</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} style={{ padding: '6px 0', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Belum ada catatan biaya operasional diinput pada periode ini.
                        </td>
                      </tr>
                    )}
                    <tr style={{ fontWeight: 700, color: '#fbbf24' }}>
                      <td style={{ padding: '8px 0 4px' }}>TOTAL BEBAN OPERASIONAL (Rasio: {opx.opex_ratio_pct}%)</td>
                      <td style={{ padding: '8px 0 4px', textAlign: 'right' }}>({rupiah(opx.total_opex)})</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* GRAND TOTAL: LABA BERSIH USAHA (NET OPERATING PROFIT) */}
            <div
              className="card"
              onClick={() => handleCardClick('NET_PROFIT')}
              style={{
                display: isComp ? 'grid' : 'flex',
                gridTemplateColumns: isComp ? '2fr 1fr 1fr 1fr 1fr' : undefined,
                justifyContent: isComp ? undefined : 'space-between',
                alignItems: 'center',
                gap: 8,
                padding: '20px 24px',
                borderRadius: 12,
                background: `linear-gradient(135deg, ${bot.health_color}25 0%, rgba(15, 23, 42, 0.95) 100%)`,
                border: `2px solid ${bot.health_color}60`,
                boxShadow: `0 10px 30px ${bot.health_color}20`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Klik untuk melihat jembatan kalkulasi formula laba bersih"
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Landmark size={22} color={bot.health_color} />
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', letterSpacing: 0.5 }}>
                    LABA BERSIH USAHA (NET PROFIT)
                  </span>
                  <span style={{ fontSize: 11, color: bot.health_color, background: `${bot.health_color}25`, padding: '2px 6px', borderRadius: 4, marginLeft: 4 }}>
                    Formula
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Rumus: Omset Bersih - HPP Riil - Kerugian Waste - Beban OPEX
                </div>
              </div>

              {isComp ? (
                <>
                  <div style={{ textAlign: 'right', fontSize: 20, fontWeight: 900, color: bot.net_profit >= 0 ? bot.health_color : '#f43f5e' }}>
                    {rupiah(bot.net_profit)}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 15, color: '#cbd5e1', fontWeight: 600 }}>
                    {rupiah(prev?.bottom_line?.net_profit)}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 800, color: delta?.bottom_line?.net_profit?.sentiment === 'GOOD' ? '#34d399' : '#f87171' }}>
                    {delta?.bottom_line?.net_profit?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.bottom_line?.net_profit?.diff_nominal)}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 900, color: delta?.bottom_line?.net_profit?.sentiment === 'GOOD' ? '#34d399' : '#f87171' }}>
                    {delta?.bottom_line?.net_profit?.diff_pct >= 0 ? '+' : ''}{delta?.bottom_line?.net_profit?.diff_pct}%
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: bot.net_profit >= 0 ? bot.health_color : '#f43f5e' }}>
                    {rupiah(bot.net_profit)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: bot.health_color, marginTop: 2 }}>
                    Net Margin: {bot.net_margin_pct}% ({bot.health_label})
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB 2: OPERATING EXPENSES (OPEX) MANAGEMENT */}
      {activeTab === 'expenses' && (
        <div className="card" style={{ padding: 20 }}>
          <div className="flex-between mb-3 flex-wrap gap-3">
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Buku Catatan Pengeluaran Operasional (OPEX)
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Kelola pencatatan beban rutin: gaji staf, listrik PLN, gas masak LPG, sewa toko, servis, dan promosi.
              </p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleOpenCreateModal}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              <Plus size={16} /> Catat Biaya Baru
            </button>
          </div>

          {/* Category summary cards */}
          {expenseSummary?.by_category && expenseSummary.by_category.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 10,
                marginBottom: 16,
              }}
            >
              {expenseSummary.by_category.map(cat => {
                const meta = EXPENSE_CATEGORIES.find(c => c.value === cat.category) || { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' };
                return (
                  <div
                    key={cat.category}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: meta.bg,
                      border: `1px solid ${meta.color}35`,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>
                      {cat.label}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>
                      {rupiah(cat.total)}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                      {cat.count} transaksi ({cat.percentage}%)
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Table Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 32, fontSize: 13, height: 36 }}
                placeholder="Cari nama biaya, nomor dokumen, atau catatan..."
                value={expenseSearch}
                onChange={e => setExpenseSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={15} color="var(--text-muted)" />
              <select
                className="form-control"
                style={{ fontSize: 13, height: 36, minWidth: 160 }}
                value={expenseCategoryFilter}
                onChange={e => setExpenseCategoryFilter(e.target.value)}
              >
                <option value="ALL">Semua Kategori</option>
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
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
                  <th>Cabang Outlet</th>
                  <th>Kategori</th>
                  <th>Nama Pengeluaran</th>
                  <th style={{ textAlign: 'right' }}>Nominal</th>
                  <th>Metode Bayar</th>
                  <th>Pencatat</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length > 0 ? (
                  filteredExpenses.map(item => {
                    const meta = EXPENSE_CATEGORIES.find(c => c.value === item.category) || { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' };
                    return (
                      <tr key={item.id}>
                        <td className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
                          {item.expense_no}
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
                              background: meta.bg,
                              color: meta.color,
                              border: `1px solid ${meta.color}40`,
                            }}
                          >
                            {item.category_label || item.category}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>{item.name}</div>
                          {item.notes && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {item.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#fbbf24', fontSize: 13.5 }}>
                          {rupiah(item.amount)}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          <span className="mono" style={{ color: 'var(--text-muted)' }}>
                            {item.payment_method_label || item.payment_method}
                          </span>
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
                              title="Edit Pengeluaran"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 6px', color: '#f43f5e' }}
                              onClick={() => handleDeleteExpense(item.id, item.name)}
                              title="Hapus Pengeluaran"
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
                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                      Belum ada catatan biaya operasional yang sesuai dengan filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB 3: SIDE-BY-SIDE OUTLET BENCHMARK */}
      {activeTab === 'benchmark' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Top Control Bar */}
          <div
            className="card"
            style={{
              padding: '16px 20px',
              background: 'rgba(15, 23, 42, 0.85)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              border: '1px solid rgba(165, 180, 252, 0.15)',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={18} color="#38bdf8" />
                Matriks Performa Berdampingan Antar-Cabang (Side-by-Side Benchmark)
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Perbandingan komparatif omset, food cost (HPP), tingkat kerugian waste, beban gaji, dan laba bersih riil per outlet.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={fetchBenchmark}
                disabled={benchmarkLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              >
                <RefreshCw size={14} className={benchmarkLoading ? 'spin' : ''} /> Refresh Benchmark
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handlePrintBenchmark}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              >
                <Printer size={14} /> Cetak Matriks Benchmark
              </button>
            </div>
          </div>

          {benchmarkLoading && (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <LoadingState message="Menganalisis & mengkalkulasi performa finansial seluruh cabang..." />
            </div>
          )}

          {!benchmarkLoading && benchmarkData && (
            <>
              {/* Executive Highlights: 4 Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 16,
                }}
              >
                {/* Best Margin */}
                <div
                  className="card"
                  style={{
                    padding: '16px 18px',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(15, 23, 42, 0.8))',
                    border: '1.5px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Margin Champion 🏆
                    </span>
                    <Award size={18} color="#34d399" />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: '#ffffff', marginBottom: 4 }}>
                    {benchmarkData.highlights?.best_margin?.outlet_name || '-'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>
                      {benchmarkData.highlights?.best_margin?.net_margin_pct ?? 0}%
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      Net Margin Riil ({rupiah(benchmarkData.highlights?.best_margin?.net_profit || 0)})
                    </span>
                  </div>
                </div>

                {/* Top Revenue */}
                <div
                  className="card"
                  style={{
                    padding: '16px 18px',
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(15, 23, 42, 0.8))',
                    border: '1.5px solid rgba(59, 130, 246, 0.35)',
                    borderRadius: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Omset Terbesar ⭐
                    </span>
                    <Trophy size={18} color="#60a5fa" />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: '#ffffff', marginBottom: 4 }}>
                    {benchmarkData.highlights?.top_revenue?.outlet_name || '-'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#38bdf8' }}>
                      {rupiah(benchmarkData.highlights?.top_revenue?.net_sales || 0)}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      ({benchmarkData.highlights?.top_revenue?.share_pct ?? 0}% share grup)
                    </span>
                  </div>
                </div>

                {/* Lowest Waste */}
                <div
                  className="card"
                  style={{
                    padding: '16px 18px',
                    background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(15, 23, 42, 0.8))',
                    border: '1.5px solid rgba(6, 182, 212, 0.35)',
                    borderRadius: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Efisiensi Bahan (Zero Waste) 🌿
                    </span>
                    <Package size={18} color="#22d3ee" />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: '#ffffff', marginBottom: 4 }}>
                    {benchmarkData.highlights?.lowest_waste?.outlet_name || '-'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#06b6d4' }}>
                      {benchmarkData.highlights?.lowest_waste?.waste_ratio_pct ?? 0}%
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      Rasio Waste ({rupiah(benchmarkData.highlights?.lowest_waste?.waste_loss || 0)})
                    </span>
                  </div>
                </div>

                {/* Attention Needed / Watchlist */}
                <div
                  className="card"
                  style={{
                    padding: '16px 18px',
                    background: benchmarkData.highlights?.attention_needed
                      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(15, 23, 42, 0.8))'
                      : 'rgba(15, 23, 42, 0.8)',
                    border: benchmarkData.highlights?.attention_needed
                      ? '1.5px solid rgba(239, 68, 68, 0.35)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: benchmarkData.highlights?.attention_needed ? '#f87171' : '#a1a1aa', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Perlu Evaluasi (Watchlist) ⚠️
                    </span>
                    <AlertTriangle size={18} color={benchmarkData.highlights?.attention_needed ? '#f87171' : '#a1a1aa'} />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: '#ffffff', marginBottom: 4 }}>
                    {benchmarkData.highlights?.attention_needed?.outlet_name || 'Semua Cabang Terkendali'}
                  </div>
                  {benchmarkData.highlights?.attention_needed ? (
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#ef4444' }}>
                        Net Margin: {benchmarkData.highlights.attention_needed.net_margin_pct}%
                      </span>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        {benchmarkData.highlights.attention_needed.warnings?.map((w, wi) => (
                          <span key={wi} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: `${w.color}25`, color: w.color, border: `1px solid ${w.color}40`, fontWeight: 700 }}>
                            {w.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                      Tidak ada cabang dengan defisit atau biaya anomali
                    </div>
                  )}
                </div>
              </div>

              {/* Side-by-Side Cost Structure Comparison (Visual Bars) */}
              <div
                className="card"
                style={{
                  padding: '20px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(165, 180, 252, 0.15)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Layers size={16} color="#38bdf8" />
                      Komparasi Struktur Biaya & Margin Antar Cabang
                    </h4>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      Distribusi persentase pengeluaran terhadap omset per outlet.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: '#6366f1', borderRadius: 2 }} /> HPP Riil</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: '#f43f5e', borderRadius: 2 }} /> Waste</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: '#8b5cf6', borderRadius: 2 }} /> Gaji/SDM</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: '#f59e0b', borderRadius: 2 }} /> OPEX Lain</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: '#10b981', borderRadius: 2 }} /> Net Margin</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {sortedBenchmarkOutlets.map(item => {
                    const ns = item.revenue.net_sales;
                    const cogsPct = Math.min(100, Math.max(0, item.cogs.cogs_ratio_pct));
                    const wastePct = Math.min(100, Math.max(0, item.waste.waste_ratio_pct));
                    const salaryPct = Math.min(100, Math.max(0, item.opex.salary_ratio_pct));
                    const otherOpexPct = Math.min(100, Math.max(0, item.opex.opex_ratio_pct - item.opex.salary_ratio_pct));
                    const netMarginPct = item.bottom_line.net_margin_pct;

                    return (
                      <div key={item.outlet.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                          <span style={{ fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {item.outlet.name}
                            {item.outlet.is_main && (
                              <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}>PUSAT</span>
                            )}
                          </span>
                          <span style={{ fontSize: 12 }}>
                            Omset: <strong>{rupiah(ns)}</strong> | Net Margin: <strong style={{ color: netMarginPct >= 0 ? '#10b981' : '#f43f5e' }}>{netMarginPct}%</strong>
                          </span>
                        </div>
                        {ns > 0 ? (
                          <div
                            style={{
                              height: 14,
                              borderRadius: 7,
                              background: 'rgba(255, 255, 255, 0.06)',
                              display: 'flex',
                              overflow: 'hidden',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                            }}
                          >
                            <div style={{ width: `${cogsPct}%`, background: '#6366f1' }} title={`HPP: ${cogsPct}%`} />
                            <div style={{ width: `${wastePct}%`, background: '#f43f5e' }} title={`Waste: ${wastePct}%`} />
                            <div style={{ width: `${salaryPct}%`, background: '#8b5cf6' }} title={`Gaji: ${salaryPct}%`} />
                            <div style={{ width: `${otherOpexPct}%`, background: '#f59e0b' }} title={`OPEX Lain: ${otherOpexPct.toFixed(1)}%`} />
                            {netMarginPct > 0 && (
                              <div style={{ width: `${Math.min(100, netMarginPct)}%`, background: '#10b981' }} title={`Laba: ${netMarginPct}%`} />
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Belum ada transaksi di periode ini
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Main Side-by-Side Matrix Table */}
              <div
                className="card"
                style={{
                  padding: '20px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(165, 180, 252, 0.15)',
                  overflowX: 'auto',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
                    Tabel Matriks Komparasi Finansial Antar Cabang
                  </h4>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    *Klik header kolom untuk mengurutkan data (sorting).
                  </span>
                </div>

                <table className="table table-hover" style={{ width: '100%', fontSize: 12.5, minWidth: 950 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <th style={{ padding: '12px 14px', cursor: 'pointer' }} onClick={() => handleBenchmarkSort('name')}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          Cabang / Outlet <ArrowUpDown size={12} />
                        </span>
                      </th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleBenchmarkSort('net_sales')}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          Omset Bersih (% Share) <ArrowUpDown size={12} />
                        </span>
                      </th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleBenchmarkSort('cogs_ratio_pct')}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          HPP Riil (COGS %) <ArrowUpDown size={12} />
                        </span>
                      </th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleBenchmarkSort('waste_ratio_pct')}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          Kerugian Waste (%) <ArrowUpDown size={12} />
                        </span>
                      </th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleBenchmarkSort('salary_ratio_pct')}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          Beban Gaji/SDM (%) <ArrowUpDown size={12} />
                        </span>
                      </th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleBenchmarkSort('opex_ratio_pct')}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          Total OPEX (%) <ArrowUpDown size={12} />
                        </span>
                      </th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleBenchmarkSort('net_margin_pct')}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          Laba Bersih (Margin %) <ArrowUpDown size={12} />
                        </span>
                      </th>
                      <th style={{ padding: '12px 14px', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleBenchmarkSort('transaction_count')}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          Trx & Avg Ticket <ArrowUpDown size={12} />
                        </span>
                      </th>
                      <th style={{ padding: '12px 14px', textAlign: 'center' }}>
                        Predikat & Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBenchmarkOutlets.map(item => {
                      const netProfit = item.bottom_line.net_profit;
                      const netMargin = item.bottom_line.net_margin_pct;

                      return (
                        <tr key={item.outlet.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          {/* Outlet Name */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: 13 }}>
                              {item.outlet.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              Kode: {item.outlet.code} {item.outlet.is_main ? '• (Pusat / Gudang)' : ''}
                            </div>
                          </td>

                          {/* Net Sales */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: 13.5 }}>
                              {rupiah(item.revenue.net_sales)}
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>
                              Kontribusi: <strong>{item.revenue.share_pct}%</strong>
                            </div>
                          </td>

                          {/* COGS */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: '#c7d2fe' }}>
                              {rupiah(item.cogs.total_cogs)}
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: item.cogs.cogs_ratio_pct > 35 ? '#f43f5e' : '#a5b4fc',
                              }}
                            >
                              Rasio: {item.cogs.cogs_ratio_pct}%
                            </span>
                          </td>

                          {/* Waste */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: item.waste.total_waste_loss > 0 ? '#fecdd3' : '#94a3b8' }}>
                              {rupiah(item.waste.total_waste_loss)}
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: item.waste.waste_ratio_pct > 2.0 ? '#ef4444' : '#10b981',
                              }}
                            >
                              Rasio: {item.waste.waste_ratio_pct}%
                            </span>
                          </td>

                          {/* Salary */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: item.opex.salary_amount > 0 ? '#ddd6fe' : '#94a3b8' }}>
                              {rupiah(item.opex.salary_amount)}
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: item.opex.salary_ratio_pct > 25.0 ? '#f59e0b' : '#c084fc',
                              }}
                            >
                              Rasio: {item.opex.salary_ratio_pct}%
                            </span>
                          </td>

                          {/* Total OPEX */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: '#fef3c7' }}>
                              {rupiah(item.opex.total_opex)}
                            </div>
                            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>
                              Rasio: {item.opex.opex_ratio_pct}%
                            </span>
                          </td>

                          {/* Net Profit */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ fontWeight: 900, color: netProfit >= 0 ? '#34d399' : '#f43f5e', fontSize: 14 }}>
                              {rupiah(netProfit)}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: netMargin >= 20 ? '#10b981' : (netMargin >= 0 ? '#f59e0b' : '#ef4444'),
                              }}
                            >
                              Margin: {netMargin}%
                            </div>
                          </td>

                          {/* Transaction & AOV */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                              {item.revenue.transaction_count} pesanan
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              Avg: {rupiah(item.revenue.avg_order_value)}
                            </div>
                          </td>

                          {/* Status & Badges */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                              {item.tags?.map((t, ti) => (
                                <span
                                  key={ti}
                                  style={{
                                    fontSize: 10.5,
                                    padding: '2px 8px',
                                    borderRadius: 12,
                                    fontWeight: 800,
                                    background: `${t.color}25`,
                                    color: t.color,
                                    border: `1px solid ${t.color}40`,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {t.label}
                                </span>
                              ))}

                              {item.warnings?.map((w, wi) => (
                                <span
                                  key={wi}
                                  style={{
                                    fontSize: 10,
                                    padding: '2px 6px',
                                    borderRadius: 10,
                                    fontWeight: 700,
                                    background: `${w.color}20`,
                                    color: w.color,
                                    border: `1px solid ${w.color}40`,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {w.label}
                                </span>
                              ))}

                              {(!item.tags || item.tags.length === 0) && (!item.warnings || item.warnings.length === 0) && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    padding: '2px 8px',
                                    borderRadius: 12,
                                    fontWeight: 700,
                                    background: 'rgba(255,255,255,0.06)',
                                    color: 'var(--text-muted)',
                                  }}
                                >
                                  {item.bottom_line.health_label || 'Normal'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Summary Rows */}
                  <tfoot>
                    {/* Consolidated Group Total */}
                    <tr style={{ background: 'rgba(255, 255, 255, 0.07)', borderTop: '2px solid rgba(255, 255, 255, 0.2)', fontWeight: 800 }}>
                      <td style={{ padding: '12px 14px', color: '#f8fafc', fontSize: 13 }}>
                        TOTAL KONSOLIDASIAN GRUP
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#38bdf8', fontSize: 14 }}>
                        {rupiah(benchmarkData.consolidated.net_sales)}
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>100.0%</div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#c7d2fe' }}>
                        {rupiah(benchmarkData.consolidated.total_cogs)}
                        <div style={{ fontSize: 11 }}>{benchmarkData.consolidated.cogs_ratio_pct}%</div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#fecdd3' }}>
                        {rupiah(benchmarkData.consolidated.total_waste_loss)}
                        <div style={{ fontSize: 11 }}>{benchmarkData.consolidated.waste_ratio_pct}%</div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#ddd6fe' }}>
                        {rupiah(benchmarkData.consolidated.salary_amount)}
                        <div style={{ fontSize: 11 }}>{benchmarkData.consolidated.salary_ratio_pct}%</div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#fef3c7' }}>
                        {rupiah(benchmarkData.consolidated.total_opex)}
                        <div style={{ fontSize: 11 }}>{benchmarkData.consolidated.opex_ratio_pct}%</div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: benchmarkData.consolidated.net_profit >= 0 ? '#34d399' : '#f43f5e', fontSize: 14 }}>
                        {rupiah(benchmarkData.consolidated.net_profit)}
                        <div style={{ fontSize: 11 }}>{benchmarkData.consolidated.net_margin_pct}%</div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#f8fafc' }}>
                        {benchmarkData.consolidated.transaction_count} pesanan
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avg: {rupiah(benchmarkData.consolidated.avg_order_value)}</div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{ fontSize: 11, color: '#a5b4fc', fontWeight: 800 }}>
                          {benchmarkData.consolidated.total_outlets} Outlet Aktif
                        </span>
                      </td>
                    </tr>

                    {/* Benchmark Average */}
                    <tr style={{ background: 'rgba(56, 189, 248, 0.06)', borderTop: '1px dashed rgba(56, 189, 248, 0.3)', fontWeight: 700, fontSize: 12 }}>
                      <td style={{ padding: '10px 14px', color: '#38bdf8' }}>
                        RATA-RATA ACUAN GRUP (BENCHMARK)
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#38bdf8' }}>
                        {rupiah(benchmarkData.consolidated.total_outlets > 0 ? benchmarkData.consolidated.net_sales / benchmarkData.consolidated.total_outlets : 0)}
                        <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}> /cabang</span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#c7d2fe' }}>
                        Acuan HPP: {benchmarkData.consolidated.cogs_ratio_pct}%
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#fecdd3' }}>
                        Acuan Waste: {benchmarkData.consolidated.waste_ratio_pct}%
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#ddd6fe' }}>
                        Acuan Gaji: {benchmarkData.consolidated.salary_ratio_pct}%
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#fef3c7' }}>
                        Acuan OPEX: {benchmarkData.consolidated.opex_ratio_pct}%
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: benchmarkData.consolidated.net_margin_pct >= 0 ? '#34d399' : '#f43f5e' }}>
                        Rata-rata Margin: {benchmarkData.consolidated.net_margin_pct}%
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#f8fafc' }}>
                        Avg AOV: {rupiah(benchmarkData.consolidated.avg_order_value)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#38bdf8', fontSize: 11 }}>
                        Target F&B Ideal: &gt;20%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* 7. MODAL: CATAT / EDIT BIAYA OPERASIONAL (OPEX) */}
      {modalOpen && (
        <div className="modal-overlay">
          <div
            className="modal-card"
            style={{
              maxWidth: 520,
              background: '#0f172a',
              border: '1px solid rgba(165, 180, 252, 0.25)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={18} color="#fbbf24" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                  {editingExpenseId ? 'Edit Catatan Biaya Operasional' : 'Catat Biaya Operasional Toko (OPEX)'}
                </h3>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setModalOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitExpense}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                    <label className="form-label" style={{ fontSize: 12 }}>Cabang Toko</label>
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

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>Kategori Beban Operasional *</label>
                  <select
                    className="form-control"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    required
                  >
                    {EXPENSE_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>Nama / Uraian Biaya *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Tagihan Listrik PLN Cabang Utama, Beli Gas LPG 3 tabung..."
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12 }}>Nominal Biaya (Rp) *</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="0"
                      min="1"
                      step="any"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      required
                      style={{ fontSize: 15, fontWeight: 700, color: '#fbbf24' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12 }}>Metode Bayar</label>
                    <select
                      className="form-control"
                      value={formData.payment_method}
                      onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                    >
                      {PAYMENT_METHODS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>Catatan / Keterangan (Opsional)</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Keterangan nomor meteran, nama vendor/toko, penerima, dll."
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
                  disabled={savingExpense}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={savingExpense}
                  style={{ fontWeight: 700 }}
                >
                  {savingExpense ? 'Menyimpan...' : (editingExpenseId ? 'Simpan Perubahan' : 'Simpan Biaya')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. HIDDEN PRINTABLE CONTAINER FOR A4 REPORT */}
      <div id="printable-pl-statement" style={{ display: 'none' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", color: '#000000', padding: 20 }}>
          <div style={{ borderBottom: '2px solid #000', paddingBottom: 12, marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {businessTitle}
            </h2>
            <div style={{ fontSize: 13, fontWeight: 'bold', marginTop: 2 }}>
              {isComp ? 'LAPORAN LABA RUGI KOMPARASI DUA PERIODE' : 'LAPORAN LABA RUGI KOMPREHENSIF (INCOME STATEMENT)'}
            </div>
            <div style={{ fontSize: 11, color: '#333', marginTop: 4 }}>
              Cabang: {outletTitle} | Periode: {dateFrom} s/d {dateTo}
              {isComp && comparePeriod && ` (vs ${comparePeriod.from} s/d ${comparePeriod.to})`} | Dicetak: {new Date().toLocaleString('id-ID')}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #000' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>URAIAN POS KEUANGAN</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>PERIODE INI</th>
                {isComp && <th style={{ textAlign: 'right', padding: '6px 8px' }}>PEMBANDING</th>}
                {isComp && <th style={{ textAlign: 'right', padding: '6px 8px' }}>SELISIH (Δ)</th>}
                {isComp && <th style={{ textAlign: 'right', padding: '6px 8px' }}>DELTA (%)</th>}
                {!isComp && <th style={{ textAlign: 'right', padding: '6px 8px' }}>RASIO (%)</th>}
              </tr>
            </thead>
            <tbody>
              {/* 1. REVENUE */}
              <tr style={{ fontWeight: 'bold', background: '#f8fafc' }}>
                <td colSpan={isComp ? 5 : 2} style={{ padding: '6px 8px' }}>1. PENDAPATAN OPERASIONAL (REVENUE)</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 8px 4px 20px', color: '#0284c7' }}>• Penjualan Nota Generate ({rev.nota_generate?.transaction_count || 0} pesanan)</td>
                <td style={{ textAlign: 'right', padding: '4px 8px', color: '#0284c7' }}>{rupiah(rev.nota_generate?.net_sales)}</td>
                {isComp && <td style={{ textAlign: 'right', padding: '4px 8px' }}>{rupiah(prev?.revenue?.nota_generate?.net_sales)}</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '4px 8px' }}>{delta?.revenue?.nota_generate_net?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.revenue?.nota_generate_net?.diff_nominal)}</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '4px 8px' }}>{delta?.revenue?.nota_generate_net?.diff_pct >= 0 ? '+' : ''}{delta?.revenue?.nota_generate_net?.diff_pct}%</td>}
                {!isComp && <td style={{ textAlign: 'right', padding: '4px 8px' }}>{rev.nota_generate?.share_pct || 0}%</td>}
              </tr>
              <tr>
                <td style={{ padding: '4px 8px 4px 20px', color: '#d97706' }}>• Penjualan Nota Manual ({rev.nota_manual?.transaction_count || 0} pesanan)</td>
                <td style={{ textAlign: 'right', padding: '4px 8px', color: '#d97706' }}>{rupiah(rev.nota_manual?.net_sales)}</td>
                {isComp && <td style={{ textAlign: 'right', padding: '4px 8px' }}>{rupiah(prev?.revenue?.nota_manual?.net_sales)}</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '4px 8px' }}>{delta?.revenue?.nota_manual_net?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.revenue?.nota_manual_net?.diff_nominal)}</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '4px 8px' }}>{delta?.revenue?.nota_manual_net?.diff_pct >= 0 ? '+' : ''}{delta?.revenue?.nota_manual_net?.diff_pct}%</td>}
                {!isComp && <td style={{ textAlign: 'right', padding: '4px 8px' }}>{rev.nota_manual?.share_pct || 0}%</td>}
              </tr>
              <tr>
                <td style={{ padding: '4px 8px 4px 20px' }}>Total Penjualan Kotor ({rev.transaction_count} pesanan)</td>
                <td style={{ textAlign: 'right', padding: '4px 8px' }}>{rupiah(rev.gross_sales)}</td>
                {isComp && <td style={{ textAlign: 'right', padding: '4px 8px' }}>{rupiah(prev?.revenue?.gross_sales)}</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '4px 8px' }}>{delta?.revenue?.gross_sales?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.revenue?.gross_sales?.diff_nominal)}</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '4px 8px' }}>{delta?.revenue?.gross_sales?.diff_pct >= 0 ? '+' : ''}{delta?.revenue?.gross_sales?.diff_pct}%</td>}
                {!isComp && <td style={{ textAlign: 'right', padding: '4px 8px' }}>—</td>}
              </tr>
              <tr>
                <td style={{ padding: '4px 8px 4px 20px', color: '#b91c1c' }}>Diskon & Promo Kasir (-)</td>
                <td style={{ textAlign: 'right', padding: '4px 8px', color: '#b91c1c' }}>({rupiah(rev.total_discount)})</td>
                {isComp && <td style={{ textAlign: 'right', padding: '4px 8px' }}>({rupiah(prev?.revenue?.total_discount)})</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '4px 8px' }}>{rupiah(delta?.revenue?.total_discount?.diff_nominal)}</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '4px 8px' }}>{delta?.revenue?.total_discount?.diff_pct}%</td>}
                {!isComp && <td style={{ textAlign: 'right', padding: '4px 8px' }}>—</td>}
              </tr>
              <tr style={{ fontWeight: 'bold', borderBottom: '1px solid #ccc' }}>
                <td style={{ padding: '6px 8px' }}>TOTAL OMSET BERSIH (NET REVENUE)</td>
                <td style={{ textAlign: 'right', padding: '6px 8px' }}>{rupiah(rev.net_sales)}</td>
                {isComp && <td style={{ textAlign: 'right', padding: '6px 8px' }}>{rupiah(prev?.revenue?.net_sales)}</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '6px 8px' }}>{delta?.revenue?.net_sales?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.revenue?.net_sales?.diff_nominal)}</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '6px 8px' }}>{delta?.revenue?.net_sales?.diff_pct >= 0 ? '+' : ''}{delta?.revenue?.net_sales?.diff_pct}%</td>}
                {!isComp && <td style={{ textAlign: 'right', padding: '6px 8px' }}>100.0%</td>}
              </tr>

              {/* 2. COGS */}
              <tr style={{ fontWeight: 'bold', background: '#f8fafc' }}>
                <td colSpan={isComp ? 5 : 2} style={{ padding: '6px 8px' }}>2. HARGA POKOK PENJUALAN (COGS / HPP RIIL)</td>
              </tr>
              <tr style={{ fontWeight: 'bold', borderBottom: '1px solid #ccc' }}>
                <td style={{ padding: '6px 8px' }}>TOTAL HPP RIIL (-)</td>
                <td style={{ textAlign: 'right', padding: '6px 8px' }}>({rupiah(cogs.total_cogs)})</td>
                {isComp && <td style={{ textAlign: 'right', padding: '6px 8px' }}>({rupiah(prev?.cogs?.total_cogs)})</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '6px 8px' }}>{delta?.cogs?.total_cogs?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.cogs?.total_cogs?.diff_nominal)}</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '6px 8px' }}>{delta?.cogs?.total_cogs?.diff_pct >= 0 ? '+' : ''}{delta?.cogs?.total_cogs?.diff_pct}%</td>}
                {!isComp && <td style={{ textAlign: 'right', padding: '6px 8px' }}>{cogs.cogs_ratio_pct}%</td>}
              </tr>

              {/* LABA KOTOR */}
              <tr style={{ fontWeight: 'bold', background: '#e2e8f0' }}>
                <td style={{ padding: '7px 8px' }}>LABA KOTOR (GROSS PROFIT)</td>
                <td style={{ textAlign: 'right', padding: '7px 8px' }}>{rupiah(cogs.gross_profit)}</td>
                {isComp && <td style={{ textAlign: 'right', padding: '7px 8px' }}>{rupiah(prev?.cogs?.gross_profit)}</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '7px 8px' }}>{delta?.cogs?.gross_profit?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.cogs?.gross_profit?.diff_nominal)}</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '7px 8px' }}>{delta?.cogs?.gross_profit?.diff_pct >= 0 ? '+' : ''}{delta?.cogs?.gross_profit?.diff_pct}%</td>}
                {!isComp && <td style={{ textAlign: 'right', padding: '7px 8px' }}>{cogs.gross_margin_pct}%</td>}
              </tr>

              {/* 3. WASTE */}
              <tr style={{ fontWeight: 'bold', borderBottom: '1px solid #ccc' }}>
                <td style={{ padding: '6px 8px' }}>TOTAL KERUGIAN WASTE (-)</td>
                <td style={{ textAlign: 'right', padding: '6px 8px' }}>({rupiah(wst.total_waste_loss)})</td>
                {isComp && <td style={{ textAlign: 'right', padding: '6px 8px' }}>({rupiah(prev?.waste?.total_waste_loss)})</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '6px 8px' }}>{delta?.waste?.total_waste_loss?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.waste?.total_waste_loss?.diff_nominal)}</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '6px 8px' }}>{delta?.waste?.total_waste_loss?.diff_pct}%</td>}
                {!isComp && <td style={{ textAlign: 'right', padding: '6px 8px' }}>{wst.waste_ratio_pct}%</td>}
              </tr>

              {/* 4. OPEX */}
              <tr style={{ fontWeight: 'bold', borderBottom: '1px solid #000' }}>
                <td style={{ padding: '6px 8px' }}>TOTAL BEBAN OPERASIONAL (OPEX) (-)</td>
                <td style={{ textAlign: 'right', padding: '6px 8px' }}>({rupiah(opx.total_opex)})</td>
                {isComp && <td style={{ textAlign: 'right', padding: '6px 8px' }}>({rupiah(prev?.opex?.total_opex)})</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '6px 8px' }}>{delta?.opex?.total_opex?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.opex?.total_opex?.diff_nominal)}</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '6px 8px' }}>{delta?.opex?.total_opex?.diff_pct}%</td>}
                {!isComp && <td style={{ textAlign: 'right', padding: '6px 8px' }}>{opx.opex_ratio_pct}%</td>}
              </tr>

              {/* NET PROFIT */}
              <tr style={{ fontWeight: 'bold', fontSize: 12, background: '#cbd5e1', borderBottom: '3px double #000' }}>
                <td style={{ padding: '8px' }}>LABA BERSIH USAHA (NET PROFIT)</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{rupiah(bot.net_profit)}</td>
                {isComp && <td style={{ textAlign: 'right', padding: '8px' }}>{rupiah(prev?.bottom_line?.net_profit)}</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '8px' }}>{delta?.bottom_line?.net_profit?.diff_nominal >= 0 ? '+' : ''}{rupiah(delta?.bottom_line?.net_profit?.diff_nominal)}</td>}
                {isComp && <td style={{ textAlign: 'right', padding: '8px' }}>{delta?.bottom_line?.net_profit?.diff_pct >= 0 ? '+' : ''}{delta?.bottom_line?.net_profit?.diff_pct}%</td>}
                {!isComp && <td style={{ textAlign: 'right', padding: '8px' }}>{bot.net_margin_pct}%</td>}
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', padding: '0 40px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, marginBottom: 50 }}>Dibuat Oleh (Finance / Accounting):</div>
              <div style={{ borderTop: '1px solid #000', paddingTop: 4, fontWeight: 'bold', fontSize: 11 }}>
                {currentUser?.name || 'Staff Accounting'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, marginBottom: 50 }}>Disetujui Oleh (Owner Resto / Direktur):</div>
              <div style={{ borderTop: '1px solid #000', paddingTop: 4, fontWeight: 'bold', fontSize: 11 }}>
                ( Pemilik Usaha / Owner )
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 8. DRILLDOWN DETAIL MODAL FOR CARDS */}
      {detailModal.open && (
        <div className="modal-overlay" onClick={() => setDetailModal(p => ({ ...p, open: false }))}>
          <div
            className="modal-content fade-in"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 900, width: '92%', padding: 24, maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid rgba(165, 180, 252, 0.15)', paddingBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {detailModal.type === 'REVENUE' && <TrendingUp size={22} style={{ color: '#34d399' }} />}
                {detailModal.type === 'DISCOUNT' && <Tag size={22} style={{ color: '#f87171' }} />}
                {detailModal.type === 'COGS' && <Package size={22} style={{ color: '#818cf8' }} />}
                {detailModal.type === 'WASTE' && <Trash2 size={22} style={{ color: '#f43f5e' }} />}
                {detailModal.type === 'OPEX' && <Building2 size={22} style={{ color: '#fbbf24' }} />}
                {detailModal.type === 'NET_PROFIT' && <Landmark size={22} style={{ color: bot.health_color }} />}
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                    {detailModal.title}
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Cabang: <strong>{outletTitle}</strong> &nbsp;|&nbsp; Periode: <strong>{dateFrom}</strong> s/d <strong>{dateTo}</strong>
                  </div>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setDetailModal(p => ({ ...p, open: false }))}
              >
                ✕
              </button>
            </div>

            {/* Modal Content depending on type */}
            {detailModal.loading ? (
              <LoadingState message="Memuat rincian detail transaksi..." />
            ) : (
              <>
                {/* 1. REVENUE & DISCOUNT DETAIL VIEW */}
                {(detailModal.type === 'REVENUE' || detailModal.type === 'DISCOUNT') && (
                  <div>
                    {/* Filter Tabs between All, Generate, Manual, and Discount */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 12 }}>
                      <button
                        className={`btn btn-sm ${modalFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setModalFilter('ALL')}
                        style={{
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 14px',
                        }}
                      >
                        📋 Semua Nota
                        <span style={{ padding: '1px 6px', borderRadius: 10, fontSize: 10.5, background: 'rgba(255,255,255,0.15)', fontWeight: 800 }}>
                          {groupedOrders.length}
                        </span>
                      </button>

                      <button
                        className={`btn btn-sm ${modalFilter === 'GENERATE' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setModalFilter('GENERATE')}
                        style={{
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 14px',
                          color: modalFilter === 'GENERATE' ? undefined : '#06b6d4',
                          border: modalFilter === 'GENERATE' ? undefined : '1px solid rgba(6, 182, 212, 0.25)',
                        }}
                      >
                        Nota Generate (POS)
                        <span style={{ padding: '1px 6px', borderRadius: 10, fontSize: 10.5, background: 'rgba(6, 182, 212, 0.2)', fontWeight: 800 }}>
                          {generateOrdersList.length}
                        </span>
                      </button>

                      <button
                        className={`btn btn-sm ${modalFilter === 'MANUAL' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setModalFilter('MANUAL')}
                        style={{
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 14px',
                          color: modalFilter === 'MANUAL' ? undefined : '#f59e0b',
                          border: modalFilter === 'MANUAL' ? undefined : '1px solid rgba(245, 158, 11, 0.25)',
                        }}
                      >
                        Nota Manual (Urgent)
                        <span style={{ padding: '1px 6px', borderRadius: 10, fontSize: 10.5, background: 'rgba(245, 158, 11, 0.2)', fontWeight: 800 }}>
                          {manualOrdersList.length}
                        </span>
                      </button>

                      <button
                        className={`btn btn-sm`}
                        onClick={() => setModalFilter('DISCOUNT')}
                        style={{
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 14px',
                          background: modalFilter === 'DISCOUNT' ? '#e11d48' : 'rgba(244, 63, 94, 0.1)',
                          color: modalFilter === 'DISCOUNT' ? '#ffffff' : '#f87171',
                          border: '1px solid rgba(244, 63, 94, 0.35)',
                        }}
                      >
                        <Tag size={13} />
                        Diskon Saja
                        <span style={{ padding: '1px 6px', borderRadius: 10, fontSize: 10.5, background: 'rgba(255,255,255,0.25)', fontWeight: 800 }}>
                          {discountOrdersList.length}
                        </span>
                      </button>
                    </div>

                    {/* Dynamic Summary Chips based on active view */}
                    {modalFilter === 'DISCOUNT' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 18 }}>
                        <div style={{ background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.35)', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, color: '#fecdd3', fontWeight: 600 }}>Total Potongan Diskon</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#f87171' }}>
                            ({rupiah(discountOrdersList.reduce((s, o) => s + o.discount_amount, 0))})
                          </div>
                        </div>
                        <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Jumlah Pesanan Berdiskon</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#ffffff' }}>
                            {discountOrdersList.length} Pesanan
                          </div>
                        </div>
                        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Rata-rata Diskon per Order</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>
                            {rupiah(discountOrdersList.length > 0 ? (discountOrdersList.reduce((s, o) => s + o.discount_amount, 0) / discountOrdersList.length) : 0)}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Omset Bersih Berdiskon</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#34d399' }}>
                            {rupiah(discountOrdersList.reduce((s, o) => s + o.total_price, 0))}
                          </div>
                        </div>
                      </div>
                    ) : modalFilter === 'GENERATE' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 18 }}>
                        <div style={{ background: 'rgba(6, 182, 212, 0.12)', border: '1px solid rgba(6, 182, 212, 0.35)', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, color: '#a5f3fc', fontWeight: 600 }}>Omset Bersih Nota Generate</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#06b6d4' }}>
                            {rupiah(generateOrdersList.reduce((s, o) => s + o.total_price, 0))}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Penjualan Kotor (Gross)</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#ffffff' }}>
                            {rupiah(generateOrdersList.reduce((s, o) => s + o.subtotal, 0))}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Diskon Nota Generate</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#f87171' }}>
                            ({rupiah(generateOrdersList.reduce((s, o) => s + o.discount_amount, 0))})
                          </div>
                        </div>
                        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Jumlah Pesanan Standar</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>
                            {generateOrdersList.length} Pesanan
                          </div>
                        </div>
                      </div>
                    ) : modalFilter === 'MANUAL' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 18 }}>
                        <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, color: '#fde68a', fontWeight: 600 }}>Omset Bersih Nota Manual</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>
                            {rupiah(manualOrdersList.reduce((s, o) => s + o.total_price, 0))}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Penjualan Kotor (Gross)</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#ffffff' }}>
                            {rupiah(manualOrdersList.reduce((s, o) => s + o.subtotal, 0))}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Diskon Nota Manual</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#f87171' }}>
                            ({rupiah(manualOrdersList.reduce((s, o) => s + o.discount_amount, 0))})
                          </div>
                        </div>
                        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Jumlah Nota Manual</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>
                            {manualOrdersList.length} Pesanan
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 18 }}>
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Omset Bersih</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#34d399' }}>{rupiah(rev.net_sales)}</div>
                        </div>
                        <div
                          onClick={() => setModalFilter('GENERATE')}
                          style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.25)', borderRadius: 10, padding: 12, cursor: 'pointer' }}
                          title="Klik untuk filter Nota Generate"
                        >
                          <div style={{ fontSize: 11, color: '#38bdf8' }}>Nota Generate</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#06b6d4' }}>
                            {rupiah(generateOrdersList.reduce((s, o) => s + o.total_price, 0))}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{generateOrdersList.length} pesanan</div>
                        </div>
                        <div
                          onClick={() => setModalFilter('MANUAL')}
                          style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 10, padding: 12, cursor: 'pointer' }}
                          title="Klik untuk filter Nota Manual"
                        >
                          <div style={{ fontSize: 11, color: '#fbbf24' }}>Nota Manual</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b' }}>
                            {rupiah(manualOrdersList.reduce((s, o) => s + o.total_price, 0))}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{manualOrdersList.length} pesanan</div>
                        </div>
                        <div
                          onClick={() => setModalFilter('DISCOUNT')}
                          style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 10, padding: 12, cursor: 'pointer' }}
                          title="Klik untuk melihat hanya diskon"
                        >
                          <div style={{ fontSize: 11, color: '#f87171' }}>Total Diskon & Promo</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#f87171' }}>({rupiah(rev.total_discount)})</div>
                          <div style={{ fontSize: 10.5, color: '#fca5a5', fontWeight: 700 }}>{discountOrdersList.length} pesanan berdiskon</div>
                        </div>
                      </div>
                    )}

                    {/* Quick Search inside modal */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 380 }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          className="form-control"
                          placeholder={modalFilter === 'DISCOUNT' ? 'Cari no. order, voucher/promo, menu...' : 'Cari no. order, pelanggan, menu...'}
                          value={modalSearch}
                          onChange={(e) => setModalSearch(e.target.value)}
                          style={{ paddingLeft: 32, fontSize: 12, height: 32 }}
                        />
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        Menampilkan <strong>{displayedOrders.length}</strong> pesanan
                      </div>
                    </div>

                    {/* Table View */}
                    {modalFilter === 'DISCOUNT' ? (
                      /* DEDICATED DISCOUNT TABLE (HANYA DISKON SAJA) */
                      <div style={{ overflowX: 'auto', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 10 }}>
                        <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'rgba(244, 63, 94, 0.08)', textAlign: 'left', borderBottom: '1px solid rgba(244, 63, 94, 0.2)' }}>
                              <th style={{ padding: '10px 14px' }}>No. Order / Waktu</th>
                              <th style={{ padding: '10px 14px' }}>Pelanggan / Meja</th>
                              <th style={{ padding: '10px 14px' }}>Tipe Nota</th>
                              <th style={{ padding: '10px 14px' }}>Menu yang Dipesan</th>
                              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Harga Normal</th>
                              <th style={{ padding: '10px 14px' }}>Nama / Jenis Diskon</th>
                              <th style={{ padding: '10px 14px', textAlign: 'right', color: '#f87171' }}>POTONGAN DISKON</th>
                              <th style={{ padding: '10px 14px', textAlign: 'right', color: '#34d399' }}>Total Bersih</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayedOrders.length > 0 ? (
                              displayedOrders.map(o => (
                                <tr key={o.key} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                  <td style={{ padding: '10px 14px' }}>
                                    <strong style={{ color: 'var(--accent-bright)' }}>{o.order_number}</strong>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                      {o.created_at ? o.created_at.slice(0, 16).replace('T', ' ') : o.date}
                                    </div>
                                  </td>
                                  <td style={{ padding: '10px 14px', color: '#e2e8f0' }}>
                                    {o.customer_name}
                                    {o.table_number && <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Meja: {o.table_number}</span>}
                                  </td>
                                  <td style={{ padding: '10px 14px' }}>
                                    {o.is_urgent_note ? (
                                      <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 11, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 700 }}>
                                        Manual
                                      </span>
                                    ) : (
                                      <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 11, background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', fontWeight: 700 }}>
                                        Generate
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px 14px', color: '#cbd5e1', maxWidth: 220 }}>
                                    {o.items.map(it => `${it.qty}x ${it.name}`).join(', ') || '-'}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8', fontWeight: 600 }}>
                                    {rupiah(o.subtotal)}
                                  </td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                      <Tag size={11} /> {o.discount_name || (o.discount_rate ? `Diskon ${o.discount_rate}%` : 'Diskon Kasir')}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#f87171', fontSize: 13 }}>
                                    -{rupiah(o.discount_amount)}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#34d399', fontSize: 13 }}>
                                    {rupiah(o.total_price)}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={8} style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
                                  Tidak ada transaksi yang mendapatkan potongan diskon pada periode ini.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      /* STANDARD TRANSACTIONS TABLE (WITH GENERATE / MANUAL BADGES) */
                      <div style={{ overflowX: 'auto', border: '1px solid rgba(165, 180, 252, 0.12)', borderRadius: 10 }}>
                        <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255, 255, 255, 0.04)', textAlign: 'left', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                              <th style={{ padding: '10px 14px' }}>No. Order / Waktu</th>
                              <th style={{ padding: '10px 14px' }}>Pelanggan / Meja</th>
                              <th style={{ padding: '10px 14px' }}>Tipe Nota</th>
                              <th style={{ padding: '10px 14px' }}>Metode Bayar</th>
                              <th style={{ padding: '10px 14px' }}>Detail Menu Item</th>
                              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Kotor</th>
                              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Diskon</th>
                              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Bersih (Rp)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayedOrders.length > 0 ? (
                              displayedOrders.map(o => (
                                <tr key={o.key} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                  <td style={{ padding: '10px 14px' }}>
                                    <strong style={{ color: 'var(--accent-bright)' }}>{o.order_number}</strong>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                      {o.created_at ? o.created_at.slice(0, 16).replace('T', ' ') : o.date}
                                    </div>
                                  </td>
                                  <td style={{ padding: '10px 14px', color: '#e2e8f0' }}>
                                    {o.customer_name}
                                    {o.table_number && <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Meja: {o.table_number}</span>}
                                  </td>
                                  <td style={{ padding: '10px 14px' }}>
                                    {o.is_urgent_note ? (
                                      <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 11, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 700 }}>
                                        Nota Manual
                                      </span>
                                    ) : (
                                      <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 11, background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', fontWeight: 700 }}>
                                        Nota Generate
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 11, background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontWeight: 700 }}>
                                      {o.payment_method}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 14px', color: '#cbd5e1', maxWidth: 220 }}>
                                    {o.items.map(it => `${it.qty}x ${it.name}`).join(', ') || '-'}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8' }}>
                                    {rupiah(o.subtotal)}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', color: o.discount_amount > 0 ? '#f87171' : 'var(--text-muted)', fontWeight: o.discount_amount > 0 ? 700 : 400 }}>
                                    {o.discount_amount > 0 ? `-${rupiah(o.discount_amount)}` : '—'}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#34d399', fontSize: 13 }}>
                                    {rupiah(o.total_price)}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={8} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                                  Tidak ada rincian transaksi penjualan pada kategori ini.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. COGS DETAIL */}
                {detailModal.type === 'COGS' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
                      <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total HPP Riil (COGS)</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#818cf8' }}>{rupiah(cogs.total_cogs)}</div>
                        <div style={{ fontSize: 11, color: '#818cf8', fontWeight: 600 }}>Rasio Food Cost: {cogs.cogs_ratio_pct}%</div>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>HPP Resep Standard</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#ffffff' }}>{rupiah(cogs.cogs_recipes)}</div>
                      </div>
                      <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Selisih Variance Opname (Susut)</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>{rupiah(cogs.cogs_variance)}</div>
                      </div>
                    </div>

                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: '#f8fafc' }}>
                      Top 10 Bahan Baku Terbanyak Terpakai (Resep Menus Terjual):
                    </h4>
                    <div style={{ overflowX: 'auto', border: '1px solid rgba(165, 180, 252, 0.12)', borderRadius: 10 }}>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255, 255, 255, 0.04)', textAlign: 'left', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <th style={{ padding: '10px 14px' }}>Nama Bahan Baku</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Qty Terpakai</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Nilai Rp HPP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cogs.top_ingredients_usage && cogs.top_ingredients_usage.length > 0 ? (
                            cogs.top_ingredients_usage.map((ing, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#ffffff' }}>
                                  {ing.name || ing.ingredient_name || 'Bahan Baku'}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#cbd5e1' }}>
                                  {num(ing.qty, 1)} {ing.unit || 'Pcs'}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#818cf8' }}>
                                  {rupiah(ing.total_hpp ?? ing.cost ?? 0)}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                                Belum ada rincian bahan baku terpakai pada periode ini.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2.5 GROSS PROFIT DETAIL */}
                {detailModal.type === 'GROSS_PROFIT' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
                      <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Laba Kotor (Gross Profit)</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#34d399' }}>{rupiah(cogs.gross_profit)}</div>
                        <div style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>Gross Margin: {cogs.gross_margin_pct}%</div>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Omset Bersih (Net Revenue)</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#ffffff' }}>{rupiah(rev.net_sales)}</div>
                      </div>
                      <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total HPP Riil (COGS)</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#818cf8' }}>({rupiah(cogs.total_cogs)})</div>
                        <div style={{ fontSize: 11, color: '#818cf8' }}>Food Cost Ratio: {cogs.cogs_ratio_pct}%</div>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(165, 180, 252, 0.15)', borderRadius: 12, padding: 20 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#f8fafc' }}>
                        Penjelasan Kalkulasi Laba Kotor:
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 8 }}>
                          <span>(+) Omset Penjualan Bersih (Net Sales):</span>
                          <strong style={{ color: '#34d399' }}>{rupiah(rev.net_sales)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 8 }}>
                          <span>(-) Total HPP Riil (Resep Terpakai + Susut Opname):</span>
                          <strong style={{ color: '#818cf8' }}>({rupiah(cogs.total_cogs)})</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)', borderRadius: 8, fontWeight: 800, fontSize: 14 }}>
                          <span>(=) Laba Kotor (Gross Profit):</span>
                          <strong style={{ color: '#34d399' }}>{rupiah(cogs.gross_profit)} ({cogs.gross_margin_pct}%)</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. WASTE DETAIL */}
                {detailModal.type === 'WASTE' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
                      <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Kerugian Waste</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#f87171' }}>{rupiah(wst.total_waste_loss)}</div>
                        <div style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>Rasio Waste: {wst.waste_ratio_pct}% dari omset</div>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Jumlah Kejadian Waste</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff' }}>{detailModal.items.length} Log</div>
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto', border: '1px solid rgba(165, 180, 252, 0.12)', borderRadius: 10 }}>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255, 255, 255, 0.04)', textAlign: 'left', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <th style={{ padding: '10px 14px' }}>Tanggal</th>
                            <th style={{ padding: '10px 14px' }}>Tipe</th>
                            <th style={{ padding: '10px 14px' }}>Nama Item (Bahan / Menu)</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Qty Terbuang</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Kerugian (Rp)</th>
                            <th style={{ padding: '10px 14px' }}>Alasan & Catatan</th>
                            <th style={{ padding: '10px 14px' }}>Operator</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailModal.items.length > 0 ? (
                            detailModal.items.map(item => (
                              <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11.5 }}>
                                  {item.date ? item.date.slice(0, 10) : item.created_at?.slice(0, 10)}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: item.item_type === 'MENU' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: item.item_type === 'MENU' ? '#c084fc' : '#60a5fa' }}>
                                    {item.item_type || 'BAHAN'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#ffffff' }}>
                                  {item.name || item.ingredient?.name || item.menu?.name || 'Item Waste'}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#cbd5e1' }}>
                                  {num(item.quantity || item.qty, 1)} {item.unit || item.ingredient?.unit_pakai || ''}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#f87171' }}>
                                  {rupiah(item.loss_amount || item.total_loss || 0)}
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                                  <strong style={{ color: '#fbbf24' }}>{item.reason}</strong>
                                  {item.notes && <div style={{ fontStyle: 'italic', fontSize: 11 }}>"{item.notes}"</div>}
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11.5 }}>
                                  {item.user_name || item.user?.name || 'Staff'}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                                Tidak ada catatan kerugian waste pada periode ini.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. OPEX DETAIL */}
                {detailModal.type === 'OPEX' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
                      <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Beban OPEX</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#fbbf24' }}>{rupiah(opx.total_opex)}</div>
                        <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>Rasio OPEX: {opx.opex_ratio_pct}% dari omset</div>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Jumlah Catatan Pengeluaran</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff' }}>{detailModal.items.length} Pos Biaya</div>
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto', border: '1px solid rgba(165, 180, 252, 0.12)', borderRadius: 10 }}>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255, 255, 255, 0.04)', textAlign: 'left', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <th style={{ padding: '10px 14px' }}>No. Bukti / Tanggal</th>
                            <th style={{ padding: '10px 14px' }}>Kategori OPEX</th>
                            <th style={{ padding: '10px 14px' }}>Nama & Deskripsi Biaya</th>
                            <th style={{ padding: '10px 14px' }}>Metode Pembayaran</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Nominal (Rp)</th>
                            <th style={{ padding: '10px 14px' }}>Operator</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailModal.items.length > 0 ? (
                            detailModal.items.map(item => (
                              <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                <td style={{ padding: '10px 14px' }}>
                                  <strong style={{ color: '#f8fafc' }}>{item.expense_no || `EXP-${item.id}`}</strong>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.date ? item.date.slice(0, 10) : '-'}</div>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                    {item.category_label || item.category}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px', color: '#ffffff', fontWeight: 600 }}>
                                  {item.name}
                                  {item.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>"{item.notes}"</div>}
                                </td>
                                <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                                  💳 {item.payment_method_label || item.payment_method || 'CASH'}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#f87171', fontSize: 13.5 }}>
                                  {rupiah(item.amount)}
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11.5 }}>
                                  {item.user_name || item.user?.name || 'Kasir/Admin'}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                                Tidak ada catatan biaya operasional pada periode ini.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5. NET PROFIT DETAIL */}
                {detailModal.type === 'NET_PROFIT' && (
                  <div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(165, 180, 252, 0.15)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 14px 0', color: bot.health_color, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Landmark size={18} /> Formula & Jembatan Kalkulasi Laba Bersih Usaha
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, borderLeft: '4px solid #10b981' }}>
                          <span>(+) Omset Penjualan Bersih (Net Sales)</span>
                          <strong style={{ color: '#34d399' }}>{rupiah(rev.net_sales)}</strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 8, borderLeft: '4px solid #6366f1' }}>
                          <span>(-) Harga Pokok Penjualan (HPP Riil Resep + Opname)</span>
                          <strong style={{ color: '#818cf8' }}>({rupiah(cogs.total_cogs)})</strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, fontWeight: 700 }}>
                          <span>(=) Laba Kotor (Gross Profit)</span>
                          <strong style={{ color: '#ffffff' }}>{rupiah(cogs.gross_profit)}</strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(244, 63, 94, 0.1)', borderRadius: 8, borderLeft: '4px solid #f43f5e' }}>
                          <span>(-) Kerugian Bahan Terbuang (Waste Loss)</span>
                          <strong style={{ color: '#f87171' }}>({rupiah(wst.total_waste_loss)})</strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, fontWeight: 700 }}>
                          <span>(=) Laba Operasional Setelah Waste</span>
                          <strong style={{ color: '#ffffff' }}>{rupiah(wst.operating_profit_after_waste)}</strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 8, borderLeft: '4px solid #f59e0b' }}>
                          <span>(-) Beban Operasional Toko (OPEX)</span>
                          <strong style={{ color: '#fbbf24' }}>({rupiah(opx.total_opex)})</strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 18px', background: `linear-gradient(135deg, ${bot.health_color}25 0%, rgba(15, 23, 42, 0.95) 100%)`, borderRadius: 10, border: `2px solid ${bot.health_color}60`, fontWeight: 900, fontSize: 16 }}>
                          <span>(=) LABA BERSIH USAHA AKHIR (NET PROFIT)</span>
                          <strong style={{ color: bot.net_profit >= 0 ? bot.health_color : '#f43f5e', fontSize: 18 }}>{rupiah(bot.net_profit)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Modal Footer */}
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(165, 180, 252, 0.12)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setDetailModal(p => ({ ...p, open: false }))}
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. HIDDEN PRINTABLE CONTAINER FOR BENCHMARK MATRIX */}
      <div id="printable-benchmark-matrix" style={{ display: 'none' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", color: '#000000', padding: 20 }}>
          <div style={{ borderBottom: '2px solid #000', paddingBottom: 12, marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {businessTitle}
            </h2>
            <div style={{ fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
              MATRIKS BENCHMARK PERFORMA ANTAR-CABANG (SIDE-BY-SIDE OUTLET COMPARISON)
            </div>
            <div style={{ fontSize: 11, color: '#333', marginTop: 4 }}>
              Periode Evaluasi: {dateFrom} s/d {dateTo} | Dicetak: {new Date().toLocaleString('id-ID')}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #000' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>OUTLET / CABANG</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>OMSET BERSIH</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>SHARE (%)</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>HPP RIIL (COGS)</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>WASTE LOSS</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>BEBAN GAJI</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>TOTAL OPEX</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>LABA BERSIH</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>MARGIN (%)</th>
                <th style={{ textAlign: 'center', padding: '6px 8px' }}>STATUS / PREDIKAT</th>
              </tr>
            </thead>
            <tbody>
              {benchmarkData?.outlets?.map(item => (
                <tr key={item.outlet.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>
                    {item.outlet.name} {item.outlet.is_main ? '(Pusat)' : ''}
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 8px' }}>{rupiah(item.revenue.net_sales)}</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px' }}>{item.revenue.share_pct}%</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px' }}>{rupiah(item.cogs.total_cogs)} ({item.cogs.cogs_ratio_pct}%)</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px' }}>{rupiah(item.waste.total_waste_loss)} ({item.waste.waste_ratio_pct}%)</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px' }}>{rupiah(item.opex.salary_amount)} ({item.opex.salary_ratio_pct}%)</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px' }}>{rupiah(item.opex.total_opex)} ({item.opex.opex_ratio_pct}%)</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 'bold' }}>{rupiah(item.bottom_line.net_profit)}</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 'bold' }}>{item.bottom_line.net_margin_pct}%</td>
                  <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                    {item.tags?.map(t => t.label).join(', ') || item.bottom_line.health_label}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {benchmarkData?.consolidated && (
                <tr style={{ background: '#f8fafc', borderTop: '2px solid #000', fontWeight: 'bold' }}>
                  <td style={{ padding: '8px' }}>TOTAL KONSOLIDASIAN GRUP</td>
                  <td style={{ textAlign: 'right', padding: '8px' }}>{rupiah(benchmarkData.consolidated.net_sales)}</td>
                  <td style={{ textAlign: 'right', padding: '8px' }}>100.0%</td>
                  <td style={{ textAlign: 'right', padding: '8px' }}>{rupiah(benchmarkData.consolidated.total_cogs)} ({benchmarkData.consolidated.cogs_ratio_pct}%)</td>
                  <td style={{ textAlign: 'right', padding: '8px' }}>{rupiah(benchmarkData.consolidated.total_waste_loss)} ({benchmarkData.consolidated.waste_ratio_pct}%)</td>
                  <td style={{ textAlign: 'right', padding: '8px' }}>{rupiah(benchmarkData.consolidated.salary_amount)} ({benchmarkData.consolidated.salary_ratio_pct}%)</td>
                  <td style={{ textAlign: 'right', padding: '8px' }}>{rupiah(benchmarkData.consolidated.total_opex)} ({benchmarkData.consolidated.opex_ratio_pct}%)</td>
                  <td style={{ textAlign: 'right', padding: '8px' }}>{rupiah(benchmarkData.consolidated.net_profit)}</td>
                  <td style={{ textAlign: 'right', padding: '8px' }}>{benchmarkData.consolidated.net_margin_pct}%</td>
                  <td style={{ textAlign: 'center', padding: '8px' }}>{benchmarkData.consolidated.total_outlets} Outlets</td>
                </tr>
              )}
            </tfoot>
          </table>

          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', padding: '0 40px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, marginBottom: 50 }}>Dibuat Oleh (Finance / Accounting):</div>
              <div style={{ borderTop: '1px solid #000', paddingTop: 4, fontWeight: 'bold', fontSize: 11 }}>
                {currentUser?.name || 'Staff Accounting'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, marginBottom: 50 }}>Disetujui Oleh (Owner Resto / Direktur):</div>
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
