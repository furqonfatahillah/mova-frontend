import { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, PlusCircle, Search, RefreshCw, Eye,
  Printer, FileSpreadsheet, AlertCircle,
  Calendar, CheckCircle2, Clock, DollarSign,
  ChevronRight, X, User, Phone, MapPin, CreditCard,
  Trash2, Edit3, ArrowRight, ShieldAlert, Receipt, Check,
  Users, CheckSquare, Square, Layers, Sparkles, History,
  Building2, TrendingDown, AlertTriangle, ArrowUpRight,
  Filter, Download
} from 'lucide-react';
import api from '../api/client';
import {
  num, rupiah, pct, StatusPill, LoadingState,
  PageHeader, MiniCard, formatDateTime
} from '../components/ui';
import { getTodayStr, getMonthStartStr, getMonthEndStr } from '../utils/date';
import { useOutlet } from '../context/OutletContext';
import { exportSupplierPayablesToExcel, printSupplierPayablesReport } from '../utils/exportReport';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/swal';

export default function Payables() {
  const {
    activeOutletId,
    activeOutlet,
    outlets,
    canSwitchOutlet,
    currentBusiness,
    currentUser,
  } = useOutlet();

  const businessName = currentBusiness?.name || currentUser?.business?.name || 'MOVA POS F&B';
  const outletName = (activeOutlet && activeOutletId !== 'ALL' && activeOutletId !== 'all') ? activeOutlet.name : 'Semua Cabang (Konsolidasi)';

  const targetOutlet = useMemo(() => {
    if (!canSwitchOutlet) {
      return Number(currentUser?.outlet_id || activeOutletId || outlets?.[0]?.id || 1);
    }
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      return Number(activeOutletId);
    }
    return undefined;
  }, [activeOutletId, outlets, canSwitchOutlet, currentUser?.outlet_id]);

  // Tab State: 'SUPPLIERS' | 'PAYABLES' | 'PAYMENTS' | 'REPORT'
  const [activeTab, setActiveTab] = useState('SUPPLIERS');

  // Main Data States
  const [items, setItems] = useState([]);
  const [masterSuppliers, setMasterSuppliers] = useState([]);
  const [stats, setStats] = useState({
    total_payables: 0,
    total_remaining: 0,
    total_paid: 0,
    total_overdue: 0,
    count_overdue: 0,
    paid_this_month: 0,
    count_unpaid: 0,
    count_partial: 0,
    count_paid: 0,
    total_suppliers: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dueFilter, setDueFilter] = useState('ALL');

  // Report Specific States
  const [reportPeriod, setReportPeriod] = useState({
    from: getMonthStartStr(),
    to: getMonthEndStr(),
  });
  const [reportData, setReportData] = useState({ rows: [], summary: {}, period: {}, outlet: '' });
  const [reportLoading, setReportLoading] = useState(false);

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newPayableForm, setNewPayableForm] = useState({
    supplier_name: '',
    supplier_phone: '',
    purchase_no: '',
    issue_date: getTodayStr(),
    due_date: '',
    total_amount: '',
    initial_paid: '',
    payment_method: 'CASH',
    notes: '',
  });

  const [payModal, setPayModal] = useState({
    open: false, item: null, amount: '', payment_date: getTodayStr(),
    payment_method: 'CASH', reference_no: '', notes: ''
  });

  const [bulkPayModal, setBulkPayModal] = useState({
    open: false,
    supplierName: '',
    supplierId: null,
    selectedIds: [],
    amount: '',
    payment_date: getTodayStr(),
    payment_method: 'CASH',
    reference_no: '',
    notes: '',
  });

  const [historyModal, setHistoryModal] = useState({ open: false, item: null });
  const [detailModal, setDetailModal] = useState({ open: false, item: null });
  const [expandedSupplierKey, setExpandedSupplierKey] = useState(null);
  const [selectedPayableIds, setSelectedPayableIds] = useState([]);
  const [savingAction, setSavingAction] = useState(false);

  // Selected unpaid items for bulk pay
  const selectedUnpaidPayables = useMemo(() => {
    return items.filter(i => selectedPayableIds.includes(i.id) && i.remaining_amount > 0);
  }, [items, selectedPayableIds]);

  const selectedTotalRemaining = useMemo(() => {
    return selectedUnpaidPayables.reduce((acc, curr) => acc + (Number(curr.remaining_amount) || 0), 0);
  }, [selectedUnpaidPayables]);

  // Extract all payment logs
  const allPaymentLogs = useMemo(() => {
    const logs = [];
    for (const p of items) {
      if (Array.isArray(p.payments)) {
        for (const py of p.payments) {
          logs.push({
            ...py,
            payable_id: p.id,
            payable_no: p.payable_no,
            purchase_no: p.purchase_no,
            supplier_name: p.supplier_name,
            supplier_phone: p.supplier_phone,
            total_amount: p.total_amount,
            remaining_amount: p.remaining_amount,
            outlet_name: p.outlet?.name || p.outlet_name,
          });
        }
      }
    }
    return logs.sort((a, b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at));
  }, [items]);

  // Group items by Supplier
  const supplierSummary = useMemo(() => {
    const groups = {};
    for (const item of items) {
      const key = (item.supplier_name || 'Supplier Tanpa Nama').trim().toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          key,
          supplier_name: item.supplier_name || 'Supplier Tanpa Nama',
          supplier_phone: item.supplier_phone || '',
          supplier_id: item.supplier_id || null,
          total_payables: 0,
          total_remaining: 0,
          total_paid: 0,
          count_invoices: 0,
          count_overdue: 0,
          oldest_due_date: null,
          items: [],
        };
      }
      const g = groups[key];
      g.items.push(item);
      g.count_invoices += 1;
      if (item.status !== 'CANCELLED') {
        g.total_payables += Number(item.total_amount) || 0;
        g.total_paid += Number(item.paid_amount) || 0;
        if (item.status !== 'PAID') {
          g.total_remaining += Number(item.remaining_amount) || 0;
          if (item.is_overdue) {
            g.count_overdue += 1;
          }
          if (item.due_date && (!g.oldest_due_date || item.due_date < g.oldest_due_date)) {
            g.oldest_due_date = item.due_date;
          }
        }
      }
    }

    return Object.values(groups).sort((a, b) => b.total_remaining - a.total_remaining);
  }, [items]);

  // Initial fetch
  useEffect(() => {
    fetchPayables();
    fetchSuppliers();
  }, [targetOutlet, statusFilter, dueFilter]);

  // Fetch report data when REPORT tab is active or reportPeriod changes
  useEffect(() => {
    if (activeTab === 'REPORT') {
      fetchReportData();
    }
  }, [activeTab, reportPeriod, targetOutlet]);

  async function fetchPayables() {
    setLoading(true);
    try {
      const params = {};
      if (targetOutlet) params.outlet_id = targetOutlet;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (dueFilter !== 'ALL') params.due_filter = dueFilter;
      if (searchQuery.trim()) params.q = searchQuery.trim();

      const { data } = await api.get('/payables', { params });
      setItems(data.data || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      toast.error('Gagal memuat data hutang supplier');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSuppliers() {
    try {
      const { data } = await api.get('/payables/suppliers');
      setMasterSuppliers(data || []);
    } catch {}
  }

  async function fetchReportData() {
    setReportLoading(true);
    try {
      const params = {
        from: reportPeriod.from,
        to: reportPeriod.to,
      };
      if (targetOutlet) params.outlet_id = targetOutlet;
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const { data } = await api.get('/payables/report', { params });
      setReportData(data);
    } catch (err) {
      toast.error('Gagal memuat data laporan hutang');
    } finally {
      setReportLoading(false);
    }
  }

  // Filtered Payables
  const filteredItems = useMemo(() => {
    return items.filter(it => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = it.supplier_name?.toLowerCase().includes(q);
        const matchNo = it.payable_no?.toLowerCase().includes(q);
        const matchPur = it.purchase_no?.toLowerCase().includes(q);
        const matchPhone = it.supplier_phone?.includes(q);
        const matchIng = it.ingredient?.name?.toLowerCase().includes(q);
        if (!matchName && !matchNo && !matchPur && !matchPhone && !matchIng) return false;
      }
      return true;
    });
  }, [items, searchQuery]);

  // Open Single Pay Modal
  function openPayModal(item) {
    setPayModal({
      open: true,
      item,
      amount: item.remaining_amount || '',
      payment_date: getTodayStr(),
      payment_method: 'CASH',
      reference_no: '',
      notes: '',
    });
  }

  // Submit Single Payment
  async function handleSinglePaymentSubmit(e) {
    e.preventDefault();
    if (!payModal.item) return;
    const amountNum = Number(payModal.amount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Masukkan nominal pembayaran yang valid');
      return;
    }
    if (amountNum > payModal.item.remaining_amount + 0.01) {
      toast.error(`Nominal melebihi sisa hutang (Rp ${num(payModal.item.remaining_amount)})`);
      return;
    }

    setSavingAction(true);
    try {
      const payload = {
        amount: amountNum,
        payment_date: payModal.payment_date,
        payment_method: payModal.payment_method,
        reference_no: payModal.reference_no,
        notes: payModal.notes,
      };
      await api.post(`/payables/${payModal.item.id}/payments`, payload);
      toast.success(`Pembayaran Rp ${num(amountNum)} berhasil dicatat!`);
      setPayModal({ open: false, item: null, amount: '', payment_date: getTodayStr(), payment_method: 'CASH', reference_no: '', notes: '' });
      fetchPayables();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan pembayaran');
    } finally {
      setSavingAction(false);
    }
  }

  // Open Bulk Pay Modal for a specific Supplier
  function openBulkPayForSupplier(supplierGroup) {
    setBulkPayModal({
      open: true,
      supplierName: supplierGroup.supplier_name,
      supplierId: supplierGroup.supplier_id,
      selectedIds: [],
      amount: supplierGroup.total_remaining || '',
      payment_date: getTodayStr(),
      payment_method: 'CASH',
      reference_no: '',
      notes: `Pelunasan hutang supplier: ${supplierGroup.supplier_name}`,
    });
  }

  // Open Bulk Pay Modal for Selected Invoices
  function openBulkPayForSelected() {
    if (selectedUnpaidPayables.length === 0) return;
    setBulkPayModal({
      open: true,
      supplierName: selectedUnpaidPayables[0]?.supplier_name || 'Supplier Terpilih',
      supplierId: selectedUnpaidPayables[0]?.supplier_id || null,
      selectedIds: selectedUnpaidPayables.map(i => i.id),
      amount: selectedTotalRemaining || '',
      payment_date: getTodayStr(),
      payment_method: 'CASH',
      reference_no: '',
      notes: `Pembayaran sekaligus untuk ${selectedUnpaidPayables.length} nota hutang`,
    });
  }

  // Submit Bulk Payment
  async function handleBulkPaymentSubmit(e) {
    e.preventDefault();
    const amountNum = Number(bulkPayModal.amount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Masukkan nominal pembayaran yang valid');
      return;
    }

    setSavingAction(true);
    try {
      const payload = {
        amount: amountNum,
        payment_date: bulkPayModal.payment_date,
        payment_method: bulkPayModal.payment_method,
        reference_no: bulkPayModal.reference_no,
        notes: bulkPayModal.notes,
      };

      if (bulkPayModal.selectedIds && bulkPayModal.selectedIds.length > 0) {
        payload.payable_ids = bulkPayModal.selectedIds;
      } else if (bulkPayModal.supplierId) {
        payload.supplier_id = bulkPayModal.supplierId;
      } else {
        payload.supplier_name = bulkPayModal.supplierName;
      }

      const { data } = await api.post('/payables/bulk-payment', payload);
      toast.success(data.message || 'Pembayaran sekaligus berhasil diproses!');
      setBulkPayModal({ open: false, supplierName: '', supplierId: null, selectedIds: [], amount: '', payment_date: getTodayStr(), payment_method: 'CASH', reference_no: '', notes: '' });
      setSelectedPayableIds([]);
      fetchPayables();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses pembayaran sekaligus');
    } finally {
      setSavingAction(false);
    }
  }

  // Delete / Void a payment
  async function handleDeletePayment(payableId, paymentId) {
    const confirmed = await confirmDialog({
      title: 'Batalkan Riwayat Pembayaran?',
      text: 'Yakin ingin membatalkan/menghapus riwayat pembayaran ini? Saldo hutang akan dikembalikan seperti semula.',
      confirmText: 'Ya, Batalkan Pembayaran',
      cancelText: 'Kembali',
      isDanger: true,
    });
    if (!confirmed) return;

    try {
      await api.delete(`/payables/${payableId}/payments/${paymentId}`);
      toast.success('Riwayat pembayaran berhasil dibatalkan');
      fetchPayables();
      if (historyModal.open) {
        setHistoryModal(prev => {
          if (!prev.item) return prev;
          const updatedPayments = prev.item.payments?.filter(p => p.id !== paymentId) || [];
          return {
            ...prev,
            item: { ...prev.item, payments: updatedPayments }
          };
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus pembayaran');
    }
  }

  // Create Manual Payable
  async function handleCreatePayableSubmit(e) {
    e.preventDefault();
    if (!newPayableForm.supplier_name?.trim()) {
      toast.error('Nama supplier wajib diisi');
      return;
    }
    const totalNum = Number(newPayableForm.total_amount);
    if (!totalNum || totalNum <= 0) {
      toast.error('Total hutang harus lebih dari 0');
      return;
    }

    setSavingAction(true);
    try {
      const payload = {
        outlet_id: targetOutlet || 1,
        supplier_name: newPayableForm.supplier_name.trim(),
        supplier_phone: newPayableForm.supplier_phone || null,
        purchase_no: newPayableForm.purchase_no || null,
        issue_date: newPayableForm.issue_date,
        due_date: newPayableForm.due_date || undefined,
        total_amount: totalNum,
        initial_paid: newPayableForm.initial_paid ? Number(newPayableForm.initial_paid) : 0,
        payment_method: newPayableForm.payment_method || 'CASH',
        notes: newPayableForm.notes || null,
      };

      await api.post('/payables', payload);
      toast.success('Hutang supplier berhasil dicatat!');
      setCreateModalOpen(false);
      setNewPayableForm({
        supplier_name: '',
        supplier_phone: '',
        purchase_no: '',
        issue_date: getTodayStr(),
        due_date: '',
        total_amount: '',
        initial_paid: '',
        payment_method: 'CASH',
        notes: '',
      });
      fetchPayables();
      fetchSuppliers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mencatat hutang supplier');
    } finally {
      setSavingAction(false);
    }
  }

  // Selection toggle
  function toggleSelectAll() {
    const unpaids = items.filter(i => i.remaining_amount > 0).map(i => i.id);
    if (selectedPayableIds.length === unpaids.length) {
      setSelectedPayableIds([]);
    } else {
      setSelectedPayableIds(unpaids);
    }
  }

  function toggleSelectItem(id) {
    setSelectedPayableIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="space-y-6 fade-in" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.4) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#f87171'
            }}>
              <BookOpen size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Buku Hutang Supplier (Accounts Payable)
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Pencatatan hutang pembelian bahan ke supplier, cicilan bertahap, dan pelunasan sekaligus
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => fetchPayables()}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            title="Refresh Data"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              const defaultDue = new Date();
              defaultDue.setDate(defaultDue.getDate() + 30);
              setNewPayableForm(f => ({ ...f, due_date: defaultDue.toISOString().slice(0, 10) }));
              setCreateModalOpen(true);
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}
          >
            <PlusCircle size={16} />
            <span>Catat Hutang Baru</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="card" style={{ padding: 18, borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Hutang Aktif
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#f87171', marginTop: 4 }}>
                {rupiah(stats.total_remaining)}
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
            Dari total {stats.count_unpaid + stats.count_partial} tagihan belum lunas
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Hutang Jatuh Tempo
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>
                {rupiah(stats.total_overdue)}
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: stats.count_overdue > 0 ? '#fca5a5' : 'var(--text-muted)', marginTop: 8 }}>
            {stats.count_overdue > 0 ? `⚠️ ${stats.count_overdue} tagihan melewati batas tempo!` : 'Tidak ada tagihan tertunggak'}
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Pelunasan Kas Bulan Ini
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                {rupiah(stats.paid_this_month)}
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
            Arus kas keluar pelunasan hutang supplier
          </div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid #38bdf8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Supplier Hutang
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
                {stats.total_suppliers} <span style={{ fontSize: 14, fontWeight: 500 }}>Supplier</span>
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(56, 189, 248, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
            Total transaksi: {rupiah(stats.total_payables)}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex', gap: 6, borderBottom: '1px solid var(--border)',
        paddingBottom: 2, overflowX: 'auto'
      }}>
        <button
          onClick={() => setActiveTab('SUPPLIERS')}
          className="btn"
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: activeTab === 'SUPPLIERS' ? '2.5px solid var(--accent-bright)' : '2.5px solid transparent',
            color: activeTab === 'SUPPLIERS' ? 'var(--accent-bright)' : 'var(--text-secondary)',
            background: activeTab === 'SUPPLIERS' ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
            display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer'
          }}
        >
          <Users size={16} />
          <span>Ringkasan Per Supplier</span>
          <span style={{
            fontSize: 11, padding: '2px 6px', borderRadius: 999,
            background: activeTab === 'SUPPLIERS' ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
            color: '#fff'
          }}>
            {supplierSummary.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('PAYABLES')}
          className="btn"
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: activeTab === 'PAYABLES' ? '2.5px solid var(--accent-bright)' : '2.5px solid transparent',
            color: activeTab === 'PAYABLES' ? 'var(--accent-bright)' : 'var(--text-secondary)',
            background: activeTab === 'PAYABLES' ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
            display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer'
          }}
        >
          <Layers size={16} />
          <span>Daftar Nota Hutang Detail</span>
          <span style={{
            fontSize: 11, padding: '2px 6px', borderRadius: 999,
            background: activeTab === 'PAYABLES' ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
            color: '#fff'
          }}>
            {items.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('PAYMENTS')}
          className="btn"
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: activeTab === 'PAYMENTS' ? '2.5px solid var(--accent-bright)' : '2.5px solid transparent',
            color: activeTab === 'PAYMENTS' ? 'var(--accent-bright)' : 'var(--text-secondary)',
            background: activeTab === 'PAYMENTS' ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
            display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer'
          }}
        >
          <History size={16} />
          <span>Riwayat Kas Pembayaran</span>
          <span style={{
            fontSize: 11, padding: '2px 6px', borderRadius: 999,
            background: activeTab === 'PAYMENTS' ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
            color: '#fff'
          }}>
            {allPaymentLogs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('REPORT')}
          className="btn"
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: activeTab === 'REPORT' ? '2.5px solid #10b981' : '2.5px solid transparent',
            color: activeTab === 'REPORT' ? '#34d399' : 'var(--text-secondary)',
            background: activeTab === 'REPORT' ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
            display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer'
          }}
        >
          <FileSpreadsheet size={16} color={activeTab === 'REPORT' ? '#34d399' : undefined} />
          <span>Laporan Hutang Supplier (Excel/PDF)</span>
        </button>
      </div>

      {/* TAB 1: RINGKASAN PER SUPPLIER */}
      {activeTab === 'SUPPLIERS' && (
        <div className="space-y-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 34, fontSize: 13 }}
                placeholder="Cari nama supplier / kontak..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Total <strong>{supplierSummary.length}</strong> supplier terdata
            </div>
          </div>

          {loading ? (
            <LoadingState message="Memuat ringkasan hutang supplier..." />
          ) : supplierSummary.length === 0 ? (
            <div className="card text-center" style={{ padding: 40 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                Belum ada data hutang supplier yang tercatat.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {supplierSummary
                .filter(s => !searchQuery.trim() || s.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) || s.supplier_phone.includes(searchQuery))
                .map((s, idx) => {
                  const isExpanded = expandedSupplierKey === s.key;
                  const isOverdue = s.count_overdue > 0;
                  const pctPaid = s.total_payables > 0 ? (s.total_paid / s.total_payables) * 100 : 0;

                  return (
                    <div key={idx} className="card" style={{
                      padding: 16,
                      borderLeft: isOverdue ? '4px solid #ef4444' : s.total_remaining > 0 ? '4px solid #f59e0b' : '4px solid #10b981',
                      transition: 'all 0.2s'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                        <div style={{ flex: '1 1 260px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                              {s.supplier_name}
                            </h3>
                            {isOverdue && (
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontWeight: 700 }}>
                                {s.count_overdue} Nota Lewat Tempo!
                              </span>
                            )}
                            {s.total_remaining <= 0 && (
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', fontWeight: 700 }}>
                                Lunas Semua
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                            {s.supplier_phone && <span>📞 {s.supplier_phone}</span>}
                            <span>📑 {s.count_invoices} Nota Hutang</span>
                            {s.oldest_due_date && <span>⏳ Tempo Terdekat: {s.oldest_due_date}</span>}
                          </div>
                        </div>

                        {/* Financial Columns */}
                        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Belanja:</div>
                            <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{rupiah(s.total_payables)}</div>
                          </div>

                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sudah Dibayar:</div>
                            <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: '#34d399' }}>{rupiah(s.total_paid)}</div>
                          </div>

                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sisa Hutang:</div>
                            <div className="mono" style={{ fontSize: 17, fontWeight: 800, color: s.total_remaining > 0 ? '#f87171' : '#34d399' }}>
                              {rupiah(s.total_remaining)}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', gap: 8 }}>
                            {s.total_remaining > 0 && (
                              <button
                                onClick={() => openBulkPayForSupplier(s)}
                                className="btn btn-primary"
                                style={{
                                  fontSize: 12, fontWeight: 700, padding: '6px 12px',
                                  display: 'flex', alignItems: 'center', gap: 5,
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  borderColor: '#059669'
                                }}
                              >
                                <Check size={14} />
                                <span>Bayar Sekaligus</span>
                              </button>
                            )}

                            <button
                              onClick={() => setExpandedSupplierKey(isExpanded ? null : s.key)}
                              className="btn btn-secondary"
                              style={{ fontSize: 12, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <span>{isExpanded ? 'Tutup Rincian' : 'Lihat Nota'}</span>
                              <ChevronRight size={14} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: '0.2s' }} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ marginTop: 12 }}>
                        <div style={{ height: 4, width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(pctPaid, 100)}%`,
                            background: s.total_remaining <= 0 ? '#10b981' : 'linear-gradient(90deg, #10b981, #3b82f6)',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                      </div>

                      {/* Expanded Invoices for this Supplier */}
                      {isExpanded && (
                        <div style={{
                          marginTop: 14, paddingTop: 14,
                          borderTop: '1px dashed var(--border)',
                          overflowX: 'auto'
                        }}>
                          <table className="table" style={{ fontSize: 12, width: '100%' }}>
                            <thead>
                              <tr>
                                <th>No. Hutang / Faktur</th>
                                <th>Bahan Baku</th>
                                <th>Tgl. Dibuat</th>
                                <th>Jatuh Tempo</th>
                                <th style={{ textAlign: 'right' }}>Total Tagihan</th>
                                <th style={{ textAlign: 'right' }}>Dibayar</th>
                                <th style={{ textAlign: 'right' }}>Sisa Hutang</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.items.map((it) => (
                                <tr key={it.id}>
                                  <td>
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{it.payable_no}</div>
                                    {it.purchase_no && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Faktur: {it.purchase_no}</div>}
                                  </td>
                                  <td>{it.ingredient?.name || '-'}</td>
                                  <td>{it.issue_date}</td>
                                  <td>
                                    <span style={{ color: it.is_overdue ? '#fca5a5' : 'inherit', fontWeight: it.is_overdue ? 700 : 400 }}>
                                      {it.due_date} {it.is_overdue && '⚠️'}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }} className="mono">{rupiah(it.total_amount)}</td>
                                  <td style={{ textAlign: 'right' }} className="mono" style={{ color: '#34d399' }}>{rupiah(it.paid_amount)}</td>
                                  <td style={{ textAlign: 'right' }} className="mono" style={{ color: it.remaining_amount > 0 ? '#f87171' : '#34d399', fontWeight: 700 }}>
                                    {rupiah(it.remaining_amount)}
                                  </td>
                                  <td>
                                    <StatusPill status={it.status} label={it.status_label} />
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'inline-flex', gap: 6 }}>
                                      {it.remaining_amount > 0 && (
                                        <button
                                          onClick={() => openPayModal(it)}
                                          className="btn btn-sm btn-primary"
                                          style={{ fontSize: 11, padding: '4px 8px' }}
                                        >
                                          Bayar
                                        </button>
                                      )}
                                      <button
                                        onClick={() => setHistoryModal({ open: true, item: it })}
                                        className="btn btn-sm btn-secondary"
                                        style={{ fontSize: 11, padding: '4px 8px' }}
                                        title="Riwayat Pembayaran"
                                      >
                                        <History size={12} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DAFTAR NOTA HUTANG DETAIL */}
      {activeTab === 'PAYABLES' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: '1 1 400px' }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                  <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-control"
                    style={{ paddingLeft: 34, fontSize: 12.5 }}
                    placeholder="Cari No. Hutang, No. Faktur, Supplier..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                <select
                  className="form-control"
                  style={{ width: 140, fontSize: 12.5 }}
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">Semua Status</option>
                  <option value="UNPAID">Belum Dibayar</option>
                  <option value="PARTIAL">Sebagian (Cicil)</option>
                  <option value="PAID">Lunas</option>
                  <option value="OVERDUE">Lewat Tempo ⚠️</option>
                </select>

                <select
                  className="form-control"
                  style={{ width: 150, fontSize: 12.5 }}
                  value={dueFilter}
                  onChange={e => setDueFilter(e.target.value)}
                >
                  <option value="ALL">Semua Jatuh Tempo</option>
                  <option value="OVERDUE">Lewat Tempo ⚠️</option>
                  <option value="TODAY">Jatuh Tempo Hari Ini</option>
                  <option value="THIS_WEEK">7 Hari Mendatang</option>
                  <option value="THIS_MONTH">Bulan Ini</option>
                </select>
              </div>

              {selectedPayableIds.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>
                    {selectedPayableIds.length} nota dipilih ({rupiah(selectedTotalRemaining)})
                  </span>
                  <button
                    onClick={openBulkPayForSelected}
                    className="btn btn-sm btn-primary"
                    style={{ fontSize: 12, fontWeight: 700 }}
                  >
                    Bayar Sekaligus Terpilih
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedPayableIds.length > 0 && selectedPayableIds.length === items.filter(i => i.remaining_amount > 0).length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>No. Hutang / Faktur</th>
                  <th>Supplier</th>
                  <th>Bahan Baku</th>
                  <th>Tgl. Dibuat</th>
                  <th>Jatuh Tempo</th>
                  <th style={{ textAlign: 'right' }}>Total Tagihan</th>
                  <th style={{ textAlign: 'right' }}>Dibayar</th>
                  <th style={{ textAlign: 'right' }}>Sisa Hutang</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', padding: 30 }}>
                      <LoadingState message="Memuat daftar hutang..." />
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                      Tidak ada data hutang supplier yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(it => {
                    const isSelected = selectedPayableIds.includes(it.id);
                    const isOverdue = it.is_overdue;

                    return (
                      <tr key={it.id} style={{ background: isSelected ? 'rgba(124, 58, 237, 0.05)' : undefined }}>
                        <td style={{ textAlign: 'center' }}>
                          {it.remaining_amount > 0 && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectItem(it.id)}
                            />
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{it.payable_no}</div>
                          {it.purchase_no && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No. PO: {it.purchase_no}</div>}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{it.supplier_name}</div>
                          {it.supplier_phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{it.supplier_phone}</div>}
                        </td>
                        <td>{it.ingredient?.name || '-'}</td>
                        <td>{it.issue_date}</td>
                        <td>
                          <div style={{ color: isOverdue ? '#fca5a5' : 'inherit', fontWeight: isOverdue ? 700 : 400 }}>
                            {it.due_date}
                          </div>
                          {isOverdue && (
                            <span style={{ fontSize: 10, color: '#f87171', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <AlertCircle size={10} /> Lewat Tempo
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }} className="mono">{rupiah(it.total_amount)}</td>
                        <td style={{ textAlign: 'right' }} className="mono" style={{ color: '#34d399' }}>{rupiah(it.paid_amount)}</td>
                        <td style={{ textAlign: 'right' }} className="mono" style={{ color: it.remaining_amount > 0 ? '#f87171' : '#34d399', fontWeight: 700 }}>
                          {rupiah(it.remaining_amount)}
                        </td>
                        <td>
                          <StatusPill status={it.status} label={it.status_label} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {it.remaining_amount > 0 && (
                              <button
                                onClick={() => openPayModal(it)}
                                className="btn btn-sm btn-primary"
                                style={{ fontSize: 11, padding: '4px 8px', fontWeight: 700 }}
                              >
                                Bayar
                              </button>
                            )}
                            <button
                              onClick={() => setHistoryModal({ open: true, item: it })}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              title="Riwayat Pembayaran"
                            >
                              <History size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RIWAYAT KAS PEMBAYARAN */}
      {activeTab === 'PAYMENTS' && (
        <div className="space-y-4">
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                Log Seluruh Transaksi Pembayaran Hutang Supplier
              </h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Total <strong>{allPaymentLogs.length}</strong> pembayaran terdata
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th>No. Pembayaran</th>
                  <th>Tanggal Bayar</th>
                  <th>Supplier</th>
                  <th>No. Hutang / Faktur</th>
                  <th>Metode Bayar</th>
                  <th>No. Referensi / Bukti</th>
                  <th style={{ textAlign: 'right' }}>Nominal Pembayaran</th>
                  <th>Dicatat Oleh</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {allPaymentLogs.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                      Belum ada riwayat pembayaran hutang.
                    </td>
                  </tr>
                ) : (
                  allPaymentLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{log.payment_no}</td>
                      <td>{log.payment_date}</td>
                      <td style={{ fontWeight: 600 }}>{log.supplier_name}</td>
                      <td>
                        <div>{log.payable_no}</div>
                        {log.purchase_no && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>PO: {log.purchase_no}</div>}
                      </td>
                      <td>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', fontWeight: 600 }}>
                          {log.payment_method}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{log.reference_no || '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#34d399' }} className="mono">
                        {rupiah(log.amount)}
                      </td>
                      <td>{log.payer?.name || 'Kasir'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeletePayment(log.payable_id, log.id)}
                          className="btn btn-sm btn-danger"
                          style={{ padding: '3px 6px', fontSize: 11 }}
                          title="Hapus / Batalkan Pembayaran (Void)"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: LAPORAN HUTANG SUPPLIER (MATCHING USER SCREENSHOT) */}
      {activeTab === 'REPORT' && (
        <div className="space-y-4">
          {/* Report Toolbar */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={15} color="var(--text-muted)" />
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>Periode:</span>
                </div>
                <input
                  type="date"
                  className="form-control mono"
                  style={{ width: 140, fontSize: 12 }}
                  value={reportPeriod.from}
                  onChange={e => setReportPeriod(p => ({ ...p, from: e.target.value }))}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>s/d</span>
                <input
                  type="date"
                  className="form-control mono"
                  style={{ width: 140, fontSize: 12 }}
                  value={reportPeriod.to}
                  onChange={e => setReportPeriod(p => ({ ...p, to: e.target.value }))}
                />
                <button
                  onClick={fetchReportData}
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '6px 12px' }}
                >
                  Tampilkan
                </button>
              </div>

              {/* Export Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => exportSupplierPayablesToExcel({
                    rows: reportData.rows || [],
                    period: reportData.period || reportPeriod,
                    outletName: reportData.outlet || outletName,
                    businessName,
                    summary: reportData.summary || {},
                  })}
                  className="btn"
                  style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    border: '1px solid #10b981',
                    fontSize: 12.5,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <FileSpreadsheet size={15} />
                  <span>Export Excel</span>
                </button>

                <button
                  onClick={() => printSupplierPayablesReport({
                    rows: reportData.rows || [],
                    period: reportData.period || reportPeriod,
                    outletName: reportData.outlet || outletName,
                    summary: reportData.summary || {},
                  })}
                  className="btn btn-secondary"
                  style={{ fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Printer size={15} />
                  <span>Cetak / PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* Report Preview Document */}
          <div className="card" style={{ padding: 24, background: '#ffffff', color: '#111827', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#111827' }}>
                LAPORAN HUTANG SUPPLIER
              </h2>
              <div style={{ fontSize: 13, fontStyle: 'italic', marginTop: 4, color: '#4b5563' }}>
                {reportData.period?.from_formatted && reportData.period?.to_formatted
                  ? `Per ${reportData.period.from_formatted} s/d ${reportData.period.to_formatted}`
                  : `Per ${reportPeriod.from} s/d ${reportPeriod.to}`}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
              <div><strong>Cabang:</strong> {reportData.outlet || outletName}</div>
              <div><strong>Jumlah Transaksi:</strong> {reportData.summary?.count_rows || (reportData.rows || []).length} Data</div>
            </div>

            {reportLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                <LoadingState message="Memuat format laporan hutang supplier..." />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 11.5,
                  color: '#111827',
                  border: '1px solid #111827'
                }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ border: '1px solid #111827', padding: '6px 8px', textAlign: 'center', width: 35 }}>No.</th>
                      <th style={{ border: '1px solid #111827', padding: '6px 8px', textAlign: 'left' }}>Supplier/Tanggal</th>
                      <th style={{ border: '1px solid #111827', padding: '6px 8px', textAlign: 'center', width: 85 }}>Tgl. Dibuat</th>
                      <th style={{ border: '1px solid #111827', padding: '6px 8px', textAlign: 'left', width: 90 }}>Dibuat Oleh</th>
                      <th style={{ border: '1px solid #111827', padding: '6px 8px', textAlign: 'center', width: 110 }}>No.Pembelian</th>
                      <th style={{ border: '1px solid #111827', padding: '6px 8px', textAlign: 'center', width: 120 }}>No.Bayar</th>
                      <th style={{ border: '1px solid #111827', padding: '6px 8px', textAlign: 'center', width: 85 }}>Jatuh Tempo</th>
                      <th style={{ border: '1px solid #111827', padding: '6px 8px', textAlign: 'right', width: 95 }}>Hutang</th>
                      <th style={{ border: '1px solid #111827', padding: '6px 8px', textAlign: 'right', width: 95 }}>Dibayar</th>
                      <th style={{ border: '1px solid #111827', padding: '6px 8px', textAlign: 'right', width: 95 }}>Sisa Hutang</th>
                      <th style={{ border: '1px solid #111827', padding: '6px 8px', textAlign: 'right', width: 95 }}>Total Hutang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData.rows || []).length === 0 ? (
                      <tr>
                        <td colSpan="11" style={{ border: '1px solid #111827', padding: 20, textAlign: 'center', color: '#6b7280' }}>
                          Tidak ada data hutang pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      reportData.rows.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #111827', padding: '5px 8px', textAlign: 'center' }}>{row.no}</td>
                          <td style={{ border: '1px solid #111827', padding: '5px 8px' }}>{row.supplier_tanggal}</td>
                          <td style={{ border: '1px solid #111827', padding: '5px 8px', textAlign: 'center' }}>{row.tgl_dibuat_fmt || row.tgl_dibuat}</td>
                          <td style={{ border: '1px solid #111827', padding: '5px 8px' }}>{row.dibuat_oleh}</td>
                          <td style={{ border: '1px solid #111827', padding: '5px 8px', textAlign: 'center' }}>{row.no_pembelian}</td>
                          <td style={{ border: '1px solid #111827', padding: '5px 8px', textAlign: 'center' }}>{row.no_bayar}</td>
                          <td style={{ border: '1px solid #111827', padding: '5px 8px', textAlign: 'center' }}>{row.jatuh_tempo_fmt || row.jatuh_tempo}</td>
                          <td style={{ border: '1px solid #111827', padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {Number(row.hutang || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ border: '1px solid #111827', padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {Number(row.dibayar || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ border: '1px solid #111827', padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {Number(row.sisa_hutang || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ border: '1px solid #111827', padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {Number(row.total_hutang || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    {/* Exactly matching screenshot: Col H has Total Utang label, Col I, J, K have totals */}
                    <tr style={{ fontWeight: 800, background: '#f3f4f6' }}>
                      <td colSpan="8" style={{ border: '1px solid #111827', padding: '6px 8px', textAlign: 'right', paddingRight: 12 }}>
                        Total Utang
                      </td>
                      <td style={{ border: '1px solid #111827', padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {Number(reportData.summary?.total_dibayar || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ border: '1px solid #111827', padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {Number(reportData.summary?.total_sisa_hutang || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ border: '1px solid #111827', padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {Number(reportData.summary?.total_hutang || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: PEMBAYARAN NOTA TUNGGAL */}
      {payModal.open && payModal.item && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={18} color="#34d399" />
                Bayar Hutang: {payModal.item.supplier_name}
              </h3>
              <button onClick={() => setPayModal({ open: false, item: null })} className="btn btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSinglePaymentSubmit}>
              <div className="modal-body space-y-4">
                {/* Invoice Summary Box */}
                <div style={{
                  padding: 12, borderRadius: 8,
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  fontSize: 12
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>No. Hutang:</span>
                    <span className="mono" style={{ fontWeight: 700 }}>{payModal.item.payable_no}</span>
                  </div>
                  {payModal.item.purchase_no && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>No. Faktur:</span>
                      <span className="mono">{payModal.item.purchase_no}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Total Hutang Awal:</span>
                    <span className="mono">{rupiah(payModal.item.total_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Sudah Terbayar:</span>
                    <span className="mono" style={{ color: '#34d399' }}>{rupiah(payModal.item.paid_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Sisa Hutang:</span>
                    <span className="mono" style={{ fontWeight: 800, color: '#f87171', fontSize: 14 }}>
                      {rupiah(payModal.item.remaining_amount)}
                    </span>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Nominal Pembayaran (Rp) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setPayModal(f => ({ ...f, amount: payModal.item.remaining_amount }))}
                      style={{ fontSize: 11, color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Bayar Lunas (100%)
                    </button>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    max={payModal.item.remaining_amount}
                    className="form-control mono"
                    style={{ fontSize: 15, fontWeight: 800, color: '#34d399' }}
                    required
                    value={payModal.amount}
                    onChange={e => setPayModal(f => ({ ...f, amount: e.target.value }))}
                  />
                  {Number(payModal.amount) > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Sisa setelah pembayaran: <strong style={{ color: '#fca5a5' }}>{rupiah(Math.max(0, payModal.item.remaining_amount - Number(payModal.amount)))}</strong>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Tanggal Bayar *</label>
                    <input
                      type="date"
                      className="form-control mono"
                      required
                      value={payModal.payment_date}
                      onChange={e => setPayModal(f => ({ ...f, payment_date: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Metode Bayar *</label>
                    <select
                      className="form-control"
                      value={payModal.payment_method}
                      onChange={e => setPayModal(f => ({ ...f, payment_method: e.target.value }))}
                    >
                      <option value="CASH">Tunai (Kas Kasir)</option>
                      <option value="TRANSFER">Transfer Bank</option>
                      <option value="PETTY_CASH">Kas Kecil (Petty Cash)</option>
                      <option value="OTHER">Lainnya</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">No. Referensi / Bukti Transfer (Opsional)</label>
                  <input
                    type="text"
                    className="form-control mono"
                    placeholder="Contoh: TF-BCA-98124"
                    value={payModal.reference_no}
                    onChange={e => setPayModal(f => ({ ...f, reference_no: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Catatan Tambahan</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Titip lewat supir, pelunasan termin 1, dll."
                    value={payModal.notes}
                    onChange={e => setPayModal(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setPayModal({ open: false, item: null })} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingAction} style={{ fontWeight: 700 }}>
                  {savingAction ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BULK PAYMENT (BAYAR SEKALIGUS) */}
      {bulkPayModal.open && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={18} color="#34d399" />
                Bayar Sekaligus Hutang: {bulkPayModal.supplierName}
              </h3>
              <button onClick={() => setBulkPayModal(f => ({ ...f, open: false }))} className="btn btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBulkPaymentSubmit}>
              <div className="modal-body space-y-4">
                <div style={{
                  padding: 12, borderRadius: 8,
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  fontSize: 12, lineHeight: 1.5
                }}>
                  <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: 2 }}>
                    💡 Mekanisme Pelunasan Sekaligus (FIFO):
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    Uang yang Anda bayarkan akan otomatis dialokasikan untuk melunasi nota hutang tertua terlebih dahulu. Jika uang pembayaran lebih besar dari nota tertua, sisanya akan langsung memotong nota hutang berikutnya.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Nominal Pelunasan Sekaligus (Rp) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    className="form-control mono"
                    style={{ fontSize: 16, fontWeight: 800, color: '#34d399' }}
                    required
                    value={bulkPayModal.amount}
                    onChange={e => setBulkPayModal(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Tanggal Bayar *</label>
                    <input
                      type="date"
                      className="form-control mono"
                      required
                      value={bulkPayModal.payment_date}
                      onChange={e => setBulkPayModal(f => ({ ...f, payment_date: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Metode Bayar *</label>
                    <select
                      className="form-control"
                      value={bulkPayModal.payment_method}
                      onChange={e => setBulkPayModal(f => ({ ...f, payment_method: e.target.value }))}
                    >
                      <option value="CASH">Tunai (Kas Kasir)</option>
                      <option value="TRANSFER">Transfer Bank</option>
                      <option value="PETTY_CASH">Kas Kecil (Petty Cash)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">No. Referensi / Bukti Transfer</label>
                  <input
                    type="text"
                    className="form-control mono"
                    placeholder="Contoh: TRF-BCA-881290"
                    value={bulkPayModal.reference_no}
                    onChange={e => setBulkPayModal(f => ({ ...f, reference_no: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Catatan Tambahan</label>
                  <input
                    type="text"
                    className="form-control"
                    value={bulkPayModal.notes}
                    onChange={e => setBulkPayModal(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setBulkPayModal(f => ({ ...f, open: false }))} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingAction} style={{ fontWeight: 700 }}>
                  {savingAction ? 'Memproses...' : 'Proses Pelunasan Sekaligus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CATAT HUTANG BARU MANUAL */}
      {createModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <PlusCircle size={18} color="var(--accent-bright)" />
                Catat Hutang Supplier Manual
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="btn btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePayableSubmit}>
              <div className="modal-body space-y-3">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Nama Supplier *</label>
                    <input
                      type="text"
                      list="create-supplier-list"
                      className="form-control"
                      required
                      placeholder="Pilih atau ketik supplier..."
                      value={newPayableForm.supplier_name}
                      onChange={e => setNewPayableForm(f => ({ ...f, supplier_name: e.target.value }))}
                    />
                    <datalist id="create-supplier-list">
                      {masterSuppliers.map((s, idx) => (
                        <option key={idx} value={s.name} />
                      ))}
                    </datalist>
                  </div>

                  <div className="form-group">
                    <label className="form-label">No. Telepon Supplier</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="08..."
                      value={newPayableForm.supplier_phone}
                      onChange={e => setNewPayableForm(f => ({ ...f, supplier_phone: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">No. Faktur / Bon / PO</label>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="INV-..."
                      value={newPayableForm.purchase_no}
                      onChange={e => setNewPayableForm(f => ({ ...f, purchase_no: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Total Hutang (Rp) *</label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      className="form-control mono"
                      style={{ fontWeight: 700 }}
                      required
                      placeholder="0"
                      value={newPayableForm.total_amount}
                      onChange={e => setNewPayableForm(f => ({ ...f, total_amount: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Tanggal Transaksi *</label>
                    <input
                      type="date"
                      className="form-control mono"
                      required
                      value={newPayableForm.issue_date}
                      onChange={e => setNewPayableForm(f => ({ ...f, issue_date: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Jatuh Tempo *</label>
                    <input
                      type="date"
                      className="form-control mono"
                      required
                      value={newPayableForm.due_date}
                      onChange={e => setNewPayableForm(f => ({ ...f, due_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Uang Muka / DP (Opsional)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="form-control mono"
                      placeholder="Rp 0"
                      value={newPayableForm.initial_paid}
                      onChange={e => setNewPayableForm(f => ({ ...f, initial_paid: e.target.value }))}
                    />
                  </div>

                  {Number(newPayableForm.initial_paid) > 0 && (
                    <div className="form-group">
                      <label className="form-label">Metode Bayar DP</label>
                      <select
                        className="form-control"
                        value={newPayableForm.payment_method}
                        onChange={e => setNewPayableForm(f => ({ ...f, payment_method: e.target.value }))}
                      >
                        <option value="CASH">Tunai (Kas Kasir)</option>
                        <option value="TRANSFER">Transfer Bank</option>
                        <option value="PETTY_CASH">Kas Kecil</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Catatan Tambahan</label>
                  <textarea
                    rows="2"
                    className="form-control"
                    placeholder="Rincian barang atau perjanjian tempo..."
                    value={newPayableForm.notes}
                    onChange={e => setNewPayableForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingAction} style={{ fontWeight: 700 }}>
                  {savingAction ? 'Menyimpan...' : 'Simpan Nota Hutang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RIWAYAT PEMBAYARAN NOTA TERTENTU */}
      {historyModal.open && historyModal.item && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <History size={18} color="var(--accent-bright)" />
                Riwayat Pembayaran: {historyModal.item.payable_no}
              </h3>
              <button onClick={() => setHistoryModal({ open: false, item: null })} className="btn btn-icon">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body space-y-3">
              <div style={{
                padding: 10, borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                fontSize: 12
              }}>
                <div><strong>Supplier:</strong> {historyModal.item.supplier_name}</div>
                <div><strong>Total Tagihan:</strong> {rupiah(historyModal.item.total_amount)}</div>
                <div style={{ color: '#34d399' }}><strong>Sudah Dibayar:</strong> {rupiah(historyModal.item.paid_amount)}</div>
                <div style={{ color: historyModal.item.remaining_amount > 0 ? '#f87171' : '#34d399' }}>
                  <strong>Sisa Hutang:</strong> {rupiah(historyModal.item.remaining_amount)}
                </div>
              </div>

              {(!historyModal.item.payments || historyModal.item.payments.length === 0) ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
                  Belum ada pembayaran yang dicatat untuk nota ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {historyModal.item.payments.map((p, idx) => (
                    <div key={idx} style={{
                      padding: 10, borderRadius: 8,
                      background: 'rgba(16, 185, 129, 0.05)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: 12
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.payment_no}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          📅 {p.payment_date} | 💳 {p.payment_method} {p.reference_no && `(${p.reference_no})`}
                        </div>
                        {p.notes && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>📝 {p.notes}</div>}
                      </div>

                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="mono" style={{ fontWeight: 800, color: '#34d399', fontSize: 13 }}>
                          {rupiah(p.amount)}
                        </div>
                        <button
                          onClick={() => handleDeletePayment(historyModal.item.id, p.id)}
                          className="btn btn-sm btn-danger"
                          style={{ padding: '3px 6px', fontSize: 10 }}
                          title="Hapus Pembayaran"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setHistoryModal({ open: false, item: null })} className="btn btn-secondary">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
