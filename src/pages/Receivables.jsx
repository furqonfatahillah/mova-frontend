import { useState, useEffect, useMemo } from 'react';
import {
  Wallet, PlusCircle, Search, RefreshCw, Eye,
  Printer, FileSpreadsheet, MessageCircle, AlertCircle,
  Calendar, CheckCircle2, AlertOctagon, Clock, DollarSign,
  ChevronRight, X, User, Phone, MapPin, CreditCard,
  Trash2, Edit3, ArrowRight, ShieldAlert, Receipt, Send, Check,
  Users, CheckSquare, Square, Layers, Sparkles, History,
  Landmark, Building2, QrCode, ShoppingCart, ArrowDownToLine
} from 'lucide-react';
import api from '../api/client';
import {
  num, rupiah, pct, StatusPill, LoadingState,
  PageHeader, MiniCard, formatDateTime
} from '../components/ui';
import { getTodayStr } from '../utils/date';
import { useOutlet } from '../context/OutletContext';
import { exportReceivablesToExcel } from '../utils/exportReport';
import { printElement } from '../utils/print';
import toast from 'react-hot-toast';
import ImportMasterModal from '../components/ImportMasterModal';
import { confirmDialog } from '../utils/swal';

export default function Receivables() {
  const {
    activeOutletId,
    activeOutlet,
    outlets,
    canSwitchOutlet,
    currentBusiness,
    currentUser,
  } = useOutlet();

  const businessName = currentBusiness?.name || currentUser?.business?.name || 'MOVA POS F&B Management';
  const outletName = (activeOutlet && activeOutletId !== 'ALL' && activeOutletId !== 'all') ? activeOutlet.name : 'Semua Cabang (Konsolidasi)';

  const targetOutlet = useMemo(() => {
    if (!canSwitchOutlet) {
      return Number(currentUser?.outlet_id || activeOutletId || outlets?.[0]?.id || 1);
    }
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      return Number(activeOutletId);
    }
    return undefined;
  }, [activeOutletId, outlets, canSwitchOutlet, currentUser?.outlet_id]);

  // Tab State: 'CUSTOMERS' | 'RECEIVABLES' | 'PAYMENTS' | 'AR_MERCHANT'
  const [activeTab, setActiveTab] = useState('CUSTOMERS');

  // Main Data States
  const [items, setItems] = useState([]);
  const [customerSummary, setCustomerSummary] = useState([]);
  const [masterCustomers, setMasterCustomers] = useState([]);
  const [stats, setStats] = useState({
    total_receivables: 0,
    total_remaining: 0,
    total_paid: 0,
    total_overdue: 0,
    count_overdue: 0,
    paid_this_month: 0,
    count_unpaid: 0,
    count_partial: 0,
    count_paid: 0,
    total_customers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE'
  const [dueFilter, setDueFilter] = useState('ALL'); // 'ALL' | 'OVERDUE' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH'

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [payModal, setPayModal] = useState({
    open: false, item: null, amount: '', payment_date: getTodayStr(),
    payment_method: 'CASH', reference_no: '', notes: ''
  });

  // Bulk Payment Modal State
  const [bulkPayModal, setBulkPayModal] = useState({
    open: false,
    customerGroup: null,
    selectedIds: [],
    amount: '',
    payment_date: getTodayStr(),
    payment_method: 'CASH',
    reference_no: '',
    notes: '',
  });

  const [historyModal, setHistoryModal] = useState({ open: false, item: null });
  const [invoiceModal, setInvoiceModal] = useState({ open: false, item: null });
  const [expandedCustomerKey, setExpandedCustomerKey] = useState(null);
  const [selectedReceivableIds, setSelectedReceivableIds] = useState([]);

  // AR Merchant States
  const [merchantChannels, setMerchantChannels] = useState([]);
  const [merchantAllRows, setMerchantAllRows] = useState([]);
  const [merchantSummary, setMerchantSummary] = useState({});
  const [merchantFilter, setMerchantFilter] = useState('ALL'); // 'ALL' | 'QRIS' | 'ECOMMERCE' | 'UNSETTLED' | 'SETTLED'
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedMerchantIds, setSelectedMerchantIds] = useState([]);
  const [settleModal, setSettleModal] = useState({
    open: false, mode: 'single', items: [],
    settlement_bank: '', settlement_ref: '', settled_at: getTodayStr(),
  });
  const [merchantLoading, setMerchantLoading] = useState(false);

  // Selected items from Receivables table for multi-select bulk payment
  const selectedUnpaidReceivables = useMemo(() => {
    return items.filter(i => selectedReceivableIds.includes(i.id) && i.remaining_amount > 0);
  }, [items, selectedReceivableIds]);

  const selectedTotalRemaining = useMemo(() => {
    return selectedUnpaidReceivables.reduce((acc, curr) => acc + (curr.remaining_amount || 0), 0);
  }, [selectedUnpaidReceivables]);

  // Extract all payments across all receivables for the "PAYMENTS" history tab
  const allPaymentLogs = useMemo(() => {
    const logs = [];
    for (const rec of items) {
      if (Array.isArray(rec.payments)) {
        for (const p of rec.payments) {
          logs.push({
            ...p,
            receivable_id: rec.id,
            receivable_no: rec.receivable_no,
            customer_name: rec.customer_name,
            customer_phone: rec.customer_phone,
            total_amount: rec.total_amount,
            remaining_amount: rec.remaining_amount,
            outlet_name: rec.outlet?.name || rec.outlet_name,
          });
        }
      }
    }
    // Sort newest payment date first
    return logs.sort((a, b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at));
  }, [items]);

  // Filtered payment logs for search
  const filteredPaymentLogs = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return allPaymentLogs;
    const q = searchQuery.toLowerCase().trim();
    return allPaymentLogs.filter(p =>
      (p.payment_no && p.payment_no.toLowerCase().includes(q)) ||
      (p.customer_name && p.customer_name.toLowerCase().includes(q)) ||
      (p.receivable_no && p.receivable_no.toLowerCase().includes(q)) ||
      (p.notes && p.notes.toLowerCase().includes(q)) ||
      (p.reference_no && p.reference_no.toLowerCase().includes(q)) ||
      (p.payment_method && p.payment_method.toLowerCase().includes(q))
    );
  }, [allPaymentLogs, searchQuery]);

  function toggleSelectReceivable(id) {
    setSelectedReceivableIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAllReceivables() {
    const unpaidItems = filteredItems.filter(i => i.remaining_amount > 0);
    const unpaidIds = unpaidItems.map(i => i.id);
    const allSelected = unpaidIds.length > 0 && unpaidIds.every(id => selectedReceivableIds.includes(id));

    if (allSelected) {
      setSelectedReceivableIds(prev => prev.filter(id => !unpaidIds.includes(id)));
    } else {
      setSelectedReceivableIds(prev => [...new Set([...prev, ...unpaidIds])]);
    }
  }

  function openBulkPayFromTableSelection() {
    if (selectedUnpaidReceivables.length === 0) {
      toast.error('Tidak ada nota kasbon belum lunas yang dipilih');
      return;
    }

    const uniqueCustomerNames = [...new Set(selectedUnpaidReceivables.map(i => i.customer_name))].filter(Boolean);
    const displayName = uniqueCustomerNames.length === 1
      ? uniqueCustomerNames[0]
      : `${uniqueCustomerNames[0]} (+${uniqueCustomerNames.length - 1} pelanggan lain)`;

    setBulkPayModal({
      open: true,
      customerGroup: {
        customer_name: displayName,
        unpaid_count: selectedUnpaidReceivables.length,
        total_remaining: selectedTotalRemaining,
        unpaid_items: selectedUnpaidReceivables,
      },
      selectedIds: selectedUnpaidReceivables.map(i => i.id),
      amount: String(selectedTotalRemaining),
      payment_date: getTodayStr(),
      payment_method: 'CASH',
      reference_no: '',
      notes: '',
    });
  }

  // Form State for New / Edit Receivable
  const [form, setForm] = useState({
    id: null,
    customer_id: '',
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    issue_date: getTodayStr(),
    due_date: getTodayStr(),
    total_amount: '',
    initial_paid: '',
    payment_method: 'CASH',
    reference_no: '',
    notes: '',
    outlet_id: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
    fetchMasterCustomers();
    fetchBankAccounts();
  }, [targetOutlet, statusFilter, dueFilter]);

  useEffect(() => {
    if (activeTab === 'AR_MERCHANT') {
      fetchMerchantData();
    }
  }, [activeTab, targetOutlet]);

  async function fetchData() {
    setLoading(true);
    try {
      const params = {
        outlet_id: targetOutlet,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        due_filter: dueFilter !== 'ALL' ? dueFilter : undefined,
      };

      const [resAll, resCust] = await Promise.all([
        api.get('/receivables', { params }),
        api.get('/receivables/customers', { params: { outlet_id: targetOutlet } }),
      ]);

      setItems(resAll.data?.data || []);
      setStats(resAll.data?.stats || {});
      setCustomerSummary(resCust.data?.data || []);
    } catch (err) {
      console.error('Error fetching receivables:', err);
      toast.error('Gagal memuat data kasbon customer');
    } finally {
      setLoading(false);
    }
  }

  async function fetchMasterCustomers() {
    try {
      const res = await api.get('/customers');
      setMasterCustomers(res.data?.data || res.data || []);
    } catch (err) {
      console.error('Error fetching master customers:', err);
    }
  }

  async function fetchBankAccounts() {
    try {
      const res = await api.get('/bank-accounts');
      setBankAccounts(res.data?.data || res.data || []);
    } catch (err) {
      console.error('Error fetching bank accounts:', err);
    }
  }

  async function fetchMerchantData() {
    setMerchantLoading(true);
    try {
      const params = { outlet_id: targetOutlet };
      const res = await api.get('/receivables/merchants', { params });
      setMerchantChannels(res.data?.data || []);
      setMerchantAllRows(res.data?.all_rows || []);
      setMerchantSummary(res.data?.summary || {});
    } catch (err) {
      console.error('Error fetching merchant receivables:', err);
      toast.error('Gagal memuat data AR Merchant');
    } finally {
      setMerchantLoading(false);
    }
  }

  // AR Merchant filtered rows based on merchantFilter
  const filteredMerchantRows = useMemo(() => {
    let rows = merchantAllRows;
    if (merchantFilter === 'QRIS') rows = rows.filter(r => r.ar_type === 'MERCHANT_QRIS');
    else if (merchantFilter === 'ECOMMERCE') rows = rows.filter(r => r.ar_type === 'MERCHANT_ECOMMERCE');
    else if (merchantFilter === 'UNSETTLED') rows = rows.filter(r => r.settlement_status !== 'SETTLED');
    else if (merchantFilter === 'SETTLED') rows = rows.filter(r => r.settlement_status === 'SETTLED');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter(r =>
        (r.merchant_channel || '').toLowerCase().includes(q) ||
        (r.order_number || '').toLowerCase().includes(q) ||
        (r.customer_name || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [merchantAllRows, merchantFilter, searchQuery]);

  const merchantUnsettledCount = useMemo(() => {
    return merchantAllRows.filter(r => r.settlement_status !== 'SETTLED').length;
  }, [merchantAllRows]);

  function toggleSelectMerchant(id) {
    setSelectedMerchantIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAllMerchants() {
    const unsettled = filteredMerchantRows.filter(r => r.settlement_status !== 'SETTLED');
    const unsettledIds = unsettled.map(r => r.id);
    const allSelected = unsettledIds.length > 0 && unsettledIds.every(id => selectedMerchantIds.includes(id));
    if (allSelected) {
      setSelectedMerchantIds(prev => prev.filter(id => !unsettledIds.includes(id)));
    } else {
      setSelectedMerchantIds(prev => [...new Set([...prev, ...unsettledIds])]);
    }
  }

  async function handleSettleMerchant(e) {
    e.preventDefault();
    if (settleModal.items.length === 0) return;
    setSubmitting(true);
    try {
      if (settleModal.mode === 'single') {
        await api.post(`/receivables/${settleModal.items[0].id}/settle`, {
          settlement_bank: settleModal.settlement_bank,
          settlement_ref: settleModal.settlement_ref,
          settled_at: settleModal.settled_at,
        });
        toast.success('Pencairan AR Merchant berhasil dicatat!');
      } else {
        const res = await api.post('/receivables/merchants/bulk-settle', {
          ids: settleModal.items.map(i => i.id),
          settlement_bank: settleModal.settlement_bank,
          settlement_ref: settleModal.settlement_ref,
          settled_at: settleModal.settled_at,
        });
        toast.success(res.data?.message || 'Pencairan masal berhasil!');
      }
      setSettleModal({ open: false, mode: 'single', items: [], settlement_bank: '', settlement_ref: '', settled_at: getTodayStr() });
      setSelectedMerchantIds([]);
      fetchMerchantData();
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gagal memproses pencairan AR Merchant');
    } finally {
      setSubmitting(false);
    }
  }

  // Filtered dataset for instant text search (Items)
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(r => {
      return (
        r.customer_name?.toLowerCase().includes(q) ||
        r.customer_phone?.toLowerCase().includes(q) ||
        r.receivable_no?.toLowerCase().includes(q) ||
        r.order_number?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery]);

  // Filtered customer summary
  const filteredCustomerSummary = useMemo(() => {
    if (!searchQuery.trim()) return customerSummary;
    const q = searchQuery.toLowerCase().trim();
    return customerSummary.filter(c => {
      return (
        c.customer_name?.toLowerCase().includes(q) ||
        c.customer_phone?.toLowerCase().includes(q)
      );
    });
  }, [customerSummary, searchQuery]);

  // Select customer in create modal
  function handleSelectCustomerInForm(customerId) {
    if (!customerId) {
      setForm(f => ({ ...f, customer_id: '', customer_name: '', customer_phone: '', customer_address: '' }));
      return;
    }
    const found = masterCustomers.find(c => String(c.id) === String(customerId));
    if (found) {
      setForm(f => ({
        ...f,
        customer_id: found.id,
        customer_name: found.name || '',
        customer_phone: found.phone || '',
        customer_address: found.address || '',
      }));
    }
  }

  // Handle Create / Edit Submit
  async function handleSaveReceivable(e) {
    e.preventDefault();
    if (!form.customer_name.trim()) {
      toast.error('Nama pelanggan wajib diisi');
      return;
    }
    if (!form.total_amount || Number(form.total_amount) <= 0) {
      toast.error('Total nominal kasbon harus lebih dari 0');
      return;
    }
    if (!form.due_date) {
      toast.error('Tanggal jatuh tempo wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      if (form.id) {
        await api.put(`/receivables/${form.id}`, {
          customer_id: form.customer_id || null,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_address: form.customer_address,
          due_date: form.due_date,
          notes: form.notes,
        });
        toast.success('Data kasbon berhasil diperbarui');
      } else {
        await api.post('/receivables', {
          outlet_id: form.outlet_id || targetOutlet || outlets?.[0]?.id || 1,
          customer_id: form.customer_id || null,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_address: form.customer_address,
          issue_date: form.issue_date,
          due_date: form.due_date,
          total_amount: Number(form.total_amount),
          initial_paid: form.initial_paid ? Number(form.initial_paid) : 0,
          payment_method: form.payment_method,
          reference_no: form.reference_no,
          notes: form.notes,
        });
        toast.success('Tagihan kasbon baru berhasil dicatat');
      }
      setCreateModalOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gagal menyimpan tagihan kasbon');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm({
      id: null,
      customer_id: '',
      customer_name: '',
      customer_phone: '',
      customer_address: '',
      issue_date: getTodayStr(),
      due_date: getTodayStr(),
      total_amount: '',
      initial_paid: '',
      payment_method: 'CASH',
      reference_no: '',
      notes: '',
      outlet_id: targetOutlet || '',
    });
  }

  function openEditModal(item) {
    setForm({
      id: item.id,
      customer_id: item.customer_id || '',
      customer_name: item.customer_name || '',
      customer_phone: item.customer_phone || '',
      customer_address: item.customer_address || '',
      issue_date: item.issue_date || getTodayStr(),
      due_date: item.due_date || getTodayStr(),
      total_amount: String(item.total_amount || ''),
      initial_paid: '',
      payment_method: 'CASH',
      reference_no: '',
      notes: item.notes || '',
      outlet_id: item.outlet_id || '',
    });
    setCreateModalOpen(true);
  }

  // Handle Single Payment Submit
  async function handleAddPayment(e) {
    e.preventDefault();
    if (!payModal.item) return;
    const amountNum = Number(payModal.amount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Nominal pembayaran harus lebih dari 0');
      return;
    }
    if (amountNum > (payModal.item.remaining_amount + 0.01)) {
      toast.error(`Nominal pembayaran melebihi sisa kasbon (${rupiah(payModal.item.remaining_amount)})`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/receivables/${payModal.item.id}/payments`, {
        amount: amountNum,
        payment_date: payModal.payment_date,
        payment_method: payModal.payment_method,
        reference_no: payModal.reference_no,
        notes: payModal.notes,
      });
      toast.success(`Pembayaran ${rupiah(amountNum)} berhasil dicatat!`);
      setPayModal({ open: false, item: null, amount: '', payment_date: getTodayStr(), payment_method: 'CASH', reference_no: '', notes: '' });
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gagal mencatat pembayaran');
    } finally {
      setSubmitting(false);
    }
  }

  // Open Bulk Payment Modal for a customer group
  function openBulkPayModal(custGroup) {
    const unpaidList = custGroup.unpaid_items || [];
    const allIds = unpaidList.map(i => i.id);
    const totalRemaining = custGroup.total_remaining || 0;

    setBulkPayModal({
      open: true,
      customerGroup: custGroup,
      selectedIds: allIds,
      amount: String(totalRemaining),
      payment_date: getTodayStr(),
      payment_method: 'CASH',
      reference_no: '',
      notes: '',
    });
  }

  // Toggle selection in Bulk Payment
  function toggleBulkPayItem(id) {
    setBulkPayModal(prev => {
      const isSelected = prev.selectedIds.includes(id);
      const newSelected = isSelected
        ? prev.selectedIds.filter(x => x !== id)
        : [...prev.selectedIds, id];

      // Calculate total remaining for newly selected items
      const unpaidList = prev.customerGroup?.unpaid_items || [];
      const newTotal = unpaidList
        .filter(i => newSelected.includes(i.id))
        .reduce((acc, curr) => acc + (curr.remaining_amount || 0), 0);

      return {
        ...prev,
        selectedIds: newSelected,
        amount: String(newTotal),
      };
    });
  }

  // Handle Bulk Payment Submit
  async function handleBulkPaymentSubmit(e) {
    e.preventDefault();
    if (!bulkPayModal.customerGroup) return;

    const amountNum = Number(bulkPayModal.amount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Nominal pelunasan harus lebih dari 0');
      return;
    }
    if (bulkPayModal.selectedIds.length === 0) {
      toast.error('Pilih setidaknya 1 transaksi kasbon yang ingin dibayar');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/receivables/bulk-payment', {
        customer_id: bulkPayModal.customerGroup.customer_id || undefined,
        customer_name: bulkPayModal.customerGroup.customer_name,
        receivable_ids: bulkPayModal.selectedIds,
        amount: amountNum,
        payment_date: bulkPayModal.payment_date,
        payment_method: bulkPayModal.payment_method,
        reference_no: bulkPayModal.reference_no,
        notes: bulkPayModal.notes,
      });

      toast.success(`Pembayaran sekaligus ${rupiah(amountNum)} untuk ${bulkPayModal.customerGroup.customer_name} berhasil dicatat!`);
      setBulkPayModal({ open: false, customerGroup: null, selectedIds: [], amount: '', payment_date: getTodayStr(), payment_method: 'CASH', reference_no: '', notes: '' });
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gagal memproses pelunasan sekaligus');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Delete Receivable
  async function handleDelete(item) {
    const confirmed = await confirmDialog({
      title: 'Hapus Tagihan Kasbon?',
      text: `Yakin ingin menghapus tagihan kasbon ${item.receivable_no} (${item.customer_name})?`,
      confirmText: 'Ya, Hapus Kasbon',
      cancelText: 'Batal',
      isDanger: true,
    });
    if (!confirmed) return;
    try {
      await api.delete(`/receivables/${item.id}`);
      toast.success('Data kasbon berhasil dihapus');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus kasbon');
    }
  }

  // Handle Delete Payment
  async function handleDeletePayment(receivableId, paymentId) {
    const confirmed = await confirmDialog({
      title: 'Batalkan Pembayaran?',
      text: 'Yakin ingin membatalkan dan menghapus catatan pembayaran ini? Sisa kasbon akan dikembalikan.',
      confirmText: 'Ya, Batalkan Pembayaran',
      cancelText: 'Kembali',
      isDanger: true,
    });
    if (!confirmed) return;
    try {
      const res = await api.delete(`/receivables/${receivableId}/payments/${paymentId}`);
      toast.success('Pembayaran dibatalkan, sisa kasbon disesuaikan');
      setHistoryModal(prev => ({
        ...prev,
        item: res.data,
      }));
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Gagal membatalkan pembayaran');
    }
  }

  // WhatsApp Reminder Generator
  function openWhatsApp(itemOrGroup) {
    const phoneNum = itemOrGroup.customer_phone;
    if (!phoneNum) {
      toast.error('Nomor telepon/WhatsApp pelanggan tidak terdaftar');
      return;
    }

    let phone = phoneNum.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.slice(1);
    }

    const custName = itemOrGroup.customer_name;
    const isGroup = !!itemOrGroup.total_remaining;
    const totalRemaining = isGroup ? itemOrGroup.total_remaining : itemOrGroup.remaining_amount;

    let message = `Halo Kak ${custName},\n\nKami dari *${businessName}* (${outletName}).\n\nMengingatkan perihal catatan *Kasbon Pelanggan* dengan rincian berikut:\n`;

    if (isGroup && itemOrGroup.unpaid_items?.length > 0) {
      message += `• *Total Hutang Kasbon*: *${rupiah(totalRemaining)}*\n• *Jumlah Transaksi*: ${itemOrGroup.unpaid_count} nota\n\nRincian Nota Kasbon:\n`;
      itemOrGroup.unpaid_items.forEach((u, idx) => {
        message += `${idx + 1}. #${u.receivable_no} (${u.issue_date}) - Sisa: ${rupiah(u.remaining_amount)}\n`;
      });
    } else {
      message += `• *No. Invoice*: ${itemOrGroup.receivable_no}\n• *Total Tagihan*: ${rupiah(itemOrGroup.total_amount)}\n• *Sudah Dibayar*: ${rupiah(itemOrGroup.paid_amount)}\n• *Sisa Kasbon*: *${rupiah(itemOrGroup.remaining_amount)}*\n• *Jatuh Tempo*: ${itemOrGroup.due_date}\n`;
    }

    message += `\nMohon konfirmasi pembayaran atau bukti transfer jika telah melakukan pelunasan.\n\nTerima kasih banyak atas kerjasamanya! 🙏`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  // Export to Excel
  async function handleExportExcel() {
    try {
      const fname = await exportReceivablesToExcel({
        items: filteredItems,
        stats,
        outletName,
        businessName,
        userName: currentUser?.name || 'Administrator',
      });
      toast.success(`Buku Kasbon berhasil diekspor: ${fname}`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengekspor data kasbon ke Excel');
    }
  }

  // Print Invoice / Letter
  function handlePrintInvoice() {
    printElement(
      'printable-invoice-document',
      `Bukti Kasbon - ${invoiceModal.item?.receivable_no || 'Kasbon'}`,
      { orientation: 'portrait', margin: '10mm 10mm' }
    );
  }

  // Print Full Receivables Report (LAPORAN PIUTANG CUSTOMER)
  function handlePrintReceivablesReport() {
    printElement(
      'printable-receivables-report',
      `LAPORAN PIUTANG CUSTOMER - ${businessName}`,
      { orientation: 'portrait' }
    );
  }

  if (loading && items.length === 0 && customerSummary.length === 0) return <LoadingState />;

  return (
    <div className="fade-in" style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <div className="flex-between mb-6" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <PageHeader
          title="Kasbon Customer (Pelanggan Berhutang)"
          subtitle="Manajemen kasbon pelanggan, pelunasan sekaligus beberapa transaksi, cicilan bertahap, dan integrasi kasir."
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchData}
            title="Segarkan Data"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportExcel}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981' }}
            title="Unduh format spreadsheet Excel (.xlsx)"
          >
            <FileSpreadsheet size={14} /> Export Excel
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handlePrintReceivablesReport}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#38bdf8' }}
            title="Unduh / Cetak Dokumen PDF Resmi Laporan Piutang Customer"
          >
            <Printer size={14} /> Export PDF
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowImportModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
          >
            <FileSpreadsheet size={14} /> Import Excel
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => { resetForm(); setCreateModalOpen(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <PlusCircle size={15} /> + Tagihan Kasbon Baru
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid-4 mb-6">
        <MiniCard
          label="Total Sisa Kasbon Berjalan"
          value={rupiah(stats.total_remaining)}
          sub={`Dari total ${rupiah(stats.total_receivables)} tagihan kasbon`}
          icon={<Wallet size={20} color="var(--primary)" />}
        />
        <MiniCard
          label="Kasbon Lewat Jatuh Tempo"
          value={rupiah(stats.total_overdue)}
          sub={`${stats.count_overdue} nota kasbon butuh penagihan`}
          icon={<AlertOctagon size={20} color={stats.count_overdue > 0 ? '#ef4444' : 'var(--ok)'} />}
        />
        <MiniCard
          label="Pelunasan Diterima Bulan Ini"
          value={rupiah(stats.paid_this_month)}
          sub={`Total akumulasi lunas: ${rupiah(stats.total_paid)}`}
          icon={<CheckCircle2 size={20} color="var(--ok)" />}
        />
        <MiniCard
          label="Total Pelanggan Berhutang"
          value={`${stats.total_customers || 0} Pelanggan`}
          sub={`${stats.count_unpaid} Belum Bayar · ${stats.count_partial} Cicil · ${stats.count_paid} Lunas`}
          icon={<Users size={20} color="#60a5fa" />}
        />
      </div>

      {/* Mode View Switcher & Search Bar */}
      <div className="card mb-5" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* Tabs */}
          <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.06)', padding: '4px', borderRadius: '10px', gap: '4px' }}>
            <button
              onClick={() => setActiveTab('CUSTOMERS')}
              style={{
                padding: '7px 16px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeTab === 'CUSTOMERS' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'CUSTOMERS' ? '#ffffff' : 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              <Users size={15} /> Ringkasan Per Pelanggan ({customerSummary.filter(c => c.total_remaining > 0).length})
            </button>

            <button
              onClick={() => setActiveTab('RECEIVABLES')}
              style={{
                padding: '7px 16px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeTab === 'RECEIVABLES' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'RECEIVABLES' ? '#ffffff' : 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              <Receipt size={15} /> Semua Nota Kasbon ({items.length})
            </button>

            <button
              onClick={() => setActiveTab('PAYMENTS')}
              style={{
                padding: '7px 16px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeTab === 'PAYMENTS' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'PAYMENTS' ? '#ffffff' : 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              <History size={15} /> Riwayat Pelunasan ({allPaymentLogs.length})
            </button>

            <button
              onClick={() => setActiveTab('AR_MERCHANT')}
              style={{
                padding: '7px 16px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeTab === 'AR_MERCHANT' ? 'linear-gradient(135deg, #f59e0b, #a855f7)' : 'transparent',
                color: activeTab === 'AR_MERCHANT' ? '#ffffff' : 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              <Landmark size={15} /> AR Merchant (QRIS & E-Com)
              {merchantUnsettledCount > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  minWidth: '18px',
                  textAlign: 'center',
                }}>
                  {merchantUnsettledCount}
                </span>
              )}
            </button>
          </div>

          {/* Search & Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 0, 0, 0.2)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', minWidth: '240px' }}>
              <Search size={15} style={{ color: 'var(--text-secondary)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Cari nama pelanggan, HP, atau nota..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ border: 'none', background: 'transparent', padding: 0, fontSize: '13px', color: '#ffffff' }}
              />
            </div>

            {activeTab === 'RECEIVABLES' && (
              <>
                <select
                  className="form-control form-control-sm"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{ width: 'auto', fontSize: '12px' }}
                >
                  <option value="ALL">Semua Status</option>
                  <option value="UNPAID">Belum Dibayar (UNPAID)</option>
                  <option value="PARTIAL">Cicilan (PARTIAL)</option>
                  <option value="PAID">Sudah Lunas (PAID)</option>
                  <option value="OVERDUE">Jatuh Tempo (OVERDUE)</option>
                </select>

                <select
                  className="form-control form-control-sm"
                  value={dueFilter}
                  onChange={e => setDueFilter(e.target.value)}
                  style={{ width: 'auto', fontSize: '12px' }}
                >
                  <option value="ALL">Semua Periode</option>
                  <option value="OVERDUE">Sudah Lewat Jatuh Tempo</option>
                  <option value="TODAY">Jatuh Tempo Hari Ini</option>
                  <option value="THIS_WEEK">7 Hari ke Depan</option>
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: RINGKASAN PER PELANGGAN (CUSTOMER DEBT SUMMARY) */}
      {/* ========================================================================= */}
      {activeTab === 'CUSTOMERS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredCustomerSummary.length === 0 ? (
            <div className="card text-center" style={{ padding: '48px 16px', color: 'var(--text-secondary)' }}>
              <Users size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <div style={{ fontWeight: 600, fontSize: '15px' }}>Tidak Ada Data Pelanggan Kasbon</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Belum ada pencatatan kasbon pelanggan terdaftar pada outlet ini</div>
            </div>
          ) : (
            filteredCustomerSummary.map((cust, idx) => {
              const hasDebt = cust.total_remaining > 0;
              const isExpanded = expandedCustomerKey === cust.group_key;

              return (
                <div
                  key={cust.group_key || idx}
                  className="card fade-in"
                  style={{
                    border: cust.has_overdue ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border)',
                    background: cust.has_overdue ? 'rgba(239, 68, 68, 0.03)' : undefined,
                    padding: '18px 20px',
                    borderRadius: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    {/* Left: Customer Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        background: hasDebt ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                        border: hasDebt ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: hasDebt ? '#f59e0b' : '#22c55e',
                        fontWeight: 800,
                        fontSize: '18px'
                      }}>
                        {cust.customer_name?.charAt(0)?.toUpperCase() || 'P'}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, color: '#ffffff', fontSize: '16px' }}>
                            {cust.customer_name}
                          </span>
                          {cust.has_overdue && (
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              color: '#ef4444',
                              background: 'rgba(239, 68, 68, 0.15)',
                              padding: '2px 7px',
                              borderRadius: '4px'
                            }}>
                              Jatuh Tempo!
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '3px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {cust.customer_phone ? (
                            <span style={{ color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Phone size={12} /> {cust.customer_phone}
                            </span>
                          ) : (
                            <span>No HP: —</span>
                          )}
                          <span>• {cust.unpaid_count} Nota Belum Lunas</span>
                          <span>• Kasbon Terakhir: {cust.latest_issue_date}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Amounts & Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Total Sisa Kasbon
                        </div>
                        <div style={{
                          fontWeight: 800,
                          fontSize: '18px',
                          color: hasDebt ? (cust.has_overdue ? '#f87171' : '#fbbf24') : 'var(--ok)'
                        }}>
                          {rupiah(cust.total_remaining)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Dari total {rupiah(cust.total_kasbon)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {hasDebt && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => openBulkPayModal(cust)}
                            style={{ fontWeight: 700, padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <CreditCard size={14} /> Bayar Sekaligus
                          </button>
                        )}

                        {cust.customer_phone && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openWhatsApp(cust)}
                            style={{ color: '#4ade80', borderColor: 'rgba(74, 222, 128, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Kirim Pengingat Kasbon WA"
                          >
                            <MessageCircle size={14} /> WA
                          </button>
                        )}

                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => setExpandedCustomerKey(isExpanded ? null : cust.group_key)}
                          title="Lihat Rincian Nota Kasbon"
                        >
                          <ChevronRight size={16} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail Rows */}
                  {isExpanded && (
                    <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', marginBottom: '10px' }}>
                        Rincian Nota Kasbon ({cust.customer_name}):
                      </div>
                      <div className="table-wrap">
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '8px 12px' }}>No. Invoice</th>
                              <th style={{ padding: '8px 12px' }}>Tgl Terbit</th>
                              <th style={{ padding: '8px 12px' }}>Jatuh Tempo</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Tagihan</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Sudah Dibayar</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Sisa Kasbon</th>
                              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(cust.all_items || []).map(item => (
                              <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 700, color: '#ffffff' }}>{item.receivable_no}</td>
                                <td style={{ padding: '8px 12px' }}>{item.issue_date}</td>
                                <td style={{ padding: '8px 12px' }}>{item.due_date}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{rupiah(item.total_amount)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--ok)' }}>{rupiah(item.paid_amount)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: item.remaining_amount > 0 ? '#fbbf24' : 'var(--ok)' }}>
                                  {rupiah(item.remaining_amount)}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  {item.remaining_amount <= 0 ? (
                                    <span className="pill pill-ok mono" style={{ fontSize: '10px' }}>LUNAS</span>
                                  ) : item.is_overdue ? (
                                    <span className="pill pill-danger mono" style={{ fontSize: '10px' }}>JATUH TEMPO</span>
                                  ) : (
                                    <span className="pill pill-warn mono" style={{ fontSize: '10px' }}>BELUM LUNAS</span>
                                  )}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  {item.remaining_amount > 0 && (
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => setPayModal({ open: true, item, amount: String(item.remaining_amount), payment_date: getTodayStr(), payment_method: 'CASH', reference_no: '', notes: '' })}
                                      style={{ padding: '3px 8px', fontSize: '11px' }}
                                    >
                                      Cicil / Bayar
                                    </button>
                                  )}
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
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DAFTAR SEMUA NOTA KASBON (RECEIVABLES TABLE DETAIL) */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* TAB 2: DAFTAR SEMUA NOTA KASBON (RECEIVABLES TABLE DETAIL) */}
      {/* ========================================================================= */}
      {activeTab === 'RECEIVABLES' && (
        <>
          {/* Top Selection Banner */}
          {selectedReceivableIds.length > 0 && (
            <div className="card mb-4 fade-in" style={{
              padding: '14px 20px',
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.22) 0%, rgba(79, 70, 229, 0.32) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.45)',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckSquare size={22} color="var(--accent-bright)" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                    Terpilih {selectedUnpaidReceivables.length} Nota Kasbon
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Total sisa tagihan terpilih: <strong style={{ color: '#fbbf24' }}>{rupiah(selectedTotalRemaining)}</strong>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedReceivableIds([])}
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Batal Pilihan
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={openBulkPayFromTableSelection}
                  style={{ fontWeight: 800, padding: '9px 18px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                >
                  <CreditCard size={16} /> Bayar Sekaligus ({selectedUnpaidReceivables.length} Nota)
                </button>
              </div>
            </div>
          )}

          <div className="table-wrap" style={{ width: '100%', overflowX: 'auto', borderRadius: '12px' }}>
            <table style={{ width: '100%', minWidth: '1220px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(23, 28, 56, 0.7)', borderBottom: '1px solid var(--border-strong)' }}>
                  <th style={{ padding: '14px 10px', textAlign: 'center', width: '44px' }}>
                    <input
                      type="checkbox"
                      checked={
                        filteredItems.filter(i => i.remaining_amount > 0).length > 0 &&
                        filteredItems.filter(i => i.remaining_amount > 0).every(i => selectedReceivableIds.includes(i.id))
                      }
                      onChange={toggleSelectAllReceivables}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                      title="Pilih Semua Nota Belum Lunas"
                    />
                  </th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>No. Tagihan & Tanggal</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Pelanggan / Peminjam</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Jatuh Tempo</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right' }}>Total Kasbon</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right' }}>Sudah Dibayar</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right' }}>Sisa Kasbon</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'center' }}>Progress</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'center', width: '220px', minWidth: '220px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-secondary)' }}>
                      <AlertCircle size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>Tidak ada data kasbon yang ditemukan</div>
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>Coba ubah kata kunci pencarian atau filter status di atas</div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => {
                    const isPaid = item.status === 'PAID';
                    const isOverdue = item.is_overdue;
                    const daysRem = item.days_remaining;
                    const pctPaid = item.progress_pct ?? (item.total_amount > 0 ? Math.round((item.paid_amount / item.total_amount) * 100) : 0);
                    const isSelected = selectedReceivableIds.includes(item.id);

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          background: isSelected ? 'rgba(124, 58, 237, 0.12)' : (isOverdue ? 'rgba(239, 68, 68, 0.04)' : undefined),
                          transition: 'background 0.2s ease'
                        }}
                      >
                        {/* Checkbox Column */}
                        <td style={{ padding: '14px 10px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            disabled={isPaid}
                            checked={isSelected}
                            onChange={() => toggleSelectReceivable(item.id)}
                            style={{ width: '16px', height: '16px', cursor: isPaid ? 'not-allowed' : 'pointer', accentColor: 'var(--primary)' }}
                          />
                        </td>
                        {/* Invoice & Date */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{item.receivable_no}</span>
                        </div>
                        <div className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Terbit: {item.issue_date}
                        </div>
                        {item.outlet_name && (
                          <div style={{ fontSize: '10.5px', color: 'var(--primary)', marginTop: '2px' }}>
                            📍 {item.outlet_name}
                          </div>
                        )}
                      </td>

                      {/* Customer Info */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '13.5px' }}>
                          {item.customer_name}
                        </div>
                        {item.customer_phone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#38bdf8', marginTop: '2px' }}>
                            <Phone size={12} />
                            <span>{item.customer_phone}</span>
                            <button
                              onClick={() => openWhatsApp(item)}
                              title="Kirim Pesan WhatsApp"
                              style={{
                                background: 'rgba(34, 197, 94, 0.15)',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                color: '#4ade80',
                                borderRadius: '4px',
                                padding: '1px 6px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <MessageCircle size={10} /> WA
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>No HP: —</div>
                        )}
                        {item.notes && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px', fontStyle: 'italic', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            "{item.notes}"
                          </div>
                        )}
                      </td>

                      {/* Due Date & Countdown */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div className="mono" style={{ fontWeight: 600, color: '#ffffff' }}>
                          {item.due_date}
                        </div>
                        {isPaid ? (
                          <span style={{ fontSize: '11px', color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                            <Check size={11} /> Lunas
                          </span>
                        ) : isOverdue ? (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            color: '#ef4444',
                            background: 'rgba(239, 68, 68, 0.15)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            marginTop: '2px'
                          }}>
                            Lewat {Math.abs(daysRem)} Hari!
                          </span>
                        ) : daysRem === 0 ? (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            color: '#f59e0b',
                            background: 'rgba(245, 158, 11, 0.15)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            marginTop: '2px'
                          }}>
                            ⚡ Jatuh Tempo Hari Ini
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                            Sisa {daysRem} hari
                          </span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap' }}>
                        {rupiah(item.total_amount)}
                      </td>

                      {/* Paid Amount */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--ok)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {rupiah(item.paid_amount)}
                      </td>

                      {/* Remaining Amount */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontWeight: 800,
                          fontSize: '14px',
                          color: isPaid ? 'var(--ok)' : (isOverdue ? '#f87171' : '#fbbf24')
                        }}>
                          {rupiah(item.remaining_amount)}
                        </span>
                      </td>

                      {/* Progress Bar */}
                      <td style={{ padding: '14px 16px', textAlign: 'center', minWidth: '100px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                          <div style={{
                            width: '60px',
                            height: '6px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '3px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${Math.min(pctPaid, 100)}%`,
                              height: '100%',
                              background: isPaid ? '#10b981' : (pctPaid > 0 ? '#38bdf8' : 'transparent'),
                              borderRadius: '3px'
                            }} />
                          </div>
                          <span className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {pctPaid}%
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {isPaid ? (
                          <span className="pill pill-ok mono">LUNAS</span>
                        ) : isOverdue ? (
                          <span className="pill pill-danger mono">JATUH TEMPO</span>
                        ) : item.status === 'PARTIAL' ? (
                          <span className="pill pill-warn mono">SEBAGIAN</span>
                        ) : (
                          <span className="pill pill-muted mono">BELUM BAYAR</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'center', width: '220px', minWidth: '220px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                          {!isPaid && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setPayModal({ open: true, item, amount: String(item.remaining_amount), payment_date: getTodayStr(), payment_method: 'CASH', reference_no: '', notes: '' })}
                              style={{ padding: '5px 10px', fontSize: '11.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                              title="Catat Pembayaran / Cicilan"
                            >
                              <CreditCard size={12} /> Bayar
                            </button>
                          )}

                          <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => setHistoryModal({ open: true, item })}
                            style={{ padding: '6px', height: '30px', width: '30px', flexShrink: 0 }}
                            title="Riwayat Pembayaran & Cicilan"
                          >
                            <Receipt size={13} />
                          </button>

                          <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => setInvoiceModal({ open: true, item })}
                            style={{ padding: '6px', height: '30px', width: '30px', flexShrink: 0 }}
                            title="Cetak Bukti Dokumen Kasbon"
                          >
                            <Printer size={13} />
                          </button>

                          <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => openEditModal(item)}
                            style={{ padding: '6px', height: '30px', width: '30px', flexShrink: 0 }}
                            title="Edit Data Kasbon"
                          >
                            <Edit3 size={13} />
                          </button>

                          <button
                            className="btn btn-danger btn-icon"
                            onClick={() => handleDelete(item)}
                            style={{ padding: '6px', height: '30px', width: '30px', flexShrink: 0 }}
                            title="Hapus Kasbon"
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
      </>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RIWAYAT PEMBAYARAN & CICILAN (PAYMENT LOGS HISTORY) */}
      {/* ========================================================================= */}
      {activeTab === 'PAYMENTS' && (
        <div className="table-wrap fade-in" style={{ width: '100%', overflowX: 'auto', borderRadius: '12px' }}>
          <table style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(23, 28, 56, 0.7)', borderBottom: '1px solid var(--border-strong)' }}>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>No. Pembayaran & Tanggal</th>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>Pelanggan / Peminjam</th>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>No. Nota Kasbon</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'center' }}>Metode</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right' }}>Nominal Dibayar</th>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>Kasir / Penerima</th>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>Keterangan / Ref</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'center', width: '100px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredPaymentLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-secondary)' }}>
                    <History size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>Belum Ada Riwayat Pembayaran</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Catatan pelunasan atau cicilan kasbon yang diterima akan muncul di sini</div>
                  </td>
                </tr>
              ) : (
                filteredPaymentLogs.map(log => (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    {/* Payment No & Date */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <div className="mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {log.payment_no || `PAY-${log.id}`}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        📅 {log.payment_date || log.created_at}
                      </div>
                    </td>

                    {/* Customer */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#ffffff' }}>
                        {log.customer_name}
                      </div>
                      {log.customer_phone && (
                        <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '2px' }}>
                          📞 {log.customer_phone}
                        </div>
                      )}
                    </td>

                    {/* Receivable No */}
                    <td style={{ padding: '14px 16px' }}>
                      <div className="mono" style={{ fontWeight: 600, color: '#ffffff' }}>
                        {log.receivable_no}
                      </div>
                    </td>

                    {/* Method */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span className="pill pill-neutral mono" style={{ fontSize: '11px', fontWeight: 700 }}>
                        {log.payment_method || 'CASH'}
                      </span>
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 900, color: 'var(--ok)', fontSize: '14px' }}>
                      + {rupiah(log.amount)}
                    </td>

                    {/* Receiver */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '12.5px', color: '#ffffff' }}>
                        {log.receiver?.name || 'Kasir'}
                      </div>
                    </td>

                    {/* Ref / Notes */}
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {log.reference_no && <div style={{ fontWeight: 600, color: '#ffffff' }}>Ref: {log.reference_no}</div>}
                      {log.notes ? <span>{log.notes}</span> : <span>-</span>}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button
                        className="btn btn-danger btn-icon"
                        onClick={() => handleDeletePayment(log.receivable_id, log.id)}
                        style={{ padding: '5px', height: '28px', width: '28px' }}
                        title="Hapus / Batal Catatan Pembayaran Ini"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: AR MERCHANT (QRIS & E-COMMERCE) */}
      {/* ========================================================================= */}
      {activeTab === 'AR_MERCHANT' && (
        <div className="card fade-in" style={{ padding: '24px', borderRadius: '16px' }}>
          {/* Sub-filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {[
              { key: 'ALL', label: 'Semua', icon: <Layers size={13} /> },
              { key: 'QRIS', label: 'QRIS', icon: <QrCode size={13} /> },
              { key: 'ECOMMERCE', label: 'E-Commerce', icon: <ShoppingCart size={13} /> },
              { key: 'UNSETTLED', label: 'Belum Cair', icon: <Clock size={13} />, color: '#ef4444' },
              { key: 'SETTLED', label: 'Sudah Cair', icon: <CheckCircle2 size={13} />, color: '#22c55e' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => { setMerchantFilter(f.key); setSelectedMerchantIds([]); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: merchantFilter === f.key ? '2px solid' : '1px solid var(--border)',
                  borderColor: merchantFilter === f.key ? (f.color || 'var(--primary)') : 'var(--border)',
                  background: merchantFilter === f.key
                    ? `${f.color || 'var(--primary)'}22`
                    : 'transparent',
                  color: merchantFilter === f.key ? (f.color || 'var(--primary)') : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                }}
              >
                {f.icon} {f.label}
              </button>
            ))}

            <button
              onClick={fetchMerchantData}
              disabled={merchantLoading}
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 'auto', fontSize: '12px', gap: '6px' }}
            >
              <RefreshCw size={13} className={merchantLoading ? 'spin' : ''} /> Refresh
            </button>
          </div>

          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.08))',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '12px', padding: '16px',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>Total Gross</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#818cf8' }}>
                {Number(merchantSummary.total_gross || 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.08))',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px', padding: '16px',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>Total MDR Fee</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#f87171' }}>
                -{Number(merchantSummary.total_mdr || 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.08))',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '12px', padding: '16px',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>Net Amount</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#4ade80' }}>
                {Number(merchantSummary.total_net || 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(217, 119, 6, 0.08))',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: '12px', padding: '16px',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>Belum Cair</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#fbbf24' }}>
                {Number(merchantSummary.unsettled_count || 0)} trx
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {Number(merchantSummary.unsettled_amount || 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.08))',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '12px', padding: '16px',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>Sudah Cair</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#22c55e' }}>
                {Number(merchantSummary.settled_count || 0)} trx
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {Number(merchantSummary.settled_amount || 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          {/* Data Table */}
          {merchantLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
              <RefreshCw size={28} className="spin" style={{ marginBottom: '12px', color: 'var(--primary)' }} />
              <div style={{ fontSize: '13px' }}>Memuat data AR Merchant...</div>
            </div>
          ) : filteredMerchantRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
              <Landmark size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <div style={{ fontSize: '14px', fontWeight: 700 }}>Belum ada data AR Merchant</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Data AR Merchant otomatis tercatat dari transaksi penjualan dengan metode QRIS atau E-Commerce.
              </div>
            </div>
          ) : (
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.04)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '40px' }}>
                      <button
                        onClick={toggleSelectAllMerchants}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px' }}
                        title="Pilih Semua Belum Cair"
                      >
                        {filteredMerchantRows.filter(r => r.settlement_status !== 'SETTLED').length > 0 &&
                         filteredMerchantRows.filter(r => r.settlement_status !== 'SETTLED').every(r => selectedMerchantIds.includes(r.id))
                          ? <CheckSquare size={16} style={{ color: 'var(--primary)' }} />
                          : <Square size={16} />}
                      </button>
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tanggal / Nota</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Channel</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Merchant / Provider</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gross (Rp)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MDR %</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MDR Fee</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Net Amount</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMerchantRows.map((row, idx) => {
                    const isQris = row.ar_type === 'MERCHANT_QRIS';
                    const isSettled = row.settlement_status === 'SETTLED';
                    const isSelected = selectedMerchantIds.includes(row.id);
                    return (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          background: isSelected ? 'rgba(99, 102, 241, 0.08)' : (idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'),
                          opacity: isSettled ? 0.6 : 1,
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {!isSettled ? (
                            <button
                              onClick={() => toggleSelectMerchant(row.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: isSelected ? 'var(--primary)' : 'var(--text-secondary)', padding: '2px' }}
                            >
                              {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                            </button>
                          ) : (
                            <CheckCircle2 size={14} style={{ color: '#22c55e' }} />
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '12.5px' }}>
                            {row.issue_date || '-'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {row.order_number || row.receivable_no || '-'}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                            background: isQris
                              ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))'
                              : 'linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(234, 88, 12, 0.2))',
                            color: isQris ? '#a5b4fc' : '#fdba74',
                            border: `1px solid ${isQris ? 'rgba(99, 102, 241, 0.4)' : 'rgba(249, 115, 22, 0.4)'}`,
                          }}>
                            {isQris ? <QrCode size={11} /> : <ShoppingCart size={11} />}
                            {isQris ? 'QRIS' : 'E-Com'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#ffffff' }}>
                          {row.merchant_channel || '-'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>
                          {Number(row.total_amount || 0).toLocaleString('id-ID')}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          {row.mdr_rate != null ? `${Number(row.mdr_rate).toFixed(1)}%` : '-'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#f87171', fontWeight: 600 }}>
                          -{Number(row.mdr_fee || 0).toLocaleString('id-ID')}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#4ade80' }}>
                          {Number(row.net_amount || row.remaining_amount || 0).toLocaleString('id-ID')}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {isSettled ? (
                            <span className="pill pill-ok" style={{ fontSize: '10px', fontWeight: 700, gap: '4px' }}>
                              <CheckCircle2 size={11} /> Cair
                            </span>
                          ) : (
                            <span className="pill pill-warning" style={{ fontSize: '10px', fontWeight: 700, gap: '4px' }}>
                              <Clock size={11} /> Pending
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {!isSettled && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: '11px', padding: '4px 10px', gap: '4px' }}
                              onClick={() => setSettleModal({
                                open: true, mode: 'single', items: [row],
                                settlement_bank: '', settlement_ref: '', settled_at: getTodayStr(),
                              })}
                              title="Cairkan AR ini"
                            >
                              <ArrowDownToLine size={12} /> Cairkan
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bulk Settlement Floating Action Bar */}
          {selectedMerchantIds.length > 0 && (
            <div style={{
              position: 'sticky', bottom: '12px',
              background: 'linear-gradient(135deg, var(--primary), #7c3aed)',
              borderRadius: '14px', padding: '12px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: '16px', boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
              animation: 'fadeInUp 0.3s ease',
            }}>
              <div style={{ color: '#ffffff', fontSize: '13px', fontWeight: 700 }}>
                <CheckSquare size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                {selectedMerchantIds.length} transaksi dipilih
                <span style={{ marginLeft: '12px', opacity: 0.8 }}>
                  Total Net: {
                    merchantAllRows
                      .filter(r => selectedMerchantIds.includes(r.id))
                      .reduce((sum, r) => sum + Number(r.net_amount || r.remaining_amount || 0), 0)
                      .toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })
                  }
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#ffffff', fontSize: '12px', borderColor: 'rgba(255,255,255,0.3)' }}
                  onClick={() => setSelectedMerchantIds([])}
                >
                  Batal
                </button>
                <button
                  className="btn btn-sm"
                  style={{
                    background: '#ffffff', color: 'var(--primary)', fontWeight: 800,
                    fontSize: '12px', gap: '6px', border: 'none',
                  }}
                  onClick={() => {
                    const selectedRows = merchantAllRows.filter(r => selectedMerchantIds.includes(r.id) && r.settlement_status !== 'SETTLED');
                    if (selectedRows.length === 0) return;
                    setSettleModal({
                      open: true, mode: 'bulk', items: selectedRows,
                      settlement_bank: '', settlement_ref: '', settled_at: getTodayStr(),
                    });
                  }}
                >
                  <ArrowDownToLine size={13} /> Cairkan Masal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SETTLEMENT / PENCAIRAN AR MERCHANT */}
      {/* ========================================================================= */}
      {settleModal.open && (
        <div className="modal-backdrop fade-in" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card modal-content" style={{
            maxWidth: '520px', width: '100%', maxHeight: '90vh',
            overflowY: 'auto', padding: '24px', borderRadius: '16px'
          }}>
            <div className="flex-between mb-4">
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowDownToLine size={18} style={{ color: '#a855f7' }} />
                {settleModal.mode === 'bulk'
                  ? `Pencairan Masal (${settleModal.items.length} trx)`
                  : 'Pencairan AR Merchant'}
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setSettleModal(s => ({ ...s, open: false }))}>
                <X size={16} />
              </button>
            </div>

            {/* Settlement Summary */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(99, 102, 241, 0.08))',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '12px', padding: '16px', marginBottom: '20px',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>Jumlah Trx</div>
                  <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '16px' }}>{settleModal.items.length}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>Total Gross</div>
                  <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '14px' }}>
                    {settleModal.items.reduce((s, r) => s + Number(r.total_amount || 0), 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>Total MDR</div>
                  <div style={{ color: '#f87171', fontWeight: 800, fontSize: '14px' }}>
                    -{settleModal.items.reduce((s, r) => s + Number(r.mdr_fee || 0), 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>Net Diterima</div>
                  <div style={{ color: '#4ade80', fontWeight: 900, fontSize: '16px' }}>
                    {settleModal.items.reduce((s, r) => s + Number(r.net_amount || r.remaining_amount || 0), 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSettleMerchant}>
              <div className="form-group mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  <Building2 size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Bank Penerima (Masuk ke Rekening)
                </label>
                <select
                  className="form-control"
                  value={settleModal.settlement_bank}
                  onChange={e => setSettleModal(s => ({ ...s, settlement_bank: e.target.value }))}
                  required
                >
                  <option value="">-- Pilih Rekening Bank --</option>
                  {bankAccounts.map(ba => (
                    <option key={ba.id} value={ba.account_name || ba.bank_name}>
                      {ba.bank_name} - {ba.account_name} ({ba.account_number})
                    </option>
                  ))}
                  <option value="__manual__">Input Manual...</option>
                </select>
                {settleModal.settlement_bank === '__manual__' && (
                  <input
                    type="text"
                    className="form-control mt-2"
                    placeholder="Nama bank / rekening tujuan"
                    value={settleModal._manual_bank || ''}
                    onChange={e => setSettleModal(s => ({ ...s, _manual_bank: e.target.value, settlement_bank: e.target.value || '__manual__' }))}
                    required
                  />
                )}
              </div>

              <div className="grid-2 gap-3 mb-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    No. Referensi Settlement
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Opsional, No. mutasi / ref"
                    value={settleModal.settlement_ref}
                    onChange={e => setSettleModal(s => ({ ...s, settlement_ref: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Tanggal Pencairan
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={settleModal.settled_at}
                    onChange={e => setSettleModal(s => ({ ...s, settled_at: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSettleModal(s => ({ ...s, open: false }))}>
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !settleModal.settlement_bank || settleModal.settlement_bank === '__manual__'}
                  style={{ gap: '6px' }}
                >
                  {submitting ? <RefreshCw size={14} className="spin" /> : <ArrowDownToLine size={14} />}
                  {settleModal.mode === 'bulk' ? 'Cairkan Semua' : 'Cairkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: TAMBAH / EDIT KASBON BARU */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div className="modal-backdrop fade-in" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card modal-content" style={{
            maxWidth: '560px', width: '100%', maxHeight: '90vh',
            overflowY: 'auto', padding: '24px', borderRadius: '16px'
          }}>
            <div className="flex-between mb-4">
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={18} style={{ color: 'var(--primary)' }} />
                {form.id ? 'Edit Data Tagihan Kasbon' : 'Catat Kasbon Pelanggan Baru'}
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setCreateModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveReceivable}>
              {/* Master Customer Selector */}
              {masterCustomers.length > 0 && !form.id && (
                <div className="form-group mb-3">
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Pilih Dari Master Pelanggan (Opsional)
                  </label>
                  <select
                    className="form-control"
                    value={form.customer_id}
                    onChange={e => handleSelectCustomerInForm(e.target.value)}
                  >
                    <option value="">-- Pelanggan Baru / Input Manual --</option>
                    {masterCustomers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid-2 gap-3 mb-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Nama Pelanggan <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Pak Paksi / Ibu Maya"
                    value={form.customer_name}
                    onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    No. WhatsApp / HP
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="0812xxxxxxxx"
                    value={form.customer_phone}
                    onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Alamat / Instansi Pelanggan
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Alamat / lokasi (opsional)"
                  value={form.customer_address}
                  onChange={e => setForm(f => ({ ...f, customer_address: e.target.value }))}
                />
              </div>

              <div className="grid-2 gap-3 mb-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Tanggal Terbit Kasbon <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control mono"
                    value={form.issue_date}
                    onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Tanggal Jatuh Tempo <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control mono"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid-2 gap-3 mb-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Total Nominal Kasbon (Rp) <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="number"
                    className="form-control mono"
                    placeholder="0"
                    value={form.total_amount}
                    onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                    required={!form.id}
                    disabled={!!form.id}
                  />
                </div>

                {!form.id && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                      Uang Muka / DP Awal (Rp)
                    </label>
                    <input
                      type="number"
                      className="form-control mono"
                      placeholder="0 (opsional)"
                      value={form.initial_paid}
                      onChange={e => setForm(f => ({ ...f, initial_paid: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              <div className="form-group mb-4">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Catatan / Rincian Pesanan Kasbon
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Contoh: Kasbon katering rapat 30 porsi nasi kotak"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Menyimpan...' : (form.id ? 'Simpan Perubahan' : 'Catat Kasbon')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: PEMBAYARAN SEKALIGUS BEBERAPA TRANSAKSI (BULK PAYMENT MODAL) */}
      {/* ========================================================================= */}
      {bulkPayModal.open && bulkPayModal.customerGroup && (
        <div className="modal-backdrop fade-in" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card modal-content" style={{
            maxWidth: '680px', width: '100%', maxHeight: '90vh',
            overflowY: 'auto', padding: '24px', borderRadius: '16px'
          }}>
            <div className="flex-between mb-3">
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} style={{ color: 'var(--primary)' }} />
                Pelunasan Kasbon Sekaligus: {bulkPayModal.customerGroup.customer_name}
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setBulkPayModal(prev => ({ ...prev, open: false }))}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Pelanggan ini memiliki <strong style={{ color: '#ffffff' }}>{bulkPayModal.customerGroup.unpaid_count} nota kasbon belum lunas</strong> dengan total sisa hutang <strong style={{ color: '#fbbf24' }}>{rupiah(bulkPayModal.customerGroup.total_remaining)}</strong>. Anda dapat melunasi sekaligus atau sebagian.
            </p>

            <form onSubmit={handleBulkPaymentSubmit}>
              {/* Table of Unpaid Items with Checkboxes */}
              <div style={{ marginBottom: '18px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Pilih Nota Kasbon Yang Ingin Dibayar:</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Terpilih: {bulkPayModal.selectedIds.length} dari {bulkPayModal.customerGroup.unpaid_items.length} nota
                  </span>
                </div>

                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '6px', textAlign: 'center', width: '36px' }}>Pilih</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>No. Invoice</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Terbit</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Total Tagihan</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Sisa Kasbon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPayModal.customerGroup.unpaid_items.map(item => {
                        const isChecked = bulkPayModal.selectedIds.includes(item.id);
                        return (
                          <tr
                            key={item.id}
                            onClick={() => toggleBulkPayItem(item.id)}
                            style={{
                              cursor: 'pointer',
                              background: isChecked ? 'rgba(59, 130, 246, 0.1)' : undefined,
                              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                            }}
                          >
                            <td style={{ padding: '6px', textAlign: 'center' }}>
                              {isChecked ? <CheckSquare size={16} color="var(--primary)" /> : <Square size={16} color="var(--text-muted)" />}
                            </td>
                            <td style={{ padding: '6px 10px', fontWeight: 700, color: '#ffffff' }}>{item.receivable_no}</td>
                            <td style={{ padding: '6px 10px' }}>{item.issue_date}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>{rupiah(item.total_amount)}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#fbbf24' }}>{rupiah(item.remaining_amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Amount & Payment Method */}
              <div className="grid-2 gap-3 mb-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Nominal Pelunasan Diterima (Rp) <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="number"
                    className="form-control mono"
                    placeholder="0"
                    value={bulkPayModal.amount}
                    onChange={e => setBulkPayModal(prev => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Pembayaran akan didistribusikan dari nota kasbon yang paling lama.
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Metode Pembayaran <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select
                    className="form-control"
                    value={bulkPayModal.payment_method}
                    onChange={e => setBulkPayModal(prev => ({ ...prev, payment_method: e.target.value }))}
                  >
                    <option value="CASH">CASH (Tunai Kasir)</option>
                    <option value="QRIS">QRIS / E-Wallet</option>
                    <option value="TRANSFER">Bank Transfer</option>
                    <option value="DEBIT">Kartu Debit / Kredit</option>
                  </select>
                </div>
              </div>

              <div className="grid-2 gap-3 mb-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Tanggal Pembayaran <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control mono"
                    value={bulkPayModal.payment_date}
                    onChange={e => setBulkPayModal(prev => ({ ...prev, payment_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Nomor Referensi / Struk
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="No. Ref Transfer / Struk (opsional)"
                    value={bulkPayModal.reference_no}
                    onChange={e => setBulkPayModal(prev => ({ ...prev, reference_no: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group mb-4">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Catatan Pelunasan Sekaligus
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: Lunas transfer via BCA oleh Pak Paksi"
                  value={bulkPayModal.notes}
                  onChange={e => setBulkPayModal(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setBulkPayModal(prev => ({ ...prev, open: false }))}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Memproses...' : 'Proses Pelunasan Sekaligus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CATAT PEMBAYARAN / CICILAN NOTA TUNGGAL */}
      {/* ========================================================================= */}
      {payModal.open && payModal.item && (
        <div className="modal-backdrop fade-in" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card modal-content" style={{
            maxWidth: '500px', width: '100%', padding: '24px', borderRadius: '16px'
          }}>
            <div className="flex-between mb-3">
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} style={{ color: 'var(--ok)' }} />
                Pembayaran / Cicilan Kasbon
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setPayModal({ open: false, item: null, amount: '', payment_date: getTodayStr(), payment_method: 'CASH', reference_no: '', notes: '' })}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '12.5px' }}>
              <div>Pelanggan: <strong style={{ color: '#ffffff' }}>{payModal.item.customer_name}</strong></div>
              <div>No. Invoice: <span className="mono" style={{ color: 'var(--primary)' }}>{payModal.item.receivable_no}</span></div>
              <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Sisa Kasbon:</span>
                <span style={{ color: '#fbbf24', fontSize: '14px' }}>{rupiah(payModal.item.remaining_amount)}</span>
              </div>
            </div>

            <form onSubmit={handleAddPayment}>
              <div className="form-group mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Nominal Pembayaran Diterima (Rp) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  className="form-control mono"
                  placeholder="0"
                  value={payModal.amount}
                  onChange={e => setPayModal(p => ({ ...p, amount: e.target.value }))}
                  required
                />
              </div>

              <div className="grid-2 gap-3 mb-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Tanggal Pembayaran <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control mono"
                    value={payModal.payment_date}
                    onChange={e => setPayModal(p => ({ ...p, payment_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Metode Pembayaran <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select
                    className="form-control"
                    value={payModal.payment_method}
                    onChange={e => setPayModal(p => ({ ...p, payment_method: e.target.value }))}
                  >
                    <option value="CASH">CASH (Tunai)</option>
                    <option value="QRIS">QRIS / E-Wallet</option>
                    <option value="TRANSFER">Bank Transfer</option>
                    <option value="DEBIT">Kartu Debit / Kredit</option>
                  </select>
                </div>
              </div>

              <div className="form-group mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Nomor Referensi / Bank
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="No. Ref Transfer (opsional)"
                  value={payModal.reference_no}
                  onChange={e => setPayModal(p => ({ ...p, reference_no: e.target.value }))}
                />
              </div>

              <div className="form-group mb-4">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Catatan Pembayaran
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Keterangan cicilan (opsional)"
                  value={payModal.notes}
                  onChange={e => setPayModal(p => ({ ...p, notes: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPayModal({ open: false, item: null, amount: '', payment_date: getTodayStr(), payment_method: 'CASH', reference_no: '', notes: '' })}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: RIWAYAT PEMBAYARAN & CICILAN */}
      {/* ========================================================================= */}
      {historyModal.open && historyModal.item && (
        <div className="modal-backdrop fade-in" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card modal-content" style={{
            maxWidth: '600px', width: '100%', maxHeight: '90vh',
            overflowY: 'auto', padding: '24px', borderRadius: '16px'
          }}>
            <div className="flex-between mb-3">
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={18} style={{ color: 'var(--primary)' }} />
                Riwayat Pembayaran Kasbon: {historyModal.item.receivable_no}
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setHistoryModal({ open: false, item: null })}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '12.5px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div>Pelanggan: <strong style={{ color: '#ffffff' }}>{historyModal.item.customer_name}</strong></div>
                <div>Total Kasbon: <strong style={{ color: '#ffffff' }}>{rupiah(historyModal.item.total_amount)}</strong></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>Sudah Dibayar: <strong style={{ color: 'var(--ok)' }}>{rupiah(historyModal.item.paid_amount)}</strong></div>
                <div>Sisa Kasbon: <strong style={{ color: '#fbbf24' }}>{rupiah(historyModal.item.remaining_amount)}</strong></div>
              </div>
            </div>

            <div className="table-wrap mb-4">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>No. Pembayaran</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Tanggal</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Metode</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Jumlah (Rp)</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(!historyModal.item.payments || historyModal.item.payments.length === 0) ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                        Belum ada riwayat pembayaran / cicilan tercatat
                      </td>
                    </tr>
                  ) : (
                    historyModal.item.payments.map(pay => (
                      <tr key={pay.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#ffffff' }}>{pay.payment_no}</td>
                        <td style={{ padding: '8px 10px' }}>{pay.payment_date}</td>
                        <td style={{ padding: '8px 10px' }}>{pay.payment_method}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--ok)' }}>{rupiah(pay.amount)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <button
                            className="btn btn-danger btn-icon"
                            onClick={() => handleDeletePayment(historyModal.item.id, pay.id)}
                            style={{ padding: '4px', height: '26px', width: '26px' }}
                            title="Batalkan & Hapus Pembayaran Ini"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setHistoryModal({ open: false, item: null })}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CETAK BUKTI KASBON CUSTOMER */}
      {/* ========================================================================= */}
      {invoiceModal.open && invoiceModal.item && (
        <div className="modal-backdrop fade-in" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card modal-content" style={{
            maxWidth: '600px', width: '100%', maxHeight: '90vh',
            overflowY: 'auto', padding: '24px', borderRadius: '16px'
          }}>
            <div className="flex-between mb-4">
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} style={{ color: 'var(--primary)' }} />
                Dokumen Bukti Kasbon Customer
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary btn-sm" onClick={handlePrintInvoice}>
                  <Printer size={14} /> Cetak
                </button>
                <button className="btn btn-ghost btn-icon" onClick={() => setInvoiceModal({ open: false, item: null })}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Print Area */}
            <div id="printable-invoice-document" style={{
              background: '#ffffff', color: '#1e293b', padding: '24px', borderRadius: '12px', fontSize: '13px'
            }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a' }}>{businessName}</div>
                <div style={{ fontSize: '12px', color: '#475569' }}>{invoiceModal.item.outlet_name || outletName}</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '8px', color: '#0284c7' }}>
                  BUKTI SURAT KASBON CUSTOMER
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '12px' }}>
                <div>
                  <div><strong>Kepada Yth:</strong> {invoiceModal.item.customer_name}</div>
                  {invoiceModal.item.customer_phone && <div><strong>No. HP/WA:</strong> {invoiceModal.item.customer_phone}</div>}
                  {invoiceModal.item.customer_address && <div><strong>Alamat:</strong> {invoiceModal.item.customer_address}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div><strong>No. Invoice:</strong> {invoiceModal.item.receivable_no}</div>
                  <div><strong>Tanggal Terbit:</strong> {invoiceModal.item.issue_date}</div>
                  <div><strong>Jatuh Tempo:</strong> <span style={{ color: '#dc2626', fontWeight: 700 }}>{invoiceModal.item.due_date}</span></div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Deskripsi / Catatan Pesanan</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Total Kasbon</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0' }}>
                      {invoiceModal.item.notes || 'Pengambilan barang/pesanan kasbon pelanggan'}
                      {invoiceModal.item.order_number && <div style={{ fontSize: '11px', color: '#64748b' }}>Order Ref: #{invoiceModal.item.order_number}</div>}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>
                      {rupiah(invoiceModal.item.total_amount)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                <div style={{ width: '220px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span>Total Tagihan:</span>
                    <span>{rupiah(invoiceModal.item.total_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#16a34a' }}>
                    <span>Telah Dibayar:</span>
                    <span>{rupiah(invoiceModal.item.paid_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '2px solid #0f172a', fontWeight: 800, fontSize: '14px', color: '#dc2626' }}>
                    <span>Sisa Kasbon:</span>
                    <span>{rupiah(invoiceModal.item.remaining_amount)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', textAlign: 'center', fontSize: '11px', color: '#475569' }}>
                <div>
                  <div>Pelanggan / Peminjam</div>
                  <div style={{ marginTop: '40px', fontWeight: 700 }}>({invoiceModal.item.customer_name})</div>
                </div>
                <div>
                  <div>Kasir / Management</div>
                  <div style={{ marginTop: '40px', fontWeight: 700 }}>({currentUser?.name || 'Kasir PIC'})</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ImportMasterModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        targetMaster="RECEIVABLE"
        onSuccess={() => {
          fetchData();
        }}
      />

      {/* Printable Report Document for LAPORAN PIUTANG CUSTOMER */}
      <div id="printable-receivables-report" style={{ display: 'none' }}>
        <div style={{ padding: 15, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", color: '#000000' }}>
          <div style={{ borderBottom: '2px solid #000000', paddingBottom: 10, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 900 }}>
              {businessName}
            </h2>
            <div style={{ fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
              LAPORAN PIUTANG CUSTOMER
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              Cabang: {outletName} | Dicetak: {new Date().toLocaleString('id-ID')}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, margin: '8px 0' }}>
            <thead>
              <tr style={{ background: '#f4f4f4', borderBottom: '1px solid #000' }}>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'center' }}>No.</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Customer</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Tanggal</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Jam</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>No.Penjualan</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Piutang</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Dibayar</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Sisa Piutang</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Usia Piutang</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Jatuh Tempo</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it, idx) => {
                const issueTs = new Date(it.issue_date).getTime();
                const nowTs = new Date().getTime();
                const diffDays = Math.max(0, Math.floor((nowTs - issueTs) / (1000 * 60 * 60 * 24)));
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 'bold' }}>{it.customer_name || 'Walk-in Customer'}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.issue_date || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.created_at ? it.created_at.substring(11, 16) : '00:00'}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.order_number || it.receivable_no || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{Number(it.total_amount).toLocaleString('id-ID')}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{Number(it.paid_amount).toLocaleString('id-ID')}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{Number(it.remaining_amount).toLocaleString('id-ID')}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{diffDays} Hari</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.due_date || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 900, background: '#f4f4f4', borderTop: '2px solid #000' }}>
                <td colSpan={7} style={{ border: '1px solid #000', padding: '6px 8px' }}>Total Piutang</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>
                  {Number(stats?.total_remaining || 0).toLocaleString('id-ID')}
                </td>
                <td colSpan={2} style={{ border: '1px solid #000', padding: '6px 8px' }}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
