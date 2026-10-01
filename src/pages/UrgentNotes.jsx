import { useState, useEffect, useMemo } from 'react';
import {
  AlertOctagon, Search, Filter, RefreshCw, CheckCircle2, Clock,
  ArrowUpRight, AlertTriangle, Check, X, ShieldAlert, Package,
  Store, UtensilsCrossed, Sparkles, ChevronRight, ChevronDown, Eye, Layers,
  Receipt, List, Send, XCircle, UserCheck, Bell, ShieldCheck
} from 'lucide-react';
import api from '../api/client';
import { num, LoadingState, PageHeader } from '../components/ui';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import { confirmDialog } from '../utils/swal';

function formatDateTime(str) {
  if (!str) return '-';
  try {
    return new Date(str).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return str;
  }
}

export default function UrgentNotes() {
  const {
    activeOutletId,
    activeOutlet,
    outlets,
    isOwnerBisnis,
    isOwnerOutlet,
    isPlatformAdmin,
    isSuperadminPlatform,
    dateRange: period,
    currentUser,
  } = useOutlet();

  const isManagerOrOwner = useMemo(() => {
    return (
      Boolean(isPlatformAdmin) ||
      Boolean(isSuperadminPlatform) ||
      Boolean(isOwnerBisnis) ||
      Boolean(isOwnerOutlet) ||
      currentUser?.role === 'manager_outlet' ||
      currentUser?.role === 'owner_outlet' ||
      currentUser?.role === 'owner_bisnis' ||
      currentUser?.role === 'admin'
    );
  }, [isPlatformAdmin, isSuperadminPlatform, isOwnerBisnis, isOwnerOutlet, currentUser]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notes, setNotes] = useState([]);
  const [summary, setSummary] = useState({
    pending_count: 0,
    approval_pending_count: 0,
    pending_transactions_count: 0,
    resolved_count: 0,
    total_count: 0,
    pending_ingredients: [],
  });

  // View Mode: 'grouped' (Group by Nota) | 'flat' (Rincian Semua Bahan)
  const [viewMode, setViewMode] = useState('grouped');
  const [expandedOrders, setExpandedOrders] = useState({});

  // Filters: 'ACTIVE' | 'APPROVAL_PENDING' | 'PENDING' | 'RESOLVED' | 'ALL'
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  // 1. Request Resolution Modal (Kasir/Staff or Direct)
  const [requestModal, setRequestModal] = useState({
    open: false,
    note: null,
    notes: 'Permohonan pelunasan kekurangan bahan diajukan oleh kasir/staf.',
    submitting: false,
  });

  // 2. Batch Request Resolution Modal (Kasir/Staff)
  const [batchRequestModal, setBatchRequestModal] = useState({
    open: false,
    order: null,
    notes: 'Permohonan pelunasan seluruh bahan pada nota ini diajukan.',
    submitting: false,
  });

  // 3. Approve Resolution Modal (Manager/Owner)
  const [approveModal, setApproveModal] = useState({
    open: false,
    note: null,
    resolutionNotes: 'Pelunasan sisa bahan disetujui & dipotong dari stok fisik.',
    submitting: false,
  });

  // 4. Batch Approve Resolution Modal (Manager/Owner)
  const [batchApproveModal, setBatchApproveModal] = useState({
    open: false,
    order: null,
    notes: 'Persetujuan pelunasan seluruh bahan nota dari stok gudang/outlet.',
    submitting: false,
  });

  // 5. Reject Resolution Modal (Manager/Owner)
  const [rejectModal, setRejectModal] = useState({
    open: false,
    note: null,
    reason: 'Stok fisik belum sesuai / permohonan ditolak oleh Manager/Owner',
    submitting: false,
  });

  // 6. Batch Reject Resolution Modal (Manager/Owner)
  const [batchRejectModal, setBatchRejectModal] = useState({
    open: false,
    order: null,
    reason: 'Permohonan pelunasan nota ditolak oleh Manager/Owner',
    submitting: false,
  });

  // 7. Cancel Modal (Hapus/Batal Hutang Bahan)
  const [cancelModal, setCancelModal] = useState({
    open: false,
    note: null,
    reason: 'Dibatalkan oleh kasir / penyesuaian manual',
    submitting: false,
  });

  // 8. Detail Modal
  const [detailModal, setDetailModal] = useState({
    open: false,
    note: null,
  });

  const effectiveOutletId = useMemo(() => {
    return (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all')
      ? String(activeOutletId)
      : '';
  }, [activeOutletId]);

  useEffect(() => {
    fetchData();
  }, [effectiveOutletId, statusFilter, period]);

  async function fetchData() {
    setLoading(true);
    try {
      const params = { per_page: 250 };
      if (effectiveOutletId) params.outlet_id = effectiveOutletId;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (period?.from) params.from = period.from;
      if (period?.to) params.to = period.to;

      const [notesRes, sumRes] = await Promise.all([
        api.get('/urgent-notes', { params }),
        api.get('/urgent-notes/summary', { params: {
          ...(effectiveOutletId ? { outlet_id: effectiveOutletId } : {}),
          ...(period?.from ? { from: period.from } : {}),
          ...(period?.to ? { to: period.to } : {})
        } }),
      ]);

      const items = notesRes.data.data ? notesRes.data.data : (Array.isArray(notesRes.data) ? notesRes.data : []);
      setNotes(items);
      setSummary(sumRes.data || {
        pending_count: 0,
        approval_pending_count: 0,
        pending_transactions_count: 0,
        resolved_count: 0,
        total_count: 0,
        pending_ingredients: [],
      });
    } catch (err) {
      toast.error('Gagal memuat data Nota Urgent');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Filtered Notes
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(n =>
      (n.order_number && n.order_number.toLowerCase().includes(q)) ||
      (n.item_name && n.item_name.toLowerCase().includes(q)) ||
      (n.menu?.name && n.menu.name.toLowerCase().includes(q)) ||
      (n.ingredient?.name && n.ingredient.name.toLowerCase().includes(q)) ||
      (n.notes && n.notes.toLowerCase().includes(q)) ||
      (n.requested_notes && n.requested_notes.toLowerCase().includes(q)) ||
      (n.reject_reason && n.reject_reason.toLowerCase().includes(q))
    );
  }, [notes, searchQuery]);

  // Grouped by Nota / Order Number
  const groupedOrders = useMemo(() => {
    const groups = {};
    for (const note of filteredNotes) {
      const key = note.order_number || `TRX-${note.transaction_id || note.id}`;
      if (!groups[key]) {
        groups[key] = {
          order_number: note.order_number || key,
          transaction_id: note.transaction_id,
          created_at: note.created_at,
          outlet_name: note.outlet_name || note.outlet?.name || 'Cabang Outlet',
          cashier_name: note.transaction?.user?.name || note.creator?.name || 'Kasir',
          items: [],
          pending_count: 0,
          approval_pending_count: 0,
          resolved_count: 0,
          cancelled_count: 0,
          can_resolve_all: true,
          ready_items_count: 0,
        };
      }
      groups[key].items.push(note);
      if (note.status === 'PENDING') {
        groups[key].pending_count++;
        const avail = Number(note.current_stock_available ?? 0);
        const reqPending = Number(note.pending_qty);
        if (avail >= reqPending) {
          groups[key].ready_items_count++;
        } else {
          groups[key].can_resolve_all = false;
        }
      } else if (note.status === 'APPROVAL_PENDING') {
        groups[key].approval_pending_count++;
        const avail = Number(note.current_stock_available ?? 0);
        const reqPending = Number(note.pending_qty);
        if (avail >= reqPending) {
          groups[key].ready_items_count++;
        } else {
          groups[key].can_resolve_all = false;
        }
      } else if (note.status === 'RESOLVED') {
        groups[key].resolved_count++;
      } else {
        groups[key].cancelled_count++;
      }
    }

    return Object.values(groups).sort((a, b) => {
      // Approval pending first, then pending orders, then latest created_at
      if (a.approval_pending_count > 0 && b.approval_pending_count === 0) return -1;
      if (b.approval_pending_count > 0 && a.approval_pending_count === 0) return 1;
      if (a.pending_count > 0 && b.pending_count === 0) return -1;
      if (b.pending_count > 0 && a.pending_count === 0) return 1;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [filteredNotes]);

  function toggleOrderExpand(orderNumber) {
    setExpandedOrders(prev => ({
      ...prev,
      [orderNumber]: !prev[orderNumber]
    }));
  }

  function expandAllOrders() {
    const next = {};
    for (const group of groupedOrders) {
      next[group.order_number] = true;
    }
    setExpandedOrders(next);
  }

  function collapseAllOrders() {
    setExpandedOrders({});
  }

  // 1. Handle Request Resolution (Staff/Kasir)
  async function handleConfirmRequest() {
    if (!requestModal.note) return;
    setRequestModal(p => ({ ...p, submitting: true }));
    try {
      const res = await api.post(`/urgent-notes/${requestModal.note.id}/request-resolution`, {
        notes: requestModal.notes,
      });
      toast.success(res.data.message || 'Permohonan pelunasan berhasil diajukan ke Manager/Owner!');
      setRequestModal({ open: false, note: null, notes: '', submitting: false });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengajukan permohonan pelunasan');
      setRequestModal(p => ({ ...p, submitting: false }));
    }
  }

  // 2. Handle Batch Request for Order (Staff/Kasir)
  async function handleConfirmBatchRequestOrder() {
    if (!batchRequestModal.order) return;
    setBatchRequestModal(p => ({ ...p, submitting: true }));
    try {
      const pendingIds = batchRequestModal.order.items
        .filter(i => i.status === 'PENDING')
        .map(i => i.id);

      const res = await api.post('/urgent-notes/batch-request-resolution', {
        order_number: batchRequestModal.order.order_number,
        note_ids: pendingIds,
        notes: batchRequestModal.notes || `Permohonan pelunasan bahan Nota #${batchRequestModal.order.order_number}`,
      });

      toast.success(res.data.message || `Permohonan pelunasan bahan Nota #${batchRequestModal.order.order_number} berhasil dikirim ke Manager/Owner!`);
      setBatchRequestModal({ open: false, order: null, submitting: false, notes: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengajukan permohonan pelunasan');
      setBatchRequestModal(p => ({ ...p, submitting: false }));
    }
  }

  // 3. Handle Approve Resolution (Manager/Owner)
  async function handleConfirmApprove() {
    if (!approveModal.note) return;
    setApproveModal(p => ({ ...p, submitting: true }));
    try {
      const res = await api.post(`/urgent-notes/${approveModal.note.id}/approve-resolution`, {
        notes: approveModal.resolutionNotes,
      });
      toast.success(res.data.message || 'Pelunasan disetujui & stok berhasil dipotong!');
      setApproveModal({ open: false, note: null, resolutionNotes: '', submitting: false });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyetujui pelunasan nota urgent');
      setApproveModal(p => ({ ...p, submitting: false }));
    }
  }

  // 4. Handle Batch Approve Order (Manager/Owner)
  async function handleConfirmBatchApproveOrder() {
    if (!batchApproveModal.order) return;
    setBatchApproveModal(p => ({ ...p, submitting: true }));
    try {
      const activeIds = batchApproveModal.order.items
        .filter(i => ['PENDING', 'APPROVAL_PENDING'].includes(i.status))
        .map(i => i.id);

      const res = await api.post('/urgent-notes/batch-approve-resolution', {
        order_number: batchApproveModal.order.order_number,
        note_ids: activeIds,
        notes: batchApproveModal.notes || `Pelunasan kolektif nota #${batchApproveModal.order.order_number}`,
      });

      toast.success(res.data.message || `Seluruh bahan pada Nota #${batchApproveModal.order.order_number} berhasil disetujui & dilunasi!`);
      setBatchApproveModal({ open: false, order: null, submitting: false, notes: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyetujui pelunasan nota urgent');
      setBatchApproveModal(p => ({ ...p, submitting: false }));
    }
  }

  // 5. Handle Reject Resolution (Manager/Owner)
  async function handleConfirmReject() {
    if (!rejectModal.note) return;
    setRejectModal(p => ({ ...p, submitting: true }));
    try {
      const res = await api.post(`/urgent-notes/${rejectModal.note.id}/reject-resolution`, {
        reason: rejectModal.reason,
      });
      toast.success(res.data.message || 'Permohonan pelunasan berhasil ditolak.');
      setRejectModal({ open: false, note: null, reason: '', submitting: false });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menolak permohonan pelunasan');
      setRejectModal(p => ({ ...p, submitting: false }));
    }
  }

  // 6. Handle Batch Reject Order (Manager/Owner)
  async function handleConfirmBatchRejectOrder() {
    if (!batchRejectModal.order) return;
    setBatchRejectModal(p => ({ ...p, submitting: true }));
    try {
      const approvalPendingIds = batchRejectModal.order.items
        .filter(i => i.status === 'APPROVAL_PENDING')
        .map(i => i.id);

      const res = await api.post('/urgent-notes/batch-reject-resolution', {
        order_number: batchRejectModal.order.order_number,
        note_ids: approvalPendingIds,
        reason: batchRejectModal.reason || 'Ditolak oleh Manager/Owner',
      });

      toast.success(res.data.message || `Permohonan pelunasan pada Nota #${batchRejectModal.order.order_number} berhasil ditolak.`);
      setBatchRejectModal({ open: false, order: null, submitting: false, reason: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menolak permohonan');
      setBatchRejectModal(p => ({ ...p, submitting: false }));
    }
  }

  // 7. Handle Cancel Note
  async function handleConfirmCancel() {
    if (!cancelModal.note) return;
    setCancelModal(p => ({ ...p, submitting: true }));
    try {
      const res = await api.post(`/urgent-notes/${cancelModal.note.id}/cancel`, {
        reason: cancelModal.reason,
      });
      toast.success(res.data.message || 'Nota urgent berhasil dibatalkan');
      setCancelModal({ open: false, note: null, reason: '', submitting: false });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membatalkan nota urgent');
      setCancelModal(p => ({ ...p, submitting: false }));
    }
  }

  // 8. Batch Resolve / Request for a specific ingredient
  async function handleBatchIngredientAction(ingredientId, ingName) {
    if (isManagerOrOwner) {
      const confirmed = await confirmDialog({
        title: 'Setujui & Lunasi Kekurangan Bahan?',
        text: `Setujui dan lunasi semua kekurangan bahan "${ingName}" yang berstatus tergantung/menunggu approval? Stok fisik akan langsung dipotong.`,
        confirmText: 'Ya, Setujui & Lunasi Semua',
        cancelText: 'Batal',
        icon: 'question',
      });
      if (!confirmed) return;
      try {
        const res = await api.post('/urgent-notes/batch-approve-resolution', {
          ingredient_id: ingredientId,
          outlet_id: effectiveOutletId || undefined,
        });
        toast.success(res.data.message || 'Berhasil melunasi bahan!');
        fetchData();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Gagal melakukan pelunasan massal');
      }
    } else {
      const confirmed = await confirmDialog({
        title: 'Ajukan Pelunasan Bahan?',
        text: `Ajukan permohonan pelunasan semua kekurangan bahan "${ingName}" ke akun Manager/Owner?`,
        confirmText: 'Ya, Ajukan ke Manager',
        cancelText: 'Batal',
        icon: 'question',
      });
      if (!confirmed) return;
      try {
        const res = await api.post('/urgent-notes/batch-request-resolution', {
          notes: `Permohonan pelunasan kolektif bahan ${ingName} diajukan oleh kasir/staf`,
          outlet_id: effectiveOutletId || undefined,
        });
        toast.success(res.data.message || 'Berhasil mengajukan permohonan pelunasan bahan!');
        fetchData();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Gagal mengajukan pelunasan massal');
      }
    }
  }

  // Quick Action: Manager approves all pending approval requests
  async function handleApproveAllPending() {
    const confirmed = await confirmDialog({
      title: 'Setujui Semua Permohonan?',
      text: `Apakah Anda yakin ingin menyetujui dan melunasi semua (${summary.approval_pending_count}) permohonan pelunasan nota urgent yang diajukan staf kasir?`,
      confirmText: 'Ya, Setujui Semua',
      cancelText: 'Batal',
      icon: 'question',
    });
    if (!confirmed) return;
    try {
      const res = await api.post('/urgent-notes/batch-approve-resolution', {
        outlet_id: effectiveOutletId || undefined,
        notes: 'Persetujuan massal permohonan nota urgent oleh Manager/Owner',
      });
      toast.success(res.data.message || 'Semua permohonan pelunasan berhasil disetujui!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyetujui semua permohonan');
    }
  }

  const activeDeficitTotal = (summary.pending_count || 0) + (summary.approval_pending_count || 0);

  return (
    <div className="page-container">
      {/* Header */}
      <PageHeader
        title="Nota Urgent / Manual (Bahan Tergantung)"
        subtitle="Alur persetujuan pelunasan transaksi darurat dengan kekurangan stok bahan. Kasir mengajukan pelunasan, Manager/Owner memverifikasi & menyetujui sebelum stok dipotong."
        icon={AlertOctagon}
        badge={
          summary.approval_pending_count > 0
            ? `${summary.approval_pending_count} Menunggu Approval Manager`
            : summary.pending_count > 0
            ? `${summary.pending_count} Bahan Tergantung`
            : 'Semua Stok Lunas'
        }
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={() => { setRefreshing(true); fetchData(); }}
              disabled={loading || refreshing}
              title="Segarkan Data"
            >
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
              Segarkan
            </button>
          </div>
        }
      />

      {/* MANAGER / OWNER APPROVAL ALERT BANNER */}
      {isManagerOrOwner && summary.approval_pending_count > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.16) 0%, rgba(245, 158, 11, 0.1) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.45)',
          borderRadius: 14,
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
          boxShadow: '0 4px 20px rgba(245, 158, 11, 0.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(245, 158, 11, 0.25)',
              border: '1px solid rgba(245, 158, 11, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fbbf24',
              flexShrink: 0,
            }}>
              <Bell size={22} className="spin-slow" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
                  Perhatian Manager / Owner
                </h4>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                  background: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.5)'
                }}>
                  {summary.approval_pending_count} Permohonan Menunggu
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Terdapat <strong>{summary.approval_pending_count} item bahan tergantung</strong> yang diajukan oleh staf/kasir dan memerlukan persetujuan Anda agar stok dapat dipotong & status nota dinyatakan lunas.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setStatusFilter('APPROVAL_PENDING')}
              style={{ fontSize: 12, fontWeight: 700 }}
            >
              Lihat Permohonan
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={handleApproveAllPending}
              style={{ fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <CheckCircle2 size={14} /> Setujui Semua Permohonan
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
        marginBottom: 20,
      }}>
        {/* Card 1: Menunggu Persetujuan Manager / Owner */}
        <div style={{
          background: summary.approval_pending_count > 0 ? 'rgba(234, 88, 12, 0.12)' : 'rgba(255, 255, 255, 0.02)',
          border: summary.approval_pending_count > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border)',
          borderRadius: 14,
          padding: '16px 18px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Menunggu Approval
              </span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>
                {summary.approval_pending_count || 0} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>item</span>
              </div>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#f59e0b'
            }}>
              <ShieldCheck size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            Diajukan kasir, butuh approval Manager/Owner
          </div>
        </div>

        {/* Card 2: Bahan Tergantung (Belum Diajukan) */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 14,
          padding: '16px 18px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Bahan Tergantung
              </span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>
                {summary.pending_count || 0} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>item</span>
              </div>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#f59e0b'
            }}>
              <Clock size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            Dari <strong>{summary.pending_transactions_count || 0}</strong> nota pesanan kasir
          </div>
        </div>

        {/* Card 3: Nota Selesai Dilunasi */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 14,
          padding: '16px 18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Selesai / Dilunasi
              </span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                {summary.resolved_count || 0} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>item</span>
              </div>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#10b981'
            }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            Disetujui & stok telah dipotong sempurna
          </div>
        </div>

        {/* Card 4: Total Riwayat Nota Urgent */}
        <div style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: 14,
          padding: '16px 18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Riwayat
              </span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#a5b4fc', marginTop: 4 }}>
                {summary.total_count || 0} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>catatan</span>
              </div>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#818cf8'
            }}>
              <Layers size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            Semua order darurat tercatat transparan
          </div>
        </div>
      </div>

      {/* Deficit High-Priority Ingredients Alert */}
      {summary.pending_ingredients && summary.pending_ingredients.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(239, 68, 68, 0.08))',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 14,
          padding: '16px 20px',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldAlert size={20} style={{ color: '#f59e0b' }} />
              <div>
                <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: '#ffffff' }}>
                  Daftar Bahan Baku yang Masih Menggantung
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                  Bahan berikut perlu segera dibeli/direstok agar sisa pemotongan nota urgent dapat diselesaikan.
                </p>
              </div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 10,
          }}>
            {summary.pending_ingredients.map((ing, idx) => (
              <div key={idx} style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 10,
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#ffffff' }}>
                    {ing.ingredient_name}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Total Kurang: <strong style={{ color: '#fbbf24' }}>{num(ing.total_pending_qty)} {ing.unit}</strong> ({ing.note_count} nota)
                  </div>
                  <div style={{ fontSize: 11, color: ing.can_resolve_all ? '#34d399' : '#f87171', marginTop: 2 }}>
                    Stok Saat Ini: <strong>{num(ing.current_stock)} {ing.unit}</strong> ({ing.can_resolve_all ? 'Cukup' : 'Belum Cukup'})
                  </div>
                </div>

                {ing.can_resolve_all ? (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleBatchIngredientAction(ing.ingredient_id, ing.ingredient_name)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px' }}
                  >
                    {isManagerOrOwner ? '⚡ Setujui & Lunasi' : '⚡ Ajukan Pelunasan'}
                  </button>
                ) : (
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                    background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}>
                    Butuh Restok
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
      }}>
        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.25)', padding: 4, borderRadius: 10, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'ACTIVE' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatusFilter('ACTIVE')}
            style={{ fontWeight: 700, fontSize: 12 }}
          >
            ⚡ Semua Defisit ({activeDeficitTotal})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'APPROVAL_PENDING' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatusFilter('APPROVAL_PENDING')}
            style={{
              fontWeight: 700,
              fontSize: 12,
              color: statusFilter === 'APPROVAL_PENDING' ? '#ffffff' : (summary.approval_pending_count > 0 ? '#fbbf24' : 'inherit')
            }}
          >
            ⏳ Menunggu Approval ({summary.approval_pending_count || 0})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'PENDING' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatusFilter('PENDING')}
            style={{ fontWeight: 700, fontSize: 12 }}
          >
            📋 Belum Diajukan ({summary.pending_count || 0})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'RESOLVED' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatusFilter('RESOLVED')}
            style={{ fontWeight: 700, fontSize: 12 }}
          >
            ✓ Selesai ({summary.resolved_count || 0})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatusFilter('ALL')}
            style={{ fontWeight: 700, fontSize: 12 }}
          >
            Semua ({summary.total_count || 0})
          </button>
        </div>

        {/* Search Filter */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 250 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Cari No. Order / Bahan..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 32, paddingRight: searchQuery ? 28 : 10, fontSize: 12.5, height: 36 }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* View Mode Switcher & Expand/Collapse Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 10,
      }}>
        {/* Switcher Tab: Grup per Nota vs Daftar Bahan */}
        <div style={{
          display: 'flex',
          gap: 4,
          background: 'rgba(0,0,0,0.3)',
          padding: 4,
          borderRadius: 8,
          border: '1px solid var(--border)'
        }}>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'grouped' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewMode('grouped')}
            style={{ fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Receipt size={14} /> Grup per Nota ({groupedOrders.length} Nota)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'flat' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewMode('flat')}
            style={{ fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <List size={14} /> Rincian Bahan ({filteredNotes.length} Item)
          </button>
        </div>

        {/* Accordion Expand/Collapse All Buttons (only in grouped mode) */}
        {viewMode === 'grouped' && groupedOrders.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={expandAllOrders}
              style={{ fontSize: 11.5, color: '#60a5fa', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ChevronDown size={14} /> Buka Semua Rincian
            </button>
            <span style={{ color: 'var(--border)' }}>|</span>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={collapseAllOrders}
              style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ChevronRight size={14} /> Tutup Semua
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState text="Memuat daftar Nota Urgent / Manual..." />
      ) : filteredNotes.length === 0 ? (
        <div style={{
          background: 'var(--surface)',
          border: '1px dashed var(--border)',
          borderRadius: 14,
          padding: '48px 24px',
          textAlign: 'center',
        }}>
          <AlertOctagon size={42} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', opacity: 0.5 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: '0 0 6px' }}>
            Tidak Ada Catatan Nota Urgent
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, maxWidth: 420, marginInline: 'auto' }}>
            {statusFilter === 'APPROVAL_PENDING'
              ? 'Tidak ada permohonan pelunasan yang sedang menunggu persetujuan.'
              : statusFilter === 'PENDING' || statusFilter === 'ACTIVE'
              ? 'Hebat! Semua pesanan terpenuhi dengan stok yang cukup dan tidak ada bahan yang tergantung.'
              : 'Tidak ditemukan riwayat nota urgent yang cocok dengan filter yang dipilih.'}
          </p>
        </div>
      ) : viewMode === 'grouped' ? (
        /* ========================================================
            VIEW MODE 1: GROUPED BY NOTA (ACCORDION CARDS)
           ======================================================== */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groupedOrders.map((group) => {
            const isExpanded = Boolean(expandedOrders[group.order_number]);
            const hasApprovalPending = group.approval_pending_count > 0;
            const hasPending = group.pending_count > 0;
            const isPendingDeficit = hasApprovalPending || hasPending;
            const isResolved = !isPendingDeficit && group.resolved_count > 0;

            return (
              <div
                key={group.order_number}
                style={{
                  background: 'var(--surface)',
                  border: hasApprovalPending
                    ? '1px solid rgba(234, 88, 12, 0.6)'
                    : hasPending
                    ? '1px solid rgba(245, 158, 11, 0.45)'
                    : '1px solid var(--border)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: hasApprovalPending
                    ? '0 4px 20px rgba(234, 88, 12, 0.12)'
                    : hasPending
                    ? '0 4px 18px rgba(245, 158, 11, 0.08)'
                    : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Accordion Header */}
                <div
                  onClick={() => toggleOrderExpand(group.order_number)}
                  style={{
                    padding: '14px 18px',
                    background: hasApprovalPending
                      ? 'linear-gradient(90deg, rgba(234, 88, 12, 0.12) 0%, rgba(17, 22, 45, 0.8) 100%)'
                      : hasPending
                      ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.09) 0%, rgba(17, 22, 45, 0.8) 100%)'
                      : 'rgba(255, 255, 255, 0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    flexWrap: 'wrap',
                    gap: 12,
                    borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {/* Left: Chevron + Order Number + Status Badges + Meta */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: hasApprovalPending ? 'rgba(234, 88, 12, 0.25)' : hasPending ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: hasApprovalPending ? '#fb923c' : hasPending ? '#fbbf24' : '#60a5fa',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}>
                      <ChevronDown size={16} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="mono" style={{ fontSize: 14.5, fontWeight: 800, color: '#60a5fa' }}>
                          #{group.order_number}
                        </span>

                        {hasApprovalPending && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                            background: 'rgba(234, 88, 12, 0.25)', color: '#fb923c', border: '1px solid rgba(234, 88, 12, 0.5)'
                          }}>
                            <ShieldCheck size={11} /> {group.approval_pending_count} MENUNGGU APPROVAL
                          </span>
                        )}

                        {hasPending && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                            background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)'
                          }}>
                            <Clock size={11} /> {group.pending_count} BAHAN TERGANTUNG
                          </span>
                        )}

                        {isResolved && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                            background: 'rgba(16, 185, 129, 0.18)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.35)'
                          }}>
                            <CheckCircle2 size={11} /> SEMUA LUNAS ({group.resolved_count} BAHAN)
                          </span>
                        )}

                        {/* Stock Readiness Pill */}
                        {isPendingDeficit && (
                          group.can_resolve_all ? (
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                              background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}>
                              ✓ Stok Fisik Cukup
                            </span>
                          ) : (
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                              background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)'
                            }}>
                              {group.ready_items_count}/{group.items.filter(i => ['PENDING', 'APPROVAL_PENDING'].includes(i.status)).length} Bahan Siap
                            </span>
                          )
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, flexWrap: 'wrap' }}>
                        <span>{formatDateTime(group.created_at)}</span>
                        <span>Kasir: <strong style={{ color: '#ffffff' }}>{group.cashier_name}</strong></span>
                        <span>🏬 Cabang: <strong style={{ color: '#ffffff' }}>{group.outlet_name}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions: Header batch buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {/* MANAGER / OWNER ACTIONS FOR THIS ORDER */}
                    {isManagerOrOwner ? (
                      <>
                        {hasApprovalPending && (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBatchApproveModal({
                                  open: true,
                                  order: group,
                                  submitting: false,
                                  notes: `Persetujuan pelunasan seluruh bahan Nota #${group.order_number}`,
                                });
                              }}
                              style={{ fontSize: 11.5, fontWeight: 700, padding: '5px 12px' }}
                              title="Setujui dan potong stok semua bahan yang diajukan di nota ini"
                            >
                              ✓ Setujui Semua di Nota Ini
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBatchRejectModal({
                                  open: true,
                                  order: group,
                                  submitting: false,
                                  reason: `Permohonan Nota #${group.order_number} ditolak oleh Manager/Owner`,
                                });
                              }}
                              style={{ fontSize: 11.5, color: 'var(--danger)', padding: '5px 10px' }}
                              title="Tolak permohonan pelunasan nota ini"
                            >
                              ✕ Tolak
                            </button>
                          </>
                        )}

                        {!hasApprovalPending && hasPending && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBatchApproveModal({
                                open: true,
                                order: group,
                                submitting: false,
                                notes: `Pelunasan langsung nota #${group.order_number} oleh Manager/Owner`,
                              });
                            }}
                            style={{ fontSize: 11.5, fontWeight: 700, padding: '5px 12px' }}
                            title="Lunasi semua bahan yang tergantung di nota ini sekaligus"
                          >
                            ⚡ Lunasi Semua di Nota Ini
                          </button>
                        )}
                      </>
                    ) : (
                      /* STAFF / KASIR ACTIONS FOR THIS ORDER */
                      hasPending && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBatchRequestModal({
                              open: true,
                              order: group,
                              submitting: false,
                              notes: `Permohonan pelunasan sisa bahan Nota #${group.order_number}`,
                            });
                          }}
                          style={{ fontSize: 11.5, fontWeight: 700, padding: '5px 12px' }}
                          title="Ajukan pelunasan semua bahan di nota ini ke Manager/Owner"
                        >
                          <Send size={12} style={{ marginRight: 4 }} /> Ajukan Pelunasan Nota Ini
                        </button>
                      )
                    )}

                    <div style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: isExpanded ? '#60a5fa' : 'var(--text-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <span>{isExpanded ? 'Tutup Detail' : `Lihat Detail (${group.items.length} bahan)`}</span>
                      <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    </div>
                  </div>
                </div>

                {/* Accordion Body: Detailed Ingredients List */}
                {isExpanded && (
                  <div style={{ padding: '0', background: 'rgba(0,0,0,0.22)' }}>
                    <div className="table-responsive" style={{ margin: 0 }}>
                      <table className="table" style={{ margin: 0, width: '100%', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Item & Bahan Baku Tergantung</th>
                            <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Kebutuhan</th>
                            <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Terpotong Riil</th>
                            <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Kekurangan Tergantung</th>
                            <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>Stok Fisik Saat Ini</th>
                            <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>Status</th>
                            <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map(n => {
                            const isPending = n.status === 'PENDING';
                            const isApprovalPending = n.status === 'APPROVAL_PENDING';
                            const isResolved = n.status === 'RESOLVED';
                            const availableStock = Number(n.current_stock_available ?? 0);
                            const isStockReady = availableStock >= Number(n.pending_qty);

                            return (
                              <tr key={n.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                {/* Item & Ingredient Name */}
                                <td style={{ padding: '11px 16px' }}>
                                  <div style={{ fontWeight: 700, color: '#ffffff', fontSize: 13 }}>
                                    {n.item_name}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                    {n.item_type === 'DIRECT' ? 'Produk Retail' : (n.ingredient_name ? `Bahan Baku: ${n.ingredient_name}` : 'Resep')}
                                  </div>
                                  {n.notes && (
                                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                                      Catatan: {n.notes}
                                    </div>
                                  )}
                                  {isApprovalPending && n.requested_notes && (
                                    <div style={{ fontSize: 10.5, color: '#fbbf24', marginTop: 2 }}>
                                      💬 Pengajuan: {n.requested_notes} {n.approval_requested_by_name ? `(${n.approval_requested_by_name})` : ''}
                                    </div>
                                  )}
                                  {n.reject_reason && isPending && (
                                    <div style={{ fontSize: 10.5, color: '#f87171', marginTop: 2 }}>
                                      ❌ Ditolak: {n.reject_reason}
                                    </div>
                                  )}
                                </td>

                                {/* Required Qty */}
                                <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                                  <span className="mono" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {num(n.required_qty)} {n.unit}
                                  </span>
                                </td>

                                {/* Deducted Qty */}
                                <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                                  <span className="mono" style={{ fontWeight: 700, color: 'var(--ok)' }}>
                                    ✓ {num(n.deducted_qty)} {n.unit}
                                  </span>
                                </td>

                                {/* Pending Qty */}
                                <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                                  <span className="mono" style={{
                                    fontWeight: 800,
                                    color: (isPending || isApprovalPending) ? '#fbbf24' : 'var(--text-muted)',
                                    background: (isPending || isApprovalPending) ? 'rgba(245, 158, 11, 0.18)' : 'transparent',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    border: (isPending || isApprovalPending) ? '1px solid rgba(245, 158, 11, 0.35)' : 'none',
                                  }}>
                                    ⚡ {num(n.pending_qty)} {n.unit}
                                  </span>
                                </td>

                                {/* Current Stock in Outlet */}
                                <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                                  <div className="mono" style={{ fontWeight: 700, color: isStockReady ? 'var(--ok)' : 'var(--danger)' }}>
                                    {num(availableStock)} {n.unit}
                                  </div>
                                  {(isPending || isApprovalPending) && (
                                    <div style={{ fontSize: 10, color: isStockReady ? '#34d399' : '#f87171', fontWeight: 600 }}>
                                      {isStockReady ? '✓ Cukup' : '❌ Belum Cukup'}
                                    </div>
                                  )}
                                </td>

                                {/* Status */}
                                <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                                  {isApprovalPending ? (
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 800,
                                      background: 'rgba(234, 88, 12, 0.2)', color: '#fb923c', border: '1px solid rgba(234, 88, 12, 0.4)'
                                    }}>
                                      <ShieldCheck size={11} /> BUTUH APPROVAL
                                    </span>
                                  ) : isPending ? (
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 800,
                                      background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)'
                                    }}>
                                      <Clock size={11} /> TERGANTUNG
                                    </span>
                                  ) : isResolved ? (
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 800,
                                      background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)'
                                    }}>
                                      <CheckCircle2 size={11} /> LUNAS
                                    </span>
                                  ) : (
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
                                      background: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', border: '1px solid rgba(100, 116, 139, 0.3)'
                                    }}>
                                      BATAL
                                    </span>
                                  )}
                                </td>

                                {/* Actions per item */}
                                <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                                    {/* MANAGER / OWNER ACTIONS */}
                                    {isManagerOrOwner ? (
                                      isApprovalPending ? (
                                        <>
                                          <button
                                            className="btn btn-sm btn-primary"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setApproveModal({
                                                open: true,
                                                note: n,
                                                resolutionNotes: `Disetujui: Pelunasan kekurangan bahan ${n.item_name} dari stok fisik`,
                                                submitting: false,
                                              });
                                            }}
                                            style={{ fontWeight: 700, fontSize: 11, padding: '3px 8px' }}
                                            title="Setujui dan potong stok sekarang"
                                          >
                                            ✓ Setujui
                                          </button>
                                          <button
                                            className="btn btn-sm btn-ghost"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setRejectModal({
                                                open: true,
                                                note: n,
                                                reason: 'Stok fisik belum siap / permohonan ditolak',
                                                submitting: false,
                                              });
                                            }}
                                            style={{ fontSize: 11, padding: '3px 6px', color: 'var(--danger)' }}
                                            title="Tolak permohonan pelunasan"
                                          >
                                            ✕
                                          </button>
                                        </>
                                      ) : isPending ? (
                                        <>
                                          <button
                                            className="btn btn-sm btn-primary"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setApproveModal({
                                                open: true,
                                                note: n,
                                                resolutionNotes: `Pelunasan langsung bahan ${n.item_name} dari stok fisik`,
                                                submitting: false,
                                              });
                                            }}
                                            style={{ fontWeight: 700, fontSize: 11, padding: '3px 8px' }}
                                            title="Lunasi Langsung & Potong Stok"
                                          >
                                            ⚡ Lunasi
                                          </button>
                                          <button
                                            className="btn btn-sm btn-ghost"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setCancelModal({
                                                open: true,
                                                note: n,
                                                reason: 'Dibatalkan oleh kasir / penyesuaian manual',
                                                submitting: false,
                                              });
                                            }}
                                            style={{ fontSize: 11, padding: '3px 6px', color: 'var(--danger)' }}
                                            title="Batalkan Hutang Bahan Ini"
                                          >
                                            Batal
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          className="btn btn-sm btn-ghost"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDetailModal({ open: true, note: n });
                                          }}
                                          style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '3px 8px' }}
                                        >
                                          <Eye size={12} style={{ marginRight: 4 }} /> Rincian
                                        </button>
                                      )
                                    ) : (
                                      /* STAFF / KASIR ACTIONS */
                                      isPending ? (
                                        <>
                                          <button
                                            className="btn btn-sm btn-primary"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setRequestModal({
                                                open: true,
                                                note: n,
                                                notes: `Permohonan pelunasan bahan ${n.item_name} dari stok fisik/pasar`,
                                                submitting: false,
                                              });
                                            }}
                                            style={{ fontWeight: 700, fontSize: 11, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                            title="Ajukan Pelunasan ke Manager / Owner"
                                          >
                                            <Send size={11} /> Ajukan
                                          </button>
                                          <button
                                            className="btn btn-sm btn-ghost"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setCancelModal({
                                                open: true,
                                                note: n,
                                                reason: 'Dibatalkan oleh kasir / penyesuaian manual',
                                                submitting: false,
                                              });
                                            }}
                                            style={{ fontSize: 11, padding: '3px 6px', color: 'var(--danger)' }}
                                            title="Batalkan Hutang Bahan Ini"
                                          >
                                            Batal
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          className="btn btn-sm btn-ghost"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDetailModal({ open: true, note: n });
                                          }}
                                          style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '3px 8px' }}
                                        >
                                          <Eye size={12} style={{ marginRight: 4 }} /> Rincian
                                        </button>
                                      )
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ========================================================
            VIEW MODE 2: FLAT TABLE (DAFTAR SEMUA BAHAN)
           ======================================================== */
        <div className="table-responsive" style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          <table className="table" style={{ margin: 0, width: '100%', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>No. Order / Waktu</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Cabang</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Item & Bahan Baku</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Kebutuhan</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Stok Terpotong</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Kekurangan Tergantung</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>Stok Saat Ini</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotes.map(n => {
                const isPending = n.status === 'PENDING';
                const isApprovalPending = n.status === 'APPROVAL_PENDING';
                const isResolved = n.status === 'RESOLVED';
                const availableStock = Number(n.current_stock_available ?? 0);
                const isStockReady = availableStock >= Number(n.pending_qty);

                return (
                  <tr key={n.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                    {/* Order Number & Date */}
                    <td style={{ padding: '12px 16px' }}>
                      <div className="mono" style={{ fontWeight: 800, color: '#60a5fa' }}>
                        {n.order_number}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {formatDateTime(n.created_at)}
                      </div>
                      {n.transaction?.user?.name && (
                        <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                          Kasir: {n.transaction.user.name}
                        </div>
                      )}
                    </td>

                    {/* Outlet */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#ffffff' }}>
                        {n.outlet_name || 'Outlet'}
                      </div>
                    </td>

                    {/* Item & Ingredient */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#ffffff' }}>
                        {n.item_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {n.item_type === 'DIRECT' ? 'Produk Retail' : (n.ingredient_name ? `Bahan: ${n.ingredient_name}` : 'Resep')}
                      </div>
                      {isApprovalPending && n.requested_notes && (
                        <div style={{ fontSize: 10.5, color: '#fbbf24', marginTop: 2 }}>
                          💬 Pengajuan: {n.requested_notes}
                        </div>
                      )}
                    </td>

                    {/* Required Qty */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {num(n.required_qty)} {n.unit}
                      </span>
                    </td>

                    {/* Deducted Qty */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span className="mono" style={{ fontWeight: 700, color: 'var(--ok)' }}>
                        ✓ {num(n.deducted_qty)} {n.unit}
                      </span>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        Terpotong riil
                      </div>
                    </td>

                    {/* Pending Deficit Qty */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span className="mono" style={{
                        fontWeight: 800,
                        color: (isPending || isApprovalPending) ? '#fbbf24' : 'var(--text-muted)',
                        background: (isPending || isApprovalPending) ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                        padding: '2px 8px',
                        borderRadius: 6,
                        border: (isPending || isApprovalPending) ? '1px solid rgba(245, 158, 11, 0.3)' : 'none',
                      }}>
                        ⚡ {num(n.pending_qty)} {n.unit}
                      </span>
                      <div style={{ fontSize: 10, color: (isPending || isApprovalPending) ? '#fbbf24' : 'var(--text-muted)' }}>
                        {isPending ? 'Hutang bahan' : isApprovalPending ? 'Menunggu approval' : 'Telah dilunasi'}
                      </div>
                    </td>

                    {/* Current Stock */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div className="mono" style={{ fontWeight: 700, color: isStockReady ? 'var(--ok)' : 'var(--danger)' }}>
                        {num(availableStock)} {n.unit}
                      </div>
                      {(isPending || isApprovalPending) && (
                        <div style={{ fontSize: 10, color: isStockReady ? '#34d399' : '#f87171', fontWeight: 600 }}>
                          {isStockReady ? '✓ Siap Lunasi' : '❌ Belum Cukup'}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {isApprovalPending ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                          background: 'rgba(234, 88, 12, 0.2)', color: '#fb923c', border: '1px solid rgba(234, 88, 12, 0.4)'
                        }}>
                          <ShieldCheck size={12} /> BUTUH APPROVAL
                        </span>
                      ) : isPending ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                          background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)'
                        }}>
                          <Clock size={12} /> TERGANTUNG
                        </span>
                      ) : isResolved ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                          background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}>
                          <CheckCircle2 size={12} /> LUNAS
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                          background: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', border: '1px solid rgba(100, 116, 139, 0.3)'
                        }}>
                          BATAL
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                        {isManagerOrOwner ? (
                          isApprovalPending ? (
                            <>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => setApproveModal({
                                  open: true,
                                  note: n,
                                  resolutionNotes: `Disetujui: Pelunasan kekurangan bahan ${n.item_name} dari stok fisik`,
                                  submitting: false,
                                })}
                                style={{ fontWeight: 700, fontSize: 11.5, padding: '4px 10px' }}
                                title="Setujui & Potong Stok"
                              >
                                ✓ Setujui
                              </button>
                              <button
                                className="btn btn-sm btn-ghost"
                                onClick={() => setRejectModal({
                                  open: true,
                                  note: n,
                                  reason: 'Stok fisik belum siap / permohonan ditolak',
                                  submitting: false,
                                })}
                                style={{ fontSize: 11.5, color: 'var(--danger)', padding: '4px 8px' }}
                                title="Tolak Permohonan"
                              >
                                ✕
                              </button>
                            </>
                          ) : isPending ? (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => setApproveModal({
                                open: true,
                                note: n,
                                resolutionNotes: `Pelunasan langsung bahan ${n.item_name} dari stok fisik`,
                                submitting: false,
                              })}
                              style={{ fontWeight: 700, fontSize: 11.5, padding: '4px 10px' }}
                              title="Lunasi / Potong Sisa Stok"
                            >
                              ⚡ Lunasi Stok
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => setDetailModal({ open: true, note: n })}
                              style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}
                            >
                              <Eye size={13} style={{ marginRight: 4 }} /> Rincian
                            </button>
                          )
                        ) : (
                          isPending ? (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => setRequestModal({
                                open: true,
                                note: n,
                                notes: `Permohonan pelunasan bahan ${n.item_name} dari stok fisik/pasar`,
                                submitting: false,
                              })}
                              style={{ fontWeight: 700, fontSize: 11.5, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              title="Ajukan Pelunasan ke Manager/Owner"
                            >
                              <Send size={12} /> Ajukan
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => setDetailModal({ open: true, note: n })}
                              style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}
                            >
                              <Eye size={13} style={{ marginRight: 4 }} /> Rincian
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================
          MODAL 1: REQUEST RESOLUTION (STAFF/KASIR -> MANAGER)
         ======================================================== */}
      {requestModal.open && requestModal.note && (
        <div className="modal-overlay" onClick={() => setRequestModal(p => ({ ...p, open: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fbbf24'
              }}>
                <Send size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Ajukan Pelunasan Bahan
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Nota #{requestModal.note.order_number} · Membutuhkan Approval Manager/Owner
                </span>
              </div>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
              fontSize: 13,
            }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Bahan Baku / Item:</span>
                <strong style={{ color: '#ffffff' }}>{requestModal.note.item_name}</strong>
              </div>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Kebutuhan Total:</span>
                <span className="mono">{num(requestModal.note.required_qty)} {requestModal.note.unit}</span>
              </div>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Telah Terpotong:</span>
                <span className="mono" style={{ color: 'var(--ok)' }}>✓ {num(requestModal.note.deducted_qty)} {requestModal.note.unit}</span>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#fbbf24' }}>Sisa yang Akan Diajukan:</span>
                <span className="mono" style={{ fontWeight: 800, fontSize: 15, color: '#fbbf24' }}>
                  ⚡ {num(requestModal.note.pending_qty)} {requestModal.note.unit}
                </span>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                Stok fisik saat ini di gudang: <strong>{num(requestModal.note.current_stock_available)} {requestModal.note.unit}</strong>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Catatan / Keterangan Pengajuan untuk Manager:</label>
              <input
                type="text"
                className="form-control"
                value={requestModal.notes}
                onChange={e => setRequestModal(p => ({ ...p, notes: e.target.value }))}
                placeholder="Misal: Stok fisik baru dibeli di pasar / sudah tersedia di dapur"
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRequestModal(p => ({ ...p, open: false }))}
                disabled={requestModal.submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmRequest}
                disabled={requestModal.submitting}
                style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Send size={14} /> {requestModal.submitting ? 'Mengajukan...' : 'Kirim Pengajuan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: BATCH REQUEST RESOLUTION FOR ORDER (STAFF/KASIR)
         ======================================================== */}
      {batchRequestModal.open && batchRequestModal.order && (
        <div className="modal-overlay" onClick={() => setBatchRequestModal(p => ({ ...p, open: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fbbf24'
              }}>
                <Send size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Ajukan Pelunasan Nota #{batchRequestModal.order.order_number}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Cabang: {batchRequestModal.order.outlet_name} · Kasir: {batchRequestModal.order.cashier_name}
                </span>
              </div>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
              fontSize: 12.5,
            }}>
              <div style={{ marginBottom: 10, fontWeight: 700, color: '#fbbf24' }}>
                Daftar bahan yang akan diajukan ke Manager/Owner untuk disetujui:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {batchRequestModal.order.items
                  .filter(i => i.status === 'PENDING')
                  .map((item, idx) => {
                    const avail = Number(item.current_stock_available ?? 0);
                    const isReady = avail >= Number(item.pending_qty);
                    return (
                      <div key={idx} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: 6
                      }}>
                        <div>
                          <strong style={{ color: '#ffffff' }}>{item.item_name}</strong>
                          <div style={{ fontSize: 11, color: isReady ? '#34d399' : '#f87171' }}>
                            Stok saat ini: {num(avail)} {item.unit} ({isReady ? 'Cukup' : 'Kurang'})
                          </div>
                        </div>
                        <span className="mono" style={{ fontWeight: 800, color: '#fbbf24', fontSize: 13 }}>
                          {num(item.pending_qty)} {item.unit}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Catatan Pengajuan:</label>
              <input
                type="text"
                className="form-control"
                value={batchRequestModal.notes}
                onChange={e => setBatchRequestModal(p => ({ ...p, notes: e.target.value }))}
                placeholder="Misal: Stok bahan fisik sudah lengkap di dapur"
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setBatchRequestModal(p => ({ ...p, open: false }))}
                disabled={batchRequestModal.submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmBatchRequestOrder}
                disabled={batchRequestModal.submitting}
                style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Send size={14} /> {batchRequestModal.submitting ? 'Mengajukan...' : 'Kirim Semua Pengajuan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: APPROVE RESOLUTION (MANAGER/OWNER)
         ======================================================== */}
      {approveModal.open && approveModal.note && (
        <div className="modal-overlay" onClick={() => setApproveModal(p => ({ ...p, open: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#10b981'
              }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Setujui & Lunasi Stok Bahan
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Nota #{approveModal.note.order_number} · Potong Stok Fisik
                </span>
              </div>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
              fontSize: 13,
            }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Bahan Baku / Item:</span>
                <strong style={{ color: '#ffffff' }}>{approveModal.note.item_name}</strong>
              </div>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Kebutuhan Total:</span>
                <span className="mono">{num(approveModal.note.required_qty)} {approveModal.note.unit}</span>
              </div>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Telah Terpotong:</span>
                <span className="mono" style={{ color: 'var(--ok)' }}>✓ {num(approveModal.note.deducted_qty)} {approveModal.note.unit}</span>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#34d399' }}>Sisa yang Akan Dipotong:</span>
                <span className="mono" style={{ fontWeight: 800, fontSize: 15, color: '#34d399' }}>
                  ⚡ {num(approveModal.note.pending_qty)} {approveModal.note.unit}
                </span>
              </div>
              {approveModal.note.approval_requested_by_name && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#fbbf24', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: 6 }}>
                  Diajukan oleh: <strong>{approveModal.note.approval_requested_by_name}</strong> ({formatDateTime(approveModal.note.approval_requested_at)})
                  {approveModal.note.requested_notes && (
                    <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                      Catatan staf: "{approveModal.note.requested_notes}"
                    </div>
                  )}
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                Stok fisik saat ini di gudang: <strong>{num(approveModal.note.current_stock_available)} {approveModal.note.unit}</strong>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Catatan Persetujuan Pelunasan:</label>
              <input
                type="text"
                className="form-control"
                value={approveModal.resolutionNotes}
                onChange={e => setApproveModal(p => ({ ...p, resolutionNotes: e.target.value }))}
                placeholder="Misal: Stok fisik telah diverifikasi & disetujui"
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setApproveModal(p => ({ ...p, open: false }))}
                disabled={approveModal.submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmApprove}
                disabled={approveModal.submitting}
                style={{ fontWeight: 700, background: '#10b981', borderColor: '#10b981' }}
              >
                {approveModal.submitting ? 'Memproses...' : '✓ Setujui & Potong Stok Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 4: BATCH APPROVE RESOLUTION (MANAGER/OWNER)
         ======================================================== */}
      {batchApproveModal.open && batchApproveModal.order && (
        <div className="modal-overlay" onClick={() => setBatchApproveModal(p => ({ ...p, open: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#10b981'
              }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Setujui Seluruh Bahan Nota #{batchApproveModal.order.order_number}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Cabang: {batchApproveModal.order.outlet_name} · Kasir: {batchApproveModal.order.cashier_name}
                </span>
              </div>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
              fontSize: 12.5,
            }}>
              <div style={{ marginBottom: 10, fontWeight: 700, color: '#34d399' }}>
                Daftar bahan yang akan disetujui & otomatis dipotong dari stok gudang:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {batchApproveModal.order.items
                  .filter(i => ['PENDING', 'APPROVAL_PENDING'].includes(i.status))
                  .map((item, idx) => {
                    const avail = Number(item.current_stock_available ?? 0);
                    const isReady = avail >= Number(item.pending_qty);
                    return (
                      <div key={idx} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: 6
                      }}>
                        <div>
                          <strong style={{ color: '#ffffff' }}>{item.item_name}</strong>
                          <div style={{ fontSize: 11, color: isReady ? '#34d399' : '#f87171' }}>
                            Stok saat ini: {num(avail)} {item.unit} ({isReady ? 'Cukup' : 'Kurang'})
                          </div>
                        </div>
                        <span className="mono" style={{ fontWeight: 800, color: '#34d399', fontSize: 13 }}>
                          {num(item.pending_qty)} {item.unit}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Catatan Persetujuan:</label>
              <input
                type="text"
                className="form-control"
                value={batchApproveModal.notes}
                onChange={e => setBatchApproveModal(p => ({ ...p, notes: e.target.value }))}
                placeholder="Misal: Persetujuan kolektif pelunasan bahan nota"
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setBatchApproveModal(p => ({ ...p, open: false }))}
                disabled={batchApproveModal.submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmBatchApproveOrder}
                disabled={batchApproveModal.submitting}
                style={{ fontWeight: 700, background: '#10b981', borderColor: '#10b981' }}
              >
                {batchApproveModal.submitting ? 'Memproses...' : '✓ Setujui & Lunasi Semua Bahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 5: REJECT RESOLUTION (MANAGER/OWNER)
         ======================================================== */}
      {rejectModal.open && rejectModal.note && (
        <div className="modal-overlay" onClick={() => setRejectModal(p => ({ ...p, open: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#f87171'
              }}>
                <XCircle size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Tolak Permohonan Pelunasan
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Nota #{rejectModal.note.order_number} · {rejectModal.note.item_name}
                </span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Permohonan akan dikembalikan ke kasir/staf dengan status belum disetujui.
            </p>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Alasan Penolakan (Wajib):</label>
              <input
                type="text"
                className="form-control"
                value={rejectModal.reason}
                onChange={e => setRejectModal(p => ({ ...p, reason: e.target.value }))}
                placeholder="Alasan penolakan permohonan..."
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRejectModal(p => ({ ...p, open: false }))}
                disabled={rejectModal.submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmReject}
                disabled={rejectModal.submitting || !rejectModal.reason.trim()}
              >
                {rejectModal.submitting ? 'Menyimpan...' : '✕ Tolak Permohonan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 6: BATCH REJECT RESOLUTION (MANAGER/OWNER)
         ======================================================== */}
      {batchRejectModal.open && batchRejectModal.order && (
        <div className="modal-overlay" onClick={() => setBatchRejectModal(p => ({ ...p, open: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: '0 0 10px' }}>
              Tolak Permohonan Nota #{batchRejectModal.order.order_number}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Semua permohonan pelunasan pada nota ini akan ditolak dan dikembalikan ke kasir.
            </p>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Alasan Penolakan:</label>
              <input
                type="text"
                className="form-control"
                value={batchRejectModal.reason}
                onChange={e => setBatchRejectModal(p => ({ ...p, reason: e.target.value }))}
                placeholder="Alasan penolakan..."
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setBatchRejectModal(p => ({ ...p, open: false }))}
                disabled={batchRejectModal.submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmBatchRejectOrder}
                disabled={batchRejectModal.submitting || !batchRejectModal.reason.trim()}
              >
                {batchRejectModal.submitting ? 'Menyimpan...' : '✕ Tolak Semua Pengajuan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 7: RINCIAN NOTA URGENT & AUDIT TRAIL (DETAIL MODAL)
         ======================================================== */}
      {detailModal.open && detailModal.note && (
        <div className="modal-overlay" onClick={() => setDetailModal({ open: false, note: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Rincian & Jejak Audit Nota Urgent
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetailModal({ open: false, note: null })}>
                <X size={16} />
              </button>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 14,
              fontSize: 13,
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>No. Order:</span>
                <strong className="mono" style={{ color: '#60a5fa' }}>{detailModal.note.order_number}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                <strong style={{
                  color: detailModal.note.status === 'RESOLVED'
                    ? 'var(--ok)'
                    : detailModal.note.status === 'APPROVAL_PENDING'
                    ? '#fb923c'
                    : '#fbbf24'
                }}>
                  {detailModal.note.status === 'APPROVAL_PENDING'
                    ? 'MENUNGGU APPROVAL MANAGER'
                    : detailModal.note.status === 'RESOLVED'
                    ? 'LUNAS (SELESAI)'
                    : detailModal.note.status === 'PENDING'
                    ? 'TERGANTUNG (BELUM DIAJUKAN)'
                    : detailModal.note.status}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Bahan Baku / Item:</span>
                <strong style={{ color: '#ffffff' }}>{detailModal.note.item_name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Kebutuhan Total:</span>
                <span className="mono">{num(detailModal.note.required_qty)} {detailModal.note.unit}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Terpotong Riil di Kasir:</span>
                <span className="mono" style={{ color: 'var(--ok)' }}>{num(detailModal.note.deducted_qty)} {detailModal.note.unit}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Kekurangan Tergantung:</span>
                <span className="mono" style={{ color: '#fbbf24', fontWeight: 800 }}>{num(detailModal.note.pending_qty)} {detailModal.note.unit}</span>
              </div>

              {/* Approval Request Audit */}
              {detailModal.note.approval_requested_at && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Diajukan Oleh:</span>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>{detailModal.note.approval_requested_by_name || 'Kasir/Staf'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Waktu Pengajuan:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{formatDateTime(detailModal.note.approval_requested_at)}</span>
                  </div>
                  {detailModal.note.requested_notes && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Catatan Pengajuan:</span>
                      <span style={{ color: '#fbbf24' }}>{detailModal.note.requested_notes}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Approval Resolution Audit */}
              {detailModal.note.resolved_at && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Disetujui & Dilunasi Oleh:</span>
                    <span style={{ color: '#34d399', fontWeight: 700 }}>{detailModal.note.approved_by_name || detailModal.note.resolved_by_name || 'Manager/Owner'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Waktu Pelunasan:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{formatDateTime(detailModal.note.resolved_at)}</span>
                  </div>
                  {detailModal.note.resolution_notes && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Catatan Pelunasan:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{detailModal.note.resolution_notes}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Rejection Audit */}
              {detailModal.note.rejected_at && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Pernah Ditolak Oleh:</span>
                    <span style={{ color: '#f87171', fontWeight: 600 }}>{detailModal.note.rejected_by_name || 'Manager/Owner'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Alasan Penolakan:</span>
                    <span style={{ color: '#f87171' }}>{detailModal.note.reject_reason}</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setDetailModal({ open: false, note: null })}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 8: PEMBATALAN NOTA URGENT (CANCEL MODAL)
         ======================================================== */}
      {cancelModal.open && cancelModal.note && (
        <div className="modal-overlay" onClick={() => setCancelModal(p => ({ ...p, open: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: '0 0 10px' }}>
              Batalkan Hutang Bahan
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Apakah Anda yakin ingin membatalkan hutang bahan <strong>{cancelModal.note.item_name}</strong> pada Nota #{cancelModal.note.order_number}?
            </p>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Alasan Pembatalan:</label>
              <input
                type="text"
                className="form-control"
                value={cancelModal.reason}
                onChange={e => setCancelModal(p => ({ ...p, reason: e.target.value }))}
                placeholder="Alasan pembatalan..."
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCancelModal(p => ({ ...p, open: false }))}
                disabled={cancelModal.submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmCancel}
                disabled={cancelModal.submitting}
              >
                {cancelModal.submitting ? 'Menyimpan...' : 'Konfirmasi Batal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
