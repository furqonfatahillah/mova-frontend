import { useState, useEffect, useMemo } from 'react';
import {
  Clock, Plus, CheckCircle, AlertTriangle, ArrowRight, DollarSign,
  Receipt, ShoppingBag, Eye, Calendar, User, RefreshCw, X, FileText, Store,
  Users, ShieldCheck, ShieldAlert, Lock, Unlock, Edit2, Trash2, CheckSquare,
  Square, Settings, UserCheck, Search, Info
} from 'lucide-react';
import api from '../api/client';
import { rupiah, num, PageHeader, LoadingState, MiniCard, PeriodPicker } from '../components/ui';
import { getMonthStartStr, getTodayStr } from '../utils/date';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import { confirmDialog } from '../utils/swal';

export default function ShiftManagement() {
  const {
    activeOutletId,
    activeOutlet,
    outlets,
    isOwnerBisnis,
    isPlatformAdmin,
    isOwnerWebsite,
    isOwnerOutlet,
    isPegawai,
    canSwitchOutlet,
    changeOutlet,
    currentUser,
    userOutletName,
    userBusinessName,
    dateRange: period,
  } = useOutlet();

  const selectedOutlet = useMemo(() => {
    if (!canSwitchOutlet) {
      return Number(currentUser?.outlet_id || activeOutletId || 1);
    }
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      return Number(activeOutletId);
    }
    return Number(outlets.find(o => o.is_main)?.id || outlets[0]?.id || 1);
  }, [canSwitchOutlet, currentUser?.outlet_id, activeOutletId, outlets]);

  // Tab: 'operational' | 'schedules'
  const [activeTab, setActiveTab] = useState('operational');

  // Operational shifts state
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
    shift_name: '',
    shift_schedule_id: null,
    initial_cash: 100000,
    notes: '',
    outlet_id: selectedOutlet || 1,
  });
  const [submittingOpen, setSubmittingOpen] = useState(false);
  const [outletSchedules, setOutletSchedules] = useState([]);
  const [loadingOutletSchedules, setLoadingOutletSchedules] = useState(false);

  // Form Close Shift
  const [closeForm, setCloseForm] = useState({
    closing_cash: '',
    notes: '',
  });
  const [allowCarryOver, setAllowCarryOver] = useState(true);
  const [submittingClose, setSubmittingClose] = useState(false);

  // Master Shift & Roster (Owner only)
  const [schedules, setSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [companyEmployees, setCompanyEmployees] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    outlet_id: selectedOutlet || 1,
    shift_name: '',
    start_time: '07:00',
    end_time: '15:00',
    assigned_user_ids: [],
    is_strict: true,
    active: true,
  });
  const [submittingSchedule, setSubmittingSchedule] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');

  useEffect(() => {
    if (activeTab === 'operational') {
      fetchData();
    } else if (activeTab === 'schedules') {
      fetchSchedules(selectedOutlet);
      fetchCompanyEmployees();
    }
  }, [filterStatus, selectedOutlet, activeTab, period]);

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
            from: period.from || undefined,
            to: period.to || undefined,
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
      if (activeTab === 'operational') {
        await fetchData();
      } else {
        await fetchSchedules(selectedOutlet);
        await fetchCompanyEmployees();
      }
      toast.success('Data shift diperbarui');
    } finally {
      setRefreshing(false);
    }
  }

  // Fetch available shift schedules for opening a shift
  async function fetchOutletSchedules(targetOid) {
    setLoadingOutletSchedules(true);
    try {
      const { data } = await api.get('/shift-schedules', {
        params: { outlet_id: targetOid, active: true }
      });
      setOutletSchedules(data || []);
      if (data && data.length > 0) {
        // Try to match user's scheduled shift, otherwise pick first
        const myUserId = Number(currentUser?.id);
        const myShift = data.find(s => s.assigned_user_ids?.includes(myUserId)) || data[0];
        setOpenForm(p => ({
          ...p,
          shift_schedule_id: myShift.id,
          shift_name: myShift.shift_name,
        }));
      } else {
        setOpenForm(p => ({
          ...p,
          shift_schedule_id: null,
          shift_name: p.shift_name || 'Shift 1 (Pagi)',
        }));
      }
    } catch {
      setOutletSchedules([]);
    } finally {
      setLoadingOutletSchedules(false);
    }
  }

  async function handleOpenModalClick() {
    const targetOutlet = selectedOutlet || (outlets.find(o => o.is_main)?.id || outlets[0]?.id || 1);
    setOpenForm({
      shift_name: '',
      shift_schedule_id: null,
      initial_cash: 100000,
      notes: '',
      outlet_id: targetOutlet,
    });
    setShowOpenModal(true);
    await fetchOutletSchedules(targetOutlet);
  }

  async function handleOpenShiftSubmit(e) {
    e.preventDefault();
    setSubmittingOpen(true);
    try {
      const payload = {
        shift_name: openForm.shift_name,
        shift_schedule_id: openForm.shift_schedule_id || undefined,
        initial_cash: Number(openForm.initial_cash),
        notes: openForm.notes,
        outlet_id: Number(openForm.outlet_id),
      };
      const { data } = await api.post('/shifts/open', payload);
      toast.success(`Shift #${data.id} (${data.shift_name}) berhasil dibuka!`);
      setShowOpenModal(false);
      setOpenForm(p => ({ ...p, shift_name: 'Shift 1 (Pagi)', shift_schedule_id: null, initial_cash: 100000, notes: '', outlet_id: selectedOutlet }));
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

  // --- Master Shift Schedule CRUD (Owner Only) ---
  async function fetchSchedules(targetOutlet) {
    setLoadingSchedules(true);
    try {
      const oid = targetOutlet !== undefined ? targetOutlet : selectedOutlet;
      const params = oid ? { outlet_id: oid } : {};
      const { data } = await api.get('/shift-schedules', { params });
      setSchedules(data || []);
    } catch {
      toast.error('Gagal memuat daftar master shift');
    } finally {
      setLoadingSchedules(false);
    }
  }

  async function fetchCompanyEmployees() {
    try {
      const { data } = await api.get('/shift-schedules/employees');
      setCompanyEmployees(data || []);
    } catch (err) {
      console.error(err);
    }
  }

  function handleOpenCreateSchedule() {
    setEditingSchedule(null);
    setScheduleForm({
      outlet_id: selectedOutlet || (outlets[0]?.id || 1),
      shift_name: '',
      start_time: '07:00',
      end_time: '15:00',
      assigned_user_ids: [],
      is_strict: true,
      active: true,
    });
    setEmployeeSearch('');
    setShowScheduleModal(true);
    if (companyEmployees.length === 0) {
      fetchCompanyEmployees();
    }
  }

  function handleOpenEditSchedule(sch) {
    setEditingSchedule(sch);
    setScheduleForm({
      outlet_id: sch.outlet_id,
      shift_name: sch.shift_name,
      start_time: sch.start_time?.slice(0, 5) || '07:00',
      end_time: sch.end_time?.slice(0, 5) || '15:00',
      assigned_user_ids: Array.isArray(sch.assigned_user_ids) ? [...sch.assigned_user_ids] : [],
      is_strict: Boolean(sch.is_strict),
      active: Boolean(sch.active),
    });
    setEmployeeSearch('');
    setShowScheduleModal(true);
    if (companyEmployees.length === 0) {
      fetchCompanyEmployees();
    }
  }

  async function handleSaveScheduleSubmit(e) {
    e.preventDefault();
    if (!scheduleForm.shift_name.trim()) {
      toast.error('Nama shift wajib diisi');
      return;
    }
    setSubmittingSchedule(true);
    try {
      if (editingSchedule) {
        await api.put(`/shift-schedules/${editingSchedule.id}`, scheduleForm);
        toast.success(`Jadwal shift '${scheduleForm.shift_name}' berhasil diperbarui!`);
      } else {
        await api.post('/shift-schedules', scheduleForm);
        toast.success(`Jadwal shift '${scheduleForm.shift_name}' berhasil dibuat!`);
      }
      setShowScheduleModal(false);
      fetchSchedules(selectedOutlet);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan jadwal shift');
    } finally {
      setSubmittingSchedule(false);
    }
  }

  async function handleDeleteSchedule(sch) {
    const confirmed = await confirmDialog({
      title: 'Hapus Master Jadwal Shift?',
      text: `Apakah Anda yakin ingin menghapus jadwal master '${sch.shift_name}'?`,
      confirmText: 'Ya, Hapus Jadwal',
      cancelText: 'Batal',
      isDanger: true,
    });
    if (!confirmed) return;
    try {
      await api.delete(`/shift-schedules/${sch.id}`);
      toast.success(`Jadwal shift '${sch.shift_name}' berhasil dihapus`);
      fetchSchedules(selectedOutlet);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus jadwal shift');
    }
  }

  async function handleToggleScheduleActive(sch) {
    try {
      await api.put(`/shift-schedules/${sch.id}`, { active: !sch.active });
      toast.success(`Status shift '${sch.shift_name}' diubah menjadi ${!sch.active ? 'Aktif' : 'Nonaktif'}`);
      fetchSchedules(selectedOutlet);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengubah status shift');
    }
  }

  async function handlePrepareClosing() {
    if (!activeData?.shift) return;
    setShowCloseModal(true);
    setLoadingSummary(true);
    setAllowCarryOver(true);
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
        allow_carry_over: allowCarryOver,
      });
      const carryMsg = data.carry_over_count > 0 ? ` (${data.carry_over_count} tagihan pelanggan dialihkan ke shift berikutnya)` : '';
      toast.success(`Shift #${activeData.shift.id} berhasil ditutup! ${data.movements_count} bahan dibukukan.${carryMsg}`);
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
        title={activeTab === 'operational' ? "Manajemen Shift & Closing Kasir" : "Pengaturan Master Shift & Jadwal Kasir"}
        subtitle={activeTab === 'operational'
          ? "Kelola sesi kasir, kontrol uang laci, dan totalkan pemakaian bahan baku otomatis ke Kartu Stok saat shift ditutup."
          : `Atur kuota shift, jam operasional, dan penugasan kasir resmi untuk perusahaan ${userBusinessName || ''}.`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Segarkan
            </button>
            {activeTab === 'operational' ? (
              !activeShift ? (
                <button className="btn btn-primary" onClick={handleOpenModalClick}>
                  <Plus size={15} /> Buka Shift Baru
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handlePrepareClosing}>
                  <CheckCircle size={15} /> Closing Shift Aktif
                </button>
              )
            ) : (
              <button className="btn btn-primary" onClick={handleOpenCreateSchedule}>
                <Plus size={15} /> Tambah Master Shift
              </button>
            )}
          </div>
        }
      />

      {/* Owner Navigation Tabs */}
      {isOwnerWebsite && (
        <div style={{
          display: 'flex',
          gap: 10,
          marginBottom: 20,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 12
        }}>
          <button
            className={`btn ${activeTab === 'operational' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10 }}
            onClick={() => setActiveTab('operational')}
          >
            <Clock size={16} /> Operasional & Riwayat Shift
          </button>
          <button
            className={`btn ${activeTab === 'schedules' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10 }}
            onClick={() => setActiveTab('schedules')}
          >
            <Settings size={16} /> Pengaturan Master Shift & Jadwal Kasir (Khusus Owner)
          </button>
        </div>
      )}

      {activeTab === 'operational' && (
        <>
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

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: 8,
          fontSize: 12.5,
          fontWeight: 700,
          color: '#ffffff'
        }}>
          <Store size={14} style={{ color: 'var(--accent-bright)' }} />
          <span>{activeOutlet?.name || userOutletName || 'Cabang Aktif'}</span>
          {activeOutlet?.is_main && (
            <span className="top-header-badge pusat" style={{ marginLeft: 4 }}>PUSAT</span>
          )}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
        </>
      )}

      {/* Tab: Master Shift & Jadwal Kasir (Owner Only) */}
      {activeTab === 'schedules' && (
        <div className="fade-in">
          {/* Single Company Security & Overview Banner */}
          <div className="card mb-4" style={{
            background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.3) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.35)',
            padding: '16px 20px',
            borderRadius: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span className="pill pill-accent mono" style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px' }}>
                    🔒 HAK AKSES OWNER BISNIS
                  </span>
                  <span className="pill" style={{ fontSize: 11, background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    🏢 {userBusinessName || 'Perusahaan Terisolasi'}
                  </span>
                </div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: 17, fontWeight: 800, color: '#ffffff' }}>
                  Pengaturan Master Shift & Jadwal Roster Kasir
                </h3>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 780, lineHeight: 1.5 }}>
                  Sebagai <strong>Owner Bisnis</strong>, Anda berhak menentukan jumlah shift harian, rentang jam kerja operasional cabang, dan menugaskan staf/kasir resmi yang berhak membuka kasir. Seluruh data jadwal dan staf kasir terisolasi secara ketat hanya dalam perusahaan <strong>{userBusinessName}</strong>.
                </p>
              </div>

              <button
                className="btn btn-primary"
                style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
                onClick={handleOpenCreateSchedule}
              >
                <Plus size={16} /> Tambah Master Shift
              </button>
            </div>
          </div>

          {/* Outlet Filter Bar for Master Schedules */}
          <div className="card mb-4" style={{
            padding: '12px 18px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Store size={16} style={{ color: 'var(--accent-bright)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                Cabang: <span style={{ color: 'var(--accent-bright)' }}>{activeOutlet?.name || userOutletName || 'Cabang Aktif'}</span>
              </span>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Total Master Shift Terdaftar: <strong style={{ color: 'var(--accent-bright)' }}>{schedules.length}</strong> Shift
            </div>
          </div>

          {/* Schedule Cards Grid */}
          {loadingSchedules ? (
            <LoadingState />
          ) : schedules.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 16,
              marginBottom: 30
            }}>
              {schedules.map(sch => {
                const assignedCount = sch.assigned_user_ids?.length || 0;
                return (
                  <div
                    key={sch.id}
                    className="card"
                    style={{
                      background: sch.active
                        ? 'linear-gradient(145deg, rgba(26, 31, 56, 0.9) 0%, rgba(17, 22, 45, 0.95) 100%)'
                        : 'rgba(255,255,255,0.02)',
                      border: sch.active
                        ? (sch.is_strict ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(139, 92, 246, 0.35)')
                        : '1px dashed rgba(255,255,255,0.12)',
                      padding: '18px 20px',
                      borderRadius: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s',
                      opacity: sch.active ? 1 : 0.65,
                    }}
                  >
                    <div>
                      {/* Card Header: Outlet & Status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span className="pill mono" style={{ fontSize: 11, background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-bright)' }}>
                          🏢 {sch.outlet?.name || 'Cabang'}
                        </span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {sch.is_strict ? (
                            <span className="pill" style={{ fontSize: 11, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                              <Lock size={11} style={{ marginRight: 3 }} /> Validasi Ketat
                            </span>
                          ) : (
                            <span className="pill" style={{ fontSize: 11, background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                              <Unlock size={11} style={{ marginRight: 3 }} /> Fleksibel
                            </span>
                          )}
                          <span className={`pill ${sch.active ? 'pill-ok' : 'pill-secondary'}`} style={{ fontSize: 10.5 }}>
                            {sch.active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                      </div>

                      {/* Title & Operating Hours */}
                      <h4 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
                        {sch.shift_name}
                      </h4>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'rgba(0,0,0,0.3)',
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: 'var(--accent-bright)',
                        marginBottom: 14
                      }}>
                        <Clock size={13} />
                        <span>{sch.start_time?.slice(0, 5)} — {sch.end_time?.slice(0, 5)} WIB</span>
                      </div>

                      {/* Assigned Cashiers List */}
                      <div style={{
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        paddingTop: 12,
                        marginBottom: 16
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--text-secondary)',
                          marginBottom: 8
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Users size={13} style={{ color: 'var(--accent-bright)' }} />
                            <span>Kasir Ditugaskan ({assignedCount}):</span>
                          </div>
                        </div>

                        {sch.assigned_users && sch.assigned_users.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 90, overflowY: 'auto' }}>
                            {sch.assigned_users.map(user => (
                              <div
                                key={user.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  background: 'rgba(255,255,255,0.06)',
                                  padding: '3px 8px',
                                  borderRadius: 20,
                                  fontSize: 11.5,
                                  border: '1px solid rgba(255,255,255,0.08)'
                                }}
                              >
                                <div style={{
                                  width: 18, height: 18, borderRadius: '50%',
                                  background: 'var(--accent-bright)', color: '#000',
                                  fontSize: 10, fontWeight: 800,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                  {user.name?.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ color: '#ffffff', fontWeight: 600 }}>{user.name}</span>
                                <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>({user.role})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{
                            fontSize: 11.5,
                            color: sch.is_strict ? '#fca5a5' : 'var(--text-muted)',
                            background: sch.is_strict ? 'rgba(239,68,68,0.08)' : 'transparent',
                            padding: sch.is_strict ? '6px 10px' : 0,
                            borderRadius: 6
                          }}>
                            {sch.is_strict
                              ? '⚠️ Belum ada kasir yang ditugaskan! Kasir tidak akan dapat membuka shift ini sampai Anda menugaskan staf.'
                              : 'Belum ada kasir khusus (Semua kasir cabang diizinkan membuka shift ini).'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{
                      display: 'flex',
                      gap: 8,
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      paddingTop: 12
                    }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                        onClick={() => handleOpenEditSchedule(sch)}
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          color: sch.active ? '#f59e0b' : 'var(--ok)'
                        }}
                        onClick={() => handleToggleScheduleActive(sch)}
                        title={sch.active ? 'Nonaktifkan shift' : 'Aktifkan shift'}
                      >
                        {sch.active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm btn-icon"
                        style={{ width: 34, height: 32, padding: 0 }}
                        onClick={() => handleDeleteSchedule(sch)}
                        title="Hapus master shift"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '50px 20px', background: 'rgba(15, 23, 42, 0.4)' }}>
              <Clock size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <h4 style={{ margin: '0 0 6px 0', color: '#ffffff', fontSize: 16 }}>
                Belum Ada Master Shift di Cabang Ini
              </h4>
              <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)', fontSize: 13, maxWidth: 500, marginInline: 'auto' }}>
                Tentukan jumlah shift per hari (contoh: Shift 1 Pagi, Shift 2 Sore) dan tetapkan kasir mana saja yang berhak membuka kasir.
              </p>
              <button className="btn btn-primary" onClick={handleOpenCreateSchedule}>
                <Plus size={15} /> Buat Master Shift Sekarang
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Buka Shift */}
      {showOpenModal && (() => {
        const selectedScheduleObj = outletSchedules.find(s => s.id === openForm.shift_schedule_id);
        const isCurrentSelectionStrict = selectedScheduleObj?.is_strict;
        const isUserAssignedToSelected = selectedScheduleObj?.assigned_user_ids?.includes(Number(currentUser?.id));
        const isBlockedByStrictPolicy = isCurrentSelectionStrict && !isUserAssignedToSelected && !isOwnerWebsite;

        return (
          <div className="modal-overlay" onClick={() => setShowOpenModal(false)}>
            <div className="modal-content" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
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
                <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                  {/* Cabang Outlet Selector */}
                  <div className="form-group mb-3">
                    <label className="form-label" style={{ fontWeight: 700, color: '#ffffff' }}>Cabang / Outlet Penugasan *</label>
                    {canSwitchOutlet ? (
                      <select
                        className="form-control"
                        style={{ fontSize: 13, fontWeight: 600, borderColor: 'var(--accent-bright)' }}
                        value={openForm.outlet_id}
                        onChange={e => {
                          const newOid = Number(e.target.value);
                          setOpenForm(f => ({ ...f, outlet_id: newOid }));
                          fetchOutletSchedules(newOid);
                        }}
                        required
                      >
                        {outlets.map(o => (
                          <option key={o.id} value={o.id} style={{ background: '#11162d', color: '#ffffff' }}>
                            {o.name} {o.is_main ? '(Pusat)' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{
                        padding: '9px 12px',
                        background: 'rgba(99, 102, 241, 0.12)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 13,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span>📍 {activeOutlet?.name || userOutletName || 'Cabang Penempatan'}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--ok)', background: 'rgba(16, 217, 122, 0.15)', padding: '2px 6px', borderRadius: 4 }}>
                          Terkunci
                        </span>
                      </div>
                    )}
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Shift kasir ini akan dibuka untuk operasional <strong>{outlets.find(o => Number(o.id) === Number(openForm.outlet_id))?.name || activeOutlet?.name || 'cabang terpilih'}</strong>.
                    </div>
                  </div>

                  {/* Pilihan Shift: Official Master Shifts or Custom */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label className="form-label" style={{ margin: 0, fontWeight: 700, color: '#ffffff' }}>
                        Pilihan Shift Resmi ({outletSchedules.length} Terdaftar):
                      </label>
                      {isOwnerWebsite && (
                        <span style={{ fontSize: 11, color: 'var(--accent-bright)' }}>
                          Dikelola oleh Owner
                        </span>
                      )}
                    </div>

                    {loadingOutletSchedules ? (
                      <div style={{ padding: '12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                        Memeriksa jadwal master shift cabang...
                      </div>
                    ) : outletSchedules.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 12 }}>
                        {outletSchedules.map(sch => {
                          const isSelected = openForm.shift_schedule_id === sch.id;
                          const isAssigned = sch.assigned_user_ids?.includes(Number(currentUser?.id));
                          const isRestricted = sch.is_strict && !isAssigned && !isOwnerWebsite;

                          return (
                            <div
                              key={sch.id}
                              onClick={() => {
                                setOpenForm(f => ({
                                  ...f,
                                  shift_schedule_id: sch.id,
                                  shift_name: sch.shift_name,
                                }));
                              }}
                              style={{
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: isSelected
                                  ? (isRestricted ? '2px solid #ef4444' : '2px solid var(--accent-bright)')
                                  : '1px solid rgba(255,255,255,0.1)',
                                background: isSelected
                                  ? (isRestricted ? 'rgba(239, 68, 68, 0.12)' : 'rgba(139, 92, 246, 0.15)')
                                  : 'rgba(255,255,255,0.03)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: isSelected ? '#ffffff' : 'var(--text-primary)' }}>
                                  {sch.shift_name}
                                </span>
                                {sch.is_strict ? (
                                  <span className="pill" style={{ fontSize: 9.5, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '1px 6px' }}>
                                    <Lock size={9} style={{ marginRight: 2 }} /> Ketat
                                  </span>
                                ) : (
                                  <span className="pill" style={{ fontSize: 9.5, background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '1px 6px' }}>
                                    <Unlock size={9} style={{ marginRight: 2 }} /> Bebas
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={11} /> {sch.start_time?.slice(0, 5)} - {sch.end_time?.slice(0, 5)} WIB
                              </div>
                              {sch.assigned_users && sch.assigned_users.length > 0 && (
                                <div style={{ fontSize: 11, color: isAssigned ? 'var(--ok)' : 'var(--text-muted)', marginTop: 4 }}>
                                  {isAssigned ? '✓ Anda dijadwalkan di sini' : `Kasir: ${sch.assigned_users.map(u => u.name).join(', ')}`}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                        {['Shift 1 (Pagi)', 'Shift 2 (Siang/Sore)', 'Shift 3 (Malam)'].map(name => (
                          <button
                            type="button"
                            key={name}
                            className={`btn btn-sm ${openForm.shift_name === name && !openForm.shift_schedule_id ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setOpenForm(f => ({ ...f, shift_name: name, shift_schedule_id: null }))}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Warning if blocked by strict roster policy */}
                  {isBlockedByStrictPolicy && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      marginBottom: 16,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      color: '#fca5a5',
                      fontSize: 12
                    }}>
                      <ShieldAlert size={20} style={{ flexShrink: 0, color: '#ef4444', marginTop: 1 }} />
                      <div>
                        <strong style={{ color: '#ffffff', display: 'block', marginBottom: 2 }}>Akses Buka Shift Dibatasi oleh Owner</strong>
                        Anda ({currentUser?.name}) tidak terdaftar dalam jadwal penugasan shift <strong>{selectedScheduleObj?.shift_name}</strong>. Berdasarkan kebijakan Owner perusahaan, pembukaan shift ini hanya diizinkan untuk kasir yang telah ditugaskan.
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Nama Shift Terpilih</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={openForm.shift_name}
                      onChange={e => setOpenForm(f => ({ ...f, shift_name: e.target.value, shift_schedule_id: null }))}
                      placeholder="Contoh: Shift 1 (Pagi)"
                    />
                    {openForm.shift_schedule_id && (
                      <div style={{ fontSize: 11, color: 'var(--accent-bright)', marginTop: 4 }}>
                        ✓ Terhubung ke master shift resmi #{openForm.shift_schedule_id}
                      </div>
                    )}
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
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submittingOpen || isBlockedByStrictPolicy}
                    style={isBlockedByStrictPolicy ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                  >
                    {submittingOpen ? 'Membuka...' : (isBlockedByStrictPolicy ? 'Ditolak: Tidak Dijadwalkan' : 'Konfirmasi Buka Shift')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

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
                  {/* Peringatan & Opsi Open Bill Pelanggan */}
                  {closeSummary?.open_bills_count > 0 && (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: 12,
                      padding: '14px 16px',
                      marginBottom: 16
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#f59e0b', fontSize: 13 }}>
                          <AlertTriangle size={16} />
                          <span>Ada {closeSummary.open_bills_count} Tagihan Pelanggan (Open Bill) yang Masih Belum Lunas</span>
                        </div>
                        <span className="pill pill-warning" style={{ fontSize: 11, fontWeight: 700 }}>
                          Total: {rupiah(closeSummary.open_bills_total)}
                        </span>
                      </div>

                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                        Tagihan berikut belum diselesaikan oleh pelanggan. Anda dapat <strong>mengalihkan tagihan ke shift berikutnya</strong> agar kasir shift saat ini bisa langsung closing dan serah terima kas:
                      </p>

                      {/* Daftar Tagihan Pelanggan */}
                      <div style={{ maxHeight: 130, overflowY: 'auto', background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                        {closeSummary.open_bills?.map((ob, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '5px 0', borderBottom: idx < closeSummary.open_bills.length - 1 ? '1px dashed rgba(255,255,255,0.08)' : 'none' }}>
                            <div>
                              <span style={{ fontWeight: 700, color: '#ffffff' }}>👤 {ob.customer_name || 'Pelanggan Walk-in'}</span>
                              <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 11 }}>({ob.order_number})</span>
                              {ob.notes && <span style={{ color: 'var(--text-secondary)', fontSize: 11, marginLeft: 6 }}>— {ob.notes}</span>}
                            </div>
                            <span className="mono" style={{ fontWeight: 600, color: 'var(--accent-bright)' }}>{rupiah(ob.total_amount)}</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: '#ffffff' }}>
                          <input
                            type="checkbox"
                            checked={allowCarryOver}
                            onChange={e => setAllowCarryOver(e.target.checked)}
                            style={{ width: 16, height: 16, accentColor: 'var(--accent-bright)' }}
                          />
                          <span>Alihkan tagihan pelanggan di atas ke shift berikutnya (Carry-Over)</span>
                        </label>
                      </div>
                    </div>
                  )}

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

      {/* Modal Tambah / Edit Master Shift (Owner Only) */}
      {showScheduleModal && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal-content" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={18} style={{ color: 'var(--accent-bright)' }} />
                {editingSchedule ? 'Edit Jadwal Master Shift' : 'Tambah Master Shift & Roster Kasir'}
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowScheduleModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveScheduleSubmit}>
              <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                {/* Outlet Selector */}
                <div className="form-group mb-3">
                  <label className="form-label" style={{ fontWeight: 700, color: '#ffffff' }}>
                    Cabang / Outlet Penugasan *
                  </label>
                  {canSwitchOutlet ? (
                    <select
                      className="form-control"
                      value={scheduleForm.outlet_id}
                      onChange={e => setScheduleForm(f => ({ ...f, outlet_id: Number(e.target.value) }))}
                      required
                    >
                      {outlets.map(o => (
                        <option key={o.id} value={o.id} style={{ background: '#11162d', color: '#ffffff' }}>
                          {o.name} {o.is_main ? '(Pusat)' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{
                      padding: '9px 12px',
                      background: 'rgba(99, 102, 241, 0.12)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 13,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>📍 {activeOutlet?.name || userOutletName || 'Cabang Penempatan'}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--ok)', background: 'rgba(16, 217, 122, 0.15)', padding: '2px 6px', borderRadius: 4 }}>
                        Terkunci
                      </span>
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Shift ini akan berlaku untuk operasional cabang terpilih dalam perusahaan Anda.
                  </div>
                </div>

                {/* Shift Name */}
                <div className="form-group mb-3">
                  <label className="form-label" style={{ fontWeight: 700, color: '#ffffff' }}>
                    Nama Shift *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="Contoh: Shift 1 (Pagi) atau Shift 2 (Sore)"
                    value={scheduleForm.shift_name}
                    onChange={e => setScheduleForm(f => ({ ...f, shift_name: e.target.value }))}
                  />
                </div>

                {/* Working Hours */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700, color: '#ffffff' }}>
                      Jam Mulai Operasional *
                    </label>
                    <input
                      type="time"
                      className="form-control"
                      required
                      value={scheduleForm.start_time}
                      onChange={e => setScheduleForm(f => ({ ...f, start_time: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700, color: '#ffffff' }}>
                      Jam Selesai Operasional *
                    </label>
                    <input
                      type="time"
                      className="form-control"
                      required
                      value={scheduleForm.end_time}
                      onChange={e => setScheduleForm(f => ({ ...f, end_time: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Strict Toggle */}
                <div style={{
                  background: scheduleForm.is_strict ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.03)',
                  border: scheduleForm.is_strict ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(255,255,255,0.08)',
                  padding: '12px 16px',
                  borderRadius: 10,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  cursor: 'pointer'
                }} onClick={() => setScheduleForm(f => ({ ...f, is_strict: !f.is_strict }))}>
                  <input
                    type="checkbox"
                    style={{ marginTop: 3, cursor: 'pointer', width: 16, height: 16 }}
                    checked={scheduleForm.is_strict}
                    onChange={e => setScheduleForm(f => ({ ...f, is_strict: e.target.checked }))}
                    onClick={e => e.stopPropagation()}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: scheduleForm.is_strict ? '#f59e0b' : '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Lock size={13} />
                      <span>Wajibkan Validasi Ketat (Strict Roster Enforcement)</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.4 }}>
                      Jika dicentang, <strong>hanya staf/kasir yang namanya dipilih di bawah</strong> yang diizinkan membuka shift ini di sistem POS. Kasir lain yang tidak dijadwalkan akan otomatis diblokir sistem. (Owner tetap dapat membuka dalam kondisi darurat).
                    </div>
                  </div>
                </div>

                {/* Active Toggle */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 16,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <input
                    type="checkbox"
                    id="activeScheduleCheck"
                    checked={scheduleForm.active}
                    onChange={e => setScheduleForm(f => ({ ...f, active: e.target.checked }))}
                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                  />
                  <label htmlFor="activeScheduleCheck" style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', cursor: 'pointer', margin: 0 }}>
                    Aktifkan master shift ini (Muncul pada pilihan buka shift kasir)
                  </label>
                </div>

                {/* Employee Roster Selection (Strict to this company) */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <label className="form-label" style={{ fontWeight: 700, color: '#ffffff', margin: 0 }}>
                        Penugasan Kasir Perusahaan ({scheduleForm.assigned_user_ids.length} Staf Terpilih)
                      </label>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        Hanya staf aktif yang terdaftar di perusahaan <strong>{userBusinessName}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() => {
                          const allIds = companyEmployees.map(u => u.id);
                          setScheduleForm(f => ({ ...f, assigned_user_ids: allIds }));
                        }}
                      >
                        Pilih Semua
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() => setScheduleForm(f => ({ ...f, assigned_user_ids: [] }))}
                      >
                        Batal Semua
                      </button>
                    </div>
                  </div>

                  {/* Search Box */}
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-control"
                      style={{ paddingLeft: 32, fontSize: 12.5 }}
                      placeholder="Cari nama atau email staf..."
                      value={employeeSearch}
                      onChange={e => setEmployeeSearch(e.target.value)}
                    />
                  </div>

                  {/* Employees Checkbox Grid */}
                  <div style={{
                    maxHeight: 220,
                    overflowY: 'auto',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    padding: 8,
                    background: 'rgba(0,0,0,0.2)'
                  }}>
                    {companyEmployees
                      .filter(u => {
                        if (!employeeSearch.trim()) return true;
                        const q = employeeSearch.toLowerCase();
                        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                      })
                      .map(user => {
                        const isChecked = scheduleForm.assigned_user_ids.includes(user.id);
                        return (
                          <div
                            key={user.id}
                            onClick={() => {
                              setScheduleForm(f => {
                                const exists = f.assigned_user_ids.includes(user.id);
                                const nextIds = exists
                                  ? f.assigned_user_ids.filter(id => id !== user.id)
                                  : [...f.assigned_user_ids, user.id];
                                return { ...f, assigned_user_ids: nextIds };
                              });
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '7px 10px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              background: isChecked ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                              marginBottom: 4,
                              border: isChecked ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
                              transition: 'background 0.15s'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // Handled by parent div
                                style={{ cursor: 'pointer', width: 15, height: 15 }}
                              />
                              <div style={{
                                width: 26, height: 26, borderRadius: '50%',
                                background: isChecked ? 'var(--accent-bright)' : 'rgba(255,255,255,0.1)',
                                color: isChecked ? '#000' : '#fff',
                                fontWeight: 800, fontSize: 11,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}>
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: '#ffffff' }}>{user.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{user.email}</div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="pill mono" style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)' }}>
                                {user.outlet?.name || 'Semua Cabang'}
                              </span>
                              <span className="pill pill-secondary" style={{ fontSize: 10 }}>
                                {user.role}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                    {companyEmployees.length === 0 && (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                        Memuat daftar staf perusahaan...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingSchedule}>
                  {submittingSchedule ? 'Menyimpan...' : (editingSchedule ? 'Simpan Perubahan' : 'Buat Master Shift')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
