import { useState, useEffect } from 'react';
import {
  Building2, Plus, Search, Shield, Store, Users, Calendar,
  CheckCircle2, AlertTriangle, XCircle, Clock, Edit3, ExternalLink,
  RefreshCw, Package, Phone, Mail, MapPin, Check, X, Gift
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { PageHeader, LoadingState, MiniCard, formatDateTime } from '../components/ui';
import { getTodayStr } from '../utils/date';
import { useOutlet } from '../context/OutletContext';

export default function BusinessManagement() {
  const { changeBusiness, isSuperadminPlatform } = useOutlet();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [referralFilter, setReferralFilter] = useState('ALL'); // 'ALL' | 'YES' | 'NO'

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    owner_name: '',
    email: '',
    phone: '',
    address: '',
    package_type: 'pro',
    max_outlets: 5,
    status: 'active',
    expires_at: '',
  });

  useEffect(() => {
    fetchBusinesses();
  }, []);

  async function fetchBusinesses() {
    setLoading(true);
    try {
      const { data } = await api.get('/businesses');
      setBusinesses(data);
    } catch (err) {
      toast.error('Gagal memuat data penyewa platform');
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);

    setFormData({
      name: '',
      owner_name: '',
      email: '',
      phone: '',
      address: '',
      package_type: 'pro',
      max_outlets: 5,
      status: 'active',
      expires_at: getTodayStr(nextMonth),
    });
    setCreateModalOpen(true);
  }

  function openEditModal(b) {
    setSelectedBusiness(b);
    setFormData({
      name: b.name || '',
      owner_name: b.owner_name || '',
      email: b.email || '',
      phone: b.phone || '',
      address: b.address || '',
      package_type: b.package_type || 'pro',
      max_outlets: b.max_outlets || 5,
      status: b.status || 'active',
      expires_at: b.expires_at ? b.expires_at.slice(0, 10) : '',
    });
    setEditModalOpen(true);
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    if (!formData.name || !formData.owner_name) {
      toast.error('Nama bisnis dan nama pemilik wajib diisi!');
      return;
    }

    setSaving(true);
    try {
      await api.post('/businesses', formData);
      toast.success(`Bisnis '${formData.name}' berhasil ditambahkan!`);
      setCreateModalOpen(false);
      fetchBusinesses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menambahkan bisnis');
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!selectedBusiness) return;

    setSaving(true);
    try {
      await api.put(`/businesses/${selectedBusiness.id}`, formData);
      toast.success(`Data bisnis '${formData.name}' berhasil diperbarui!`);
      setEditModalOpen(false);
      fetchBusinesses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui bisnis');
    } finally {
      setSaving(false);
    }
  }

  function handleSwitchBusiness(b) {
    changeBusiness(b.id);
    toast.success(`Beralih ke konteks bisnis: ${b.name}`);
  }

  // Filtered list
  const filteredBusinesses = businesses.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.owner_name && b.owner_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.email && b.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.slug && b.slug.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.referral_code_used && b.referral_code_used.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.referred_by?.name && b.referred_by.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.referred_by?.referral_code && b.referred_by.referral_code.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    const matchesReferral =
      referralFilter === 'ALL'
        ? true
        : referralFilter === 'YES'
        ? Boolean(b.referred_by_id || b.referral_code_used)
        : !b.referred_by_id && !b.referral_code_used;

    return matchesSearch && matchesStatus && matchesReferral;
  });

  // Calculate statistics
  const totalTenants = businesses.length;
  const activeTenants = businesses.filter(b => b.status === 'active').length;
  const trialTenants = businesses.filter(b => b.status === 'trial').length;
  const referralTenants = businesses.filter(b => b.referred_by_id || b.referral_code_used).length;
  const totalOutletsCount = businesses.reduce((acc, b) => acc + (b.outlets_count || 0), 0);

  function getStatusBadge(status) {
    switch (status) {
      case 'active':
        return (
          <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <CheckCircle2 size={12} /> Aktif
          </span>
        );
      case 'trial':
        return (
          <span className="badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
            <Clock size={12} /> Masa Trial
          </span>
        );
      case 'suspended':
        return (
          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <AlertTriangle size={12} /> Suspended
          </span>
        );
      case 'expired':
        return (
          <span className="badge" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
            <XCircle size={12} /> Expired
          </span>
        );
      default:
        return <span className="badge">{status}</span>;
    }
  }

  function getPackageBadge(pkg) {
    const colorMap = {
      starter: { bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1', border: 'rgba(148, 163, 184, 0.3)' },
      pro: { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.3)' },
      enterprise: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' },
    };
    const c = colorMap[pkg] || colorMap.pro;
    return (
      <span className="badge" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <Package size={11} /> {pkg}
      </span>
    );
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Kelola Penyewa SaaS (Multi-Tenant)"
        subtitle="Portal Superadmin Platform untuk mengelola akun bisnis penyewa, status paket sewa, kuota cabang, dan masa aktif langganan."
        actions={
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={16} /> Tambah Bisnis Penyewa
          </button>
        }
      />

      {/* Stats Summary Cards */}
      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 24 }}>
        <MiniCard
          label="Total Bisnis Penyewa"
          value={`${totalTenants} Usaha`}
          sub="Terdaftar di Platform MOVA"
          icon={<Building2 size={22} />}
          color="accent"
        />
        <MiniCard
          label="Bisnis Aktif"
          value={`${activeTenants} Usaha`}
          sub="Langganan sewa berjalan normal"
          icon={<CheckCircle2 size={22} />}
          color="ok"
        />
        <MiniCard
          label="Masa Uji Coba (Trial)"
          value={`${trialTenants} Usaha`}
          sub="Dalam masa evaluasi 30 hari"
          icon={<Clock size={22} />}
          color="info"
        />
        <MiniCard
          label="Via Referral Mitra"
          value={`${referralTenants} Usaha`}
          sub="Rekomendasi kode referral"
          icon={<Gift size={22} />}
          color="accent"
        />
        <MiniCard
          label="Total Cabang Terhubung"
          value={`${totalOutletsCount} Cabang`}
          sub="Di seluruh tenant bisnis"
          icon={<Store size={22} />}
          color="accent"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 280, maxWidth: 450 }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 36 }}
                placeholder="Cari bisnis, pemilik, email, atau kode referral..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Status:</span>
            <select
              className="form-control"
              style={{ width: 'auto', minWidth: 140 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="trial">Masa Trial</option>
              <option value="suspended">Suspended</option>
              <option value="expired">Expired</option>
            </select>

            <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginLeft: 6 }}>Sumber:</span>
            <select
              className="form-control"
              style={{ width: 'auto', minWidth: 160 }}
              value={referralFilter}
              onChange={(e) => setReferralFilter(e.target.value)}
            >
              <option value="ALL">Semua Pendaftaran</option>
              <option value="YES">Via Referral Mitra</option>
              <option value="NO">Organik (Tanpa Ref)</option>
            </select>

            <button className="btn btn-secondary btn-sm" onClick={fetchBusinesses} title="Segarkan data">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="card">
        {loading ? (
          <LoadingState text="Memuat daftar tenant bisnis penyewa..." />
        ) : filteredBusinesses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
            <Building2 size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ margin: 0, fontSize: 15 }}>Tidak ada data bisnis penyewa yang sesuai.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 50 }}>No</th>
                  <th>Nama Bisnis / Brand</th>
                  <th>Pemilik & Kontak</th>
                  <th style={{ width: 140 }}>Paket Sewa</th>
                  <th style={{ width: 150 }}>Jumlah Cabang</th>
                  <th style={{ width: 130 }}>Status Sewa</th>
                  <th style={{ width: 150 }}>Masa Aktif</th>
                  <th className="right" style={{ width: 140 }}>Aksi Superadmin</th>
                </tr>
              </thead>
              <tbody>
                {filteredBusinesses.map((b, idx) => (
                  <tr key={b.id}>
                    <td className="mono center" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {idx + 1}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
                            border: '1px solid rgba(165,180,252,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent-bright)',
                            fontWeight: 700,
                            fontSize: 15,
                          }}
                        >
                          {b.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#ffffff' }}>{b.name}</div>
                          <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                            slug: {b.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)' }}>
                        {b.owner_name || '—'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                        {b.email && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Mail size={11} /> {b.email}
                          </span>
                        )}
                        {b.phone && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Phone size={11} /> {b.phone}
                          </span>
                        )}
                      </div>
                      {b.referred_by ? (
                        <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: 'rgba(236, 72, 153, 0.12)', border: '1px solid rgba(236, 72, 153, 0.3)', fontSize: 11.5, color: '#f472b6' }}>
                          <Gift size={12} />
                          <span>Ref: <strong>{b.referred_by.name}</strong> ({b.referral_code_used || b.referred_by.referral_code})</span>
                        </div>
                      ) : b.referral_code_used ? (
                        <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: 'rgba(236, 72, 153, 0.12)', border: '1px solid rgba(236, 72, 153, 0.3)', fontSize: 11.5, color: '#f472b6' }}>
                          <Gift size={12} />
                          <span>Ref: <strong>{b.referral_code_used}</strong></span>
                        </div>
                      ) : (
                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                          Organik (Tanpa Referral)
                        </div>
                      )}
                    </td>
                    <td>{getPackageBadge(b.package_type)}</td>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 8, background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(165, 180, 252, 0.25)' }}>
                        <Store size={13} style={{ color: 'var(--accent-bright)' }} />
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#ffffff' }}>
                          {b.outlets_count || 0} Cabang
                        </span>
                        <span style={{ fontSize: 10.5, color: '#34d399', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1px 6px', borderRadius: 4 }}>
                          Unlimited
                        </span>
                      </div>
                    </td>
                    <td>{getStatusBadge(b.status)}</td>
                    <td>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>
                        {b.expires_at ? new Date(b.expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Selamanya'}
                      </div>
                    </td>
                    <td className="right">
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px' }}
                          title="Supervisi data bisnis ini"
                          onClick={() => handleSwitchBusiness(b)}
                        >
                          <ExternalLink size={13} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px' }}
                          title="Edit langganan & kuota"
                          onClick={() => openEditModal(b)}
                        >
                          <Edit3 size={13} /> Edit
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

      {/* Create Modal */}
      {createModalOpen && (
        <div className="modal-overlay" onClick={() => setCreateModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div className="modal-title">Tambah Bisnis Penyewa Baru</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setCreateModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nama Bisnis / Brand <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="Contoh: Kopi Kenangan Senja"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Nama Pemilik Usaha <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="Contoh: Ibu Sari Anggraini"
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Email Pemilik</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="owner@brand.id"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">No. Telepon / WhatsApp</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="0812-xxxx-xxxx"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Paket Langganan</label>
                    <select
                      className="form-control"
                      value={formData.package_type}
                      onChange={(e) => setFormData({ ...formData, package_type: e.target.value })}
                    >
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ketentuan Cabang</label>
                    <div style={{ height: 42, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 8, fontSize: 12.5, color: '#34d399', fontWeight: 600 }}>
                      <Store size={14} /> Bebas Cabang (Unlimited)
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Status Langganan</label>
                    <select
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="active">Aktif</option>
                      <option value="trial">Masa Trial</option>
                      <option value="suspended">Suspended</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Masa Aktif s/d Tanggal</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.expires_at}
                      onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Alamat Kantor / Usaha</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="Alamat kantor pusat bisnis..."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan & Aktifkan Bisnis'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div className="modal-title">Edit Langganan & Kuota Bisnis</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nama Bisnis</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Nama Pemilik</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={formData.owner_name}
                      onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">No. Telepon</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Paket Langganan</label>
                    <select
                      className="form-control"
                      value={formData.package_type}
                      onChange={(e) => setFormData({ ...formData, package_type: e.target.value })}
                    >
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ketentuan Cabang</label>
                    <div style={{ height: 42, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 8, fontSize: 12.5, color: '#34d399', fontWeight: 600 }}>
                      <Store size={14} /> Bebas Cabang (Unlimited)
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Status Langganan</label>
                    <select
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="active">Aktif</option>
                      <option value="trial">Masa Trial</option>
                      <option value="suspended">Suspended (Blokir)</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Perpanjang s/d Tanggal</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.expires_at}
                      onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Perbarui Status Langganan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
