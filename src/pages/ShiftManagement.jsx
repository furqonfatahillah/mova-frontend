import { useState, useEffect } from 'react';
import {
  Clock, Plus, CheckCircle, AlertTriangle, ArrowRight, DollarSign,
  Receipt, ShoppingBag, Eye, Calendar, User, RefreshCw, X, FileText, Store
} from 'lucide-react';
import api from '../api/client';
import { rupiah, num, PageHeader, LoadingState, MiniCard } from '../components/ui';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';

export default function ShiftManagement() {
  const { activeOutletId, activeOutlet, outlets, isOwnerWebsite, isOwnerOutlet, changeOutlet } = useOutlet();

  const [selectedOutlet, setSelectedOutlet] = useState(() => {
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      return Number(activeOutletId);
    }
    return outlets.find(o => o.is_main)?.id || outlets[0]?.id || 1;
  });

  // Keep in sync if activeOutletId changes from header navigation
  useEffect(() => {
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      setSelectedOutlet(Number(activeOutletId));
    }
  }, [activeOutletId]);

  const [activeData, setActiveData] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeSummary, setCloseSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Detail Modal
  const [detailShift, setDetailShift] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Form Open Shift
  const [openForm, setOpenForm] = useState({
    shift_name: 'Shift 1 (Pagi)',
    initial_cash: 100000,
    notes: '',
    outlet_id: selectedOutlet || 1,
  });
  const [submittingOpen, setSubmittingOpen] = useState(false);

  // Form Close Shift
  const [closeForm, setCloseForm] = useState({
    closing_cash: '',
    notes: '',
  });
  const [submittingClose, setSubmittingClose] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filterStatus, selectedOutlet]);

  async function fetchData() {
    setLoading(true);
    try {
      const targetOutlet = selectedOutlet || (outlets.find(o => o.is_main)?.id || outlets[0]?.id || 1);
      const [activeRes, listRes] = await Promise.all([
        api.get('/shifts/active', { params: { outlet_id: targetOutlet } }),
        api.get('/shifts', {
          params: {
            status: filterStatus || undefined,
            outlet_id: targetOutlet || undefined,
          }
        }),
      ]);
      setActiveData(activeRes.data);
      setShifts(listRes.data);
    } catch {
      toast.error('Gagal memuat data shift');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const targetOutlet = selectedOutlet || (outlets.find(o => o.is_main)?.id || outlets[0]?.id || 1);
      const [activeRes, listRes] = await Promise.all([
        api.get('/shifts/active', { params: { outlet_id: targetOutlet } }),
        api.get('/shifts', {
          params: {
            status: filterStatus || undefined,
            outlet_id: targetOutlet || undefined,
          }
        }),
      ]);
      setActiveData(activeRes.data);
      setShifts(listRes.data);
      toast.success('Data shift diperbarui');
    } catch {
      toast.error('Gagal memperbarui data shift');
    } finally {
      setRefreshing(false);
    }
  }

  function handleOpenModalClick() {
    setOpenForm(p => ({
      ...p,
      outlet_id: selectedOutlet || (outlets.find(o => o.is_main)?.id || outlets[0]?.id || 1),
    }));
    setShowOpenModal(true);
  }

  async function handleOpenShiftSubmit(e) {
    e.preventDefault();
    setSubmittingOpen(true);
    try {
      const payload = {
        ...openForm,
        outlet_id: Number(openForm.outlet_id),
      };
      const { data } = await api.post('/shifts/open', payload);
      toast.success(`Shift ${data.shift_name} berhasil dibuka di ${data.outlet?.name || 'cabang'}!`);
      setShowOpenModal(false);
      setOpenForm(p => ({ ...p, shift_name: 'Shift 1 (Pagi)', initial_cash: 100000, notes: '', outlet_id: selectedOutlet }));
      if (Number(data.outlet_id) !== Number(selectedOutlet)) {
        setSelectedOutlet(Number(data.outlet_id));
      } else {
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membuka shift');
    } finally {
      setSubmittingOpen(false);
    }
  }

  async function handlePrepareClosing() {
    if (!activeData?.shift) return;
    setShowCloseModal(true);
    setLoadingSummary(true);
    setCloseForm({
      closing_cash: activeData.expected_cash || 0,
      notes: '',
    });
    try {
      const { data } = await api.get(`/shifts/${activeData.shift.id}/summary`);
      setCloseSummary(data);
    } catch {
      toast.error('Gagal memuat ringkasan closing shift');
      setShowCloseModal(false);
    } finally {
      setLoadingSummary(false);
    }
  }

  async function handleCloseShiftSubmit(e) {
    e.preventDefault();
    if (!activeData?.shift) return;
    setSubmittingClose(true);
    try {
      const { data } = await api.post(`/shifts/${activeData.shift.id}/close`, {
        closing_cash: Number(closeForm.closing_cash),
        notes: closeForm.notes,
      });
      toast.success(`Shift #${activeData.shift.id} berhasil ditutup! ${data.movements_count} bahan dibukukan ke Kartu Stok.`);
      setShowCloseModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menutup shift');
    } finally {
      setSubmittingClose(false);
    }
  }

  async function handleViewDetail(shift) {
    setDetailShift(shift);
    setLoadingDetail(true);
    try {
      const [sumRes, trxRes] = await Promise.all([
        api.get(`/shifts/${shift.id}/summary`),
        api.get(`/shifts/${shift.id}/transactions`),
      ]);
      setDetailData({
        summary: sumRes.data,
        transactions: trxRes.data.transactions,
      });
    } catch {
      toast.error('Gagal memuat rincian shift');
    } finally {
      setLoadingDetail(false);
    }
  }

  const activeShift = activeData?.shift;

  if (loading) return <LoadingState />;

  return (
    <div className="fade-in">
      <PageHeader
        title="Manajemen Shift & Closing Kasir"
        subtitle="Kelola sesi kasir, kontrol uang laci, dan totalkan pemakaian bahan baku otomatis ke Kartu Stok saat shift ditutup."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Segarkan
            </button>
            {!activeShift ? (
              <button className="btn btn-primary" onClick={handleOpenModalClick}>
                <Plus size={15} /> Buka Shift Baru
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handlePrepareClosing}>
                <CheckCircle size={15} /> Closing Shift Aktif
              </button>
            )}
          </div>
        }
      />

      {/* Outlet Selector Bar for Shift Operations */}
      <div className="card mb-4" style={{
        padding: '12px 18px',
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.45) 0%, rgba(15, 23, 42, 0.8) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(139, 92, 246, 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-bright)'
          }}>
            <Store size={18} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Cabang Operasional Kasir:</span>
              <span style={{ color: 'var(--accent-bright)', fontWeight: 800, fontSize: 14 }}>
                {outlets.find(o => Number(o.id) === Number(selectedOutlet))?.name || 'Cabang Terpilih'}
              </span>
              {outlets.find(o => Number(o.id) === Number(selectedOutlet))?.is_main ? (
                <span className="pill pill-accent mono" style={{ fontSize: 10 }}>Pusat</span>
              ) : (
                <span className="pill pill-ok mono" style={{ fontSize: 10 }}>Cabang</span>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Sesi kasir dan modal uang laci dibuka secara independen per masing-masing cabang.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ganti Cabang:</label>
          <select
            className="form-control"
            style={{ width: '100%', maxWidth: 240, minWidth: 160, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, borderColor: 'var(--accent-bright)' }}
            value={selectedOutlet}
            onChange={e => {
              const val = Number(e.target.value);
              setSelectedOutlet(val);
              changeOutlet(val);
            }}
            disabled={isOwnerOutlet}
          >
            {outlets.map(o => (
              <option key={o.id} value={o.id} style={{ background: '#11162d', color: '#ffffff' }}>
                {o.name} {o.is_main ? '(Pusat)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hero Active Shift Card */}
      {activeShift ? (
        <div className="card mb-6" style={{
          background: 'linear-gradient(135deg, rgba(26, 33, 68, 0.9) 0%, rgba(18, 23, 46, 0.95) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          boxShadow: '0 8px 30px rgba(124, 58, 237, 0.18)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 4,
            background: 'var(--accent-gradient)'
          }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span className="pill pill-ok" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)' }} />
                  SHIFT SEDANG AKTIF · {activeShift.outlet?.name || outlets.find(o => Number(o.id) === Number(activeShift.outlet_id))?.name || 'Pusat'}
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  #{activeShift.id}
                </span>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                {activeShift.shift_name}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                Kasir: <strong style={{ color: '#ffffff' }}>{activeShift.user?.name}</strong> · Dibuka: <span className="mono" style={{ color: 'var(--accent-bright)' }}>{new Date(activeShift.opened_at).toLocaleString('id-ID')}</span>
                {activeShift.notes && <span> · Catatan: <em>{activeShift.notes}</em></span>}
              </p>
            </div>

            <button className="btn btn-primary" onClick={handlePrepareClosing} style={{ padding: '10px 20px', fontSize: 13.5 }}>
              <CheckCircle size={16} /> Closing Shift Sekarang
            </button>
          </div>

          {/* Metric Cards */}
          <div className="grid-4 gap-3">
            <MiniCard
              label="Modal Awal Kas"
              value={rupiah(activeShift.initial_cash)}
              color="var(--accent-bright)"
            />
            <MiniCard
              label="Total Transaksi"
              value={`${num(activeData.total_transactions)} trx`}
              color="#ffffff"
            />
            <MiniCard
              label="Total Penjualan"
              value={rupiah(activeData.total_sales)}
              color="var(--ok)"
            />
            <MiniCard
              label="Estimasi Kas di Laci"
              value={rupiah(activeData.expected_cash)}
              color="var(--accent-bright)"
            />
          </div>
        </div>
      ) : (
        <div className="card mb-6" style={{
          padding: '36px 24px',
          textAlign: 'center',
          background: 'rgba(23, 28, 56, 0.5)',
          border: '1px dashed var(--border-strong)',
          borderRadius: 16,
        }}>
          <div style={{
            width: 54, height: 54, borderRadius: 16, background: 'var(--accent-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            color: 'var(--accent-bright)'
          }}>
            <Clock size={28} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
            Belum Ada Shift Kasir yang Dibuka di {outlets.find(o => Number(o.id) === Number(selectedOutlet))?.name || 'Cabang Ini'}
          </h3>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 20px', lineHeight: 1.6 }}>
            Buka shift terlebih dahulu agar kasir di <strong>{outlets.find(o => Number(o.id) === Number(selectedOutlet))?.name || 'cabang ini'}</strong> dapat melayani transaksi POS. Setiap penjualan selama shift akan ditampung dan diakumulasikan secara otomatis saat closing shift.
          </p>
          <button className="btn btn-primary" onClick={handleOpenModalClick} style={{ padding: '10px 24px' }}>
            <Plus size={16} /> Buka Shift di {outlets.find(o => Number(o.id) === Number(selectedOutlet))?.name || 'Cabang Ini'}
          </button>
        </div>
      )}

      {/* Riwayat Shift Table */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Riwayat Sesi Shift</h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>Daftar shift yang telah dibuka dan ditutup beserta rekonsiliasi kas dan stok.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Status:</span>
            <select
              className="form-control"
              style={{ width: 140, padding: '6px 10px', fontSize: 12 }}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">Semua Status</option>
              <option value="OPEN">Aktif (Open)</option>
              <option value="CLOSED">Selesai (Closed)</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 70 }}>ID</th>
                <th>Shift & Karyawan</th>
                <th style={{ width: 140 }}>Cabang Outlet</th>
                <th>Waktu Buka / Tutup</th>
                <th className="right">Modal Awal</th>
                <th className="right">Total Omzet</th>
                <th className="right">Uang Fisik</th>
                <th className="right">Selisih Kas</th>
                <th className="center">Status</th>
                <th className="center" style={{ width: 100 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {shifts.length > 0 ? (
                shifts.map((s) => {
                  const diff = s.cash_difference ?? 0;
                  return (
                    <tr key={s.id}>
                      <td className="mono" style={{ fontWeight: 600, color: 'var(--accent-bright)' }}>
                        #{s.id}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#ffffff' }}>{s.shift_name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          Kasir: {s.user?.name || 'Kasir'} · {s.transactions_count || 0} trx
                        </div>
                      </td>
                      <td>
                        <span className="pill pill-muted mono" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Store size={11} style={{ color: 'var(--accent-bright)' }} />
                          {s.outlet?.name || outlets.find(o => Number(o.id) === Number(s.outlet_id))?.name || 'Pusat'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Buka:</span> {new Date(s.opened_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}> ({s.created_by_name || s.user?.name})</span>
                        </div>
                        {s.closed_at ? (
                          <div style={{ color: 'var(--accent-bright)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Tutup:</span> {new Date(s.closed_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                            <span style={{ fontSize: 11 }}> ({s.updated_by_name || s.closed_by_user?.name || s.closedByUser?.name || 'Kasir'})</span>
                          </div>
                        ) : (
                          <div style={{ color: 'var(--ok)', fontSize: 11, fontWeight: 500 }}>● Masih Berjalan</div>
                        )}
                      </td>
                      <td className="mono right" style={{ color: 'var(--text-secondary)' }}>
                        {rupiah(s.initial_cash)}
                      </td>
                      <td className="mono right" style={{ fontWeight: 600, color: '#ffffff' }}>
                        {rupiah(s.system_cash)}
                      </td>
                      <td className="mono right">
                        {s.closing_cash !== null ? rupiah(s.closing_cash) : '—'}
                      </td>
                      <td className="mono right">
                        {s.status === 'CLOSED' ? (
                          <span style={{
                            color: diff === 0 ? 'var(--ok)' : diff > 0 ? '#38bdf8' : 'var(--danger)',
                            fontWeight: 600,
                          }}>
                            {diff > 0 ? `+${rupiah(diff)}` : diff < 0 ? rupiah(diff) : 'Pas (Rp 0)'}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td className="center">
                        <span className={`pill pill-${s.status === 'OPEN' ? 'ok' : 'muted'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="center">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewDetail(s)}
                          title="Lihat rincian transaksi dan pemakaian bahan shift ini"
                        >
                          <Eye size={13} /> Rincian
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                    Belum ada riwayat shift yang tercatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Buka Shift */}
      {showOpenModal && (
        <div className="modal-overlay" onClick={() => setShowOpenModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} style={{ color: 'var(--accent-bright)' }} />
                Buka Shift Kasir Baru
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowOpenModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleOpenShiftSubmit}>
              <div className="modal-body">
                {/* Cabang Outlet Selector */}
                <div className="form-group mb-3">
                  <label className="form-label" style={{ fontWeight: 700, color: '#ffffff' }}>Cabang / Outlet Penugasan *</label>
                  <select
                    className="form-control"
                    style={{ fontSize: 13, fontWeight: 600, borderColor: 'var(--accent-bright)' }}
                    value={openForm.outlet_id}
                    onChange={e => setOpenForm(f => ({ ...f, outlet_id: Number(e.target.value) }))}
                    disabled={isOwnerOutlet}
                    required
                  >
                    {outlets.map(o => (
                      <option key={o.id} value={o.id} style={{ background: '#11162d', color: '#ffffff' }}>
                        {o.name} {o.is_main ? '(Pusat)' : ''}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Shift kasir ini akan dibuka untuk operasional <strong>{outlets.find(o => Number(o.id) === Number(openForm.outlet_id))?.name || 'cabang terpilih'}</strong>.
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Pilihan Cepat Shift:</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['Shift 1 (Pagi)', 'Shift 2 (Siang/Sore)', 'Shift 3 (Malam)'].map(name => (
                      <button
                        type="button"
                        key={name}
                        className={`btn btn-sm ${openForm.shift_name === name ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setOpenForm(f => ({ ...f, shift_name: name }))}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nama Shift</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={openForm.shift_name}
                    onChange={e => setOpenForm(f => ({ ...f, shift_name: e.target.value }))}
                    placeholder="Contoh: Shift 1 (Pagi)"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Modal Awal Kas di Laci (Uang Kembalian)</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    className="form-control"
                    required
                    value={openForm.initial_cash}
                    onChange={e => setOpenForm(f => ({ ...f, initial_cash: e.target.value }))}
                    placeholder="100000"
                  />
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Terbaca: <strong style={{ color: 'var(--accent-bright)' }}>{rupiah(openForm.initial_cash)}</strong>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Catatan Pembukaan (Opsional)</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    value={openForm.notes}
                    onChange={e => setOpenForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Kondisi laci kasir, serah terima, dll."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowOpenModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingOpen}>
                  {submittingOpen ? 'Membuka...' : 'Konfirmasi Buka Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Closing Shift */}
      {showCloseModal && (
        <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
          <div className="modal-content" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={18} style={{ color: 'var(--ok)' }} />
                Closing Shift #{activeShift?.id} — {activeShift?.shift_name}
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCloseModal(false)}>
                <X size={18} />
              </button>
            </div>

            {loadingSummary ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <LoadingState />
              </div>
            ) : (
              <form onSubmit={handleCloseShiftSubmit}>
                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  {/* Rekonsiliasi Kas Card */}
                  <div style={{
                    background: 'rgba(15, 20, 42, 0.7)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '16px',
                    marginBottom: 16
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                      Rekapitulasi Kas Sistem
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Modal Awal Kasir:</span>
                      <span className="mono" style={{ fontWeight: 600 }}>{rupiah(closeSummary?.shift?.initial_cash)}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Penjualan POS ({closeSummary?.total_transactions || 0} transaksi):</span>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--ok)' }}>+{rupiah(closeSummary?.total_sales)}</span>
                    </div>

                    <div style={{
                      display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 8,
                      borderTop: '1px dashed var(--border-strong)', fontSize: 14, fontWeight: 700
                    }}>
                      <span>Kas Sistem yang Harus Ada:</span>
                      <span className="mono" style={{ color: 'var(--accent-bright)' }}>{rupiah(closeSummary?.expected_cash)}</span>
                    </div>
                  </div>

                  {/* Input Kas Aktual */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                      Jumlah Kas Aktual di Laci (Uang Fisik Saat Ini)
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="form-control"
                      style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-bright)' }}
                      required
                      value={closeForm.closing_cash}
                      onChange={e => setCloseForm(f => ({ ...f, closing_cash: e.target.value }))}
                      placeholder="Masukkan total uang tunai di laci"
                    />

                    {/* Diff Indicator */}
                    {closeForm.closing_cash !== '' && (
                      <div style={{
                        marginTop: 8, padding: '8px 12px', borderRadius: 8,
                        background: (Number(closeForm.closing_cash) - (closeSummary?.expected_cash || 0)) === 0
                          ? 'var(--ok-bg)' : (Number(closeForm.closing_cash) - (closeSummary?.expected_cash || 0)) > 0
                          ? 'rgba(56, 189, 248, 0.12)' : 'var(--danger-bg)',
                        border: `1px solid ${(Number(closeForm.closing_cash) - (closeSummary?.expected_cash || 0)) === 0
                          ? 'var(--ok-border)' : (Number(closeForm.closing_cash) - (closeSummary?.expected_cash || 0)) > 0
                          ? 'rgba(56, 189, 248, 0.3)' : 'var(--danger-border)'}`,
                        fontSize: 12.5,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>Selisih Uang Fisik vs Sistem:</span>
                        <strong className="mono" style={{
                          color: (Number(closeForm.closing_cash) - (closeSummary?.expected_cash || 0)) === 0
                            ? 'var(--ok)' : (Number(closeForm.closing_cash) - (closeSummary?.expected_cash || 0)) > 0
                            ? '#38bdf8' : 'var(--danger)',
                          fontSize: 13.5
                        }}>
                          {Number(closeForm.closing_cash) - (closeSummary?.expected_cash || 0) === 0
                            ? '✓ Cocok / Pas (Rp 0)'
                            : (Number(closeForm.closing_cash) - (closeSummary?.expected_cash || 0) > 0
                              ? `+${rupiah(Number(closeForm.closing_cash) - (closeSummary?.expected_cash || 0))} (Surplus)`
                              : `${rupiah(Number(closeForm.closing_cash) - (closeSummary?.expected_cash || 0))} (Minus)`)}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Pratinjau Pemakaian Bahan Baku yang Dibukukan */}
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileText size={15} style={{ color: 'var(--accent-bright)' }} />
                      Bahan Baku yang Akan Dibukukan ke Kartu Stok
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                      Sistem akan membuat 1 mutasi <strong>SALE_USAGE</strong> akumulatif untuk setiap bahan di bawah ini:
                    </p>

                    {closeSummary?.ingredient_usages?.length > 0 ? (
                      <div className="table-wrap" style={{ maxHeight: 180, overflowY: 'auto' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Bahan Baku</th>
                              <th className="right">Total Pemakaian</th>
                              <th className="right">Estimasi Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {closeSummary.ingredient_usages.map(u => (
                              <tr key={u.ingredient_id}>
                                <td style={{ fontWeight: 600 }}>{u.ingredient_name}</td>
                                <td className="mono right" style={{ color: 'var(--danger)', fontWeight: 600 }}>
                                  -{num(u.total_qty)} {u.unit}
                                </td>
                                <td className="mono right" style={{ color: 'var(--text-secondary)' }}>
                                  {rupiah(u.total_cost)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                        Belum ada pemakaian bahan pada shift ini (0 transaksi).
                      </div>
                    )}
                  </div>

                  {/* Catatan Closing */}
                  <div className="form-group" style={{ marginTop: 16, marginBottom: 0 }}>
                    <label className="form-label">Catatan Penutupan Shift (Opsional)</label>
                    <textarea
                      rows={2}
                      className="form-control"
                      value={closeForm.notes}
                      onChange={e => setCloseForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Keterangan selisih kas, serah terima, kondisi toko, dll."
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCloseModal(false)}>
                    Batal
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submittingClose}>
                    {submittingClose ? 'Memproses Closing...' : 'Konfirmasi Closing & Bukukan Stok'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Detail & Rincian Shift */}
      {detailShift && (
        <div className="modal-overlay" onClick={() => setDetailShift(null)}>
          <div className="modal-content" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={18} style={{ color: 'var(--accent-bright)' }} />
                Rincian Sesi Shift #{detailShift.id} — {detailShift.shift_name}
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setDetailShift(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {loadingDetail ? (
                <div style={{ padding: 40, textAlign: 'center' }}><LoadingState /></div>
              ) : (
                <>
                  {/* Shift Metadata Summary */}
                  <div className="grid-2 gap-3 mb-4">
                    <div style={{ padding: '12px 14px', background: 'rgba(15, 20, 42, 0.6)', border: '1px solid var(--border)', borderRadius: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Waktu & Petugas</div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>{detailShift.shift_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Kasir: <strong>{detailShift.user?.name}</strong></div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        Buka: {new Date(detailShift.opened_at).toLocaleString('id-ID')}
                      </div>
                      {detailShift.closed_at && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          Tutup: {new Date(detailShift.closed_at).toLocaleString('id-ID')}
                        </div>
                      )}
                    </div>

                    <div style={{ padding: '12px 14px', background: 'rgba(15, 20, 42, 0.6)', border: '1px solid var(--border)', borderRadius: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Rekapitulasi Keuangan</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                        <span>Modal Awal:</span>
                        <strong className="mono">{rupiah(detailShift.initial_cash)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Omzet Penjualan:</span>
                        <strong className="mono" style={{ color: 'var(--ok)' }}>{rupiah(detailShift.system_cash)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Kas Aktual:</span>
                        <strong className="mono">{detailShift.closing_cash !== null ? rupiah(detailShift.closing_cash) : '—'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Selisih Kas:</span>
                        <strong className="mono" style={{ color: (detailShift.cash_difference || 0) < 0 ? 'var(--danger)' : 'var(--ok)' }}>
                          {detailShift.status === 'CLOSED' ? (detailShift.cash_difference > 0 ? `+${rupiah(detailShift.cash_difference)}` : rupiah(detailShift.cash_difference)) : '—'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Menu Terjual */}
                  {detailData?.summary?.menus_sold?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#ffffff' }}>Menu Terjual</div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Menu</th>
                              <th className="right">Porsi Terjual</th>
                              <th className="right">Total Nilai</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailData.summary.menus_sold.map(m => (
                              <tr key={m.menu_id}>
                                <td style={{ fontWeight: 600 }}>{m.menu_name}</td>
                                <td className="mono right">{m.qty} porsi</td>
                                <td className="mono right">{rupiah(m.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Bahan Terpakai */}
                  {detailData?.summary?.ingredient_usages?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#ffffff' }}>Akumulasi Bahan Baku Terpakai</div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Bahan Baku</th>
                              <th className="right">Total Gramasi/Qty</th>
                              <th className="right">Estimasi Biaya</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailData.summary.ingredient_usages.map(u => (
                              <tr key={u.ingredient_id}>
                                <td style={{ fontWeight: 600 }}>{u.ingredient_name}</td>
                                <td className="mono right" style={{ color: 'var(--danger)' }}>-{num(u.total_qty)} {u.unit}</td>
                                <td className="mono right">{rupiah(u.total_cost)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Daftar Transaksi */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#ffffff' }}>
                      Daftar Transaksi Kasir ({detailData?.transactions?.length || 0} transaksi)
                    </div>
                    {detailData?.transactions?.length > 0 ? (
                      <div className="table-wrap" style={{ maxHeight: 240, overflowY: 'auto' }}>
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width: 60 }}>TRX</th>
                              <th>Jam</th>
                              <th>Menu</th>
                              <th className="right">Porsi</th>
                              <th className="right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailData.transactions.map(t => (
                              <tr key={t.id}>
                                <td className="mono" style={{ color: 'var(--accent-bright)' }}>#{t.id}</td>
                                <td className="mono" style={{ fontSize: 12 }}>{t.time}</td>
                                <td style={{ fontWeight: 500 }}>{t.menu_name}</td>
                                <td className="mono right">{t.qty}x</td>
                                <td className="mono right">{rupiah(t.total_price)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                        Belum ada transaksi di shift ini.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetailShift(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
