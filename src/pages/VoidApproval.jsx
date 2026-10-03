import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RotateCcw, CheckCircle2, XCircle, Clock, AlertTriangle, Printer,
  Search, Filter, Calendar, ChevronDown, ChevronUp, Boxes, Package,
  ShieldCheck, ShieldAlert, Store, User, Utensils, RefreshCw,
  FileText, Sparkles, X, Check, ArrowRight, CornerDownRight, Tag
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useOutlet as useOutletContext } from '../context/OutletContext';
import { formatLocalDisplay, getTodayStr, getMonthStartStr } from '../utils/date';
import { printElement } from '../utils/print';

function rupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function formatQty(val) {
  const n = Number(val || 0);
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

export default function VoidApproval() {
  const {
    outlets,
    activeOutletId,
    currentUser,
    isOwnerBisnis,
    isOwnerOutlet,
    isPlatformAdmin
  } = useOutletContext();

  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    pending_count: 0,
    pending_total_amount: 0,
    approved_count: 0,
    approved_total_amount: 0,
    rejected_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusTab, setStatusTab] = useState('VOID_PENDING'); // 'VOID_PENDING' | 'CANCELLED' | 'REJECTED' | 'ALL'
  const [selectedOutletId, setSelectedOutletId] = useState('');
  const [startDate, setStartDate] = useState(getMonthStartStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [searchQuery, setSearchQuery] = useState('');

  // Expandable cards state
  const [expandedOrders, setExpandedOrders] = useState({});

  useEffect(() => {
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      setSelectedOutletId(String(activeOutletId));
    } else {
      setSelectedOutletId('');
    }
  }, [activeOutletId]);

  // Modals
  const [approveModal, setApproveModal] = useState({ open: false, order: null, submitting: false, reason: '', voidType: 'WRONG_INPUT' });
  const [rejectModal, setRejectModal] = useState({ open: false, order: null, submitting: false, reason: '' });
  const [printModal, setPrintModal] = useState({ open: false, order: null });

  const toggleExpand = (orderNumber) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderNumber]: !prev[orderNumber]
    }));
  };

  const fetchVoidRequests = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const params = {
        status: statusTab,
        outlet_id: selectedOutletId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        search: searchQuery || undefined,
      };

      const res = await api.get('/transactions/void-requests', { params });
      setOrders(res.data?.data || []);
      if (res.data?.stats) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Failed fetching void requests', err);
      toast.error(err.response?.data?.message || 'Gagal memuat daftar permohonan void.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusTab, selectedOutletId, startDate, endDate, searchQuery]);

  useEffect(() => {
    fetchVoidRequests();
  }, [fetchVoidRequests]);

  // Handle Approve Void
  const handleConfirmApprove = async () => {
    if (!approveModal.order) return;
    setApproveModal(p => ({ ...p, submitting: true }));

    const orderNum = approveModal.order.order_number;
    try {
      const res = await api.post(`/transactions/${orderNum}/void-approve`, {
        reason: approveModal.reason || approveModal.order.cancellation_reason || 'Disetujui Manajer/Owner',
        void_type: approveModal.voidType || 'WRONG_INPUT'
      });

      toast.success(res.data?.message || `Void nota #${orderNum} berhasil disetujui!`);
      setApproveModal({ open: false, order: null, submitting: false, reason: '', voidType: 'WRONG_INPUT' });
      fetchVoidRequests(true);
    } catch (err) {
      console.error('Error approving void', err);
      toast.error(err.response?.data?.message || 'Gagal menyetujui void transaksi.');
      setApproveModal(p => ({ ...p, submitting: false }));
    }
  };

  // Handle Reject Void
  const handleConfirmReject = async () => {
    if (!rejectModal.order) return;
    if (!rejectModal.reason.trim()) {
      toast.error('Alasan penolakan void wajib diisi agar kasir mengetahui penyebabnya.');
      return;
    }

    setRejectModal(p => ({ ...p, submitting: true }));
    const orderNum = rejectModal.order.order_number;

    try {
      const res = await api.post(`/transactions/${orderNum}/void-reject`, {
        reason: rejectModal.reason.trim()
      });

      toast.success(res.data?.message || `Permohonan void nota #${orderNum} telah ditolak.`);
      setRejectModal({ open: false, order: null, submitting: false, reason: '' });
      fetchVoidRequests(true);
    } catch (err) {
      console.error('Error rejecting void', err);
      toast.error(err.response?.data?.message || 'Gagal menolak permohonan void.');
      setRejectModal(p => ({ ...p, submitting: false }));
    }
  };

  // Thermal print trigger
  const doPrintVoidReceipt = (order) => {
    printElement('printable-void-thermal-receipt', `Struk-VOID-${order?.order_number || ''}`, {
      isThermal: true,
      paperWidth: '80mm'
    });
  };

  // Filtered in-memory list (if needed)
  const filteredOrders = useMemo(() => {
    return orders;
  }, [orders]);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.3) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f87171'
            }}>
              <RotateCcw size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
                Persetujuan Void Nota
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Halaman Otorisasi Manajer & Owner: Verifikasi pembatalan nota kasir dan pengembalian stok bahan resep.
              </p>
            </div>
          </div>
        </div>

        {/* Top Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fetchVoidRequests(false)}
            disabled={loading || refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Memuat Data...' : 'Segarkan Data'}
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        {/* Card 1: Pending */}
        <div style={{
          background: stats.pending_count > 0 ? 'linear-gradient(145deg, rgba(245, 158, 11, 0.12) 0%, rgba(17, 24, 39, 0.8) 100%)' : 'rgba(255, 255, 255, 0.03)',
          border: `1px solid ${stats.pending_count > 0 ? 'rgba(245, 158, 11, 0.4)' : 'var(--border)'}`,
          borderRadius: 14,
          padding: '18px 20px',
          boxShadow: stats.pending_count > 0 ? '0 0 20px rgba(245, 158, 11, 0.15)' : 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Menunggu Persetujuan
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>
              {stats.pending_count} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Nota</span>
            </div>
            <div className="mono" style={{ fontSize: 12, color: '#fbbf24', marginTop: 2, fontWeight: 700 }}>
              {rupiah(stats.pending_total_amount)}
            </div>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(245, 158, 11, 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fbbf24'
          }}>
            <Clock size={22} />
          </div>
        </div>

        {/* Card 2: Approved */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '18px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Void Disetujui
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>
              {stats.approved_count} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Nota</span>
            </div>
            <div className="mono" style={{ fontSize: 12, color: '#34d399', marginTop: 2, fontWeight: 700 }}>
              {rupiah(stats.approved_total_amount)}
            </div>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(52, 211, 153, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#34d399'
          }}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        {/* Card 3: Rejected */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '18px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Permohonan Ditolak
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>
              {stats.rejected_count} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Nota</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
              Transaksi tetap lunas & omzet terjaga
            </div>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(248, 113, 113, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#f87171'
          }}>
            <XCircle size={22} />
          </div>
        </div>

        {/* Card 4: SOP Notice */}
        <div style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: 14,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 6
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#818cf8', fontWeight: 800, fontSize: 12 }}>
            <ShieldCheck size={16} /> Otomatisasi Kartu Stok
          </div>
          <div style={{ fontSize: 11.5, color: '#c7d2fe', lineHeight: 1.4 }}>
            Saat void disetujui, mutasi <strong>ADJUSTMENT_IN</strong> akan dicatat otomatis ke Kartu Stok cabang terkait.
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div style={{
        background: 'rgba(17, 24, 39, 0.6)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }}>
        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
          {[
            { id: 'VOID_PENDING', label: 'Menunggu Persetujuan', icon: Clock, count: stats.pending_count, color: '#fbbf24' },
            { id: 'CANCELLED', label: 'Telah Disetujui (Void)', icon: CheckCircle2, count: stats.approved_count, color: '#34d399' },
            { id: 'REJECTED', label: 'Ditolak', icon: XCircle, count: stats.rejected_count, color: '#f87171' },
            { id: 'ALL', label: 'Semua Riwayat', icon: FileText, count: null, color: '#94a3b8' },
          ].map(tab => {
            const Icon = tab.icon;
            const isCur = statusTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusTab(tab.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: '1px solid',
                  borderColor: isCur ? tab.color : 'transparent',
                  background: isCur ? `rgba(${tab.id === 'VOID_PENDING' ? '245, 158, 11' : tab.id === 'CANCELLED' ? '52, 211, 153' : tab.id === 'REJECTED' ? '248, 113, 113' : '148, 163, 184'}, 0.15)` : 'rgba(255, 255, 255, 0.03)',
                  color: isCur ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={15} style={{ color: tab.color }} />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span style={{
                    background: isCur ? tab.color : 'rgba(255, 255, 255, 0.1)',
                    color: isCur ? '#000' : '#fff',
                    padding: '1px 7px',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 800
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Select Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Cari no nota, kasir, alasan..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 34, fontSize: 12.5 }}
            />
          </div>

          {/* Outlet Selector */}
          <div>
            <select
              className="form-control"
              value={selectedOutletId}
              onChange={e => setSelectedOutletId(e.target.value)}
              style={{ fontSize: 12.5 }}
            >
              <option value="">Semua Cabang Outlet</option>
              {outlets.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <input
              type="date"
              className="form-control"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ fontSize: 12.5 }}
            />
          </div>

          {/* End Date */}
          <div>
            <input
              type="date"
              className="form-control"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{ fontSize: 12.5 }}
            />
          </div>
        </div>
      </div>

      {/* Main Request List Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--accent-bright)' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>Memuat Permohonan Void...</div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px dashed var(--border)',
          borderRadius: 16
        }}>
          <ShieldCheck size={48} style={{ margin: '0 auto 12px', color: '#34d399', opacity: 0.6 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: 0 }}>
            {statusTab === 'VOID_PENDING' ? 'Tidak Ada Permohonan Void yang Menunggu' : 'Tidak Ada Data Transaksi Void Ditemukan'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, maxWidth: 450, margin: '6px auto 0' }}>
            {statusTab === 'VOID_PENDING'
              ? 'Seluruh permohonan void dari kasir telah diproses dan diselesaikan.'
              : 'Silakan sesuaikan filter tanggal atau kata kunci pencarian.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredOrders.map(order => {
            const isExpanded = expandedOrders[order.order_number] !== false; // default expanded
            const isPending = order.status === 'VOID_PENDING';
            const isCancelled = order.status === 'CANCELLED';
            const isRejected = Boolean(order.void_rejected_at);

            return (
              <div
                key={order.order_number}
                style={{
                  background: isPending
                    ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.06) 0%, rgba(17, 24, 39, 0.85) 100%)'
                    : 'rgba(17, 24, 39, 0.7)',
                  border: isPending
                    ? '1.5px solid rgba(245, 158, 11, 0.4)'
                    : '1px solid var(--border)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  boxShadow: isPending ? '0 4px 20px rgba(0, 0, 0, 0.4)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Header Bar */}
                <div style={{
                  padding: '14px 20px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
                      #{order.order_number}
                    </span>

                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: 'rgba(255, 255, 255, 0.08)',
                      padding: '2px 8px',
                      borderRadius: 6,
                      color: 'var(--text-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <Store size={12} /> {order.outlet_name}
                    </span>

                    {/* Void Type Badge */}
                    {order.void_type === 'WASTED' ? (
                      <span style={{
                        background: 'rgba(244, 63, 94, 0.15)',
                        border: '1px solid rgba(244, 63, 94, 0.35)',
                        color: '#fb7185',
                        padding: '3px 9px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5
                      }}>
                        <Trash2 size={13} /> Wasted (Makanan Terbuang)
                      </span>
                    ) : (
                      <span style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        color: '#38bdf8',
                        padding: '3px 9px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5
                      }}>
                        <RotateCcw size={13} /> Salah Input
                      </span>
                    )}

                    {/* Status Badge */}
                    {isPending ? (
                      <span style={{
                        background: 'rgba(245, 158, 11, 0.2)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        color: '#fbbf24',
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 11.5,
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5
                      }}>
                        <Clock size={13} /> Menunggu Persetujuan Manajer
                      </span>
                    ) : isCancelled ? (
                      <span style={{
                        background: 'rgba(52, 211, 153, 0.15)',
                        border: '1px solid rgba(52, 211, 153, 0.35)',
                        color: '#34d399',
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 11.5,
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5
                      }}>
                        <CheckCircle2 size={13} /> Void Disetujui (Dibatalkan)
                      </span>
                    ) : isRejected ? (
                      <span style={{
                        background: 'rgba(248, 113, 113, 0.15)',
                        border: '1px solid rgba(248, 113, 113, 0.35)',
                        color: '#f87171',
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 11.5,
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5
                      }}>
                        <XCircle size={13} /> Permohonan Ditolak
                      </span>
                    ) : null}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Nilai Nota:</div>
                      <div className="mono" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
                        {rupiah(order.total_price)}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-icon"
                      onClick={() => toggleExpand(order.order_number)}
                      title={isExpanded ? 'Sembunyikan Rincian' : 'Tampilkan Rincian'}
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '16px 20px' }}>
                  {/* Meta Information Bar */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 12,
                    background: 'rgba(0, 0, 0, 0.25)',
                    padding: '12px 14px',
                    borderRadius: 10,
                    marginBottom: 16,
                    fontSize: 12
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Tgl Transaksi:</span>
                      <strong style={{ color: '#ffffff' }}>{order.date} ({order.created_at ? formatLocalDisplay(order.created_at, true) : '-'})</strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Kasir Transaksi:</span>
                      <strong style={{ color: '#ffffff' }}>{order.cashier_name || 'Kasir'}</strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Diajukan Void Oleh:</span>
                      <strong style={{ color: '#fbbf24' }}>
                        {order.void_requested_by_name || 'Kasir'}
                        {order.void_requested_at && ` · ${formatLocalDisplay(order.void_requested_at, true)}`}
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Tamu / Meja:</span>
                      <strong style={{ color: '#ffffff' }}>
                        {order.customer_name || 'Pelanggan Walk-in'} {order.table_number ? `(Meja ${order.table_number})` : ''}
                      </strong>
                    </div>
                  </div>

                  {/* Alasan Pembatalan Callout Banner */}
                  <div style={{
                    background: isPending ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    borderLeft: `4px solid ${isPending ? '#fbbf24' : isCancelled ? '#34d399' : '#f87171'}`,
                    padding: '10px 14px',
                    borderRadius: '0 8px 8px 0',
                    marginBottom: 16
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Alasan Pembatalan / Void dari Kasir:
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#ffffff', marginTop: 3 }}>
                      "{order.cancellation_reason || 'Tidak ada keterangan'}"
                    </div>
                  </div>

                  {/* Rejection / Approval Audit Note */}
                  {isCancelled && order.void_approved_by_name && (
                    <div style={{
                      background: 'rgba(52, 211, 153, 0.08)',
                      border: '1px solid rgba(52, 211, 153, 0.25)',
                      padding: '8px 12px',
                      borderRadius: 8,
                      marginBottom: 16,
                      fontSize: 12,
                      color: '#a7f3d0'
                    }}>
                      ✅ <strong>Disetujui oleh:</strong> {order.void_approved_by_name} ({formatLocalDisplay(order.void_approved_at, true)})
                    </div>
                  )}

                  {isRejected && (
                    <div style={{
                      background: 'rgba(248, 113, 113, 0.08)',
                      border: '1px solid rgba(248, 113, 113, 0.25)',
                      padding: '8px 12px',
                      borderRadius: 8,
                      marginBottom: 16,
                      fontSize: 12,
                      color: '#fca5a5'
                    }}>
                      ❌ <strong>Ditolak oleh:</strong> {order.void_rejected_by_name} ({formatLocalDisplay(order.void_rejected_at, true)})
                      <div style={{ marginTop: 2, fontStyle: 'italic' }}>
                        Alasan penolakan: "{order.void_reject_reason || 'Permohonan ditolak oleh Manajer'}"
                      </div>
                    </div>
                  )}

                  {/* Expandable Breakdown Section */}
                  {isExpanded && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 12 }}>
                      {/* Left Column: Menu Items */}
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.2)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: 14
                      }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#ffffff', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Utensils size={14} style={{ color: 'var(--accent-bright)' }} /> Menu dalam Nota
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {(order.items || []).map((it, idx) => (
                            <div key={idx} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              paddingBottom: 6,
                              borderBottom: idx < order.items.length - 1 ? '1px dashed rgba(255, 255, 255, 0.08)' : 'none'
                            }}>
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff' }}>
                                  <span style={{ color: 'var(--accent-bright)', marginRight: 4 }}>{it.qty}x</span> {it.menu_name}
                                </div>
                                {it.modifiers && it.modifiers.length > 0 && (
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                    {it.modifiers.map((m, mIdx) => (
                                      <span key={mIdx} style={{ marginRight: 6 }}>+{m.name}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                {rupiah(it.total_price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right Column: Raw Material Impact Breakdown */}
                      <div style={{
                        background: order.void_type === 'WASTED' ? 'rgba(244, 63, 94, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                        border: `1px solid ${order.void_type === 'WASTED' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                        borderRadius: 10,
                        padding: 14
                      }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: order.void_type === 'WASTED' ? '#fb7185' : '#6ee7b7', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {order.void_type === 'WASTED' ? <Trash2 size={14} style={{ color: '#fb7185' }} /> : <Boxes size={14} style={{ color: '#34d399' }} />}
                          {order.void_type === 'WASTED'
                            ? 'Bahan Baku Tercatat Keluar (Masuk Laporan Kerugian Waste):'
                            : isCancelled
                              ? 'Bahan Baku yang Telah Dihapus dari Kartu Stok:'
                              : 'Bahan Baku yang Akan Dihapus dari Kartu Stok:'}
                        </div>

                        {(!order.ingredients_breakdown || order.ingredients_breakdown.length === 0) ? (
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
                            Tidak ada bahan baku resep atau item direct terikat pada pesanan ini.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {order.ingredients_breakdown.map((ing, iIdx) => (
                              <div
                                key={iIdx}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  background: 'rgba(0, 0, 0, 0.3)',
                                  padding: '6px 10px',
                                  borderRadius: 6,
                                  fontSize: 12
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ color: order.void_type === 'WASTED' ? '#fb7185' : '#34d399', fontWeight: 800 }}>
                                    {order.void_type === 'WASTED' ? '🗑️' : '⚡'}
                                  </span>
                                  <span style={{ color: '#ffffff', fontWeight: 600 }}>{ing.name}</span>
                                </div>
                                <span className="mono" style={{
                                  color: order.void_type === 'WASTED' ? '#fb7185' : '#34d399',
                                  fontWeight: 800,
                                  background: order.void_type === 'WASTED' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                  padding: '2px 8px',
                                  borderRadius: 4
                                }}>
                                  {formatQty(ing.qty)} {ing.unit}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 10,
                    marginTop: 16,
                    borderTop: '1px solid var(--border)',
                    paddingTop: 12,
                    flexWrap: 'wrap'
                  }}>
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setRejectModal({ open: true, order, submitting: false, reason: '' })}
                          style={{ color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.3)', fontSize: 12.5 }}
                        >
                          <XCircle size={15} style={{ marginRight: 6 }} /> Tolak Permohonan
                        </button>

                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => setApproveModal({
                            open: true,
                            order,
                            submitting: false,
                            reason: order.cancellation_reason || '',
                            voidType: order.void_type || 'WRONG_INPUT'
                          })}
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            borderColor: '#10b981',
                            fontWeight: 800,
                            fontSize: 12.5,
                            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          <CheckCircle2 size={15} style={{ marginRight: 6 }} /> Setujui Void ({order.void_type === 'WASTED' ? 'Wasted' : 'Salah Input'})
                        </button>
                      </>
                    ) : isCancelled ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setPrintModal({ open: true, order });
                        }}
                        style={{ fontSize: 12.5 }}
                      >
                        <Printer size={15} style={{ marginRight: 6 }} /> Cetak Struk Void
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================
          MODAL 1: SETUJUI VOID & EKSEKUSI
         ======================================================== */}
      {approveModal.open && approveModal.order && (
        <div className="modal-overlay" onClick={() => setApproveModal({ open: false, order: null, submitting: false, reason: '', voidType: 'WRONG_INPUT' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#34d399', flexShrink: 0
              }}>
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Konfirmasi Persetujuan Void Nota
                </h3>
                <span className="mono" style={{ fontSize: 13, color: 'var(--accent-bright)' }}>
                  #{approveModal.order.order_number} · {rupiah(approveModal.order.total_price)}
                </span>
              </div>
            </div>

            {/* Tipe Void Selector di Modal Persetujuan */}
            <div className="form-group mb-3">
              <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                Pilih / Konfirmasi Tipe Pembatalan (Void):
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div
                  onClick={() => setApproveModal(p => ({ ...p, voidType: 'WRONG_INPUT' }))}
                  style={{
                    border: `1.5px solid ${approveModal.voidType === 'WRONG_INPUT' ? '#38bdf8' : 'var(--border)'}`,
                    background: approveModal.voidType === 'WRONG_INPUT' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 12, color: approveModal.voidType === 'WRONG_INPUT' ? '#38bdf8' : '#ffffff' }}>
                    <RotateCcw size={14} /> Salah Input
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Hapus mutasi dari Kartu Stok & bersihkan HPP Laba Rugi
                  </div>
                </div>

                <div
                  onClick={() => setApproveModal(p => ({ ...p, voidType: 'WASTED' }))}
                  style={{
                    border: `1.5px solid ${approveModal.voidType === 'WASTED' ? '#f43f5e' : 'var(--border)'}`,
                    background: approveModal.voidType === 'WASTED' ? 'rgba(244, 63, 94, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 12, color: approveModal.voidType === 'WASTED' ? '#fb7185' : '#ffffff' }}>
                    <Trash2 size={14} /> Wasted (Terbuang)
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Stok tetap berkurang & masuk Laporan Waste
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              background: approveModal.voidType === 'WASTED' ? 'rgba(244, 63, 94, 0.08)' : 'rgba(16, 185, 129, 0.08)',
              border: `1px solid ${approveModal.voidType === 'WASTED' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 12.5,
              color: approveModal.voidType === 'WASTED' ? '#fca5a5' : '#a7f3d0',
              lineHeight: 1.4,
              marginBottom: 16
            }}>
              Dengan menyetujui void <strong>{approveModal.voidType === 'WASTED' ? 'Wasted (Makanan Terbuang)' : 'Salah Input'}</strong> ini:
              <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                <li>Transaksi resmi <strong>DIBATALKAN (Status: CANCELLED)</strong>.</li>
                {approveModal.voidType === 'WASTED' ? (
                  <>
                    <li>Bahan baku <strong>tetap tercatat keluar (tidak dikembalikan ke stok fisik)</strong>.</li>
                    <li>Otomatis dicatat ke <strong>Laporan Kerugian Waste</strong> dan masuk ke analisis HPP / Laba Rugi.</li>
                  </>
                ) : (
                  <>
                    <li>Seluruh riwayat mutasi bahan ({approveModal.order.ingredients_breakdown?.length || 0} bahan) akan <strong>dihapus bersih dari Kartu Stok</strong>.</li>
                    <li>HPP pada Laba Rugi dan omzet kasir dinolkan.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Ingredients Summary */}
            {approveModal.order.ingredients_breakdown && approveModal.order.ingredients_breakdown.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: 11.5 }}>
                  {approveModal.voidType === 'WASTED' ? 'Daftar Bahan Baku yang Tercatat Terbuang:' : 'Daftar Bahan Baku yang Dihapus dari Kartu Stok:'}
                </label>
                <div style={{
                  maxHeight: 130,
                  overflowY: 'auto',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}>
                  {approveModal.order.ingredients_breakdown.map((ing, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                      <span style={{ color: '#ffffff' }}>• {ing.name}</span>
                      <strong className="mono" style={{ color: approveModal.voidType === 'WASTED' ? '#fb7185' : '#34d399' }}>
                        {formatQty(ing.qty)} {ing.unit}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group mb-3">
              <label className="form-label" style={{ fontSize: 12 }}>Catatan Tambahan Manajer (Opsional):</label>
              <input
                type="text"
                className="form-control"
                placeholder={approveModal.voidType === 'WASTED' ? 'Contoh: Disetujui karena makanan rusak/gosong' : 'Contoh: Disetujui karena kasir salah input'}
                value={approveModal.reason}
                onChange={e => setApproveModal(p => ({ ...p, reason: e.target.value }))}
                style={{ fontSize: 12.5 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setApproveModal({ open: false, order: null, submitting: false, reason: '', voidType: 'WRONG_INPUT' })}
                disabled={approveModal.submitting}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmApprove}
                disabled={approveModal.submitting}
                style={{
                  flex: 1.8,
                  justifyContent: 'center',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  borderColor: '#10b981'
                }}
              >
                {approveModal.submitting ? 'Memproses Void...' : `Ya, Setujui Void (${approveModal.voidType === 'WASTED' ? 'Wasted' : 'Salah Input'})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: TOLAK PERMOHONAN VOID
         ======================================================== */}
      {rejectModal.open && rejectModal.order && (
        <div className="modal-overlay" onClick={() => setRejectModal({ open: false, order: null, submitting: false, reason: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(248, 113, 113, 0.15)',
                border: '1px solid rgba(248, 113, 113, 0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#f87171', flexShrink: 0
              }}>
                <XCircle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Tolak Permohonan Void Nota
                </h3>
                <span className="mono" style={{ fontSize: 13, color: 'var(--accent-bright)' }}>
                  #{rejectModal.order.order_number} · {rupiah(rejectModal.order.total_price)}
                </span>
              </div>
            </div>

            <div style={{
              background: 'rgba(248, 113, 113, 0.08)',
              border: '1px solid rgba(248, 113, 113, 0.25)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 12,
              color: '#fca5a5',
              lineHeight: 1.4,
              marginBottom: 14
            }}>
              Transaksi akan <strong>tetap berstatus LUNAS (PAID)</strong> dan bahan baku yang telah terpakai tidak akan dikembalikan.
            </div>

            <div className="form-group mb-3">
              <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                Alasan Penolakan <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Misal: Pesanan sudah terlanjur dimasak dan dikonsumsi oleh pelanggan..."
                value={rejectModal.reason}
                onChange={e => setRejectModal(p => ({ ...p, reason: e.target.value }))}
                style={{ fontSize: 12.5 }}
                autoFocus
                required
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRejectModal({ open: false, order: null, submitting: false, reason: '' })}
                disabled={rejectModal.submitting}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger text-white"
                onClick={handleConfirmReject}
                disabled={rejectModal.submitting || !rejectModal.reason.trim()}
                style={{
                  flex: 1.6,
                  justifyContent: 'center',
                  fontWeight: 800,
                  background: '#ef4444',
                  borderColor: '#dc2626',
                  color: '#ffffff'
                }}
              >
                {rejectModal.submitting ? 'Memproses...' : 'Konfirmasi Tolak Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: PREVIEW & CETAK STRUK VOID THERMAL
         ======================================================== */}
      {printModal.open && printModal.order && (
        <div className="modal-overlay" onClick={() => setPrintModal({ open: false, order: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: 800,
                  background: 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid rgba(244, 63, 94, 0.35)',
                  color: '#fb7185',
                  padding: '3px 8px',
                  borderRadius: 6
                }}>
                  STRUK VOID
                </span>
                <strong style={{ color: '#ffffff', fontSize: 14 }}>
                  {printModal.order.order_number}
                </strong>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setPrintModal({ open: false, order: null })}
              >
                <X size={18} />
              </button>
            </div>

            {/* Thermal Print Area */}
            <div id="printable-void-thermal-receipt" className="thermal-receipt-preview" style={{
              background: '#fff',
              color: '#000',
              padding: '16px 14px',
              borderRadius: 8,
              fontFamily: 'monospace',
              fontSize: 11,
              lineHeight: 1.35,
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
              border: '2px solid #ef4444'
            }}>
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: '0.05em' }}>
                  MOVA POS
                </div>
                <div style={{ fontSize: 9.5, opacity: 0.8 }}>
                  Outlet: {printModal.order.outlet_name || 'Cabang Utama'}
                </div>
                <div style={{
                  margin: '8px 0 4px',
                  padding: '4px 6px',
                  border: '2px dashed #000',
                  fontWeight: 900,
                  fontSize: 12,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}>
                  *** NOTA DIBATALKAN (VOID) ***
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#b91c1c' }}>
                  {printModal.order.void_type === 'WASTED'
                    ? 'TIPE: WASTED (MAKANAN TERBUANG / STOK KELUAR)'
                    : 'TIPE: SALAH INPUT (DIHAPUS DARI KARTU STOK)'}
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              <div style={{ fontSize: 10.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>No. Nota:</span>
                  <strong>{printModal.order.order_number}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tgl Order:</span>
                  <span>{printModal.order.date || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Disetujui Oleh:</span>
                  <strong>{printModal.order.void_approved_by_name || currentUser?.name || 'Manajer'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Pemohon Void:</span>
                  <span>{printModal.order.void_requested_by_name || 'Kasir'}</span>
                </div>
                {printModal.order.customer_name && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Pelanggan:</span>
                    <span>{printModal.order.customer_name}</span>
                  </div>
                )}
                {printModal.order.table_number && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Meja:</span>
                    <span>Meja {printModal.order.table_number}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Metode Bayar:</span>
                  <span>{printModal.order.payment_method || 'CASH'}</span>
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              <div style={{
                background: '#f4f4f4',
                border: '1px solid #000',
                padding: '4px 6px',
                margin: '4px 0',
                fontSize: 10
              }}>
                <strong>ALASAN VOID:</strong>
                <div style={{ marginTop: 2, fontStyle: 'italic' }}>
                  "{printModal.order.cancellation_reason || 'Pembatalan disetujui Manajer'}"
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              {/* Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(printModal.order.items || []).map((it, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
                      <span><strong>{it.qty}x</strong> {it.menu_name}</span>
                      <span style={{ textDecoration: 'line-through' }}>{rupiah(it.total_price)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              <div style={{ fontSize: 10.5, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 900,
                  fontSize: 12,
                  paddingTop: 2
                }}>
                  <span>TOTAL VOID:</span>
                  <span style={{ textDecoration: 'line-through' }}>{rupiah(printModal.order.total_price)}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 900,
                  fontSize: 11,
                  color: '#b91c1c'
                }}>
                  <span>REFUND ({printModal.order.payment_method || 'TUNAI'}):</span>
                  <span>{rupiah(printModal.order.total_price)}</span>
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

              <div style={{ textAlign: 'center', fontSize: 9, lineHeight: 1.3, opacity: 0.9 }}>
                <div>* DOKUMEN BUKTI SAH VOID TRANSAKSI *</div>
                <div>
                  {printModal.order.void_type === 'WASTED'
                    ? 'Bahan tetap tercatat keluar dan dicatat ke Laporan Waste.'
                    : 'Riwayat mutasi bahan telah dihapus bersih dari Kartu Stok.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setPrintModal({ open: false, order: null })}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Tutup
              </button>
              <button
                className="btn btn-danger text-white"
                onClick={() => doPrintVoidReceipt(printModal.order)}
                style={{ flex: 1.2, justifyContent: 'center', fontWeight: 800, background: '#ef4444', borderColor: '#dc2626', color: '#ffffff' }}
              >
                <Printer size={15} style={{ marginRight: 6, color: '#ffffff' }} /> Cetak Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
