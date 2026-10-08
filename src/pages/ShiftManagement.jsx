import { useState, useEffect, useMemo } from 'react';
import {
  Clock, Plus, CheckCircle, AlertTriangle, ArrowRight, DollarSign,
  Receipt, ShoppingBag, Eye, Calendar, User, RefreshCw, X, FileText, Store,
  Users, ShieldCheck, ShieldAlert, Lock, Unlock, Edit2, Trash2, CheckSquare,
  Square, Settings, UserCheck, Search, Info, Printer, History, ChevronDown,
  Layers, RotateCcw, Check, Wallet, Landmark, Banknote, Coins, ArrowRightCircle
} from 'lucide-react';
import api from '../api/client';
import { rupiah, num, PageHeader, LoadingState, MiniCard, PeriodPicker } from '../components/ui';
import { getMonthStartStr, getTodayStr } from '../utils/date';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import { confirmDialog } from '../utils/swal';
import { printElement } from '../utils/print';

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

  // Tab: 'operational' | 'schedules' | 'history'
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
  const [lastClosedShift, setLastClosedShift] = useState(null);
  const [loadingLastClosed, setLoadingLastClosed] = useState(false);

  const isOwnerOrManager = isPlatformAdmin || isOwnerWebsite || isOwnerBisnis || isOwnerOutlet;
  const [supervisors, setSupervisors] = useState([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [syncingModal, setSyncingModal] = useState(false);

  async function handleSyncModalJournals() {
    setSyncingModal(true);
    try {
      const res = await api.post('/shifts/sync-initial-cash-journals');
      toast.success(res.data?.message || 'Jurnal modal kasir berhasil disinkronkan!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal sinkronisasi jurnal modal.');
    } finally {
      setSyncingModal(false);
    }
  }

  async function fetchSupervisors() {
    if (supervisors.length > 0) return;
    setLoadingSupervisors(true);
    try {
      const res = await api.get('/shifts/supervisors');
      const list = res.data || [];
      setSupervisors(list);
      if (list.length > 0) {
        setOpenForm(f => ({ ...f, supervisor_id: f.supervisor_id || list[0].id }));
      }
    } catch {
      try {
        const res2 = await api.get('/transactions/supervisors');
        const list2 = res2.data || [];
        setSupervisors(list2);
        if (list2.length > 0) {
          setOpenForm(f => ({ ...f, supervisor_id: f.supervisor_id || list2[0].id }));
        }
      } catch (err) {
        console.error('Failed fetching supervisors', err);
      }
    } finally {
      setLoadingSupervisors(false);
    }
  }

  // Post-closing Deposit Modal (Setor Uang Kasir ke Kas Besar)
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositShift, setDepositShift] = useState(null);
  const [depositForm, setDepositForm] = useState({
    amount: '',
    account: 'KAS_BESAR',
    notes: '',
  });
  const [submittingDeposit, setSubmittingDeposit] = useState(false);

  // Approve & Reject Deposit Modals (Owner / Outlet Manager)
  const [approveDepositModal, setApproveDepositModal] = useState({
    open: false,
    shift: null,
    loading: false,
  });
  const [rejectDepositModal, setRejectDepositModal] = useState({
    open: false,
    shift: null,
    reason: '',
    loading: false,
  });

  // Detail Modal
  const [detailShift, setDetailShift] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState('orders'); // 'orders' | 'menus' | 'ingredients'
  const [detailSearch, setDetailSearch] = useState('');
  const [detailStatus, setDetailStatus] = useState('ALL'); // 'ALL' | 'PAID' | 'HOLD' | 'CANCELLED' | 'VOID_PENDING'
  const [detailPaymentMethod, setDetailPaymentMethod] = useState('ALL');
  const [expandedDetailOrders, setExpandedDetailOrders] = useState({});
  const [orderReceiptModal, setOrderReceiptModal] = useState({
    open: false,
    order: null,
  });
  const [receiptData, setReceiptData] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [thermalPaperSize, setThermalPaperSize] = useState('80mm'); // '80mm' | '58mm'

  // Helper for local date string YYYY-MM-DD
  const getLocalDateStr = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return String(dateStr).slice(0, 10);
    }
  };

  // History tab sub-state
  const [historyShifts, setHistoryShifts] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedShiftId, setExpandedShiftId] = useState(null);
  const [expandedData, setExpandedData] = useState({});
  const [historyFilterShift, setHistoryFilterShift] = useState('ALL');
  const [historyFilterCashier, setHistoryFilterCashier] = useState('ALL');
  const [historySearch, setHistorySearch] = useState('');

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
    } else if (activeTab === 'history') {
      fetchHistoryShifts();
    }
  }, [filterStatus, selectedOutlet, activeTab, period, activeOutletId]);

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
      } else if (activeTab === 'schedules') {
        await fetchSchedules(selectedOutlet);
        await fetchCompanyEmployees();
      } else if (activeTab === 'history') {
        await fetchHistoryShifts();
      }
      toast.success('Data shift diperbarui');
    } finally {
      setRefreshing(false);
    }
  }

  // Fetch history shifts (closed only)
  async function fetchHistoryShifts() {
    setLoadingHistory(true);
    try {
      let targetOid = undefined;
      if (!canSwitchOutlet) {
        targetOid = Number(currentUser?.outlet_id || 1);
      } else if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
        targetOid = Number(activeOutletId);
      }

      const { data } = await api.get('/shifts', {
        params: {
          status: 'CLOSED',
          outlet_id: targetOid || undefined,
          from: period.from || undefined,
          to: period.to || undefined,
        }
      });
      setHistoryShifts(data || []);
    } catch {
      toast.error('Gagal memuat riwayat shift');
    } finally {
      setLoadingHistory(false);
    }
  }

  // Fetch expanded shift detail for history tab
  async function handleExpandShift(shift) {
    if (expandedShiftId === shift.id) {
      setExpandedShiftId(null);
      return;
    }
    setExpandedShiftId(shift.id);
    if (expandedData[shift.id]) return; // Already loaded
    try {
      const [sumRes, trxRes] = await Promise.all([
        api.get(`/shifts/${shift.id}/summary`),
        api.get(`/shifts/${shift.id}/transactions`),
      ]);
      setExpandedData(prev => ({
        ...prev,
        [shift.id]: {
          summary: sumRes.data,
          transactions: trxRes.data.transactions,
        }
      }));
    } catch {
      toast.error('Gagal memuat detail shift');
    }
  }

  // Print shift receipt
  async function handlePrintReceipt(shiftId, autoTrigger = false) {
    setLoadingReceipt(true);
    try {
      const { data } = await api.get(`/shifts/${shiftId}/receipt`);
      setReceiptData(data);
      setShowReceiptModal(true);
      if (autoTrigger) {
        setTimeout(() => {
          doPrintShiftReceipt();
        }, 400);
      }
    } catch {
      toast.error('Gagal memuat data struk rekap kas');
    } finally {
      setLoadingReceipt(false);
    }
  }

  function doPrintShiftReceipt(paperSize = thermalPaperSize) {
    printElement('shift-receipt-print', `Rekap-Kas-Shift-#${receiptData?.shift?.id || ''}`, {
      isThermal: true,
      paperWidth: paperSize,
      maxWidth: paperSize === '58mm' ? '54mm' : '76mm',
      margin: '0mm'
    });
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

  async function fetchLastClosedShift(targetOutlet) {
    setLoadingLastClosed(true);
    try {
      const res = await api.get('/shifts/last-closed', { params: { outlet_id: targetOutlet } });
      const lastShift = res.data || null;
      setLastClosedShift(lastShift);
      if (lastShift) {
        const remainingInDrawer = lastShift.remaining_cash_in_drawer != null
          ? Number(lastShift.remaining_cash_in_drawer)
          : (lastShift.closing_cash != null ? Number(lastShift.closing_cash) : 0);
        setOpenForm(f => ({
          ...f,
          initial_cash: remainingInDrawer,
          initial_cash_source: 'DRAWER',
          kas_besar_amount: 100000,
        }));
      }
    } catch {
      setLastClosedShift(null);
    } finally {
      setLoadingLastClosed(false);
    }
  }

  async function handleOpenModalClick() {
    const targetOutlet = selectedOutlet || (outlets.find(o => o.is_main)?.id || outlets[0]?.id || 1);
    setOpenForm({
      shift_name: '',
      shift_schedule_id: null,
      initial_cash: 0,
      initial_cash_source: 'DRAWER',
      kas_besar_amount: 100000,
      supervisor_id: '',
      supervisor_password: '',
      notes: '',
      outlet_id: targetOutlet,
    });
    setShowOpenModal(true);
    await Promise.all([
      fetchOutletSchedules(targetOutlet),
      fetchLastClosedShift(targetOutlet),
      fetchSupervisors(),
    ]);
  }

  async function handleOpenShiftSubmit(e) {
    e.preventDefault();
    const source = openForm.initial_cash_source || 'DRAWER';
    const remainingInDrawer = lastClosedShift && lastClosedShift.remaining_cash_in_drawer != null
      ? Number(lastClosedShift.remaining_cash_in_drawer)
      : (lastClosedShift ? Number(lastClosedShift.closing_cash || 0) : null);

    const inputAmt = source === 'KAS_BESAR'
      ? Number(openForm.kas_besar_amount || 0)
      : Number(openForm.initial_cash || 0);

    // Jika memilih Kas Besar dan user bukan Owner/Manager, wajib otorisasi supervisor
    if (source === 'KAS_BESAR' && !isOwnerOrManager) {
      if (!openForm.supervisor_id) {
        toast.error('Silakan pilih akun Manajer atau Owner untuk otorisasi pengambilan Kas Besar!');
        return;
      }
      if (!openForm.supervisor_password) {
        toast.error('Silakan masukkan Password atau PIN Manajer/Owner untuk menyetujui pengambilan dari Kas Besar!');
        return;
      }
    }

    // Jika memilih DRAWER (Lanjutkan Kas Laci), cek apakah berbeda dengan sisa fisik di laci
    const hasDiscrepancy = source === 'DRAWER' && remainingInDrawer !== null && inputAmt !== remainingInDrawer;

    if (hasDiscrepancy) {
      const diff = inputAmt - remainingInDrawer;
      const diffFormatted = diff > 0 ? `+${rupiah(diff)} (Lebih)` : `-${rupiah(Math.abs(diff))} (Kurang)`;
      const confirmed = await confirmDialog({
        title: '⚠️ Peringatan Selisih Kas Laci',
        html: `<div style="text-align: left; font-size: 13px; line-height: 1.6;">
          <p style="margin-bottom: 8px;">Modal kas laci yang Anda masukkan <strong>tidak sesuai</strong> dengan sisa kas fisik di laci setelah shift sebelumnya:</p>
          <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: var(--text-muted);">Sisa Kas Fisik di Laci:</span>
              <strong style="color: #38bdf8;">${rupiah(remainingInDrawer)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: var(--text-muted);">Modal Awal Diinput:</span>
              <strong style="color: #fbbf24;">${rupiah(inputAmt)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
              <span style="font-weight: 700;">Selisih Kas Fisik:</span>
              <strong style="color: ${diff > 0 ? '#34d399' : '#f87171'}; font-size: 14px;">${diffFormatted}</strong>
            </div>
          </div>
          <p style="margin: 0; color: #fca5a5; font-size: 12px;">Pastikan perbedaan ini sudah disertai keterangan pada kolom Catatan. Apakah Anda yakin ingin tetap membuka shift?</p>
        </div>`,
        confirmText: 'Ya, Tetap Buka Shift',
        cancelText: 'Periksa Kembali',
        isDanger: true,
      });
      if (!confirmed) return;
    }

    setSubmittingOpen(true);
    try {
      const payload = {
        shift_name: openForm.shift_name,
        shift_schedule_id: openForm.shift_schedule_id || undefined,
        initial_cash: inputAmt,
        initial_cash_source: source,
        kas_besar_amount: source === 'KAS_BESAR' ? inputAmt : 0,
        supervisor_id: source === 'KAS_BESAR' && !isOwnerOrManager ? Number(openForm.supervisor_id) : undefined,
        supervisor_password: source === 'KAS_BESAR' && !isOwnerOrManager ? openForm.supervisor_password : undefined,
        notes: openForm.notes,
        outlet_id: Number(openForm.outlet_id),
      };
      const { data } = await api.post('/shifts/open', payload);
      toast.success(`Shift #${data.id} (${data.shift_name}) berhasil dibuka!`);
      setShowOpenModal(false);
      setOpenForm(p => ({
        ...p,
        shift_name: 'Shift 1 (Pagi)',
        shift_schedule_id: null,
        initial_cash: 0,
        initial_cash_source: 'DRAWER',
        kas_besar_amount: 100000,
        supervisor_id: '',
        supervisor_password: '',
        notes: '',
        outlet_id: selectedOutlet
      }));
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
      const closingCashAmt = Number(closeForm.closing_cash || 0);
      const shiftSnapshot = {
        id: activeData.shift.id,
        shift_name: activeData.shift.shift_name,
        cashier_name: activeData.shift.user?.name || currentUser?.name || 'Kasir',
        closing_cash: closingCashAmt,
      };

      const { data } = await api.post(`/shifts/${activeData.shift.id}/close`, {
        closing_cash: closingCashAmt,
        notes: closeForm.notes,
        allow_carry_over: allowCarryOver,
      });
      const carryMsg = data.carry_over_count > 0 ? ` (${data.carry_over_count} tagihan pelanggan dialihkan ke shift berikutnya)` : '';
      toast.success(`Shift #${activeData.shift.id} berhasil ditutup! ${data.movements_count} bahan dibukukan.${carryMsg}`);
      setShowCloseModal(false);
      await Promise.all([fetchData(), fetchHistoryShifts()]);

      // Tampilkan Modal Setor Uang Kasir ke Kas Besar atau Lanjutkan
      setDepositShift(shiftSnapshot);
      setDepositForm({
        amount: closingCashAmt,
        account: 'KAS_BESAR',
        notes: `Setoran Closing Shift #${shiftSnapshot.id} (${shiftSnapshot.shift_name}) ke Kas Besar`,
      });
      setShowDepositModal(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menutup shift');
    } finally {
      setSubmittingClose(false);
    }
  }

  // Handle Deposit to Kas Besar Submit (Cashier submits, Status: PENDING)
  async function handleDepositSubmit(e) {
    if (e) e.preventDefault();
    if (!depositShift) return;
    const amt = Number(depositForm.amount);
    const physicalCash = Number(depositShift.closing_cash || 0);
    const sisaDiLaci = Math.max(0, physicalCash - amt);

    // Kasus 1: Input 0 rupiah atau kasir tidak ada uang fisik
    if (isNaN(amt) || amt <= 0) {
      if (physicalCash <= 0 || amt === 0) {
        const confirmed = await confirmDialog({
          title: '⚠️ Peringatan: Sisa Uang Kasir Rp 0',
          html: `<div style="text-align: left; font-size: 13px; line-height: 1.6;">
            <p style="margin-bottom: 8px;">Uang yang disetor adalah <strong>Rp 0</strong> dan total kas fisik di laci adalah <strong>${rupiah(physicalCash)}</strong>.</p>
            <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 10px; margin-bottom: 12px; color: #fef3c7; font-size: 12px;">
              ⚠️ <strong>Perhatian:</strong> Tidak ada uang fisik kasir yang disetorkan ke Kas Besar / Bank.
            </div>
            <p style="margin: 0; color: #cbd5e1;">Apakah Anda ingin tetap melanjutkan dan menyelesaikan proses closing shift?</p>
          </div>`,
          icon: 'warning',
          confirmText: 'Ya, Tetap Lanjutkan',
          cancelText: 'Periksa Kembali',
        });
        if (confirmed) {
          handleSkipDeposit();
        }
        return;
      }
      toast.error('Jumlah setoran harus berupa nominal yang valid');
      return;
    }

    // Kasus 2: Sisa uang kasir di laci = 0 rupiah (setor habis atau setor lebih)
    if (sisaDiLaci === 0) {
      const isOver = amt > physicalCash;
      const confirmed = await confirmDialog({
        title: '⚠️ Peringatan: Sisa Uang di Laci Rp 0',
        html: `<div style="text-align: left; font-size: 13px; line-height: 1.6;">
          <p style="margin-bottom: 8px;">
            Nominal yang disetor: <strong style="color: #34d399;">${rupiah(amt)}</strong><br/>
            Uang fisik di laci: <strong>${rupiah(physicalCash)}</strong><br/>
            Sisa uang di laci: <strong style="color: #fbbf24;">Rp 0 (${isOver ? 'Setor Lebih' : 'Setor Habis'})</strong>
          </p>
          <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 10px; margin-bottom: 12px; color: #fef3c7; font-size: 12px;">
            ⚠️ <strong>Perhatian:</strong> Sisa uang kas di laci kasir adalah <strong>Rp 0</strong>. Shift kasir berikutnya <strong>tidak akan memiliki modal kas / uang kembalian</strong> di laci kasir.
          </div>
          <p style="margin: 0; color: #cbd5e1;">Apakah Anda yakin ingin tetap melanjutkan setoran ini?</p>
        </div>`,
        icon: 'warning',
        confirmText: 'Ya, Tetap Lanjutkan',
        cancelText: 'Periksa Kembali',
      });
      if (!confirmed) {
        return;
      }
    }

    setSubmittingDeposit(true);
    try {
      const { data } = await api.post(`/shifts/${depositShift.id}/deposit`, {
        amount: amt,
        account: depositForm.account || 'KAS_BESAR',
        notes: depositForm.notes || undefined,
      });
      toast.success(data.message || `Setoran uang kasir sebesar ${rupiah(amt)} berhasil diajukan dan menunggu persetujuan Owner!`);
      const targetShiftId = depositShift.id;
      setShowDepositModal(false);
      setDepositShift(null);
      await Promise.all([fetchData(), fetchHistoryShifts()]);
      // Cetak struk rekap kas shift
      setTimeout(() => handlePrintReceipt(targetShiftId), 500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengajukan setoran uang kasir ke kas besar');
    } finally {
      setSubmittingDeposit(false);
    }
  }

  // Handle Skip Deposit (Lanjutkan tanpa setor / tinggalkan di laci)
  function handleSkipDeposit() {
    const targetShiftId = depositShift?.id;
    const physicalCash = Number(depositShift?.closing_cash || 0);
    setShowDepositModal(false);
    setDepositShift(null);
    if (physicalCash <= 0) {
      toast('Shift selesai. Uang kasir di laci Rp 0 (tanpa setoran).', { icon: 'ℹ️' });
    } else {
      toast(`Uang kasir ${rupiah(physicalCash)} ditinggalkan di laci kasir untuk modal shift berikutnya.`, { icon: 'ℹ️' });
    }
    if (targetShiftId) {
      setTimeout(() => handlePrintReceipt(targetShiftId), 500);
    }
  }

  // Manual trigger deposit for any closed shift (Cashier submit / re-submit)
  function handleOpenDepositForShift(shift, e) {
    if (e) e.stopPropagation();
    if (!shift || shift.status !== 'CLOSED') return;

    if (shift.has_next_shift || shift.can_deposit === false) {
      const reason = shift.cannot_deposit_reason || `Shift selanjutnya (${shift.next_shift_name || 'berikutnya'}) sudah dibuka / sedang berjalan.`;
      confirmDialog({
        title: '🔒 Setoran Tidak Dapat Dilakukan',
        html: `<div style="text-align: left; font-size: 13px; line-height: 1.6;">
          <p style="margin-bottom: 8px;">Shift ini tidak dapat mengajukan setoran kasir karena <strong>${reason}</strong></p>
          <div style="background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 10px; color: #93c5fd; font-size: 12px;">
            ℹ️ Sisa kas fisik di laci saat penutupan shift ini otomatis dialihkan sebagai modal kas awal untuk shift berikutnya.
          </div>
        </div>`,
        icon: 'info',
        confirmText: 'Mengerti',
        showCancel: false,
      });
      return;
    }

    const defaultAmt = Number(shift.deposit_amount || shift.closing_cash || 0);
    setDepositShift({
      id: shift.id,
      shift_name: shift.shift_name,
      cashier_name: shift.user?.name || 'Kasir',
      closing_cash: Number(shift.closing_cash || 0),
      deposit_status: shift.deposit_status,
      deposit_rejection_reason: shift.deposit_rejection_reason,
    });
    setDepositForm({
      amount: defaultAmt,
      account: shift.deposit_account || 'KAS_BESAR',
      notes: shift.deposit_notes || `Setoran Kasir Shift #${shift.id} (${shift.shift_name}) ke ${shift.deposit_account === 'BANK_MAIN' ? 'Rekening Bank' : 'Kas Besar'}`,
    });
    setShowDepositModal(true);
  }

  // Handle Open Approve Modal (Owner / Outlet Manager)
  function handleOpenApproveDeposit(shift, e) {
    if (e) e.stopPropagation();
    if (!shift) return;
    setApproveDepositModal({
      open: true,
      shift,
      loading: false,
    });
  }

  // Handle Approve Deposit Submit
  async function handleApproveDepositSubmit() {
    const shift = approveDepositModal.shift;
    if (!shift) return;
    setApproveDepositModal(prev => ({ ...prev, loading: true }));
    try {
      const { data } = await api.post(`/shifts/${shift.id}/deposit-approve`);
      toast.success(data.message || `Setoran Kasir Shift #${shift.id} berhasil disetujui!`);
      setApproveDepositModal({ open: false, shift: null, loading: false });
      if (data.shift) {
        setDetailShift(prev => (prev && prev.id === data.shift.id ? { ...prev, ...data.shift } : prev));
      }
      await Promise.all([fetchData(), fetchHistoryShifts()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyetujui setoran kasir');
      setApproveDepositModal(prev => ({ ...prev, loading: false }));
    }
  }

  // Handle Open Reject Modal (Owner / Outlet Manager)
  function handleOpenRejectDeposit(shift, e) {
    if (e) e.stopPropagation();
    if (!shift) return;
    setRejectDepositModal({
      open: true,
      shift,
      reason: '',
      loading: false,
    });
  }

  // Handle Reject Deposit Submit
  async function handleRejectDepositSubmit(e) {
    if (e) e.preventDefault();
    const shift = rejectDepositModal.shift;
    if (!shift) return;
    if (!rejectDepositModal.reason.trim()) {
      toast.error('Harap masukkan alasan penolakan setoran kasir');
      return;
    }
    setRejectDepositModal(prev => ({ ...prev, loading: true }));
    try {
      const { data } = await api.post(`/shifts/${shift.id}/deposit-reject`, {
        reason: rejectDepositModal.reason.trim(),
      });
      toast.success(data.message || `Setoran Kasir Shift #${shift.id} telah ditolak.`);
      setRejectDepositModal({ open: false, shift: null, reason: '', loading: false });
      if (data.shift) {
        setDetailShift(prev => (prev && prev.id === data.shift.id ? { ...prev, ...data.shift } : prev));
      }
      await Promise.all([fetchData(), fetchHistoryShifts()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menolak setoran kasir');
      setRejectDepositModal(prev => ({ ...prev, loading: false }));
    }
  }

  async function handleViewDetail(shift, printAfter = false) {
    setDetailShift(shift);
    setLoadingDetail(true);
    setDetailTab('orders');
    setDetailSearch('');
    setDetailStatus('ALL');
    setDetailPaymentMethod('ALL');
    setExpandedDetailOrders({});
    try {
      const [sumRes, trxRes] = await Promise.all([
        api.get(`/shifts/${shift.id}/summary`),
        api.get(`/shifts/${shift.id}/transactions`),
      ]);
      setDetailData({
        summary: sumRes.data,
        transactions: trxRes.data.transactions,
        raw_transactions: trxRes.data.raw_transactions || [],
      });
    } catch {
      toast.error('Gagal memuat rincian shift');
    } finally {
      setLoadingDetail(false);
    }
  }

  function toggleDetailOrderExpand(orderNumber) {
    setExpandedDetailOrders(prev => ({
      ...prev,
      [orderNumber]: !prev[orderNumber]
    }));
  }

  function handlePrintSingleOrderReceipt(order) {
    if (!order) return;
    setOrderReceiptModal({
      open: true,
      order: order,
    });
  }

  function doPrintSingleOrderReceipt(paperSize = '80mm') {
    printElement('order-receipt-print-shift', `Struk-Nota-${orderReceiptModal.order?.order_number || 'TRX'}`, {
      isThermal: true,
      paperWidth: paperSize,
      maxWidth: paperSize === '58mm' ? '54mm' : '76mm',
      margin: '0mm'
    });
  }

  // Group raw transactions by order_number for Nota-level view in detail modal
  const groupedDetailOrders = useMemo(() => {
    if (!detailData) return [];

    if (!detailData.raw_transactions || !Array.isArray(detailData.raw_transactions) || detailData.raw_transactions.length === 0) {
      const flatList = detailData.transactions || [];
      const map = new Map();
      for (const t of flatList) {
        const ord = t.order_number || `TRX-${t.id}`;
        if (!map.has(ord)) {
          map.set(ord, {
            order_number: ord,
            date: t.date,
            created_at: t.time ? `${t.date} ${t.time}` : t.date,
            customer_name: 'Pelanggan Umum',
            order_type: 'DINE_IN',
            table_number: null,
            payment_method: t.payment_method || 'CASH',
            status: t.status || 'PAID',
            cashier_name: t.user_name || detailShift?.user?.name || 'Kasir',
            shift_name: detailShift?.shift_name || 'Shift Reguler',
            shift_id: detailShift?.id || null,
            subtotal: 0,
            discount_amount: 0,
            total_price: 0,
            total_qty: 0,
            amount_paid: 0,
            change_amount: 0,
            notes: null,
            items: [],
          });
        }
        const order = map.get(ord);
        order.subtotal += Number(t.total_price || 0);
        order.total_price += Number(t.total_price || 0);
        order.total_qty += Number(t.qty || 1);
        order.amount_paid = order.total_price;
        order.items.push({
          id: t.id,
          menu: { name: t.menu_name, price: t.menu_price },
          qty: t.qty,
          total_price: t.total_price,
          subtotal: t.total_price,
          discount_amount: 0,
          modifiers: [],
          notes: null,
        });
      }
      return Array.from(map.values());
    }

    const rawList = detailData.raw_transactions;
    const map = new Map();

    for (const t of rawList) {
      const ord = t.order_number || `TRX-${t.id}`;
      if (!map.has(ord)) {
        map.set(ord, {
          order_number: ord,
          date: t.date,
          created_at: t.created_at,
          customer_name: t.customer_name || 'Pelanggan Umum',
          order_type: t.order_type || 'DINE_IN',
          table_number: t.table_number || null,
          payment_method: t.payment_method || 'CASH',
          status: t.status || 'PAID',
          cancellation_reason: t.cancellation_reason || null,
          cancelled_at: t.cancelled_at || null,
          cancelled_by_name: t.cancelled_by_name || t.cancelled_by_user?.name || t.updater?.name || null,
          cashier_name: t.user?.name || detailShift?.user?.name || 'Kasir',
          shift_name: t.shift?.shift_name || detailShift?.shift_name || 'Shift Reguler',
          shift_id: t.shift_id || detailShift?.id || null,
          outlet_name: t.outlet?.name || detailShift?.outlet?.name || '',
          amount_paid: Number(t.amount_paid || 0),
          change_amount: Number(t.change_amount || 0),
          dp_payment_method: t.dp_payment_method || null,
          dp_reference_no: t.dp_reference_no || null,
          subtotal: 0,
          discount_amount: 0,
          discount_name: t.discount_name || null,
          total_price: 0,
          total_qty: 0,
          is_urgent_note: false,
          notes: t.notes || null,
          items: [],
          firstRecord: t,
        });
      }

      const order = map.get(ord);
      const itemSubtotal = Number(t.subtotal || t.total_price || 0);
      const itemDisc = Number(t.discount_amount || 0);
      const itemTotal = Number(t.total_price || 0);
      const itemQty = Number(t.qty || 1);

      order.subtotal += itemSubtotal;
      order.discount_amount += itemDisc;
      order.total_price += itemTotal;
      order.total_qty += itemQty;

      if (t.status === 'CANCELLED') {
        order.status = 'CANCELLED';
      } else if (t.status === 'VOID_PENDING') {
        order.status = 'VOID_PENDING';
      }

      if (t.cancellation_reason && !order.cancellation_reason) {
        order.cancellation_reason = t.cancellation_reason;
      }
      if (t.cancelled_at && !order.cancelled_at) {
        order.cancelled_at = t.cancelled_at;
      }
      if (t.cancelled_by_name && !order.cancelled_by_name) {
        order.cancelled_by_name = t.cancelled_by_name;
      }
      if (t.is_urgent_note) order.is_urgent_note = true;
      if (t.discount_name && !order.discount_name) order.discount_name = t.discount_name;
      if (t.notes && !order.notes) order.notes = t.notes;

      order.items.push(t);
    }

    return Array.from(map.values());
  }, [detailData, detailShift]);

  const filteredDetailOrders = useMemo(() => {
    return groupedDetailOrders.filter(ord => {
      if (detailStatus !== 'ALL') {
        if (detailStatus === 'PAID' && ord.status !== 'PAID') return false;
        if (detailStatus === 'CANCELLED' && ord.status !== 'CANCELLED') return false;
        if (detailStatus === 'VOID_PENDING' && ord.status !== 'VOID_PENDING') return false;
        if (detailStatus === 'HOLD' && ord.status !== 'HOLD') return false;
      }

      if (detailPaymentMethod !== 'ALL') {
        if ((ord.payment_method || 'CASH').toUpperCase() !== detailPaymentMethod.toUpperCase()) {
          return false;
        }
      }

      if (detailSearch.trim()) {
        const s = detailSearch.toLowerCase().trim();
        const matchOrd = ord.order_number?.toLowerCase().includes(s);
        const matchCust = ord.customer_name?.toLowerCase().includes(s);
        const matchCashier = ord.cashier_name?.toLowerCase().includes(s);
        const matchTable = ord.table_number?.toLowerCase().includes(s);
        const matchNotes = ord.notes?.toLowerCase().includes(s);
        const matchReason = ord.cancellation_reason?.toLowerCase().includes(s);
        const matchItems = ord.items.some(it =>
          (it.menu?.name || it.menu_name || '').toLowerCase().includes(s) ||
          it.modifiers?.some(m => m.name?.toLowerCase().includes(s))
        );
        if (!matchOrd && !matchCust && !matchCashier && !matchTable && !matchNotes && !matchReason && !matchItems) {
          return false;
        }
      }

      return true;
    });
  }, [groupedDetailOrders, detailStatus, detailPaymentMethod, detailSearch]);

  // Unique filter options for History Tab
  const historyFilterOptions = useMemo(() => {
    const dates = new Set();
    const shiftsInDate = new Set();
    const allShiftNames = new Set();
    const cashiers = new Map(); // id -> name

    for (const s of historyShifts) {
      const openDStr = getLocalDateStr(s.opened_at);
      const closeDStr = getLocalDateStr(s.closed_at);
      if (openDStr) dates.add(openDStr);
      if (closeDStr) dates.add(closeDStr);
      if (s.shift_name) allShiftNames.add(s.shift_name);
      if (s.user?.id) cashiers.set(String(s.user.id), s.user.name);
      shiftsInDate.add(s.shift_name || `Shift #${s.id}`);
    }

    return {
      dates: Array.from(dates).sort().reverse(),
      shiftsInDate: Array.from(shiftsInDate).sort(),
      allShiftNames: Array.from(allShiftNames).sort(),
      cashiers: Array.from(cashiers.entries()).map(([id, name]) => ({ id, name })),
    };
  }, [historyShifts]);

  // Filtered History Shifts
  const filteredHistoryShifts = useMemo(() => {
    return historyShifts.filter(s => {
      // Outlet filter (if not already filtered by backend)
      if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
        if (Number(s.outlet_id) !== Number(activeOutletId)) return false;
      }
      // Shift filter (supports shift name or shift ID)
      if (historyFilterShift !== 'ALL') {
        const matchName = s.shift_name === historyFilterShift || `Shift #${s.id}` === historyFilterShift;
        const matchId = String(s.id) === String(historyFilterShift);
        if (!matchName && !matchId) return false;
      }
      // Cashier filter
      if (historyFilterCashier !== 'ALL') {
        const cId = String(s.user_id || s.user?.id || '');
        if (cId !== String(historyFilterCashier)) return false;
      }
      // Search query
      if (historySearch && historySearch.trim()) {
        const q = historySearch.toLowerCase().trim();
        const matchId = String(s.id).includes(q);
        const matchName = (s.shift_name || '').toLowerCase().includes(q);
        const matchCashier = (s.user?.name || '').toLowerCase().includes(q);
        const matchOutlet = (s.outlet?.name || '').toLowerCase().includes(q);
        if (!matchId && !matchName && !matchCashier && !matchOutlet) return false;
      }
      return true;
    });
  }, [historyShifts, activeOutletId, historyFilterShift, historyFilterCashier, historySearch]);

  // Aggregated summary for filtered history shifts
  const historySummary = useMemo(() => {
    let totalInitial = 0;
    let totalCash = 0;
    let totalQris = 0;
    let totalGrab = 0;
    let totalOther = 0;
    let totalSales = 0;
    let totalClosing = 0;
    let totalDiff = 0;
    let totalDeposited = 0;
    let totalDepositedApproved = 0;
    let totalDepositedPending = 0;
    let totalDepositDiff = 0;

    for (const s of filteredHistoryShifts) {
      totalInitial += Number(s.initial_cash || 0);
      totalCash += Number(s.cash_sales || 0);
      totalQris += Number(s.qris_sales || 0);
      totalGrab += Number(s.grab_sales || 0);
      const other = (Number(s.transfer_sales) || 0) + (Number(s.debit_sales) || 0) + (Number(s.other_sales) || 0);
      totalOther += other;
      totalSales += Number(s.system_cash || (Number(s.cash_sales || 0) + Number(s.qris_sales || 0) + Number(s.grab_sales || 0) + other));
      totalClosing += Number(s.closing_cash || 0);
      totalDiff += Number(s.cash_difference || 0);

      const depAmt = Number(s.deposit_amount || 0);
      totalDeposited += depAmt;
      if (s.deposit_status === 'APPROVED' || (s.is_deposited && s.deposit_status !== 'PENDING' && s.deposit_status !== 'REJECTED')) {
        totalDepositedApproved += depAmt;
      } else if (s.deposit_status === 'PENDING' || s.is_deposit_pending) {
        totalDepositedPending += depAmt;
      }
      totalDepositDiff += Number(s.deposit_diff || 0);
    }

    return {
      count: filteredHistoryShifts.length,
      total_initial_cash: totalInitial,
      total_cash_sales: totalCash,
      total_qris_sales: totalQris,
      total_grab_sales: totalGrab,
      total_other_sales: totalOther,
      total_sales: totalSales,
      total_closing_cash: totalClosing,
      total_diff: totalDiff,
      total_deposited: totalDeposited,
      total_deposited_approved: totalDepositedApproved,
      total_deposited_pending: totalDepositedPending,
      total_deposit_diff: totalDepositDiff,
    };
  }, [filteredHistoryShifts]);

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
            {isOwnerOrManager && (
              <button
                className="btn btn-outline"
                onClick={handleSyncModalJournals}
                disabled={syncingModal}
                title="Sinkronkan jurnal penarikan modal awal kasir dari Kas Besar agar saldo neraca tidak minus"
              >
                <Landmark size={14} className={syncingModal ? 'spin' : ''} /> {syncingModal ? 'Sinkronisasi...' : 'Sinkron Jurnal Modal'}
              </button>
            )}
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

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 20,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: 12,
        flexWrap: 'wrap'
      }}>
        <button
          className={`btn ${activeTab === 'operational' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10 }}
          onClick={() => setActiveTab('operational')}
        >
          <Clock size={16} /> Operasional Shift
        </button>
        <button
          className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10 }}
          onClick={() => setActiveTab('history')}
        >
          <History size={16} /> Riwayat Shift
        </button>
        {isOwnerWebsite && (
          <button
            className={`btn ${activeTab === 'schedules' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10 }}
            onClick={() => setActiveTab('schedules')}
          >
            <Settings size={16} /> Pengaturan Master Shift
          </button>
        )}
      </div>

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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <MiniCard
                  label="Modal Awal Kas"
                  value={rupiah(activeShift.initial_cash)}
                  subtext={
                    activeShift.initial_cash_difference !== null && activeShift.initial_cash_difference !== undefined
                      ? (activeShift.initial_cash_difference === 0
                        ? (activeShift.initial_cash_source === 'KAS_BESAR' || activeShift.notes?.includes('Kas Besar') ? '✓ Sesuai (Kas Besar)' : `✓ Sesuai Kas Lalu (${rupiah(activeShift.previous_shift_remaining_drawer ?? activeShift.previous_shift_closing_cash)})`)
                        : `${activeShift.initial_cash_difference > 0 ? '+' : ''}${rupiah(activeShift.initial_cash_difference)} vs Sisa Kas Lalu (${rupiah(activeShift.previous_shift_remaining_drawer ?? activeShift.previous_shift_closing_cash)})`)
                      : 'Shift Perdana'
                  }
                  color="var(--accent-bright)"
                />
                <MiniCard
                  label="Penjualan Kas (Tunai)"
                  value={rupiah(activeData.cash_sales || 0)}
                  color="var(--ok)"
                />
                <MiniCard
                  label="Pengeluaran Kas / OPEX"
                  value={`-${rupiah(activeData.cash_expenses ?? (activeData.total_expenses || 0))}`}
                  color={(activeData.cash_expenses || activeData.total_expenses || 0) > 0 ? '#ef4444' : 'var(--text-muted)'}
                />
                <MiniCard
                  label="QRIS / Transfer (Non-Tunai)"
                  value={rupiah(activeData.non_cash_sales || 0)}
                  color="#38bdf8"
                />
                <MiniCard
                  label="Total Omzet Penjualan"
                  value={`${rupiah(activeData.total_sales)} (${activeData.total_transactions || 0} trx)`}
                  color="#ffffff"
                />
                <MiniCard
                  label="Saldo Kas di Laci"
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
                    <th style={{ width: 65 }}>ID</th>
                    <th>Shift & Karyawan</th>
                    <th style={{ width: 130 }}>Cabang</th>
                    <th>Waktu Buka / Tutup</th>
                    <th className="right" style={{ color: '#fbbf24' }}>Modal Awal</th>
                    <th className="right" style={{ color: '#a78bfa' }} title="Perbandingan Modal Awal Kasir dengan Uang Kas Fisik Akhir Shift Sebelumnya">Selisih Antar Kasir</th>
                    <th className="right" style={{ color: '#34d399' }}>Tunai</th>
                    <th className="right" style={{ color: '#38bdf8' }}>QRIS</th>
                    <th className="right" style={{ color: '#10b981' }}>Grab / Online</th>
                    <th className="right" style={{ color: '#c084fc' }}>Transfer / EDC</th>
                    <th className="right" style={{ fontWeight: 800 }}>Total Omzet</th>
                    <th className="right" title="Uang Fisik Kasir di Laci saat Closing">Uang Fisik (Laci)</th>
                    <th className="right" title="Selisih Uang Fisik di Laci vs Perhitungan Sistem Kasir">Selisih Laci</th>
                    <th className="right" style={{ color: '#34d399' }} title="Status & Rekap Setoran Uang Kasir ke Kas Besar / Brankas">Setoran Kas Besar</th>
                    <th className="center">Status</th>
                    <th className="center" style={{ width: 90 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.length > 0 ? (
                    shifts.map((s) => {
                      const diff = s.cash_difference ?? 0;
                      const nonCashOther = (s.transfer_sales || 0) + (s.debit_sales || 0) + (s.other_sales || 0);
                      const totalOmzet = s.system_cash ?? ((s.cash_sales || 0) + (s.qris_sales || 0) + (s.grab_sales || 0) + nonCashOther);
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
                          <td className="mono right" style={{ color: '#fbbf24', fontWeight: 600 }}>
                            {rupiah(s.initial_cash)}
                          </td>
                          <td className="mono right">
                            {s.initial_cash_difference !== null && s.initial_cash_difference !== undefined ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{
                                  fontWeight: 700,
                                  fontSize: 12,
                                  color: s.initial_cash_difference === 0
                                    ? 'var(--ok)'
                                    : s.initial_cash_difference > 0
                                      ? '#38bdf8'
                                      : 'var(--danger)',
                                }}>
                                  {s.initial_cash_difference === 0
                                    ? '✓ Sesuai (Rp 0)'
                                    : s.initial_cash_difference > 0
                                      ? `+${rupiah(s.initial_cash_difference)}`
                                      : rupiah(s.initial_cash_difference)}
                                </span>
                                {s.previous_shift_closing_cash !== null && (
                                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }} title={s.previous_shift_deposit_amount > 0 ? `Kas Fisik: ${rupiah(s.previous_shift_closing_cash)} | Disetor: ${rupiah(s.previous_shift_deposit_amount)} | Sisa Laci: ${rupiah(s.previous_shift_remaining_drawer || 0)}` : `Kas Akhir Shift Lalu (${s.previous_shift_name || ''}): ${rupiah(s.previous_shift_closing_cash)}`}>
                                    {s.previous_shift_deposit_amount > 0 ? `Laci Lalu: ${rupiah(s.previous_shift_remaining_drawer || 0)}` : `Lalu: ${rupiah(s.previous_shift_closing_cash)}`}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>— (Perdana)</span>
                            )}
                          </td>
                          <td className="mono right" style={{ color: '#34d399', fontWeight: 600 }}>
                            {rupiah(s.cash_sales || 0)}
                          </td>
                          <td className="mono right" style={{ color: '#38bdf8', fontWeight: 600 }}>
                            {rupiah(s.qris_sales || 0)}
                          </td>
                          <td className="mono right" style={{ color: '#10b981', fontWeight: 600 }}>
                            {rupiah(s.grab_sales || 0)}
                          </td>
                          <td className="mono right" style={{ color: '#c084fc', fontWeight: 600 }}>
                            {rupiah(nonCashOther)}
                          </td>
                          <td className="mono right" style={{ fontWeight: 800, color: '#ffffff', background: 'rgba(255,255,255,0.03)' }}>
                            {rupiah(totalOmzet)}
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
                          {/* Setoran Kas Besar Column */}
                          <td className="mono right">
                            {s.status === 'OPEN' ? (
                              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>— (Berjalan)</span>
                            ) : s.deposit_status === 'APPROVED' || s.is_deposited ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                <span className="pill pill-ok mono" style={{ fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px' }}>
                                  <CheckCircle size={11} /> {rupiah(s.deposit_amount)}
                                </span>
                                <div style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>{s.deposit_account_label || 'Kas Besar'}</span>
                                  {s.deposit_diff !== 0 && s.deposit_diff !== undefined ? (
                                    <span style={{
                                      fontWeight: 700,
                                      color: s.deposit_diff > 0 ? '#38bdf8' : 'var(--danger)',
                                    }} title={`Selisih Setoran: Disetor ${rupiah(s.deposit_amount)} vs Kas Fisik ${rupiah(s.closing_cash)}`}>
                                      ({s.deposit_diff > 0 ? `+${rupiah(s.deposit_diff)} Lebih` : `${rupiah(s.deposit_diff)} Kurang`})
                                    </span>
                                  ) : (
                                    <span style={{ color: '#34d399', fontWeight: 600 }}>✓ Pas</span>
                                  )}
                                </div>
                                {s.deposit_approved_by_name && (
                                  <div style={{ fontSize: 9.5, color: '#34d399', opacity: 0.9 }}>
                                    Disetujui: {s.deposit_approved_by_name}
                                  </div>
                                )}
                              </div>
                            ) : s.deposit_status === 'PENDING' || s.is_deposit_pending ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                                <span className="pill mono" style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  color: '#fbbf24',
                                  border: '1px solid rgba(245, 158, 11, 0.35)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  padding: '2px 6px'
                                }}>
                                  <Clock size={10} /> Menunggu Approval: {rupiah(s.deposit_amount || s.closing_cash)}
                                </span>
                                <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
                                  ke {s.deposit_account_label || 'Kas Besar'}
                                </div>
                                {isOwnerOrManager ? (
                                  <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      style={{ fontSize: 10, padding: '2px 7px', background: '#059669', color: '#ffffff', border: 'none', borderRadius: 5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                                      onClick={(e) => handleOpenApproveDeposit(s, e)}
                                      title="Setujui dan bukukan setoran ini ke Kas Besar"
                                    >
                                      <Check size={11} /> Setujui
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      style={{ fontSize: 10, padding: '2px 7px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: 5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                                      onClick={(e) => handleOpenRejectDeposit(s, e)}
                                      title="Tolak pengajuan setoran kasir ini"
                                    >
                                      <X size={11} /> Tolak
                                    </button>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 9.5, color: '#fbbf24', fontStyle: 'italic' }}>
                                    Menunggu Verifikasi Owner
                                  </span>
                                )}
                              </div>
                            ) : s.deposit_status === 'REJECTED' || s.is_deposit_rejected ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                                <span className="pill mono" style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: '#f87171',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  padding: '2px 6px'
                                }} title={`Alasan penolakan: ${s.deposit_rejection_reason || '-'}`}>
                                  <X size={10} /> Ditolak Owner
                                </span>
                                {s.deposit_rejection_reason && (
                                  <span style={{ fontSize: 9.5, color: '#fca5a5', maxWidth: 160, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.deposit_rejection_reason}>
                                    Catatan: {s.deposit_rejection_reason}
                                  </span>
                                )}
                                {s.has_next_shift ? (
                                  <span style={{ fontSize: 9.5, color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <Lock size={9} /> Shift berikutnya berjalan
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, fontWeight: 700 }}
                                    onClick={(e) => handleOpenDepositForShift(s, e)}
                                    title="Ajukan ulang setoran untuk shift ini"
                                  >
                                    Setor Ulang
                                  </button>
                                )}
                              </div>
                            ) : s.has_next_shift ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                                <span className="pill mono" style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  background: 'rgba(100, 116, 139, 0.15)',
                                  color: '#94a3b8',
                                  border: '1px solid rgba(100, 116, 139, 0.35)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  padding: '2px 6px'
                                }} title={`Shift selanjutnya (${s.next_shift_name || 'berikutnya'}) sudah dibuka. Saldo kasir dialihkan ke modal shift berikutnya.`}>
                                  <Lock size={10} /> Dialihkan ke Shift Berikutnya
                                </span>
                                <span style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'right' }}>
                                  (Tidak dapat setor)
                                </span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                                <span className="pill mono" style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  color: '#fbbf24',
                                  border: '1px solid rgba(245, 158, 11, 0.35)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  padding: '2px 6px'
                                }}>
                                  <AlertTriangle size={10} /> Belum Setor
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, fontWeight: 700 }}
                                  onClick={(e) => handleOpenDepositForShift(s, e)}
                                  title="Setorkan uang kasir shift ini ke Kas Besar"
                                >
                                  + Setor Kas
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="center">
                            <span className={`pill pill-${s.status === 'OPEN' ? 'ok' : 'muted'}`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="center">
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleViewDetail(s)}
                                title="Lihat rincian transaksi dan pemakaian bahan shift ini"
                              >
                                <Eye size={13} />
                              </button>
                              {s.status === 'CLOSED' && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handlePrintReceipt(s.id)}
                                  title="Cetak rekap kas shift"
                                  disabled={loadingReceipt}
                                >
                                  <Printer size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={15} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                        Belum ada riwayat shift yang tercatat.
                      </td>
                    </tr>
                  )}
                </tbody>
                {shifts.length > 0 && (
                  <tfoot>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', fontWeight: 700, borderTop: '2px solid var(--border-strong)' }}>
                      <td colSpan={4} style={{ textAlign: 'right', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Total Ringkasan ({shifts.length} Sesi Shift):
                      </td>
                      <td className="mono right" style={{ color: '#fbbf24' }}>
                        {rupiah(shifts.reduce((sum, s) => sum + (Number(s.initial_cash) || 0), 0))}
                      </td>
                      <td className="mono right">
                        {(() => {
                          const comparable = shifts.filter(s => s.initial_cash_difference !== null && s.initial_cash_difference !== undefined);
                          if (comparable.length === 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
                          const totDiff = comparable.reduce((sum, s) => sum + (Number(s.initial_cash_difference) || 0), 0);
                          return (
                            <span style={{ color: totDiff === 0 ? 'var(--ok)' : totDiff > 0 ? '#38bdf8' : 'var(--danger)' }}>
                              {totDiff === 0 ? 'Pas (Rp 0)' : totDiff > 0 ? `+${rupiah(totDiff)}` : rupiah(totDiff)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="mono right" style={{ color: '#34d399' }}>
                        {rupiah(shifts.reduce((sum, s) => sum + (Number(s.cash_sales) || 0), 0))}
                      </td>
                      <td className="mono right" style={{ color: '#38bdf8' }}>
                        {rupiah(shifts.reduce((sum, s) => sum + (Number(s.qris_sales) || 0), 0))}
                      </td>
                      <td className="mono right" style={{ color: '#10b981' }}>
                        {rupiah(shifts.reduce((sum, s) => sum + (Number(s.grab_sales) || 0), 0))}
                      </td>
                      <td className="mono right" style={{ color: '#c084fc' }}>
                        {rupiah(shifts.reduce((sum, s) => sum + ((Number(s.transfer_sales) || 0) + (Number(s.debit_sales) || 0) + (Number(s.other_sales) || 0)), 0))}
                      </td>
                      <td className="mono right" style={{ fontWeight: 800, color: '#ffffff', background: 'rgba(255,255,255,0.06)' }}>
                        {rupiah(shifts.reduce((sum, s) => sum + (Number(s.system_cash) || 0), 0))}
                      </td>
                      <td className="mono right">
                        {rupiah(shifts.reduce((sum, s) => sum + (s.closing_cash !== null ? Number(s.closing_cash) : 0), 0))}
                      </td>
                      <td className="mono right">
                        {(() => {
                          const totalDiff = shifts.reduce((sum, s) => sum + (s.status === 'CLOSED' ? (Number(s.cash_difference) || 0) : 0), 0);
                          return (
                            <span style={{ color: totalDiff === 0 ? 'var(--ok)' : totalDiff > 0 ? '#38bdf8' : 'var(--danger)' }}>
                              {totalDiff > 0 ? `+${rupiah(totalDiff)}` : totalDiff < 0 ? rupiah(totalDiff) : 'Pas (Rp 0)'}
                            </span>
                          );
                        })()}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
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

      {/* Tab: Riwayat Shift */}
      {activeTab === 'history' && (
        <div className="fade-in">
          {/* Info Banner & Filter Header */}
          <div className="card mb-4" style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.55) 0%, rgba(15, 23, 42, 0.85) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.35)',
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'rgba(139, 92, 246, 0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent-bright)'
              }}>
                <History size={20} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>Riwayat Sesi Shift & Rekapitulasi Kas</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Pantau modal awal laci kasir, penerimaan per metode pembayaran, dan verifikasi fisik uang kas closing.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={fetchHistoryShifts}
                disabled={loadingHistory}
                style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={13} className={loadingHistory ? 'spin' : ''} /> Refresh Data
              </button>
            </div>
          </div>

          {/* Filter Bar: Tanggal Spesifik & Shift di Tanggal Tersebut */}
          <div className="card mb-4" style={{
            padding: '14px 18px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            {/* Left Filter Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} style={{ color: '#fbbf24' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>Filter Shift:</span>
                <select
                  className="form-control"
                  style={{ width: 180, padding: '5px 8px', fontSize: 12 }}
                  value={historyFilterShift}
                  onChange={e => setHistoryFilterShift(e.target.value)}
                >
                  <option value="ALL">
                    Semua Shift ({historyFilterOptions.shiftsInDate.length})
                  </option>
                  {historyFilterOptions.shiftsInDate.map(sn => (
                    <option key={sn} value={sn}>{sn}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={14} style={{ color: '#38bdf8' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>Kasir:</span>
                <select
                  className="form-control"
                  style={{ width: 150, padding: '5px 8px', fontSize: 12 }}
                  value={historyFilterCashier}
                  onChange={e => setHistoryFilterCashier(e.target.value)}
                >
                  <option value="ALL">Semua Kasir</option>
                  {historyFilterOptions.cashiers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Search & Reset Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: 28, width: 180, padding: '5px 8px 5px 28px', fontSize: 12 }}
                  placeholder="Cari shift, ID, kasir..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                />
              </div>

              {(historyFilterShift !== 'ALL' || historyFilterCashier !== 'ALL' || historySearch) && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setHistoryFilterShift('ALL');
                    setHistoryFilterCashier('ALL');
                    setHistorySearch('');
                  }}
                  style={{ fontSize: 11, padding: '4px 8px', color: '#f87171' }}
                  title="Reset semua filter"
                >
                  <X size={12} style={{ marginRight: 3 }} /> Reset
                </button>
              )}
            </div>
          </div>

          {/* KPI Summary Cards: Termasuk Modal Awal Kas */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 20
          }}>
            {/* Total Sesi Shift */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.08) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Sesi Shift Terfilter
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#818cf8', marginTop: 4 }}>
                {historySummary.count} <span style={{ fontSize: 13, fontWeight: 600 }}>Shift</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {period?.from && period?.to ? `Periode: ${period.from} s/d ${period.to}` : 'Sesuai filter periode navbar'}
              </div>
            </div>

            {/* Total Modal Awal Kas (Highlighted) */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.08) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                <DollarSign size={13} /> Total Modal Awal Kas
              </div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 900, color: '#fef08a', marginTop: 4 }}>
                {rupiah(historySummary.total_initial_cash)}
              </div>
              <div style={{ fontSize: 11, color: '#fde68a', marginTop: 2 }}>
                Uang laci kasir saat buka shift
              </div>
            </div>

            {/* Total Omzet Penjualan */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(14, 165, 233, 0.08) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Omzet Penjualan
              </div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 900, color: '#38bdf8', marginTop: 4 }}>
                {rupiah(historySummary.total_sales)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ color: '#34d399' }}>Tunai: {rupiah(historySummary.total_cash_sales)}</span>
                <span>•</span>
                <span style={{ color: '#38bdf8' }}>Non-Tunai: {rupiah(historySummary.total_qris_sales + historySummary.total_grab_sales + historySummary.total_other_sales)}</span>
              </div>
            </div>

            {/* Total Kas Fisik Aktual */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.15) 0%, rgba(16, 185, 129, 0.08) 100%)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Kas Fisik (Closing)
              </div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 900, color: '#34d399', marginTop: 4 }}>
                {rupiah(historySummary.total_closing_cash)}
              </div>
              <div style={{ fontSize: 11, color: '#a7f3d0', marginTop: 2 }}>
                Kas riil yang dihitung kasir
              </div>
            </div>

            {/* Total Selisih Kas Laci */}
            <div style={{
              background: historySummary.total_diff === 0
                ? 'rgba(52, 211, 153, 0.08)'
                : historySummary.total_diff > 0
                  ? 'rgba(56, 189, 248, 0.08)'
                  : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${historySummary.total_diff === 0 ? 'rgba(52, 211, 153, 0.3)' : historySummary.total_diff > 0 ? 'rgba(56, 189, 248, 0.3)' : 'rgba(239, 68, 68, 0.35)'}`,
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Selisih Laci
              </div>
              <div className="mono" style={{
                fontSize: 20, fontWeight: 900, marginTop: 4,
                color: historySummary.total_diff === 0 ? 'var(--ok)' : historySummary.total_diff > 0 ? '#38bdf8' : 'var(--danger)'
              }}>
                {historySummary.total_diff === 0 ? 'Pas (Rp 0)' : historySummary.total_diff > 0 ? `+${rupiah(historySummary.total_diff)}` : rupiah(historySummary.total_diff)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {historySummary.total_diff === 0 ? 'Sesuai antara sistem & laci' : historySummary.total_diff > 0 ? 'Kelebihan kas fisik di laci' : 'Kekurangan kas fisik di laci'}
              </div>
            </div>

            {/* Total Setoran Kas Besar */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.08) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 11, color: '#34d399', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle size={13} /> Total Setoran Kas Besar
              </div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 900, color: '#6ee7b7', marginTop: 4 }}>
                {rupiah(historySummary.total_deposited)}
              </div>
              <div style={{ fontSize: 11, color: '#a7f3d0', marginTop: 2 }}>
                {historySummary.total_deposit_diff === 0
                  ? '✓ Sesuai uang fisik closing'
                  : historySummary.total_deposit_diff > 0
                    ? `+${rupiah(historySummary.total_deposit_diff)} Lebih Setor`
                    : `${rupiah(historySummary.total_deposit_diff)} Kurang Setor`}
              </div>
            </div>
          </div>

          {loadingHistory ? <LoadingState /> : filteredHistoryShifts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredHistoryShifts.map(s => {
                const isExpanded = expandedShiftId === s.id;
                const detail = expandedData[s.id];
                const diff = s.cash_difference ?? 0;
                const nonCashOther = (s.transfer_sales || 0) + (s.debit_sales || 0) + (s.other_sales || 0);

                return (
                  <div key={s.id} className="card" style={{
                    border: isExpanded ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid var(--border)',
                    background: isExpanded ? 'linear-gradient(180deg, rgba(30, 27, 75, 0.25) 0%, rgba(15, 23, 42, 0.4) 100%)' : 'var(--card-bg)',
                    transition: 'all 0.2s',
                    overflow: 'hidden',
                    borderRadius: 12,
                  }}>
                    {/* Shift Header (clickable) */}
                    <div
                      onClick={() => handleExpandShift(s)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        cursor: 'pointer', flexWrap: 'wrap', gap: 14,
                        padding: isExpanded ? '0 0 16px 0' : 0,
                        borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none'
                      }}
                    >
                      {/* Left Identity */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 42, height: 42, borderRadius: 10,
                          background: isExpanded ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--accent-bright)', fontWeight: 800, fontSize: 14,
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                          #{s.id}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 800, fontSize: 15, color: '#ffffff' }}>{s.shift_name}</span>
                            <span className="pill mono" style={{ fontSize: 10.5, background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                              📅 {getLocalDateStr(s.closed_at || s.opened_at) || '-'}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 3 }}>
                            <span>👤 Kasir: <strong style={{ color: '#ffffff' }}>{s.user?.name}</strong></span>
                            <span>🏢 Outlet: <strong>{s.outlet?.name || outlets.find(o => Number(o.id) === Number(s.outlet_id))?.name || 'Pusat'}</strong></span>
                            <span>🛒 <strong>{s.transactions_count || 0}</strong> trx</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Metrics: Modal Awal, Breakdown, Omzet, Kas Aktual, Selisih, Setoran */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>

                        {/* Tampilan Modal Awal Kas (Highlighted) & Selisih Shift Sebelumnya */}
                        <div style={{
                          textAlign: 'right', minWidth: 125,
                          padding: '4px 10px', borderRadius: 8,
                          background: 'rgba(245, 158, 11, 0.12)',
                          border: '1px solid rgba(245, 158, 11, 0.3)'
                        }}>
                          <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                            Modal Awal
                          </div>
                          <div className="mono" style={{ fontWeight: 800, fontSize: 13.5, color: '#fef08a' }}>
                            {rupiah(s.initial_cash)}
                          </div>
                          {s.initial_cash_difference !== null && s.initial_cash_difference !== undefined ? (
                            <div style={{
                              fontSize: 10,
                              fontWeight: 700,
                              marginTop: 1,
                              color: s.initial_cash_difference === 0
                                ? '#34d399'
                                : s.initial_cash_difference > 0
                                  ? '#38bdf8'
                                  : '#f87171'
                            }} title={
                              s.previous_shift_deposit_amount > 0
                                ? `Kas Fisik Shift Lalu: ${rupiah(s.previous_shift_closing_cash)} | Disetor: ${rupiah(s.previous_shift_deposit_amount)} | Sisa Laci: ${rupiah(s.previous_shift_remaining_drawer || 0)}`
                                : `Uang Kas Fisik Shift Sebelumnya: ${rupiah(s.previous_shift_closing_cash)}`
                            }>
                              {s.initial_cash_difference === 0
                                ? (s.initial_cash_source === 'KAS_BESAR' || s.notes?.includes('Kas Besar') ? '✓ Sesuai (Kas Besar)' : '✓ Sesuai Lalu')
                                : `${s.initial_cash_difference > 0 ? '+' : ''}${rupiah(s.initial_cash_difference)} vs Lalu`}
                            </div>
                          ) : (
                            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 1 }}>Perdana</div>
                          )}
                        </div>

                        {/* Payment Breakdown Pills */}
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                          {(s.cash_sales || 0) > 0 && (
                            <span className="pill mono" style={{ fontSize: 11, background: 'rgba(52, 211, 153, 0.12)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.25)' }}>
                              Tunai: {rupiah(s.cash_sales)}
                            </span>
                          )}
                          {(s.qris_sales || 0) > 0 && (
                            <span className="pill mono" style={{ fontSize: 11, background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                              QRIS: {rupiah(s.qris_sales)}
                            </span>
                          )}
                          {(s.grab_sales || 0) > 0 && (
                            <span className="pill mono" style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                              Grab: {rupiah(s.grab_sales)}
                            </span>
                          )}
                          {nonCashOther > 0 && (
                            <span className="pill mono" style={{ fontSize: 11, background: 'rgba(192, 132, 252, 0.12)', color: '#c084fc', border: '1px solid rgba(192, 132, 252, 0.25)' }}>
                              Trf/EDC: {rupiah(nonCashOther)}
                            </span>
                          )}
                        </div>

                        {/* Total Omzet */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Omzet</div>
                          <div className="mono" style={{ fontWeight: 800, fontSize: 14, color: '#ffffff' }}>{rupiah(s.system_cash)}</div>
                        </div>

                        {/* Kas Aktual Fisik */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Kas Fisik</div>
                          <div className="mono" style={{ fontWeight: 700, fontSize: 13.5, color: '#34d399' }}>
                            {s.closing_cash !== null ? rupiah(s.closing_cash) : '—'}
                          </div>
                        </div>

                        {/* Selisih Laci */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Selisih Laci</div>
                          <div className="mono" style={{
                            fontWeight: 700, fontSize: 13.5,
                            color: diff === 0 ? 'var(--ok)' : diff > 0 ? '#38bdf8' : 'var(--danger)'
                          }}>
                            {diff === 0 ? 'Pas' : diff > 0 ? `+${rupiah(diff)}` : rupiah(diff)}
                          </div>
                        </div>

                        {/* Setoran Kas Besar Badge & Approval Actions */}
                        <div style={{
                          textAlign: 'right', minWidth: 140,
                          padding: '6px 10px', borderRadius: 8,
                          background: (s.deposit_status === 'APPROVED' || s.is_deposited)
                            ? 'rgba(16, 185, 129, 0.12)'
                            : (s.deposit_status === 'PENDING' || s.is_deposit_pending)
                              ? 'rgba(245, 158, 11, 0.12)'
                              : (s.deposit_status === 'REJECTED' || s.is_deposit_rejected)
                                ? 'rgba(239, 68, 68, 0.12)'
                                : 'rgba(245, 158, 11, 0.1)',
                          border: (s.deposit_status === 'APPROVED' || s.is_deposited)
                            ? '1px solid rgba(16, 185, 129, 0.35)'
                            : (s.deposit_status === 'PENDING' || s.is_deposit_pending)
                              ? '1px solid rgba(245, 158, 11, 0.35)'
                              : (s.deposit_status === 'REJECTED' || s.is_deposit_rejected)
                                ? '1px solid rgba(239, 68, 68, 0.35)'
                                : '1px solid rgba(245, 158, 11, 0.3)'
                        }}>
                          {(s.deposit_status === 'APPROVED' || s.is_deposited) ? (
                            <>
                              <div style={{
                                fontSize: 10,
                                color: '#34d399',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: 3
                              }}>
                                <CheckCircle size={10} /> Disetujui Owner
                              </div>
                              <div className="mono" style={{ fontWeight: 800, fontSize: 13.5, color: '#6ee7b7' }}>
                                {rupiah(s.deposit_amount)}
                              </div>
                              <div style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: (s.deposit_diff || 0) === 0 ? '#34d399' : (s.deposit_diff || 0) > 0 ? '#38bdf8' : '#f87171'
                              }}>
                                {(s.deposit_diff || 0) === 0 ? '✓ Sesuai Fisik' : `${(s.deposit_diff || 0) > 0 ? '+' : ''}${rupiah(s.deposit_diff)} (${(s.deposit_diff || 0) > 0 ? 'Lebih' : 'Kurang'})`}
                              </div>
                              {s.deposit_approved_by_name && (
                                <div style={{ fontSize: 9, color: '#34d399', opacity: 0.85, marginTop: 1 }}>
                                  oleh {s.deposit_approved_by_name}
                                </div>
                              )}
                            </>
                          ) : (s.deposit_status === 'PENDING' || s.is_deposit_pending) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                              <div style={{
                                fontSize: 10,
                                color: '#fbbf24',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3
                              }}>
                                <Clock size={10} /> Menunggu Approval
                              </div>
                              <div className="mono" style={{ fontWeight: 800, fontSize: 13, color: '#fef08a' }}>
                                {rupiah(s.deposit_amount || s.closing_cash)}
                              </div>
                              <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
                                ke {s.deposit_account_label || 'Kas Besar'}
                              </div>
                              {isOwnerOrManager ? (
                                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    style={{ fontSize: 9.5, padding: '2px 7px', background: '#059669', color: '#ffffff', border: 'none', borderRadius: 4, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                                    onClick={(e) => handleOpenApproveDeposit(s, e)}
                                    title="Setujui dan bukukan setoran ini"
                                  >
                                    <Check size={10} /> Setujui
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    style={{ fontSize: 9.5, padding: '2px 7px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 4, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                                    onClick={(e) => handleOpenRejectDeposit(s, e)}
                                    title="Tolak pengajuan setoran ini"
                                  >
                                    <X size={10} /> Tolak
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: 9.5, color: '#fbbf24', fontStyle: 'italic' }}>
                                  Menunggu Konfirmasi Owner
                                </span>
                              )}
                            </div>
                          ) : (s.deposit_status === 'REJECTED' || s.is_deposit_rejected) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                              <div style={{
                                fontSize: 10,
                                color: '#f87171',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3
                              }} title={`Catatan: ${s.deposit_rejection_reason || '-'}`}>
                                <X size={10} /> Ditolak Owner
                              </div>
                              {s.deposit_rejection_reason && (
                                <span style={{ fontSize: 9, color: '#fca5a5', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.deposit_rejection_reason}>
                                  {s.deposit_rejection_reason}
                                </span>
                              )}
                                {s.has_next_shift ? (
                                  <span style={{ fontSize: 9, color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Lock size={9} /> Shift berikutnya berjalan
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    style={{ fontSize: 9.5, padding: '2px 6px', borderRadius: 4, marginTop: 2, fontWeight: 700 }}
                                    onClick={(e) => handleOpenDepositForShift(s, e)}
                                  >
                                    Setor Ulang
                                  </button>
                                )}
                            </div>
                          ) : s.has_next_shift ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                              <div style={{
                                fontSize: 9.5,
                                color: '#94a3b8',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3
                              }}>
                                <Lock size={10} /> Dialihkan ke Shift Berikutnya
                              </div>
                              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                                (Tidak dapat setor)
                              </span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                              <div style={{
                                fontSize: 10,
                                color: '#fbbf24',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3
                              }}>
                                <AlertTriangle size={10} /> Belum Setor
                              </div>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: 9.5, padding: '2px 8px', borderRadius: 4, width: '100%', marginTop: 2, fontWeight: 700 }}
                                onClick={(e) => handleOpenDepositForShift(s, e)}
                              >
                                + Setor Sekarang
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Print Receipt Button */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => { e.stopPropagation(); handlePrintReceipt(s.id); }}
                            title="Cetak Rekap Kas Struk Shift"
                            disabled={loadingReceipt}
                          >
                            <Printer size={13} />
                          </button>
                        </div>

                        {/* Chevron Expand Indicator */}
                        <ArrowRight size={16} style={{
                          color: isExpanded ? 'var(--accent-bright)' : 'var(--text-muted)',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s'
                        }} />
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div style={{ paddingTop: 16 }} className="fade-in">
                        {/* Shift info summary cards: Termasuk Modal Awal & OPEX */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
                          <MiniCard label="Waktu Buka" value={new Date(s.opened_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })} color="var(--text-secondary)" />
                          <MiniCard label="Waktu Tutup" value={s.closed_at ? new Date(s.closed_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-'} color="var(--accent-bright)" />
                          <MiniCard label="Modal Awal Kas" value={rupiah(s.initial_cash)} color="#fbbf24" />
                          <MiniCard label="Pengeluaran OPEX" value={`-${rupiah(detail?.summary?.total_expenses || 0)}`} color={(detail?.summary?.total_expenses || 0) > 0 ? '#ef4444' : 'var(--text-muted)'} />
                          <MiniCard label="Kas Aktual (Fisik)" value={s.closing_cash !== null ? rupiah(s.closing_cash) : '—'} color="var(--ok)" />
                        </div>

                        {!detail ? (
                          <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <LoadingState />
                          </div>
                        ) : (
                          <>
                            {/* Biaya Operasional / OPEX Shift */}
                            {detail.summary?.expenses?.length > 0 && (
                              <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <DollarSign size={14} style={{ color: '#ef4444' }} />
                                    <span>Biaya Operasional / OPEX ({detail.summary.expenses.length})</span>
                                  </div>
                                  <span className="mono" style={{ color: '#ef4444', fontWeight: 700, fontSize: 12 }}>
                                    Total: -{rupiah(detail.summary.total_expenses)} (Tunai: -{rupiah(detail.summary.cash_expenses || 0)})
                                  </span>
                                </div>
                                <div className="table-wrap" style={{ maxHeight: 200, overflowY: 'auto' }}>
                                  <table>
                                    <thead>
                                      <tr>
                                        <th>Waktu / No. Bukti</th>
                                        <th>Kategori</th>
                                        <th>Deskripsi Pengeluaran</th>
                                        <th>Metode Bayar</th>
                                        <th className="right">Jumlah</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detail.summary.expenses.map((exp, idx) => (
                                        <tr key={idx}>
                                          <td className="mono" style={{ fontSize: 11, color: 'var(--accent-bright)' }}>
                                            {exp.time} · {exp.expense_no || `#EXP-${exp.id}`}
                                          </td>
                                          <td>
                                            <span className="pill pill-secondary mono" style={{ fontSize: 10 }}>
                                              {exp.category_label || exp.category}
                                            </span>
                                          </td>
                                          <td style={{ fontWeight: 500, fontSize: 12 }}>
                                            {exp.name || exp.description}
                                          </td>
                                          <td>
                                            {exp.is_cash ? (
                                              <span className="pill pill-danger mono" style={{ fontSize: 9.5 }}>Tunai (Laci)</span>
                                            ) : (
                                              <span className="pill pill-secondary mono" style={{ fontSize: 9.5 }}>Non-Tunai</span>
                                            )}
                                          </td>
                                          <td className="mono right" style={{ fontWeight: 700, color: exp.is_cash ? '#ef4444' : '#ffffff', fontSize: 12 }}>
                                            {rupiah(exp.amount)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Menu Terjual */}
                            {detail.summary?.menus_sold?.length > 0 && (
                              <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <ShoppingBag size={14} style={{ color: 'var(--accent-bright)' }} /> Menu Terjual
                                </div>
                                <div className="table-wrap" style={{ maxHeight: 200, overflowY: 'auto' }}>
                                  <table>
                                    <thead>
                                      <tr>
                                        <th>Menu</th>
                                        <th className="right">Porsi</th>
                                        <th className="right">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detail.summary.menus_sold.map(m => (
                                        <tr key={m.menu_id}>
                                          <td style={{ fontWeight: 600 }}>{m.menu_name}</td>
                                          <td className="mono right">{m.qty}x</td>
                                          <td className="mono right">{rupiah(m.total)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Daftar Transaksi */}
                            {detail.transactions?.length > 0 && (
                              <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Receipt size={14} style={{ color: 'var(--accent-bright)' }} /> Daftar Transaksi ({detail.transactions.length})
                                </div>
                                <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
                                  <table>
                                    <thead>
                                      <tr>
                                        <th style={{ width: 50 }}>ID</th>
                                        <th style={{ width: 50 }}>Jam</th>
                                        <th>Menu</th>
                                        <th className="right" style={{ width: 50 }}>Qty</th>
                                        <th className="right">Total</th>
                                        <th style={{ width: 70 }}>Bayar</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detail.transactions.map(t => (
                                        <tr key={t.id}>
                                          <td className="mono" style={{ color: 'var(--accent-bright)', fontSize: 11 }}>#{t.id}</td>
                                          <td className="mono" style={{ fontSize: 11 }}>{t.time}</td>
                                          <td style={{ fontWeight: 500, fontSize: 12 }}>{t.menu_name}</td>
                                          <td className="mono right" style={{ fontSize: 12 }}>{t.qty}x</td>
                                          <td className="mono right" style={{ fontSize: 12 }}>{rupiah(t.total_price)}</td>
                                          <td>
                                            <span className="pill pill-muted mono" style={{ fontSize: 9.5 }}>
                                              {t.payment_method || 'CASH'}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Bahan Terpakai */}
                            {detail.summary?.ingredient_usages?.length > 0 && (
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <FileText size={14} style={{ color: 'var(--accent-bright)' }} /> Pemakaian Bahan Baku
                                </div>
                                <div className="table-wrap" style={{ maxHeight: 200, overflowY: 'auto' }}>
                                  <table>
                                    <thead>
                                      <tr>
                                        <th>Bahan</th>
                                        <th className="right">Qty</th>
                                        <th className="right">Biaya</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detail.summary.ingredient_usages.map(u => (
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

                            {detail.transactions?.length === 0 && !detail.summary?.menus_sold?.length && (
                              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: 13 }}>
                                Tidak ada transaksi pada shift ini.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '50px 20px', background: 'rgba(15, 23, 42, 0.4)' }}>
              <History size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <h4 style={{ margin: '0 0 6px 0', color: '#ffffff', fontSize: 16 }}>Belum Ada Riwayat Shift</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
                Belum ada shift yang ditutup pada periode dan outlet yang dipilih.
              </p>
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
                          fetchLastClosedShift(newOid);
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

                  {/* Status Kas Fisik Laci Shift Sebelumnya & Pilihan Sumber Modal */}
                  <div className="form-group mb-3">
                    {loadingLastClosed ? (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8, fontStyle: 'italic' }}>
                        Memeriksa kas riil shift sebelumnya...
                      </div>
                    ) : lastClosedShift ? (() => {
                      const prevClosing = Number(lastClosedShift.closing_cash || 0);
                      const depositAmt = Number(lastClosedShift.deposit_amount || 0);
                      const isDeposited = lastClosedShift.is_deposited || depositAmt > 0;
                      const remainingInDrawer = lastClosedShift.remaining_cash_in_drawer != null
                        ? Number(lastClosedShift.remaining_cash_in_drawer)
                        : Math.max(0, prevClosing - (isDeposited ? depositAmt : 0));
                      const kasBesarBal = Number(lastClosedShift.kas_besar_balance || 0);
                      const source = openForm.initial_cash_source || 'DRAWER';

                      return (
                        <div style={{ marginBottom: 14 }}>
                          {/* Banner Info Kas Fisik Laci Shift Sebelumnya */}
                          <div style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 10,
                            padding: '10px 14px',
                            marginBottom: 12
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Shift Sebelumnya #{lastClosedShift.id} ({lastClosedShift.shift_name})
                              </span>
                              <span style={{ fontSize: 11, color: '#38bdf8' }}>
                                Oleh: {lastClosedShift.closed_by_name || lastClosedShift.cashier_name}
                              </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
                              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: 6 }}>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Kas Fisik Closing</div>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff' }}>{rupiah(prevClosing)}</div>
                              </div>
                              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: 6 }}>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Setoran Kasir</div>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: depositAmt > 0 ? '#38bdf8' : 'var(--text-muted)' }}>
                                  {depositAmt > 0 ? rupiah(depositAmt) : 'Rp 0'}
                                </div>
                              </div>
                              <div style={{ background: remainingInDrawer === 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', padding: '6px 8px', borderRadius: 6, border: remainingInDrawer === 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)' }}>
                                <div style={{ fontSize: 10, color: remainingInDrawer === 0 ? '#fbbf24' : '#34d399' }}>Sisa Kas di Laci</div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: remainingInDrawer === 0 ? '#fbbf24' : '#34d399' }}>{rupiah(remainingInDrawer)}</div>
                              </div>
                            </div>
                          </div>

                          {/* Pilihan Sumber Modal Kasir: Lanjutkan vs Ambil dari Kas Besar */}
                          <label className="form-label" style={{ fontWeight: 700, color: '#ffffff', marginBottom: 8, display: 'block' }}>
                            Pilih Sumber Modal Awal Shift *
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                            {/* Option 1: Lanjutkan Kas Laci */}
                            <div
                              onClick={() => {
                                setOpenForm(f => ({
                                  ...f,
                                  initial_cash_source: 'DRAWER',
                                  initial_cash: remainingInDrawer,
                                }));
                              }}
                              style={{
                                padding: '12px',
                                borderRadius: 10,
                                border: source === 'DRAWER' ? '2px solid var(--accent-bright)' : '1px solid rgba(255,255,255,0.1)',
                                background: source === 'DRAWER' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <Wallet size={16} color={source === 'DRAWER' ? 'var(--accent-bright)' : 'var(--text-muted)'} />
                                <strong style={{ fontSize: 12.5, color: source === 'DRAWER' ? '#ffffff' : 'var(--text-primary)' }}>
                                  Lanjutkan Kas Laci
                                </strong>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                {remainingInDrawer === 0
                                  ? 'Kas fisik sisa Rp 0 (saldo awal ikut Rp 0). Saldo Kas Besar tetap.'
                                  : `Lanjutkan sisa laci ${rupiah(remainingInDrawer)}. Tidak memotong Kas Besar.`
                                }
                              </div>
                              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: source === 'DRAWER' ? '#38bdf8' : 'var(--text-muted)' }}>
                                Modal: {rupiah(remainingInDrawer)}
                              </div>
                            </div>

                            {/* Option 2: Ambil Uang dari Kas Besar */}
                            <div
                              onClick={() => {
                                setOpenForm(f => ({
                                  ...f,
                                  initial_cash_source: 'KAS_BESAR',
                                  kas_besar_amount: f.kas_besar_amount || 100000,
                                }));
                                if (!isOwnerOrManager) fetchSupervisors();
                              }}
                              style={{
                                padding: '12px',
                                borderRadius: 10,
                                border: source === 'KAS_BESAR' ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                                background: source === 'KAS_BESAR' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.02)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <Landmark size={16} color={source === 'KAS_BESAR' ? '#34d399' : 'var(--text-muted)'} />
                                <strong style={{ fontSize: 12.5, color: source === 'KAS_BESAR' ? '#ffffff' : 'var(--text-primary)' }}>
                                  Ambil dari Kas Besar
                                </strong>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                Tarik uang dari Brankas/Kas Besar untuk modal kasir. Saldo Kas Besar akan berkurang.
                              </div>
                              <div style={{ marginTop: 6, fontSize: 11, color: '#34d399', fontWeight: 600 }}>
                                Tersedia: {rupiah(kasBesarBal)}
                              </div>
                            </div>
                          </div>

                          {/* Dynamic Inputs depending on Selection */}
                          {source === 'KAS_BESAR' ? (
                            <div style={{
                              background: 'rgba(16, 185, 129, 0.08)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              borderRadius: 10,
                              padding: '12px 14px',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <label className="form-label" style={{ fontWeight: 700, color: '#34d399', margin: 0, fontSize: 12 }}>
                                  💵 Nominal Diambil dari Kas Besar (Rp) *
                                </label>
                                <span style={{ fontSize: 11, color: '#a7f3d0' }}>
                                  Saldo Kas Besar: <strong>{rupiah(kasBesarBal)}</strong>
                                </span>
                              </div>
                              <input
                                type="number"
                                min={0}
                                step={1000}
                                className="form-control mono"
                                style={{ fontSize: 16, fontWeight: 800, color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.5)' }}
                                required
                                value={openForm.kas_besar_amount}
                                onChange={e => setOpenForm(f => ({ ...f, kas_besar_amount: e.target.value }))}
                                placeholder="100000"
                              />

                              {/* Quick Presets for Kas Besar Withdrawal */}
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                                {[50000, 100000, 200000, 300000, 500000].map(amt => (
                                  <button
                                    key={amt}
                                    type="button"
                                    onClick={() => setOpenForm(f => ({ ...f, kas_besar_amount: amt }))}
                                    className="btn btn-sm btn-outline"
                                    style={{
                                      fontSize: 11,
                                      padding: '3px 8px',
                                      background: Number(openForm.kas_besar_amount) === amt ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                                      borderColor: Number(openForm.kas_besar_amount) === amt ? '#10b981' : 'rgba(255,255,255,0.15)',
                                      color: Number(openForm.kas_besar_amount) === amt ? '#34d399' : 'var(--text-secondary)'
                                    }}
                                  >
                                    {rupiah(amt)}
                                  </button>
                                ))}
                              </div>

                              <div style={{ fontSize: 11.5, color: '#a7f3d0', marginTop: 8, lineHeight: 1.4 }}>
                                ⚡ <strong>Efek Pembukuan:</strong> Akun <strong>1-11001 (Kas Besar)</strong> otomatis berkurang <strong>{rupiah(Number(openForm.kas_besar_amount || 0))}</strong> dan masuk ke <strong>1-11002 (Kas Kecil Kasir)</strong> sebagai modal awal shift.
                              </div>

                              {/* Persetujuan Manajer atau Owner */}
                              {isOwnerOrManager ? (
                                <div style={{
                                  marginTop: 10,
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  background: 'rgba(56, 189, 248, 0.12)',
                                  border: '1px solid rgba(56, 189, 248, 0.3)',
                                  fontSize: 11.5,
                                  color: '#bae6fd',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                }}>
                                  <ShieldCheck size={16} color="#38bdf8" style={{ flexShrink: 0 }} />
                                  <div>
                                    <strong>Otorisasi Langsung:</strong> Anda login sebagai <strong>{currentUser?.name}</strong> ({currentUser?.role_label || 'Owner/Manajer'}). Pengambilan Kas Besar disetujui langsung atas nama Anda.
                                  </div>
                                </div>
                              ) : (
                                <div style={{
                                  marginTop: 12,
                                  padding: '12px',
                                  borderRadius: 8,
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <Lock size={15} color="#ef4444" />
                                    <strong style={{ fontSize: 12, color: '#fca5a5' }}>
                                      Persetujuan Manajer / Owner Wajib
                                    </strong>
                                  </div>
                                  <div style={{ fontSize: 11, color: '#e2e8f0', marginBottom: 10, lineHeight: 1.4 }}>
                                    Pengambilan uang dari Kas Besar harus disetujui oleh Manajer atau Owner. Minta Manajer/Owner memilih akun dan memasukkan Password / PIN otorisasi.
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <div>
                                      <label style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', display: 'block', marginBottom: 4 }}>
                                        Pilih Manajer / Owner *
                                      </label>
                                      {loadingSupervisors ? (
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Memuat daftar...</div>
                                      ) : (
                                        <select
                                          className="form-control"
                                          style={{ fontSize: 12, padding: '6px 8px' }}
                                          value={openForm.supervisor_id}
                                          onChange={e => setOpenForm(f => ({ ...f, supervisor_id: e.target.value }))}
                                          required
                                        >
                                          <option value="">-- Pilih Akun Approver --</option>
                                          {supervisors.map(s => (
                                            <option key={s.id} value={s.id} style={{ background: '#11162d', color: '#fff' }}>
                                              {s.name} ({s.role_label || s.role})
                                            </option>
                                          ))}
                                        </select>
                                      )}
                                    </div>
                                    <div>
                                      <label style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', display: 'block', marginBottom: 4 }}>
                                        Password / PIN Otorisasi *
                                      </label>
                                      <input
                                        type="password"
                                        className="form-control"
                                        style={{ fontSize: 12, padding: '6px 8px' }}
                                        placeholder="Password / PIN"
                                        value={openForm.supervisor_password}
                                        onChange={e => setOpenForm(f => ({ ...f, supervisor_password: e.target.value }))}
                                        required
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: 10,
                              padding: '12px 14px',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <label className="form-label" style={{ fontWeight: 700, color: '#ffffff', margin: 0, fontSize: 12 }}>
                                  💵 Modal Awal Kas di Laci (Rp) *
                                </label>
                                {remainingInDrawer > 0 && (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    style={{
                                      fontSize: 11,
                                      padding: '2px 8px',
                                      color: '#38bdf8',
                                      background: 'rgba(56, 189, 248, 0.1)',
                                      border: '1px solid rgba(56, 189, 248, 0.25)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                    onClick={() => setOpenForm(f => ({ ...f, initial_cash: remainingInDrawer }))}
                                  >
                                    <RotateCcw size={11} /> Samakan ({rupiah(remainingInDrawer)})
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                min={0}
                                step={1000}
                                className="form-control mono"
                                style={{ fontSize: 15, fontWeight: 700 }}
                                required
                                value={openForm.initial_cash}
                                onChange={e => setOpenForm(f => ({ ...f, initial_cash: e.target.value }))}
                                placeholder="0"
                              />

                              {/* Comparison Notice */}
                              {(() => {
                                const inputAmt = Number(openForm.initial_cash || 0);
                                const isMatch = inputAmt === remainingInDrawer;
                                const diff = inputAmt - remainingInDrawer;
                                const diffFormatted = diff > 0 ? `+${rupiah(diff)} (Lebih)` : `-${rupiah(Math.abs(diff))} (Kurang)`;

                                if (isMatch) {
                                  return (
                                    <div style={{
                                      marginTop: 8,
                                      padding: '8px 12px',
                                      borderRadius: 8,
                                      background: 'rgba(16, 185, 129, 0.1)',
                                      border: '1px solid rgba(16, 185, 129, 0.3)',
                                      fontSize: 12,
                                      color: '#a7f3d0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                    }}>
                                      <CheckCircle size={16} color="#34d399" style={{ flexShrink: 0 }} />
                                      <div>
                                        {remainingInDrawer === 0
                                          ? <><strong>Sesuai Sisa Kas Laci (Rp 0):</strong> Seluruh kas shift sebelumnya telah disetor. Modal awal shift tercatat Rp 0.</>
                                          : <><strong>Sesuai Sisa Kas Laci:</strong> Modal awal sama persis dengan sisa fisik laci (<strong>{rupiah(remainingInDrawer)}</strong>).</>
                                        }
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div style={{
                                    marginTop: 8,
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    background: 'rgba(245, 158, 11, 0.12)',
                                    border: '1px solid rgba(245, 158, 11, 0.4)',
                                    fontSize: 12,
                                    color: '#fde68a',
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                      <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
                                      <strong style={{ color: '#f59e0b' }}>
                                        Peringatan: Berbeda dengan Sisa Kas Laci ({rupiah(remainingInDrawer)})!
                                      </strong>
                                    </div>
                                    <div style={{ fontSize: 11.5, color: '#cbd5e1', marginBottom: 6 }}>
                                      Sisa kas fisik di laci setelah setoran shift sebelumnya adalah <strong style={{ color: '#38bdf8' }}>{rupiah(remainingInDrawer)}</strong>.
                                      Terdapat selisih <strong style={{ color: diff > 0 ? '#34d399' : '#f87171' }}>{diffFormatted}</strong>.
                                    </div>
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      style={{
                                        fontSize: 11,
                                        padding: '3px 8px',
                                        borderRadius: 6,
                                        background: 'rgba(245, 158, 11, 0.2)',
                                        color: '#fbbf24',
                                        border: '1px solid rgba(245, 158, 11, 0.4)',
                                        fontWeight: 700,
                                      }}
                                      onClick={() => setOpenForm(f => ({ ...f, initial_cash: remainingInDrawer }))}
                                    >
                                      👉 Samakan dengan Sisa Laci ({rupiah(remainingInDrawer)})
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })() : (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <label className="form-label" style={{ fontWeight: 700, color: '#ffffff', margin: 0 }}>
                            💵 Modal Awal Kas di Laci (Uang Kembalian) *
                          </label>
                        </div>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          className="form-control mono"
                          style={{ fontSize: 15, fontWeight: 700 }}
                          required
                          value={openForm.initial_cash}
                          onChange={e => setOpenForm(f => ({ ...f, initial_cash: e.target.value }))}
                          placeholder="100000"
                        />
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                          ℹ️ Belum ada riwayat closing shift sebelumnya di cabang ini.
                        </div>
                      </div>
                    )}
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
              <>
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
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Rekapitulasi Kas di Laci</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'none' }}>*Hanya transaksi kas tunai</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Modal Awal Kasir (Kembalian):</span>
                        <span className="mono" style={{ fontWeight: 600 }}>{rupiah(closeSummary?.shift?.initial_cash)}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Penjualan Kas / Tunai <span style={{ color: 'var(--ok)', fontSize: 11 }}>(Masuk Laci)</span>:
                        </span>
                        <span className="mono" style={{ fontWeight: 600, color: 'var(--ok)' }}>
                          +{rupiah(closeSummary?.cash_sales ?? (closeSummary?.total_sales || 0))}
                        </span>
                      </div>

                      {(closeSummary?.cash_expenses || 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                          <span style={{ color: '#fca5a5' }}>
                            Pengeluaran Kasir / OPEX <span style={{ color: '#ef4444', fontSize: 11 }}>(Keluar Laci)</span>:
                          </span>
                          <span className="mono" style={{ fontWeight: 600, color: '#ef4444' }}>
                            -{rupiah(closeSummary?.cash_expenses)}
                          </span>
                        </div>
                      )}

                      {(closeSummary?.non_cash_expenses || 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                          <span>Biaya OPEX Non-Tunai (Transfer / Bank):</span>
                          <span className="mono" style={{ color: '#cbd5e1' }}>{rupiah(closeSummary?.non_cash_expenses)}</span>
                        </div>
                      )}

                      {(closeSummary?.non_cash_sales || 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                          <span>Penjualan QRIS / Transfer / EDC (Masuk Bank):</span>
                          <span className="mono" style={{ color: '#38bdf8' }}>{rupiah(closeSummary?.non_cash_sales)}</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                        <span>Total Omzet Penjualan ({closeSummary?.total_transactions || 0} transaksi):</span>
                        <span className="mono">{rupiah(closeSummary?.total_sales)}</span>
                      </div>

                      {closeSummary?.order_number_range && closeSummary.order_number_range !== '-' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
                          <span>Rentang No. Nota:</span>
                          <span className="mono" style={{ color: '#ffffff', fontWeight: 600 }}>{closeSummary.order_number_range}</span>
                        </div>
                      )}

                      <div style={{
                        display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 8,
                        borderTop: '1px dashed var(--border-strong)', fontSize: 14, fontWeight: 700
                      }}>
                        <span>Kas di Laci yang Harus Ada (Modal + Tunai - OPEX):</span>
                        <span className="mono" style={{ color: 'var(--accent-bright)' }}>{rupiah(closeSummary?.expected_cash)}</span>
                      </div>
                    </div>

                    {/* Rincian OPEX Shift Ini */}
                    {closeSummary?.expenses?.length > 0 && (
                      <div style={{
                        marginTop: -4,
                        marginBottom: 16,
                        background: 'rgba(239, 68, 68, 0.06)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: 10,
                        padding: '12px 14px'
                      }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fca5a5', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <DollarSign size={14} style={{ color: '#ef4444' }} />
                            <span>Rincian Biaya Operasional / OPEX ({closeSummary.expenses.length} item)</span>
                          </div>
                          <span className="mono" style={{ color: '#ef4444', fontWeight: 700 }}>
                            Total: {rupiah(closeSummary.total_expenses)}
                          </span>
                        </div>
                        <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                          {closeSummary.expenses.map((exp, idx) => (
                            <div key={idx} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: 11.5,
                              padding: '4px 0',
                              borderBottom: idx < closeSummary.expenses.length - 1 ? '1px dashed rgba(255,255,255,0.06)' : 'none'
                            }}>
                              <div>
                                <span style={{ fontWeight: 600, color: '#ffffff' }}>{exp.name || exp.description}</span>
                                <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 6 }}>({exp.category_label || exp.category})</span>
                                {exp.is_cash ? (
                                  <span className="pill pill-danger mono" style={{ fontSize: 9.5, marginLeft: 6, padding: '1px 5px' }}>Tunai Laci</span>
                                ) : (
                                  <span className="pill pill-secondary mono" style={{ fontSize: 9.5, marginLeft: 6, padding: '1px 5px' }}>Bank</span>
                                )}
                              </div>
                              <span className="mono" style={{ color: exp.is_cash ? '#f87171' : '#cbd5e1', fontWeight: 600 }}>
                                {rupiah(exp.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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
                          <span>Selisih Uang Fisik vs Kas di Laci:</span>
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
                                <th className="right">HPP Pemakaian (BOM)</th>
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
                {/* Post-close: suggest print */}
                {activeShift?.status === 'CLOSED' && (
                  <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handlePrintReceipt(activeShift.id)}
                      disabled={loadingReceipt}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                      <Printer size={14} /> Cetak Rekap Kas Shift
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Ajukan Setoran Uang Kasir ke Owner / Lanjutkan */}
      {showDepositModal && depositShift && (
        <div className="modal-overlay" onClick={handleSkipDeposit}>
          <div className="modal-content" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarSign size={20} style={{ color: '#10b981' }} />
                <span>Ajukan Setoran Kasir ke Owner</span>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={handleSkipDeposit} title="Tutup & Lanjutkan">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDepositSubmit}>
              <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                {/* Banner Info Closing Berhasil */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 95, 70, 0.2))',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: 'rgba(16, 185, 129, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#34d399',
                    flexShrink: 0
                  }}>
                    <CheckCircle size={24} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: '#34d399', marginBottom: 2 }}>
                      Shift #{depositShift.id} Ditutup — Pengajuan Setoran
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Kasir: <strong>{depositShift.cashier_name}</strong> | Shift: <strong>{depositShift.shift_name}</strong>
                    </div>
                  </div>
                </div>

                {/* Banner Rejection Alert if Re-submitting */}
                {depositShift.deposit_status === 'REJECTED' && depositShift.deposit_rejection_reason && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 16,
                    fontSize: 12,
                    color: '#fca5a5'
                  }}>
                    <div style={{ fontWeight: 700, color: '#f87171', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={14} /> Pengajuan Sebelumnya Ditolak Owner:
                    </div>
                    <div>"{depositShift.deposit_rejection_reason}"</div>
                    <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>Silakan perbaiki nominal atau keterangan setoran di bawah ini lalu ajukan kembali.</div>
                  </div>
                )}

                {/* Card Kas Fisik di Laci */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '16px',
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Total Uang Kas Fisik di Laci:
                    </span>
                    <span className="mono" style={{ fontSize: 17, fontWeight: 800, color: 'var(--accent-bright)' }}>
                      {rupiah(depositShift.closing_cash)}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                    Ajukan setoran uang fisik ini ke Owner/Manajer untuk diverifikasi. Dana baru akan resmi dipindahkan ke Kas Besar / Rekening Bank setelah <strong>disetujui (Approved)</strong> oleh Owner.
                  </p>
                </div>

                {/* Input Nominal Setor */}
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Nominal yang Disetor:</span>
                    <span className="mono" style={{ color: '#10b981', fontWeight: 700 }}>
                      {depositForm.amount ? rupiah(depositForm.amount) : 'Rp 0'}
                    </span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)', zIndex: 1 }}>
                      Rp
                    </span>
                    <input
                      type="number"
                      min={0}
                      className="form-control"
                      style={{ paddingLeft: 42, fontSize: 16, fontWeight: 700, color: '#34d399' }}
                      value={depositForm.amount}
                      onChange={e => setDepositForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0"
                      required
                    />
                  </div>

                  {/* Preset Quick Buttons */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => setDepositForm(f => ({ ...f, amount: depositShift.closing_cash || 0 }))}
                    >
                      Setor Semua (100%)
                    </button>
                    {Number(depositShift.closing_cash) > 100000 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => setDepositForm(f => ({ ...f, amount: Math.max(0, Number(depositShift.closing_cash) - 100000) }))}
                      >
                        Sisakan Rp 100rb di Laci
                      </button>
                    )}
                    {Number(depositShift.closing_cash) > 50000 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => setDepositForm(f => ({ ...f, amount: Math.max(0, Number(depositShift.closing_cash) - 50000) }))}
                      >
                        Sisakan Rp 50rb di Laci
                      </button>
                    )}
                  </div>
                </div>

                {/* Summary Split Preview */}
                {(() => {
                  const inputAmt = Number(depositForm.amount) || 0;
                  const physicalCash = Number(depositShift.closing_cash) || 0;
                  const diff = inputAmt - physicalCash;
                  const sisaDiLaci = Math.max(0, physicalCash - inputAmt);
                  const isZeroRemaining = sisaDiLaci === 0;

                  return (
                    <div style={{
                      marginBottom: 16,
                      padding: '14px',
                      background: isZeroRemaining ? 'rgba(245, 158, 11, 0.04)' : 'rgba(255,255,255,0.03)',
                      border: isZeroRemaining ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--border)',
                      borderRadius: 10
                    }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: diff > 0 ? '1fr 1fr 1fr' : '1fr 1fr',
                        gap: 10,
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Diajukan Disetor:</div>
                          <div className="mono" style={{ fontSize: 15, fontWeight: 800, color: '#34d399' }}>
                            +{rupiah(inputAmt)}
                          </div>
                        </div>

                        {diff > 0 ? (
                          <>
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Fisik Closing Laci:</div>
                              <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
                                {rupiah(physicalCash)}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#38bdf8', marginBottom: 2, fontWeight: 700 }}>Selisih Lebih Setor:</div>
                              <div className="mono" style={{ fontSize: 15, fontWeight: 800, color: '#38bdf8' }}>
                                +{rupiah(diff)}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Sisa Ditinggal di Laci:</div>
                            <div className="mono" style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: isZeroRemaining ? '#fbbf24' : '#34d399'
                            }}>
                              {isZeroRemaining ? 'Rp 0 (Habis)' : rupiah(sisaDiLaci)}
                            </div>
                          </div>
                        )}
                      </div>

                      {diff > 0 && (
                        <div style={{
                          marginTop: 10,
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: 'rgba(56, 189, 248, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          fontSize: 11.5,
                          color: '#bae6fd',
                          lineHeight: 1.4
                        }}>
                          ℹ️ <strong>Setor Lebih:</strong> Nominal setoran ({rupiah(inputAmt)}) melebihi uang fisik laci ({rupiah(physicalCash)}) sebesar <strong>+{rupiah(diff)}</strong>. Sisa uang di laci adalah <strong>Rp 0</strong>.
                        </div>
                      )}

                      {/* Warning jika sisa uang di laci 0 rupiah tapi tetap bisa dilanjutkan */}
                      {isZeroRemaining && (
                        <div style={{
                          marginTop: 10,
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: 'rgba(245, 158, 11, 0.12)',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          fontSize: 12,
                          color: '#fef3c7',
                          lineHeight: 1.45
                        }}>
                          <AlertTriangle size={17} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                          <div>
                            <strong style={{ color: '#fbbf24' }}>Peringatan Sisa Uang Rp 0:</strong> Sisa uang di laci kasir adalah <strong>Rp 0</strong> (tidak ada modal uang kembalian untuk shift berikutnya). Anda <strong>tetap dapat melanjutkan</strong> setoran jika sudah sesuai.
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Target Akun */}
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontSize: 12.5, fontWeight: 600 }}>Tujuan Akun Setoran:</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: depositForm.account === 'KAS_BESAR' ? '1px solid #10b981' : '1px solid var(--border)',
                      background: depositForm.account === 'KAS_BESAR' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: depositForm.account === 'KAS_BESAR' ? '#34d399' : 'var(--text-secondary)'
                    }}>
                      <input
                        type="radio"
                        name="deposit_account"
                        value="KAS_BESAR"
                        checked={depositForm.account === 'KAS_BESAR'}
                        onChange={() => setDepositForm(f => ({ ...f, account: 'KAS_BESAR' }))}
                        style={{ accentColor: '#10b981' }}
                      />
                      <span>Kas Besar / Brankas</span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: depositForm.account === 'BANK_MAIN' ? '1px solid #38bdf8' : '1px solid var(--border)',
                      background: depositForm.account === 'BANK_MAIN' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: depositForm.account === 'BANK_MAIN' ? '#38bdf8' : 'var(--text-secondary)'
                    }}>
                      <input
                        type="radio"
                        name="deposit_account"
                        value="BANK_MAIN"
                        checked={depositForm.account === 'BANK_MAIN'}
                        onChange={() => setDepositForm(f => ({ ...f, account: 'BANK_MAIN' }))}
                        style={{ accentColor: '#38bdf8' }}
                      />
                      <span>Rekening Bank Utama</span>
                    </label>
                  </div>
                </div>

                {/* Catatan Setoran */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Catatan / Keterangan (Opsional):</label>
                  <input
                    type="text"
                    className="form-control"
                    value={depositForm.notes}
                    onChange={e => setDepositForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Contoh: Diserahkan tunai ke Pak Hendra / transfer ke rekening BRI"
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleSkipDeposit}
                  disabled={submittingDeposit}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <ArrowRight size={15} /> Lanjutkan (Tinggalkan di Laci)
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingDeposit || depositForm.amount === '' || isNaN(Number(depositForm.amount)) || Number(depositForm.amount) < 0}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    borderColor: '#10b981',
                    color: '#ffffff',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <CheckCircle size={16} />
                  {submittingDeposit ? 'Mengajukan...' : 'Ajukan Setoran ke Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Persetujuan Setoran Kasir (Owner / Outlet Manager Approval) */}
      {approveDepositModal.open && approveDepositModal.shift && (
        <div className="modal-overlay" onClick={() => !approveDepositModal.loading && setApproveDepositModal({ open: false, shift: null, loading: false })}>
          <div className="modal-content" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#34d399' }}>
                <ShieldCheck size={20} />
                <span>Persetujuan Setoran Kasir (Approval)</span>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setApproveDepositModal({ open: false, shift: null, loading: false })}
                disabled={approveDepositModal.loading}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '16px',
                marginBottom: 16
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Sesi Shift
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#ffffff' }}>
                      Shift #{approveDepositModal.shift.id} — {approveDepositModal.shift.shift_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Outlet: <strong>{approveDepositModal.shift.outlet?.name || userOutletName || 'Outlet'}</strong>
                    </div>
                  </div>
                  <span className="pill mono" style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#fbbf24',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '3px 8px'
                  }}>
                    <Clock size={11} /> Menunggu Approval
                  </span>
                </div>

                <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Kasir Pengaju:</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginTop: 2 }}>
                      {approveDepositModal.shift.deposit_submitted_by_name || approveDepositModal.shift.user?.name || 'Kasir'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Waktu Diajukan:</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {approveDepositModal.shift.deposit_submitted_at
                        ? new Date(approveDepositModal.shift.deposit_submitted_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
                        : (approveDepositModal.shift.closed_at ? new Date(approveDepositModal.shift.closed_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Nominal yang Disetujui */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 95, 70, 0.25))',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 12,
                padding: '16px',
                marginBottom: 16
              }}>
                <div style={{ fontSize: 11.5, color: '#a7f3d0', fontWeight: 600, marginBottom: 4 }}>
                  Nominal Setoran yang Diterima:
                </div>
                <div className="mono" style={{ fontSize: 24, fontWeight: 900, color: '#34d399' }}>
                  {rupiah(approveDepositModal.shift.deposit_amount || approveDepositModal.shift.closing_cash || 0)}
                </div>
                <div style={{ fontSize: 12, color: '#e2e8f0', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Masuk ke:</span>
                  <strong style={{ color: approveDepositModal.shift.deposit_account === 'BANK_MAIN' ? '#38bdf8' : '#34d399' }}>
                    {approveDepositModal.shift.deposit_account_label || (approveDepositModal.shift.deposit_account === 'BANK_MAIN' ? 'Rekening Bank Utama (1-11003)' : 'Kas Besar / Brankas (1-11001)')}
                  </strong>
                </div>
              </div>

              {/* Catatan Pengajuan */}
              {approveDepositModal.shift.deposit_notes && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  marginBottom: 16,
                  fontSize: 12,
                  color: 'var(--text-secondary)'
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 2 }}>Catatan Kasir:</div>
                  <div>{approveDepositModal.shift.deposit_notes}</div>
                </div>
              )}

              {/* Accounting Impact Notice */}
              <div style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                fontSize: 11.5,
                color: '#bae6fd',
                lineHeight: 1.5
              }}>
                ℹ️ <strong>Dampak Pembukuan:</strong> Setelah disetujui, dana kasir akan resmi dipindahkan dari <em>Laci Kasir (1-11002)</em> ke <em>{approveDepositModal.shift.deposit_account === 'BANK_MAIN' ? 'Bank Utama (1-11003)' : 'Kas Besar (1-11001)'}</em> dan transaksi dicatat pada Jurnal Akuntansi.
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setApproveDepositModal({ open: false, shift: null, loading: false })}
                disabled={approveDepositModal.loading}
              >
                Batal
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleApproveDepositSubmit}
                disabled={approveDepositModal.loading}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderColor: '#10b981',
                  color: '#ffffff',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <CheckCircle size={16} />
                {approveDepositModal.loading ? 'Menyetujui & Membukukan...' : 'Setujui & Bukukan Dana'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Penolakan Setoran Kasir (Owner / Outlet Manager Rejection) */}
      {rejectDepositModal.open && rejectDepositModal.shift && (
        <div className="modal-overlay" onClick={() => !rejectDepositModal.loading && setRejectDepositModal({ open: false, shift: null, reason: '', loading: false })}>
          <div className="modal-content" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171' }}>
                <AlertTriangle size={20} />
                <span>Tolak Pengajuan Setoran Kasir</span>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setRejectDepositModal({ open: false, shift: null, reason: '', loading: false })}
                disabled={rejectDepositModal.loading}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRejectDepositSubmit}>
              <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  marginBottom: 16
                }}>
                  <div style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.5 }}>
                    Anda akan menolak pengajuan setoran untuk <strong>Shift #{rejectDepositModal.shift.id} ({rejectDepositModal.shift.shift_name})</strong> senilai <strong>{rupiah(rejectDepositModal.shift.deposit_amount || rejectDepositModal.shift.closing_cash || 0)}</strong>.
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff' }}>
                    Alasan Penolakan (Wajib Diisi):
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={rejectDepositModal.reason}
                    onChange={e => setRejectDepositModal(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Contoh: Fisik uang yang diserahkan kurang Rp 50.000 / Bukti transfer belum dikirim..."
                    required
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div style={{
                  fontSize: 11.5,
                  color: 'var(--text-muted)',
                  lineHeight: 1.4
                }}>
                  ℹ️ Setelah ditolak, dana tidak akan berpindah ke Kas Besar dan kasir dapat memperbaiki pengajuan untuk disetor ulang.
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRejectDepositModal({ open: false, shift: null, reason: '', loading: false })}
                  disabled={rejectDepositModal.loading}
                >
                  Batal
                </button>

                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={rejectDepositModal.loading || !rejectDepositModal.reason.trim()}
                  style={{
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <X size={16} />
                  {rejectDepositModal.loading ? 'Menolak...' : 'Konfirmasi Tolak Setoran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail & Rincian Shift (Tampilan Lengkap Riwayat Nota) */}
      {detailShift && (
        <div className="modal-overlay" onClick={() => setDetailShift(null)}>
          <div className="modal-content modal-xl" style={{ maxWidth: 1420, '--modal-max-w': '1420px', width: '96vw' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Layers size={20} style={{ color: 'var(--accent-bright)' }} />
                <span>Rincian Sesi Shift #{detailShift.id} — {detailShift.shift_name}</span>
                <span
                  className={`badge ${detailShift.status === 'OPEN' ? 'badge-success' : 'badge-neutral'}`}
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    ...(detailShift.status === 'OPEN' ? { background: 'rgba(16, 185, 129, 0.25)', color: '#34d399', borderColor: '#10b981' } : {})
                  }}
                >
                  {detailShift.status === 'OPEN' ? '🟢 Sesi Shift Aktif' : '⚪ Sesi Shift Selesai'}
                </span>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setDetailShift(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '78vh', overflowY: 'auto', padding: '18px 22px' }}>
              {loadingDetail ? (
                <div style={{ padding: 48, textAlign: 'center' }}><LoadingState /></div>
              ) : (
                <>
                  {/* Shift Metadata & Financial KPI Header Cards */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 12,
                    marginBottom: 18
                  }}>
                    {/* Petugas & Waktu */}
                    <div style={{ padding: '12px 14px', background: 'rgba(15, 20, 42, 0.65)', border: '1px solid var(--border)', borderRadius: 12 }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Petugas & Jadwal
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4, color: '#ffffff' }}>
                        👤 Kasir: <strong style={{ color: '#fde047' }}>{detailShift.user?.name || '-'}</strong>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Buka: {new Date(detailShift.opened_at).toLocaleString('id-ID')}
                      </div>
                      {detailShift.closed_at ? (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          Tutup: {new Date(detailShift.closed_at).toLocaleString('id-ID')}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11.5, color: '#34d399', fontWeight: 600 }}>
                          • Sesi Masih Berjalan
                        </div>
                      )}
                    </div>

                    {/* Modal Awal */}
                    <div style={{ padding: '12px 14px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 12 }}>
                      <div style={{ fontSize: 10.5, color: '#818cf8', textTransform: 'uppercase', fontWeight: 700 }}>
                        Modal Awal Kas
                      </div>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: '#a5b4fc', marginTop: 4 }}>
                        {rupiah(detailShift.initial_cash)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Saldo awal laci kasir
                      </div>
                    </div>

                    {/* Penjualan Tunai (Kas Masuk) */}
                    <div style={{ padding: '12px 14px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 12 }}>
                      <div style={{ fontSize: 10.5, color: '#34d399', textTransform: 'uppercase', fontWeight: 700 }}>
                        Penjualan Tunai (Kas)
                      </div>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                        +{rupiah(detailData?.summary?.cash_sales ?? detailShift.system_cash)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Non-Tunai: <span className="mono" style={{ color: '#38bdf8' }}>{rupiah(detailData?.summary?.non_cash_sales || 0)}</span>
                      </div>
                    </div>

                    {/* Pengeluaran OPEX (Kas Keluar) */}
                    <div style={{ padding: '12px 14px', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 12 }}>
                      <div style={{ fontSize: 10.5, color: '#fca5a5', textTransform: 'uppercase', fontWeight: 700 }}>
                        Pengeluaran OPEX
                      </div>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: (detailData?.summary?.cash_expenses || 0) > 0 ? '#ef4444' : '#cbd5e1', marginTop: 4 }}>
                        -{rupiah(detailData?.summary?.cash_expenses || 0)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Total OPEX: <span className="mono" style={{ color: '#f87171' }}>{rupiah(detailData?.summary?.total_expenses || 0)}</span>
                      </div>
                    </div>

                    {/* Kas Fisik & Selisih Laci */}
                    <div style={{ padding: '12px 14px', background: 'rgba(15, 20, 42, 0.65)', border: '1px solid var(--border)', borderRadius: 12 }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Kas Fisik di Laci
                      </div>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
                        {detailShift.closing_cash !== null ? rupiah(detailShift.closing_cash) : '— (Belum Tutup)'}
                      </div>
                      <div style={{ fontSize: 11.5, marginTop: 2 }}>
                        Selisih Laci: <strong className="mono" style={{ color: (detailShift.cash_difference || 0) < 0 ? 'var(--danger)' : 'var(--ok)' }}>
                          {detailShift.status === 'CLOSED'
                            ? (detailShift.cash_difference > 0 ? `+${rupiah(detailShift.cash_difference)}` : (detailShift.cash_difference === 0 ? 'Pas (Rp 0)' : rupiah(detailShift.cash_difference)))
                            : '—'}
                        </strong>
                      </div>
                    </div>

                    {/* Setoran Kas Besar */}
                    <div style={{
                      padding: '12px 14px',
                      background: (detailShift.deposit_status === 'APPROVED' || detailShift.is_deposited)
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)'
                        : (detailShift.deposit_status === 'PENDING' || detailShift.is_deposit_pending)
                          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)'
                          : (detailShift.deposit_status === 'REJECTED' || detailShift.is_deposit_rejected)
                            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)'
                            : 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
                      border: (detailShift.deposit_status === 'APPROVED' || detailShift.is_deposited)
                        ? '1px solid rgba(16, 185, 129, 0.35)'
                        : (detailShift.deposit_status === 'PENDING' || detailShift.is_deposit_pending)
                          ? '1px solid rgba(245, 158, 11, 0.35)'
                          : (detailShift.deposit_status === 'REJECTED' || detailShift.is_deposit_rejected)
                            ? '1px solid rgba(239, 68, 68, 0.35)'
                            : '1px solid rgba(245, 158, 11, 0.35)',
                      borderRadius: 12
                    }}>
                      <div style={{
                        fontSize: 10.5,
                        color: (detailShift.deposit_status === 'APPROVED' || detailShift.is_deposited) ? '#34d399' : (detailShift.deposit_status === 'REJECTED' || detailShift.is_deposit_rejected) ? '#f87171' : '#fbbf24',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        {(detailShift.deposit_status === 'APPROVED' || detailShift.is_deposited) ? <CheckCircle size={12} /> : (detailShift.deposit_status === 'REJECTED' || detailShift.is_deposit_rejected) ? <X size={12} /> : <Clock size={12} />}
                        <span>
                          {detailShift.deposit_status === 'APPROVED' || detailShift.is_deposited
                            ? 'Setoran (Disetujui)'
                            : detailShift.deposit_status === 'PENDING' || detailShift.is_deposit_pending
                              ? 'Setoran (Menunggu Approval)'
                              : detailShift.deposit_status === 'REJECTED' || detailShift.is_deposit_rejected
                                ? 'Setoran (Ditolak)'
                                : 'Setoran Kasir'}
                        </span>
                      </div>
                      <div className="mono" style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: (detailShift.deposit_status === 'APPROVED' || detailShift.is_deposited) ? '#6ee7b7' : (detailShift.deposit_status === 'REJECTED' || detailShift.is_deposit_rejected) ? '#f87171' : '#fbbf24',
                        marginTop: 4
                      }}>
                        {(detailShift.deposit_amount > 0 || detailShift.is_deposited) ? rupiah(detailShift.deposit_amount) : (detailShift.deposit_status === 'NONE' ? 'Belum Disetor' : 'Rp 0')}
                      </div>
                      <div style={{ fontSize: 11.5, marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {detailShift.deposit_account_label || 'Kas Besar'}
                        </span>
                        {detailShift.deposit_amount > 0 && (
                          <strong className="mono" style={{ color: (detailShift.deposit_diff || 0) === 0 ? '#34d399' : (detailShift.deposit_diff || 0) > 0 ? '#38bdf8' : '#f87171' }}>
                            {(detailShift.deposit_diff || 0) === 0 ? '✓ Pas Laci' : `${(detailShift.deposit_diff || 0) > 0 ? '+' : ''}${rupiah(detailShift.deposit_diff)} (${(detailShift.deposit_diff || 0) > 0 ? 'Lebih' : 'Kurang'})`}
                          </strong>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Banner Approval Status & Quick Actions inside Modal */}
                  {detailShift.status === 'CLOSED' && (detailShift.deposit_status === 'PENDING' || detailShift.is_deposit_pending) && (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(15, 23, 42, 0.7) 100%)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      borderRadius: 12,
                      padding: '12px 16px',
                      marginBottom: 16,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: 'rgba(245, 158, 11, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fbbf24',
                          flexShrink: 0
                        }}>
                          <Clock size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 13, color: '#fef08a' }}>
                            Pengajuan Setoran Kasir Menunggu Persetujuan (Approval)
                          </div>
                          <div style={{ fontSize: 11.5, color: '#cbd5e1' }}>
                            Nominal diajukan: <strong className="mono" style={{ color: '#34d399' }}>{rupiah(detailShift.deposit_amount || detailShift.closing_cash)}</strong> ke <strong>{detailShift.deposit_account_label || 'Kas Besar'}</strong> oleh <em>{detailShift.deposit_submitted_by_name || detailShift.user?.name || 'Kasir'}</em>
                          </div>
                        </div>
                      </div>

                      {isOwnerOrManager ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{
                              background: '#059669',
                              color: '#ffffff',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 14px',
                              borderRadius: 6
                            }}
                            onClick={(e) => handleOpenApproveDeposit(detailShift, e)}
                          >
                            <CheckCircle size={14} /> Setujui Setoran
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 14px',
                              borderRadius: 6
                            }}
                            onClick={(e) => handleOpenRejectDeposit(detailShift, e)}
                          >
                            <X size={14} /> Tolak
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#fbbf24', fontStyle: 'italic', fontWeight: 600 }}>
                          Menunggu Konfirmasi Owner
                        </span>
                      )}
                    </div>
                  )}

                  {/* Banner Rejection Status inside Modal */}
                  {detailShift.status === 'CLOSED' && (detailShift.deposit_status === 'REJECTED' || detailShift.is_deposit_rejected) && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: 12,
                      padding: '12px 16px',
                      marginBottom: 16,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: 'rgba(239, 68, 68, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#f87171',
                          flexShrink: 0
                        }}>
                          <AlertTriangle size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 13, color: '#f87171' }}>
                            Pengajuan Setoran Kasir Telah Ditolak Owner
                          </div>
                          <div style={{ fontSize: 11.5, color: '#fca5a5' }}>
                            Alasan: "{detailShift.deposit_rejection_reason || 'Tidak ada catatan penolakan'}"
                          </div>
                        </div>
                      </div>

                      {!detailShift.has_next_shift ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ fontWeight: 700, padding: '6px 14px' }}
                          onClick={(e) => handleOpenDepositForShift(detailShift, e)}
                        >
                          Ajukan Ulang Setoran
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Lock size={12} /> Shift berikutnya sudah dibuka (tidak dapat setor ulang)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Banner Shift Berikutnya Sudah Berjalan inside Modal */}
                  {detailShift.status === 'CLOSED' && detailShift.has_next_shift && !detailShift.is_deposited && detailShift.deposit_status !== 'APPROVED' && detailShift.deposit_status !== 'PENDING' && (
                    <div style={{
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      marginBottom: 16,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 12,
                      color: '#93c5fd'
                    }}>
                      <Info size={16} style={{ color: '#60a5fa', flexShrink: 0 }} />
                      <span>
                        <strong>Setoran Terkunci:</strong> Shift selanjutnya ({detailShift.next_shift_name || 'Shift Berikutnya'}) sudah dibuka / sedang berjalan di outlet ini. Sisa kas fisik saat penutupan shift ini otomatis dialihkan sebagai modal kas awal untuk shift berikutnya.
                      </span>
                    </div>
                  )}

                  {/* Banner Approved Info inside Modal */}
                  {detailShift.status === 'CLOSED' && (detailShift.deposit_status === 'APPROVED' || detailShift.is_deposited) && (
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      marginBottom: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      fontSize: 12,
                      color: '#a7f3d0'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle size={16} style={{ color: '#34d399' }} />
                        <span>
                          Setoran disetujui {detailShift.deposit_approved_by_name ? `oleh ${detailShift.deposit_approved_by_name}` : 'oleh Owner'} {detailShift.deposit_approved_at ? `pada ${new Date(detailShift.deposit_approved_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}` : ''}. Dana telah dibukukan ke {detailShift.deposit_account_label || 'Kas Besar'}.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Tab Navigation inside Modal */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border)',
                    marginBottom: 16,
                    gap: 8,
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setDetailTab('orders')}
                        className={`btn btn-sm ${detailTab === 'orders' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ fontSize: 12, padding: '6px 14px', height: 34, display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Receipt size={14} />
                        <span>Riwayat Nota Transaksi ({filteredDetailOrders.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailTab('menus')}
                        className={`btn btn-sm ${detailTab === 'menus' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ fontSize: 12, padding: '6px 14px', height: 34, display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <ShoppingBag size={14} />
                        <span>Menu Terjual ({detailData?.summary?.menus_sold?.length || 0})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailTab('ingredients')}
                        className={`btn btn-sm ${detailTab === 'ingredients' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ fontSize: 12, padding: '6px 14px', height: 34, display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <FileText size={14} />
                        <span>Bahan Baku Terpakai ({detailData?.summary?.ingredient_usages?.length || 0})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailTab('expenses')}
                        className={`btn btn-sm ${detailTab === 'expenses' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ fontSize: 12, padding: '6px 14px', height: 34, display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <DollarSign size={14} />
                        <span>Biaya OPEX ({detailData?.summary?.expenses?.length || 0})</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      <div>
                        Omzet: <strong className="mono" style={{ color: '#34d399', fontSize: 12.5 }}>{rupiah(detailData?.summary?.total_sales || 0)}</strong>
                      </div>
                      {(detailData?.summary?.total_expenses || 0) > 0 && (
                        <div>
                          OPEX: <strong className="mono" style={{ color: '#ef4444', fontSize: 12.5 }}>-{rupiah(detailData?.summary?.total_expenses || 0)}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* TAB CONTENT 1: RIWAYAT NOTA TRANSAKSI (SAMA SEPERTI DI RIWAYAT NOTA POS) */}
                  {detailTab === 'orders' && (
                    <div>
                      {/* Filter Toolbar within Modal */}
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.22)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: '12px 14px',
                        marginBottom: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                          {/* Search Box */}
                          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Cari No. Order, Menu, Pelanggan, atau Catatan..."
                              value={detailSearch}
                              onChange={e => setDetailSearch(e.target.value)}
                              style={{ paddingLeft: 32, paddingRight: detailSearch ? 30 : 10, height: 34, fontSize: 12, borderRadius: 8 }}
                            />
                            {detailSearch && (
                              <button
                                type="button"
                                onClick={() => setDetailSearch('')}
                                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>

                          {/* Payment Method Filter */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Metode:</span>
                            <select
                              className="form-control"
                              value={detailPaymentMethod}
                              onChange={e => setDetailPaymentMethod(e.target.value)}
                              style={{ width: 140, height: 34, fontSize: 11.5, borderRadius: 8 }}
                            >
                              <option value="ALL">Semua Metode</option>
                              <option value="CASH">Tunai (CASH)</option>
                              <option value="QRIS">QRIS</option>
                              <option value="TRANSFER">Transfer</option>
                              <option value="DEBIT">Debit</option>
                              <option value="CREDIT">Kredit</option>
                            </select>
                          </div>

                          {/* Status Filter Tabs */}
                          <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.3)', padding: 2, borderRadius: 8, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => setDetailStatus('ALL')}
                              className={`btn btn-sm ${detailStatus === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
                              style={{ fontSize: 11, padding: '3px 8px', height: 26 }}
                            >
                              Semua ({groupedDetailOrders.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setDetailStatus('PAID')}
                              className={`btn btn-sm ${detailStatus === 'PAID' ? 'btn-primary' : 'btn-ghost'}`}
                              style={{ fontSize: 11, padding: '3px 8px', height: 26 }}
                            >
                              ✓ Lunas ({groupedDetailOrders.filter(o => o.status === 'PAID').length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setDetailStatus('CANCELLED')}
                              className={`btn btn-sm ${detailStatus === 'CANCELLED' ? 'btn-danger' : 'btn-ghost'}`}
                              style={{ fontSize: 11, padding: '3px 8px', height: 26 }}
                            >
                              ✕ Void ({groupedDetailOrders.filter(o => o.status === 'CANCELLED').length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setDetailStatus('HOLD')}
                              className={`btn btn-sm ${detailStatus === 'HOLD' ? 'btn-primary' : 'btn-ghost'}`}
                              style={{ fontSize: 11, padding: '3px 8px', height: 26 }}
                            >
                              ⏳ Hold ({groupedDetailOrders.filter(o => o.status === 'HOLD').length})
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Orders List Container */}
                      {filteredDetailOrders.length === 0 ? (
                        <div style={{
                          background: 'rgba(0, 0, 0, 0.2)',
                          border: '1px dashed var(--border)',
                          borderRadius: 12,
                          padding: '36px 20px',
                          textAlign: 'center'
                        }}>
                          <Receipt size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 10px', opacity: 0.5 }} />
                          <h4 style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', margin: '0 0 4px' }}>
                            Tidak Ada Nota Transaksi
                          </h4>
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                            Belum ada transaksi tercatat pada shift ini{detailSearch ? ` dengan pencarian "${detailSearch}"` : ''}.
                          </p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {filteredDetailOrders.map((order) => {
                            const isExpanded = Boolean(expandedDetailOrders[order.order_number]);
                            const isCancelled = order.status === 'CANCELLED';
                            const isVoidPending = order.status === 'VOID_PENDING';

                            return (
                              <div
                                key={order.order_number}
                                style={{
                                  background: isCancelled ? 'rgba(244, 63, 94, 0.04)' : isVoidPending ? 'rgba(245, 158, 11, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                                  border: isCancelled ? '1px solid rgba(244, 63, 94, 0.3)' : isVoidPending ? '1.5px solid rgba(245, 158, 11, 0.45)' : '1px solid var(--border)',
                                  borderRadius: 12,
                                  overflow: 'hidden',
                                  transition: 'all 0.2s ease',
                                  boxShadow: isExpanded ? '0 4px 18px rgba(0, 0, 0, 0.35)' : 'none'
                                }}
                              >
                                {/* Order Summary Header */}
                                <div
                                  onClick={() => toggleDetailOrderExpand(order.order_number)}
                                  style={{
                                    padding: '12px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: 10,
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    background: isExpanded ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                                    borderBottom: isExpanded ? '1px solid var(--border)' : 'none'
                                  }}
                                >
                                  {/* Left Details: Chevron + Order Number + Status Badges + Shift Badge */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{
                                      width: 26, height: 26, borderRadius: 6,
                                      background: 'rgba(255, 255, 255, 0.06)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      color: isCancelled ? '#fb7185' : isVoidPending ? '#fbbf24' : 'var(--accent-bright)',
                                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                      transition: 'transform 0.2s ease'
                                    }}>
                                      <ChevronDown size={14} />
                                    </div>

                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: isCancelled ? '#fb7185' : isVoidPending ? '#fbbf24' : 'var(--accent-bright)' }}>
                                          #{order.order_number}
                                        </span>

                                        <span
                                          className="badge"
                                          style={{
                                            fontSize: 10.5,
                                            fontWeight: 700,
                                            background: 'rgba(99, 102, 241, 0.15)',
                                            color: '#a5b4fc',
                                            border: '1px solid rgba(99, 102, 241, 0.35)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4
                                          }}
                                        >
                                          <Layers size={10} />
                                          <span>{order.shift_name || detailShift.shift_name}</span>
                                        </span>

                                        <span
                                          className="badge"
                                          style={{
                                            fontSize: 10.5,
                                            fontWeight: 700,
                                            background: 'rgba(245, 158, 11, 0.15)',
                                            color: '#fde047',
                                            border: '1px solid rgba(245, 158, 11, 0.35)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4
                                          }}
                                        >
                                          <User size={10} />
                                          <span>{order.cashier_name}</span>
                                        </span>

                                        <span
                                          className={`badge ${['GRAB', 'GOFOOD', 'SHOPEEFOOD'].includes(order.payment_method) ? 'badge-success' : 'badge-neutral'}`}
                                          style={{
                                            fontSize: 10.5,
                                            fontWeight: 700,
                                            ...(order.payment_method === 'GRAB' ? { background: '#00B14F', color: '#ffffff', borderColor: '#00B14F' } : order.payment_method === 'GOFOOD' ? { background: '#EE2737', color: '#ffffff', borderColor: '#EE2737' } : order.payment_method === 'SHOPEEFOOD' ? { background: '#EE4D2D', color: '#ffffff', borderColor: '#EE4D2D' } : {})
                                          }}
                                        >
                                          {order.payment_method || 'CASH'}
                                        </span>

                                        <span
                                          className={`badge ${isCancelled ? 'badge-danger' : isVoidPending ? 'badge-warning' : (order.status === 'PAID' ? 'badge-success' : 'badge-warning')}`}
                                          style={{
                                            fontSize: 10,
                                            fontWeight: 800,
                                            ...(isCancelled ? { background: 'rgba(244, 63, 94, 0.2)', color: '#fb7185', borderColor: '#f43f5e' } : isVoidPending ? { background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', borderColor: '#f59e0b' } : {})
                                          }}
                                        >
                                          {isCancelled ? '✕ VOID' : isVoidPending ? '⏳ VOID PENDING' : (order.status === 'PAID' ? '✓ LUNAS' : '⏳ HOLD')}
                                        </span>

                                        {order.customer_name && (
                                          <span className="badge badge-info" style={{ fontSize: 10.5 }}>
                                            {order.customer_name} {order.table_number ? `· Meja ${order.table_number}` : ''}
                                          </span>
                                        )}
                                      </div>

                                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)', marginTop: 3, flexWrap: 'wrap' }}>
                                        <span>Waktu: <strong>{order.created_at ? new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : (order.date || '-')}</strong></span>
                                        <span><strong>{order.items.length}</strong> menu ({order.total_qty} porsi)</span>
                                        {order.notes && !isCancelled && <span style={{ color: 'var(--text-muted)' }}>*{order.notes}</span>}
                                      </div>

                                      {/* Void note if cancelled */}
                                      {isCancelled && (
                                        <div style={{
                                          marginTop: 4,
                                          padding: '3px 6px',
                                          background: 'rgba(244, 63, 94, 0.12)',
                                          border: '1px dashed rgba(244, 63, 94, 0.35)',
                                          borderRadius: 4,
                                          fontSize: 10.5,
                                          color: '#fda4af',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4
                                        }}>
                                          <strong>Alasan Void:</strong> "{order.cancellation_reason || order.notes || 'Dibatalkan'}"
                                          {order.cancelled_by_name && <span>· oleh: <strong>{order.cancelled_by_name}</strong></span>}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right Details: Total Price & Print Button */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ textAlign: 'right' }}>
                                      <div className="mono" style={{
                                        fontSize: 15,
                                        fontWeight: 800,
                                        color: isCancelled ? '#94a3b8' : 'var(--ok)',
                                        textDecoration: isCancelled ? 'line-through' : 'none'
                                      }}>
                                        {rupiah(order.total_price)}
                                      </div>
                                      {order.discount_amount > 0 && (
                                        <div style={{ fontSize: 10.5, color: '#f87171' }}>
                                          Hemat: {rupiah(order.discount_amount)}
                                        </div>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePrintSingleOrderReceipt(order);
                                      }}
                                      title="Cetak Ulang Struk Kasir"
                                      style={{ fontSize: 11, padding: '4px 8px', height: 30, display: 'flex', alignItems: 'center', gap: 4 }}
                                    >
                                      <Printer size={12} />
                                      <span>Struk</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Expanded Items Table */}
                                {isExpanded && (
                                  <div style={{ padding: '12px 16px', background: 'rgba(0, 0, 0, 0.2)' }}>
                                    <div className="table-wrap">
                                      <table>
                                        <thead>
                                          <tr>
                                            <th>Menu / Item</th>
                                            <th className="right">Harga Satuan</th>
                                            <th className="right">Qty</th>
                                            <th className="right">Subtotal</th>
                                            <th className="right">Diskon</th>
                                            <th className="right">Total</th>
                                            <th>Catatan</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {order.items.map((it, itIdx) => (
                                            <tr key={it.id || itIdx}>
                                              <td style={{ fontWeight: 600 }}>
                                                <div>{it.menu?.name || it.menu_name}</div>
                                                {it.modifiers && it.modifiers.length > 0 && (
                                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                                    {it.modifiers.map((m, mIdx) => (
                                                      <span key={mIdx} style={{
                                                        fontSize: 9.5,
                                                        background: 'rgba(139, 92, 246, 0.15)',
                                                        color: '#c4b5fd',
                                                        border: '1px solid rgba(139, 92, 246, 0.25)',
                                                        padding: '1px 4px',
                                                        borderRadius: 4
                                                      }}>
                                                        {m.name} {Number(m.price) > 0 && `(+${rupiah(m.price)})`}
                                                      </span>
                                                    ))}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="mono right" style={{ fontSize: 11.5 }}>
                                                {rupiah(it.menu?.price || it.menu_price || (it.total_price / it.qty))}
                                              </td>
                                              <td className="mono right">{it.qty}</td>
                                              <td className="mono right" style={{ fontSize: 11.5 }}>
                                                {rupiah(it.subtotal || it.total_price)}
                                              </td>
                                              <td className="mono right" style={{ fontSize: 11.5, color: it.discount_amount > 0 ? '#f87171' : 'inherit' }}>
                                                {it.discount_amount > 0 ? `-${rupiah(it.discount_amount)}` : '—'}
                                              </td>
                                              <td className="mono right" style={{ fontWeight: 700, color: isCancelled ? '#94a3b8' : 'var(--ok)', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                                                {rupiah(it.total_price)}
                                              </td>
                                              <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {it.notes || '—'}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB CONTENT 2: MENU TERJUAL */}
                  {detailTab === 'menus' && (
                    <div>
                      {detailData?.summary?.menus_sold?.length > 0 ? (
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Nama Menu</th>
                                <th className="right">Porsi Terjual</th>
                                <th className="right">Total Nilai Penjualan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailData.summary.menus_sold.map(m => (
                                <tr key={m.menu_id}>
                                  <td style={{ fontWeight: 600 }}>{m.menu_name}</td>
                                  <td className="mono right">{m.qty} porsi</td>
                                  <td className="mono right" style={{ color: '#34d399', fontWeight: 700 }}>{rupiah(m.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                          Tidak ada data menu terjual pada shift ini.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB CONTENT 3: BAHAN BAKU TERPAKAI */}
                  {detailTab === 'ingredients' && (
                    <div>
                      {detailData?.summary?.ingredient_usages?.length > 0 ? (
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Nama Bahan Baku</th>
                                <th className="right">Total Gramasi / Qty Terpakai</th>
                                <th className="right">Estimasi Biaya Bahan (HPP)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailData.summary.ingredient_usages.map(u => (
                                <tr key={u.ingredient_id}>
                                  <td style={{ fontWeight: 600 }}>{u.ingredient_name}</td>
                                  <td className="mono right" style={{ color: 'var(--danger)', fontWeight: 700 }}>
                                    -{num(u.total_qty)} {u.unit}
                                  </td>
                                  <td className="mono right">{rupiah(u.total_cost)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                          Tidak ada pemakaian bahan baku resep pada shift ini.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB CONTENT 4: BIAYA OPERASIONAL / OPEX */}
                  {detailTab === 'expenses' && (
                    <div>
                      {/* Summary Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                        <div className="card" style={{ padding: '12px 14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 10 }}>
                          <div style={{ fontSize: 11, color: '#fca5a5', fontWeight: 600, textTransform: 'uppercase' }}>Total Biaya OPEX</div>
                          <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: '#ef4444', marginTop: 4 }}>
                            {rupiah(detailData?.summary?.total_expenses || 0)}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{detailData?.summary?.expenses?.length || 0} transaksi pengeluaran</div>
                        </div>

                        <div className="card" style={{ padding: '12px 14px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 10 }}>
                          <div style={{ fontSize: 11, color: '#fde68a', fontWeight: 600, textTransform: 'uppercase' }}>Kas di Laci (Tunai)</div>
                          <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
                            {rupiah(detailData?.summary?.cash_expenses || 0)}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Memotong uang fisik laci kasir</div>
                        </div>

                        <div className="card" style={{ padding: '12px 14px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 10 }}>
                          <div style={{ fontSize: 11, color: '#bae6fd', fontWeight: 600, textTransform: 'uppercase' }}>Non-Tunai (Bank / EDC)</div>
                          <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
                            {rupiah(detailData?.summary?.non_cash_expenses || 0)}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Dibayar via transfer / rekening bank</div>
                        </div>
                      </div>

                      {/* Expenses List Table */}
                      {detailData?.summary?.expenses?.length > 0 ? (
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Waktu / No. Bukti</th>
                                <th>Kategori</th>
                                <th>Keperluan / Deskripsi</th>
                                <th>Metode Bayar</th>
                                <th>Dicatat Oleh</th>
                                <th className="right">Jumlah (Rp)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailData.summary.expenses.map((exp, idx) => (
                                <tr key={idx}>
                                  <td>
                                    <div className="mono" style={{ fontWeight: 600, color: 'var(--accent-bright)', fontSize: 11 }}>
                                      {exp.expense_no || `#EXP-${exp.id}`}
                                    </div>
                                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                                      {exp.date} · {exp.time}
                                    </div>
                                  </td>
                                  <td>
                                    <span className="pill pill-secondary mono" style={{ fontSize: 10.5 }}>
                                      {exp.category_label || exp.category}
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{ fontWeight: 600, color: '#ffffff' }}>{exp.name || exp.description}</div>
                                    {exp.notes && (
                                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                        {exp.notes}
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    {exp.is_cash ? (
                                      <span className="pill mono" style={{ fontSize: 10.5, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                                        Tunai (Laci)
                                      </span>
                                    ) : (
                                      <span className="pill mono" style={{ fontSize: 10.5, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}>
                                        {exp.payment_method_label || 'Transfer Bank'}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                      {exp.user_name || 'Kasir'}
                                    </span>
                                  </td>
                                  <td className="mono right" style={{ fontWeight: 700, color: exp.is_cash ? '#ef4444' : '#ffffff', fontSize: 13 }}>
                                    {rupiah(exp.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
                          <DollarSign size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                          <div>Tidak ada biaya operasional (OPEX) yang tercatat pada sesi shift ini.</div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {detailShift.status === 'CLOSED' && (
                  <>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handlePrintReceipt(detailShift.id)}
                      disabled={loadingReceipt}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Printer size={14} /> Cetak Rekap Kas Shift
                    </button>
                    {(!detailShift.is_deposited && detailShift.deposit_status !== 'APPROVED' && detailShift.deposit_status !== 'PENDING') && (
                      !detailShift.has_next_shift ? (
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            const shiftToDeposit = detailShift;
                            setDetailShift(null);
                            handleOpenDepositForShift(shiftToDeposit);
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                        >
                          <DollarSign size={14} /> Setor ke Kas Besar
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(100, 116, 139, 0.15)', padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(100, 116, 139, 0.3)' }}>
                          <Lock size={12} /> Shift berikutnya sudah dibuka (tidak dapat setor)
                        </span>
                      )
                    )}
                  </>
                )}
              </div>
              <button className="btn btn-secondary" onClick={() => setDetailShift(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak Ulang Struk Nota Kasir dari Detail Shift */}
      {orderReceiptModal.open && orderReceiptModal.order && (
        <div className="modal-overlay" onClick={() => setOrderReceiptModal({ open: false, order: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 390, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={16} color="var(--ok)" /> Cetak Ulang Struk Nota Kasir
              </span>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setOrderReceiptModal({ open: false, order: null })}
              >
                <X size={18} />
              </button>
            </div>

            {/* Thermal Receipt Preview */}
            <div id="order-receipt-print-shift" className="thermal-receipt-preview" style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: 10.5,
              lineHeight: 1.35,
              color: '#000000',
              background: '#ffffff',
              padding: '12px 14px',
              borderRadius: 6,
              marginBottom: 14
            }}>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: '0.04em' }}>
                  {activeOutlet?.name || userBusinessName || 'MOVA POS'}
                </div>
                <div style={{ fontSize: 9.5, opacity: 0.8 }}>
                  Move Your Business Forward
                </div>
                <div style={{ fontSize: 9.5, marginTop: 2 }}>
                  Outlet: {detailShift?.outlet?.name || activeOutlet?.name || userOutletName || 'Cabang Utama'}
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              <div style={{ fontSize: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>No. Nota:</span>
                  <strong>{orderReceiptModal.order.order_number}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Waktu:</span>
                  <span>{orderReceiptModal.order.created_at ? new Date(orderReceiptModal.order.created_at).toLocaleString('id-ID') : orderReceiptModal.order.date}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Kasir:</span>
                  <span>{orderReceiptModal.order.cashier_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Shift:</span>
                  <span>{orderReceiptModal.order.shift_name || detailShift?.shift_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Pelanggan:</span>
                  <span>{orderReceiptModal.order.customer_name} {orderReceiptModal.order.table_number ? `(Meja ${orderReceiptModal.order.table_number})` : ''}</span>
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10 }}>
                {orderReceiptModal.order.items.map((it, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>{it.qty}x {it.menu?.name || it.menu_name}</span>
                      <span>{rupiah(it.total_price)}</span>
                    </div>
                    {it.modifiers && it.modifiers.length > 0 && (
                      <div style={{ fontSize: 9, opacity: 0.8, paddingLeft: 8 }}>
                        + {it.modifiers.map(m => m.name).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              <div style={{ fontSize: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>{rupiah(orderReceiptModal.order.subtotal || orderReceiptModal.order.total_price)}</span>
                </div>
                {orderReceiptModal.order.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                    <span>Diskon:</span>
                    <span>-{rupiah(orderReceiptModal.order.discount_amount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 11.5, borderTop: '1px solid #000', paddingTop: 2, marginTop: 2 }}>
                  <span>TOTAL:</span>
                  <span>{rupiah(orderReceiptModal.order.total_price)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Bayar ({orderReceiptModal.order.payment_method || 'CASH'}):</span>
                  <span>{rupiah(orderReceiptModal.order.amount_paid || orderReceiptModal.order.total_price)}</span>
                </div>
                {Number(orderReceiptModal.order.change_amount || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Kembalian:</span>
                    <span>{rupiah(orderReceiptModal.order.change_amount)}</span>
                  </div>
                )}
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              <div style={{ textAlign: 'center', fontSize: 9, opacity: 0.85, marginTop: 4 }}>
                <div>Terima Kasih Atas Kunjungan Anda</div>
                <div>Layanan Konsumen: POS MOVA</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setOrderReceiptModal({ open: false, order: null })}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Tutup
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => doPrintSingleOrderReceipt(thermalPaperSize)}
                style={{ flex: 1.5, justifyContent: 'center', fontWeight: 800 }}
              >
                <Printer size={14} style={{ marginRight: 6 }} /> Cetak Nota Thermal
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
                                onChange={() => { }} // Handled by parent div
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

      {/* Modal Pratinjau & Cetak Struk Rekap Kas Thermal (80mm / 58mm) */}
      {showReceiptModal && receiptData && (
        <div className="modal-overlay" onClick={() => setShowReceiptModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Printer size={18} style={{ color: 'var(--accent-bright)' }} />
                <span style={{ fontWeight: 800, fontSize: 15, color: '#ffffff' }}>
                  Struk Rekap Kas Shift #{receiptData.shift?.id}
                </span>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowReceiptModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Paper Width Selector Switch */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              background: 'rgba(255,255,255,0.04)',
              padding: 4,
              borderRadius: 8,
              marginBottom: 14,
              border: '1px solid var(--border)'
            }}>
              <button
                type="button"
                onClick={() => setThermalPaperSize('80mm')}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 12,
                  border: '1px solid',
                  borderColor: thermalPaperSize === '80mm' ? 'var(--accent-bright)' : 'transparent',
                  background: thermalPaperSize === '80mm' ? 'var(--accent-gradient)' : 'transparent',
                  color: '#ffffff'
                }}
              >
                80mm (Standar POS)
              </button>
              <button
                type="button"
                onClick={() => setThermalPaperSize('58mm')}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 12,
                  border: '1px solid',
                  borderColor: thermalPaperSize === '58mm' ? 'var(--accent-bright)' : 'transparent',
                  background: thermalPaperSize === '58mm' ? 'var(--accent-gradient)' : 'transparent',
                  color: '#ffffff'
                }}
              >
                58mm (Mini Printer)
              </button>
            </div>

            {/* Thermal Preview Card */}
            <div style={{
              background: '#ffffff',
              color: '#000000',
              padding: '16px 14px',
              borderRadius: 8,
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: 11,
              lineHeight: 1.35,
              maxHeight: '56vh',
              overflowY: 'auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              border: '1px solid #ddd'
            }}>
              {/* Header Outlet */}
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: '0.04em' }}>
                  {receiptData.outlet_name || receiptData.business_name || 'MOVA POS'}
                </div>
                {receiptData.outlet_address && (
                  <div style={{ fontSize: 9.5, opacity: 0.85, marginTop: 2 }}>
                    {receiptData.outlet_address}
                  </div>
                )}
                {receiptData.outlet_phone && (
                  <div style={{ fontSize: 9.5, opacity: 0.85 }}>
                    No. Telp: {receiptData.outlet_phone}
                  </div>
                )}
              </div>

              <div style={{ borderBottom: '1px solid #000', margin: '6px 0' }} />

              <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                *** REKAP KAS (CLOSING SHIFT) ***
              </div>
              <div style={{ textAlign: 'center', fontSize: 9.5, opacity: 0.8, marginTop: 2 }}>
                ID Shift: <strong>#{receiptData.shift?.id}</strong> ({receiptData.shift?.shift_name || 'Reguler'})
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              {/* Shift Metadata */}
              <div style={{ fontSize: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Kasir Buka:</span>
                  <strong>{receiptData.kasir_name || '-'}</strong>
                </div>
                {receiptData.closed_by_name && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Kasir Tutup:</span>
                    <strong>{receiptData.closed_by_name}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Waktu Buka:</span>
                  <span>{receiptData.shift?.opened_at ? new Date(receiptData.shift.opened_at).toLocaleString('id-ID') : '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Waktu Tutup:</span>
                  <span>{receiptData.shift?.closed_at ? new Date(receiptData.shift.closed_at).toLocaleString('id-ID') : '-'}</span>
                </div>
                {receiptData.order_number_range && receiptData.order_number_range !== '-' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Rentang No. Nota:</span>
                    <strong style={{ fontSize: 9.5 }}>{receiptData.order_number_range}</strong>
                  </div>
                )}
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              {/* CASH DRAWER RECONCILIATION */}
              <div style={{ fontWeight: 800, fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>
                [ ARUS KAS FISIK DI LACI ]
              </div>
              <div style={{ fontSize: 10.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Modal Awal Kas:</span>
                  <strong>{rupiah(receiptData.initial_cash || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Penjualan Tunai (+):</span>
                  <span>{rupiah(receiptData.cash_total || 0)}</span>
                </div>
                {Number(receiptData.total_expenses || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c' }}>
                    <span>Biaya / Kas Keluar (-):</span>
                    <span>-{rupiah(receiptData.total_expenses)}</span>
                  </div>
                )}
                <div style={{ borderBottom: '1px solid #000', margin: '4px 0 2px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                  <span>Kas Sistem di Laci:</span>
                  <span>{rupiah((Number(receiptData.initial_cash || 0) + Number(receiptData.cash_total || 0)) - Number(receiptData.total_expenses || 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                  <span>Kas Aktual (Fisik):</span>
                  <span>{receiptData.closing_cash !== null ? rupiah(receiptData.closing_cash) : '-'}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 900,
                  fontSize: 11,
                  marginTop: 2,
                  padding: '2px 4px',
                  background: (receiptData.cash_difference || 0) === 0 ? '#e0f2fe' : ((receiptData.cash_difference || 0) < 0 ? '#fee2e2' : '#fef3c7')
                }}>
                  <span>SELISIH KAS LACI:</span>
                  <span>
                    {(receiptData.cash_difference || 0) === 0
                      ? '✓ PAS (Rp 0)'
                      : (receiptData.cash_difference > 0 ? `+${rupiah(receiptData.cash_difference)} (LEBIH)` : `${rupiah(receiptData.cash_difference)} (KURANG)`)}
                  </span>
                </div>
              </div>

              {/* SETORAN KAS BESAR RECONCILIATION */}
              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />
              <div style={{ fontWeight: 800, fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>
                [ STATUS SETORAN KAS BESAR ]
              </div>
              <div style={{ fontSize: 10.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Status Setor:</span>
                  <strong style={{
                    color: (receiptData.deposit_status === 'APPROVED' || receiptData.is_deposited)
                      ? '#047857'
                      : (receiptData.deposit_status === 'PENDING' || receiptData.is_deposit_pending)
                        ? '#b45309'
                        : (receiptData.deposit_status === 'REJECTED' || receiptData.is_deposit_rejected)
                          ? '#b91c1c'
                          : '#4b5563'
                  }}>
                    {(receiptData.deposit_status === 'APPROVED' || receiptData.is_deposited)
                      ? '✓ DISETUJUI OWNER'
                      : (receiptData.deposit_status === 'PENDING' || receiptData.is_deposit_pending)
                        ? '⏳ MENUNGGU APPROVAL'
                        : (receiptData.deposit_status === 'REJECTED' || receiptData.is_deposit_rejected)
                          ? '✕ DITOLAK OWNER'
                          : '⚠️ BELUM DISETOR'}
                  </strong>
                </div>
                {(receiptData.deposit_amount > 0 || receiptData.is_deposited || receiptData.deposit_status === 'PENDING') && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Nominal Setor:</span>
                      <strong>{rupiah(receiptData.deposit_amount)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Akun Tujuan:</span>
                      <span>{receiptData.deposit_account || 'Kas Besar / Brankas'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                      <span>Selisih Setor vs Fisik:</span>
                      <span style={{ color: (receiptData.deposit_diff || 0) === 0 ? '#047857' : (receiptData.deposit_diff || 0) > 0 ? '#0369a1' : '#b91c1c' }}>
                        {(receiptData.deposit_diff || 0) === 0
                          ? '✓ PAS (Sesuai Fisik)'
                          : (receiptData.deposit_diff > 0 ? `+${rupiah(receiptData.deposit_diff)} (LEBIH SETOR)` : `${rupiah(receiptData.deposit_diff)} (KURANG SETOR)`)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              {/* SALES SUMMARY */}
              <div style={{ fontWeight: 800, fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>
                [ RINGKASAN OMZET PENJUALAN ]
              </div>
              <div style={{ fontSize: 10.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Transaksi Lunas:</span>
                  <strong>{receiptData.total_transactions || 0} nota</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Penjualan Tunai:</span>
                  <span>{rupiah(receiptData.cash_total || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Penjualan Non-Tunai:</span>
                  <span>{rupiah(receiptData.non_cash_total || 0)}</span>
                </div>
                {Object.entries(receiptData.non_cash_details || {}).map(([mth, val]) => (
                  <div key={mth} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, paddingLeft: 10, opacity: 0.85 }}>
                    <span>• {mth}:</span>
                    <span>{rupiah(val)}</span>
                  </div>
                ))}
                <div style={{ borderBottom: '1px solid #000', margin: '4px 0 2px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 12 }}>
                  <span>TOTAL OMZET:</span>
                  <span>{rupiah(receiptData.total_sales || 0)}</span>
                </div>
              </div>

              {/* DAFTAR NOMOR NOTA TRANSAKSI */}
              {receiptData.orders?.length > 0 && (
                <>
                  <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />
                  <div style={{ fontWeight: 800, fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>
                    [ DAFTAR NO. NOTA ({receiptData.orders.length} Transaksi) ]
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {receiptData.orders.map((ord, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 9.5 }}>
                        <div>
                          <span style={{ fontWeight: 800 }}>#{ord.order_number}</span>
                          <span style={{ opacity: 0.75, marginLeft: 4 }}>({ord.time})</span>
                          {ord.payment_method && (
                            <span style={{ fontSize: 8.5, opacity: 0.85, marginLeft: 4, textTransform: 'uppercase' }}>
                              [{ord.payment_method}]
                            </span>
                          )}
                          {ord.customer_name && (
                            <span style={{ fontSize: 8.5, opacity: 0.7, marginLeft: 4 }}>
                              · {ord.customer_name}
                            </span>
                          )}
                        </div>
                        <span style={{ fontWeight: 700, marginLeft: 6, flexShrink: 0 }}>{rupiah(ord.total_price)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ITEMS SOLD BREAKDOWN */}
              {receiptData.items_sold?.length > 0 && (
                <>
                  <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />
                  <div style={{ fontWeight: 800, fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>
                    [ MENU TERJUAL ({receiptData.items_sold.reduce((s, i) => s + Number(i.qty), 0)} porsi) ]
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {receiptData.items_sold.map((it, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                        <span><strong>{it.qty}x</strong> {it.menu_name}</span>
                        <span>{rupiah(it.total)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* EXPENSES BREAKDOWN */}
              {receiptData.expenses?.length > 0 && (
                <>
                  <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />
                  <div style={{ fontWeight: 800, fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>
                    [ RINCIAN BIAYA OPERASIONAL ]
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {receiptData.expenses.map((exp, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5 }}>
                        <span>• {exp.description}</span>
                        <span>{rupiah(exp.amount)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 10.5, borderTop: '1px solid #000', paddingTop: 2, marginTop: 2 }}>
                      <span>Total Biaya:</span>
                      <span>{rupiah(receiptData.total_expenses)}</span>
                    </div>
                  </div>
                </>
              )}

              <div style={{ borderBottom: '1px solid #000', margin: '8px 0' }} />

              {/* Signatures */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, textAlign: 'center', fontSize: 9.5, marginTop: 8 }}>
                <div>
                  <div>Kasir Bertugas,</div>
                  <div style={{ height: 35 }} />
                  <div>( {receiptData.closed_by_name || receiptData.kasir_name || 'Kasir'} )</div>
                </div>
                <div>
                  <div>Supervisor / Manager,</div>
                  <div style={{ height: 35 }} />
                  <div>( ........................ )</div>
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

              {/* Footer */}
              <div style={{ textAlign: 'center', fontSize: 8.5, opacity: 0.85 }}>
                <div>Dicetak: {new Date().toLocaleString('id-ID')}</div>
                <div>* DOKUMEN REKAP KAS RESMI MOVA POS *</div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowReceiptModal(false)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Tutup
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => doPrintShiftReceipt(thermalPaperSize)}
                style={{ flex: 1.6, justifyContent: 'center', fontWeight: 800 }}
              >
                <Printer size={15} style={{ marginRight: 6 }} /> Cetak Struk Thermal ({thermalPaperSize})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden thermal receipt container for printing */}
      {receiptData && (
        <div id="shift-receipt-print" style={{ display: 'none' }}>
          <div className="thermal-receipt-preview" style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: 10.5,
            lineHeight: 1.35,
            color: '#000000',
            background: '#ffffff',
            padding: '2px 0',
            width: '100%',
            maxWidth: thermalPaperSize === '58mm' ? '54mm' : '76mm'
          }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: '0.04em' }}>
                {receiptData.outlet_name || receiptData.business_name || 'MOVA POS'}
              </div>
              {receiptData.outlet_address && (
                <div style={{ fontSize: 9.5 }}>{receiptData.outlet_address}</div>
              )}
              {receiptData.outlet_phone && (
                <div style={{ fontSize: 9.5 }}>No. Telp: {receiptData.outlet_phone}</div>
              )}
            </div>

            <div style={{ borderBottom: '1px solid #000', margin: '4px 0' }} />

            <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
              *** REKAP KAS (CLOSING SHIFT) ***
            </div>
            <div style={{ textAlign: 'center', fontSize: 9.5, marginTop: 1 }}>
              ID Shift: <strong>#{receiptData.shift?.id}</strong> ({receiptData.shift?.shift_name || 'Reguler'})
            </div>

            <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }} />

            {/* Metadata */}
            <div style={{ fontSize: 9.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Kasir Buka:</span>
                <strong>{receiptData.kasir_name || '-'}</strong>
              </div>
              {receiptData.closed_by_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Kasir Tutup:</span>
                  <strong>{receiptData.closed_by_name}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Waktu Buka:</span>
                <span>{receiptData.shift?.opened_at ? new Date(receiptData.shift.opened_at).toLocaleString('id-ID') : '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Waktu Tutup:</span>
                <span>{receiptData.shift?.closed_at ? new Date(receiptData.shift.closed_at).toLocaleString('id-ID') : '-'}</span>
              </div>
              {receiptData.order_number_range && receiptData.order_number_range !== '-' && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Rentang Nota:</span>
                  <strong style={{ fontSize: 9 }}>{receiptData.order_number_range}</strong>
                </div>
              )}
            </div>

            <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }} />

            {/* Cash Drawer Breakdown */}
            <div style={{ fontWeight: 800, fontSize: 10.5, marginBottom: 2 }}>[ ARUS KAS DI LACI ]</div>
            <div style={{ fontSize: 10, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Modal Awal Kas:</span>
                <strong>{rupiah(receiptData.initial_cash || 0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Penjualan Tunai (+):</span>
                <span>{rupiah(receiptData.cash_total || 0)}</span>
              </div>
              {Number(receiptData.total_expenses || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Biaya / Kas Keluar (-):</span>
                  <span>-{rupiah(receiptData.total_expenses)}</span>
                </div>
              )}
              <div style={{ borderBottom: '1px solid #000', margin: '3px 0 1px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                <span>Kas Sistem:</span>
                <span>{rupiah((Number(receiptData.initial_cash || 0) + Number(receiptData.cash_total || 0)) - Number(receiptData.total_expenses || 0))}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                <span>Kas Aktual (Fisik):</span>
                <span>{receiptData.closing_cash !== null ? rupiah(receiptData.closing_cash) : '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 10.5, marginTop: 1 }}>
                <span>SELISIH LACI:</span>
                <span>
                  {(receiptData.cash_difference || 0) === 0
                    ? '✓ PAS (Rp 0)'
                    : (receiptData.cash_difference > 0 ? `+${rupiah(receiptData.cash_difference)} (LEBIH)` : `${rupiah(receiptData.cash_difference)} (KURANG)`)}
                </span>
              </div>
            </div>

            {/* Setoran Kas Besar */}
            <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }} />
            <div style={{ fontWeight: 800, fontSize: 10, marginBottom: 2 }}>[ SETORAN KAS BESAR ]</div>
            <div style={{ fontSize: 9.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Status:</span>
                <strong>
                  {(receiptData.deposit_status === 'APPROVED' || receiptData.is_deposited)
                    ? '✓ DISETUJUI'
                    : (receiptData.deposit_status === 'PENDING' || receiptData.is_deposit_pending)
                      ? '⏳ MENUNGGU APPR'
                      : (receiptData.deposit_status === 'REJECTED' || receiptData.is_deposit_rejected)
                        ? '✕ DITOLAK'
                        : '⚠️ BELUM SETOR'}
                </strong>
              </div>
              {(receiptData.deposit_amount > 0 || receiptData.is_deposited || receiptData.deposit_status === 'PENDING') && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Disetor:</span>
                    <strong>{rupiah(receiptData.deposit_amount)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Akun:</span>
                    <span>{receiptData.deposit_account || 'Kas Besar'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                    <span>Selisih Setor:</span>
                    <span>
                      {(receiptData.deposit_diff || 0) === 0
                        ? '✓ PAS'
                        : (receiptData.deposit_diff > 0 ? `+${rupiah(receiptData.deposit_diff)} (LEBIH)` : `${rupiah(receiptData.deposit_diff)} (KURANG)`)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }} />

            {/* Sales Summary */}
            <div style={{ fontWeight: 800, fontSize: 10.5, marginBottom: 2 }}>[ RINGKASAN OMZET ]</div>
            <div style={{ fontSize: 10, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Transaksi:</span>
                <strong>{receiptData.total_transactions || 0} nota</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Penjualan Tunai:</span>
                <span>{rupiah(receiptData.cash_total || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Penjualan Non-Tunai:</span>
                <span>{rupiah(receiptData.non_cash_total || 0)}</span>
              </div>
              {Object.entries(receiptData.non_cash_details || {}).map(([mth, val]) => (
                <div key={mth} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, paddingLeft: 8 }}>
                  <span>• {mth}:</span>
                  <span>{rupiah(val)}</span>
                </div>
              ))}
              <div style={{ borderBottom: '1px solid #000', margin: '3px 0 1px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 11 }}>
                <span>TOTAL OMZET:</span>
                <span>{rupiah(receiptData.total_sales || 0)}</span>
              </div>
            </div>

            {/* DAFTAR NO. NOTA TRANSAKSI */}
            {receiptData.orders?.length > 0 && (
              <>
                <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }} />
                <div style={{ fontWeight: 800, fontSize: 10.5, marginBottom: 2 }}>
                  [ NO. NOTA TRANSAKSI ({receiptData.orders.length}) ]
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {receiptData.orders.map((ord, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 9 }}>
                      <div>
                        <strong>#{ord.order_number}</strong>
                        <span style={{ opacity: 0.8, marginLeft: 3 }}>({ord.time})</span>
                        {ord.payment_method && (
                          <span style={{ fontSize: 8, opacity: 0.85, marginLeft: 3 }}>
                            [{ord.payment_method}]
                          </span>
                        )}
                      </div>
                      <span style={{ fontWeight: 700, marginLeft: 4, flexShrink: 0 }}>{rupiah(ord.total_price)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Items Sold Breakdown */}
            {receiptData.items_sold?.length > 0 && (
              <>
                <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }} />
                <div style={{ fontWeight: 800, fontSize: 10.5, marginBottom: 2 }}>
                  [ ITEM TERJUAL ({receiptData.items_sold.reduce((s, i) => s + Number(i.qty), 0)}) ]
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {receiptData.items_sold.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5 }}>
                      <span><strong>{it.qty}x</strong> {it.menu_name}</span>
                      <span>{rupiah(it.total)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Expenses Breakdown */}
            {receiptData.expenses?.length > 0 && (
              <>
                <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }} />
                <div style={{ fontWeight: 800, fontSize: 10.5, marginBottom: 2 }}>[ BIAYA OPERASIONAL ]</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {receiptData.expenses.map((exp, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                      <span>• {exp.description}</span>
                      <span>{rupiah(exp.amount)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 9.5, borderTop: '1px solid #000', paddingTop: 1, marginTop: 1 }}>
                    <span>Total Biaya:</span>
                    <span>{rupiah(receiptData.total_expenses)}</span>
                  </div>
                </div>
              </>
            )}

            <div style={{ borderBottom: '1px solid #000', margin: '6px 0' }} />

            {/* Signatures */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, textAlign: 'center', fontSize: 9, marginTop: 6 }}>
              <div>
                <div>Kasir,</div>
                <div style={{ height: 30 }} />
                <div>( {receiptData.closed_by_name || receiptData.kasir_name || 'Kasir'} )</div>
              </div>
              <div>
                <div>Supervisor,</div>
                <div style={{ height: 30 }} />
                <div>( ................. )</div>
              </div>
            </div>

            <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: 8.5 }}>
              <div>Dicetak: {new Date().toLocaleString('id-ID')}</div>
              <div>* BUKTI RESMI CLOSING SHIFT KASIR *</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
