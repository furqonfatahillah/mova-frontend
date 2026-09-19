import { useState, useEffect, useMemo } from 'react';
import {
  Wallet, PlusCircle, Search, Filter, RefreshCw, Eye,
  Printer, FileSpreadsheet, MessageCircle, AlertCircle,
  Calendar, CheckCircle2, AlertOctagon, Clock, DollarSign,
  ChevronRight, X, User, Phone, MapPin, CreditCard,
  Trash2, Edit3, ArrowRight, ShieldAlert, Receipt, Send, Check
} from 'lucide-react';
import api from '../api/client';
import {
  num, rupiah, pct, StatusPill, LoadingState,
  PageHeader, MiniCard, formatDateTime
} from '../components/ui';
import { getTodayStr, getMonthStartStr, getMonthEndStr } from '../utils/date';
import { useOutlet } from '../context/OutletContext';
import { exportReceivablesToExcel } from '../utils/exportReport';
import { printElement } from '../utils/print';
import toast from 'react-hot-toast';

export default function Receivables() {
  const {
    activeOutletId,
    activeOutlet,
    outlets,
    canSwitchOutlet,
    currentBusiness,
    currentUser,
  } = useOutlet();

  const businessName = currentBusiness?.name || currentUser?.business?.name || 'MOVA POS F&B Management';
  const outletName = (activeOutlet && activeOutletId !== 'ALL' && activeOutletId !== 'all') ? activeOutlet.name : 'Semua Cabang (Konsolidasi)';

  const [selectedOutletId, setSelectedOutletId] = useState(() => {
    if (!canSwitchOutlet) {
      return String(currentUser?.outlet_id || activeOutletId || '');
    }
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      return String(activeOutletId);
    }
    return '';
  });

  const targetOutlet = useMemo(() => {
    if (!canSwitchOutlet) {
      return Number(currentUser?.outlet_id || activeOutletId || outlets?.[0]?.id || 1);
    }
    if (selectedOutletId && selectedOutletId !== 'ALL' && selectedOutletId !== 'all') {
      return Number(selectedOutletId);
    }
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      return Number(activeOutletId);
    }
    return undefined;
  }, [selectedOutletId, activeOutletId, outlets, canSwitchOutlet, currentUser?.outlet_id]);

  // Main Data States
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    total_receivables: 0,
    total_remaining: 0,
    total_paid: 0,
    total_overdue: 0,
    count_overdue: 0,
    paid_this_month: 0,
    count_unpaid: 0,
    count_partial: 0,
    count_paid: 0,
    total_customers: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE'
  const [dueFilter, setDueFilter] = useState('ALL'); // 'ALL' | 'OVERDUE' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH'

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [payModal, setPayModal] = useState({ open: false, item: null, amount: '', payment_date: getTodayStr(), payment_method: 'TRANSFER', reference_no: '', notes: '' });
  const [historyModal, setHistoryModal] = useState({ open: false, item: null });
  const [invoiceModal, setInvoiceModal] = useState({ open: false, item: null });

  // Form State for New / Edit Receivable
  const [form, setForm] = useState({
    id: null,
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    issue_date: getTodayStr(),
    due_date: getTodayStr(),
    total_amount: '',
    initial_paid: '',
    payment_method: 'TRANSFER',
    reference_no: '',
    notes: '',
    outlet_id: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [targetOutlet, statusFilter, dueFilter]);

  async function fetchData() {
    setLoading(true);
    try {
      const params = {
        outlet_id: targetOutlet,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        due_filter: dueFilter !== 'ALL' ? dueFilter : undefined,
      };
      const res = await api.get('/receivables', { params });
      setItems(res.data?.data || []);
      setStats(res.data?.stats || {});
    } catch (err) {
      console.error('Error fetching receivables:', err);
      toast.error('Gagal memuat data buku piutang');
    } finally {
      setLoading(false);
    }
  }

  // Filtered dataset for instant text search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(r => {
      return (
        r.customer_name?.toLowerCase().includes(q) ||
        r.customer_phone?.toLowerCase().includes(q) ||
        r.receivable_no?.toLowerCase().includes(q) ||
        r.order_number?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery]);

  // Handle Create / Edit Submit
  async function handleSaveReceivable(e) {
    e.preventDefault();
    if (!form.customer_name.trim()) {
      toast.error('Nama pelanggan wajib diisi');
      return;
    }
    if (!form.total_amount || Number(form.total_amount) <= 0) {
      toast.error('Total nominal piutang harus lebih dari 0');
      return;
    }
    if (!form.due_date) {
      toast.error('Tanggal jatuh tempo wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      if (form.id) {
        await api.put(`/receivables/${form.id}`, {
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_address: form.customer_address,
          due_date: form.due_date,
          notes: form.notes,
        });
        toast.success('Data piutang berhasil diperbarui');
      } else {
        await api.post('/receivables', {
          outlet_id: form.outlet_id || targetOutlet || outlets?.[0]?.id || 1,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_address: form.customer_address,
          issue_date: form.issue_date,
          due_date: form.due_date,
          total_amount: Number(form.total_amount),
          initial_paid: form.initial_paid ? Number(form.initial_paid) : 0,
          payment_method: form.payment_method,
          reference_no: form.reference_no,
          notes: form.notes,
        });
        toast.success('Tagihan piutang baru berhasil dicatat');
      }
      setCreateModalOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gagal menyimpan tagihan piutang');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm({
      id: null,
      customer_name: '',
      customer_phone: '',
      customer_address: '',
      issue_date: getTodayStr(),
      due_date: getTodayStr(),
      total_amount: '',
      initial_paid: '',
      payment_method: 'TRANSFER',
      reference_no: '',
      notes: '',
      outlet_id: targetOutlet || '',
    });
  }

  function openEditModal(item) {
    setForm({
      id: item.id,
      customer_name: item.customer_name || '',
      customer_phone: item.customer_phone || '',
      customer_address: item.customer_address || '',
      issue_date: item.issue_date || getTodayStr(),
      due_date: item.due_date || getTodayStr(),
      total_amount: String(item.total_amount || ''),
      initial_paid: '',
      payment_method: 'TRANSFER',
      reference_no: '',
      notes: item.notes || '',
      outlet_id: item.outlet_id || '',
    });
    setCreateModalOpen(true);
  }

  // Handle Payment Submit
  async function handleAddPayment(e) {
    e.preventDefault();
    if (!payModal.item) return;
    const amountNum = Number(payModal.amount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Nominal pembayaran harus lebih dari 0');
      return;
    }
    if (amountNum > payModal.item.remaining_amount) {
      toast.error(`Nominal pembayaran melebihi sisa piutang (${rupiah(payModal.item.remaining_amount)})`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/receivables/${payModal.item.id}/payments`, {
        amount: amountNum,
        payment_date: payModal.payment_date,
        payment_method: payModal.payment_method,
        reference_no: payModal.reference_no,
        notes: payModal.notes,
      });
      toast.success(`Pembayaran ${rupiah(amountNum)} berhasil dicatat!`);
      setPayModal({ open: false, item: null, amount: '', payment_date: getTodayStr(), payment_method: 'TRANSFER', reference_no: '', notes: '' });
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gagal mencatat pembayaran');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Delete Receivable
  async function handleDelete(item) {
    if (!window.confirm(`Yakin ingin menghapus tagihan piutang ${item.receivable_no} (${item.customer_name})?`)) {
      return;
    }
    try {
      await api.delete(`/receivables/${item.id}`);
      toast.success('Data piutang berhasil dihapus');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus piutang');
    }
  }

  // Handle Delete Payment
  async function handleDeletePayment(receivableId, paymentId) {
    if (!window.confirm('Yakin ingin membatalkan dan menghapus catatan pembayaran ini?')) {
      return;
    }
    try {
      const res = await api.delete(`/receivables/${receivableId}/payments/${paymentId}`);
      toast.success('Pembayaran dibatalkan, sisa piutang disesuaikan');
      setHistoryModal(prev => ({
        ...prev,
        item: res.data,
      }));
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Gagal membatalkan pembayaran');
    }
  }

  // WhatsApp Reminder Generator
  function openWhatsApp(item) {
    if (!item.customer_phone) {
      toast.error('Nomor telepon/WhatsApp pelanggan tidak terdaftar');
      return;
    }
    // Clean phone number (replace 08xx with 628xx)
    let phone = item.customer_phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.slice(1);
    }

    const message = `Halo Kak ${item.customer_name},\n\nKami dari *${businessName}* (${item.outlet_name || 'Outlet'}).\n\nMengingatkan perihal tagihan pesanan dengan rincian berikut:\n• *No. Invoice*: ${item.receivable_no}\n• *Total Tagihan*: ${rupiah(item.total_amount)}\n• *Sudah Dibayar*: ${rupiah(item.paid_amount)}\n• *Sisa Tagihan*: *${rupiah(item.remaining_amount)}*\n• *Jatuh Tempo*: ${item.due_date}\n${item.notes ? `• *Keterangan*: ${item.notes}\n` : ''}\nMohon konfirmasi pembayaran atau bukti transfer jika telah melakukan pelunasan.\n\nTerima kasih banyak atas kerjasamanya! 🙏`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  // Export to Excel
  async function handleExportExcel() {
    try {
      const fname = await exportReceivablesToExcel({
        items: filteredItems,
        stats,
        outletName,
        businessName,
        userName: currentUser?.name || 'Administrator',
      });
      toast.success(`Buku Piutang berhasil diekspor: ${fname}`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengekspor data piutang ke Excel');
    }
  }

  // Print Invoice / Letter
  function handlePrintInvoice() {
    printElement(
      'printable-invoice-document',
      `Invoice Tagihan - ${invoiceModal.item?.receivable_no || 'Piutang'}`,
      { orientation: 'portrait', margin: '10mm 10mm' }
    );
  }

  if (loading && items.length === 0) return <LoadingState />;

  return (
    <div className="fade-in" style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <div className="flex-between mb-6" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <PageHeader
          title="Buku Piutang Usaha (Accounts Receivable)"
          subtitle="Manajemen penagihan piutang pelanggan, katering & instansi, kontrol jatuh tempo, dan riwayat cicilan pelunasan."
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {canSwitchOutlet && outlets && outlets.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                className="form-control"
                style={{ width: 'auto', minWidth: '180px', fontWeight: 600 }}
                value={selectedOutletId}
                onChange={e => setSelectedOutletId(e.target.value)}
              >
                <option value="ALL">Semua Cabang (Konsolidasi)</option>
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchData}
            title="Segarkan Data"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportExcel}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981' }}
          >
            <FileSpreadsheet size={14} /> Excel
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => { resetForm(); setCreateModalOpen(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <PlusCircle size={15} /> + Tagihan Piutang Baru
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid-4 mb-6">
        <MiniCard
          label="Total Sisa Piutang Berjalan"
          value={rupiah(stats.total_remaining)}
          sub={`Dari total ${rupiah(stats.total_receivables)} tagihan`}
          icon={<Wallet size={20} color="var(--primary)" />}
        />
        <MiniCard
          label="Piutang Lewat Jatuh Tempo"
          value={rupiah(stats.total_overdue)}
          sub={`${stats.count_overdue} tagihan butuh penagihan segera`}
          icon={<AlertOctagon size={20} color={stats.count_overdue > 0 ? '#ef4444' : 'var(--ok)'} />}
        />
        <MiniCard
          label="Pelunasan Diterima Bulan Ini"
          value={rupiah(stats.paid_this_month)}
          sub={`Total akumulasi lunas: ${rupiah(stats.total_paid)}`}
          icon={<CheckCircle2 size={20} color="var(--ok)" />}
        />
        <MiniCard
          label="Total Debitur / Pelanggan"
          value={`${stats.total_customers || 0} Pelanggan`}
          sub={`${stats.count_unpaid} Belum Bayar · ${stats.count_partial} Cicil · ${stats.count_paid} Lunas`}
          icon={<User size={20} color="#60a5fa" />}
        />
      </div>

      {/* Filter & Search Bar */}
      <div className="card mb-5" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Cari nama pelanggan, nomor HP, invoice, atau catatan..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', padding: '4px 0', fontSize: '13px' }}
            />
          </div>

          {/* Filter Dropdowns */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status:</span>
              <select
                className="form-control form-control-sm"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ width: 'auto', fontSize: '12px' }}
              >
                <option value="ALL">Semua Status</option>
                <option value="UNPAID">Belum Dibayar (UNPAID)</option>
                <option value="PARTIAL">Cicilan / Sebagian (PARTIAL)</option>
                <option value="PAID">Sudah Lunas (PAID)</option>
                <option value="OVERDUE">Jatuh Tempo (OVERDUE)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Jatuh Tempo:</span>
              <select
                className="form-control form-control-sm"
                value={dueFilter}
                onChange={e => setDueFilter(e.target.value)}
                style={{ width: 'auto', fontSize: '12px' }}
              >
                <option value="ALL">Semua Periode</option>
                <option value="OVERDUE">🚨 Sudah Lewat Jatuh Tempo</option>
                <option value="TODAY">⚡ Jatuh Tempo Hari Ini</option>
                <option value="THIS_WEEK">📅 7 Hari ke Depan</option>
                <option value="THIS_MONTH">🗓️ Bulan Ini</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>No. Tagihan & Tanggal</th>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>Pelanggan / Debitur</th>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>Jatuh Tempo</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right' }}>Total Tagihan</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right' }}>Sudah Dibayar</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right' }}>Sisa Piutang</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'center' }}>Progress</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'center' }}>Status</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-secondary)' }}>
                    <AlertCircle size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>Tidak ada data piutang yang ditemukan</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Coba ubah kata kunci pencarian atau filter status di atas</div>
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const isPaid = item.status === 'PAID';
                  const isOverdue = item.is_overdue;
                  const daysRem = item.days_remaining;
                  const pctPaid = item.progress_pct ?? (item.total_amount > 0 ? Math.round((item.paid_amount / item.total_amount) * 100) : 0);

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: isOverdue ? 'rgba(239, 68, 68, 0.03)' : undefined,
                        transition: 'background 0.2s ease'
                      }}
                    >
                      {/* Invoice & Date */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{item.receivable_no}</span>
                        </div>
                        <div className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Terbit: {item.issue_date}
                        </div>
                        {item.outlet_name && (
                          <div style={{ fontSize: '10.5px', color: 'var(--primary)', marginTop: '2px' }}>
                            📍 {item.outlet_name}
                          </div>
                        )}
                      </td>

                      {/* Customer Info */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '13.5px' }}>
                          {item.customer_name}
                        </div>
                        {item.customer_phone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#38bdf8', marginTop: '2px' }}>
                            <Phone size={12} />
                            <span>{item.customer_phone}</span>
                            <button
                              onClick={() => openWhatsApp(item)}
                              title="Kirim Pesan WhatsApp"
                              style={{
                                background: 'rgba(34, 197, 94, 0.15)',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                color: '#4ade80',
                                borderRadius: '4px',
                                padding: '1px 5px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <MessageCircle size={10} /> WA
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>No HP: —</div>
                        )}
                        {item.notes && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px', fontStyle: 'italic', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            "{item.notes}"
                          </div>
                        )}
                      </td>

                      {/* Due Date & Countdown */}
                      <td style={{ padding: '14px 16px' }}>
                        <div className="mono" style={{ fontWeight: 600, color: '#ffffff' }}>
                          {item.due_date}
                        </div>
                        {isPaid ? (
                          <span style={{ fontSize: '11px', color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                            <Check size={11} /> Lunas
                          </span>
                        ) : isOverdue ? (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            color: '#ef4444',
                            background: 'rgba(239, 68, 68, 0.15)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            marginTop: '2px'
                          }}>
                            Lewat {Math.abs(daysRem)} Hari!
                          </span>
                        ) : daysRem === 0 ? (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            color: '#f59e0b',
                            background: 'rgba(245, 158, 11, 0.15)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            marginTop: '2px'
                          }}>
                            ⚡ Jatuh Tempo Hari Ini
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                            Sisa {daysRem} hari
                          </span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: '#ffffff' }}>
                        {rupiah(item.total_amount)}
                      </td>

                      {/* Paid Amount */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--ok)', fontWeight: 600 }}>
                        {rupiah(item.paid_amount)}
                      </td>

                      {/* Remaining Amount */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <span style={{
                          fontWeight: 800,
                          fontSize: '14px',
                          color: isPaid ? 'var(--ok)' : (isOverdue ? '#f87171' : '#fbbf24')
                        }}>
                          {rupiah(item.remaining_amount)}
                        </span>
                      </td>

                      {/* Progress Bar */}
                      <td style={{ padding: '14px 16px', textAlign: 'center', minWidth: '100px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                          <div style={{
                            width: '60px',
                            height: '6px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '3px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${Math.min(pctPaid, 100)}%`,
                              height: '100%',
                              background: isPaid ? '#10b981' : (pctPaid > 0 ? '#38bdf8' : 'transparent'),
                              borderRadius: '3px'
                            }} />
                          </div>
                          <span className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {pctPaid}%
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {isPaid ? (
                          <span className="pill pill-ok mono">LUNAS</span>
                        ) : isOverdue ? (
                          <span className="pill pill-danger mono">JATUH TEMPO</span>
                        ) : item.status === 'PARTIAL' ? (
                          <span className="pill pill-warn mono">SEBAGIAN</span>
                        ) : (
                          <span className="pill pill-muted mono">BELUM BAYAR</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          {!isPaid && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setPayModal({ open: true, item, amount: String(item.remaining_amount), payment_date: getTodayStr(), payment_method: 'TRANSFER', reference_no: '', notes: '' })}
                              style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title="Catat Pembayaran / Cicilan"
                            >
                              <CreditCard size={12} /> Bayar
                            </button>
                          )}

                          <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => setHistoryModal({ open: true, item })}
                            style={{ padding: '5px', height: '28px', width: '28px' }}
                            title="Riwayat Pembayaran & Cicilan"
                          >
                            <Receipt size={13} />
                          </button>

                          <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => setInvoiceModal({ open: true, item })}
                            style={{ padding: '5px', height: '28px', width: '28px' }}
                            title="Cetak Dokumen Invoice Tagihan"
                          >
                            <Printer size={13} />
                          </button>

                          <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => openEditModal(item)}
                            style={{ padding: '5px', height: '28px', width: '28px' }}
                            title="Edit Data Piutang"
                          >
                            <Edit3 size={13} />
                          </button>

                          <button
                            className="btn btn-danger btn-icon"
                            onClick={() => handleDelete(item)}
                            style={{ padding: '5px', height: '28px', width: '28px' }}
                            title="Hapus Piutang"
                          >
                            <Trash2 size={13} />
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

      {/* ========================================================================= */}
      {/* MODAL 1: TAMBAH / EDIT PIUTANG BARU */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div className="modal-backdrop fade-in" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card modal-content" style={{
            maxWidth: '560px', width: '100%', maxHeight: '90vh',
            overflowY: 'auto', padding: '24px', borderRadius: '16px'
          }}>
            <div className="flex-between mb-4">
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={18} style={{ color: 'var(--primary)' }} />
                {form.id ? 'Edit Data Tagihan Piutang' : 'Catat Tagihan Piutang Baru'}
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setCreateModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveReceivable}>
              <div className="grid-2 gap-3 mb-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Nama Pelanggan / Debitur <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: PT Sumber Rezeki / Ibu Maya"
                    value={form.customer_name}
                    onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    No. WhatsApp / HP
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="0812xxxxxxxx"
                    value={form.customer_phone}
                    onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Alamat / Instansi Pelanggan
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Alamat kantor / tempat pengiriman pesanan (opsional)"
                  value={form.customer_address}
                  onChange={e => setForm(f => ({ ...f, customer_address: e.target.value }))}
                />
              </div>

              <div className="grid-2 gap-3 mb-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Tanggal Terbit Tagihan <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control mono"
                    value={form.issue_date}
                    onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Tanggal Jatuh Tempo <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control mono"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid-2 gap-3 mb-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Total Nominal Tagihan (Rp) <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="form-control mono"
                    placeholder="0"
                    value={form.total_amount}
                    onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                    disabled={Boolean(form.id)}
                    required
                  />
                </div>

                {!form.id && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                      Uang Muka / Bayar Awal (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="form-control mono"
                      placeholder="0 (jika ada DP)"
                      value={form.initial_paid}
                      onChange={e => setForm(f => ({ ...f, initial_paid: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              {!form.id && Number(form.initial_paid) > 0 && (
                <div className="grid-2 gap-3 mb-3" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11.5px' }}>Metode Bayar DP</label>
                    <select
                      className="form-control form-control-sm"
                      value={form.payment_method}
                      onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                    >
                      <option value="TRANSFER">Transfer Bank</option>
                      <option value="CASH">Tunai (Cash)</option>
                      <option value="QRIS">QRIS</option>
                      <option value="DEBIT">Kartu Debit</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11.5px' }}>No. Ref / Bukti Transfer DP</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Nomor referensi (opsional)"
                      value={form.reference_no}
                      onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="form-group mb-4">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Catatan / Rincian Menu & Pesanan
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Contoh: Paket Katering Nasi Kotak 50 Pax untuk Acara Seminar Gedung B..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ minWidth: '120px' }}
                >
                  {submitting ? 'Menyimpan...' : (form.id ? 'Simpan Perubahan' : 'Terbitkan Piutang')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CATAT PEMBAYARAN / CICILAN ANGSURAN */}
      {/* ========================================================================= */}
      {payModal.open && payModal.item && (
        <div className="modal-backdrop fade-in" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card modal-content" style={{
            maxWidth: '480px', width: '100%', padding: '24px', borderRadius: '16px'
          }}>
            <div className="flex-between mb-3">
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} style={{ color: 'var(--ok)' }} />
                Catat Pembayaran / Cicilan Piutang
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setPayModal({ open: false, item: null })}>
                <X size={16} />
              </button>
            </div>

            {/* Target Item Summary */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '16px',
              fontSize: '12.5px'
            }}>
              <div className="flex-between">
                <span style={{ color: 'var(--text-secondary)' }}>Pelanggan:</span>
                <strong style={{ color: '#ffffff' }}>{payModal.item.customer_name}</strong>
              </div>
              <div className="flex-between" style={{ marginTop: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>No. Invoice:</span>
                <span className="mono" style={{ color: '#ffffff' }}>{payModal.item.receivable_no}</span>
              </div>
              <div className="flex-between" style={{ marginTop: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Tagihan Awal:</span>
                <span style={{ color: '#ffffff' }}>{rupiah(payModal.item.total_amount)}</span>
              </div>
              <div className="flex-between" style={{ marginTop: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Sudah Terbayar:</span>
                <span style={{ color: 'var(--ok)' }}>{rupiah(payModal.item.paid_amount)}</span>
              </div>
              <div className="flex-between" style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                <span style={{ fontWeight: 700, color: '#ffffff' }}>Sisa yang Harus Dibayar:</span>
                <strong className="mono" style={{ color: '#fbbf24', fontSize: '15px' }}>{rupiah(payModal.item.remaining_amount)}</strong>
              </div>
            </div>

            <form onSubmit={handleAddPayment}>
              <div className="form-group mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Nominal Pembayaran (Rp) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={payModal.item.remaining_amount}
                  className="form-control mono"
                  placeholder="Masukkan nominal bayar..."
                  value={payModal.amount}
                  onChange={e => setPayModal(p => ({ ...p, amount: e.target.value }))}
                  required
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                    onClick={() => setPayModal(p => ({ ...p, amount: String(payModal.item.remaining_amount) }))}
                  >
                    Bayar Lunas ({rupiah(payModal.item.remaining_amount)})
                  </button>
                  {payModal.item.remaining_amount > 200000 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      onClick={() => setPayModal(p => ({ ...p, amount: String(Math.round(payModal.item.remaining_amount / 2)) }))}
                    >
                      50% ({rupiah(Math.round(payModal.item.remaining_amount / 2))})
                    </button>
                  )}
                </div>
              </div>

              <div className="grid-2 gap-3 mb-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Tanggal Bayar <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control mono"
                    value={payModal.payment_date}
                    onChange={e => setPayModal(p => ({ ...p, payment_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Metode Pembayaran
                  </label>
                  <select
                    className="form-control"
                    value={payModal.payment_method}
                    onChange={e => setPayModal(p => ({ ...p, payment_method: e.target.value }))}
                  >
                    <option value="TRANSFER">Transfer Bank</option>
                    <option value="CASH">Tunai (Cash)</option>
                    <option value="QRIS">QRIS</option>
                    <option value="DEBIT">Kartu Debit</option>
                  </select>
                </div>
              </div>

              <div className="form-group mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  No. Referensi / Bukti Transfer
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: BCA-8839210291 (opsional)"
                  value={payModal.reference_no}
                  onChange={e => setPayModal(p => ({ ...p, reference_no: e.target.value }))}
                />
              </div>

              <div className="form-group mb-4">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Catatan Pembayaran
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Catatan pelunasan / angsuran ke-X..."
                  value={payModal.notes}
                  onChange={e => setPayModal(p => ({ ...p, notes: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPayModal({ open: false, item: null })}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ minWidth: '130px' }}
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RIWAYAT PEMBAYARAN & CICILAN */}
      {/* ========================================================================= */}
      {historyModal.open && historyModal.item && (
        <div className="modal-backdrop fade-in" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card modal-content" style={{
            maxWidth: '560px', width: '100%', maxHeight: '85vh',
            overflowY: 'auto', padding: '24px', borderRadius: '16px'
          }}>
            <div className="flex-between mb-4">
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Receipt size={18} style={{ color: 'var(--primary)' }} />
                  Riwayat Cicilan Pelunasan
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {historyModal.item.receivable_no} · {historyModal.item.customer_name}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setHistoryModal({ open: false, item: null })}>
                <X size={16} />
              </button>
            </div>

            {/* Summary Progress */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '16px'
            }}>
              <div className="flex-between mb-2">
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status Pelunasan:</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: historyModal.item.status === 'PAID' ? 'var(--ok)' : '#fbbf24' }}>
                  {rupiah(historyModal.item.paid_amount)} / {rupiah(historyModal.item.total_amount)}
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${historyModal.item.progress_pct}%`,
                  height: '100%',
                  background: historyModal.item.status === 'PAID' ? '#10b981' : '#38bdf8'
                }} />
              </div>
              <div className="flex-between mt-2" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span>{historyModal.item.progress_pct}% Terbayar</span>
                <span>Sisa Piutang: <strong style={{ color: '#ffffff' }}>{rupiah(historyModal.item.remaining_amount)}</strong></span>
              </div>
            </div>

            {/* Timeline of payments */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(historyModal.item.payments || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Belum ada catatan pembayaran cicilan untuk tagihan ini.
                </div>
              ) : (
                historyModal.item.payments.map((pay, idx) => (
                  <div
                    key={pay.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8'
                        }}>
                          #{idx + 1}
                        </span>
                        <strong className="mono" style={{ fontSize: '14px', color: '#10b981' }}>
                          +{rupiah(pay.amount)}
                        </strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          ({pay.payment_method})
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        📅 {pay.payment_date} · Diterima oleh: <span style={{ color: '#ffffff' }}>{pay.received_by_name}</span>
                        {pay.reference_no && ` · Ref: ${pay.reference_no}`}
                      </div>
                      {pay.notes && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                          "{pay.notes}"
                        </div>
                      )}
                    </div>

                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={() => handleDeletePayment(historyModal.item.id, pay.id)}
                      title="Batalkan & Hapus Pembayaran Ini"
                      style={{ color: '#f87171', padding: '4px' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setHistoryModal({ open: false, item: null })}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CETAK DOKUMEN INVOICE PIUTANG */}
      {/* ========================================================================= */}
      {invoiceModal.open && invoiceModal.item && (
        <div className="modal-backdrop fade-in" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card modal-content" style={{
            maxWidth: '680px', width: '100%', maxHeight: '90vh',
            overflowY: 'auto', padding: '24px', borderRadius: '16px'
          }}>
            <div className="flex-between mb-4 no-print">
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} style={{ color: 'var(--primary)' }} />
                Pratinjau Dokumen Invoice Tagihan
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary btn-sm" onClick={handlePrintInvoice}>
                  <Printer size={14} /> Cetak Dokumen
                </button>
                <button className="btn btn-ghost btn-icon" onClick={() => setInvoiceModal({ open: false, item: null })}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Printable Document Area */}
            <div id="printable-invoice-document" style={{
              background: '#ffffff',
              color: '#0f172a',
              padding: '32px',
              borderRadius: '8px',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}>
              {/* Invoice Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '20px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                    {businessName}
                  </h2>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    {invoiceModal.item.outlet_name || 'Outlet Utama'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#4f46e5', margin: 0, letterSpacing: '1px' }}>
                    INVOICE TAGIHAN
                  </h1>
                  <div className="mono" style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginTop: '4px' }}>
                    #{invoiceModal.item.receivable_no}
                  </div>
                </div>
              </div>

              {/* Billed To & Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Ditujukan Kepada (Pelanggan):
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                    {invoiceModal.item.customer_name}
                  </div>
                  {invoiceModal.item.customer_phone && (
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                      Telp / WA: {invoiceModal.item.customer_phone}
                    </div>
                  )}
                  {invoiceModal.item.customer_address && (
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                      Alamat: {invoiceModal.item.customer_address}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Tanggal Terbit:</span>
                    <strong style={{ color: '#0f172a' }}>{invoiceModal.item.issue_date}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Jatuh Tempo:</span>
                    <strong style={{ color: '#dc2626' }}>{invoiceModal.item.due_date}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <span style={{ color: '#64748b' }}>Status Pembayaran:</span>
                    <strong style={{ color: invoiceModal.item.status === 'PAID' ? '#16a34a' : '#d97706' }}>
                      {invoiceModal.item.status_label || invoiceModal.item.status}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Table of Items */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>Deskripsi Pesanan / Keterangan</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>Jumlah (IDR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>
                        Pesanan Tagihan Piutang — {invoiceModal.item.customer_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        {invoiceModal.item.notes || 'Tagihan operasional pesanan produk / katering'}
                      </div>
                    </td>
                    <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      {rupiah(invoiceModal.item.total_amount)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
                <div style={{ width: '280px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#475569' }}>
                    <span>Total Tagihan:</span>
                    <strong>{rupiah(invoiceModal.item.total_amount)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#16a34a' }}>
                    <span>Sudah Dibayar:</span>
                    <strong>{rupiah(invoiceModal.item.paid_amount)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #0f172a', marginTop: '6px', fontSize: '15px' }}>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>Sisa Pembayaran:</span>
                    <strong style={{ fontWeight: 900, color: '#dc2626' }}>{rupiah(invoiceModal.item.remaining_amount)}</strong>
                  </div>
                </div>
              </div>

              {/* Payment Instructions / Signatures */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '20px', fontSize: '12px', color: '#64748b' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Instruksi Pembayaran:</div>
                  <div>• Mohon lakukan pembayaran sebelum tanggal jatuh tempo <strong>{invoiceModal.item.due_date}</strong>.</div>
                  <div>• Pembayaran dapat ditransfer ke rekening operasional perusahaan atau via kasir cabang.</div>
                  <div>• Harap kirimkan bukti transfer setelah pembayaran dilakukan.</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div>Hormat Kami,</div>
                  <div style={{ height: '48px' }} />
                  <strong style={{ color: '#0f172a', borderTop: '1px solid #cbd5e1', paddingTop: '4px', display: 'block' }}>
                    {businessName}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
