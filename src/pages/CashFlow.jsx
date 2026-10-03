import { useState, useEffect, useMemo } from 'react';
import {
  Wallet, DollarSign, TrendingUp, TrendingDown, ArrowDownLeft,
  ArrowUpRight, RefreshCw, Printer, Plus, Search, Filter,
  Building2, Layers, CheckCircle2, AlertCircle, Sparkles,
  HelpCircle, Store, Edit3, Trash, Info, Package, Landmark, Flame,
  Clock, CheckSquare, Square, X, SlidersHorizontal, Check, UserCheck, ChevronDown, Scale, Coins, ArrowRightLeft
} from 'lucide-react';
import api from '../api/client';
import { rupiah, num, pct, LoadingState, PageHeader, PeriodPicker } from '../components/ui';
import { getTodayStr, getMonthStartStr, getMonthEndStr } from '../utils/date';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import { printElement } from '../utils/print';
import { confirmDialog } from '../utils/swal';

export const ACTIVITY_TYPES = [
  { value: 'OPERATING', label: 'Operasi (Operating)', color: '#10b981' },
  { value: 'INVESTING', label: 'Investasi (CapEx)', color: '#8b5cf6' },
  { value: 'FINANCING', label: 'Pendanaan (Financing)', color: '#ec4899' },
];

export const CASH_CATEGORIES = [
  // CapEx / Investing
  { value: 'EQUIPMENT', label: 'Peralatan & Mesin Dapur (CapEx)', activity: 'INVESTING', defaultType: 'OUT' },
  { value: 'RENOVATION', label: 'Renovasi Bangunan & Interior (CapEx)', activity: 'INVESTING', defaultType: 'OUT' },
  { value: 'FURNITURE', label: 'Furnitur & Peralatan Saji (CapEx)', activity: 'INVESTING', defaultType: 'OUT' },
  { value: 'TECH_POS', label: 'Perangkat POS & IT Hardware (CapEx)', activity: 'INVESTING', defaultType: 'OUT' },
  { value: 'ASSET_SALE', label: 'Penjualan Aset Bekas (Kas Masuk)', activity: 'INVESTING', defaultType: 'IN' },

  // Financing
  { value: 'CAPITAL_INJECTION', label: 'Setoran Modal Owner / Investor', activity: 'FINANCING', defaultType: 'IN' },
  { value: 'OWNER_WITHDRAWAL', label: 'Prive / Penarikan Kas Pribadi Owner', activity: 'FINANCING', defaultType: 'OUT' },
  { value: 'LOAN_RECEIPT', label: 'Penerimaan Pinjaman Usaha', activity: 'FINANCING', defaultType: 'IN' },
  { value: 'LOAN_REPAYMENT', label: 'Pembayaran Pokok Pinjaman', activity: 'FINANCING', defaultType: 'OUT' },

  // Operating Extra
  { value: 'SUPPLIER_PURCHASE', label: 'Belanja Bahan Baku Langsung', activity: 'OPERATING', defaultType: 'OUT' },
  { value: 'OTHER_INCOME', label: 'Pendapatan Kas Operasional Lain', activity: 'OPERATING', defaultType: 'IN' },
  { value: 'OTHER_EXPENSE', label: 'Biaya Kas Operasional Lain', activity: 'OPERATING', defaultType: 'OUT' },
];

export const ACCOUNT_TYPES = [
  { value: 'BANK_MAIN', label: 'Rekening Bank Utama Resto' },
  { value: 'CASH_DRAWER', label: 'Kas Toko / Laci Kasir' },
];

export const AVAILABLE_PAYMENT_METHODS = [
  { id: 'CASH', label: 'Kas Laci Kasir (Cash)', desc: 'Uang fisik tunai transaksi penjualan & belanja di laci kasir', color: '#10b981', icon: Wallet },
  { id: 'QRIS', label: 'QRIS', desc: 'QRIS BCA, GoPay, ShopeePay, Dana', color: '#06b6d4', icon: Sparkles },
  { id: 'GRAB', label: 'Grab / E-Commerce', desc: 'GrabFood, GoFood, ShopeeFood, TikTok', color: '#f59e0b', icon: Flame },
  { id: 'TRANSFER', label: 'Transfer Bank', desc: 'BCA, Mandiri, BRI & Rekening Giro', color: '#8b5cf6', icon: Landmark },
  { id: 'DEBIT', label: 'Debit / EDC', desc: 'Kartu Debit & Mesin Gesek EDC', color: '#ec4899', icon: DollarSign },
];

export const PAYMENT_METHOD_TABS = [
  { id: 'ALL', label: 'Semua Metode', sub: 'Semua Aliran Kas Gabungan', color: '#38bdf8', icon: Layers, isPreset: true },
  { id: 'NON_CASH', label: 'Gabungan Non-Tunai', sub: 'QRIS + Grab + Transfer + EDC', color: '#06b6d4', icon: Sparkles, isPreset: true },
  { id: 'ECOMMERCE_ALL', label: 'Gabungan E-Commerce', sub: 'Grab + GoFood + ShopeeFood', color: '#f59e0b', icon: Flame, isPreset: true },
  { id: 'CASH', label: 'Kas Laci Kasir', sub: 'Uang Fisik di Laci POS / Tunai', color: '#10b981', icon: Wallet },
  { id: 'QRIS', label: 'QRIS', sub: 'BCA, GoPay, Shopee', color: '#06b6d4', icon: Sparkles },
  { id: 'GRAB', label: 'Grab / Delivery', sub: 'E-Commerce Delivery', color: '#f59e0b', icon: Flame },
  { id: 'TRANSFER', label: 'Transfer Bank', sub: 'Rekening Bank', color: '#8b5cf6', icon: Landmark },
  { id: 'DEBIT', label: 'Debit / EDC', sub: 'Kartu Debit & EDC', color: '#ec4899', icon: DollarSign },
];

export default function CashFlow() {
  const { activeOutletId, activeOutlet, outlets, currentBusiness, dateFrom, dateTo } = useOutlet();
  const currentUser = JSON.parse(localStorage.getItem('pos_user') || '{}');

  const todayStr = getTodayStr();
  const [activeTab, setActiveTab] = useState('statement'); // 'statement' | 'reconciliation' | 'journal'
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('ALL');
  const [selectedShift, setSelectedShift] = useState('ALL'); // 'ALL' | single ID | comma-separated IDs e.g. '1,2'

  // Modals for multi-select / combined filters
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [tempShiftIds, setTempShiftIds] = useState([]);
  const [customPmModalOpen, setCustomPmModalOpen] = useState(false);
  const [tempPmList, setTempPmList] = useState([]);

  const [loading, setLoading] = useState(true);
  const [statementData, setStatementData] = useState(null);
  const [journalEntries, setJournalEntries] = useState([]);

  const availableShifts = statementData?.available_shifts || [];

  // Active Payment Method metadata
  const activePmMeta = useMemo(() => {
    if (!selectedPaymentMethod || selectedPaymentMethod === 'ALL' || selectedPaymentMethod === 'all') {
      return { id: 'ALL', label: 'Semua Metode (Gabungan Total)', sub: 'Semua Aliran Kas Gabungan', color: '#38bdf8', icon: Layers, isAll: true };
    }
    const predefined = PAYMENT_METHOD_TABS.find(t => t.id === selectedPaymentMethod);
    if (predefined) return predefined;

    // Custom multi-select comma separated
    const parts = selectedPaymentMethod.split(',').map(s => s.trim().toUpperCase());
    const labels = parts.map(p => {
      const match = AVAILABLE_PAYMENT_METHODS.find(m => m.id === p);
      return match ? match.label : p;
    });
    return {
      id: selectedPaymentMethod,
      label: `Gabungan (${labels.join(' + ')})`,
      sub: `${parts.length} metode pembayaran dipilih`,
      color: '#a855f7',
      icon: SlidersHorizontal,
      isCustomCombined: true,
      parts,
    };
  }, [selectedPaymentMethod]);

  // Active Shift metadata and calculated initial cash & closing discrepancy
  const activeShiftMeta = useMemo(() => {
    // Chronological shifts for inter-shift handover discrepancy
    const chronShifts = [...(availableShifts || [])].sort((a, b) => {
      const dateA = a.opened_at || a.created_at || '';
      const dateB = b.opened_at || b.created_at || '';
      return dateA.localeCompare(dateB) || Number(a.id) - Number(b.id);
    });

    const shiftInterMap = {};
    let prevClosedShift = null;
    chronShifts.forEach(cs => {
      let diffAntar = Number(cs.inter_shift_diff ?? 0);
      let prevName = cs.prev_shift_name || null;
      let prevClosing = cs.prev_closing_cash != null ? Number(cs.prev_closing_cash) : null;

      if (prevClosedShift && prevClosedShift.closing_cash !== null && prevClosedShift.closing_cash !== undefined) {
        if (!cs.inter_shift_diff && cs.inter_shift_diff !== 0) {
          prevClosing = Number(prevClosedShift.closing_cash || 0);
          prevName = prevClosedShift.shift_name;
          diffAntar = Number(cs.initial_cash || 0) - prevClosing;
        } else if (!prevName) {
          prevName = prevClosedShift.shift_name;
          prevClosing = Number(prevClosedShift.closing_cash || 0);
        }
      }

      shiftInterMap[cs.id] = {
        diffAntar,
        prevName,
        prevClosing,
      };

      if (cs.status === 'CLOSED' && cs.closing_cash !== null && cs.closing_cash !== undefined) {
        prevClosedShift = cs;
      }
    });

    const allInitial = (availableShifts || []).reduce((acc, s) => acc + Number(s.initial_cash || 0), 0);
    const closedShifts = (availableShifts || []).filter(s => s.status === 'CLOSED');
    const allClosing = closedShifts.reduce((acc, s) => acc + Number(s.closing_cash || 0), 0);
    const allSystem = closedShifts.reduce((acc, s) => acc + Number(s.system_cash || 0), 0);
    const allDiff = closedShifts.reduce((acc, s) => acc + Number(s.cash_difference || 0), 0);
    const allInterDiff = (availableShifts || []).reduce((acc, s) => acc + (shiftInterMap[s.id]?.diffAntar || Number(s.inter_shift_diff || 0)), 0);

    if (!selectedShift || selectedShift === 'ALL' || selectedShift === 'all') {
      return {
        id: 'ALL',
        label: 'Semua Shift (Gabungan Total)',
        isAll: true,
        count: availableShifts.length,
        closedCount: closedShifts.length,
        initialCashTotal: statementData?.summary?.initial_cash_total ?? allInitial,
        closingCashTotal: statementData?.summary?.closing_cash_total ?? allClosing,
        systemCashTotal: statementData?.summary?.system_cash_total ?? allSystem,
        cashDifferenceTotal: statementData?.summary?.cash_difference_total ?? allDiff,
        interShiftDiffTotal: statementData?.summary?.inter_shift_difference_total ?? allInterDiff,
        prevShiftName: null,
        prevClosingCash: null,
        shifts: availableShifts,
        closedShifts: closedShifts,
        shiftNames: 'Semua Shift Gabungan',
      };
    }

    const ids = selectedShift.toString().split(',').map(id => Number(id.trim())).filter(Boolean);
    const matchedShifts = (availableShifts || []).filter(s => ids.includes(s.id));
    const matchedClosed = matchedShifts.filter(s => s.status === 'CLOSED');
    const totalInitial = matchedShifts.reduce((acc, s) => acc + Number(s.initial_cash || 0), 0);
    const totalClosing = matchedClosed.reduce((acc, s) => acc + Number(s.closing_cash || 0), 0);
    const totalSystem = matchedClosed.reduce((acc, s) => acc + Number(s.system_cash || 0), 0);
    const totalDiff = matchedClosed.reduce((acc, s) => acc + Number(s.cash_difference || 0), 0);
    const totalInterDiff = matchedShifts.reduce((acc, s) => acc + (shiftInterMap[s.id]?.diffAntar || Number(s.inter_shift_diff || 0)), 0);

    if (ids.length === 1) {
      const s = matchedShifts[0] || (availableShifts || []).find(x => x.id === ids[0]);
      const isClosed = s?.status === 'CLOSED';
      const inter = shiftInterMap[s?.id] || { diffAntar: Number(s?.inter_shift_diff || 0), prevName: s?.prev_shift_name, prevClosing: s?.prev_closing_cash };
      return {
        id: selectedShift,
        label: s ? `${s.shift_name} (${s.cashier_name || 'Kasir'})` : `Shift ${ids[0]}`,
        isSingle: true,
        count: 1,
        closedCount: isClosed ? 1 : 0,
        shift: s,
        shifts: s ? [s] : [],
        closedShifts: isClosed ? [s] : [],
        initialCashTotal: s ? Number(s.initial_cash || 0) : totalInitial,
        closingCashTotal: isClosed ? Number(s.closing_cash || 0) : totalClosing,
        systemCashTotal: isClosed ? Number(s.system_cash || 0) : totalSystem,
        cashDifferenceTotal: isClosed ? Number(s.cash_difference || 0) : totalDiff,
        interShiftDiffTotal: inter.diffAntar,
        prevShiftName: inter.prevName,
        prevClosingCash: inter.prevClosing,
        shiftNames: s ? s.shift_name : `Shift ${ids[0]}`,
      };
    }

    const names = matchedShifts.map(s => s.shift_name).join(', ') || ids.map(i => `Shift ${i}`).join(', ');
    return {
      id: selectedShift,
      label: `Gabungan ${ids.length} Shift (${names})`,
      isCombined: true,
      count: ids.length,
      closedCount: matchedClosed.length,
      shifts: matchedShifts,
      closedShifts: matchedClosed,
      initialCashTotal: totalInitial,
      closingCashTotal: totalClosing,
      systemCashTotal: totalSystem,
      cashDifferenceTotal: totalDiff,
      interShiftDiffTotal: totalInterDiff,
      prevShiftName: null,
      prevClosingCash: null,
      shiftNames: names,
    };
  }, [selectedShift, availableShifts, statementData]);

  // Detail Drilldown Modal State
  const [detailModal, setDetailModal] = useState({
    open: false,
    type: null, // 'OPERATING' | 'SALES_INFLOW' | 'RECEIVABLE_INFLOW' | 'PURCHASES_OUTFLOW' | 'OPEX_OUTFLOW' | 'INVESTING' | 'FINANCING' | 'NET_CASH' | 'INVENTORY_TRAPPED'
    subTab: 'DIRECT', // 'DIRECT' | 'RECEIVABLE' | 'COMBINED'
    title: '',
    loading: false,
    items: [],
    extraData: null,
  });

  async function handleCardClick(type, initialSubTab = null) {
    const targetOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all'
      ? activeOutletId
      : undefined;
    const pm = selectedPaymentMethod !== 'ALL' ? selectedPaymentMethod : undefined;
    const shift = selectedShift !== 'ALL' ? selectedShift : undefined;
    const pmLabel = activePmMeta?.label || 'Semua Metode';
    const shiftLabel = selectedShift !== 'ALL' ? ` [${activeShiftMeta?.label}]` : '';

    if (type === 'SALES_INFLOW' || type === 'RECEIVABLE_INFLOW' || type === 'INFLOWS_ALL') {
      const directTotal = Number(statementData?.operating?.inflows?.direct_sales_total || 0);
      const recTotal = Number(statementData?.operating?.inflows?.receivable_collections || 0);
      let chosenSubTab = initialSubTab;
      if (!chosenSubTab) {
        if (type === 'RECEIVABLE_INFLOW') {
          chosenSubTab = 'RECEIVABLE';
        } else if (type === 'INFLOWS_ALL') {
          chosenSubTab = 'COMBINED';
        } else {
          chosenSubTab = (directTotal === 0 && recTotal > 0) ? 'RECEIVABLE' : 'DIRECT';
        }
      }

      setDetailModal({
        open: true,
        type: 'SALES_INFLOW',
        subTab: chosenSubTab,
        title: `Rincian Kas Masuk Operasional Kasir (${pmLabel}${shiftLabel})`,
        loading: true,
        items: [],
        extraData: statementData?.operating?.inflows
      });
      try {
        const res = await api.get('/transactions', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet, status: 'PAID', exclude_kasbon: 1, payment_method: pm, shift_id: shift, limit: 200 }
        });
        setDetailModal(p => ({ ...p, loading: false, items: res.data?.data || res.data || [] }));
      } catch {
        toast.error('Gagal memuat rincian transaksi kasir');
        setDetailModal(p => ({ ...p, loading: false }));
      }
    } else if (type === 'PURCHASES_OUTFLOW') {
      setDetailModal({
        open: true,
        type: 'PURCHASES_OUTFLOW',
        title: `Rincian Kas Keluar untuk Pembelian Stok Bahan Baku (${pmLabel}${shiftLabel})`,
        loading: true,
        items: [],
        extraData: statementData?.operating?.top_purchases
      });
      try {
        const res = await api.get('/movements', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet, type: 'PURCHASE', payment_type: pm, shift_id: shift }
        });
        setDetailModal(p => ({ ...p, loading: false, items: res.data || [] }));
      } catch {
        toast.error('Gagal memuat rincian pembelian stok');
        setDetailModal(p => ({ ...p, loading: false }));
      }
    } else if (type === 'OPEX_OUTFLOW') {
      setDetailModal({
        open: true,
        type: 'OPEX_OUTFLOW',
        title: `Rincian Kas Keluar untuk Beban Operasional Toko (${pmLabel}${shiftLabel})`,
        loading: true,
        items: []
      });
      try {
        const res = await api.get('/expenses', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet, payment_method: pm }
        });
        setDetailModal(p => ({ ...p, loading: false, items: res.data || [] }));
      } catch {
        toast.error('Gagal memuat rincian biaya operasional');
        setDetailModal(p => ({ ...p, loading: false }));
      }
    } else if (type === 'OPERATING') {
      setDetailModal({ open: true, type: 'OPERATING', title: `Rincian & Formula Arus Kas Operasi (Operating Cash Flow / OCF) - ${pmLabel}${shiftLabel}`, loading: false, items: [] });
    } else if (type === 'INVESTING') {
      setDetailModal({
        open: true,
        type: 'INVESTING',
        title: `Rincian Belanja Modal & Investasi Aset (${pmLabel}${shiftLabel})`,
        loading: true,
        items: []
      });
      try {
        const res = await api.get('/cash-transactions', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet, activity_type: 'INVESTING', payment_method: pm }
        });
        setDetailModal(p => ({ ...p, loading: false, items: res.data || [] }));
      } catch {
        toast.error('Gagal memuat rincian belanja modal');
        setDetailModal(p => ({ ...p, loading: false }));
      }
    } else if (type === 'FINANCING') {
      setDetailModal({
        open: true,
        type: 'FINANCING',
        title: `Rincian Arus Kas Pendanaan, Modal & Prive Owner (${pmLabel}${shiftLabel})`,
        loading: true,
        items: []
      });
      try {
        const res = await api.get('/cash-transactions', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet, activity_type: 'FINANCING', payment_method: pm }
        });
        setDetailModal(p => ({ ...p, loading: false, items: res.data || [] }));
      } catch {
        toast.error('Gagal memuat rincian mutasi pendanaan');
        setDetailModal(p => ({ ...p, loading: false }));
      }
    } else if (type === 'NET_CASH') {
      setDetailModal({ open: true, type: 'NET_CASH', title: `Jembatan Total Perubahan Bersih Kas Riil (Net Cash Flow) - ${pmLabel}${shiftLabel}`, loading: false, items: [] });
    } else if (type === 'INVENTORY_TRAPPED') {
      setDetailModal({ open: true, type: 'INVENTORY_TRAPPED', title: 'Rincian Analisis Kas Terkunci di Persediaan Bahan Baku', loading: false, items: [] });
    } else if (type === 'SHIFT_DISCREPANCY') {
      const targetShifts = (selectedShift && selectedShift !== 'ALL')
        ? (activeShiftMeta.shifts || [])
        : availableShifts;
      setDetailModal({
        open: true,
        type: 'SHIFT_DISCREPANCY',
        title: `Rincian Rekonsiliasi Kas Laci & Selisih Kasir Sesi Shift (${pmLabel}${shiftLabel})`,
        loading: false,
        items: targetShifts,
        extraData: {
          initialCashTotal: activeShiftMeta.initialCashTotal,
          closingCashTotal: activeShiftMeta.closingCashTotal,
          systemCashTotal: activeShiftMeta.systemCashTotal,
          cashDifferenceTotal: activeShiftMeta.cashDifferenceTotal,
          interShiftDiffTotal: activeShiftMeta.interShiftDiffTotal,
          prevShiftName: activeShiftMeta.prevShiftName,
          prevClosingCash: activeShiftMeta.prevClosingCash,
          closedCount: activeShiftMeta.closedCount,
          totalCount: activeShiftMeta.count,
        }
      });
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
  }, [dateFrom, dateTo, activeOutletId, selectedPaymentMethod, selectedShift]);

  async function fetchData() {
    setLoading(true);
    try {
      const targetOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all'
        ? activeOutletId
        : undefined;
      const pm = selectedPaymentMethod !== 'ALL' ? selectedPaymentMethod : undefined;
      const shift = selectedShift !== 'ALL' ? selectedShift : undefined;

      const [resStatement, resJournal] = await Promise.all([
        api.get('/cash-flow/statement', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet, payment_method: pm, shift_id: shift },
        }),
        api.get('/cash-transactions', {
          params: { from: dateFrom, to: dateTo, outlet_id: targetOutlet, payment_method: pm, shift_id: shift },
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
    const confirmed = await confirmDialog({
      title: 'Hapus Catatan Kas?',
      text: `Yakin ingin menghapus mutasi kas "${name}"?`,
      confirmText: 'Ya, Hapus Mutasi',
      cancelText: 'Batal',
      isDanger: true,
    });
    if (!confirmed) return;
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

  // Filtered receivable payments based on selected payment method
  const filteredReceivablePayments = useMemo(() => {
    let list = statementData?.operating?.inflows?.receivable_payments || [];
    if (selectedPaymentMethod && selectedPaymentMethod !== 'ALL') {
      const pm = selectedPaymentMethod.toUpperCase();
      list = list.filter(rp => {
        const m = (rp.payment_method || '').toUpperCase();
        if (pm === 'CASH' || pm === 'TUNAI') return m === 'CASH' || m === 'TUNAI';
        if (pm === 'QRIS') return m.includes('QRIS');
        if (pm === 'TRANSFER') return m.includes('TRANSFER');
        if (pm === 'DEBIT' || pm === 'EDC') return m.includes('DEBIT') || m.includes('EDC');
        return m === pm;
      });
    }
    return list;
  }, [statementData, selectedPaymentMethod]);

  // Combined Inflow List (Direct Sales Orders + Receivable Payments)
  const combinedInflowList = useMemo(() => {
    const list = [];
    groupedSalesOrders.forEach(o => {
      list.push({
        id: `ord_${o.id || o.order_number}`,
        type: 'ORDER',
        ref_no: o.order_number,
        date: o.date,
        created_at: o.created_at,
        customer: o.customer_name || (o.table_number ? `Meja ${o.table_number}` : 'Walk-in'),
        payment_method: o.payment_method,
        notes: o.items && o.items.length > 0 ? o.items.join(', ') : 'Penjualan Menu Kasir',
        user: o.user_name,
        amount: o.total_price,
      });
    });
    filteredReceivablePayments.forEach(rp => {
      list.push({
        id: `rp_${rp.id || rp.payment_no}`,
        type: 'RECEIVABLE_PAYMENT',
        ref_no: `${rp.payment_no} (${rp.receivable_no || 'Kasbon'})`,
        date: rp.payment_date,
        created_at: rp.payment_date,
        customer: rp.customer_name || 'Pelanggan Kasbon',
        payment_method: rp.payment_method,
        notes: rp.notes || 'Pelunasan Kasbon Pelanggan',
        user: rp.receiver_name,
        amount: rp.amount,
      });
    });
    return list;
  }, [groupedSalesOrders, filteredReceivablePayments]);

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

      {/* 1.4 Filter Shift Kasir (Per Shift & Gabungan Shift) */}
      <div
        className="card mb-3"
        style={{
          padding: '14px 18px',
          background: 'rgba(15, 23, 42, 0.85)',
          border: selectedShift !== 'ALL' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(165, 180, 252, 0.15)',
          borderRadius: 12,
          boxShadow: selectedShift !== 'ALL' ? '0 4px 18px rgba(56, 189, 248, 0.08)' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={16} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
              Filter Sesi Shift Kasir:
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              ({availableShifts.length} Sesi Terbuka/Tercatat di Periode Ini)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {selectedShift !== 'ALL' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: '3px 10px',
                    borderRadius: 20,
                    background: 'rgba(56, 189, 248, 0.18)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.45)',
                    fontWeight: 700,
                  }}
                >
                  Shift Aktif: {activeShiftMeta.label}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedShift('ALL')}
                  style={{ fontSize: 11, padding: '2px 8px', color: 'var(--text-muted)' }}
                  title="Tampilkan data seluruh shift digabung"
                >
                  ✕ Semua Shift
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Shift Buttons Horizontal Bar */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 4,
            scrollbarWidth: 'thin',
          }}
        >
          {/* Button Semua Shift Gabungan */}
          <button
            onClick={() => setSelectedShift('ALL')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '8px 14px',
              borderRadius: 10,
              border: selectedShift === 'ALL' ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
              background: selectedShift === 'ALL'
                ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.22) 0%, rgba(15, 23, 42, 0.95) 100%)'
                : 'rgba(255, 255, 255, 0.03)',
              boxShadow: selectedShift === 'ALL' ? '0 4px 14px rgba(56, 189, 248, 0.25)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
              textAlign: 'left',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: selectedShift === 'ALL' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                color: selectedShift === 'ALL' ? '#38bdf8' : 'var(--text-muted)',
              }}
            >
              <Layers size={15} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: selectedShift === 'ALL' ? 800 : 600, color: selectedShift === 'ALL' ? '#ffffff' : '#cbd5e1' }}>
                Semua Shift (Gabungan)
              </div>
              <div style={{ fontSize: 10, color: selectedShift === 'ALL' ? '#38bdf8' : 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{availableShifts.length} Sesi ({activeShiftMeta.closedCount} Tutup)</span>
                {activeShiftMeta.closedCount > 0 && (
                  <span style={{
                    fontSize: 9,
                    padding: '1px 6px',
                    borderRadius: 8,
                    background: activeShiftMeta.cashDifferenceTotal === 0 ? 'rgba(16, 185, 129, 0.2)' : (activeShiftMeta.cashDifferenceTotal > 0 ? 'rgba(56, 189, 248, 0.2)' : 'rgba(244, 63, 94, 0.2)'),
                    color: activeShiftMeta.cashDifferenceTotal === 0 ? '#34d399' : (activeShiftMeta.cashDifferenceTotal > 0 ? '#38bdf8' : '#f43f5e'),
                    fontWeight: 700
                  }}>
                    {activeShiftMeta.cashDifferenceTotal === 0 ? 'Selisih Rp0 (Pas)' : (activeShiftMeta.cashDifferenceTotal > 0 ? `+${rupiah(activeShiftMeta.cashDifferenceTotal)} (Lebih)` : `-${rupiah(Math.abs(activeShiftMeta.cashDifferenceTotal))} (Tekor)`)}
                  </span>
                )}
              </div>
            </div>
          </button>

          {/* Individual Shift Buttons */}
          {availableShifts.map((s) => {
            const isSelected = selectedShift === s.id.toString() || (selectedShift !== 'ALL' && selectedShift.toString().split(',').includes(s.id.toString()));
            const isSingleSelected = selectedShift === s.id.toString();
            const isOpen = s.status === 'OPEN';
            const diff = Number(s.cash_difference || 0);

            return (
              <button
                key={s.id}
                onClick={() => setSelectedShift(isSingleSelected ? 'ALL' : s.id.toString())}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: isSelected ? '1.5px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(15, 23, 42, 0.95) 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  boxShadow: isSelected ? '0 4px 14px rgba(16, 185, 129, 0.2)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isSelected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                    color: isSelected ? '#10b981' : 'var(--text-muted)',
                  }}
                >
                  <Clock size={15} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: isSelected ? 800 : 600, color: isSelected ? '#ffffff' : '#cbd5e1' }}>
                      {s.shift_name}
                    </span>
                    <span
                      style={{
                        fontSize: 9.5,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: isOpen ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                        color: isOpen ? '#34d399' : '#94a3b8',
                        fontWeight: 700,
                      }}
                    >
                      {isOpen ? 'AKTIF' : 'TUTUP'}
                    </span>
                    {!isOpen && (
                      <span
                        style={{
                          fontSize: 9,
                          padding: '1px 5px',
                          borderRadius: 8,
                          background: diff === 0 ? 'rgba(16, 185, 129, 0.2)' : (diff > 0 ? 'rgba(56, 189, 248, 0.2)' : 'rgba(244, 63, 94, 0.2)'),
                          color: diff === 0 ? '#34d399' : (diff > 0 ? '#38bdf8' : '#f43f5e'),
                          fontWeight: 700,
                        }}
                      >
                        {diff === 0 ? 'Pas (Rp0)' : (diff > 0 ? `+${rupiah(diff)}` : `-${rupiah(Math.abs(diff))}`)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: isSelected ? '#34d399' : 'var(--text-muted)', marginTop: 2 }}>
                    {s.cashier_name} • {isOpen ? `Modal: ${rupiah(s.initial_cash)}` : `Fisik Closing: ${rupiah(s.closing_cash)}`}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Button Modal Multi-Select Gabungan Shift */}
          <button
            onClick={() => {
              const curIds = selectedShift === 'ALL'
                ? availableShifts.map(s => s.id)
                : selectedShift.toString().split(',').map(id => Number(id.trim())).filter(Boolean);
              setTempShiftIds(curIds);
              setShiftModalOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 10,
              border: '1.5px dashed rgba(168, 85, 247, 0.6)',
              background: 'rgba(168, 85, 247, 0.08)',
              color: '#c084fc',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
              fontWeight: 700,
              fontSize: 12,
            }}
            title="Pilih kombinasi beberapa shift sekaligus"
          >
            <SlidersHorizontal size={15} />
            <span>+ Gabungan Shift (Multi-Pilih...)</span>
          </button>
        </div>
      </div>

      {/* 1.5 Filter Tab Metode Pembayaran (Per & Gabungan Metode) */}
      <div
        className="card mb-4"
        style={{
          padding: '14px 18px',
          background: 'rgba(15, 23, 42, 0.85)',
          border: selectedPaymentMethod !== 'ALL' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(165, 180, 252, 0.15)',
          borderRadius: 12,
          boxShadow: selectedPaymentMethod !== 'ALL' ? '0 4px 18px rgba(168, 85, 247, 0.08)' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#a855f7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Filter size={16} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
              Filter Arus Kas Berdasarkan Metode Pembayaran:
            </span>
          </div>
          {selectedPaymentMethod !== 'ALL' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  padding: '3px 10px',
                  borderRadius: 20,
                  background: `${activePmMeta?.color || '#38bdf8'}20`,
                  color: activePmMeta?.color || '#38bdf8',
                  border: `1px solid ${activePmMeta?.color || '#38bdf8'}45`,
                  fontWeight: 700,
                }}
              >
                Metode Aktif: {activePmMeta?.label}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedPaymentMethod('ALL')}
                style={{ fontSize: 11, padding: '2px 8px', color: 'var(--text-muted)' }}
              >
                ✕ Tampilkan Semua
              </button>
            </div>
          )}
        </div>

        {/* Tab Buttons Horizontal Bar */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 4,
            scrollbarWidth: 'thin',
          }}
        >
          {PAYMENT_METHOD_TABS.map((pmTab) => {
            const isSelected = selectedPaymentMethod === pmTab.id;
            const TabIcon = pmTab.icon;
            const isCashTab = pmTab.id === 'CASH';
            const initialCash = activeShiftMeta.initialCashTotal || 0;

            return (
              <button
                key={pmTab.id}
                onClick={() => setSelectedPaymentMethod(pmTab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: isSelected ? `1.5px solid ${pmTab.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                  background: isSelected
                    ? `linear-gradient(135deg, ${pmTab.color}22 0%, rgba(15, 23, 42, 0.95) 100%)`
                    : 'rgba(255, 255, 255, 0.03)',
                  boxShadow: isSelected ? `0 4px 14px ${pmTab.color}25` : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isSelected ? `${pmTab.color}30` : 'rgba(255, 255, 255, 0.06)',
                    color: isSelected ? pmTab.color : 'var(--text-muted)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <TabIcon size={16} />
                </div>
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      fontWeight: isSelected ? 800 : 600,
                      color: isSelected ? '#ffffff' : '#cbd5e1',
                      lineHeight: 1.2,
                    }}
                  >
                    <span>{pmTab.label}</span>
                    {isCashTab && initialCash > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '2px 7px',
                          borderRadius: 6,
                          background: isSelected ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.18)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.45)',
                          fontWeight: 700,
                          letterSpacing: 0.2,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                        title="Modal Awal Kas di Laci Kasir"
                      >
                        <Wallet size={10} /> Modal: {rupiah(initialCash)}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: isSelected ? pmTab.color : 'var(--text-muted)',
                      fontWeight: isSelected ? 600 : 400,
                      marginTop: 2,
                    }}
                  >
                    {isCashTab && initialCash > 0
                      ? `Uang Laci POS • Modal Awal ${rupiah(initialCash)}`
                      : pmTab.sub}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Button Modal Multi-Select Gabungan Metode Pembayaran */}
          <button
            onClick={() => {
              const curMethods = selectedPaymentMethod === 'ALL'
                ? AVAILABLE_PAYMENT_METHODS.map(m => m.id)
                : selectedPaymentMethod.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
              setTempPmList(curMethods);
              setCustomPmModalOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 14px',
              borderRadius: 10,
              border: '1.5px dashed rgba(56, 189, 248, 0.6)',
              background: 'rgba(56, 189, 248, 0.08)',
              color: '#38bdf8',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
              fontWeight: 700,
              fontSize: 12,
            }}
            title="Pilih kombinasi beberapa metode pembayaran sekaligus secara kustom"
          >
            <SlidersHorizontal size={16} />
            <span>+ Gabungan Kustom (Multi-Pilih...)</span>
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

        {/* Card 5: Shift Closing Discrepancy (Selisih Kasir) */}
        {(() => {
          const diff = Number(activeShiftMeta.cashDifferenceTotal || 0);
          const isBalanced = diff === 0;
          const isOver = diff > 0;
          const isShort = diff < 0;
          const cardColor = isBalanced ? '#10b981' : (isOver ? '#38bdf8' : '#f43f5e');
          const badgeBg = isBalanced ? 'rgba(16, 185, 129, 0.2)' : (isOver ? 'rgba(56, 189, 248, 0.2)' : 'rgba(244, 63, 94, 0.2)');
          const badgeBorder = isBalanced ? 'rgba(16, 185, 129, 0.4)' : (isOver ? 'rgba(56, 189, 248, 0.4)' : 'rgba(244, 63, 94, 0.4)');
          const badgeText = isBalanced ? '✓ BALANCE' : (isOver ? '+ LEBIH KAS' : '⚠️ TEKOR KAS');
          const statusText = isBalanced ? 'Uang Laci Pas' : (isOver ? `Lebih Kas +${rupiah(diff)}` : `Kurang Kas -${rupiah(Math.abs(diff))}`);

          return (
            <div
              className="card"
              onClick={() => handleCardClick('SHIFT_DISCREPANCY')}
              style={{
                padding: 18,
                background: `linear-gradient(135deg, ${cardColor}15 0%, rgba(15, 23, 42, 0.85) 100%)`,
                border: `1.5px solid ${cardColor}40`,
                boxShadow: `0 8px 25px ${cardColor}15`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Klik untuk melihat rincian rekonsiliasi kas laci & selisih shift kasir saat closing"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: cardColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Selisih Kasir (Closing Shift)
                </span>
                <div
                  style={{
                    padding: '2px 8px',
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 800,
                    background: badgeBg,
                    color: cardColor,
                    border: `1px solid ${badgeBorder}`,
                  }}
                >
                  {badgeText}
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: cardColor, letterSpacing: -0.5, marginBottom: 4 }}>
                {isOver ? `+${rupiah(diff)}` : (isShort ? `-${rupiah(Math.abs(diff))}` : rupiah(0))}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Fisik: <strong style={{ color: '#f8fafc' }}>{rupiah(activeShiftMeta.closingCashTotal || 0)}</strong></span>
                <span>Sistem: <strong style={{ color: '#f8fafc' }}>{rupiah(activeShiftMeta.systemCashTotal || 0)}</strong></span>
              </div>
              <div style={{ fontSize: 10, color: cardColor, fontWeight: 700, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>{statusText}</span>
                <span>{activeShiftMeta.closedCount} sesi tutup →</span>
              </div>
            </div>
          );
        })()}

        {/* Card 6: Shift Handover Discrepancy (Selisih Antar Kasir) */}
        {(() => {
          const interDiff = Number(activeShiftMeta.interShiftDiffTotal || 0);
          const isInterBalanced = interDiff === 0;
          const isInterOver = interDiff > 0;
          const isInterShort = interDiff < 0;
          const cardColor = isInterBalanced ? '#10b981' : (isInterOver ? '#38bdf8' : '#f43f5e');
          const badgeBg = isInterBalanced ? 'rgba(16, 185, 129, 0.2)' : (isInterOver ? 'rgba(56, 189, 248, 0.2)' : 'rgba(244, 63, 94, 0.2)');
          const badgeBorder = isInterBalanced ? 'rgba(16, 185, 129, 0.4)' : (isInterOver ? 'rgba(56, 189, 248, 0.4)' : 'rgba(244, 63, 94, 0.4)');
          const badgeText = isInterBalanced ? '✓ BALANCE' : (isInterOver ? '+ LEBIH MODAL' : '⚠️ TEKOR SERAH TERIMA');

          const subtitle = activeShiftMeta.isSingle && activeShiftMeta.prevShiftName
            ? `Modal ${activeShiftMeta.label.split('(')[0]} (${rupiah(activeShiftMeta.initialCashTotal || 0)}) vs Kas Lalu ${activeShiftMeta.prevShiftName} (${rupiah(activeShiftMeta.prevClosingCash || 0)})`
            : (activeShiftMeta.isSingle
              ? `Modal Awal Shift Perdana (${rupiah(activeShiftMeta.initialCashTotal || 0)})`
              : `Akumulasi Selisih Modal Sesi Baru vs Kas Closing Sesi Sebelumnya`);

          return (
            <div
              className="card"
              onClick={() => handleCardClick('SHIFT_DISCREPANCY')}
              style={{
                padding: 18,
                background: `linear-gradient(135deg, ${cardColor}15 0%, rgba(15, 23, 42, 0.85) 100%)`,
                border: `1.5px solid ${cardColor}40`,
                boxShadow: `0 8px 25px ${cardColor}15`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Klik untuk melihat rincian rekonsiliasi kas laci & selisih serah terima antar kasir"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: cardColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Selisih Antar Kasir
                </span>
                <div
                  style={{
                    padding: '2px 8px',
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 800,
                    background: badgeBg,
                    color: cardColor,
                    border: `1px solid ${badgeBorder}`,
                  }}
                >
                  {badgeText}
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: cardColor, letterSpacing: -0.5, marginBottom: 4 }}>
                {isInterOver ? `+${rupiah(interDiff)}` : (isInterShort ? `-${rupiah(Math.abs(interDiff))}` : rupiah(0))}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={subtitle}>
                {subtitle}
              </div>
              <div style={{ fontSize: 10, color: cardColor, fontWeight: 700, marginTop: 4 }}>
                {isInterBalanced ? 'Serah terima modal sesuai' : (isInterOver ? 'Modal awal lebih banyak dari fisik lalu' : 'Modal awal berkurang saat serah terima')} →
              </div>
            </div>
          );
        })()}

        {/* Card 6: Total Sisa Kas Dipegang Setelah Selisih Kasir */}
        {(() => {
          const modalAwal = Number(activeShiftMeta.initialCashTotal || 0);
          const netKas = Number(sum.net_cash_flow || 0);
          const kasSebelumSelisih = modalAwal + netKas;
          const diff = Number(activeShiftMeta.cashDifferenceTotal || 0);
          const sisaKasAkhir = kasSebelumSelisih + diff;

          return (
            <div
              className="card"
              onClick={() => handleCardClick('SHIFT_DISCREPANCY')}
              style={{
                padding: 18,
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.16) 0%, rgba(15, 23, 42, 0.85) 100%)',
                border: '1.5px solid rgba(6, 182, 212, 0.45)',
                boxShadow: '0 8px 25px rgba(6, 182, 212, 0.15)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Klik untuk melihat rincian rekonsiliasi kas laci & selisih shift kasir"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Total Sisa Kas Dipegang
                </span>
                <div
                  style={{
                    padding: '2px 8px',
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 800,
                    background: 'rgba(6, 182, 212, 0.25)',
                    color: '#22d3ee',
                    border: '1px solid rgba(6, 182, 212, 0.45)',
                  }}
                >
                  NET KAS AKHIR
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#22d3ee', letterSpacing: -0.5, marginBottom: 4, fontFamily: 'monospace' }}>
                {rupiah(sisaKasAkhir)}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Kas Laci: <strong style={{ color: '#f8fafc' }}>{rupiah(kasSebelumSelisih)}</strong></span>
                <span>Selisih: <strong style={{ color: diff < 0 ? '#f43f5e' : (diff > 0 ? '#38bdf8' : '#10b981') }}>{diff >= 0 ? `+${rupiah(diff)}` : `-${rupiah(Math.abs(diff))}`}</strong></span>
              </div>
              <div style={{ fontSize: 10, color: '#06b6d4', fontWeight: 600, marginTop: 4 }}>
                Sisa fisik riil di tangan kasir →
              </div>
            </div>
          );
        })()}
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
                  Cabang: <strong>{outletTitle}</strong> &nbsp;|&nbsp; Periode: <strong>{dateFrom}</strong> s/d <strong>{dateTo}</strong> &nbsp;|&nbsp; Filter Pembayaran: <strong style={{ color: activePmMeta?.color || '#38bdf8' }}>{activePmMeta?.label}</strong>
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
                      Penerimaan Kas dari Penjualan Langsung Kasir (Tunai, QRIS, Grab, Transfer, EDC)
                      <span style={{ fontSize: 11, color: '#38bdf8', marginLeft: 8, background: 'rgba(56, 189, 248, 0.12)', padding: '2px 6px', borderRadius: 4 }}>
                        🔍 Rincian Penjualan Langsung
                      </span>
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#34d399' }}>
                      {rupiah(op.inflows?.direct_sales_total != null ? op.inflows?.direct_sales_total : ((op.inflows?.cash_sales || 0) + (op.inflows?.qris_sales || 0) + (op.inflows?.grab_sales || 0) + (op.inflows?.transfer_sales || 0) + (op.inflows?.debit_sales || 0) + (op.inflows?.other_sales || 0)))}
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

            {/* GRAND TOTAL: PERUBAHAN BERSIH KAS RIIL & TOTAL FISIK UANG DIPEGANG KASIR */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 12,
                marginTop: 14,
              }}
            >
              {/* CARD 1: KENAIKAN / PENURUNAN KAS BERSIH (NET CASH FLOW) */}
              <div
                className="card"
                onClick={() => handleCardClick('NET_CASH')}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${sum.liquidity_color}18 0%, rgba(15, 23, 42, 0.95) 100%)`,
                  border: `1.5px solid ${sum.liquidity_color}45`,
                  boxShadow: `0 6px 20px ${sum.liquidity_color}15`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="Klik untuk melihat formula kalkulasi perubahan bersih kas riil"
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <TrendingUp size={18} color={sum.liquidity_color} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', letterSpacing: 0.3 }}>
                      KENAIKAN / (PENURUNAN) BERSIH KAS
                    </span>
                    <span style={{ fontSize: 10, color: sum.liquidity_color, background: `${sum.liquidity_color}25`, padding: '1px 5px', borderRadius: 4 }}>
                      🔍 Formula
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
                    Realisasi: Operasi + Investasi + Pendanaan
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: sum.net_cash_flow >= 0 ? sum.liquidity_color : '#f43f5e', fontFamily: 'monospace' }}>
                    {sum.net_cash_flow >= 0 ? `+${rupiah(sum.net_cash_flow)}` : rupiah(sum.net_cash_flow)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: sum.liquidity_color, marginTop: 1 }}>
                    {sum.liquidity_label}
                  </div>
                </div>
              </div>

              {/* CARD 2: MODAL AWAL KAS DI LACI */}
              <div
                className="card"
                onClick={() => handleCardClick('SHIFT_DISCREPANCY')}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(15, 23, 42, 0.95) 100%)',
                  border: '1.5px solid rgba(56, 189, 248, 0.35)',
                  boxShadow: '0 6px 20px rgba(56, 189, 248, 0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="Klik untuk melihat rincian modal awal kas di laci dari sesi shift kasir"
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Clock size={18} color="#38bdf8" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', letterSpacing: 0.3 }}>
                      MODAL AWAL KAS DI LACI
                    </span>
                    <span style={{ fontSize: 10, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.2)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                      🔍 Rincian Shift
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
                    Kas fisik awal saat pembukaan shift
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace' }}>
                    {rupiah(activeShiftMeta.initialCashTotal || 0)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 1 }}>
                    {activeShiftMeta.isAll ? `${activeShiftMeta.count} Sesi Shift →` : `${activeShiftMeta.label} →`}
                  </div>
                </div>
              </div>

              {/* CARD 3: TOTAL FISIK UANG YANG DIPEGANG KASIR (TOTAL CASH ON HAND) */}
              <div
                className="card"
                onClick={() => handleCardClick('SHIFT_DISCREPANCY')}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(15, 23, 42, 0.95) 100%)',
                  border: '2px solid rgba(16, 185, 129, 0.7)',
                  boxShadow: '0 8px 25px rgba(16, 185, 129, 0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="Klik untuk melihat rincian rekonsiliasi total fisik kas yang dipegang kasir"
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Wallet size={20} color="#34d399" />
                    <span style={{ fontSize: 13.5, fontWeight: 900, color: '#ffffff', letterSpacing: 0.3 }}>
                      TOTAL FISIK UANG DIPEGANG KASIR
                    </span>
                    <span style={{ fontSize: 9.5, color: '#34d399', background: 'rgba(16, 185, 129, 0.25)', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>
                      KAS FISIK LACI
                    </span>
                    <span style={{ fontSize: 10, color: '#34d399', background: 'rgba(16, 185, 129, 0.2)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                      🔍 Formula
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                    Modal Awal ({rupiah(activeShiftMeta.initialCashTotal || 0)}) + Net Kas ({sum.net_cash_flow >= 0 ? `+${rupiah(sum.net_cash_flow)}` : rupiah(sum.net_cash_flow)})
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#34d399', fontFamily: 'monospace' }}>
                    {rupiah((activeShiftMeta.initialCashTotal || 0) + (sum.net_cash_flow || 0))}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginTop: 1 }}>
                    Saldo Akhir Kas Laci Riil →
                  </div>
                </div>
              </div>

              {/* CARD 4: SELISIH KASIR DARI HASIL CLOSING SHIFT */}
              {(() => {
                const diff = Number(activeShiftMeta.cashDifferenceTotal || 0);
                const isBalanced = diff === 0;
                const isOver = diff > 0;
                const isShort = diff < 0;
                const cardColor = isBalanced ? '#10b981' : (isOver ? '#38bdf8' : '#f43f5e');

                return (
                  <div
                    className="card"
                    onClick={() => handleCardClick('SHIFT_DISCREPANCY')}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 20px',
                      borderRadius: 12,
                      background: `linear-gradient(135deg, ${cardColor}18 0%, rgba(15, 23, 42, 0.95) 100%)`,
                      border: `1.5px solid ${cardColor}45`,
                      boxShadow: `0 6px 20px ${cardColor}15`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    title="Klik untuk melihat rincian rekonsiliasi kas laci kasir"
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Scale size={18} color={cardColor} />
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', letterSpacing: 0.3 }}>
                          SELISIH KASIR (CLOSING SHIFT)
                        </span>
                        <span style={{
                          fontSize: 9.5,
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontWeight: 800,
                          background: isBalanced ? 'rgba(16, 185, 129, 0.25)' : (isOver ? 'rgba(56, 189, 248, 0.25)' : 'rgba(244, 63, 94, 0.25)'),
                          color: cardColor,
                          border: `1px solid ${cardColor}40`,
                        }}>
                          {isBalanced ? '✓ PAS / BALANCE' : (isOver ? '+ LEBIH KAS' : '⚠️ TEKOR KAS')}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
                        Fisik Closing ({rupiah(activeShiftMeta.closingCashTotal || 0)}) vs Sistem ({rupiah(activeShiftMeta.systemCashTotal || 0)})
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: cardColor, fontFamily: 'monospace' }}>
                        {isOver ? `+${rupiah(diff)}` : (isShort ? `-${rupiah(Math.abs(diff))}` : rupiah(0))}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: cardColor, marginTop: 1 }}>
                        {isBalanced ? 'Tidak Ada Selisih' : (isOver ? 'Kas Lebih di Laci' : 'Kas Kurang di Laci')}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* CARD 5: SELISIH ANTAR KASIR (SERAH TERIMA MODAL AWAL VS KAS CLOSING LALU) */}
              {(() => {
                const interDiff = Number(activeShiftMeta.interShiftDiffTotal || 0);
                const isInterBalanced = interDiff === 0;
                const isInterOver = interDiff > 0;
                const isInterShort = interDiff < 0;
                const cardColor = isInterBalanced ? '#10b981' : (isInterOver ? '#38bdf8' : '#f43f5e');

                const subtitle = activeShiftMeta.isSingle && activeShiftMeta.prevShiftName
                  ? `Modal Buka (${rupiah(activeShiftMeta.initialCashTotal || 0)}) vs Kas Lalu ${activeShiftMeta.prevShiftName} (${rupiah(activeShiftMeta.prevClosingCash || 0)})`
                  : (activeShiftMeta.isSingle
                    ? `Modal Awal Shift Perdana (${rupiah(activeShiftMeta.initialCashTotal || 0)})`
                    : `Akumulasi Selisih Modal Sesi Baru vs Kas Closing Sesi Sebelumnya`);

                return (
                  <div
                    className="card"
                    onClick={() => handleCardClick('SHIFT_DISCREPANCY')}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 20px',
                      borderRadius: 12,
                      background: `linear-gradient(135deg, ${cardColor}18 0%, rgba(15, 23, 42, 0.95) 100%)`,
                      border: `1.5px solid ${cardColor}45`,
                      boxShadow: `0 6px 20px ${cardColor}15`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    title="Klik untuk melihat rincian rekonsiliasi kas laci & serah terima antar kasir"
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <ArrowRightLeft size={18} color={cardColor} />
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', letterSpacing: 0.3 }}>
                          SELISIH ANTAR KASIR
                        </span>
                        <span style={{
                          fontSize: 9.5,
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontWeight: 800,
                          background: isInterBalanced ? 'rgba(16, 185, 129, 0.25)' : (isInterOver ? 'rgba(56, 189, 248, 0.25)' : 'rgba(244, 63, 94, 0.25)'),
                          color: cardColor,
                          border: `1px solid ${cardColor}40`,
                        }}>
                          {isInterBalanced ? '✓ PAS / BALANCE' : (isInterOver ? '+ LEBIH MODAL' : '⚠️ TEKOR SERAH TERIMA')}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
                        {subtitle}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: cardColor, fontFamily: 'monospace' }}>
                        {isInterOver ? `+${rupiah(interDiff)}` : (isInterShort ? `-${rupiah(Math.abs(interDiff))}` : rupiah(0))}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: cardColor, marginTop: 1 }}>
                        {isInterBalanced ? 'Serah Terima Sesuai' : (isInterOver ? 'Modal Awal Lebih Banyak' : 'Modal Awal Berkurang')}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* CARD 5: TOTAL SISA UANG DIPEGANG KASIR SETELAH MENGURANGI SELISIH KASIR */}
              {(() => {
                const modalAwal = Number(activeShiftMeta.initialCashTotal || 0);
                const netKas = Number(sum.net_cash_flow || 0);
                const kasSebelumSelisih = modalAwal + netKas;
                const diff = Number(activeShiftMeta.cashDifferenceTotal || 0);
                const sisaKasAkhir = kasSebelumSelisih + diff;

                return (
                  <div
                    className="card"
                    onClick={() => handleCardClick('SHIFT_DISCREPANCY')}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 20px',
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(15, 23, 42, 0.95) 100%)',
                      border: '2px solid rgba(6, 182, 212, 0.7)',
                      boxShadow: '0 8px 25px rgba(6, 182, 212, 0.25)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    title="Klik untuk melihat rincian rekonsiliasi kas laci kasir"
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Coins size={20} color="#22d3ee" />
                        <span style={{ fontSize: 13.5, fontWeight: 900, color: '#ffffff', letterSpacing: 0.3 }}>
                          TOTAL SISA KAS DIPEGANG
                        </span>
                        <span style={{
                          fontSize: 9.5,
                          color: '#22d3ee',
                          background: 'rgba(6, 182, 212, 0.25)',
                          border: '1px solid rgba(6, 182, 212, 0.45)',
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontWeight: 800,
                        }}>
                          SETELAH SELISIH
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                        Kas Fisik ({rupiah(kasSebelumSelisih)}) {diff === 0 ? '' : (diff > 0 ? `+ Selisih (${rupiah(diff)})` : `- Selisih (${rupiah(Math.abs(diff))})`)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#22d3ee', fontFamily: 'monospace' }}>
                        {rupiah(sisaKasAkhir)}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', marginTop: 1 }}>
                        Sisa Fisik Riil di Tangan Kasir
                      </div>
                    </div>
                  </div>
                );
              })()}
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
                <div className="modal-form-grid-2">
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
                <div className="modal-form-grid-2">
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
                <div className="modal-form-grid-2">
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
        <div className="modal-overlay" style={{ zIndex: 99999 }}>
          <div
            className="modal-card"
            style={{
              maxWidth: detailModal.type === 'SHIFT_DISCREPANCY' ? 1220 : 880,
              width: '95%',
              maxHeight: '94vh',
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
                padding: '14px 18px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                flex: 1,
                minHeight: 0,
              }}
            >
              {detailModal.loading ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <LoadingState message="Memuat rincian data mutasi..." />
                </div>
              ) : (
                <>
                  {/* TYPE: SALES_INFLOW or RECEIVABLE_INFLOW */}
                  {(detailModal.type === 'SALES_INFLOW' || detailModal.type === 'RECEIVABLE_INFLOW') && (
                    <>
                      {/* Sub-Tab Navigation */}
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                          paddingBottom: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          type="button"
                          className={`btn btn-sm ${detailModal.subTab === 'DIRECT' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setDetailModal(p => ({ ...p, subTab: 'DIRECT' }))}
                          style={{
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: 8,
                            padding: '7px 14px',
                          }}
                        >
                          🛍️ Penjualan Langsung Kasir ({rupiah(op.inflows?.direct_sales_total || 0)})
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${detailModal.subTab === 'RECEIVABLE' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setDetailModal(p => ({ ...p, subTab: 'RECEIVABLE' }))}
                          style={{
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: 8,
                            padding: '7px 14px',
                          }}
                        >
                          📝 Pelunasan Kasbon Customer ({rupiah(op.inflows?.receivable_collections || 0)})
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${detailModal.subTab === 'COMBINED' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setDetailModal(p => ({ ...p, subTab: 'COMBINED' }))}
                          style={{
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: 8,
                            padding: '7px 14px',
                          }}
                        >
                          ✨ Semua Kas Masuk (Gabungan) ({rupiah(op.inflows?.total_inflows || 0)})
                        </button>
                      </div>

                      {/* Content: DIRECT SALES */}
                      {detailModal.subTab === 'DIRECT' && (
                        <>
                          {/* Summary Cards */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                              <div style={{ fontSize: 11, color: '#a7f3d0' }}>Tunai (Cash)</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#34d399', marginTop: 2 }}>
                                {rupiah(op.inflows?.cash_sales || 0)}
                              </div>
                            </div>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                              <div style={{ fontSize: 11, color: '#bae6fd' }}>QRIS</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
                                {rupiah(op.inflows?.qris_sales || 0)}
                              </div>
                            </div>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                              <div style={{ fontSize: 11, color: '#fde68a' }}>Grab / Online</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>
                                {rupiah(op.inflows?.grab_sales || 0)}
                              </div>
                            </div>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                              <div style={{ fontSize: 11, color: '#e9d5ff' }}>Transfer Bank</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#c084fc', marginTop: 2 }}>
                                {rupiah(op.inflows?.transfer_sales || 0)}
                              </div>
                            </div>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(251, 146, 60, 0.1)', border: '1px solid rgba(251, 146, 60, 0.2)' }}>
                              <div style={{ fontSize: 11, color: '#fed7aa' }}>Debit / EDC</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#fb923c', marginTop: 2 }}>
                                {rupiah(op.inflows?.debit_sales || 0)}
                              </div>
                            </div>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Penjualan Langsung</div>
                              <div style={{ fontSize: 16, fontWeight: 900, color: '#f8fafc', marginTop: 2 }}>
                                {rupiah(op.inflows?.direct_sales_total || 0)}
                              </div>
                            </div>
                          </div>

                          {/* Kasbon Inflow Alert Banner */}
                          {Number(op.inflows?.receivable_collections || 0) > 0 && (
                            <div
                              style={{
                                padding: '12px 16px',
                                borderRadius: 10,
                                background: 'rgba(167, 139, 250, 0.12)',
                                border: '1px solid rgba(167, 139, 250, 0.3)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: 10,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Sparkles size={18} color="#c084fc" />
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                                    Ada Uang Masuk dari Pelunasan Kasbon: <strong style={{ color: '#c084fc' }}>{rupiah(op.inflows?.receivable_collections)}</strong>
                                  </div>
                                  <div style={{ fontSize: 11.5, color: '#cbd5e1' }}>
                                    Uang kas/transfer masuk ini berasal dari pembayaran hutang/kasbon pelanggan yang diterima kasir.
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => setDetailModal(p => ({ ...p, subTab: 'RECEIVABLE' }))}
                                style={{
                                  background: '#8b5cf6',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                  fontSize: 12,
                                  border: 'none',
                                  borderRadius: 8,
                                  padding: '6px 14px',
                                  cursor: 'pointer',
                                }}
                              >
                                Buka Rincian Kasbon ({rupiah(op.inflows?.receivable_collections)}) →
                              </button>
                            </div>
                          )}

                          <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: 6 }}>
                            💡 <strong>Penjualan Langsung Kasir:</strong> Diambil dari order kasir tunai/non-tunai langsung (selain kasbon) yang berstatus <em>PAID / Selesai</em>.
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
                                      Tidak ada transaksi penjualan langsung kasir pada periode ini.
                                      {Number(op.inflows?.receivable_collections || 0) > 0 && (
                                        <div style={{ marginTop: 6, color: '#c084fc', fontWeight: 600 }}>
                                          Klik tab "Pelunasan Kasbon Customer" di atas untuk melihat pembayaran kasbon senilai {rupiah(op.inflows?.receivable_collections)}.
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}

                      {/* Content: RECEIVABLE COLLECTIONS */}
                      {detailModal.subTab === 'RECEIVABLE' && (
                        <>
                          {/* Summary Cards */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                              <div style={{ fontSize: 11, color: '#a7f3d0' }}>Pembayaran Tunai</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#34d399', marginTop: 2 }}>
                                {rupiah(statementData?.operating?.inflows?.receivable_breakdown?.cash || 0)}
                              </div>
                            </div>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                              <div style={{ fontSize: 11, color: '#bae6fd' }}>QRIS</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
                                {rupiah(statementData?.operating?.inflows?.receivable_breakdown?.qris || 0)}
                              </div>
                            </div>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                              <div style={{ fontSize: 11, color: '#e9d5ff' }}>Transfer Bank</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#c084fc', marginTop: 2 }}>
                                {rupiah(statementData?.operating?.inflows?.receivable_breakdown?.transfer || 0)}
                              </div>
                            </div>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(251, 146, 60, 0.1)', border: '1px solid rgba(251, 146, 60, 0.2)' }}>
                              <div style={{ fontSize: 11, color: '#fed7aa' }}>Debit / Lainnya</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#fb923c', marginTop: 2 }}>
                                {rupiah((statementData?.operating?.inflows?.receivable_breakdown?.debit || 0) + (statementData?.operating?.inflows?.receivable_breakdown?.other || 0))}
                              </div>
                            </div>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Pelunasan Kasbon</div>
                              <div style={{ fontSize: 16, fontWeight: 900, color: '#34d399', marginTop: 2 }}>
                                {rupiah(op.inflows?.receivable_collections || 0)}
                              </div>
                            </div>
                          </div>

                          <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '10px 14px', borderRadius: 6 }}>
                            💡 <strong>Prinsip Arus Kas Riil:</strong> Penjualan kasbon saat nota dibuat <em>TIDAK</em> masuk ke Arus Kas karena uang belum diterima. Uang hanya diakui masuk ke Arus Kas ketika kasir menerima uang muka (DP) atau cicilan/pelunasan kasbon dari pelanggan.
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
                                {filteredReceivablePayments && filteredReceivablePayments.length > 0 ? (
                                  filteredReceivablePayments.map((item, idx) => (
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
                                            color: item.payment_method === 'CASH' || item.payment_method === 'TUNAI' ? '#34d399' : '#38bdf8'
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

                      {/* Content: COMBINED INFLOWS */}
                      {detailModal.subTab === 'COMBINED' && (
                        <>
                          {/* Summary Cards */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                              <div style={{ fontSize: 11, color: '#a7f3d0' }}>Tunai (Semua)</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#34d399', marginTop: 2 }}>
                                {rupiah((op.inflows?.cash_sales || 0) + (statementData?.operating?.inflows?.receivable_breakdown?.cash || 0))}
                              </div>
                            </div>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                              <div style={{ fontSize: 11, color: '#bae6fd' }}>QRIS (Semua)</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
                                {rupiah((op.inflows?.qris_sales || 0) + (statementData?.operating?.inflows?.receivable_breakdown?.qris || 0))}
                              </div>
                            </div>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                              <div style={{ fontSize: 11, color: '#fde68a' }}>Grab / Online</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>
                                {rupiah(op.inflows?.grab_sales || 0)}
                              </div>
                            </div>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                              <div style={{ fontSize: 11, color: '#e9d5ff' }}>Transfer Bank</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#c084fc', marginTop: 2 }}>
                                {rupiah((op.inflows?.transfer_sales || 0) + (statementData?.operating?.inflows?.receivable_breakdown?.transfer || 0))}
                              </div>
                            </div>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(251, 146, 60, 0.1)', border: '1px solid rgba(251, 146, 60, 0.2)' }}>
                              <div style={{ fontSize: 11, color: '#fed7aa' }}>Debit / EDC</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#fb923c', marginTop: 2 }}>
                                {rupiah((op.inflows?.debit_sales || 0) + (statementData?.operating?.inflows?.receivable_breakdown?.debit || 0) + (statementData?.operating?.inflows?.receivable_breakdown?.other || 0))}
                              </div>
                            </div>
                            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Kas Masuk (Gabungan)</div>
                              <div style={{ fontSize: 16, fontWeight: 900, color: '#f8fafc', marginTop: 2 }}>
                                {rupiah(op.inflows?.total_inflows || 0)}
                              </div>
                            </div>
                          </div>

                          <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: 6 }}>
                            💡 <strong>Total Kas Masuk Gabungan:</strong> Menampilkan seluruh penerimaan uang kas fisik dan non-tunai yang masuk ke kasir atau bank, baik dari penjualan langsung maupun pembayaran kasbon pelanggan.
                          </div>

                          <div className="table-responsive" style={{ maxHeight: 340, overflowY: 'auto' }}>
                            <table className="table" style={{ fontSize: 12 }}>
                              <thead>
                                <tr>
                                  <th>Tipe Kas Masuk</th>
                                  <th>No. Ref / Bukti</th>
                                  <th>Tanggal</th>
                                  <th>Metode Bayar</th>
                                  <th>Pelanggan / Meja</th>
                                  <th>Keterangan</th>
                                  <th>Kasir</th>
                                  <th style={{ textAlign: 'right' }}>Total Masuk</th>
                                </tr>
                              </thead>
                              <tbody>
                                {combinedInflowList && combinedInflowList.length > 0 ? (
                                  combinedInflowList.map((item, idx) => (
                                    <tr key={item.id || idx}>
                                      <td>
                                        <span
                                          style={{
                                            padding: '2px 7px',
                                            borderRadius: 4,
                                            fontWeight: 700,
                                            fontSize: 10.5,
                                            background: item.type === 'ORDER' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                            color: item.type === 'ORDER' ? '#38bdf8' : '#c084fc',
                                            border: item.type === 'ORDER' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(168, 85, 247, 0.3)',
                                          }}
                                        >
                                          {item.type === 'ORDER' ? 'Penjualan' : 'Pelunasan Kasbon'}
                                        </span>
                                      </td>
                                      <td className="mono" style={{ color: '#cbd5e1', fontWeight: 600 }}>
                                        {item.ref_no}
                                      </td>
                                      <td style={{ fontSize: 11.5 }}>
                                        {item.created_at
                                          ? new Date(item.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
                                          : item.date}
                                      </td>
                                      <td>
                                        <span
                                          style={{
                                            padding: '2px 7px',
                                            borderRadius: 4,
                                            background: 'rgba(255, 255, 255, 0.08)',
                                            fontWeight: 700,
                                            fontSize: 11,
                                            color: (item.payment_method === 'CASH' || item.payment_method === 'TUNAI') ? '#34d399' : '#38bdf8'
                                          }}
                                        >
                                          {item.payment_method}
                                        </span>
                                      </td>
                                      <td style={{ fontWeight: 600, color: '#f8fafc' }}>
                                        {item.customer}
                                      </td>
                                      <td style={{ color: '#cbd5e1', maxWidth: 200, fontSize: 11.5 }}>
                                        {item.notes}
                                      </td>
                                      <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                        {item.user}
                                      </td>
                                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399', fontSize: 13 }}>
                                        {rupiah(item.amount)}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                                      Tidak ada catatan kas masuk pada periode ini.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
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
                          {Number(op.inflows?.receivable_collections || 0) > 0 ? (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                                <span style={{ color: '#cbd5e1' }}>
                                  (+) Kas Masuk Penjualan Langsung Kasir
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ padding: '2px 8px', fontSize: 11, color: '#38bdf8' }}
                                    onClick={() => handleCardClick('SALES_INFLOW', 'DIRECT')}
                                  >
                                    🔍 Rincian Penjualan
                                  </button>
                                  <strong style={{ color: '#34d399' }}>+{rupiah(op.inflows?.direct_sales_total || 0)}</strong>
                                </div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                                <span style={{ color: '#cbd5e1' }}>
                                  (+) Kas Masuk Pelunasan Kasbon Customer
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ padding: '2px 8px', fontSize: 11, color: '#a78bfa' }}
                                    onClick={() => handleCardClick('RECEIVABLE_INFLOW', 'RECEIVABLE')}
                                  >
                                    🔍 Rincian Kasbon
                                  </button>
                                  <strong style={{ color: '#a78bfa' }}>+{rupiah(op.inflows?.receivable_collections || 0)}</strong>
                                </div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, background: 'rgba(255, 255, 255, 0.04)', padding: '4px 8px', borderRadius: 4 }}>
                                <span style={{ color: '#f8fafc', fontWeight: 600 }}>
                                  (Subtotal Kas Masuk Operasional)
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ padding: '2px 8px', fontSize: 11, color: '#38bdf8' }}
                                    onClick={() => handleCardClick('INFLOWS_ALL', 'COMBINED')}
                                  >
                                    🔍 Gabungan
                                  </button>
                                  <strong style={{ color: '#34d399' }}>+{rupiah(op.inflows?.total_inflows || 0)}</strong>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                              <span style={{ color: '#cbd5e1' }}>
                                (+) Kas Masuk Penjualan Kasir (POS)
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  style={{ padding: '2px 8px', fontSize: 11, color: '#38bdf8' }}
                                  onClick={() => handleCardClick('SALES_INFLOW', 'DIRECT')}
                                >
                                  🔍 Lihat Rincian
                                </button>
                                <strong style={{ color: '#34d399' }}>+{rupiah(op.inflows?.total_inflows || 0)}</strong>
                              </div>
                            </div>
                          )}

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

                  {/* TYPE: SHIFT_DISCREPANCY */}
                  {detailModal.type === 'SHIFT_DISCREPANCY' && (
                    <>
                      {/* Top Metric Cards for Shift Discrepancy */}
                      {(() => {
                        const modalTotal = Number(detailModal.extraData?.initialCashTotal || 0);
                        const sysTotal = Number(detailModal.extraData?.systemCashTotal || 0);
                        const closingTotal = Number(detailModal.extraData?.closingCashTotal || 0);
                        const diff = Number(detailModal.extraData?.cashDifferenceTotal || 0);
                        const isBal = diff === 0;
                        const isOver = diff > 0;
                        const diffColor = isBal ? '#10b981' : (isOver ? '#38bdf8' : '#f43f5e');
                        const diffBg = isBal ? 'rgba(16, 185, 129, 0.1)' : (isOver ? 'rgba(56, 189, 248, 0.1)' : 'rgba(244, 63, 94, 0.1)');
                        const diffBorder = isBal ? 'rgba(16, 185, 129, 0.3)' : (isOver ? 'rgba(56, 189, 248, 0.3)' : 'rgba(244, 63, 94, 0.3)');

                        const interDiff = Number(detailModal.extraData?.interShiftDiffTotal || 0);
                        const isInterBal = interDiff === 0;
                        const isInterOver = interDiff > 0;
                        const interColor = isInterBal ? '#10b981' : (isInterOver ? '#38bdf8' : '#f43f5e');
                        const interBg = isInterBal ? 'rgba(16, 185, 129, 0.1)' : (isInterOver ? 'rgba(56, 189, 248, 0.1)' : 'rgba(244, 63, 94, 0.1)');
                        const interBorder = isInterBal ? 'rgba(16, 185, 129, 0.3)' : (isInterOver ? 'rgba(56, 189, 248, 0.3)' : 'rgba(244, 63, 94, 0.3)');

                        const closedList = (detailModal.items || []).filter(s => s.status === 'CLOSED');
                        const closedFormulaStr = closedList.length > 0
                          ? closedList.map(s => `${s.shift_name} (${rupiah(s.closing_cash || 0)})`).join(' + ')
                          : 'Belum ada shift ditutup';

                        const initialFormulaStr = (detailModal.items || []).map(s => `${s.shift_name} (${rupiah(s.initial_cash || 0)})`).join(' + ') || rupiah(modalTotal);

                        return (
                          <>
                            {/* 5 KPI Cards in Responsive Row/Grid */}
                            <div className="modal-kpi-5-grid">
                              {/* 1. Modal Awal */}
                              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '9px 12px', borderRadius: 9 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontSize: 10.5, color: '#7dd3fc', fontWeight: 700 }}>1. Modal Awal Kas</div>
                                  <span style={{ fontSize: 9, background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                    {detailModal.extraData?.totalCount || 0} Sesi
                                  </span>
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>
                                  {rupiah(modalTotal)}
                                </div>
                                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={initialFormulaStr}>
                                  Sumber: {initialFormulaStr}
                                </div>
                              </div>

                              {/* 2. Kas Teoretis Sistem */}
                              <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', padding: '9px 12px', borderRadius: 9 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontSize: 10.5, color: '#c084fc', fontWeight: 700 }}>2. Kas Sistem</div>
                                  <span style={{ fontSize: 9, background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                    Target
                                  </span>
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 900, color: '#c084fc', marginTop: 2 }}>
                                  {rupiah(sysTotal)}
                                </div>
                                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>
                                  Modal ({rupiah(modalTotal)}) + Penjualan
                                </div>
                              </div>

                              {/* 3. Fisik Aktual Closing */}
                              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '9px 12px', borderRadius: 9 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontSize: 10.5, color: '#34d399', fontWeight: 700 }}>3. Fisik Closing</div>
                                  <span style={{ fontSize: 9, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                    {detailModal.extraData?.closedCount || 0} Tutup
                                  </span>
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 900, color: '#34d399', marginTop: 2 }}>
                                  {rupiah(closingTotal)}
                                </div>
                                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={closedFormulaStr}>
                                  Hitung: {closedFormulaStr}
                                </div>
                              </div>

                              {/* 4. Selisih Closing Shift */}
                              <div style={{ background: diffBg, border: `1.5px solid ${diffBorder}`, padding: '9px 12px', borderRadius: 9 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontSize: 10.5, color: diffColor, fontWeight: 700 }}>4. Selisih Closing</div>
                                  <span style={{ fontSize: 9, background: `${diffColor}25`, color: diffColor, padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>
                                    {isBal ? '✓ PAS' : (isOver ? '+ LEBIH' : '⚠️ TEKOR')}
                                  </span>
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 900, color: diffColor, marginTop: 2 }}>
                                  {isOver ? `+${rupiah(diff)}` : (diff < 0 ? `-${rupiah(Math.abs(diff))}` : rupiah(0))}
                                </div>
                                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>
                                  Fisik ({rupiah(closingTotal)}) - Sistem ({rupiah(sysTotal)})
                                </div>
                              </div>

                              {/* 5. Selisih Antar Kasir */}
                              <div style={{ background: interBg, border: `1.5px solid ${interBorder}`, padding: '9px 12px', borderRadius: 9 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontSize: 10.5, color: interColor, fontWeight: 700 }}>5. Selisih Antar Kasir</div>
                                  <span style={{ fontSize: 9, background: `${interColor}25`, color: interColor, padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>
                                    {isInterBal ? '✓ SESUAI' : (isInterOver ? '+ LEBIH' : '⚠️ TEKOR')}
                                  </span>
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 900, color: interColor, marginTop: 2 }}>
                                  {isInterOver ? `+${rupiah(interDiff)}` : (interDiff < 0 ? `-${rupiah(Math.abs(interDiff))}` : rupiah(0))}
                                </div>
                                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  Modal Baru vs Kas Closing Lalu
                                </div>
                              </div>
                            </div>

                            {/* Compact Formula & Explanation Strip */}
                            <div
                              style={{
                                background: 'rgba(15, 23, 42, 0.85)',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                padding: '8px 12px',
                                borderRadius: 8,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Sparkles size={13} /> Cara Kerja & Formula Rekonsiliasi Kas Laci:
                                </div>
                                <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                                  <strong>Kas Sistem</strong> = Modal Awal ({rupiah(modalTotal)}) + Penjualan Tunai Kasir - Kas Keluar = <span style={{ color: '#c084fc', fontWeight: 700 }}>{rupiah(sysTotal)}</span>
                                </div>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '4px 12px', color: '#cbd5e1', fontSize: 10.5 }}>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Fisik Closing: ${closedFormulaStr} = ${rupiah(closingTotal)}`}>
                                  • <strong>Fisik Closing:</strong> {closedFormulaStr} = <span style={{ color: '#34d399', fontWeight: 700 }}>{rupiah(closingTotal)}</span>
                                </div>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Selisih Closing: Fisik (${rupiah(closingTotal)}) - Sistem (${rupiah(sysTotal)})`}>
                                  • <strong>Selisih Closing:</strong> Fisik ({rupiah(closingTotal)}) - Sistem ({rupiah(sysTotal)}) = <span style={{ color: diffColor, fontWeight: 800 }}>{isOver ? `+${rupiah(diff)} (Lebih Kas)` : (diff < 0 ? `-${rupiah(Math.abs(diff))} (Tekor Kasir)` : 'Rp0 (Pas)')}</span>
                                </div>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title="Selisih Antar Kasir: Modal Shift Baru vs Kas Closing Shift Sebelumnya">
                                  • <strong>Selisih Antar Kasir:</strong> <span style={{ color: interColor, fontWeight: 800 }}>{isInterOver ? `+${rupiah(interDiff)} (Lebih Modal)` : (interDiff < 0 ? `-${rupiah(Math.abs(interDiff))} (Tekor Serah Terima)` : 'Rp0 (Sesuai)')}</span> {detailModal.items?.length === 1 && detailModal.extraData?.prevShiftName ? `(vs ${detailModal.extraData?.prevShiftName})` : ''}
                                </div>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Total Fisik Kas: Modal Awal (${rupiah(modalTotal)}) + Net Kas (${rupiah(sum.net_cash_flow)})`}>
                                  • <strong>Total Kas di Laci:</strong> Modal ({rupiah(modalTotal)}) + Net Kas ({rupiah(sum.net_cash_flow)}) = <span style={{ color: '#34d399', fontWeight: 700 }}>{rupiah(modalTotal + (sum.net_cash_flow || 0))}</span>
                                </div>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title="Total Sisa Kas: Kas Fisik Laci + Selisih Kasir Closing">
                                  • <strong>Sisa Kas Akhir:</strong> Kas Laci ({rupiah(modalTotal + (sum.net_cash_flow || 0))}) {diff >= 0 ? `+ Selisih (${rupiah(diff)})` : `- Selisih (${rupiah(Math.abs(diff))})`} = <span style={{ color: '#22d3ee', fontWeight: 800 }}>{rupiah(modalTotal + (sum.net_cash_flow || 0) + diff)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Detail Shifts Table - Expanded & Sticky Headers */}
                            <div
                              className="table-responsive"
                              style={{
                                flex: 1,
                                minHeight: 220,
                                maxHeight: 'none',
                                overflowY: 'auto',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: 8,
                                background: 'rgba(15, 23, 42, 0.4)',
                              }}
                            >
                              <table className="table" style={{ fontSize: 11.5, margin: 0, width: '100%' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0f172a' }}>
                                  <tr>
                                    <th style={{ background: '#0f172a', borderBottom: '2px solid rgba(255, 255, 255, 0.12)', padding: '9px 12px' }}>Sesi Shift</th>
                                    <th style={{ background: '#0f172a', borderBottom: '2px solid rgba(255, 255, 255, 0.12)', padding: '9px 12px' }}>Kasir</th>
                                    <th style={{ background: '#0f172a', borderBottom: '2px solid rgba(255, 255, 255, 0.12)', textAlign: 'center', padding: '9px 8px' }}>Status</th>
                                    <th style={{ background: '#0f172a', borderBottom: '2px solid rgba(255, 255, 255, 0.12)', textAlign: 'right', padding: '9px 12px' }}>Kas Awal</th>
                                    <th style={{ background: '#0f172a', borderBottom: '2px solid rgba(255, 255, 255, 0.12)', textAlign: 'right', padding: '9px 12px' }}>Kas Sistem</th>
                                    <th style={{ background: '#0f172a', borderBottom: '2px solid rgba(255, 255, 255, 0.12)', textAlign: 'right', padding: '9px 12px' }}>Fisik Closing</th>
                                    <th style={{ background: '#0f172a', borderBottom: '2px solid rgba(255, 255, 255, 0.12)', textAlign: 'right', padding: '9px 12px' }}>Selisih Closing</th>
                                    <th style={{ background: '#0f172a', borderBottom: '2px solid rgba(255, 255, 255, 0.12)', textAlign: 'right', padding: '9px 12px' }}>Selisih Antar Kasir</th>
                                    <th style={{ background: '#0f172a', borderBottom: '2px solid rgba(255, 255, 255, 0.12)', padding: '9px 12px' }}>Catatan Closing</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detailModal.items && detailModal.items.length > 0 ? (
                                    detailModal.items.map((s, idx) => {
                                      const isOpen = s.status === 'OPEN';
                                      const diff = Number(s.cash_difference || 0);
                                      const isBal = diff === 0;
                                      const isOver = diff > 0;
                                      const diffColor = isBal ? '#34d399' : (isOver ? '#38bdf8' : '#f87171');
                                      const diffBg = isBal ? 'rgba(16, 185, 129, 0.15)' : (isOver ? 'rgba(56, 189, 248, 0.15)' : 'rgba(248, 113, 113, 0.15)');

                                      const interDiff = Number(s.inter_shift_diff || 0);
                                      const isInterBal = interDiff === 0;
                                      const isInterOver = interDiff > 0;
                                      const interColor = isInterBal ? '#34d399' : (isInterOver ? '#38bdf8' : '#f87171');
                                      const interBg = isInterBal ? 'rgba(16, 185, 129, 0.15)' : (isInterOver ? 'rgba(56, 189, 248, 0.15)' : 'rgba(248, 113, 113, 0.15)');

                                      return (
                                        <tr key={s.id || idx}>
                                          <td style={{ padding: '8px 12px' }}>
                                            <div style={{ fontWeight: 700, color: '#f8fafc' }}>{s.shift_name}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                              {s.opened_at ? s.opened_at.slice(0, 16) : '—'}
                                            </div>
                                          </td>
                                          <td style={{ color: '#e2e8f0', fontWeight: 600, padding: '8px 12px' }}>
                                            {s.cashier_name || 'Kasir'}
                                          </td>
                                          <td style={{ textAlign: 'center', padding: '8px 8px' }}>
                                            <span
                                              style={{
                                                fontSize: 9.5,
                                                padding: '2px 6px',
                                                borderRadius: 8,
                                                background: isOpen ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                                                color: isOpen ? '#34d399' : '#94a3b8',
                                                fontWeight: 700,
                                              }}
                                            >
                                              {isOpen ? 'AKTIF' : 'CLOSED'}
                                            </span>
                                          </td>
                                          <td style={{ textAlign: 'right', padding: '8px 12px' }}>
                                            <div style={{ fontWeight: 700, color: '#38bdf8' }}>{rupiah(s.initial_cash || 0)}</div>
                                            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Modal Buka</div>
                                          </td>
                                          <td style={{ textAlign: 'right', padding: '8px 12px' }}>
                                            <div style={{ fontWeight: 700, color: '#c084fc' }}>{isOpen ? 'Berjalan' : rupiah(s.system_cash || 0)}</div>
                                            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{isOpen ? 'Awal + Penjualan' : 'Awal + Penjualan'}</div>
                                          </td>
                                          <td style={{ textAlign: 'right', padding: '8px 12px' }}>
                                            <div style={{ fontWeight: 700, color: '#34d399' }}>{isOpen ? '—' : rupiah(s.closing_cash || 0)}</div>
                                            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{isOpen ? 'Belum Tutup' : 'Hitung Riil'}</div>
                                          </td>
                                          <td style={{ textAlign: 'right', padding: '8px 12px' }}>
                                            {isOpen ? (
                                              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Shift Berjalan</span>
                                            ) : (
                                              <div>
                                                <span
                                                  style={{
                                                    padding: '2px 7px',
                                                    borderRadius: 6,
                                                    background: diffBg,
                                                    color: diffColor,
                                                    fontWeight: 800,
                                                    fontSize: 10.5,
                                                    display: 'inline-block',
                                                  }}
                                                >
                                                  {isOver ? `+${rupiah(diff)} (Lebih)` : (diff < 0 ? `-${rupiah(Math.abs(diff))} (Tekor)` : 'Rp0 (Pas)')}
                                                </span>
                                                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                                                  Fisik - Sistem
                                                </div>
                                              </div>
                                            )}
                                          </td>
                                          <td style={{ textAlign: 'right', padding: '8px 12px' }}>
                                            {s.prev_shift_name ? (
                                              <div>
                                                <span
                                                  style={{
                                                    padding: '2px 7px',
                                                    borderRadius: 6,
                                                    background: interBg,
                                                    color: interColor,
                                                    fontWeight: 800,
                                                    fontSize: 10.5,
                                                    display: 'inline-block',
                                                  }}
                                                >
                                                  {isInterOver ? `+${rupiah(interDiff)}` : (interDiff < 0 ? `-${rupiah(Math.abs(interDiff))}` : 'Rp0 (Pas)')}
                                                </span>
                                                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                                                  vs {s.prev_shift_name} ({rupiah(s.prev_closing_cash || 0)})
                                                </div>
                                              </div>
                                            ) : (
                                              <div>
                                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Shift Perdana</span>
                                                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Modal Baru</div>
                                              </div>
                                            )}
                                          </td>
                                          <td style={{ fontSize: 10.5, color: 'var(--text-muted)', maxWidth: 160, padding: '8px 12px' }}>
                                            {s.notes || '—'}
                                          </td>
                                        </tr>
                                      );
                                    })
                                  ) : (
                                    <tr>
                                      <td colSpan={9} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                                        Tidak ada data shift kasir pada periode ini.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </>
                        );
                      })()}
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

      {/* MODAL GABUNGAN SHIFT KASIR (MULTI-SELECT) */}
      {shiftModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 99999 }}>
          <div
            className="modal-content card"
            style={{
              maxWidth: 580,
              width: '90%',
              padding: 0,
              background: '#0f172a',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <div
              className="modal-header"
              style={{
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(168, 85, 247, 0.1)',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: 'rgba(168, 85, 247, 0.25)',
                    color: '#c084fc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
                    Pilih Gabungan Shift Kasir
                  </h3>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Centang 2 atau lebih sesi shift untuk melihat akumulasi arus kas gabungan
                  </div>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShiftModalOpen(false)}
                style={{ padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '18px 20px', maxHeight: '60vh', overflowY: 'auto' }}>
              {/* Quick selection bar */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setTempShiftIds(availableShifts.map(s => s.id))}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  ✓ Pilih Semua ({availableShifts.length})
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setTempShiftIds(availableShifts.filter(s => s.status === 'OPEN').map(s => s.id))}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  Hanya Shift Aktif (OPEN)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setTempShiftIds(availableShifts.filter(s => s.status === 'CLOSED').map(s => s.id))}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  Hanya Shift Selesai (CLOSED)
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setTempShiftIds([])}
                  style={{ fontSize: 11, padding: '4px 8px', color: 'var(--text-muted)' }}
                >
                  ✕ Kosongkan
                </button>
              </div>

              {/* Shift List with Checkboxes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {availableShifts.map(s => {
                  const isChecked = tempShiftIds.includes(s.id);
                  const isOpen = s.status === 'OPEN';
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setTempShiftIds(prev =>
                          prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]
                        );
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: isChecked ? '1.5px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.08)',
                        background: isChecked ? 'rgba(168, 85, 247, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ color: isChecked ? '#c084fc' : 'var(--text-muted)' }}>
                        {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                          <div style={{ fontWeight: isChecked ? 700 : 500, color: '#f8fafc', fontSize: 13 }}>
                            {s.shift_name} <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>({s.cashier_name})</span>
                          </div>
                          <span
                            style={{
                              fontSize: 10,
                              padding: '1px 6px',
                              borderRadius: 10,
                              background: isOpen ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                              color: isOpen ? '#34d399' : '#94a3b8',
                              fontWeight: 700,
                            }}
                          >
                            {isOpen ? 'AKTIF / OPEN' : 'CLOSED'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          <span>Tanggal: {s.date || (s.opened_at ? s.opened_at.slice(0, 10) : '—')}</span>
                          <span style={{ color: '#34d399', fontWeight: 600 }}>Modal Awal Kas: {rupiah(s.initial_cash)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Live Calculation Box */}
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 8,
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Shift Dipilih: {tempShiftIds.length} dari {availableShifts.length} Sesi</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>
                    Total Modal Awal Kas Gabungan:
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#34d399' }}>
                  {rupiah(
                    availableShifts
                      .filter(s => tempShiftIds.includes(s.id))
                      .reduce((acc, s) => acc + Number(s.initial_cash || 0), 0)
                  )}
                </div>
              </div>
            </div>

            <div
              className="modal-footer"
              style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(15, 23, 42, 0.95)',
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShiftModalOpen(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (tempShiftIds.length === 0 || tempShiftIds.length === availableShifts.length) {
                    setSelectedShift('ALL');
                  } else if (tempShiftIds.length === 1) {
                    setSelectedShift(tempShiftIds[0].toString());
                  } else {
                    setSelectedShift(tempShiftIds.join(','));
                  }
                  setShiftModalOpen(false);
                }}
                style={{ fontWeight: 700 }}
              >
                ✓ Terapkan Gabungan ({tempShiftIds.length} Shift)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GABUNGAN METODE PEMBAYARAN (MULTI-SELECT) */}
      {customPmModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 99999 }}>
          <div
            className="modal-content card"
            style={{
              maxWidth: 580,
              width: '90%',
              padding: 0,
              background: '#0f172a',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <div
              className="modal-header"
              style={{
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(56, 189, 248, 0.1)',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: 'rgba(56, 189, 248, 0.25)',
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
                    Pilih Gabungan Metode Pembayaran
                  </h3>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Kombinasikan metode pembayaran secara fleksibel untuk laporan arus kas
                  </div>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCustomPmModalOpen(false)}
                style={{ padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '18px 20px', maxHeight: '60vh', overflowY: 'auto' }}>
              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setTempPmList(AVAILABLE_PAYMENT_METHODS.map(m => m.id))}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  ✓ Pilih Semua ({AVAILABLE_PAYMENT_METHODS.length})
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setTempPmList(['QRIS', 'GRAB', 'TRANSFER', 'DEBIT'])}
                  style={{ fontSize: 11, padding: '4px 10px', color: '#06b6d4' }}
                >
                  ⚡ Semua Non-Tunai Saja
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setTempPmList(['CASH', 'PETTY_CASH'])}
                  style={{ fontSize: 11, padding: '4px 10px', color: '#10b981' }}
                >
                  💵 Kas Fisik & Petty Saja
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setTempPmList([])}
                  style={{ fontSize: 11, padding: '4px 8px', color: 'var(--text-muted)' }}
                >
                  ✕ Kosongkan
                </button>
              </div>

              {/* Methods Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {AVAILABLE_PAYMENT_METHODS.map(m => {
                  const isChecked = tempPmList.includes(m.id);
                  const Icon = m.icon;
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        setTempPmList(prev =>
                          prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id]
                        );
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: isChecked ? `1.5px solid ${m.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                        background: isChecked ? `${m.color}15` : 'rgba(255, 255, 255, 0.02)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ color: isChecked ? m.color : 'var(--text-muted)', marginTop: 2 }}>
                        {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon size={14} color={m.color} />
                          <span style={{ fontWeight: isChecked ? 800 : 600, color: '#f8fafc', fontSize: 13 }}>
                            {m.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.3 }}>
                          {m.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="modal-footer"
              style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(15, 23, 42, 0.95)',
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCustomPmModalOpen(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (tempPmList.length === 0 || tempPmList.length === AVAILABLE_PAYMENT_METHODS.length) {
                    setSelectedPaymentMethod('ALL');
                  } else if (tempPmList.length === 1) {
                    setSelectedPaymentMethod(tempPmList[0]);
                  } else {
                    setSelectedPaymentMethod(tempPmList.join(','));
                  }
                  setCustomPmModalOpen(false);
                }}
                style={{ fontWeight: 700 }}
              >
                ✓ Terapkan Kombinasi ({tempPmList.length} Metode)
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
              Cabang: {outletTitle} | Periode: {dateFrom} s/d {dateTo} | Shift: {activeShiftMeta?.label} (Modal Awal: {rupiah(activeShiftMeta?.initialCashTotal || 0)}) | Metode Kas: {activePmMeta?.label || 'Semua Metode'} | Dicetak: {new Date().toLocaleString('id-ID')}
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
              <tr style={{ fontWeight: 'bold', fontSize: 12, background: '#e2e8f0', borderTop: '1px solid #94a3b8' }}>
                <td style={{ padding: '7px 8px' }}>KENAIKAN / (PENURUNAN) BERSIH KAS RIIL</td>
                <td style={{ textAlign: 'right', padding: '7px 8px' }}>{rupiah(sum.net_cash_flow)}</td>
              </tr>
              <tr style={{ fontSize: 11, background: '#f8fafc' }}>
                <td style={{ padding: '5px 8px 5px 20px', color: '#475569' }}>
                  (+) Modal Awal Kas di Laci ({activeShiftMeta?.label || 'Semua Shift'})
                </td>
                <td style={{ textAlign: 'right', padding: '5px 8px', color: '#0369a1', fontWeight: 600 }}>
                  {rupiah(activeShiftMeta?.initialCashTotal || 0)}
                </td>
              </tr>
              <tr style={{ fontWeight: 'bold', fontSize: 13, background: '#cbd5e1', borderTop: '1.5px solid #0f172a', borderBottom: '3px double #000' }}>
                <td style={{ padding: '8px' }}>TOTAL FISIK UANG DIPEGANG KASIR (SALDO AKHIR KAS LACI)</td>
                <td style={{ textAlign: 'right', padding: '8px', color: '#047857' }}>
                  {rupiah((activeShiftMeta?.initialCashTotal || 0) + (sum.net_cash_flow || 0))}
                </td>
              </tr>
              {activeShiftMeta?.closedCount > 0 && (
                <>
                  <tr style={{ fontSize: 11, background: '#f1f5f9' }}>
                    <td style={{ padding: '5px 8px 5px 20px', color: '#475569' }}>
                      (+/-) Selisih Kasir Selesai Shift ({activeShiftMeta.closedCount} Sesi Ditutup: Fisik {rupiah(activeShiftMeta.closingCashTotal || 0)} vs Sistem {rupiah(activeShiftMeta.systemCashTotal || 0)})
                    </td>
                    <td style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 700, color: activeShiftMeta.cashDifferenceTotal === 0 ? '#047857' : (activeShiftMeta.cashDifferenceTotal > 0 ? '#0284c7' : '#b91c1c') }}>
                      {activeShiftMeta.cashDifferenceTotal > 0 ? `+${rupiah(activeShiftMeta.cashDifferenceTotal)} (Lebih)` : (activeShiftMeta.cashDifferenceTotal < 0 ? `-${rupiah(Math.abs(activeShiftMeta.cashDifferenceTotal))} (Tekor)` : 'Rp0 (Pas)')}
                    </td>
                  </tr>
                  <tr style={{ fontSize: 11, background: '#f8fafc' }}>
                    <td style={{ padding: '5px 8px 5px 20px', color: '#475569' }}>
                      (+/-) Selisih Antar Kasir (Serah Terima Shift: Modal Buka vs Kas Closing Lalu)
                    </td>
                    <td style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 700, color: Number(activeShiftMeta?.interShiftDiffTotal || 0) === 0 ? '#047857' : (Number(activeShiftMeta?.interShiftDiffTotal || 0) > 0 ? '#0284c7' : '#b91c1c') }}>
                      {Number(activeShiftMeta?.interShiftDiffTotal || 0) > 0 ? `+${rupiah(activeShiftMeta.interShiftDiffTotal)} (Lebih)` : (Number(activeShiftMeta?.interShiftDiffTotal || 0) < 0 ? `-${rupiah(Math.abs(activeShiftMeta.interShiftDiffTotal))} (Tekor)` : 'Rp0 (Pas)')}
                    </td>
                  </tr>
                  <tr style={{ fontWeight: 'bold', fontSize: 13, background: '#e0f2fe', borderTop: '1.5px solid #0284c7', borderBottom: '3px double #000' }}>
                    <td style={{ padding: '8px' }}>TOTAL SISA KAS DIPEGANG (SETELAH SELISIH KASIR)</td>
                    <td style={{ textAlign: 'right', padding: '8px', color: '#0284c7' }}>
                      {rupiah((activeShiftMeta?.initialCashTotal || 0) + (sum.net_cash_flow || 0) + Number(activeShiftMeta.cashDifferenceTotal || 0))}
                    </td>
                  </tr>
                </>
              )}
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
