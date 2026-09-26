import { useState, useEffect } from 'react';
import {
  Store, Plus, Edit2, Trash2, CheckCircle2,
  Building2, Phone, MapPin, User, ShieldCheck, X, Check, FileSpreadsheet
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { PageHeader, LoadingState, AuditInfo, MiniCard } from '../components/ui';
import ImportMasterModal from '../components/ImportMasterModal';
import { confirmDialog } from '../utils/swal';

const emptyForm = {
  code: '',
  name: '',
  address: '',
  phone: '',
  pic_name: '',
  is_main: false,
  active: true,
};

export default function OutletManagement() {
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    fetchOutlets();
  }, []);

  async function fetchOutlets() {
    try {
      const { data } = await api.get('/outlets');
      setOutlets(data);
    } catch {
      toast.error('Gagal memuat data cabang outlet');
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    const nextNum = outlets.length + 1;
    const autoCode = `OUT-${String(nextNum).padStart(3, '0')}`;
    setEditingOutlet(null);
    setFormData({
      ...emptyForm,
      code: autoCode,
    });
    setModalOpen(true);
  }

  function openEditModal(outlet) {
    setEditingOutlet(outlet);
    setFormData({
      code: outlet.code,
      name: outlet.name,
      address: outlet.address || '',
      phone: outlet.phone || '',
      pic_name: outlet.pic_name || '',
      is_main: Boolean(outlet.is_main),
      active: Boolean(outlet.active),
    });
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error('Kode dan Nama Cabang wajib diisi!');
      return;
    }

    setSaving(true);
    try {
      if (editingOutlet) {
        const { data } = await api.put(`/outlets/${editingOutlet.id}`, formData);
        setOutlets(prev => prev.map(o => (o.id === editingOutlet.id ? data : o.id !== editingOutlet.id && data.is_main ? { ...o, is_main: false } : o)));
        toast.success(`Cabang ${data.name} berhasil diperbarui`);
      } else {
        const { data } = await api.post('/outlets', formData);
        setOutlets(prev => {
          const updated = data.is_main ? prev.map(o => ({ ...o, is_main: false })) : [...prev];
          return [...updated, data].sort((a, b) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0));
        });
        toast.success(`Cabang ${data.name} berhasil ditambahkan`);
      }
      setModalOpen(false);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) {
        Object.values(errors).flat().forEach(m => toast.error(m));
      } else {
        toast.error(err.response?.data?.message || 'Gagal menyimpan data cabang');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(outlet) {
    if (outlet.is_main) {
      toast.error('Outlet utama (pusat) tidak dapat dihapus!');
      return;
    }

    const confirmed = await confirmDialog({
      title: 'Hapus / Nonaktifkan Cabang?',
      text: `Apakah Anda yakin ingin menghapus/menonaktifkan cabang "${outlet.name}"?`,
      confirmText: 'Ya, Proses Cabang',
      cancelText: 'Batal',
      isDanger: true,
    });
    if (!confirmed) return;

    try {
      const { data } = await api.delete(`/outlets/${outlet.id}`);
      toast.success(data.message || 'Cabang berhasil diproses');
      fetchOutlets();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus cabang');
    }
  }

  if (loading) return <LoadingState />;

  const mainOutlet = outlets.find(o => o.is_main);
  const activeCount = outlets.filter(o => o.active).length;

  return (
    <div className="fade-in">
      <PageHeader
        title="Master Cabang Outlet & Gudang"
        subtitle="Kelola data cabang outlet, gudang utama/pusat, kontak, dan alokasi transfer bahan baku."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowImportModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}
            >
              <FileSpreadsheet size={14} />
              Import Excel
            </button>
            <button className="btn btn-primary" onClick={openCreateModal}>
              + Tambah Cabang Baru
            </button>
          </div>
        }
      />

      {/* Mini Stats */}
      <div className="grid-3 mb-6">
        <MiniCard
          label="Total Jaringan Cabang"
          value={`${outlets.length} Outlet`}
          color="var(--accent)"
        />
        <MiniCard
          label="Outlet Pusat / Gudang Utama"
          value={mainOutlet ? mainOutlet.name : 'Belum Ditentukan'}
          color="var(--accent-bright)"
        />
        <MiniCard
          label="Status Operasional"
          value={`${activeCount} dari ${outlets.length} Aktif`}
          color="var(--ok)"
        />
      </div>

      {/* Outlets Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Daftar Cabang & Gudang MOVA POS</div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Menampilkan <strong>{outlets.length}</strong> outlet
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 90 }}>Kode</th>
                <th style={{ minWidth: 180 }}>Nama Cabang</th>
                <th style={{ minWidth: 140 }}>Penanggung Jawab (PIC)</th>
                <th style={{ minWidth: 130 }}>Kontak / Telepon</th>
                <th style={{ minWidth: 200 }}>Alamat Lokasi</th>
                <th style={{ width: 100 }} className="center">Status</th>
                <th style={{ minWidth: 160 }}>Riwayat Audit</th>
                <th style={{ width: 110 }} className="center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {outlets.map(outlet => (
                <tr key={outlet.id} style={{ opacity: outlet.active ? 1 : 0.65 }}>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                    {outlet.code}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{outlet.name}</span>
                      {outlet.is_main && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: 'rgba(99, 102, 241, 0.2)',
                            color: '#c7d2fe',
                            border: '1px solid rgba(165, 180, 252, 0.3)',
                            fontWeight: 600,
                            letterSpacing: '0.04em'
                          }}
                        >
                          PUSAT / GUDANG
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                      <User size={13} color="var(--text-muted)" />
                      <span>{outlet.pic_name || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                      <Phone size={13} color="var(--text-muted)" />
                      <span>{outlet.phone || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <MapPin size={13} color="var(--text-muted)" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span>{outlet.address || '—'}</span>
                    </div>
                  </td>
                  <td className="center">
                    {outlet.active ? (
                      <span className="pill pill-ok" style={{ fontSize: 10.5 }}>Aktif</span>
                    ) : (
                      <span className="pill pill-muted" style={{ fontSize: 10.5 }}>Non-Aktif</span>
                    )}
                  </td>
                  <td>
                    <AuditInfo
                      createdAt={outlet.created_at}
                      createdBy={outlet.created_by_name}
                      updatedAt={outlet.updated_at}
                      updatedBy={outlet.updated_by_name}
                    />
                  </td>
                  <td className="center">
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEditModal(outlet)}
                        title="Edit Data Cabang"
                        style={{ padding: '4px 8px' }}
                      >
                        <Edit2 size={13} />
                      </button>
                      {!outlet.is_main && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDelete(outlet)}
                          title="Hapus / Nonaktifkan Cabang"
                          style={{ padding: '4px 8px', color: 'var(--danger)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div
            className="modal-content card"
            style={{ maxWidth: 520, width: '100%', margin: '20px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Store size={18} color="var(--accent-bright)" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                  {editingOutlet ? `Edit Cabang: ${editingOutlet.name}` : 'Tambah Cabang Outlet Baru'}
                </h3>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setModalOpen(false)}
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">Kode Cabang *</label>
                  <input
                    type="text"
                    className="form-control mono"
                    value={formData.code}
                    onChange={e => setFormData(p => ({ ...p, code: e.target.value }))}
                    placeholder="OUT-001"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nama Cabang / Outlet *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Contoh: Outlet Pettarani"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">Penanggung Jawab (PIC)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.pic_name}
                    onChange={e => setFormData(p => ({ ...p, pic_name: e.target.value }))}
                    placeholder="Nama Store Manager"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">No. Telepon / WhatsApp</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.phone}
                    onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                    placeholder="0812-xxxx-xxxx"
                  />
                </div>
              </div>

              <div className="form-group mb-4">
                <label className="form-label">Alamat Lengkap</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={formData.address}
                  onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                  placeholder="Jl. Nama Jalan No. XX, Kota"
                />
              </div>

              {/* Checkboxes */}
              <div
                style={{
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  marginBottom: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={formData.is_main}
                    onChange={e => setFormData(p => ({ ...p, is_main: e.target.checked }))}
                  />
                  <span>
                    <strong>Jadikan Outlet Pusat (Gudang Utama)</strong>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                      Outlet utama menjadi sumber utama default pengiriman bahan baku ke cabang lain.
                    </span>
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={e => setFormData(p => ({ ...p, active: e.target.checked }))}
                  />
                  <span>
                    <strong>Cabang Aktif</strong> (dapat dipilih saat transfer bahan dan operasional)
                  </span>
                </label>
              </div>

              <div className="flex-between">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Menyimpan...' : 'Simpan Cabang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ImportMasterModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        targetMaster="OUTLET"
        onSuccess={() => {
          fetchOutlets();
        }}
      />
    </div>
  );
}
