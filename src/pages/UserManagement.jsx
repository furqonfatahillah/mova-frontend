import { useState, useEffect } from 'react';
import {
  Users, UserPlus, CheckCircle2, XCircle, Clock, Shield,
  Store, Search, Edit2, Trash2, Ban, RotateCcw, Check, X, Mail, Lock, User, Filter
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { PageHeader, LoadingState, MiniCard, formatDateTime } from '../components/ui';

export default function UserManagement() {
  const currentUser = JSON.parse(localStorage.getItem('pos_user') || '{}');
  const isSuperadminPlatform = currentUser.role === 'superadmin_platform' || currentUser.role === 'superadmin' || Boolean(currentUser.is_superadmin_platform);
  const isOwnerWebsite = currentUser.role === 'owner_website' || Boolean(currentUser.is_owner_website);
  const isPlatformAdmin = isSuperadminPlatform || isOwnerWebsite;
  const isOwnerBisnis = currentUser.role === 'owner_bisnis' || currentUser.role === 'owner' || currentUser.role === 'admin' || Boolean(currentUser.is_owner_bisnis);
  const isOwnerOutlet = currentUser.role === 'owner_outlet' || currentUser.role === 'manager_outlet' || Boolean(currentUser.is_owner_outlet);
  const isPegawai = !isPlatformAdmin && !isOwnerBisnis && !isOwnerOutlet;

  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, active: 0, rejected: 0, suspended: 0 });
  const [outlets, setOutlets] = useState([]);
  const [masterRoles, setMasterRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [outletFilter, setOutletFilter] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [saving, setSaving] = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'pegawai',
    outlet_id: '',
    status: 'active',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'pegawai',
    outlet_id: '',
    status: 'active',
  });

  const [approveForm, setApproveForm] = useState({
    role: 'pegawai',
    outlet_id: '',
  });

  useEffect(() => {
    if (!isPegawai) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isPegawai]);

  async function loadData() {
    setLoading(true);
    try {
      const [usersRes, outletsRes, rolesRes] = await Promise.all([
        api.get('/users'),
        api.get('/outlets'),
        api.get('/roles').catch(() => ({ data: [] })),
      ]);
      setUsers(usersRes.data.users);
      setCounts(usersRes.data.counts);
      setOutlets(outletsRes.data);
      setMasterRoles(Array.isArray(rolesRes.data) ? rolesRes.data : []);

      // If no pending users, default tab to all
      if (usersRes.data.counts.pending === 0) {
        setActiveTab('all');
      }
    } catch {
      toast.error('Gagal memuat data pengguna');
    } finally {
      setLoading(false);
    }
  }

  async function refreshUsers() {
    try {
      const { data } = await api.get('/users');
      setUsers(data.users);
      setCounts(data.counts);
    } catch {}
  }

  function openCreate() {
    const defaultOutlet = isOwnerOutlet
      ? currentUser.outlet_id
      : (outlets.find(o => o.is_main)?.id || outlets[0]?.id || '');

    setCreateForm({
      name: '',
      email: '',
      password: '',
      role: isOwnerOutlet ? 'pegawai' : 'pegawai',
      outlet_id: defaultOutlet,
      status: 'active',
    });
    setCreateModalOpen(true);
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...createForm };
      if (isOwnerOutlet) {
        payload.role = 'pegawai';
        payload.outlet_id = currentUser.outlet_id;
      }
      await api.post('/users', payload);
      toast.success(`Pengguna ${createForm.name} berhasil ditambahkan`);
      setCreateModalOpen(false);
      refreshUsers();
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(m => toast.error(m));
      else toast.error(err.response?.data?.message || 'Gagal membuat pengguna');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(user) {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      outlet_id: user.outlet_id || '',
      status: user.status,
    });
    setEditModalOpen(true);
  }

  async function handleEditUser(e) {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    try {
      const payload = { ...editForm };
      if (isOwnerOutlet) {
        payload.role = 'pegawai';
        delete payload.outlet_id;
      }
      await api.put(`/users/${selectedUser.id}`, payload);
      toast.success(`Data ${editForm.name} berhasil diperbarui`);
      setEditModalOpen(false);
      refreshUsers();
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(m => toast.error(m));
      else toast.error(err.response?.data?.message || 'Gagal memperbarui pengguna');
    } finally {
      setSaving(false);
    }
  }

  function openApprove(user) {
    setSelectedUser(user);
    const assignedOutlet = isOwnerOutlet
      ? currentUser.outlet_id
      : (user.outlet_id || outlets.find(o => o.is_main)?.id || outlets[0]?.id || '');

    setApproveForm({
      role: isOwnerOutlet ? 'pegawai' : (user.role || 'pegawai'),
      outlet_id: assignedOutlet,
    });
    setApproveModalOpen(true);
  }

  async function handleApproveUser(e) {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    try {
      const payload = {
        role: isOwnerOutlet ? 'pegawai' : approveForm.role,
        outlet_id: isOwnerOutlet ? currentUser.outlet_id : approveForm.outlet_id,
      };
      const { data } = await api.post(`/users/${selectedUser.id}/approve`, payload);
      toast.success(data.message || 'Pengguna berhasil disetujui');
      setApproveModalOpen(false);
      refreshUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyetujui akun');
    } finally {
      setSaving(false);
    }
  }

  async function handleReject(user) {
    if (!window.confirm(`Tolak permohonan registrasi akun "${user.name}" (${user.email})?`)) return;
    try {
      const { data } = await api.post(`/users/${user.id}/reject`);
      toast.success(data.message || 'Permohonan ditolak');
      refreshUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menolak akun');
    }
  }

  async function handleSuspend(user) {
    if (!window.confirm(`Nonaktifkan (suspend) akun "${user.name}"? Pengguna tidak akan dapat login.`)) return;
    try {
      const { data } = await api.post(`/users/${user.id}/suspend`);
      toast.success(data.message || 'Akun dinonaktifkan');
      refreshUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menonaktifkan akun');
    }
  }

  async function handleDelete(user) {
    if (!window.confirm(`Hapus permanen pengguna "${user.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const { data } = await api.delete(`/users/${user.id}`);
      toast.success(data.message || 'Pengguna dihapus');
      refreshUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus pengguna');
    }
  }

  if (isPegawai) {
    return (
      <div className="fade-in card" style={{ padding: '60px 20px', maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
        <Shield size={48} color="var(--danger)" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#ffffff' }}>Akses Khusus Manajemen</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 13.5, lineHeight: 1.6 }}>
          Halaman ini dikhususkan untuk <strong>Owner Website</strong> dan <strong>Owner Outlet</strong> dalam mengelola akun dan persetujuan staf. Anda terdaftar sebagai Pegawai.
        </p>
        <button className="btn btn-primary" onClick={() => window.location.href = '/'}>
          Kembali ke POS / Dashboard
        </button>
      </div>
    );
  }

  if (loading) return <LoadingState />;

  // Filtered users
  const filteredUsers = users.filter(u => {
    // Hide owner_bisnis, owner_website, superadmin accounts when viewed by owner_bisnis
    if (!isOwnerWebsite && !isSuperadminPlatform) {
      const isOwnerRole = ['owner_bisnis', 'owner_website', 'superadmin_platform', 'superadmin', 'owner', 'admin'].includes(u.role);
      if (isOwnerRole) return false;
    }

    // Status tab filter
    if (activeTab === 'pending' && u.status !== 'pending') return false;
    if (activeTab === 'active' && u.status !== 'active') return false;
    if (activeTab === 'other' && (u.status === 'pending' || u.status === 'active')) return false;

    // Outlet filter (Owner Website only)
    if (isOwnerWebsite && outletFilter) {
      if (String(u.outlet_id) !== String(outletFilter)) return false;
    }

    // Search filter
    if (search.trim()) {
      const s = search.toLowerCase();
      const matchName = u.name?.toLowerCase().includes(s);
      const matchEmail = u.email?.toLowerCase().includes(s);
      const matchRole = u.role?.toLowerCase().includes(s);
      const matchOutlet = u.outlet_name?.toLowerCase().includes(s);
      if (!matchName && !matchEmail && !matchRole && !matchOutlet) return false;
    }

    return true;
  });

  return (
    <div className="fade-in">
      <PageHeader
        title={
          isOwnerOutlet
            ? `Kelola Pegawai Cabang — ${currentUser.outlet_name || 'Outlet Anda'}`
            : 'Manajemen Seluruh Pengguna & Outlet'
        }
        subtitle={
          isOwnerOutlet
            ? `Atur akun pegawai, kasir, dan berikan persetujuan registrasi staf khusus cabang ${currentUser.outlet_name || 'Anda'}.`
            : 'Sistem SaaS Multi-Tier: Kelola akun kasir/pegawai, owner cabang outlet, dan persetujuan registrasi pengguna baru.'
        }
        action={
          <button className="btn btn-primary" onClick={openCreate}>
            <UserPlus size={15} /> {isOwnerOutlet ? 'Tambah Pegawai Baru' : 'Tambah Pengguna Baru'}
          </button>
        }
      />

      {/* Mini Stats */}
      <div className="grid-3 mb-6">
        <MiniCard
          label={isOwnerOutlet ? 'Pendaftaran Pegawai Menunggu' : 'Permohonan Menunggu Persetujuan'}
          value={
            counts.pending > 0 ? (
              <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={18} /> {counts.pending} Perlu Tindakan
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>0 Menunggu</span>
            )
          }
          color="#f59e0b"
        />
        <MiniCard
          label={isOwnerOutlet ? 'Pegawai Aktif Cabang' : 'Total Pengguna Aktif'}
          value={`${counts.active} Akun Aktif`}
          color="var(--ok)"
        />
        <MiniCard
          label={isOwnerOutlet ? 'Total Staf Cabang' : 'Total Akun Terdaftar'}
          value={`${counts.total} Akun`}
          color="var(--accent)"
        />
      </div>

      {/* Main Table Card */}
      <div className="card">
        {/* Filter Tabs & Search Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('pending')}
              style={{
                position: 'relative',
                borderColor: activeTab === 'pending' ? 'var(--accent-bright)' : undefined,
                background: activeTab === 'pending' ? 'var(--accent-dim)' : undefined,
                color: activeTab === 'pending' ? 'var(--accent-bright)' : undefined,
              }}
            >
              <Clock size={13} />
              Menunggu Persetujuan
              {counts.pending > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    background: '#f59e0b',
                    color: '#11162d',
                    padding: '1px 6px',
                    borderRadius: 10,
                    fontSize: 10,
                    fontWeight: 800
                  }}
                >
                  {counts.pending}
                </span>
              )}
            </button>

            <button
              className={`btn btn-sm ${activeTab === 'active' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('active')}
            >
              <CheckCircle2 size={13} />
              Aktif ({counts.active})
            </button>

            <button
              className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('all')}
            >
              Semua ({counts.total})
            </button>

            <button
              className={`btn btn-sm ${activeTab === 'other' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('other')}
            >
              Ditolak / Non-aktif ({counts.rejected + counts.suspended})
            </button>
          </div>

          {/* Filters on the Right: Outlet Dropdown (if Website Owner) & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {isOwnerWebsite && outlets.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Store size={14} color="var(--text-muted)" />
                <select
                  className="form-control"
                  style={{ fontSize: 12.5, padding: '6px 10px', height: 36, minWidth: 170 }}
                  value={outletFilter}
                  onChange={e => setOutletFilter(e.target.value)}
                >
                  <option value="" style={{ background: '#11162d', color: '#ffffff' }}>Semua Cabang Outlet</option>
                  {outlets.map(o => (
                    <option key={o.id} value={o.id} style={{ background: '#11162d', color: '#ffffff' }}>
                      {o.name} {o.is_main ? '(Pusat)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Search */}
            <div style={{ position: 'relative', width: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Cari staf / email..."
                style={{ paddingLeft: 30, fontSize: 12.5, height: 36 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>Pengguna</th>
                <th style={{ minWidth: 160 }}>Email</th>
                <th style={{ width: 140 }}>Role Akses</th>
                <th style={{ minWidth: 150 }}>Cabang Outlet</th>
                <th style={{ width: 130 }} className="center">Status Akun</th>
                <th style={{ minWidth: 160 }}>Riwayat Persetujuan</th>
                <th style={{ width: 140 }} className="center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                    {activeTab === 'pending'
                      ? 'Tidak ada permohonan registrasi yang menunggu persetujuan.'
                      : 'Tidak ada data pengguna yang sesuai dengan filter.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const isSelf = u.id === currentUser.id;
                  const isUserOwnerWeb = u.role === 'owner_website' || u.role === 'superadmin_platform' || u.role === 'superadmin';
                  const isUserOwnerBis = u.role === 'owner_bisnis' || u.role === 'owner' || u.role === 'admin';
                  const isUserOwnerOut = u.role === 'owner_outlet';

                  return (
                    <tr
                      key={u.id}
                      style={{
                        background: u.status === 'pending' ? 'rgba(245, 158, 11, 0.05)' : undefined
                      }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              background: u.status === 'pending'
                                ? 'rgba(245, 158, 11, 0.2)'
                                : isUserOwnerWeb
                                ? 'rgba(168, 85, 247, 0.2)'
                                : isUserOwnerOut
                                ? 'rgba(56, 189, 248, 0.2)'
                                : 'var(--accent-dim)',
                              color: u.status === 'pending'
                                ? '#f59e0b'
                                : isUserOwnerWeb
                                ? '#c084fc'
                                : isUserOwnerOut
                                ? '#38bdf8'
                                : 'var(--accent-bright)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 13,
                              border: `1px solid ${
                                u.status === 'pending'
                                  ? 'rgba(245, 158, 11, 0.4)'
                                  : isUserOwnerWeb
                                  ? 'rgba(168, 85, 247, 0.4)'
                                  : isUserOwnerOut
                                  ? 'rgba(56, 189, 248, 0.4)'
                                  : 'var(--border-accent)'
                              }`
                            }}
                          >
                            {u.name?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                              {u.name} {isSelf && <span style={{ fontSize: 10, color: 'var(--accent-bright)', fontWeight: 600 }}>(Anda)</span>}
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              ID: #{u.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {u.email}
                      </td>

                      <td>
                        {u.role === 'superadmin_platform' || u.role === 'superadmin' ? (
                          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 700, background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)' }}>
                            Superadmin Platform
                          </span>
                        ) : u.role === 'owner_bisnis' || u.role === 'owner' ? (
                          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 700, background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                            Owner Bisnis
                          </span>
                        ) : u.role === 'owner_website' ? (
                          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 700, background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                            Owner Website
                          </span>
                        ) : isUserOwnerOut ? (
                          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 700, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                            Owner Outlet
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 4,
                              fontWeight: 700,
                              background: 'rgba(52, 211, 153, 0.15)',
                              color: '#34d399',
                              border: '1px solid rgba(52, 211, 153, 0.3)'
                            }}
                          >
                            Pegawai Cabang
                          </span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                          <Store size={13} color="var(--text-muted)" />
                          <span>{u.outlet_name || (isUserOwnerWeb ? 'Semua Cabang (Pusat)' : '—')}</span>
                        </div>
                      </td>

                      <td className="center">
                        {u.status === 'pending' && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '3px 9px',
                              borderRadius: 20,
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Clock size={11} /> Menunggu
                          </span>
                        )}
                        {u.status === 'active' && (
                          <span className="pill pill-ok" style={{ fontSize: 11 }}>
                            Aktif
                          </span>
                        )}
                        {u.status === 'rejected' && (
                          <span className="pill pill-danger" style={{ fontSize: 11 }}>
                            Ditolak
                          </span>
                        )}
                        {u.status === 'suspended' && (
                          <span className="pill pill-muted" style={{ fontSize: 11 }}>
                            Non-Aktif
                          </span>
                        )}
                      </td>

                      <td>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          <div>Daftar: {formatDateTime(u.created_at)}</div>
                          {u.approved_at && (
                            <div style={{ color: 'var(--ok)', marginTop: 2 }}>
                              Disetujui: {u.approved_by_name || 'Admin'} ({formatDateTime(u.approved_at)})
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="center">
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          {/* Pending Approval Actions */}
                          {u.status === 'pending' && (
                            <>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => openApprove(u)}
                                style={{ background: '#10b981', borderColor: '#10b981', padding: '4px 8px', fontSize: 11.5 }}
                                title="Setujui Akun (Approve)"
                              >
                                <Check size={13} /> Setujui
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleReject(u)}
                                style={{ color: 'var(--danger)', padding: '4px 8px' }}
                                title="Tolak Pendaftaran"
                              >
                                <X size={13} />
                              </button>
                            </>
                          )}

                          {/* Active User Actions */}
                          {u.status === 'active' && (
                            <>
                              {(!isUserOwnerWeb && !isUserOwnerBis || isOwnerWebsite || isSuperadminPlatform) && (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => openEdit(u)}
                                  title="Edit Pengguna"
                                  style={{ padding: '4px 8px' }}
                                >
                                  <Edit2 size={13} />
                                </button>
                              )}
                              {!isSelf && (!isUserOwnerWeb && !isUserOwnerBis || isOwnerWebsite || isSuperadminPlatform) && (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => handleSuspend(u)}
                                  title="Nonaktifkan Akun"
                                  style={{ color: '#f59e0b', padding: '4px 8px' }}
                                >
                                  <Ban size={13} />
                                </button>
                              )}
                            </>
                          )}

                          {/* Suspended/Rejected Actions */}
                          {(u.status === 'suspended' || u.status === 'rejected') && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => openApprove(u)}
                              title="Aktifkan Kembali"
                              style={{ color: 'var(--ok)', padding: '4px 8px' }}
                            >
                              <RotateCcw size={13} />
                            </button>
                          )}

                          {/* Delete Action */}
                          {!isSelf && (!isUserOwnerWeb && !isUserOwnerBis || isOwnerWebsite || isSuperadminPlatform) && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleDelete(u)}
                              title="Hapus Pengguna"
                              style={{ color: 'var(--danger)', padding: '4px 8px' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
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

      {/* Modal Approve User */}
      {approveModalOpen && selectedUser && (
        <div className="modal-backdrop" onClick={() => setApproveModalOpen(false)}>
          <div
            className="modal-content card"
            style={{ maxWidth: 480, width: '100%', margin: '20px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} color="#10b981" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  Persetujuan Akun Pengguna
                </h3>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setApproveModalOpen(false)}
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApproveUser}>
              <div
                style={{
                  padding: '12px 14px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  marginBottom: 16
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Calon Pengguna / Staf:</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#ffffff', marginTop: 2 }}>
                  {selectedUser.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--accent-bright)' }}>
                  {selectedUser.email}
                </div>
              </div>

              {isOwnerOutlet ? (
                <div
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: 8,
                    marginBottom: 16,
                    fontSize: 13,
                    color: '#bae6fd'
                  }}
                >
                  Sebagai <strong>Owner Outlet</strong>, permohonan akun ini akan otomatis disetujui sebagai <strong>Pegawai Cabang</strong> untuk outlet <strong>{currentUser.outlet_name}</strong>.
                </div>
              ) : (
                <>
                  <div className="form-group mb-3">
                    <label className="form-label">Tetapkan Role Akses *</label>
                    <select
                      className="form-control"
                      value={approveForm.role}
                      onChange={e => setApproveForm(p => ({ ...p, role: e.target.value }))}
                      required
                    >
                      {masterRoles.length > 0 ? (
                        masterRoles.map(r => (
                          <option key={r.id} value={r.name} style={{ background: '#11162d', color: '#ffffff' }}>
                            {r.label}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="pegawai" style={{ background: '#11162d', color: '#ffffff' }}>Pegawai (Kasir & Operasional Cabang)</option>
                          <option value="owner_outlet" style={{ background: '#11162d', color: '#ffffff' }}>Owner Outlet (Pemilik Cabang)</option>
                          {isPlatformAdmin && (
                            <>
                              <option value="owner_bisnis" style={{ background: '#11162d', color: '#ffffff' }}>Owner Bisnis (Pemilik Usaha)</option>
                              <option value="owner_website" style={{ background: '#11162d', color: '#ffffff' }}>Owner Website</option>
                            </>
                          )}
                        </>
                      )}
                    </select>
                  </div>

                  <div className="form-group mb-4">
                    <label className="form-label">Penugasan Cabang Outlet</label>
                    <select
                      className="form-control"
                      value={approveForm.outlet_id}
                      onChange={e => setApproveForm(p => ({ ...p, outlet_id: e.target.value }))}
                      required
                    >
                      <option value="" style={{ background: '#11162d', color: '#ffffff' }}>-- Pilih Cabang Outlet --</option>
                      {outlets.map(o => (
                        <option key={o.id} value={o.id} style={{ background: '#11162d', color: '#ffffff' }}>
                          {o.name} {o.is_main ? '(Pusat)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex-between">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setApproveModalOpen(false)}
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#10b981', borderColor: '#10b981' }}
                  disabled={saving}
                >
                  {saving ? 'Memproses...' : (
                    <>
                      <Check size={14} /> Setujui & Aktifkan Akun
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Create User */}
      {createModalOpen && (
        <div className="modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div
            className="modal-content card"
            style={{ maxWidth: 500, width: '100%', margin: '20px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={18} color="var(--accent-bright)" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  {isOwnerOutlet ? `Tambah Pegawai Baru — ${currentUser.outlet_name}` : 'Tambah Pengguna Baru'}
                </h3>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setCreateModalOpen(false)}
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="form-group mb-3">
                <label className="form-label">Nama Lengkap *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nama staf"
                  value={createForm.name}
                  onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Alamat Email *</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="email@movapos.id"
                  value={createForm.email}
                  onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Password *</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Min. 6 karakter"
                  value={createForm.password}
                  onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))}
                  required
                />
              </div>

              {isOwnerOutlet ? (
                <div
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: 6,
                    marginBottom: 20,
                    fontSize: 12.5,
                    color: '#bae6fd'
                  }}
                >
                  Role otomatis: <strong>Pegawai Cabang</strong> & Cabang Outlet: <strong>{currentUser.outlet_name}</strong>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div className="form-group">
                    <label className="form-label">Role Akses *</label>
                    <select
                      className="form-control"
                      value={createForm.role}
                      onChange={e => setCreateForm(p => ({ ...p, role: e.target.value }))}
                      required
                    >
                      {masterRoles.length > 0 ? (
                        masterRoles.map(r => (
                          <option key={r.id} value={r.name} style={{ background: '#11162d', color: '#ffffff' }}>
                            {r.label}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="pegawai" style={{ background: '#11162d', color: '#ffffff' }}>Pegawai Cabang</option>
                          <option value="owner_outlet" style={{ background: '#11162d', color: '#ffffff' }}>Owner Outlet</option>
                          {isPlatformAdmin && (
                            <>
                              <option value="owner_bisnis" style={{ background: '#11162d', color: '#ffffff' }}>Owner Bisnis</option>
                              <option value="owner_website" style={{ background: '#11162d', color: '#ffffff' }}>Owner Website</option>
                            </>
                          )}
                        </>
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cabang Outlet</label>
                    <select
                      className="form-control"
                      value={createForm.outlet_id}
                      onChange={e => setCreateForm(p => ({ ...p, outlet_id: e.target.value }))}
                    >
                      <option value="" style={{ background: '#11162d', color: '#ffffff' }}>-- Pilih Cabang --</option>
                      {outlets.map(o => (
                        <option key={o.id} value={o.id} style={{ background: '#11162d', color: '#ffffff' }}>
                          {o.name} {o.is_main ? '(Pusat)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex-between">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Menyimpan...' : (
                    <>
                      <Check size={14} /> Tambah & Aktifkan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit User */}
      {editModalOpen && selectedUser && (
        <div className="modal-backdrop" onClick={() => setEditModalOpen(false)}>
          <div
            className="modal-content card"
            style={{ maxWidth: 500, width: '100%', margin: '20px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit2 size={18} color="var(--accent-bright)" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  Edit Pengguna: {selectedUser.name}
                </h3>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setEditModalOpen(false)}
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditUser}>
              <div className="form-group mb-3">
                <label className="form-label">Nama Lengkap</label>
                <input
                  type="text"
                  className="form-control"
                  value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={editForm.email}
                  onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Ganti Password (Opsional)</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Biarkan kosong jika tidak diganti"
                  value={editForm.password}
                  onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))}
                />
              </div>

              {!isOwnerOutlet && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div className="form-group">
                    <label className="form-label">Role Akses</label>
                    <select
                      className="form-control"
                      value={editForm.role}
                      onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                      disabled={selectedUser.id === currentUser.id}
                    >
                      {masterRoles.length > 0 ? (
                        masterRoles.map(r => (
                          <option key={r.id} value={r.name} style={{ background: '#11162d', color: '#ffffff' }}>
                            {r.label}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="pegawai" style={{ background: '#11162d', color: '#ffffff' }}>Pegawai</option>
                          <option value="owner_outlet" style={{ background: '#11162d', color: '#ffffff' }}>Owner Outlet</option>
                          {isPlatformAdmin && (
                            <>
                              <option value="owner_bisnis" style={{ background: '#11162d', color: '#ffffff' }}>Owner Bisnis</option>
                              <option value="owner_website" style={{ background: '#11162d', color: '#ffffff' }}>Owner Website</option>
                            </>
                          )}
                        </>
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cabang Outlet</label>
                    <select
                      className="form-control"
                      value={editForm.outlet_id}
                      onChange={e => setEditForm(p => ({ ...p, outlet_id: e.target.value }))}
                    >
                      <option value="" style={{ background: '#11162d', color: '#ffffff' }}>-- Semua Cabang / Pusat --</option>
                      {outlets.map(o => (
                        <option key={o.id} value={o.id} style={{ background: '#11162d', color: '#ffffff' }}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex-between">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditModalOpen(false)}
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Menyimpan...' : (
                    <>
                      <Check size={14} /> Simpan Perubahan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
