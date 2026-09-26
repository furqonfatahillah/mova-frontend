import { useState, useEffect, useMemo } from 'react';
import {
  Users, UserPlus, UserCheck, Search, Filter, Plus, Edit2, Trash2,
  Phone, Mail, Calendar, MapPin, Award, Coins, TrendingUp, Eye,
  X, Check, RefreshCw, MessageSquare, Tag, FileText, Gift, ChevronRight,
  ExternalLink, Sparkles, AlertCircle
} from 'lucide-react';
import api from '../api/client';
import { rupiah, num, LoadingState, PageHeader, AuditInfo } from '../components/ui';
import { formatLocalDisplay } from '../utils/date';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/swal';

const emptyForm = {
  name: '',
  phone: '',
  code: '',
  email: '',
  address: '',
  birth_date: '',
  notes: '',
  total_points: 0,
  active: true,
};

export default function MasterCustomer() {
  const currentUser = JSON.parse(localStorage.getItem('pos_user') || '{}');
  const isOwnerBisnis = currentUser.role === 'owner_bisnis' || currentUser.role === 'owner' || currentUser.role === 'admin' || Boolean(currentUser.is_owner_bisnis) || currentUser.role === 'superadmin_platform' || currentUser.role === 'superadmin';

  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState({
    total_members: 0,
    active_members: 0,
    total_points: 0,
    total_spent: 0,
    total_visits: 0,
    avg_visits: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [sortBy, setSortBy] = useState('id'); // 'id' | 'total_points' | 'total_spent' | 'total_visits' | 'name'
  const [sortDir, setSortDir] = useState('desc');

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [detailOrders, setDetailOrders] = useState([]);
  const [detailRedemptions, setDetailRedemptions] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('orders'); // 'orders' | 'points'

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [sortBy, sortDir]);

  async function fetchCustomers() {
    setLoading(true);
    try {
      const res = await api.get('/customers', {
        params: {
          sort_by: sortBy,
          sort_dir: sortDir,
        },
      });
      setCustomers(res.data.customers || []);
      setSummary(res.data.summary || {});
    } catch (err) {
      toast.error('Gagal memuat data pelanggan / member.');
    } finally {
      setLoading(false);
    }
  }

  // Filtered in-memory list based on search and status
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q);

      const matchStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'ACTIVE' && c.active) ||
        (filterStatus === 'INACTIVE' && !c.active);

      return matchSearch && matchStatus;
    });
  }, [customers, searchQuery, filterStatus]);

  // Bulk Selection Helpers
  const isAllSelected = useMemo(() => {
    return filteredCustomers.length > 0 && filteredCustomers.every(c => selectedIds.includes(c.id));
  }, [filteredCustomers, selectedIds]);

  const isSomeSelected = useMemo(() => {
    return filteredCustomers.some(c => selectedIds.includes(c.id)) && !isAllSelected;
  }, [filteredCustomers, selectedIds, isAllSelected]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCustomers.map(c => c.id));
    }
  };

  const toggleSelectItem = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const confirmed = await confirmDialog({
      title: `Proses ${count} Member Terpilih?`,
      text: `Yakin ingin memproses / menghapus ${count} member terpilih secara massal? Member yang memiliki transaksi akan otomatis dinonaktifkan.`,
      confirmText: `Ya, Proses ${count} Member`,
      cancelText: 'Batal',
      isDanger: true,
    });
    if (!confirmed) return;

    setBulkDeleting(true);
    try {
      const res = await api.post('/customers/bulk-delete', { ids: selectedIds });
      toast.success(res.data.message || `${count} member berhasil diproses.`);
      setSelectedIds([]);
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus data member terpilih.');
    } finally {
      setBulkDeleting(false);
    }
  };

  function handleOpenAdd() {
    setEditingCustomer(null);
    setForm(emptyForm);
    setFormModalOpen(true);
  }

  function handleOpenEdit(cust) {
    setEditingCustomer(cust);
    setForm({
      name: cust.name || '',
      phone: cust.phone || '',
      code: cust.code || '',
      email: cust.email || '',
      address: cust.address || '',
      birth_date: cust.birth_date || '',
      notes: cust.notes || '',
      total_points: cust.total_points || 0,
      active: Boolean(cust.active),
    });
    setFormModalOpen(true);
  }

  async function handleSaveCustomer(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Nama dan Nomor HP wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      if (editingCustomer) {
        const res = await api.put(`/customers/${editingCustomer.id}`, form);
        toast.success(res.data.message || 'Data member berhasil diperbarui.');
        setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? res.data.customer : c));
      } else {
        const res = await api.post('/customers', form);
        toast.success(res.data.message || 'Member baru berhasil didaftarkan.');
        setCustomers(prev => [res.data.customer, ...prev]);
        setSummary(prev => ({
          ...prev,
          total_members: (prev.total_members || 0) + 1,
          active_members: (prev.active_members || 0) + 1,
        }));
      }
      setFormModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan data member.');
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenDetail(cust) {
    setDetailCustomer(cust);
    setDetailTab('orders');
    setDetailModalOpen(true);
    setDetailLoading(true);

    try {
      const res = await api.get(`/customers/${cust.id}`);
      setDetailCustomer(res.data.customer);
      setDetailOrders(res.data.recent_orders || []);
      setDetailRedemptions(res.data.point_redemptions || []);
    } catch (err) {
      toast.error('Gagal memuat detail riwayat member.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleDelete(cust) {
    const isDeactivation = (cust.total_visits > 0);
    const confirmed = await confirmDialog({
      title: isDeactivation ? 'Nonaktifkan Member?' : 'Hapus Member?',
      text: isDeactivation
        ? `Member "${cust.name}" sudah memiliki riwayat kunjungan. Member akan dinonaktifkan dari sistem. Lanjutkan?`
        : `Hapus member "${cust.name}" secara permanen?`,
      confirmText: isDeactivation ? 'Ya, Nonaktifkan' : 'Ya, Hapus Member',
      cancelText: 'Batal',
      isDanger: true,
    });

    if (!confirmed) return;

    try {
      const res = await api.delete(`/customers/${cust.id}`);
      toast.success(res.data.message || 'Member berhasil dihapus.');
      if (isDeactivation) {
        setCustomers(prev => prev.map(c => c.id === cust.id ? { ...c, active: false } : c));
      } else {
        setCustomers(prev => prev.filter(c => c.id !== cust.id));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus member.');
    }
  }

  return (
    <div className="page-container" style={{ paddingBottom: 60 }}>
      {/* Header */}
      <PageHeader
        title="Master Member & Loyalitas Pelanggan"
        subtitle="Kelola keanggotaan pelanggan, sistem poin otomatis (+1 poin per nota belanja), dan promo penukaran poin."
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchCustomers}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenAdd}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderColor: '#10b981',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                fontWeight: 700
              }}
            >
              <UserPlus size={16} />
              Daftar Member Baru
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
        marginBottom: 22
      }}>
        {/* Total Member */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: 14,
          padding: '16px 18px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 14
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#818cf8'
          }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Member
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>
              {num(summary.total_members || 0)} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>orang</span>
            </div>
          </div>
        </div>

        {/* Member Aktif */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 14,
          padding: '16px 18px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 14
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#34d399'
          }}>
            <UserCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Member Aktif
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#34d399', marginTop: 2 }}>
              {num(summary.active_members || 0)} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>aktif</span>
            </div>
          </div>
        </div>

        {/* Total Poin Beredar */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 14,
          padding: '16px 18px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 14
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fbbf24'
          }}>
            <Coins size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Poin Beredar
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>
              {num(summary.total_points || 0)} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>poin</span>
            </div>
          </div>
        </div>

        {/* Total Belanja Member */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
          border: '1px solid rgba(236, 72, 153, 0.25)',
          borderRadius: 14,
          padding: '16px 18px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 14
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: 'rgba(236, 72, 153, 0.15)',
            border: '1px solid rgba(236, 72, 153, 0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#f472b6'
          }}>
            <Award size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Lifetime Spending
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>
              {rupiah(summary.total_spent || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '14px 18px',
        marginBottom: 18,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12
      }}>
        {/* Left Search */}
        <div style={{ display: 'flex', flex: 1, minWidth: 260, maxWidth: 450, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Cari nama, kode member, no HP (WA), email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 36, fontSize: 13, borderRadius: 8 }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="btn btn-ghost btn-icon"
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', padding: 4 }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Right Filters & Sorting */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Filter Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Status:</span>
            <select
              className="form-control"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ fontSize: 12.5, padding: '6px 10px', minWidth: 110, borderRadius: 8 }}
            >
              <option value="ALL">Semua ({customers.length})</option>
              <option value="ACTIVE">Aktif ({summary.active_members || 0})</option>
              <option value="INACTIVE">Nonaktif</option>
            </select>
          </div>

          {/* Sort By */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Urutkan:</span>
            <select
              className="form-control"
              value={`${sortBy}-${sortDir}`}
              onChange={e => {
                const [sb, sd] = e.target.value.split('-');
                setSortBy(sb);
                setSortDir(sd);
              }}
              style={{ fontSize: 12.5, padding: '6px 10px', minWidth: 160, borderRadius: 8 }}
            >
              <option value="id-desc">Terbaru Terdaftar</option>
              <option value="total_points-desc">Poin Terbanyak</option>
              <option value="total_spent-desc">Belanja Terbanyak</option>
              <option value="total_visits-desc">Kunjungan Terbanyak</option>
              <option value="name-asc">Nama (A - Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Action Sticky Bar */}
      {selectedIds.length > 0 && (
        <div
          className="fade-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.95) 0%, rgba(23, 37, 84, 0.95) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 16px rgba(99, 102, 241, 0.25)',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="pill pill-primary" style={{ fontWeight: 800, fontSize: 13, padding: '4px 12px' }}>
              ✓ {selectedIds.length} Member Dipilih
            </span>
            <span style={{ fontSize: 12.5, color: '#e2e8f0' }}>
              Pilih member yang ingin dihapus / dinonaktifkan secara massal
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedIds([])}
              style={{ fontSize: 12 }}
            >
              Batal Pilih
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12.5, background: '#e11d48', borderColor: '#f43f5e', color: '#ffffff' }}
            >
              <Trash2 size={14} />
              {bulkDeleting ? 'Memproses...' : `Hapus / Nonaktifkan ${selectedIds.length} Member`}
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      {loading ? (
        <LoadingState text="Memuat master data member..." />
      ) : filteredCustomers.length === 0 ? (
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '48px 20px',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          <Users size={48} style={{ margin: '0 auto 14px', opacity: 0.3 }} />
          <h4 style={{ color: '#ffffff', fontWeight: 700, margin: '0 0 6px' }}>
            {searchQuery || filterStatus !== 'ALL' ? 'Tidak ada member yang cocok dengan filter' : 'Belum Ada Member Terdaftar'}
          </h4>
          <p style={{ fontSize: 13, maxWidth: 400, margin: '0 auto 18px', color: 'var(--text-secondary)' }}>
            {searchQuery || filterStatus !== 'ALL'
              ? 'Coba ganti kata kunci pencarian atau ubah filter status di atas.'
              : 'Daftarkan pelanggan pertama Anda untuk mulai mengumpulkan poin dan memberikan promo loyalitas!'}
          </p>
          {(!searchQuery && filterStatus === 'ALL') && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenAdd}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={15} /> Daftarkan Member Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="table-responsive" style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)'
        }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ width: 40, textAlign: 'center', padding: '12px 8px' }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={el => { if (el) el.indeterminate = isSomeSelected; }}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--primary)' }}
                    title={isAllSelected ? 'Batalkan pilih semua' : 'Pilih semua'}
                  />
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Member</th>
                <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Kontak (WA / Email)</th>
                <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'center' }}>Saldo Poin</th>
                <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Kunjungan & Belanja</th>
                <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Tgl Daftar</th>
                <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(cust => {
                const waClean = cust.phone.replace(/[^0-9]/g, '');
                const waFormatted = waClean.startsWith('0') ? '62' + waClean.slice(1) : waClean;
                const isSelected = selectedIds.includes(cust.id);

                return (
                  <tr
                    key={cust.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'background 0.2s',
                      background: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined,
                    }}
                    className="table-row-hover"
                  >
                    <td style={{ textAlign: 'center', padding: '14px 8px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectItem(cust.id)}
                        style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--primary)' }}
                      />
                    </td>
                    {/* Member Info */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: '50%',
                          background: cust.active ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${cust.active ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: cust.active ? '#c084fc' : 'var(--text-muted)',
                          fontWeight: 800, fontSize: 14
                        }}>
                          {cust.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <strong style={{ color: '#ffffff', fontSize: 13.5 }}>{cust.name}</strong>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <span className="mono" style={{
                              fontSize: 10.5,
                              background: 'rgba(99, 102, 241, 0.12)',
                              color: '#a5b4fc',
                              border: '1px solid rgba(99, 102, 241, 0.25)',
                              padding: '1px 6px',
                              borderRadius: 4,
                              fontWeight: 700
                            }}>
                              {cust.code || `MBR-${String(cust.id).padStart(4, '0')}`}
                            </span>
                            {cust.notes && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                · {cust.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contact (Phone & Email) */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <a
                          href={`https://wa.me/${waFormatted}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 12.5,
                            color: '#34d399',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            textDecoration: 'none'
                          }}
                          title="Klik untuk kirim pesan WhatsApp"
                        >
                          <Phone size={12} />
                          {cust.phone}
                          <ExternalLink size={10} style={{ opacity: 0.6 }} />
                        </a>
                        {cust.email && (
                          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Mail size={11} /> {cust.email}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Points Balance */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.1) 100%)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        color: '#fbbf24',
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontWeight: 800,
                        fontSize: 13.5
                      }}>
                        <Coins size={14} />
                        <span>{num(cust.total_points || 0)}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.8 }}>poin</span>
                      </div>
                    </td>

                    {/* Visits & Spent */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 700, color: '#ffffff', fontSize: 13 }}>
                          {rupiah(cust.total_spent || 0)}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {num(cust.total_visits || 0)} kali transaksi
                        </span>
                      </div>
                    </td>

                    {/* Join Date */}
                    <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {cust.joined_at ? formatLocalDisplay(cust.joined_at) : (cust.created_at ? formatLocalDisplay(cust.created_at.substring(0, 10)) : '-')}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        background: cust.active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                        color: cust.active ? '#34d399' : '#fb7185',
                        border: `1px solid ${cust.active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`
                      }}>
                        {cust.active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon btn-sm"
                          onClick={() => handleOpenDetail(cust)}
                          title="Lihat Riwayat Transaksi & Poin"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon btn-sm"
                          onClick={() => handleOpenEdit(cust)}
                          title="Edit Data Member"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon btn-sm"
                          onClick={() => handleDelete(cust)}
                          title={cust.total_visits > 0 ? 'Nonaktifkan Member' : 'Hapus Member'}
                          style={{ color: 'var(--danger)' }}
                        >
                          <Trash2 size={14} />
                        </button>
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
          MODAL: TAMBAH & EDIT MEMBER
         ======================================================== */}
      {formModalOpen && (
        <div className="modal-overlay" onClick={() => setFormModalOpen(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#34d399'
                }}>
                  {editingCustomer ? <Edit2 size={18} /> : <UserPlus size={18} />}
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    {editingCustomer ? 'Edit Data Member' : 'Pendaftaran Member Baru'}
                  </h3>
                  <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    {editingCustomer ? `Ubah informasi profil ${editingCustomer.name}` : 'Pelanggan terdaftar otomatis mendapat +1 poin per transaksi'}
                  </span>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setFormModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveCustomer}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Name */}
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Nama Lengkap <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="Contoh: Budi Santoso"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                {/* Phone (WA) & Code Member (Auto-Generated) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      Nomor HP / WhatsApp <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      placeholder="Contoh: 081234567890"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      Kode Member
                    </label>
                    <div style={{
                      height: 38,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 12px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px dashed rgba(99, 102, 241, 0.4)',
                      color: editingCustomer ? '#a5b4fc' : '#34d399',
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: 'monospace'
                    }}>
                      {editingCustomer ? (form.code || 'MBR-XXXX') : 'Otomatis Sistem (MBR-XXXX)'}
                    </div>
                  </div>
                </div>

                {/* Email & Birth Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      Email (Opsional)
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="budi@gmail.com"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      Tanggal Lahir (Opsional)
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.birth_date}
                      onChange={e => setForm({ ...form, birth_date: e.target.value })}
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Alamat Domisili (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    className="form-control"
                    placeholder="Alamat lengkap pelanggan..."
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                  />
                </div>

                {/* Points Adjustment (Only for Owner Bisnis on Edit) */}
                {editingCustomer && isOwnerBisnis && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: 10,
                    padding: 12
                  }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Coins size={14} /> Koreksi Saldo Poin (Owner Bisnis Only)
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="form-control mono"
                      value={form.total_points}
                      onChange={e => setForm({ ...form, total_points: Number(e.target.value) || 0 })}
                    />
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                      Ubah hanya jika terjadi kompensasi atau penyesuaian saldo poin member.
                    </span>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Catatan Khusus (Preferensi Rasa / Alergi / VIP)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Suka kopi less sugar, pelanggan tetap sore hari"
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                  />
                </div>

                {/* Active Toggle */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)'
                }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#ffffff' }}>Status Member Aktif</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)' }}>
                      Member aktif dapat mengumpulkan poin dan menukar promo di POS
                    </span>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={e => setForm({ ...form, active: e.target.checked })}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 20,
                borderTop: '1px solid var(--border)',
                paddingTop: 14
              }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFormModalOpen(false)}
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderColor: '#10b981',
                    fontWeight: 700
                  }}
                >
                  {saving ? 'Menyimpan...' : (editingCustomer ? 'Simpan Perubahan' : 'Daftarkan Member')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: DETAIL MEMBER & RIWAYAT (ORDERS & REDEMPTIONS)
         ======================================================== */}
      {detailModalOpen && detailCustomer && (
        <div className="modal-overlay" onClick={() => setDetailModalOpen(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 720, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
          >
            {/* Header Profile */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '1px solid var(--border)',
              paddingBottom: 14,
              marginBottom: 14
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 14,
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#ffffff', fontWeight: 800, fontSize: 20,
                  boxShadow: '0 6px 20px rgba(168, 85, 247, 0.35)'
                }}>
                  {detailCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                      {detailCustomer.name}
                    </h3>
                    <span className="mono" style={{
                      fontSize: 11, background: 'rgba(99, 102, 241, 0.15)',
                      color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)',
                      padding: '2px 8px', borderRadius: 4, fontWeight: 700
                    }}>
                      {detailCustomer.code}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span><Phone size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> {detailCustomer.phone}</span>
                    {detailCustomer.email && <span><Mail size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> {detailCustomer.email}</span>}
                    <span><Calendar size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Gabung: {formatLocalDisplay(detailCustomer.joined_at || detailCustomer.created_at?.substring(0, 10))}</span>
                  </div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setDetailModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              marginBottom: 16
            }}>
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 10,
                padding: '10px 14px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Saldo Poin Member</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>
                  {num(detailCustomer.total_points || 0)} <span style={{ fontSize: 11 }}>poin</span>
                </div>
              </div>

              <div style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: 10,
                padding: '10px 14px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Total Kunjungan (Nota)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#818cf8', marginTop: 2 }}>
                  {num(detailCustomer.total_visits || 0)} <span style={{ fontSize: 11 }}>kali</span>
                </div>
              </div>

              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 10,
                padding: '10px 14px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Total Belanja Lifetime</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#34d399', marginTop: 2 }}>
                  {rupiah(detailCustomer.total_spent || 0)}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex',
              gap: 8,
              borderBottom: '1px solid var(--border)',
              marginBottom: 12
            }}>
              <button
                type="button"
                className={`btn btn-sm ${detailTab === 'orders' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setDetailTab('orders')}
                style={{ borderRadius: '6px 6px 0 0', padding: '8px 14px', fontSize: 12.5 }}
              >
                <FileText size={14} style={{ marginRight: 6 }} />
                Riwayat Transaksi Belanja ({detailOrders.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${detailTab === 'points' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setDetailTab('points')}
                style={{ borderRadius: '6px 6px 0 0', padding: '8px 14px', fontSize: 12.5 }}
              >
                <Gift size={14} style={{ marginRight: 6 }} />
                Riwayat Penukaran Poin ({detailRedemptions.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
              {detailLoading ? (
                <LoadingState text="Memuat riwayat..." />
              ) : detailTab === 'orders' ? (
                detailOrders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                    <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                    <p style={{ margin: 0, fontSize: 13 }}>Belum ada riwayat transaksi belanja untuk member ini.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table" style={{ width: '100%', fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '8px 10px' }}>No. Nota</th>
                          <th style={{ padding: '8px 10px' }}>Tanggal</th>
                          <th style={{ padding: '8px 10px' }}>Metode</th>
                          <th style={{ padding: '8px 10px' }}>Promo Digunakan</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Belanja</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailOrders.map((ord, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '8px 10px' }} className="mono">{ord.order_number}</td>
                            <td style={{ padding: '8px 10px' }}>{formatLocalDisplay(ord.date)}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>
                                {ord.payment_method}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              {ord.discount_name ? (
                                <span style={{ color: '#f472b6', fontSize: 11.5 }}>
                                  {ord.discount_name} (-{rupiah(ord.total_discount)})
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>
                              {rupiah(ord.total_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                /* Redemptions Tab */
                detailRedemptions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                    <Gift size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                    <p style={{ margin: 0, fontSize: 13 }}>Belum ada riwayat penukaran poin promo oleh member ini.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {detailRedemptions.map(red => (
                      <div
                        key={red.id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          padding: '12px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: '#ffffff', fontSize: 13 }}>
                            {red.description}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {red.created_at ? formatLocalDisplay(red.created_at.substring(0, 10)) : '-'}
                            {red.order_number && ` · Nota: ${red.order_number}`}
                            {red.creator && ` · Kasir: ${red.creator.name}`}
                          </div>
                        </div>
                        <div style={{
                          background: 'rgba(244, 63, 94, 0.15)',
                          color: '#fb7185',
                          border: '1px solid rgba(244, 63, 94, 0.3)',
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontWeight: 800,
                          fontSize: 13
                        }}>
                          -{red.points_used} Poin
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Close Button */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 14,
              borderTop: '1px solid var(--border)',
              paddingTop: 12
            }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDetailModalOpen(false)}
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
