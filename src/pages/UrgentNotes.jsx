import { useState, useEffect, useMemo } from 'react';
import {
  AlertOctagon, Search, Filter, RefreshCw, CheckCircle2, Clock,
  ArrowUpRight, AlertTriangle, Check, X, ShieldAlert, Package,
  Store, UtensilsCrossed, Sparkles, ChevronRight, ChevronDown, Eye, Layers,
  Receipt, List
} from 'lucide-react';
import api from '../api/client';
import { num, LoadingState, PageHeader, PeriodPicker } from '../components/ui';
import { getMonthStartStr, getTodayStr } from '../utils/date';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';

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
  const { activeOutletId, activeOutlet, outlets, isOwnerBisnis, isSuperadminPlatform } = useOutlet();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notes, setNotes] = useState([]);
  const [summary, setSummary] = useState({
    pending_count: 0,
    pending_transactions_count: 0,
    resolved_count: 0,
    total_count: 0,
    pending_ingredients: [],
  });

  // View Mode: 'grouped' (Group by Nota) | 'flat' (Rincian Semua Bahan)
  const [viewMode, setViewMode] = useState('grouped');
  const [expandedOrders, setExpandedOrders] = useState({});

  // Filters
  const [statusFilter, setStatusFilter] = useState('PENDING'); // 'PENDING' | 'RESOLVED' | 'ALL'
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState(() => ({
    from: getMonthStartStr(),
    to: getTodayStr(),
  }));

  // Modals
  const [resolveModal, setResolveModal] = useState({
    open: false,
    note: null,
    resolutionNotes: 'Pelunasan sisa bahan tergantung dari stok gudang/pembelian',
    submitting: false,
  });

  const [batchResolveModal, setBatchResolveModal] = useState({
    open: false,
    order: null,
    submitting: false,
    notes: '',
  });

  const [cancelModal, setCancelModal] = useState({
    open: false,
    note: null,
    reason: 'Dibatalkan oleh kasir / penyesuaian manual',
    submitting: false,
  });

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
      if (period.from) params.from = period.from;
      if (period.to) params.to = period.to;

      const [notesRes, sumRes] = await Promise.all([
        api.get('/urgent-notes', { params }),
        api.get('/urgent-notes/summary', { params: {
          ...(effectiveOutletId ? { outlet_id: effectiveOutletId } : {}),
          ...(period.from ? { from: period.from } : {}),
          ...(period.to ? { to: period.to } : {})
        } }),
      ]);

      const items = notesRes.data.data ? notesRes.data.data : (Array.isArray(notesRes.data) ? notesRes.data : []);
      setNotes(items);
      setSummary(sumRes.data || {
        pending_count: 0,
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
      (n.notes && n.notes.toLowerCase().includes(q))
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
      } else if (note.status === 'RESOLVED') {
        groups[key].resolved_count++;
      } else {
        groups[key].cancelled_count++;
      }
    }

    return Object.values(groups).sort((a, b) => {
      // Pending orders first, then latest created_at
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

  // Handle Resolve (Pelunasan Sisa Stok per Item)
  async function handleConfirmResolve() {
    if (!resolveModal.note) return;
    setResolveModal(p => ({ ...p, submitting: true }));
    try {
      const res = await api.post(`/urgent-notes/${resolveModal.note.id}/resolve`, {
        notes: resolveModal.resolutionNotes,
      });
      toast.success(res.data.message || 'Sisa stok tergantung berhasil dilunasi!');
      setResolveModal({ open: false, note: null, resolutionNotes: '', submitting: false });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal melunasi nota urgent');
      setResolveModal(p => ({ ...p, submitting: false }));
    }
  }

  // Handle Batch Resolve for an entire Order
  async function handleConfirmBatchResolveOrder() {
    if (!batchResolveModal.order) return;
    setBatchResolveModal(p => ({ ...p, submitting: true }));
    try {
      const pendingIds = batchResolveModal.order.items
        .filter(i => i.status === 'PENDING')
        .map(i => i.id);

      const res = await api.post('/urgent-notes/batch-resolve', {
        order_number: batchResolveModal.order.order_number,
        note_ids: pendingIds,
        notes: batchResolveModal.notes || `Pelunasan kolektif nota #${batchResolveModal.order.order_number}`,
      });

      toast.success(res.data.message || `Seluruh bahan pada Nota #${batchResolveModal.order.order_number} berhasil dilunasi!`);
      setBatchResolveModal({ open: false, order: null, submitting: false, notes: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal melunasi nota urgent');
      setBatchResolveModal(p => ({ ...p, submitting: false }));
    }
  }

  // Handle Cancel
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

  // Batch Resolve for a specific ingredient
  async function handleBatchResolveIngredient(ingredientId, ingName) {
    if (!window.confirm(`Lunasi semua kekurangan bahan "${ingName}" yang berstatus tergantung?`)) return;
    try {
      const res = await api.post('/urgent-notes/batch-resolve', {
        ingredient_id: ingredientId,
        outlet_id: effectiveOutletId || undefined,
      });
      toast.success(res.data.message || 'Berhasil melunasi bahan!');
      fetchData();
    } catch (err) {
      toast.error('Gagal melakukan pelunasan massal');
    }
  }

  return (
    <div className="page-container">
      {/* Header */}
      <PageHeader
        title="Nota Urgent / Manual (Bahan Tergantung)"
        subtitle="Manajemen transaksi darurat dengan kekurangan stok bahan yang dikelompokkan per nota. Klik nota untuk melihat rincian bahan tergantung dan melunasi sisa kuantitas."
        icon={AlertOctagon}
        badge={summary.pending_count > 0 ? `${summary.pending_count} Bahan Tergantung` : 'Semua Stok Lunas'}
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

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
        marginBottom: 20,
      }}>
        {/* Card 1: Pending Bahan Tergantung */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
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
                {summary.pending_count} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>item</span>
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
            Dari <strong>{summary.pending_transactions_count}</strong> nota pesanan kasir
          </div>
        </div>

        {/* Card 2: Nota Selesai Dilunasi */}
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
                {summary.resolved_count} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>item</span>
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
            Stok telah dipotong & terpenuhi sempurna
          </div>
        </div>

        {/* Card 3: Total Riwayat Nota Urgent */}
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
                {summary.total_count} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>catatan</span>
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
                    onClick={() => handleBatchResolveIngredient(ing.ingredient_id, ing.ingredient_name)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px' }}
                  >
                    ⚡ Lunasi Semua
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
        <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.25)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'PENDING' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatusFilter('PENDING')}
            style={{ fontWeight: 700, fontSize: 12 }}
          >
            ⚡ Tergantung ({summary.pending_count})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'RESOLVED' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatusFilter('RESOLVED')}
            style={{ fontWeight: 700, fontSize: 12 }}
          >
            ✓ Selesai ({summary.resolved_count})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatusFilter('ALL')}
            style={{ fontWeight: 700, fontSize: 12 }}
          >
            Semua ({summary.total_count})
          </button>
        </div>

        {/* Outlet, Period & Search Filter */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <PeriodPicker
            from={period.from}
            to={period.to}
            onChange={setPeriod}
            label="Periode Nota"
            align="right"
          />

          {/* Search Input */}
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
            {statusFilter === 'PENDING'
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
            const isPending = group.pending_count > 0;
            const isResolved = group.pending_count === 0 && group.resolved_count > 0;

            return (
              <div
                key={group.order_number}
                style={{
                  background: 'var(--surface)',
                  border: isPending
                    ? '1px solid rgba(245, 158, 11, 0.45)'
                    : '1px solid var(--border)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: isPending ? '0 4px 18px rgba(245, 158, 11, 0.08)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Accordion Header (Click to toggle expansion) */}
                <div
                  onClick={() => toggleOrderExpand(group.order_number)}
                  style={{
                    padding: '14px 18px',
                    background: isPending
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
                      background: isPending ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isPending ? '#fbbf24' : '#60a5fa',
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

                        {isPending ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                            background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)'
                          }}>
                            <Clock size={11} /> {group.pending_count} BAHAN TERGANTUNG
                          </span>
                        ) : isResolved ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                            background: 'rgba(16, 185, 129, 0.18)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.35)'
                          }}>
                            <CheckCircle2 size={11} /> SEMUA LUNAS ({group.resolved_count} BAHAN)
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                            background: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', border: '1px solid rgba(100, 116, 139, 0.3)'
                          }}>
                            BATAL
                          </span>
                        )}

                        {/* Stock Readiness Pill */}
                        {isPending && (
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
                              {group.ready_items_count}/{group.pending_count} Bahan Siap
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

                  {/* Right Actions: Batch Resolve for this order + Expand text */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {isPending && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBatchResolveModal({
                            open: true,
                            order: group,
                            submitting: false,
                            notes: `Pelunasan sisa bahan Nota #${group.order_number} dari stok fisik`,
                          });
                        }}
                        style={{ fontSize: 11.5, fontWeight: 700, padding: '5px 12px' }}
                        title="Lunasi semua bahan yang tergantung di nota ini sekaligus"
                      >
                        ⚡ Lunasi Semua di Nota Ini
                      </button>
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

                {/* Accordion Body: Detailed Ingredients List (Muncul jika di-klik) */}
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
                            const itemPending = n.status === 'PENDING';
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
                                    color: itemPending ? '#fbbf24' : 'var(--text-muted)',
                                    background: itemPending ? 'rgba(245, 158, 11, 0.18)' : 'transparent',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    border: itemPending ? '1px solid rgba(245, 158, 11, 0.35)' : 'none',
                                  }}>
                                    ⚡ {num(n.pending_qty)} {n.unit}
                                  </span>
                                </td>

                                {/* Current Stock in Outlet */}
                                <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                                  <div className="mono" style={{ fontWeight: 700, color: isStockReady ? 'var(--ok)' : 'var(--danger)' }}>
                                    {num(availableStock)} {n.unit}
                                  </div>
                                  {itemPending && (
                                    <div style={{ fontSize: 10, color: isStockReady ? '#34d399' : '#f87171', fontWeight: 600 }}>
                                      {isStockReady ? '✓ Cukup' : '❌ Belum Cukup'}
                                    </div>
                                  )}
                                </td>

                                {/* Status */}
                                <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                                  {itemPending ? (
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 800,
                                      background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)'
                                    }}>
                                      <Clock size={11} /> TERGANTUNG
                                    </span>
                                  ) : n.status === 'RESOLVED' ? (
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
                                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                    {itemPending ? (
                                      <>
                                        <button
                                          className="btn btn-sm btn-primary"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setResolveModal({
                                              open: true,
                                              note: n,
                                              resolutionNotes: `Pelunasan kekurangan bahan ${n.item_name} dari stok fisik`,
                                              submitting: false,
                                            });
                                          }}
                                          style={{ fontWeight: 700, fontSize: 11, padding: '3px 8px' }}
                                          title="Lunasi / Potong Sisa Stok Bahan Ini"
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
                        color: isPending ? '#fbbf24' : 'var(--text-muted)',
                        background: isPending ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                        padding: '2px 8px',
                        borderRadius: 6,
                        border: isPending ? '1px solid rgba(245, 158, 11, 0.3)' : 'none',
                      }}>
                        ⚡ {num(n.pending_qty)} {n.unit}
                      </span>
                      <div style={{ fontSize: 10, color: isPending ? '#fbbf24' : 'var(--text-muted)' }}>
                        {isPending ? 'Hutang bahan' : 'Telah dilunasi'}
                      </div>
                    </td>

                    {/* Current Stock */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div className="mono" style={{ fontWeight: 700, color: isStockReady ? 'var(--ok)' : 'var(--danger)' }}>
                        {num(availableStock)} {n.unit}
                      </div>
                      {isPending && (
                        <div style={{ fontSize: 10, color: isStockReady ? '#34d399' : '#f87171', fontWeight: 600 }}>
                          {isStockReady ? '✓ Siap Lunasi' : '❌ Belum Cukup'}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {isPending ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                          background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)'
                        }}>
                          <Clock size={12} /> TERGANTUNG
                        </span>
                      ) : n.status === 'RESOLVED' ? (
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
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        {isPending ? (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => setResolveModal({
                              open: true,
                              note: n,
                              resolutionNotes: `Pelunasan kekurangan bahan ${n.item_name} dari stok fisik`,
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
          MODAL 1: PELUNASAN SISA STOK TERGANTUNG PER ITEM (RESOLVE MODAL)
         ======================================================== */}
      {resolveModal.open && resolveModal.note && (
        <div className="modal-overlay" onClick={() => setResolveModal(p => ({ ...p, open: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fbbf24'
              }}>
                <Sparkles size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Lunasi Sisa Stok Tergantung
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Nota #{resolveModal.note.order_number}
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
                <strong style={{ color: '#ffffff' }}>{resolveModal.note.item_name}</strong>
              </div>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Kebutuhan Total:</span>
                <span className="mono">{num(resolveModal.note.required_qty)} {resolveModal.note.unit}</span>
              </div>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Telah Terpotong:</span>
                <span className="mono" style={{ color: 'var(--ok)' }}>✓ {num(resolveModal.note.deducted_qty)} {resolveModal.note.unit}</span>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#fbbf24' }}>Sisa yang Akan Dipotong:</span>
                <span className="mono" style={{ fontWeight: 800, fontSize: 15, color: '#fbbf24' }}>
                  ⚡ {num(resolveModal.note.pending_qty)} {resolveModal.note.unit}
                </span>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                Stok fisik saat ini di gudang: <strong>{num(resolveModal.note.current_stock_available)} {resolveModal.note.unit}</strong>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Catatan Pelunasan / Sumber Stok:</label>
              <input
                type="text"
                className="form-control"
                value={resolveModal.resolutionNotes}
                onChange={e => setResolveModal(p => ({ ...p, resolutionNotes: e.target.value }))}
                placeholder="Misal: Stok baru masuk dari PO #123 / Pembelian Kasir"
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setResolveModal(p => ({ ...p, open: false }))}
                disabled={resolveModal.submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmResolve}
                disabled={resolveModal.submitting}
                style={{ fontWeight: 700 }}
              >
                {resolveModal.submitting ? 'Memproses...' : 'Potong & Selesaikan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: PELUNASAN KOLEKTIF SELURUH BAHAN PER NOTA (BATCH RESOLVE ORDER)
         ======================================================== */}
      {batchResolveModal.open && batchResolveModal.order && (
        <div className="modal-overlay" onClick={() => setBatchResolveModal(p => ({ ...p, open: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fbbf24'
              }}>
                <Sparkles size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Lunasi Seluruh Bahan di Nota #{batchResolveModal.order.order_number}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Cabang: {batchResolveModal.order.outlet_name} · Kasir: {batchResolveModal.order.cashier_name}
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
                Daftar bahan yang akan otomatis dilunasi dan dipotong dari stok gudang:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {batchResolveModal.order.items
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
              <label className="form-label" style={{ fontSize: 12 }}>Catatan Pelunasan:</label>
              <input
                type="text"
                className="form-control"
                value={batchResolveModal.notes}
                onChange={e => setBatchResolveModal(p => ({ ...p, notes: e.target.value }))}
                placeholder="Misal: Pelunasan stok setelah barang restok datang"
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setBatchResolveModal(p => ({ ...p, open: false }))}
                disabled={batchResolveModal.submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmBatchResolveOrder}
                disabled={batchResolveModal.submitting}
                style={{ fontWeight: 700 }}
              >
                {batchResolveModal.submitting ? 'Memproses...' : '✓ Potong & Lunasi Semua Bahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: RINCIAN NOTA URGENT (DETAIL MODAL)
         ======================================================== */}
      {detailModal.open && detailModal.note && (
        <div className="modal-overlay" onClick={() => setDetailModal({ open: false, note: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Rincian Nota Urgent
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
                <strong style={{ color: detailModal.note.status === 'RESOLVED' ? 'var(--ok)' : '#fbbf24' }}>
                  {detailModal.note.status}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Bahan Baku:</span>
                <strong style={{ color: '#ffffff' }}>{detailModal.note.item_name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Kebutuhan:</span>
                <span className="mono">{num(detailModal.note.required_qty)} {detailModal.note.unit}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Terpotong Riil:</span>
                <span className="mono" style={{ color: 'var(--ok)' }}>{num(detailModal.note.deducted_qty)} {detailModal.note.unit}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Kekurangan Tergantung:</span>
                <span className="mono" style={{ color: '#fbbf24', fontWeight: 800 }}>{num(detailModal.note.pending_qty)} {detailModal.note.unit}</span>
              </div>
              {detailModal.note.resolved_at && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Waktu Pelunasan:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{new Date(detailModal.note.resolved_at).toLocaleString('id-ID')}</span>
                </div>
              )}
              {detailModal.note.resolved_by_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Dilunasi Oleh:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{detailModal.note.resolved_by_name}</span>
                </div>
              )}
              {detailModal.note.resolution_notes && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Catatan:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{detailModal.note.resolution_notes}</span>
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
          MODAL 4: PEMBATALAN NOTA URGENT (CANCEL MODAL)
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
