import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  CreditCard,
  Wallet,
  Scale,
  DollarSign,
  ArrowUpDown,
  ExternalLink,
  Filter,
  Eye,
  Layers,
  ChevronUp,
  Plus,
  Edit2,
  Trash2,
  Power,
  Shield,
  Building,
  Check,
  X,
  Sliders,
  Tag,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  CheckSquare,
  Square,
  Lock,
  Unlock,
} from 'lucide-react';
import api from '../api/client';
import { rupiah, LoadingState, PageHeader } from '../components/ui';
import { getTodayStr, getMonthStartStr, getMonthEndStr } from '../utils/date';
import { useOutlet } from '../context/OutletContext';
import {
  exportJournalLedgerToExcel,
  exportAccountTransactionsToExcel,
  printJournalLedgerReport,
  formatIndoPeriod,
} from '../utils/exportReport';
import JournalVoucherModal from '../components/JournalVoucherModal';
import ReportPreviewModal from '../components/ReportPreviewModal';
import { confirmDialog } from '../utils/swal';
import toast from 'react-hot-toast';

export default function JournalLedger() {
  const {
    activeOutletId,
    activeOutlet,
    currentBusiness,
    dateFrom,
    dateTo,
    dateRange,
    isOwnerBisnis,
    isPlatformAdmin,
    isOwnerWebsite,
    isOwnerOutlet,
    isPegawai,
    userBusinessName,
  } = useOutlet();

  const canManageAccounts = isOwnerBisnis || isPlatformAdmin || isOwnerWebsite;

  const effectiveDateFrom = dateFrom || dateRange?.from || getMonthStartStr();
  const effectiveDateTo = dateTo || dateRange?.to || getMonthEndStr();

  // Top Tab: 'ledger' | 'coa'
  const [mainTab, setMainTab] = useState('ledger');

  // Ledger Tab State
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [ledgerData, setLedgerData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('ALL');
  const [expandedAccounts, setExpandedAccounts] = useState({});

  // Level 3 Drill Down Voucher Modal state
  const [voucherModal, setVoucherModal] = useState({
    isOpen: false,
    journalId: null,
    entryNo: null,
  });

  // Master COA State
  const [masterAccounts, setMasterAccounts] = useState([]);
  const [masterSummary, setMasterSummary] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    system: 0,
    custom: 0,
  });
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [masterSearch, setMasterSearch] = useState('');
  const [masterTypeFilter, setMasterTypeFilter] = useState('ALL');
  const [masterCategoryFilter, setMasterCategoryFilter] = useState('ALL');
  const [masterStatusFilter, setMasterStatusFilter] = useState('ALL');
  const [masterOriginFilter, setMasterOriginFilter] = useState('ALL'); // 'ALL' | 'system' | 'custom'

  // Account Modal State
  const [accountModal, setAccountModal] = useState({
    open: false,
    mode: 'create', // 'create' | 'edit'
    account: null,
    loading: false,
  });

  const [accountForm, setAccountForm] = useState({
    code: '',
    name: '',
    type: 'EXPENSE',
    category: 'OPEX',
    normal_balance: 'DEBIT',
    description: '',
    is_active: true,
  });

  // Fetch Ledger Overview (Level 1: COA Grouped Balances)
  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        from: effectiveDateFrom,
        to: effectiveDateTo,
      };
      if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
        params.outlet_id = activeOutletId;
      }

      const res = await api.get('/accounting/ledger', { params });
      setLedgerData(res.data);
    } catch (err) {
      console.error('Gagal mengambil data buku besar:', err);
      toast.error('Gagal memuat data buku besar');
    } finally {
      setLoading(false);
    }
  }, [effectiveDateFrom, effectiveDateTo, activeOutletId]);

  // Fetch Master Accounts for Business
  const fetchMasterAccounts = useCallback(async () => {
    setLoadingMaster(true);
    try {
      const res = await api.get('/accounting/accounts');
      setMasterAccounts(res.data.accounts || []);
      setMasterSummary(
        res.data.summary || { total: 0, active: 0, inactive: 0, system: 0, custom: 0 }
      );
    } catch (err) {
      console.error('Gagal memuat master akun:', err);
      toast.error('Gagal memuat daftar master akun');
    } finally {
      setLoadingMaster(false);
    }
  }, []);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  useEffect(() => {
    if (mainTab === 'coa') {
      fetchMasterAccounts();
    }
  }, [mainTab, fetchMasterAccounts]);

  // Sync historical journals on demand
  const handleSyncJournals = async () => {
    setSyncing(true);
    const toastId = toast.loading('Melakukan sinkronisasi posting jurnal berpasangan...');
    try {
      const res = await api.post('/accounting/sync-journals');
      toast.success(res.data?.message || 'Sinkronisasi jurnal berhasil diselesaikan!', { id: toastId });
      await Promise.all([fetchLedger(), fetchMasterAccounts()]);
    } catch (err) {
      console.error('Sync journals error:', err);
      toast.error('Gagal melakukan sinkronisasi jurnal', { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  // Toggle Account Transactions (Level 2: Fetch and Expand transactions for an account)
  const toggleAccountExpand = async (code) => {
    const isCurrentlyOpen = Boolean(expandedAccounts[code]?.open);

    if (isCurrentlyOpen) {
      setExpandedAccounts((prev) => ({
        ...prev,
        [code]: {
          ...prev[code],
          open: false,
        },
      }));
      return;
    }

    setExpandedAccounts((prev) => ({
      ...prev,
      [code]: {
        loading: true,
        data: prev[code]?.data || null,
        open: true,
      },
    }));

    try {
      const params = {
        from: effectiveDateFrom,
        to: effectiveDateTo,
      };
      if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
        params.outlet_id = activeOutletId;
      }

      const res = await api.get(`/accounting/ledger/${code}`, { params });
      setExpandedAccounts((prev) => ({
        ...prev,
        [code]: {
          loading: false,
          data: res.data,
          open: true,
        },
      }));
    } catch (err) {
      console.error(`Gagal memuat transaksi akun ${code}:`, err);
      toast.error(`Gagal memuat mutasi akun ${code}`);
      setExpandedAccounts((prev) => ({
        ...prev,
        [code]: {
          loading: false,
          data: null,
          open: false,
        },
      }));
    }
  };

  // Expand all / Collapse all helper
  const handleToggleExpandAll = async () => {
    if (!ledgerData?.groups) return;

    const allAccounts = [];
    ledgerData.groups.forEach((g) => {
      (g.accounts || []).forEach((a) => allAccounts.push(a.code));
    });

    const anyOpen = Object.values(expandedAccounts).some((item) => item.open);

    if (anyOpen) {
      const closed = {};
      Object.keys(expandedAccounts).forEach((k) => {
        closed[k] = { ...expandedAccounts[k], open: false };
      });
      setExpandedAccounts(closed);
    } else {
      toast.loading('Membuka seluruh mutasi akun...', { id: 'expand-all' });
      const nextState = { ...expandedAccounts };

      for (const code of allAccounts) {
        nextState[code] = {
          loading: !nextState[code]?.data,
          data: nextState[code]?.data || null,
          open: true,
        };
      }
      setExpandedAccounts(nextState);

      try {
        const fetchPromises = allAccounts.map(async (code) => {
          if (!expandedAccounts[code]?.data) {
            const params = {
              from: effectiveDateFrom,
              to: effectiveDateTo,
            };
            if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
              params.outlet_id = activeOutletId;
            }
            const res = await api.get(`/accounting/ledger/${code}`, { params });
            return { code, data: res.data };
          }
          return null;
        });

        const results = await Promise.all(fetchPromises);
        setExpandedAccounts((prev) => {
          const updated = { ...prev };
          results.forEach((item) => {
            if (item) {
              updated[item.code] = {
                loading: false,
                data: item.data,
                open: true,
              };
            }
          });
          return updated;
        });
        toast.success('Seluruh buku besar berhasil dimuat', { id: 'expand-all' });
      } catch (err) {
        console.error('Gagal expand all:', err);
        toast.error('Beberapa mutasi gagal dimuat', { id: 'expand-all' });
      }
    }
  };

  // Level 3: Open Drilldown Modal for a Journal Entry
  const handleOpenVoucher = (entryNoOrId) => {
    if (!entryNoOrId) return;
    setVoucherModal({
      isOpen: true,
      journalId: typeof entryNoOrId === 'number' ? entryNoOrId : null,
      entryNo: typeof entryNoOrId === 'string' ? entryNoOrId : null,
    });
  };

  // Export Overview to Excel
  const handleExportAllExcel = async () => {
    if (!ledgerData) return;
    setExporting(true);
    try {
      const businessName = currentBusiness?.name || userBusinessName || 'MOVA POS';
      const outletName =
        activeOutlet?.name || (activeOutletId ? 'Cabang Terpilih' : 'Semua Cabang (Konsolidasi)');

      await exportJournalLedgerToExcel({
        data: ledgerData,
        period: ledgerData.period || { from: effectiveDateFrom, to: effectiveDateTo },
        outletName,
        businessName,
      });
      toast.success('Buku Besar Jurnal berhasil diekspor ke Excel!');
    } catch (err) {
      console.error('Export Excel error:', err);
      toast.error('Gagal mengekspor laporan ke Excel');
    } finally {
      setExporting(false);
    }
  };

  // Export Specific Account Ledger to Excel
  const handleExportAccountExcel = async (e, accCode) => {
    e.stopPropagation();
    const accState = expandedAccounts[accCode];
    if (!accState?.data) {
      toast.error('Silakan buka mutasi akun terlebih dahulu');
      return;
    }

    try {
      const businessName = currentBusiness?.name || userBusinessName || 'MOVA POS';
      const outletName =
        activeOutlet?.name || (activeOutletId ? 'Cabang Terpilih' : 'Semua Cabang (Konsolidasi)');

      await exportAccountTransactionsToExcel({
        account: accState.data.account,
        summary: accState.data.summary,
        items: accState.data.items || [],
        period: accState.data.period || { from: effectiveDateFrom, to: effectiveDateTo },
        outletName,
        businessName,
      });
      toast.success(`Mutasi akun [${accCode}] berhasil diekspor ke Excel!`);
    } catch (err) {
      console.error('Export account error:', err);
      toast.error('Gagal mengekspor mutasi akun ke Excel');
    }
  };

  // Print PDF
  const handlePrint = () => {
    if (!ledgerData) return;
    const businessName = currentBusiness?.name || userBusinessName || 'MOVA POS';
    const outletName =
      activeOutlet?.name || (activeOutletId ? 'Cabang Terpilih' : 'Semua Cabang (Konsolidasi)');

    printJournalLedgerReport({
      data: ledgerData,
      period: ledgerData.period || { from: effectiveDateFrom, to: effectiveDateTo },
      outletName,
      businessName,
    });
  };

  // Master Account Modal Handlers
  const handleOpenCreateAccount = (presetPrefix = '') => {
    const isAsset = presetPrefix.startsWith('1-');
    const isLiab = presetPrefix.startsWith('2-');
    const isEquity = presetPrefix.startsWith('3-');
    const isRev = presetPrefix.startsWith('4-');
    const isCogs = presetPrefix.startsWith('5-');
    const isOpex = presetPrefix.startsWith('6-');

    setAccountModal({
      open: true,
      mode: 'create',
      account: null,
      loading: false,
    });
    setAccountForm({
      code: presetPrefix || '',
      name: '',
      type: isAsset ? 'ASSET' : isLiab ? 'LIABILITY' : isEquity ? 'EQUITY' : isRev ? 'REVENUE' : 'EXPENSE',
      category: isAsset ? 'CASH' : isLiab ? 'PAYABLE' : isEquity ? 'CAPITAL' : isRev ? 'SALES' : isCogs ? 'COGS' : 'OPEX',
      normal_balance: isLiab || isEquity || isRev ? 'CREDIT' : 'DEBIT',
      description: '',
      is_active: true,
    });
  };

  const handleOpenEditAccount = (acc) => {
    setAccountModal({
      open: true,
      mode: 'edit',
      account: acc,
      loading: false,
    });
    setAccountForm({
      code: acc.code || '',
      name: acc.name || '',
      type: acc.type || 'EXPENSE',
      category: acc.category || 'OPEX',
      normal_balance: acc.normal_balance || 'DEBIT',
      description: acc.description || '',
      is_active: Boolean(acc.is_active),
    });
  };

  const handleApplyPrefix = (prefix, type, normalBal, defCategory) => {
    setAccountForm((prev) => ({
      ...prev,
      code: prefix,
      type: type || prev.type,
      normal_balance: normalBal || prev.normal_balance,
      category: defCategory || prev.category,
    }));
  };

  const handleSaveAccount = async (e) => {
    if (e) e.preventDefault();
    if (!accountForm.code.trim()) {
      toast.error('Nomor / Kode Akun wajib diisi');
      return;
    }
    if (!accountForm.name.trim()) {
      toast.error('Nama Akun wajib diisi');
      return;
    }

    setAccountModal((prev) => ({ ...prev, loading: true }));
    try {
      if (accountModal.mode === 'create') {
        const res = await api.post('/accounting/accounts', accountForm);
        toast.success(res.data?.message || 'Master akun baru berhasil ditambahkan!');
      } else {
        const res = await api.put(`/accounting/accounts/${accountModal.account.id}`, accountForm);
        toast.success(res.data?.message || 'Master akun berhasil diperbarui!');
      }
      setAccountModal({ open: false, mode: 'create', account: null, loading: false });
      await Promise.all([fetchMasterAccounts(), fetchLedger()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan master akun');
      setAccountModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleToggleActiveAccount = async (acc, e) => {
    if (e) e.stopPropagation();
    const actionText = acc.is_active ? 'menonaktifkan' : 'mengaktifkan';
    const confirmed = await confirmDialog({
      title: `${acc.is_active ? 'Nonaktifkan' : 'Aktifkan'} Akun?`,
      text: `Apakah Anda yakin ingin ${actionText} akun [${acc.code} - ${acc.name}] untuk unit bisnis Anda?`,
      confirmButtonText: `Ya, ${acc.is_active ? 'Nonaktifkan' : 'Aktifkan'}`,
      icon: acc.is_active ? 'warning' : 'question',
    });

    if (!confirmed) return;

    const toastId = toast.loading(`Sedang ${actionText} akun...`);
    try {
      const res = await api.patch(`/accounting/accounts/${acc.id}/toggle-active`);
      toast.success(res.data?.message || `Status akun berhasil diperbarui!`, { id: toastId });
      await Promise.all([fetchMasterAccounts(), fetchLedger()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui status akun', { id: toastId });
    }
  };

  const handleDeleteAccount = async (acc, e) => {
    if (e) e.stopPropagation();
    const confirmed = await confirmDialog({
      title: 'Hapus Master Akun Kustom?',
      text: `Apakah Anda yakin ingin menghapus permanen akun [${acc.code} - ${acc.name}] dari unit bisnis Anda? Tindakan ini tidak dapat dibatalkan.`,
      confirmButtonText: 'Ya, Hapus Akun',
      confirmButtonColor: '#ef4444',
      icon: 'warning',
    });

    if (!confirmed) return;

    const toastId = toast.loading('Menghapus akun...');
    try {
      const res = await api.delete(`/accounting/accounts/${acc.id}`);
      toast.success(res.data?.message || 'Master akun berhasil dihapus', { id: toastId });
      await Promise.all([fetchMasterAccounts(), fetchLedger()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus akun', { id: toastId });
    }
  };

  // Filtered Master Accounts for COA Tab
  const filteredMasterAccounts = useMemo(() => {
    return masterAccounts.filter((acc) => {
      // Search
      if (masterSearch.trim()) {
        const s = masterSearch.toLowerCase();
        const matchCode = acc.code?.toLowerCase().includes(s);
        const matchName = acc.name?.toLowerCase().includes(s);
        const matchDesc = acc.description?.toLowerCase().includes(s);
        const matchCat = acc.category?.toLowerCase().includes(s);
        if (!matchCode && !matchName && !matchDesc && !matchCat) return false;
      }
      // Type filter
      if (masterTypeFilter !== 'ALL' && acc.type !== masterTypeFilter) return false;
      // Category filter
      if (masterCategoryFilter !== 'ALL' && acc.category !== masterCategoryFilter) return false;
      // Status filter
      if (masterStatusFilter === 'active' && !acc.is_active) return false;
      if (masterStatusFilter === 'inactive' && acc.is_active) return false;
      // Origin filter
      if (masterOriginFilter === 'system' && !acc.is_system) return false;
      if (masterOriginFilter === 'custom' && acc.is_system) return false;

      return true;
    });
  }, [
    masterAccounts,
    masterSearch,
    masterTypeFilter,
    masterCategoryFilter,
    masterStatusFilter,
    masterOriginFilter,
  ]);

  // Filtered groups based on search and selected category tab (Ledger Tab)
  const filteredGroups = useMemo(() => {
    if (!ledgerData?.groups) return [];
    const term = searchTerm.trim().toLowerCase();

    return ledgerData.groups
      .filter((group) => {
        if (selectedGroupFilter === 'ALL') return true;
        const groupKey = String(group.key || group.prefix || group.label.charAt(0));
        if (groupKey === selectedGroupFilter) return true;
        if (group.label && group.label.startsWith(selectedGroupFilter)) return true;
        if (
          Array.isArray(group.accounts) &&
          group.accounts.some((a) => String(a.code).startsWith(selectedGroupFilter))
        )
          return true;
        return false;
      })
      .map((group) => {
        if (!term) return group;
        const matchingAccounts = (group.accounts || []).filter((acc) => {
          return (
            acc.code.toLowerCase().includes(term) ||
            acc.name.toLowerCase().includes(term) ||
            (acc.description && acc.description.toLowerCase().includes(term))
          );
        });
        return {
          ...group,
          accounts: matchingAccounts,
        };
      })
      .filter((group) => group.accounts && group.accounts.length > 0);
  }, [ledgerData?.groups, searchTerm, selectedGroupFilter]);

  const previewSheets = useMemo(() => {
    if (!ledgerData?.groups) return [];

    const allAccountsRows = [];
    ledgerData.groups.forEach((g) => {
      (g.accounts || []).forEach((acc) => {
        const isDebit = acc.normal_balance === 'DEBIT' || acc.normal_pos === 'debit' || ['1', '5', '6'].includes(String(acc.code).charAt(0));
        allAccountsRows.push({
          code: acc.code,
          name: acc.name,
          group: g.label,
          normal_pos: isDebit ? 'Debit (D)' : 'Kredit (K)',
          debit: Number(acc.period_debit) || 0,
          credit: Number(acc.period_credit) || 0,
          saldo_akhir: Number(acc.saldo_akhir) || 0,
          tx_count: Number(acc.tx_count) || 0,
        });
      });
    });

    const sheets = [
      {
        id: 'overview',
        name: 'Ringkasan Seluruh Akun',
        columns: [
          { key: 'code', label: 'Kode Akun', align: 'center', width: 14 },
          { key: 'name', label: 'Nama Akun', align: 'left', width: 28 },
          { key: 'group', label: 'Klasifikasi', align: 'left', width: 20 },
          { key: 'normal_pos', label: 'Pos Normal', align: 'center', width: 14 },
          { key: 'debit', label: 'Debit Periode', align: 'right', format: 'currency', width: 18 },
          { key: 'credit', label: 'Kredit Periode', align: 'right', format: 'currency', width: 18 },
          { key: 'saldo_akhir', label: 'Saldo Akhir', align: 'right', format: 'currency', width: 20 },
          { key: 'tx_count', label: 'Mutasi', align: 'center', format: 'number', width: 10 },
        ],
        data: allAccountsRows,
        totals: [
          {
            label: 'GRAND TOTAL JURNAL UMUM',
            debit: ledgerData.summary?.total_debit || 0,
            credit: ledgerData.summary?.total_credit || 0,
            saldo_akhir:
              (ledgerData.summary?.total_debit || 0) - (ledgerData.summary?.total_credit || 0),
          },
        ],
      },
    ];

    ledgerData.groups.forEach((g) => {
      sheets.push({
        id: `group-${g.key || g.prefix || g.label}`,
        name: g.label,
        columns: [
          { key: 'code', label: 'Kode Akun', align: 'center', width: 14 },
          { key: 'name', label: 'Nama Akun', align: 'left', width: 32 },
          { key: 'normal_pos', label: 'Pos Normal', align: 'center', width: 14 },
          { key: 'debit', label: 'Debit Periode', align: 'right', format: 'currency', width: 20 },
          { key: 'credit', label: 'Kredit Periode', align: 'right', format: 'currency', width: 20 },
          { key: 'saldo_akhir', label: 'Saldo Akhir', align: 'right', format: 'currency', width: 22 },
          { key: 'tx_count', label: 'Mutasi', align: 'center', format: 'number', width: 12 },
        ],
        data: (g.accounts || []).map((acc) => {
          const isDeb = acc.normal_balance === 'DEBIT' || acc.normal_pos === 'debit' || ['1', '5', '6'].includes(String(acc.code).charAt(0));
          return {
            code: acc.code,
            name: acc.name,
            normal_pos: isDeb ? 'Debit (D)' : 'Kredit (K)',
            debit: Number(acc.period_debit) || 0,
            credit: Number(acc.period_credit) || 0,
            saldo_akhir: Number(acc.saldo_akhir) || 0,
            tx_count: Number(acc.tx_count) || 0,
          };
        }),
        totals: [
          {
            label: `SUBTOTAL ${g.label.toUpperCase()}`,
            debit: (g.accounts || []).reduce((s, a) => s + (Number(a.period_debit) || 0), 0),
            credit: (g.accounts || []).reduce((s, a) => s + (Number(a.period_credit) || 0), 0),
            saldo_akhir: (g.accounts || []).reduce((s, a) => s + (Number(a.saldo_akhir) || 0), 0),
          },
        ],
      });
    });

    return sheets;
  }, [ledgerData]);

  const previewKpis = useMemo(() => {
    if (!ledgerData?.summary) return [];
    return [
      {
        label: 'Total Debit Periode',
        value: ledgerData.summary.total_debit || 0,
        format: 'currency',
        color: '#10b981',
      },
      {
        label: 'Total Kredit Periode',
        value: ledgerData.summary.total_credit || 0,
        format: 'currency',
        color: '#38bdf8',
      },
      {
        label: 'Status Keseimbangan',
        value: ledgerData.summary.is_balanced
          ? 'SEIMBANG (Rp 0)'
          : `SELISIH: ${rupiah(ledgerData.summary.difference || 0)}`,
        color: ledgerData.summary.is_balanced ? '#10b981' : '#f59e0b',
        subtext: `${ledgerData.summary.total_accounts || 0} Akun COA | ${ledgerData.summary.total_entries || 0} Bukti Voucher`,
      },
    ];
  }, [ledgerData]);

  // Color helper for code prefix
  const getCodePrefixStyle = (code) => {
    const p = String(code || '').charAt(0);
    switch (p) {
      case '1':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.35)' }; // Aset (Emerald)
      case '2':
        return { bg: 'rgba(244, 63, 94, 0.15)', text: '#fb7185', border: 'rgba(244, 63, 94, 0.35)' }; // Kewajiban (Rose)
      case '3':
        return { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.35)' }; // Ekuitas (Cyan)
      case '4':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.35)' }; // Pendapatan (Amber)
      case '5':
        return { bg: 'rgba(249, 115, 22, 0.15)', text: '#fb923c', border: 'rgba(249, 115, 22, 0.35)' }; // HPP (Orange)
      case '6':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.35)' }; // Biaya (Red)
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1', border: 'rgba(148, 163, 184, 0.35)' };
    }
  };

  return (
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* 1. Page Header & Actions */}
      <div className="flex-between mb-4 flex-wrap gap-3">
        <PageHeader
          title={mainTab === 'ledger' ? "Jurnal Umum & Buku Besar (General Ledger)" : "Master Bagan Akun (Chart of Accounts)"}
          subtitle={
            mainTab === 'ledger'
              ? "Pencatatan Buku Besar Berpasangan (Double-Entry). Dikelompokkan per Akun COA, dapat diexpand untuk melihat rincian mutasi dan didrill-down untuk bukti voucher jurnal."
              : "Kelola daftar master akun pembukuan khusus unit bisnis Anda. Tambahkan akun baru atau aktifkan/nonaktifkan akun sesuai kebutuhan operasional."
          }
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {mainTab === 'ledger' ? (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSyncJournals}
                disabled={syncing || loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#38bdf8',
                  borderColor: 'rgba(56, 189, 248, 0.35)',
                  background: 'rgba(56, 189, 248, 0.08)',
                }}
                title="Posting ulang seluruh transaksi operasional ke jurnal"
              >
                <RefreshCw size={14} className={syncing ? 'spin-anim' : ''} />
                <span>{syncing ? 'Sinkronisasi...' : 'Sinkronkan Jurnal'}</span>
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={fetchLedger}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
                <span>Refresh</span>
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPreviewModalOpen(true)}
                disabled={loading || !ledgerData}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#38bdf8',
                  borderColor: 'rgba(56, 189, 248, 0.35)',
                  background: 'rgba(56, 189, 248, 0.08)',
                  fontWeight: 600,
                }}
              >
                <Eye size={14} />
                <span>Pratinjau Laporan</span>
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={handlePrint}
                disabled={loading || !ledgerData}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#a78bfa',
                  borderColor: 'rgba(167, 139, 250, 0.35)',
                  background: 'rgba(167, 139, 250, 0.08)',
                }}
              >
                <Printer size={14} />
                <span>Cetak / PDF</span>
              </button>

              <button
                className="btn btn-primary btn-sm"
                onClick={handleExportAllExcel}
                disabled={loading || exporting || !ledgerData}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                <FileSpreadsheet size={15} />
                <span>{exporting ? 'Mengekspor...' : 'Export Excel (.xlsx)'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={fetchMasterAccounts}
                disabled={loadingMaster}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={14} className={loadingMaster ? 'spin-anim' : ''} />
                <span>Refresh Master</span>
              </button>

              {canManageAccounts && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleOpenCreateAccount('')}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    borderColor: '#10b981',
                    color: '#ffffff',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Plus size={16} />
                  <span>Tambah Master Akun</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 2. Top-Level Tab Switcher & Business Isolation Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 20,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setMainTab('ledger')}
            className={`btn ${mainTab === 'ledger' ? 'btn-primary' : 'btn-ghost'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 700,
              fontSize: 13,
              padding: '8px 16px',
              borderRadius: 8,
            }}
          >
            <BookOpen size={16} />
            <span>Buku Besar & Mutasi Akun</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab('coa')}
            className={`btn ${mainTab === 'coa' ? 'btn-primary' : 'btn-ghost'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 700,
              fontSize: 13,
              padding: '8px 16px',
              borderRadius: 8,
            }}
          >
            <Layers size={16} />
            <span>Master Bagan Akun (COA)</span>
            {masterSummary.total > 0 && (
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 7px',
                  borderRadius: 12,
                  background: mainTab === 'coa' ? 'rgba(255,255,255,0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: mainTab === 'coa' ? '#ffffff' : '#34d399',
                  fontWeight: 800,
                }}
              >
                {masterSummary.total}
              </span>
            )}
          </button>
        </div>

        {/* Business Tenant Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: '#cbd5e1',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
          }}
          title="Master akun ini dikelola dan terisolasi khusus untuk unit bisnis Anda"
        >
          <Building size={14} style={{ color: '#38bdf8' }} />
          <span>
            Bisnis: <strong style={{ color: '#ffffff' }}>{currentBusiness?.name || userBusinessName || 'Bisnis Anda'}</strong>
          </span>
          <span
            style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 4,
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              fontWeight: 700,
            }}
          >
            Terisolasi
          </span>
        </div>
      </div>

      {/* TAB 1: BUKU BESAR & MUTASI JURNAL */}
      {mainTab === 'ledger' && (
        <>
          {loading ? (
            <LoadingState message="Menghitung saldo buku besar & mutasi jurnal..." />
          ) : !ledgerData ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Tidak ada data jurnal untuk periode ini.
            </div>
          ) : (
            <>
              {/* Interactive Drilldown Guide Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  padding: '10px 16px',
                  borderRadius: 10,
                  background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.15) 0%, rgba(56, 189, 248, 0.1) 100%)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  fontSize: 12.5,
                  color: '#ede9fe',
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={16} color="#a78bfa" style={{ flexShrink: 0 }} />
                  <span>
                    <strong style={{ color: '#ffffff' }}>Hierarki Drill-Down Jurnal:</strong> Klik nomor akun untuk
                    membuka <strong>Rincian Mutasi Ledger</strong>, lalu klik nomor bukti/voucher jurnal untuk membedah{' '}
                    <strong>Bukti Jurnal Berpasangan (Debit = Kredit)</strong> lengkap.
                  </span>
                </div>
                <button
                  onClick={handleToggleExpandAll}
                  className="btn btn-ghost btn-sm"
                  style={{
                    fontSize: 11.5,
                    color: 'var(--accent-bright)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                  }}
                >
                  <Layers size={13} />
                  {Object.values(expandedAccounts).some((item) => item.open) ? 'Tutup Semua' : 'Buka Semua Akun'}
                </button>
              </div>

              {/* Executive KPI Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                {/* Total Debit */}
                <div
                  className="card"
                  style={{
                    padding: '16px 18px',
                    borderLeft: '4px solid #10b981',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(20, 26, 52, 0.72) 100%)',
                  }}
                >
                  <div className="flex-between mb-1">
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <ArrowUpDown size={15} color="#10b981" />
                      Total Debit Periode
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        fontWeight: 700,
                      }}
                    >
                      DEBIT
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#10b981', margin: '4px 0 6px 0' }}>
                    {rupiah(ledgerData.summary?.total_debit || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Akumulasi mutasi debit seluruh akun</div>
                </div>

                {/* Total Kredit */}
                <div
                  className="card"
                  style={{
                    padding: '16px 18px',
                    borderLeft: '4px solid #38bdf8',
                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(20, 26, 52, 0.72) 100%)',
                  }}
                >
                  <div className="flex-between mb-1">
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <ArrowUpDown size={15} color="#38bdf8" />
                      Total Kredit Periode
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        fontWeight: 700,
                      }}
                    >
                      KREDIT
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8', margin: '4px 0 6px 0' }}>
                    {rupiah(ledgerData.summary?.total_credit || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Akumulasi mutasi kredit seluruh akun</div>
                </div>

                {/* Status Keseimbangan */}
                <div
                  className="card"
                  style={{
                    padding: '16px 18px',
                    borderLeft: `4px solid ${ledgerData.summary?.is_balanced ? '#10b981' : '#f59e0b'}`,
                    background: ledgerData.summary?.is_balanced
                      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(20, 26, 52, 0.72) 100%)'
                      : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(20, 26, 52, 0.72) 100%)',
                  }}
                >
                  <div className="flex-between mb-1">
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Scale size={15} color={ledgerData.summary?.is_balanced ? '#10b981' : '#f59e0b'} />
                      Status Keseimbangan (D = K)
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: ledgerData.summary?.is_balanced ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: ledgerData.summary?.is_balanced ? '#34d399' : '#fbbf24',
                        fontWeight: 800,
                      }}
                    >
                      {ledgerData.summary?.is_balanced ? 'SEIMBANG' : 'SELISIH'}
                    </span>
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: ledgerData.summary?.is_balanced ? '#34d399' : '#fbbf24',
                      margin: '4px 0 6px 0',
                    }}
                  >
                    {ledgerData.summary?.is_balanced ? 'Rp 0 (Pas)' : rupiah(ledgerData.summary?.difference || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Total {ledgerData.summary?.total_accounts || 0} Akun Aktif | {ledgerData.summary?.total_entries || 0} Bukti Voucher
                  </div>
                </div>
              </div>

              {/* Filter & Search Toolbar */}
              <div
                className="card mb-4"
                style={{
                  padding: '12px 16px',
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Search input */}
                  <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
                    <Search
                      size={15}
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                      }}
                    />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Cari Kode Akun, Nama Akun, atau Deskripsi..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Group Filter Buttons */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { key: 'ALL', label: 'Semua Akun' },
                      { key: '1', label: '1. Aset' },
                      { key: '2', label: '2. Kewajiban' },
                      { key: '3', label: '3. Ekuitas' },
                      { key: '4', label: '4. Pendapatan' },
                      { key: '5', label: '5. HPP' },
                      { key: '6', label: '6. Biaya/Beban' },
                    ].map((g) => (
                      <button
                        key={g.key}
                        type="button"
                        onClick={() => setSelectedGroupFilter(g.key)}
                        className={`btn btn-sm ${selectedGroupFilter === g.key ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: 11.5, padding: '5px 11px', height: 36 }}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Grouped Accounts Accordion / Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filteredGroups.length === 0 ? (
                  <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Tidak ada akun yang sesuai dengan pencarian atau filter yang dipilih.
                  </div>
                ) : (
                  filteredGroups.map((group) => {
                    const groupSubtotalDebit = (group.accounts || []).reduce(
                      (acc, a) => acc + (Number(a.period_debit) || 0),
                      0
                    );
                    const groupSubtotalCredit = (group.accounts || []).reduce(
                      (acc, a) => acc + (Number(a.period_credit) || 0),
                      0
                    );
                    const groupSubtotalSaldo = (group.accounts || []).reduce(
                      (acc, a) => acc + (Number(a.saldo_akhir) || 0),
                      0
                    );

                    return (
                      <div
                        key={group.key || group.label}
                        className="card"
                        style={{
                          overflow: 'hidden',
                          border: '1px solid var(--border)',
                          padding: 0,
                          background: 'rgba(15, 23, 42, 0.75)',
                        }}
                      >
                        {/* Group Header Banner */}
                        <div
                          style={{
                            padding: '12px 18px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                background: 'rgba(139, 92, 246, 0.2)',
                                color: '#c4b5fd',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: 13,
                              }}
                            >
                              {group.prefix || group.key || group.label.charAt(0)}
                            </span>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 14, color: '#ffffff' }}>
                                {group.label}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {group.accounts?.length || 0} Akun Buku Besar Terdaftar
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 12 }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>Subtotal Debit:</span>
                              <strong className="mono" style={{ color: '#10b981' }}>
                                {rupiah(groupSubtotalDebit)}
                              </strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>Subtotal Kredit:</span>
                              <strong className="mono" style={{ color: '#38bdf8' }}>
                                {rupiah(groupSubtotalCredit)}
                              </strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>Subtotal Saldo:</span>
                              <strong className="mono" style={{ color: '#ffffff' }}>
                                {rupiah(groupSubtotalSaldo)}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* Accounts List Table */}
                        <div className="table-responsive">
                          <table className="table" style={{ margin: 0, fontSize: 12.5 }}>
                            <thead>
                              <tr style={{ background: 'rgba(0, 0, 0, 0.25)' }}>
                                <th style={{ width: 44, textAlign: 'center' }}></th>
                                <th style={{ width: 130 }}>Kode Akun</th>
                                <th>Nama Akun & Keterangan</th>
                                <th style={{ width: 110, textAlign: 'center' }}>Pos Normal</th>
                                <th style={{ width: 140, textAlign: 'right' }}>Debit Periode</th>
                                <th style={{ width: 140, textAlign: 'right' }}>Kredit Periode</th>
                                <th style={{ width: 160, textAlign: 'right' }}>Saldo Akhir</th>
                                <th style={{ width: 100, textAlign: 'center' }}>Mutasi</th>
                                <th style={{ width: 110, textAlign: 'center' }}>Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(group.accounts || []).map((acc) => {
                                const accState = expandedAccounts[acc.code] || { open: false, loading: false };
                                const isExpanded = Boolean(accState.open);
                                const pStyle = getCodePrefixStyle(acc.code);

                                return (
                                  <LedgerAccountRow
                                    key={acc.code}
                                    account={acc}
                                    accountState={accState}
                                    isExpanded={isExpanded}
                                    prefixStyle={pStyle}
                                    onToggle={() => toggleAccountExpand(acc.code)}
                                    onExportExcel={(e) => handleExportAccountExcel(e, acc.code)}
                                    onOpenVoucher={handleOpenVoucher}
                                  />
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* TAB 2: MASTER BAGAN AKUN (CHART OF ACCOUNTS) */}
      {mainTab === 'coa' && (
        <>
          {/* Master Accounts KPI Summary */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {/* Total Akun */}
            <div
              className="card"
              onClick={() => {
                setMasterStatusFilter('ALL');
                setMasterOriginFilter('ALL');
                setMasterTypeFilter('ALL');
              }}
              style={{
                padding: '14px 16px',
                cursor: 'pointer',
                borderLeft: '4px solid var(--accent-bright)',
                background: 'rgba(15, 23, 42, 0.65)',
              }}
            >
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 700 }}>
                Total Master Akun
              </div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>
                {masterSummary.total}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Daftar akun buku besar bisnis
              </div>
            </div>

            {/* Akun Aktif */}
            <div
              className="card"
              onClick={() => {
                setMasterStatusFilter('active');
                setMasterOriginFilter('ALL');
              }}
              style={{
                padding: '14px 16px',
                cursor: 'pointer',
                borderLeft: '4px solid #10b981',
                background: masterStatusFilter === 'active' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.65)',
              }}
            >
              <div style={{ fontSize: 11.5, color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={13} /> Akun Aktif
              </div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 900, color: '#34d399', marginTop: 4 }}>
                {masterSummary.active}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Siap dipakai dalam transaksi
              </div>
            </div>

            {/* Akun Nonaktif */}
            <div
              className="card"
              onClick={() => {
                setMasterStatusFilter('inactive');
                setMasterOriginFilter('ALL');
              }}
              style={{
                padding: '14px 16px',
                cursor: 'pointer',
                borderLeft: '4px solid #94a3b8',
                background: masterStatusFilter === 'inactive' ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.65)',
              }}
            >
              <div style={{ fontSize: 11.5, color: '#cbd5e1', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Power size={13} /> Akun Nonaktif
              </div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 900, color: '#94a3b8', marginTop: 4 }}>
                {masterSummary.inactive}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Disembunyikan dari transaksi
              </div>
            </div>

            {/* Akun Bawaan Sistem */}
            <div
              className="card"
              onClick={() => {
                setMasterOriginFilter('system');
                setMasterStatusFilter('ALL');
              }}
              style={{
                padding: '14px 16px',
                cursor: 'pointer',
                borderLeft: '4px solid #a78bfa',
                background: masterOriginFilter === 'system' ? 'rgba(167, 139, 250, 0.12)' : 'rgba(15, 23, 42, 0.65)',
              }}
            >
              <div style={{ fontSize: 11.5, color: '#c4b5fd', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Shield size={13} /> Bawaan Standar
              </div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 900, color: '#a78bfa', marginTop: 4 }}>
                {masterSummary.system}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Akun otomatis sistem POS
              </div>
            </div>

            {/* Akun Kustom Bisnis */}
            <div
              className="card"
              onClick={() => {
                setMasterOriginFilter('custom');
                setMasterStatusFilter('ALL');
              }}
              style={{
                padding: '14px 16px',
                cursor: 'pointer',
                borderLeft: '4px solid #38bdf8',
                background: masterOriginFilter === 'custom' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.65)',
              }}
            >
              <div style={{ fontSize: 11.5, color: '#7dd3fc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tag size={13} /> Kustom Bisnis Anda
              </div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 900, color: '#38bdf8', marginTop: 4 }}>
                {masterSummary.custom}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Ditambahkan oleh Owner
              </div>
            </div>
          </div>

          {/* Master Accounts Filter & Search Toolbar */}
          <div
            className="card mb-4"
            style={{
              padding: '14px 16px',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Search Box */}
              <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Cari Kode Akun, Nama, Kategori, atau Deskripsi..."
                  value={masterSearch}
                  onChange={(e) => setMasterSearch(e.target.value)}
                  style={{ paddingLeft: 36, height: 38, fontSize: 12.5 }}
                />
                {masterSearch && (
                  <button
                    type="button"
                    onClick={() => setMasterSearch('')}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Tipe Filter */}
              <select
                className="form-control"
                value={masterTypeFilter}
                onChange={(e) => setMasterTypeFilter(e.target.value)}
                style={{ width: 'auto', minWidth: 150, height: 38, fontSize: 12 }}
              >
                <option value="ALL">Semua Tipe Akun</option>
                <option value="ASSET">1. ASET (Harta)</option>
                <option value="LIABILITY">2. KEWAJIBAN (Hutang)</option>
                <option value="EQUITY">3. EKUITAS (Modal)</option>
                <option value="REVENUE">4. PENDAPATAN</option>
                <option value="EXPENSE">5. BIAYA / BEBAN</option>
              </select>

              {/* Status Filter */}
              <select
                className="form-control"
                value={masterStatusFilter}
                onChange={(e) => setMasterStatusFilter(e.target.value)}
                style={{ width: 'auto', minWidth: 140, height: 38, fontSize: 12 }}
              >
                <option value="ALL">Semua Status</option>
                <option value="active">Hanya Aktif</option>
                <option value="inactive">Hanya Nonaktif</option>
              </select>

              {/* Origin Filter */}
              <select
                className="form-control"
                value={masterOriginFilter}
                onChange={(e) => setMasterOriginFilter(e.target.value)}
                style={{ width: 'auto', minWidth: 140, height: 38, fontSize: 12 }}
              >
                <option value="ALL">Semua Asal</option>
                <option value="system">Bawaan Standar</option>
                <option value="custom">Kustom Bisnis</option>
              </select>

              {(masterSearch || masterTypeFilter !== 'ALL' || masterStatusFilter !== 'ALL' || masterOriginFilter !== 'ALL') && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setMasterSearch('');
                    setMasterTypeFilter('ALL');
                    setMasterStatusFilter('ALL');
                    setMasterOriginFilter('ALL');
                  }}
                  style={{ fontSize: 11.5, color: '#f87171' }}
                >
                  <X size={13} /> Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* Master Accounts Table */}
          {loadingMaster ? (
            <LoadingState message="Memuat daftar master akun bisnis..." />
          ) : filteredMasterAccounts.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Tidak ada master akun yang cocok dengan filter pencarian.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div className="table-responsive">
                <table className="table" style={{ margin: 0, fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
                      <th style={{ width: 130 }}>Kode Akun</th>
                      <th>Nama Akun</th>
                      <th style={{ width: 140 }}>Tipe & Kategori</th>
                      <th style={{ width: 110, textAlign: 'center' }}>Saldo Normal</th>
                      <th>Deskripsi / Penggunaan</th>
                      <th style={{ width: 110, textAlign: 'center' }}>Status</th>
                      <th style={{ width: 160, textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMasterAccounts.map((acc) => {
                      const pStyle = getCodePrefixStyle(acc.code);

                      return (
                        <tr
                          key={acc.id}
                          style={{
                            opacity: acc.is_active ? 1 : 0.65,
                            background: !acc.is_active ? 'rgba(0, 0, 0, 0.2)' : 'transparent',
                          }}
                        >
                          {/* Kode Akun */}
                          <td>
                            <span
                              className="mono"
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: pStyle.bg,
                                color: pStyle.text,
                                border: `1px solid ${pStyle.border}`,
                                display: 'inline-block',
                              }}
                            >
                              {acc.code}
                            </span>
                          </td>

                          {/* Nama Akun */}
                          <td>
                            <div style={{ fontWeight: 700, color: '#ffffff', fontSize: 13 }}>
                              {acc.name}
                            </div>
                            <div style={{ marginTop: 2 }}>
                              {acc.is_system ? (
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: 'rgba(167, 139, 250, 0.15)',
                                    color: '#c4b5fd',
                                    fontWeight: 700,
                                  }}
                                >
                                  Bawaan Standar
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: 'rgba(56, 189, 248, 0.15)',
                                    color: '#7dd3fc',
                                    fontWeight: 700,
                                  }}
                                >
                                  Kustom Bisnis
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Tipe & Kategori */}
                          <td>
                            <div style={{ fontWeight: 600, color: '#cbd5e1' }}>{acc.type}</div>
                            {acc.category && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {acc.category}
                              </div>
                            )}
                          </td>

                          {/* Saldo Normal */}
                          <td style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                fontSize: 10.5,
                                padding: '2px 8px',
                                borderRadius: 5,
                                fontWeight: 800,
                                background: acc.normal_balance === 'DEBIT' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                color: acc.normal_balance === 'DEBIT' ? '#34d399' : '#38bdf8',
                              }}
                            >
                              {acc.normal_balance === 'DEBIT' ? 'DEBIT (D)' : 'KREDIT (K)'}
                            </span>
                          </td>

                          {/* Deskripsi */}
                          <td style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>
                            {acc.description || '—'}
                          </td>

                          {/* Status Aktif */}
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className={`pill ${acc.is_active ? 'pill-ok' : 'pill-secondary'}`}
                              style={{ fontSize: 10.5, fontWeight: 700 }}
                            >
                              {acc.is_active ? '🟢 Aktif' : '⚪ Nonaktif'}
                            </span>
                          </td>

                          {/* Aksi */}
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                              {/* Toggle Active Button */}
                              {canManageAccounts && (
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleActiveAccount(acc, e)}
                                  className={`btn btn-sm ${acc.is_active ? 'btn-secondary' : 'btn-primary'}`}
                                  style={{
                                    fontSize: 10.5,
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    ...(acc.is_active
                                      ? { color: '#94a3b8', borderColor: 'rgba(148, 163, 184, 0.3)' }
                                      : { background: '#059669', borderColor: '#059669', color: '#ffffff' }),
                                  }}
                                  title={acc.is_active ? 'Nonaktifkan akun ini' : 'Aktifkan akun ini'}
                                >
                                  <Power size={11} />
                                  <span>{acc.is_active ? 'Matikan' : 'Aktifkan'}</span>
                                </button>
                              )}

                              {/* Edit Button */}
                              {canManageAccounts && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAccount(acc)}
                                  className="btn btn-ghost btn-sm"
                                  style={{ padding: '4px 6px', color: '#38bdf8' }}
                                  title="Edit Akun"
                                >
                                  <Edit2 size={13} />
                                </button>
                              )}

                              {/* Delete Button (Custom accounts only) */}
                              {canManageAccounts && !acc.is_system && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteAccount(acc, e)}
                                  className="btn btn-ghost btn-sm"
                                  style={{ padding: '4px 6px', color: '#f87171' }}
                                  title="Hapus Akun Kustom"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL TAMBAH / EDIT MASTER AKUN */}
      {accountModal.open && (
        <div className="modal-overlay" onClick={() => !accountModal.loading && setAccountModal({ open: false, mode: 'create', account: null, loading: false })}>
          <div className="modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={20} style={{ color: 'var(--accent-bright)' }} />
                <span>{accountModal.mode === 'create' ? 'Tambah Master Akun Baru' : 'Edit Master Akun'}</span>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setAccountModal({ open: false, mode: 'create', account: null, loading: false })}
                disabled={accountModal.loading}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAccount}>
              <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                {/* Tenant Business Notice */}
                <div
                  style={{
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    marginBottom: 16,
                    fontSize: 12,
                    color: '#bae6fd',
                  }}
                >
                  🏢 Akun ini akan disimpan secara eksklusif untuk bisnis: <strong>{currentBusiness?.name || userBusinessName || 'Bisnis Anda'}</strong>.
                </div>

                {/* Quick Prefix Helper Buttons (Create mode only) */}
                {accountModal.mode === 'create' && (
                  <div style={{ marginBottom: 16 }}>
                    <label className="form-label" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Pilih Cepat Klasifikasi / Awalan Nomor Akun:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '5px 8px', justifyContent: 'flex-start', color: '#34d399' }}
                        onClick={() => handleApplyPrefix('1-1100', 'ASSET', 'DEBIT', 'CASH')}
                      >
                        1- Aset (Harta)
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '5px 8px', justifyContent: 'flex-start', color: '#fb7185' }}
                        onClick={() => handleApplyPrefix('2-2100', 'LIABILITY', 'CREDIT', 'PAYABLE')}
                      >
                        2- Kewajiban (Hutang)
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '5px 8px', justifyContent: 'flex-start', color: '#38bdf8' }}
                        onClick={() => handleApplyPrefix('3-3100', 'EQUITY', 'CREDIT', 'CAPITAL')}
                      >
                        3- Ekuitas (Modal)
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '5px 8px', justifyContent: 'flex-start', color: '#fbbf24' }}
                        onClick={() => handleApplyPrefix('4-4100', 'REVENUE', 'CREDIT', 'SALES')}
                      >
                        4- Pendapatan
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '5px 8px', justifyContent: 'flex-start', color: '#fb923c' }}
                        onClick={() => handleApplyPrefix('5-5100', 'EXPENSE', 'DEBIT', 'COGS')}
                      >
                        5- HPP (Harga Pokok)
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: '5px 8px', justifyContent: 'flex-start', color: '#f87171' }}
                        onClick={() => handleApplyPrefix('6-6101', 'EXPENSE', 'DEBIT', 'OPEX')}
                      >
                        6- Biaya Operasional
                      </button>
                    </div>
                  </div>
                )}

                {/* Nomor / Kode Akun */}
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff' }}>
                    Nomor / Kode Akun <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control mono"
                    value={accountForm.code}
                    onChange={(e) => setAccountForm((f) => ({ ...f, code: e.target.value.trim() }))}
                    placeholder="Contoh: 6-61010 atau 1-11004"
                    disabled={accountModal.mode === 'edit' && accountModal.account?.is_system}
                    required
                    style={{ fontSize: 14, fontWeight: 700 }}
                  />
                  {accountModal.mode === 'edit' && accountModal.account?.is_system && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      🔒 Kode akun bawaan sistem dikunci demi menjaga integrasi posting jurnal otomatis.
                    </div>
                  )}
                </div>

                {/* Nama Akun */}
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff' }}>
                    Nama Akun <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={accountForm.name}
                    onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Contoh: BIAYA KEBERSIHAN & SAMPAH"
                    required
                    style={{ fontSize: 13, fontWeight: 600 }}
                  />
                </div>

                {/* Tipe & Saldo Normal Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  {/* Tipe Akun */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff' }}>
                      Tipe Akun <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      className="form-control"
                      value={accountForm.type}
                      onChange={(e) => {
                        const t = e.target.value;
                        setAccountForm((f) => ({
                          ...f,
                          type: t,
                          normal_balance: t === 'LIABILITY' || t === 'EQUITY' || t === 'REVENUE' ? 'CREDIT' : 'DEBIT',
                        }));
                      }}
                      required
                    >
                      <option value="ASSET">1. ASET (Harta)</option>
                      <option value="LIABILITY">2. KEWAJIBAN (Hutang)</option>
                      <option value="EQUITY">3. EKUITAS (Modal)</option>
                      <option value="REVENUE">4. PENDAPATAN (Penjualan)</option>
                      <option value="EXPENSE">5. BIAYA / BEBAN</option>
                    </select>
                  </div>

                  {/* Saldo Normal */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff' }}>
                      Saldo Normal <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      className="form-control"
                      value={accountForm.normal_balance}
                      onChange={(e) => setAccountForm((f) => ({ ...f, normal_balance: e.target.value }))}
                      required
                    >
                      <option value="DEBIT">DEBIT (Bertambah di Debit)</option>
                      <option value="CREDIT">KREDIT (Bertambah di Kredit)</option>
                    </select>
                  </div>
                </div>

                {/* Kategori Akun */}
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff' }}>
                    Kategori Klasifikasi (Opsional):
                  </label>
                  <select
                    className="form-control"
                    value={accountForm.category}
                    onChange={(e) => setAccountForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    <option value="CASH">CASH (Kas Tunai)</option>
                    <option value="BANK">BANK (Rekening Bank)</option>
                    <option value="RECEIVABLE">RECEIVABLE (Piutang Usaha / Karyawan)</option>
                    <option value="INVENTORY">INVENTORY (Persediaan Bahan Baku)</option>
                    <option value="FIXED_ASSET">FIXED_ASSET (Aset Tetap / Peralatan)</option>
                    <option value="PAYABLE">PAYABLE (Hutang Usaha / Supplier)</option>
                    <option value="CAPITAL">CAPITAL (Modal Disetor)</option>
                    <option value="DRAWING">DRAWING (Prive Pemilik)</option>
                    <option value="SALES">SALES (Penjualan Menu / Produk)</option>
                    <option value="OTHER_INCOME">OTHER_INCOME (Pendapatan Lain-lain)</option>
                    <option value="COGS">COGS (Harga Pokok Penjualan / HPP)</option>
                    <option value="OPEX">OPEX (Biaya Operasional)</option>
                    <option value="CASH_SHORTAGE">CASH_SHORTAGE (Biaya Selisih Kasir)</option>
                    <option value="DEPRECIATION">DEPRECIATION (Penyusutan Aset)</option>
                    <option value="OTHER_EXPENSE">OTHER_EXPENSE (Biaya Non-Operasional)</option>
                  </select>
                </div>

                {/* Deskripsi */}
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>
                    Deskripsi / Fungsi Penggunaan (Opsional):
                  </label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={accountForm.description}
                    onChange={(e) => setAccountForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Contoh: Akun untuk mencatat pengeluaran iuran sampah dan kebersihan lingkungan outlet"
                  />
                </div>

                {/* Status Aktif */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#ffffff' }}>
                      Status Akun Aktif
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      Akun aktif dapat dipilih pada modul pengeluaran, kas masuk, dan jurnal.
                    </div>
                  </div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={accountForm.is_active}
                      onChange={(e) => setAccountForm((f) => ({ ...f, is_active: e.target.checked }))}
                      style={{ width: 18, height: 18, accentColor: '#10b981', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: 700, color: accountForm.is_active ? '#34d399' : '#94a3b8' }}>
                      {accountForm.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAccountModal({ open: false, mode: 'create', account: null, loading: false })}
                  disabled={accountModal.loading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={accountModal.loading || !accountForm.code.trim() || !accountForm.name.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    borderColor: '#10b981',
                    color: '#ffffff',
                    fontWeight: 700,
                  }}
                >
                  {accountModal.loading ? 'Menyimpan...' : (accountModal.mode === 'create' ? 'Tambah Akun' : 'Simpan Perubahan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drill-down Voucher Modal */}
      <JournalVoucherModal
        isOpen={voucherModal.isOpen}
        journalId={voucherModal.journalId}
        entryNo={voucherModal.entryNo}
        onClose={() => setVoucherModal({ isOpen: false, journalId: null, entryNo: null })}
      />

      {/* Report Preview Modal */}
      <ReportPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title="Buku Besar Jurnal (General Ledger Report)"
        periodSubtitle={ledgerData?.period ? `${ledgerData.period.from_formatted} s/d ${ledgerData.period.to_formatted}` : ''}
        outletSubtitle={activeOutlet?.name || 'Semua Cabang (Konsolidasi)'}
        sheets={previewSheets}
        kpis={previewKpis}
        onExportExcel={handleExportAllExcel}
        onPrintPdf={handlePrint}
      />
    </div>
  );
}

/**
 * Subcomponent for Ledger Account Row (Expandable transactions in Level 2 with Multi-Branch Dimension Breakdown)
 */
function LedgerAccountRow({
  account,
  accountState,
  isExpanded,
  prefixStyle,
  onToggle,
  onExportExcel,
  onOpenVoucher,
}) {
  const [branchFilter, setBranchFilter] = useState('ALL');

  const isDebitNormal = useMemo(() => {
    return (
      account.normal_balance === 'DEBIT' ||
      account.normal_pos === 'debit' ||
      ['1', '5', '6'].includes(String(account.code).charAt(0))
    );
  }, [account.normal_balance, account.normal_pos, account.code]);

  const allItems = useMemo(() => {
    return accountState?.data?.items || [];
  }, [accountState?.data?.items]);

  // Group mutasi by branch to provide dynamic Multi-Outlet Sub-Account breakdown
  const dynamicBranchBreakdown = useMemo(() => {
    if (!allItems || allItems.length === 0) return [];
    const map = {};
    allItems.forEach((tx) => {
      const bName = tx.outlet_name || 'Maroa – Cabang Utama (Pusat)';
      if (!map[bName]) {
        map[bName] = {
          name: bName,
          debit: 0,
          credit: 0,
          count: 0,
        };
      }
      map[bName].debit += Number(tx.debit || 0);
      map[bName].credit += Number(tx.credit || 0);
      map[bName].count += 1;
    });

    return Object.values(map).map((b) => ({
      ...b,
      saldo_akhir: isDebitNormal ? b.debit - b.credit : b.credit - b.debit,
    }));
  }, [allItems, isDebitNormal]);

  // Use pre-computed outlets_breakdown from ledger detail or COA summary or dynamic breakdown from items
  const activeBranchList = useMemo(() => {
    const breakdownList = accountState?.data?.outlets_breakdown || accountState?.data?.outlets || account.outlets_breakdown;
    if (breakdownList && breakdownList.length > 0) {
      return breakdownList.map((ob, idx) => ({
        name: ob.outlet_name || ob.name,
        code: ob.sub_code || ob.sub_account_code || `${account.code}.${String(idx + 1).padStart(2, '0')}`,
        subName: ob.sub_account_name || ob.outlet_name,
        debit: ob.total_debit || ob.period_debit || 0,
        credit: ob.total_credit || ob.period_credit || 0,
        saldo_akhir: ob.balance !== undefined ? ob.balance : (ob.saldo_akhir || 0),
        count: ob.tx_count !== undefined ? ob.tx_count : (ob.count || 0),
      }));
    }
    return dynamicBranchBreakdown;
  }, [accountState?.data?.outlets_breakdown, accountState?.data?.outlets, account.outlets_breakdown, dynamicBranchBreakdown, account.code]);

  // Filter items based on selected branch
  const filteredItems = useMemo(() => {
    if (branchFilter === 'ALL') return allItems;
    const normFilter = String(branchFilter || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return allItems.filter((tx) => {
      const normTx = String(tx.outlet_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return normTx === normFilter || String(tx.outlet_id) === String(branchFilter);
    });
  }, [allItems, branchFilter]);

  const filteredDebit = useMemo(() => {
    return filteredItems.reduce((sum, tx) => sum + (Number(tx.debit) || 0), 0);
  }, [filteredItems]);

  const filteredCredit = useMemo(() => {
    return filteredItems.reduce((sum, tx) => sum + (Number(tx.credit) || 0), 0);
  }, [filteredItems]);

  const getBranchBadgeStyle = (branchName) => {
    const s = String(branchName || '').toLowerCase();
    if (s.includes('utama') || s.includes('pusat')) {
      return {
        bg: 'rgba(139, 92, 246, 0.15)',
        color: '#c4b5fd',
        border: 'rgba(139, 92, 246, 0.35)',
        icon: '🏢',
      };
    }
    if (s.includes('hertasning')) {
      return {
        bg: 'rgba(56, 189, 248, 0.15)',
        color: '#38bdf8',
        border: 'rgba(56, 189, 248, 0.35)',
        icon: '🏪',
      };
    }
    return {
      bg: 'rgba(16, 185, 129, 0.15)',
      color: '#34d399',
      border: 'rgba(16, 185, 129, 0.35)',
      icon: '📍',
    };
  };

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          background: isExpanded ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
          borderLeft: isExpanded ? '4px solid var(--accent-bright)' : '4px solid transparent',
          transition: 'all 0.15s ease',
        }}
        className="hover-row"
      >
        {/* Expand Icon */}
        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          {accountState.loading ? (
            <RefreshCw size={14} className="spin-anim" style={{ color: 'var(--accent-bright)' }} />
          ) : isExpanded ? (
            <ChevronDown size={16} style={{ color: 'var(--accent-bright)' }} />
          ) : (
            <ChevronRight size={16} />
          )}
        </td>

        {/* Kode Akun */}
        <td>
          <span
            className="mono"
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 5,
              background: prefixStyle.bg,
              color: prefixStyle.text,
              border: `1px solid ${prefixStyle.border}`,
            }}
          >
            {account.code}
          </span>
        </td>

        {/* Nama Akun & Deskripsi */}
        <td>
          <div style={{ fontWeight: 700, color: '#ffffff' }}>{account.name}</div>
          {account.description && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {account.description}
            </div>
          )}
        </td>

        {/* Pos Normal */}
        <td style={{ textAlign: 'center' }}>
          <span
            style={{
              fontSize: 10.5,
              padding: '2px 7px',
              borderRadius: 4,
              background: isDebitNormal ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
              color: isDebitNormal ? '#34d399' : '#38bdf8',
              fontWeight: 700,
            }}
          >
            {isDebitNormal ? 'Debit (D)' : 'Kredit (K)'}
          </span>
        </td>

        {/* Debit Periode */}
        <td style={{ textAlign: 'right' }}>
          <span className="mono" style={{ color: (Number(account.period_debit) || 0) > 0 ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>
            {rupiah(account.period_debit || 0)}
          </span>
        </td>

        {/* Kredit Periode */}
        <td style={{ textAlign: 'right' }}>
          <span className="mono" style={{ color: (Number(account.period_credit) || 0) > 0 ? '#38bdf8' : 'var(--text-muted)', fontWeight: 600 }}>
            {rupiah(account.period_credit || 0)}
          </span>
        </td>

        {/* Saldo Akhir */}
        <td style={{ textAlign: 'right' }}>
          <span className="mono" style={{ fontWeight: 800, color: '#ffffff', fontSize: 13 }}>
            {rupiah(account.saldo_akhir || 0)}
          </span>
        </td>

        {/* Mutasi Tx Count */}
        <td style={{ textAlign: 'center' }}>
          <span
            style={{
              fontSize: 11,
              padding: '2px 7px',
              borderRadius: 10,
              background: (account.tx_count || 0) > 0 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              color: (account.tx_count || 0) > 0 ? '#c4b5fd' : 'var(--text-muted)',
              fontWeight: 700,
            }}
          >
            {account.tx_count || 0} tx
          </span>
        </td>

        {/* Aksi */}
        <td style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={onExportExcel}
            className="btn btn-ghost btn-sm"
            style={{ padding: '3px 7px', fontSize: 11, color: '#38bdf8' }}
            title={`Export Buku Besar Akun [${account.code}] ke Excel`}
          >
            <FileSpreadsheet size={13} />
          </button>
        </td>
      </tr>

      {/* Expanded Level 2 Mutasi Detail */}
      {isExpanded && (
        <tr>
          <td colSpan={9} style={{ padding: 0, background: 'rgba(0, 0, 0, 0.35)', borderBottom: '2px solid rgba(99, 102, 241, 0.25)' }}>
            <div style={{ padding: '16px 20px', background: 'rgba(15, 23, 42, 0.4)' }}>
              {/* Branch Sub-Account Simple Tree List */}
              {activeBranchList.length > 0 && (
                <div
                  style={{
                    marginBottom: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    marginLeft: 4,
                    paddingLeft: 12,
                    borderLeft: '2px solid rgba(165, 180, 252, 0.2)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                      Sub-Akun Per Cabang (Klik baris untuk memfilter mutasi cabang)
                    </div>
                    {branchFilter !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => setBranchFilter('ALL')}
                        className="btn btn-ghost btn-xs"
                        style={{ fontSize: 11, color: '#38bdf8', padding: '1px 6px' }}
                      >
                        ✕ Tampilkan Semua Cabang
                      </button>
                    )}
                  </div>
                  {activeBranchList.map((b, idx) => {
                    const subCode = b.code || `${account.code}.${String(idx + 1).padStart(2, '0')}`;
                    const isSelected = branchFilter === b.name;

                    return (
                      <div
                        key={b.name || idx}
                        onClick={() => setBranchFilter((prev) => (prev === b.name ? 'ALL' : b.name))}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '7px 12px',
                          borderRadius: 6,
                          fontSize: 12.5,
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                          borderLeft: isSelected ? '3px solid #38bdf8' : '3px solid transparent',
                          border: isSelected ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.04)',
                          transition: 'all 0.12s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                        }}
                        title="Klik untuk memfilter transaksi jurnal cabang ini"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="mono" style={{ color: '#38bdf8', fontSize: 11.5, minWidth: 95, fontWeight: 600 }}>
                            {subCode}
                          </span>
                          <span style={{ color: isSelected ? '#ffffff' : '#cbd5e1', fontWeight: isSelected ? 600 : 400 }}>
                            {b.name}
                          </span>
                          {b.count > 0 ? (
                            <span style={{ fontSize: 10, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                              {b.count} mutasi
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.03)', padding: '1px 6px', borderRadius: 10 }}>
                              0 mutasi
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="mono" style={{ fontWeight: 600, color: b.saldo_akhir < 0 ? '#f43f5e' : '#e2e8f0', fontSize: 12.5 }}>
                            {rupiah(b.saldo_akhir)}
                          </span>
                          <ChevronRight
                            size={13}
                            color="var(--text-muted)"
                            style={{
                              transform: isSelected ? 'rotate(90deg)' : 'none',
                              transition: 'transform 0.15s ease',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Loading or Empty State or Transactions Table */}
              {accountState.loading ? (
                <div style={{ padding: 20, textAlign: 'center' }}>
                  <LoadingState message={`Memuat rincian mutasi akun [${account.code}]...`} />
                </div>
              ) : !accountState.data || !accountState.data.items || accountState.data.items.length === 0 ? (
                <div style={{ padding: '20px 24px', color: 'var(--text-muted)', fontSize: 12.5, textAlign: 'center', background: 'rgba(255, 255, 255, 0.01)', borderRadius: 10 }}>
                  <div>Tidak ada transaksi mutasi pada akun <strong>{account.code} - {account.name}</strong> untuk rentang tanggal yang dipilih ({accountState?.data?.period?.from || '-'} s/d {accountState?.data?.period?.to || '-'}).</div>
                  {(accountState.data?.saldo_awal > 0 || account.saldo_akhir > 0) && (
                    <div style={{ marginTop: 8, color: '#38bdf8', fontSize: 12 }}>
                      💡 Saldo akun saat ini (<strong>{rupiah(accountState.data?.saldo_awal || account.saldo_akhir)}</strong>) tercatat dari transaksi Saldo Awal pada tanggal sebelumnya. Silakan ubah rentang tanggal di navbar atas (misal: pilih <strong>"Bulan Ini"</strong> atau mundurkan tanggal mulai) untuk melihat riwayat jurnalnya.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  {/* Header & Filter Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Rincian Mutasi: <strong>{account.code} - {account.name}</strong> ({filteredItems.length} Transaksi)
                      </div>
                      {activeBranchList.length > 1 && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => setBranchFilter('ALL')}
                            className={`btn btn-sm ${branchFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: 10.5, padding: '2px 8px', height: 26 }}
                          >
                            Semua Cabang
                          </button>
                          {activeBranchList.map((b) => (
                            <button
                              key={b.name}
                              type="button"
                              onClick={() => setBranchFilter(b.name)}
                              className={`btn btn-sm ${branchFilter === b.name ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ fontSize: 10.5, padding: '2px 8px', height: 26 }}
                            >
                              {b.name.replace('Maroa – ', '')}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 11.5, flexWrap: 'wrap' }}>
                      {branchFilter === 'ALL' && (
                        <span>
                          Saldo Awal: <strong className="mono" style={{ color: '#ffffff' }}>{rupiah(accountState.data.summary?.saldo_awal || 0)}</strong>
                        </span>
                      )}
                      <span>
                        Total Debit: <strong className="mono" style={{ color: '#10b981' }}>{rupiah(branchFilter === 'ALL' ? accountState.data.summary?.total_debit || 0 : filteredDebit)}</strong>
                      </span>
                      <span>
                        Total Kredit: <strong className="mono" style={{ color: '#38bdf8' }}>{rupiah(branchFilter === 'ALL' ? accountState.data.summary?.total_credit || 0 : filteredCredit)}</strong>
                      </span>
                      {branchFilter === 'ALL' && (
                        <span>
                          Saldo Akhir: <strong className="mono" style={{ color: '#34d399', fontWeight: 800 }}>{rupiah(accountState.data.summary?.saldo_akhir || 0)}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <table className="table" style={{ margin: 0, fontSize: 11.5, background: 'rgba(15, 23, 42, 0.6)', borderRadius: 8, overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ background: 'rgba(0, 0, 0, 0.4)' }}>
                        <th style={{ width: 35, textAlign: 'center' }}>#</th>
                        <th style={{ width: 95 }}>Tanggal</th>
                        <th style={{ width: 140 }}>No. Jurnal (Voucher)</th>
                        <th style={{ width: 100 }}>Tipe Jurnal</th>
                        <th>Keterangan / Memo</th>
                        <th style={{ width: 160 }}>Outlet / Cabang</th>
                        <th style={{ width: 120, textAlign: 'right' }}>Debit</th>
                        <th style={{ width: 120, textAlign: 'right' }}>Kredit</th>
                        <th style={{ width: 130, textAlign: 'right' }}>Saldo Berjalan</th>
                        <th style={{ width: 70, textAlign: 'center' }}>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((tx, idx) => {
                        const bBadge = getBranchBadgeStyle(tx.outlet_name || 'Maroa – Cabang Utama (Pusat)');
                        return (
                          <tr key={idx} className="hover-row" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 10.5 }}>
                              {idx + 1}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <span className="mono" style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 11.5, background: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: 4 }}>
                                {tx.date}
                              </span>
                            </td>
                            <td>
                              <span
                                className="mono"
                                onClick={() => onOpenVoucher(tx.journal_entry_id || tx.entry_no)}
                                style={{
                                  fontWeight: 700,
                                  color: '#a78bfa',
                                  fontSize: 11.5,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                                title="Klik untuk membuka voucher jurnal"
                              >
                                {tx.entry_no}
                                <Eye size={11} style={{ opacity: 0.7 }} />
                              </span>
                            </td>
                            <td>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  background: 'rgba(255, 255, 255, 0.06)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {tx.entry_type}
                              </span>
                            </td>
                            <td style={{ color: '#ffffff' }}>
                              {tx.description || '-'}
                            </td>
                            <td>
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: 5,
                                  background: bBadge.bg,
                                  color: bBadge.color,
                                  border: `1px solid ${bBadge.border}`,
                                  whiteSpace: 'nowrap',
                                  display: 'inline-block',
                                }}
                              >
                                {bBadge.icon} {tx.outlet_name || 'Maroa – Cabang Utama (Pusat)'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span className="mono" style={{ color: tx.debit > 0 ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>
                                {tx.debit > 0 ? rupiah(tx.debit) : '-'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span className="mono" style={{ color: tx.credit > 0 ? '#38bdf8' : 'var(--text-muted)', fontWeight: 600 }}>
                                {tx.credit > 0 ? rupiah(tx.credit) : '-'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span className="mono" style={{ fontWeight: 700, color: '#ffffff' }}>
                                {rupiah(tx.running_balance)}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenVoucher(tx.journal_entry_id || tx.entry_no);
                                }}
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '2px 6px', fontSize: 10.5, color: '#38bdf8' }}
                                title="Lihat Bukti Jurnal"
                              >
                                Jurnal
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          borderTop: '2px solid rgba(165, 180, 252, 0.15)',
                          fontWeight: 800,
                        }}
                      >
                        <td colSpan={6} style={{ padding: '10px 12px', textAlign: 'right', color: '#ffffff', letterSpacing: '0.04em' }}>
                          TOTAL MUTASI {branchFilter !== 'ALL' ? `[${branchFilter}]` : `[${account.code}]`}:
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                          <span className="mono" style={{ color: '#10b981', fontWeight: 800 }}>
                            {rupiah(branchFilter === 'ALL' ? (accountState.data.summary?.total_debit || 0) : filteredDebit)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                          <span className="mono" style={{ color: '#38bdf8', fontWeight: 800 }}>
                            {rupiah(branchFilter === 'ALL' ? (accountState.data.summary?.total_credit || 0) : filteredCredit)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                          <span className="mono" style={{ color: '#34d399', fontWeight: 800, fontSize: 13 }}>
                            {rupiah(accountState.data.summary?.saldo_akhir || 0)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: '#c4b5fd', fontSize: 11 }}>
                          {filteredItems.length} tx
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
