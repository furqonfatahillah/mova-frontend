import { useState, useEffect, useMemo } from 'react';
import {
  Percent, Tag, Plus, Search, Filter, Calendar, Store, Edit2, Trash2,
  CheckCircle2, AlertCircle, X, Sparkles, TrendingUp, Users, Copy,
  Check, RefreshCw, Power, ShieldAlert, Award, ArrowUpRight, Clock
} from 'lucide-react';
import api from '../api/client';
import { rupiah, num, LoadingState, PageHeader, AuditInfo } from '../components/ui';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';

const emptyForm = {
  name: '',
  code: '',
  type: 'PERCENTAGE', // 'PERCENTAGE' or 'FIXED'
  value: 10,
  min_order_amount: 0,
  max_discount_amount: '',
  start_date: '',
  end_date: '',
  usage_limit: '',
  outlet_id: '',
  is_auto_apply: false,
  active: true,
  notes: '',
};

export default function DiscountManagement() {
  const { activeOutletId, activeOutlet, isOwnerWebsite, outlets } = useOutlet();

  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [filterOutlet, setFilterOutlet] = useState('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    fetchDiscounts();
  }, [activeOutletId]);

  async function fetchDiscounts() {
    setLoading(true);
    try {
      const res = await api.get('/discounts');
      setDiscounts(res.data || []);
    } catch (err) {
      toast.error('Gagal memuat daftar promo & diskon.');
    } finally {
      setLoading(false);
    }
  }

  // Filtered Discounts
  const filteredDiscounts = useMemo(() => {
    return discounts.filter(d => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchSearch = !q ||
        d.name?.toLowerCase().includes(q) ||
        d.code?.toLowerCase().includes(q) ||
        d.notes?.toLowerCase().includes(q);

      // Status
      const matchStatus =
        filterActive === 'ALL' ||
        (filterActive === 'ACTIVE' && d.active) ||
        (filterActive === 'INACTIVE' && !d.active);

      // Outlet
      const matchOutlet =
        filterOutlet === 'ALL' ||
        (filterOutlet === 'GLOBAL' && !d.outlet_id) ||
        d.outlet_id?.toString() === filterOutlet;

      return matchSearch && matchStatus && matchOutlet;
    });
  }, [discounts, searchQuery, filterActive, filterOutlet]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const activeCount = discounts.filter(d => d.active).length;
    const withVouchers = discounts.filter(d => d.code && d.active).length;
    const totalUsage = discounts.reduce((sum, d) => sum + (Number(d.used_count) || 0), 0);
    const totalSavings = discounts.reduce((sum, d) => sum + (Number(d.total_savings) || 0), 0);

    return { activeCount, withVouchers, totalUsage, totalSavings };
  }, [discounts]);

  // Open Add Modal
  function handleOpenAdd() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      outlet_id: activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : '',
    });
    setModalOpen(true);
  }

  // Open Edit Modal
  function handleOpenEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      code: item.code || '',
      type: item.type || 'PERCENTAGE',
      value: item.value || 0,
      min_order_amount: item.min_order_amount || 0,
      max_discount_amount: item.max_discount_amount !== null ? item.max_discount_amount : '',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      usage_limit: item.usage_limit !== null ? item.usage_limit : '',
      outlet_id: item.outlet_id ? item.outlet_id.toString() : '',
      is_auto_apply: Boolean(item.is_auto_apply),
      active: Boolean(item.active),
      notes: item.notes || '',
    });
    setModalOpen(true);
  }

  // Copy code to clipboard
  function handleCopy(code) {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Kode voucher "${code}" berhasil disalin!`);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  // Toggle active status
  async function handleToggleStatus(item) {
    try {
      const res = await api.post(`/discounts/${item.id}/toggle`);
      toast.success(res.data.message || 'Status promo berhasil diubah.');
      setDiscounts(prev => prev.map(d => d.id === item.id ? { ...d, active: res.data.active } : d));
    } catch (err) {
      toast.error('Gagal mengubah status promo.');
    }
  }

  // Delete / deactivate discount
  async function handleDelete(item) {
    const isUsed = Number(item.used_count) > 0;
    const msg = isUsed
      ? `Promo "${item.name}" sudah digunakan ${item.used_count}x. Yakin ingin menonaktifkannya?`
      : `Yakin ingin menghapus promo "${item.name}" secara permanen?`;

    if (!window.confirm(msg)) return;

    try {
      const res = await api.delete(`/discounts/${item.id}`);
      toast.success(res.data.message || 'Promo berhasil diproses.');
      fetchDiscounts();
    } catch (err) {
      toast.error('Gagal menghapus promo.');
    }
  }

  // Save form (Add or Edit)
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Nama promo wajib diisi.');
      return;
    }
    if (Number(form.value) <= 0) {
      toast.error('Nilai diskon harus lebih besar dari 0.');
      return;
    }
    if (form.type === 'PERCENTAGE' && Number(form.value) > 100) {
      toast.error('Persentase diskon tidak boleh melebihi 100%.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() ? form.code.trim().toUpperCase() : null,
        type: form.type,
        value: Number(form.value),
        min_order_amount: Number(form.min_order_amount) || 0,
        max_discount_amount: form.max_discount_amount !== '' ? Number(form.max_discount_amount) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        usage_limit: form.usage_limit !== '' ? Number(form.usage_limit) : null,
        outlet_id: form.outlet_id ? Number(form.outlet_id) : null,
        is_auto_apply: Boolean(form.is_auto_apply),
        active: Boolean(form.active),
        notes: form.notes.trim() || null,
      };

      if (editingId) {
        await api.put(`/discounts/${editingId}`, payload);
        toast.success(`Promo "${payload.name}" berhasil diperbarui!`);
      } else {
        await api.post('/discounts', payload);
        toast.success(`Promo "${payload.name}" berhasil dibuat!`);
      }

      setModalOpen(false);
      fetchDiscounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan promo.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="fade-in">
      <PageHeader
        title="Promo & Diskon Kasir"
        subtitle="Kelola voucher potongan harga, diskon persentase, kuota pemakaian, dan promo otomatis untuk kasir POS."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchDiscounts} title="Segarkan Data">
              <RefreshCw size={14} /> Segarkan
            </button>
            <button className="btn btn-primary" onClick={handleOpenAdd}>
              <Plus size={15} /> Buat Promo Baru
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
        marginBottom: 20
      }}>
        {/* Total Active */}
        <div className="card" style={{
          padding: '16px 18px',
          background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.45) 0%, rgba(15, 23, 42, 0.7) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 14
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(139, 92, 246, 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-bright)'
          }}>
            <Percent size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600 }}>PROMO AKTIF</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>
              {metrics.activeCount} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>/ {discounts.length} total</span>
            </div>
          </div>
        </div>

        {/* Voucher Codes */}
        <div className="card" style={{
          padding: '16px 18px',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0.7) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 14
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(16, 185, 129, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#10b981'
          }}>
            <Tag size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600 }}>KODE VOUCHER</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', marginTop: 2 }}>
              {metrics.withVouchers} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>voucher siap pakai</span>
            </div>
          </div>
        </div>

        {/* Total Frequency */}
        <div className="card" style={{
          padding: '16px 18px',
          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(15, 23, 42, 0.7) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 14
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(56, 189, 248, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#38bdf8'
          }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600 }}>FREKUENSI DIPAKAI</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
              {num(metrics.totalUsage)} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>kali transaksi</span>
            </div>
          </div>
        </div>

        {/* Total Savings Given */}
        <div className="card" style={{
          padding: '16px 18px',
          background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.1) 0%, rgba(15, 23, 42, 0.7) 100%)',
          border: '1px solid rgba(244, 63, 94, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 14
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(244, 63, 94, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#f43f5e'
          }}>
            <Award size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600 }}>TOTAL POTONGAN DIBERIKAN</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f43f5e', marginTop: 2 }}>
              {rupiah(metrics.totalSavings)}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card mb-4" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: 280 }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 34, fontSize: 12.5 }}
                placeholder="Cari nama promo, kode voucher, S&K..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className={`btn btn-sm ${filterActive === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterActive('ALL')}
              >
                Semua ({discounts.length})
              </button>
              <button
                className={`btn btn-sm ${filterActive === 'ACTIVE' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterActive('ACTIVE')}
              >
                Aktif ({metrics.activeCount})
              </button>
              <button
                className={`btn btn-sm ${filterActive === 'INACTIVE' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterActive('INACTIVE')}
              >
                Nonaktif ({discounts.length - metrics.activeCount})
              </button>
            </div>
          </div>

          {/* Outlet Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Cabang:</span>
            <select
              className="form-control"
              style={{ fontSize: 12, padding: '6px 10px', minWidth: 160 }}
              value={filterOutlet}
              onChange={e => setFilterOutlet(e.target.value)}
            >
              <option value="ALL">Semua Cabang</option>
              <option value="GLOBAL">🌐 Berlaku Semua Cabang</option>
              {outlets.map(o => (
                <option key={o.id} value={o.id.toString()}>📍 {o.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Discounts Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 280 }}>NAMA PROMO & KODE VOUCHER</th>
              <th style={{ width: 140 }}>TIPE & BESARAN</th>
              <th>KETENTUAN BELANJA</th>
              <th>MASA BERLAKU</th>
              <th>KUOTA & PEMAKAIAN</th>
              <th>CABANG OUTLET</th>
              <th style={{ textAlign: 'center', width: 90 }}>STATUS</th>
              <th style={{ textAlign: 'right', width: 100 }}>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {filteredDiscounts.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <Percent size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <div>Tidak ada promo atau voucher yang sesuai filter.</div>
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={handleOpenAdd}>
                    <Plus size={13} /> Buat Promo Pertama
                  </button>
                </td>
              </tr>
            ) : (
              filteredDiscounts.map(d => {
                const isExpired = d.end_date && new Date(d.end_date) < new Date(new Date().toDateString());
                const isQuotaFull = d.usage_limit && d.used_count >= d.usage_limit;

                return (
                  <tr key={d.id} style={{ opacity: !d.active ? 0.6 : 1 }}>
                    {/* Name & Code */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: d.type === 'PERCENTAGE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                          color: d.type === 'PERCENTAGE' ? '#10b981' : '#38bdf8',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          {d.type === 'PERCENTAGE' ? <Percent size={18} /> : <Tag size={18} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#ffffff', fontSize: 13.5 }}>
                            {d.name}
                          </div>
                          {d.code ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                              <span
                                onClick={() => handleCopy(d.code)}
                                title="Klik untuk menyalin kode voucher"
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  background: 'rgba(99, 102, 241, 0.15)',
                                  color: 'var(--accent-bright)',
                                  border: '1px dashed rgba(99, 102, 241, 0.4)',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                {copiedCode === d.code ? <Check size={11} /> : <Copy size={11} />}
                                {d.code}
                              </span>
                              {d.is_auto_apply && (
                                <span className="pill pill-accent" style={{ fontSize: 9.5 }}>Auto Apply</span>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                              Pilihan Langsung Kasir {d.is_auto_apply && '• Auto Apply'}
                            </div>
                          )}
                          {d.notes && (
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                              {d.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Type & Value */}
                    <td>
                      <div style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: d.type === 'PERCENTAGE' ? '#10b981' : '#38bdf8'
                      }}>
                        {d.type === 'PERCENTAGE' ? `${d.value}%` : rupiah(d.value)}
                      </div>
                      {d.type === 'PERCENTAGE' && d.max_discount_amount && (
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                          Maks. {rupiah(d.max_discount_amount)}
                        </div>
                      )}
                    </td>

                    {/* Minimum Order */}
                    <td>
                      <div>
                        {d.min_order_amount > 0 ? (
                          <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                            Min. {rupiah(d.min_order_amount)}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Tanpa Min. Belanja</span>
                        )}
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                          {d.scope === 'TRANSACTION' ? 'Seluruh Tagihan' : (d.scope || 'Tagihan')}
                        </div>
                      </div>
                    </td>

                    {/* Validity Period */}
                    <td>
                      {d.start_date || d.end_date ? (
                        <div style={{ fontSize: 11.5 }}>
                          <div style={{ color: isExpired ? '#f43f5e' : 'var(--text-primary)', fontWeight: isExpired ? 700 : 500 }}>
                            {d.end_date ? `s/d ${d.end_date}` : `Mulai ${d.start_date}`}
                          </div>
                          {isExpired && (
                            <span className="pill pill-danger" style={{ fontSize: 9, marginTop: 2 }}>Kadaluwarsa</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>Selamanya</span>
                      )}
                    </td>

                    {/* Usage & Quota */}
                    <td>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: isQuotaFull ? '#f43f5e' : '#ffffff' }}>
                          {num(d.used_count || 0)} {d.usage_limit ? `/ ${num(d.usage_limit)}` : 'terpakai'}
                        </div>
                        {d.usage_limit && (
                          <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(100, ((d.used_count || 0) / d.usage_limit) * 100)}%`,
                              height: '100%',
                              background: isQuotaFull ? '#f43f5e' : 'var(--accent)'
                            }} />
                          </div>
                        )}
                        {Number(d.total_savings) > 0 && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                            Hemat: {rupiah(d.total_savings)}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Outlet */}
                    <td>
                      {d.outlet ? (
                        <span className="pill pill-secondary" style={{ fontSize: 10 }}>
                          📍 {d.outlet.name}
                        </span>
                      ) : (
                        <span className="pill pill-accent" style={{ fontSize: 10 }}>
                          🌐 Semua Cabang
                        </span>
                      )}
                    </td>

                    {/* Active Toggle Switch */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleToggleStatus(d)}
                        title={d.active ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                        style={{
                          background: d.active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                          color: d.active ? '#10b981' : '#f43f5e',
                          border: `1px solid ${d.active ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
                          padding: '4px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 700
                        }}
                      >
                        <Power size={11} />
                        {d.active ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleOpenEdit(d)}
                          title="Edit Promo"
                          style={{ padding: '4px 7px' }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDelete(d)}
                          title="Hapus Promo"
                          style={{ padding: '4px 7px', color: '#f43f5e' }}
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

      {/* Add / Edit Promo Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  <Percent size={18} style={{ color: 'var(--accent)' }} />
                  {editingId ? 'Edit Promo & Diskon' : 'Buat Promo & Diskon Baru'}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Konfigurasi syarat, potongan harga, kuota pemakaian, dan kode voucher kasir.
                </span>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Live Voucher Badge Preview */}
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 4,
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.08) 100%)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                      PREVIEW TAMPILAN DI KASIR
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>
                      {form.name || 'Nama Promo'}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {form.min_order_amount > 0 ? `Min. Belanja ${rupiah(form.min_order_amount)}` : 'Tanpa minimal belanja'}
                      {form.type === 'PERCENTAGE' && form.max_discount_amount ? ` • Maks. ${rupiah(form.max_discount_amount)}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: 18,
                      fontWeight: 900,
                      color: form.type === 'PERCENTAGE' ? '#10b981' : '#38bdf8',
                      fontFamily: 'monospace'
                    }}>
                      {form.type === 'PERCENTAGE' ? `${form.value || 0}% OFF` : `-${rupiah(form.value || 0)}`}
                    </div>
                    {form.code && (
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        display: 'inline-block',
                        marginTop: 2
                      }}>
                        {form.code.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Promo Name */}
                <div>
                  <label className="form-label required">Nama Promo / Program Diskon</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Diskon Pelajar 15%, Promo Grand Opening, dll"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>

                {/* Voucher Code & Auto Apply */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                  <div>
                    <label className="form-label">
                      Kode Voucher (Opsional)
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 6 }}>Kosongkan jika bukan kupon</span>
                    </label>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="Contoh: PROMO15, JUMATHEBAT"
                      value={form.code}
                      onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Tipe Potongan</label>
                    <select
                      className="form-control"
                      value={form.type}
                      onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                    >
                      <option value="PERCENTAGE">Persentase (%)</option>
                      <option value="FIXED">Nominal Tetap (Rp)</option>
                    </select>
                  </div>
                </div>

                {/* Value & Max Cap */}
                <div style={{ display: 'grid', gridTemplateColumns: form.type === 'PERCENTAGE' ? '1fr 1fr' : '1fr', gap: 10 }}>
                  <div>
                    <label className="form-label required">
                      {form.type === 'PERCENTAGE' ? 'Persentase Diskon (%)' : 'Nominal Potongan (Rp)'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="form-control mono"
                      placeholder={form.type === 'PERCENTAGE' ? 'Contoh: 15' : 'Contoh: 10000'}
                      value={form.value}
                      onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                      required
                    />
                  </div>
                  {form.type === 'PERCENTAGE' && (
                    <div>
                      <label className="form-label">
                        Maksimal Diskon (Rp)
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>Plafon</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        className="form-control mono"
                        placeholder="Kosongkan jika tanpa batas"
                        value={form.max_discount_amount}
                        onChange={e => setForm(p => ({ ...p, max_discount_amount: e.target.value }))}
                      />
                    </div>
                  )}
                </div>

                {/* Min Order & Usage Quota */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="form-label">Minimal Belanja (Rp)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-control mono"
                      placeholder="0 = Tanpa minimal belanja"
                      value={form.min_order_amount}
                      onChange={e => setForm(p => ({ ...p, min_order_amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Kuota Pemakaian Total</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control mono"
                      placeholder="Kosongkan jika tak terbatas"
                      value={form.usage_limit}
                      onChange={e => setForm(p => ({ ...p, usage_limit: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Validity Dates */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="form-label">Tanggal Mulai Berlaku</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.start_date}
                      onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Tanggal Berakhir</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.end_date}
                      onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Target Outlet */}
                <div>
                  <label className="form-label">Berlaku di Cabang</label>
                  <select
                    className="form-control"
                    value={form.outlet_id}
                    onChange={e => setForm(p => ({ ...p, outlet_id: e.target.value }))}
                  >
                    <option value="">🌐 Semua Cabang Outlet (Nasional)</option>
                    {outlets.map(o => (
                      <option key={o.id} value={o.id.toString()}>📍 {o.name}</option>
                    ))}
                  </select>
                </div>

                {/* Notes / S&K */}
                <div>
                  <label className="form-label">Catatan / Syarat & Ketentuan (S&K)</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Contoh: Khusus makan di tempat (Dine-in). Tunjukkan kartu pelajar ke kasir."
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  />
                </div>

                {/* Checkboxes: Active & Auto Apply */}
                <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#ffffff' }}>
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={e => setForm(p => ({ ...p, active: e.target.checked }))}
                    />
                    <span>Status Aktif</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#ffffff' }}>
                    <input
                      type="checkbox"
                      checked={form.is_auto_apply}
                      onChange={e => setForm(p => ({ ...p, is_auto_apply: e.target.checked }))}
                    />
                    <span>Auto-Apply jika syarat terpenuhi</span>
                  </label>
                </div>
              </div>

              {/* Modal Footer with Submit & Cancel Buttons */}
              <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '14px 22px', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#11162d', flexShrink: 0 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '10px 20px', minWidth: 140, justifyContent: 'center' }}>
                  <Check size={16} />
                  {saving ? 'Menyimpan...' : (editingId ? 'Simpan Perubahan' : 'Buat Promo')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
