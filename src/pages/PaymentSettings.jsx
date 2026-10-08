import { useState, useEffect } from 'react';
import api, { getMediaUrl } from '../api/client';
import { PageHeader, LoadingState } from '../components/ui';
import { useOutlet } from '../context/OutletContext';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/swal';
import {
  QrCode,
  Plus,
  Edit2,
  Trash2,
  Star,
  Upload,
  Eye,
  Store,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function PaymentSettings() {
  const { currentBusiness } = useOutlet();
  const [loading, setLoading] = useState(false);
  const [qrisList, setQrisList] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [previewQrModal, setPreviewQrModal] = useState(null);

  const [formAccount, setFormAccount] = useState({
    bank_name: '',
    qr_image_url: '',
    is_primary: false,
    notes: '',
  });

  useEffect(() => {
    fetchQrisList();
  }, []);

  async function fetchQrisList() {
    setLoading(true);
    try {
      const { data } = await api.get('/bank-accounts');
      setQrisList(data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat daftar QRIS toko');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreateModal() {
    setEditingAccount(null);
    setFormAccount({
      bank_name: '',
      qr_image_url: '',
      is_primary: qrisList.length === 0,
      notes: '',
    });
    setModalOpen(true);
  }

  function handleOpenEditModal(acc) {
    setEditingAccount(acc);
    setFormAccount({
      bank_name: acc.bank_name !== 'QRIS Toko' ? (acc.bank_name || '') : '',
      qr_image_url: acc.qr_image_url || '',
      is_primary: !!acc.is_primary,
      notes: acc.notes || '',
    });
    setModalOpen(true);
  }

  async function handleSaveAccount(e) {
    e.preventDefault();
    if (!formAccount.qr_image_url) {
      toast.error('Silakan upload file foto / gambar stiker QRIS Toko terlebih dahulu');
      return;
    }

    try {
      const labelName = formAccount.bank_name.trim() || 'QRIS Toko';
      const payload = {
        bank_name: labelName,
        bank_code: 'QRIS',
        account_number: 'QRIS',
        account_holder: currentBusiness?.name || 'QRIS Toko',
        branch: '',
        outlet_id: null, // Berlaku untuk semua cabang secara global
        account_type: 'BANK',
        qr_image_url: formAccount.qr_image_url,
        is_primary: formAccount.is_primary,
        notes: formAccount.notes,
      };

      if (editingAccount) {
        await api.put(`/bank-accounts/${editingAccount.id}`, payload);
        toast.success('Stiker QRIS berhasil diperbarui');
      } else {
        await api.post('/bank-accounts', payload);
        toast.success('Stiker QRIS berhasil ditambahkan');
      }

      setModalOpen(false);
      fetchQrisList();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gagal menyimpan stiker QRIS');
    }
  }

  async function handleDeleteAccount(id, name) {
    const ok = await confirmDialog({
      title: 'Hapus Stiker QRIS?',
      text: `Apakah Anda yakin ingin menghapus stiker QRIS "${name || 'QRIS Toko'}"?`,
      confirmButtonText: 'Ya, Hapus',
      confirmButtonColor: '#e11d48',
    });
    if (!ok) return;

    try {
      await api.delete(`/bank-accounts/${id}`);
      toast.success('Stiker QRIS berhasil dihapus');
      fetchQrisList();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus stiker QRIS');
    }
  }

  async function handleSetPrimary(id) {
    try {
      await api.patch(`/bank-accounts/${id}/set-primary`);
      toast.success('Berhasil disetel sebagai QRIS Utama Kasir');
      fetchQrisList();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyetel QRIS utama');
    }
  }

  async function handleToggleActive(id) {
    try {
      await api.patch(`/bank-accounts/${id}/toggle-active`);
      toast.success('Status aktif QRIS berhasil diubah');
      fetchQrisList();
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengubah status aktif');
    }
  }

  return (
    <div>
      {/* Page Header */}
      <PageHeader
        title="Stiker QRIS Toko & Kasir POS"
        subtitle="Upload dan kelola stiker barcode QRIS toko Anda agar otomatis tampil di layar kasir POS saat pembayaran QRIS."
        actions={
          <button
            className="btn btn-primary"
            onClick={handleOpenCreateModal}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Plus size={16} /> Upload QRIS Toko
          </button>
        }
      />

      {/* Mekanisme QRIS & Kas Aplikasi Banner */}
      <div
        className="card mb-4"
        style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(16, 185, 129, 0.08))',
          borderRadius: 14,
          border: '1.5px solid rgba(99, 102, 241, 0.35)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: 'rgba(99, 102, 241, 0.2)',
            color: 'var(--accent-bright)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <QrCode size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
              Mekanisme Pembayaran QRIS Kasir &amp; Kas Aplikasi
            </span>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 6,
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                fontWeight: 700,
              }}
            >
              Bisnis: {currentBusiness?.name || 'Maroa F&B Group'}
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.6 }}>
            Cukup unggah foto / gambar stiker barcode QRIS toko Anda di bawah ini. Ketika kasir memilih metode pembayaran <strong>QRIS</strong>, barcode ini akan langsung muncul di layar untuk discan oleh customer. Seluruh penerimaan dana non-tunai otomatis terpusat masuk ke akun <strong>Kas Aplikasi</strong>.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState text="Memuat daftar QRIS toko..." />
      ) : qrisList.length === 0 ? (
        <div
          className="card text-center"
          style={{
            padding: '50px 20px',
            borderRadius: 16,
            background: 'rgba(15, 20, 42, 0.5)',
            border: '1.5px dashed var(--border)',
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.12)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <QrCode size={34} />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#ffffff', margin: '0 0 6px' }}>
            Belum Ada Stiker QRIS Terdaftar
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto 20px', lineHeight: 1.5 }}>
            Unggah foto atau stiker QRIS toko Anda agar kasir POS dapat langsung menampilkan barcode pembayaran saat customer membayar dengan QRIS.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenCreateModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Plus size={16} /> Upload QRIS Toko
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 18,
          }}
        >
          {qrisList.map((acc) => {
            const label = acc.bank_name || 'QRIS Toko';

            return (
              <div
                key={acc.id}
                className="card"
                style={{
                  padding: 0,
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: acc.is_primary ? '2px solid rgba(99, 102, 241, 0.6)' : '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  boxShadow: acc.is_primary ? '0 8px 24px rgba(99, 102, 241, 0.15)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {/* Header Card */}
                <div
                  style={{
                    padding: '16px 18px',
                    background: acc.is_primary
                      ? 'linear-gradient(135deg, #1e1b4b, #312e81)'
                      : 'linear-gradient(135deg, #0f172a, #1e293b)',
                    color: '#ffffff',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, opacity: 0.85, letterSpacing: '0.05em' }}>
                        <QrCode size={14} color="#38bdf8" /> STIKER QRIS TOKO
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>
                        {label}
                      </div>
                    </div>

                    {acc.is_primary ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: 'rgba(99, 102, 241, 0.3)',
                          border: '1px solid rgba(99, 102, 241, 0.5)',
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#a5b4fc',
                        }}
                      >
                        <Star size={12} fill="#a5b4fc" /> QRIS Utama
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        QRIS Cadangan
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body with QR Preview */}
                <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* QR Image Frame */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: 12,
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 8,
                        background: '#ffffff',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0,
                        cursor: acc.qr_image_url ? 'pointer' : 'default',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      }}
                      onClick={() => acc.qr_image_url && setPreviewQrModal({ name: label, url: acc.qr_image_url })}
                      title={acc.qr_image_url ? 'Klik untuk memperbesar gambar QRIS' : ''}
                    >
                      {acc.qr_image_url ? (
                        <img
                          src={getMediaUrl(acc.qr_image_url)}
                          alt="QRIS Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          onError={(e) => {
                            if (!e.target.dataset.triedFallback && acc.qr_image_url.startsWith('/storage/')) {
                              e.target.dataset.triedFallback = 'true';
                              e.target.src = getMediaUrl('/api' + acc.qr_image_url);
                            }
                          }}
                        />
                      ) : (
                        <QrCode size={30} color="#94a3b8" />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: acc.qr_image_url ? '#38bdf8' : '#f59e0b', marginBottom: 3 }}>
                        {acc.qr_image_url ? '✓ Barcode QR Terpasang' : '⚠️ Belum Ada Gambar QR'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {acc.qr_image_url
                          ? 'Tampil otomatis di layar kasir POS saat pembayaran QRIS.'
                          : 'Klik edit untuk mengunggah gambar QRIS toko.'}
                      </div>

                      {acc.qr_image_url && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setPreviewQrModal({ name: label, url: acc.qr_image_url })}
                          style={{ padding: '2px 0', fontSize: 11, color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}
                        >
                          <Eye size={12} /> Perbesar Gambar QRIS
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Branch & Global Scope Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <Store size={13} color="var(--accent-bright)" />
                    <span>Berlaku untuk: <strong style={{ color: '#38bdf8' }}>Semua Cabang (Global Usaha)</strong></span>
                  </div>

                  {acc.notes && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      "{acc.notes}"
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: 12,
                      borderTop: '1px solid var(--border)',
                      marginTop: 'auto',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {!acc.is_primary && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleSetPrimary(acc.id)}
                          style={{ fontSize: 11 }}
                          title="Jadikan sebagai QRIS utama di kasir"
                        >
                          <Star size={12} /> Set Utama
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleToggleActive(acc.id)}
                        style={{
                          fontSize: 11,
                          color: acc.is_active ? '#34d399' : 'var(--text-muted)',
                        }}
                      >
                        {acc.is_active ? '✓ Aktif di POS' : 'Nonaktif'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenEditModal(acc)}
                        title="Edit / Ganti Gambar QRIS"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteAccount(acc.id, label)}
                        title="Hapus Stiker QRIS"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================
          MODAL: UPLOAD / EDIT STIKER QRIS TOKO
          ======================================================== */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <QrCode size={18} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ margin: 0, fontSize: 16 }}>
                    {editingAccount ? 'Edit Stiker QRIS Toko' : 'Upload Stiker QRIS Toko'}
                  </h3>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Penerimaan pembayaran QRIS di layar kasir POS
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setModalOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveAccount} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* QRIS Image Upload & Live Preview */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Upload Foto / Stiker Barcode QRIS Toko *</span>
                  {formAccount.qr_image_url && (
                    <button
                      type="button"
                      onClick={() => setFormAccount({ ...formAccount, qr_image_url: '' })}
                      style={{ background: 'transparent', border: 'none', color: '#f43f5e', fontSize: 11.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Trash2 size={12} /> Hapus Foto
                    </button>
                  )}
                </label>

                {formAccount.qr_image_url ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: 14,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      borderRadius: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 90,
                        height: 90,
                        borderRadius: 8,
                        background: '#ffffff',
                        padding: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      }}
                    >
                      <img
                        src={getMediaUrl(formAccount.qr_image_url)}
                        alt="QRIS Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        onError={(e) => {
                          if (!e.target.dataset.triedFallback && formAccount.qr_image_url.startsWith('/storage/')) {
                            e.target.dataset.triedFallback = 'true';
                            e.target.src = getMediaUrl('/api' + formAccount.qr_image_url);
                          }
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', marginBottom: 2 }}>
                        ✓ Gambar QRIS Terpasang
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                        Barcode ini akan otomatis tampil di layar kasir POS saat pembayaran QRIS.
                      </div>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 12px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          borderRadius: 6,
                          color: '#38bdf8',
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <Upload size={13} /> Ganti Gambar QRIS
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (re) => {
                                setFormAccount((prev) => ({ ...prev, qr_image_url: re.target.result }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      border: '2px dashed rgba(56, 189, 248, 0.35)',
                      borderRadius: 10,
                      padding: '24px 16px',
                      textAlign: 'center',
                      background: 'rgba(56, 189, 248, 0.02)',
                    }}
                  >
                    <QrCode size={36} color="#38bdf8" style={{ margin: '0 auto 10px', opacity: 0.9 }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>
                      Pilih Foto / Gambar Stiker QRIS Toko
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 14 }}>
                      Format PNG, JPG, JPEG, WebP (Maks 5 MB)
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 18px',
                          background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                          color: '#ffffff',
                          borderRadius: 8,
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)',
                        }}
                      >
                        <Upload size={15} /> Pilih File Gambar QRIS
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (re) => {
                                setFormAccount((prev) => ({ ...prev, qr_image_url: re.target.result }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Label / Nama QRIS */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nama / Label QRIS (Opsional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: QRIS Utama Kasir / QRIS Toko"
                  value={formAccount.bank_name}
                  onChange={(e) => setFormAccount({ ...formAccount, bank_name: e.target.value })}
                />
              </div>

              {/* Catatan */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: Stiker QRIS barcode kasir depan"
                  value={formAccount.notes}
                  onChange={(e) => setFormAccount({ ...formAccount, notes: e.target.value })}
                />
              </div>

              {/* Berlaku untuk Semua Cabang Notice */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#38bdf8',
                }}
              >
                <Store size={18} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700 }}>Berlaku Global untuk Semua Cabang</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    QRIS ini otomatis aktif dan dapat digunakan di layar kasir semua cabang usaha Anda.
                  </div>
                </div>
              </div>

              {/* Primary Toggle */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={formAccount.is_primary}
                  onChange={(e) => setFormAccount({ ...formAccount, is_primary: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                    Jadikan QRIS Utama di Kasir POS
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Otomatis langsung dimunculkan saat kasir memilih pembayaran QRIS
                  </div>
                </div>
              </label>

              <div className="modal-actions" style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }}>
                  {editingAccount ? 'Simpan Perubahan' : 'Upload & Simpan QRIS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: PREVIEW GAMBAR QRIS FULL
          ======================================================== */}
      {previewQrModal && (
        <div className="modal-backdrop" onClick={() => setPreviewQrModal(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: 380, textAlign: 'center', padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
                Preview QRIS — {previewQrModal.name}
              </div>
              <button className="modal-close" onClick={() => setPreviewQrModal(null)}>
                &times;
              </button>
            </div>

            <div
              style={{
                background: '#ffffff',
                padding: 16,
                borderRadius: 12,
                display: 'inline-block',
                margin: '0 auto 12px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
              }}
            >
              <img
                src={getMediaUrl(previewQrModal.url)}
                alt="QRIS Full"
                style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain', display: 'block' }}
                onError={(e) => {
                  if (!e.target.dataset.triedFallback && previewQrModal.url.startsWith('/storage/')) {
                    e.target.dataset.triedFallback = 'true';
                    e.target.src = getMediaUrl('/api' + previewQrModal.url);
                  }
                }}
              />
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              QRIS ini akan ditampilkan kepada customer di layar kasir POS.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
