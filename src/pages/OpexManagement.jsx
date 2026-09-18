import { useState, useEffect, useMemo } from 'react';
import {
  Receipt, Plus, Search, Filter, RefreshCw, Calendar,
  Edit3, Trash2, Store, CreditCard, Building2,
  DollarSign, FileText, CheckCircle2, TrendingUp, AlertCircle
} from 'lucide-react';
import api from '../api/client';
import { rupiah, LoadingState, PageHeader } from '../components/ui';
import { getTodayStr, getMonthStartStr, getMonthEndStr } from '../utils/date';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';

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

export default function OpexManagement() {
  const { activeOutletId, activeOutlet, outlets, isOwnerWebsite, isOwnerBisnis } = useOutlet();

  const todayStr = getTodayStr();
  const [dateFrom, setDateFrom] = useState(() => getMonthStartStr());
  const [dateTo, setDateTo] = useState(todayStr);

  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [summaryData, setSummaryData] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

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

  function applyPreset(type) {
    const now = new Date();
    if (type === 'today') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (type === '7days') {
      const past = new Date();
      past.setDate(now.getDate() - 6);
      setDateFrom(getTodayStr(past));
      setDateTo(todayStr);
    } else if (type === 'this_month') {
      setDateFrom(getMonthStartStr());
      setDateTo(todayStr);
    } else if (type === 'last_month') {
      const firstPast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastPast = new Date(now.getFullYear(), now.getMonth(), 0);
      setDateFrom(getTodayStr(firstPast));
      setDateTo(getTodayStr(lastPast));
    }
  }

  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo, activeOutletId]);

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
      };

      const [resExp, resSum] = await Promise.all([
        api.get('/expenses', { params }),
        api.get('/expenses/summary', { params }),
      ]);

      setExpenses(resExp.data || []);
      setSummaryData(resSum.data || null);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat catatan biaya operasional (OPEX)');
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
      category: item.category || 'OTHER',
      name: item.name || '',
      amount: item.amount || '',
      payment_method: item.payment_method || 'CASH',
      notes: item.notes || '',
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Nama/keterangan biaya wajib diisi!');
      return;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      toast.error('Nominal biaya harus lebih dari 0!');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date: formData.date,
        outlet_id: formData.outlet_id ? Number(formData.outlet_id) : null,
        category: formData.category,
        name: formData.name.trim(),
        amount: Number(formData.amount),
        payment_method: formData.payment_method,
        notes: formData.notes ? formData.notes.trim() : null,
      };

      if (editingId) {
        await api.put(`/expenses/${editingId}`, payload);
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
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Yakin ingin menghapus catatan biaya "${name}"?`)) return;
    try {
      await api.delete(`/expenses/${id}`);
      toast.success('Catatan biaya operasional berhasil dihapus');
      fetchData();
    } catch {
      toast.error('Gagal menghapus catatan biaya');
    }
  }

  const filteredExpenses = useMemo(() => {
    return expenses.filter(item => {
      const matchCat = categoryFilter === 'ALL' || item.category === categoryFilter;
      const matchPay = paymentFilter === 'ALL' || item.payment_method === paymentFilter;
      const matchSearch = !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.expense_no && item.expense_no.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchPay && matchSearch;
    });
  }, [expenses, categoryFilter, paymentFilter, searchQuery]);

  const totalOpexFiltered = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [filteredExpenses]);

  const topCategoryLabel = useMemo(() => {
    if (!summaryData?.by_category || summaryData.by_category.length === 0) return '-';
    return summaryData.by_category[0].label;
  }, [summaryData]);

  if (loading && !expenses.length && !summaryData) return <LoadingState />;

  return (
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* 1. Page Header & Actions */}
      <div className="flex-between mb-4 flex-wrap gap-3">
        <PageHeader
          title="Pencatatan Biaya Operasional (OPEX)"
          subtitle="Kelola dan catat pengeluaran operasional outlet: Gaji, Listrik, Air, Gas LPG, Sewa Tempat, Servis Alat, Logistik & Pemasaran."
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchData}
            title="Refresh Data"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleOpenCreateModal}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Plus size={16} /> Catat OPEX Baru
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div
          className="card"
          style={{
            padding: 16,
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Total OPEX Periode Ini
            </span>
            <div style={{ padding: 6, borderRadius: 8, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
              <Receipt size={16} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: -0.5, marginBottom: 2 }}>
            {rupiah(summaryData?.total_opex || totalOpexFiltered)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            Dari {summaryData?.total_entries || expenses.length} catatan pengeluaran
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: 16,
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Jumlah Transaksi OPEX
            </span>
            <div style={{ padding: 6, borderRadius: 8, background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
              <FileText size={16} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: -0.5, marginBottom: 2 }}>
            {filteredExpenses.length} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>nota/entri</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            Hasil filter dari {expenses.length} entri
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: 16,
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Pengeluaran Terbesar
            </span>
            <div style={{ padding: 6, borderRadius: 8, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
            {topCategoryLabel}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            Kategori biaya paling dominan
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: 16,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Cabang Operasional
            </span>
            <div style={{ padding: 6, borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
              <Store size={16} />
            </div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
            {activeOutlet?.name || 'Semua Cabang'}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            {activeOutletId === 'ALL' ? 'Konsolidasi Seluruh Outlet' : 'Filter Terisolasi Cabang'}
          </div>
        </div>
      </div>

      {/* 3. Filter Controls Bar */}
      <div
        className="card mb-4"
        style={{
          padding: '14px 18px',
          background: 'rgba(17, 22, 45, 0.75)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(165, 180, 252, 0.15)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Row 1: Date & Presets */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={15} /> Periode OPEX:
              </span>
              <input
                type="date"
                className="form-control"
                style={{ width: 'auto', fontSize: 13, padding: '5px 10px', height: 34 }}
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
              <span style={{ color: 'var(--text-muted)' }}>—</span>
              <input
                type="date"
                className="form-control"
                style={{ width: 'auto', fontSize: 13, padding: '5px 10px', height: 34 }}
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'today', label: 'Hari Ini' },
                { id: '7days', label: '7 Hari Terakhir' },
                { id: 'this_month', label: 'Bulan Ini' },
                { id: 'last_month', label: 'Bulan Lalu' },
              ].map(p => (
                <button
                  key={p.id}
                  className="btn btn-ghost btn-sm"
                  style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(255, 255, 255, 0.03)',
                  }}
                  onClick={() => applyPreset(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Search, Category & Payment Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {/* Search */}
            <div className="search-input-wrapper" style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Cari pengeluaran / No. EXP..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 34, fontSize: 13, height: 36 }}
              />
            </div>

            {/* Category Filter */}
            <select
              className="form-control"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              style={{ fontSize: 13, height: 36 }}
            >
              <option value="ALL">📁 Semua Kategori OPEX</option>
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            {/* Payment Method Filter */}
            <select
              className="form-control"
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
              style={{ fontSize: 13, height: 36 }}
            >
              <option value="ALL">💳 Semua Metode Pembayaran</option>
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Expenses Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(165, 180, 252, 0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={18} style={{ color: 'var(--accent-bright)' }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#f8fafc' }}>
              Daftar Riwayat Biaya Operasional ({filteredExpenses.length})
            </h3>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>
            Total Terfilter: {rupiah(totalOpexFiltered)}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', textAlign: 'left', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <th style={{ padding: '12px 16px' }}>No. Bukti / Tanggal</th>
                <th style={{ padding: '12px 16px' }}>Cabang Outlet</th>
                <th style={{ padding: '12px 16px' }}>Kategori OPEX</th>
                <th style={{ padding: '12px 16px' }}>Nama & Deskripsi Pengeluaran</th>
                <th style={{ padding: '12px 16px' }}>Metode Pembayaran</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Nominal (Rp)</th>
                <th style={{ padding: '12px 16px' }}>Pencatatan</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((item) => {
                  const catMeta = EXPENSE_CATEGORIES.find(c => c.value === item.category) || {
                    label: item.category_label || item.category,
                    color: '#94a3b8',
                    bg: 'rgba(148, 163, 184, 0.12)'
                  };
                  const payMeta = PAYMENT_METHODS.find(m => m.value === item.payment_method) || {
                    label: item.payment_method_label || item.payment_method || 'Kas'
                  };

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'background 0.15s',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: 12.5 }}>
                          {item.expense_no || `EXP-${item.id}`}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {item.date ? item.date.slice(0, 10) : '-'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
                          {item.outlet_name || item.outlet?.name || 'Semua Cabang'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: 12,
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: catMeta.color,
                            background: catMeta.bg,
                            border: `1px solid ${catMeta.color}35`,
                          }}
                        >
                          {catMeta.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: 260 }}>
                        <div style={{ fontWeight: 700, color: '#ffffff' }}>
                          {item.name}
                        </div>
                        {item.notes && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>
                            "{item.notes}"
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 12, color: '#cbd5e1' }}>
                          💳 {payMeta.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#f87171', fontSize: 14 }}>
                        {rupiah(item.amount)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {item.user_name || item.user?.name || 'Kasir/Admin'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => handleOpenEditModal(item)}
                            title="Edit Pengeluaran Ini"
                            style={{ color: '#38bdf8' }}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => handleDelete(item.id, item.name)}
                            title="Hapus Catatan OPEX"
                            style={{ color: '#f87171' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <AlertCircle size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                    <div>Belum ada catatan biaya operasional (OPEX) pada periode / filter ini.</div>
                    <button
                      className="btn btn-primary btn-sm mt-3"
                      onClick={handleOpenCreateModal}
                      style={{ fontWeight: 700 }}
                    >
                      + Catat OPEX Pertama Sekarang
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Modal Input / Edit OPEX */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div
            className="modal-content fade-in"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 520, width: '90%', padding: 24 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid rgba(165, 180, 252, 0.15)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Receipt size={20} style={{ color: 'var(--accent-bright)' }} />
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                  {editingId ? 'Edit Catatan Biaya OPEX' : 'Catat Biaya Operasional (OPEX) Baru'}
                </h3>
              </div>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Tanggal & Cabang */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                    Tanggal Pengeluaran <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                    Cabang Outlet
                  </label>
                  {isOwnerWebsite || isOwnerBisnis ? (
                    <select
                      className="form-control"
                      value={formData.outlet_id}
                      onChange={e => setFormData({ ...formData, outlet_id: e.target.value })}
                    >
                      <option value="">🏢 Cabang Utama / Pusat</option>
                      {outlets.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="form-control"
                      disabled
                      value={activeOutlet?.name || 'Cabang Ini'}
                    />
                  )}
                </div>
              </div>

              {/* Kategori OPEX */}
              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                  Kategori Pengeluaran OPEX <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-control"
                  required
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nama Pengeluaran */}
              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                  Nama / Deskripsi Biaya <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="Contoh: Beli Gas LPG 3kg 2 Tabung, Token Listrik PLN, Gaji Kasir..."
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {/* Nominal & Metode Pembayaran */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                    Nominal Biaya (Rp) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="form-control"
                    required
                    placeholder="cth: 50000"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                    Metode Pembayaran
                  </label>
                  <select
                    className="form-control"
                    value={formData.payment_method}
                    onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Catatan Tambahan */}
              <div>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                  Catatan / Keterangan (Opsional)
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Tuliskan nomor nota, nama toko penyedia, atau rincian tambahan jika ada..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ fontWeight: 700, minWidth: 120 }}
                >
                  {saving ? 'Saving...' : editingId ? 'Simpan Perubahan' : 'Catat OPEX'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
