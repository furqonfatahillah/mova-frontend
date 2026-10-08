import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  FileSpreadsheet,
  ExternalLink,
  Info,
  TrendingUp,
  Wallet,
  CreditCard,
  Scale,
  Receipt,
  Package,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Building2,
  ArrowRight,
  Sparkles,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Calendar,
  Tag,
  Filter,
  Landmark,
  Banknote,
  ShoppingBag,
  UserCheck,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { rupiah, LoadingState } from './ui';
import { exportBalanceSheetDetailToExcel } from '../utils/exportReport';
import JournalVoucherModal from './JournalVoucherModal';
import toast from 'react-hot-toast';

const CATEGORY_META = {
  SETORAN_KASIR: {
    label: 'Setoran Kasir ke Brankas / Bank',
    desc: 'Uang fisik kasir disetor ke Kas Besar / Rekening Bank saat penutupan shift.',
    icon: Landmark,
    color: '#06b6d4',
    badgeBg: 'rgba(6, 182, 212, 0.15)',
    badgeBorder: 'rgba(6, 182, 212, 0.3)',
  },
  TARIK_MODAL_KASIR: {
    label: 'Penarikan Modal Awal Kasir',
    desc: 'Pengambilan uang kas dari Kas Besar untuk modal kasir awal shift.',
    icon: Banknote,
    color: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    badgeBorder: 'rgba(56, 189, 248, 0.3)',
  },
  SHIFT_CLOSING: {
    label: 'Penyesuaian Selisih Kasir Closing',
    desc: 'Selisih uang fisik kasir saat tutup shift (Lebih = Masuk Kas / Kurang = Beban Selisih).',
    icon: Scale,
    color: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeBorder: 'rgba(245, 158, 11, 0.3)',
  },
  RECEIVABLE_PAYMENT: {
    label: 'Penerimaan Pelunasan Kasbon / Piutang',
    desc: 'Penerimaan uang kas fisik atas pelunasan kasbon karyawan atau piutang pelanggan.',
    icon: UserCheck,
    color: '#10b981',
    badgeBg: 'rgba(168, 85, 247, 0.15)',
    badgeBorder: 'rgba(168, 85, 247, 0.3)',
  },
  PENJUALAN_KASIR: {
    label: 'Penerimaan Penjualan Kasir (POS Cash)',
    desc: 'Uang kas fisik masuk dari penjualan tunai kasir kepada pelanggan.',
    icon: ShoppingBag,
    color: '#a855f7',
    badgeBg: 'rgba(168, 85, 247, 0.15)',
    badgeBorder: 'rgba(168, 85, 247, 0.3)',
  },
  BIAYA_OPERASIONAL: {
    label: 'Pengeluaran Beban Operasional Kasir (OPEX)',
    desc: 'Pengeluaran kas outlet/kasir untuk operasional rutin.',
    icon: Receipt,
    color: '#ef4444',
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    badgeBorder: 'rgba(239, 68, 68, 0.3)',
  },
  MODAL_DISETOR: {
    label: 'Penyetoran Modal Pemilik / Investor',
    desc: 'Uang modal tunai masuk dari pemilik usaha ke kas perusahaan.',
    icon: TrendingUp,
    color: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeBorder: 'rgba(16, 185, 129, 0.3)',
  },
  PRIVE_PEMILIK: {
    label: 'Penarikan Prive Pemilik Usaha',
    desc: 'Penarikan uang kas untuk kepentingan pribadi pemilik usaha.',
    icon: CreditCard,
    color: '#f43f5e',
    badgeBg: 'rgba(244, 63, 94, 0.15)',
    badgeBorder: 'rgba(244, 63, 94, 0.3)',
  },
  SALDO_AWAL: {
    label: 'Saldo Awal Modal Kasir (Modal Pemilik)',
    desc: 'Saldo modal awal kasir saat outlet pertama kali dibuka (Modal Pemilik Disetor, bukan dari Kas Besar).',
    icon: Sparkles,
    color: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    badgeBorder: 'rgba(56, 189, 248, 0.3)',
  },
};

export default function BalanceSheetDetailModal({
  isOpen,
  onClose,
  accountCode,
  accountName,
  period,
  outletId,
  outletName = 'Semua Cabang (Konsolidasi)',
  businessName = 'MOVA POS',
  onSyncSuccess,
}) {
  const navigate = useNavigate();

  const isInitialConsolidated = useMemo(() => {
    return !outletId || outletId === 'ALL' || outletId === 'all';
  }, [outletId]);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [exporting, setExporting] = useState(false);
  const [groupBy, setGroupBy] = useState('category'); // 'category' | 'date' | 'none'
  const [collapsedGroups, setCollapsedGroups] = useState({});

  // 2-Level Drilldown State: 'BRANCH_LIST' (pilihan cabang) vs 'DETAIL' (rincian mutasi transaksi)
  const [viewLevel, setViewLevel] = useState('BRANCH_LIST');
  const [drilldownOutlet, setDrilldownOutlet] = useState(null);
  const [voucherModal, setVoucherModal] = useState({
    isOpen: false,
    journalId: null,
    entryNo: null,
  });

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const params = {
        account_code: accountCode,
        account_name: accountName || '',
        from: period?.from,
        to: period?.to,
      };
      if (outletId && outletId !== 'ALL' && outletId !== 'all') {
        params.outlet_id = outletId;
      }

      const res = await api.get('/reports/balance-sheet/detail', { params });
      setDetailData(res.data);
    } catch (err) {
      console.error('Gagal mengambil detail akun neraca:', err);
      toast.error('Gagal memuat detail akun neraca');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncJournals = async () => {
    setSyncing(true);
    const toastId = toast.loading('Melakukan sinkronisasi & hitung ulang seluruh jurnal...');
    try {
      const res = await api.post('/reports/balance-sheet/sync');
      toast.success(res.data?.message || 'Sinkronisasi jurnal berhasil diselesaikan!', { id: toastId });
      await fetchDetail();
      if (onSyncSuccess) onSyncSuccess();
    } catch (err) {
      console.error('Sync journals error:', err);
      toast.error('Gagal melakukan sinkronisasi jurnal', { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !accountCode) return;
    setSearchTerm('');
    setCollapsedGroups({});
    if (isInitialConsolidated) {
      setViewLevel('BRANCH_LIST');
      setDrilldownOutlet(null);
    } else {
      setViewLevel('DETAIL');
      setDrilldownOutlet(null);
    }
    fetchDetail();
  }, [isOpen, accountCode, accountName, period?.from, period?.to, outletId, isInitialConsolidated]);

  // Branch filtered items (when in DETAIL mode and a branch is chosen)
  const branchFilteredItems = useMemo(() => {
    if (!detailData?.items) return [];
    if (!drilldownOutlet || drilldownOutlet.outlet_id === 'ALL') {
      return detailData.items;
    }
    const targetId = Number(drilldownOutlet.outlet_id);
    return detailData.items.filter((item) => {
      const itOutId = Number(item.outlet_id || 0);
      return itOutId === targetId;
    });
  }, [detailData?.items, drilldownOutlet]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!branchFilteredItems) return [];
    if (!searchTerm.trim()) return branchFilteredItems;

    const term = searchTerm.toLowerCase();
    return branchFilteredItems.filter((item) => {
      return Object.values(item).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  }, [branchFilteredItems, searchTerm]);

  // Active view balance for currently displayed branch / consolidated
  const activeViewBalance = useMemo(() => {
    if (drilldownOutlet && drilldownOutlet.outlet_id !== 'ALL') {
      return drilldownOutlet.balance !== undefined ? drilldownOutlet.balance : 0;
    }
    return detailData?.amount || 0;
  }, [drilldownOutlet, detailData]);

  const activeViewOutletTitle = useMemo(() => {
    if (drilldownOutlet) {
      return drilldownOutlet.outlet_name || (drilldownOutlet.outlet_id === 'ALL' ? 'Semua Cabang (Konsolidasi Total)' : `Cabang #${drilldownOutlet.outlet_id}`);
    }
    return outletName;
  }, [drilldownOutlet, outletName]);

  // Total of filtered items if there is an amount column
  const totalFilteredAmount = useMemo(() => {
    if (!filteredItems.length) return 0;
    return filteredItems.reduce((sum, item) => {
      const val = Number(item.amount ?? item.total_value ?? item.remaining_amount ?? 0);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [filteredItems]);

  const hasCategory = useMemo(() => {
    return Boolean(detailData?.items?.some((it) => it.category || it.raw_category));
  }, [detailData?.items]);

  const effectiveGroupBy = hasCategory ? groupBy : (groupBy === 'category' ? 'none' : groupBy);

  const isDebitNormal = useMemo(() => {
    const code = accountCode || '';
    return code.startsWith('1-') || code.startsWith('5-') || code.startsWith('6-') || code === '3-31002';
  }, [accountCode]);

  const groupedData = useMemo(() => {
    if (!filteredItems || filteredItems.length === 0) return [];

    const calcDebit = (items) =>
      items.reduce((s, it) => {
        if (it.debit !== undefined && it.debit !== null) return s + Number(it.debit);
        const dir = String(it.direction || '').toUpperCase();
        return s + (dir.includes('MASUK') || dir === 'DEBIT' ? Number(it.amount || 0) : 0);
      }, 0);

    const calcCredit = (items) =>
      items.reduce((s, it) => {
        if (it.credit !== undefined && it.credit !== null) return s + Number(it.credit);
        const dir = String(it.direction || '').toUpperCase();
        return s + (dir.includes('KELUAR') || dir === 'KREDIT' ? Number(it.amount || 0) : 0);
      }, 0);

    if (effectiveGroupBy === 'none') {
      const totalDebit = calcDebit(filteredItems);
      const totalCredit = calcCredit(filteredItems);
      return [
        {
          key: 'all',
          title: 'Semua Transaksi',
          items: filteredItems,
          totalDebit,
          totalCredit,
          netAmount: isDebitNormal ? totalDebit - totalCredit : totalCredit - totalDebit,
        },
      ];
    }

    if (effectiveGroupBy === 'date') {
      const map = new Map();
      filteredItems.forEach((item) => {
        const dateKey = item.date || 'Lainnya';
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey).push(item);
      });

      const groups = [];
      map.forEach((items, dateKey) => {
        const totalDebit = calcDebit(items);
        const totalCredit = calcCredit(items);
        groups.push({
          key: dateKey,
          type: 'date',
          title: `Tanggal: ${dateKey}`,
          subtitle: `${items.length} mutasi terbukukan pada tanggal ini`,
          icon: Calendar,
          iconColor: '#38bdf8',
          badgeBg: 'rgba(56, 189, 248, 0.12)',
          badgeBorder: 'rgba(56, 189, 248, 0.25)',
          items,
          totalDebit,
          totalCredit,
          netAmount: isDebitNormal ? totalDebit - totalCredit : totalCredit - totalDebit,
        });
      });

      groups.sort((a, b) => (b.key > a.key ? 1 : -1));
      return groups;
    }

    // effectiveGroupBy === 'category'
    const map = new Map();
    filteredItems.forEach((item) => {
      const catKey = item.category || item.raw_category || 'LAINNYA';
      if (!map.has(catKey)) map.set(catKey, []);
      map.get(catKey).push(item);
    });

    const groups = [];
    map.forEach((items, catKey) => {
      const meta = CATEGORY_META[catKey] || {
        label: catKey.replace(/_/g, ' '),
        desc: 'Transaksi mutasi buku besar untuk pos akun ini.',
        icon: Layers,
        color: '#a5b4fc',
        badgeBg: 'rgba(165, 180, 252, 0.12)',
        badgeBorder: 'rgba(165, 180, 252, 0.25)',
      };

      const totalDebit = calcDebit(items);
      const totalCredit = calcCredit(items);

      groups.push({
        key: catKey,
        type: 'category',
        title: meta.label,
        subtitle: meta.desc,
        icon: meta.icon,
        iconColor: meta.color,
        badgeBg: meta.badgeBg,
        badgeBorder: meta.badgeBorder,
        items,
        totalDebit,
        totalCredit,
        netAmount: isDebitNormal ? totalDebit - totalCredit : totalCredit - totalDebit,
      });
    });

    const categoryOrder = [
      'SETORAN_KASIR',
      'TARIK_MODAL_KASIR',
      'SHIFT_CLOSING',
      'RECEIVABLE_PAYMENT',
      'PENJUALAN_KASIR',
      'BIAYA_OPERASIONAL',
      'MODAL_DISETOR',
      'PRIVE_PEMILIK',
      'SALDO_AWAL',
    ];
    groups.sort((a, b) => {
      const idxA = categoryOrder.indexOf(a.key);
      const idxB = categoryOrder.indexOf(b.key);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return b.items.length - a.items.length;
    });

    return groups;
  }, [filteredItems, effectiveGroupBy, isDebitNormal]);

  const toggleGroup = (key) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allGroupKeys = useMemo(() => groupedData.map((g) => g.key), [groupedData]);
  const isAllCollapsed = useMemo(() => {
    if (allGroupKeys.length === 0) return false;
    return allGroupKeys.every((k) => Boolean(collapsedGroups[k]));
  }, [allGroupKeys, collapsedGroups]);

  const toggleCollapseAll = () => {
    if (isAllCollapsed) {
      setCollapsedGroups({});
    } else {
      const all = {};
      allGroupKeys.forEach((k) => {
        all[k] = true;
      });
      setCollapsedGroups(all);
    }
  };

  if (!isOpen) return null;

  // Header icon & color based on account type
  const getTheme = () => {
    const code = accountCode || '';
    if (code.startsWith('1-')) {
      return {
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.3)',
        badge: 'ASET LANCAR',
        icon: <Wallet size={20} color="#10b981" />,
      };
    }
    if (code.startsWith('2-')) {
      return {
        color: '#f43f5e',
        bg: 'rgba(244, 63, 94, 0.12)',
        border: 'rgba(244, 63, 94, 0.3)',
        badge: 'LIABILITAS (HUTANG)',
        icon: <CreditCard size={20} color="#f43f5e" />,
      };
    }
    if (code.startsWith('3-')) {
      return {
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.12)',
        border: 'rgba(56, 189, 248, 0.3)',
        badge: 'MODAL & EKUITAS',
        icon: <TrendingUp size={20} color="#38bdf8" />,
      };
    }
    return {
      color: '#a78bfa',
      bg: 'rgba(167, 139, 250, 0.12)',
      border: 'rgba(167, 139, 250, 0.3)',
      badge: 'RINGKASAN AUDIT',
      icon: <Scale size={20} color="#a78bfa" />,
    };
  };

  const theme = getTheme();

  const handleExport = async () => {
    if (!detailData) return;
    setExporting(true);
    try {
      await exportBalanceSheetDetailToExcel({
        detailData: {
          ...detailData,
          items: filteredItems,
        },
        period,
        outletName: activeViewOutletTitle,
        businessName,
      });
      toast.success('Rincian berhasil diekspor ke Excel!');
    } catch (err) {
      console.error('Export detail error:', err);
      toast.error('Gagal mengekspor data ke Excel');
    } finally {
      setExporting(false);
    }
  };

  const renderTableRow = (item, rowIdx, cols) => {
    const hasVoucher = Boolean(item.journal_id || item.ref_no);
    const isSpecialClickable = Boolean(
      ((accountCode === '1-10200' || accountCode === '1-10210') && item.id) ||
        (accountCode === '1-10110' && item.shift_id) ||
        ((accountCode === '1-10150' || accountCode === '1-10160') && (item.id || item.customer_name)) ||
        accountCode === '2-20100'
    );
    const isClickable = isSpecialClickable || hasVoucher;

    const handleRowClick = () => {
      if ((accountCode === '1-10200' || accountCode === '1-10210') && item.id) {
        onClose();
        navigate(`/kartu-stok?ingredient_id=${item.id}&search=${encodeURIComponent(item.name || '')}`);
      } else if (accountCode === '1-10110' && item.shift_id) {
        onClose();
        navigate('/shift');
      } else if ((accountCode === '1-10150' || accountCode === '1-10160') && item.id) {
        onClose();
        navigate('/piutang');
      } else if (accountCode === '2-20100' && item.id) {
        onClose();
        navigate('/hutang');
      } else if (hasVoucher) {
        setVoucherModal({
          isOpen: true,
          journalId: item.journal_id || null,
          entryNo: item.ref_no || null,
        });
      }
    };

    return (
      <tr
        key={item.id || item.ref_no || rowIdx}
        onClick={isClickable ? handleRowClick : undefined}
        title={
          hasVoucher
            ? `Klik untuk membuka Voucher Jurnal Umum [${item.ref_no || `JE-${item.journal_id}`}]`
            : isSpecialClickable
            ? 'Klik untuk melihat rincian modul terkait'
            : undefined
        }
        style={{
          borderBottom: '1px solid rgba(165, 180, 252, 0.05)',
          background: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
          cursor: isClickable ? 'pointer' : 'default',
          transition: 'background 0.12s ease',
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = isClickable
            ? 'rgba(99, 102, 241, 0.12)'
            : 'rgba(255, 255, 255, 0.04)')
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background =
            rowIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)')
        }
      >
        <td
          style={{
            padding: '8px 8px',
            verticalAlign: 'top',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 11,
          }}
        >
          {rowIdx + 1}
        </td>
        {cols.map((col, colIdx) => {
          const val = item[col.key];

          let rendered = val !== undefined && val !== null ? String(val) : '-';

          if (col.format === 'rupiah') {
            const numVal = Number(val) || 0;
            rendered = (
              <span
                className="mono"
                style={{
                  fontWeight: 700,
                  fontSize: 12,
                  color:
                    numVal < 0
                      ? '#f43f5e'
                      : numVal > 0
                      ? '#10b981'
                      : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {rupiah(numVal)}
              </span>
            );
          } else if (col.format === 'number') {
            rendered = (
              <span className="mono" style={{ fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap' }}>
                {Number(val || 0).toLocaleString('id-ID')}
              </span>
            );
          } else if (col.key === 'name' && (accountCode === '1-10200' || accountCode === '1-10210')) {
            rendered = (
              <span
                style={{
                  fontWeight: 700,
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {val}
                <ExternalLink size={12} color="var(--accent-bright)" style={{ opacity: 0.8 }} />
              </span>
            );
          } else if (col.key === 'ref_no' || col.key === 'order_number') {
            rendered = (
              <span
                className="mono"
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.08)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {val}
                {hasVoucher && <Receipt size={11} style={{ opacity: 0.8 }} />}
              </span>
            );
          } else if (col.key === 'direction') {
            const isMasuk =
              String(val).toUpperCase().includes('MASUK') || String(val).toUpperCase() === 'DEBIT';
            rendered = (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: isMasuk ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  color: isMasuk ? '#10b981' : '#f43f5e',
                  whiteSpace: 'nowrap',
                }}
              >
                {val}
              </span>
            );
          } else if (col.key === 'status_label' || col.key === 'status') {
            const str = String(val).toUpperCase();
            const isOk = str.includes('LUNAS') || str === 'PAID' || str === 'OK';
            const isPartial = str.includes('SEBAGIAN') || str === 'PARTIAL';
            rendered = (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: isOk
                    ? 'rgba(16, 185, 129, 0.15)'
                    : isPartial
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(244, 63, 94, 0.15)',
                  color: isOk ? '#10b981' : isPartial ? '#f59e0b' : '#f43f5e',
                  whiteSpace: 'nowrap',
                }}
              >
                {val}
              </span>
            );
          } else if (col.key === 'date') {
            rendered = (
              <span style={{ fontSize: 11.5, color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                {val}
              </span>
            );
          } else if (col.key === 'user_name' || col.key === 'cashier') {
            rendered = (
              <span style={{ fontSize: 11.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                {val}
              </span>
            );
          } else if (col.key === 'category') {
            rendered = (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap' }}>
                {val}
              </span>
            );
          } else if (col.key === 'description' || col.key === 'keterangan') {
            rendered = (
              <span style={{ fontSize: 12, color: '#f1f5f9' }}>
                {val}
              </span>
            );
          }

          return (
            <td
              key={colIdx}
              style={{
                padding: '8px 10px',
                verticalAlign: 'top',
                textAlign: col.align || 'left',
                color: col.align === 'right' ? '#ffffff' : 'var(--text-secondary)',
                lineHeight: '1.45',
              }}
            >
              {rendered}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <>
      <div
        className="modal-backdrop fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="modal-card card modal-xl"
          style={{
            width: '96%',
            maxWidth: '1420px',
            '--modal-max-w': '1420px',
            maxHeight: '94vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            borderRadius: '18px',
            background: 'var(--surface, #13192f)',
            border: `1px solid ${theme.border}`,
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8)',
            overflow: 'hidden',
          }}
        >
          {/* MODAL HEADER */}
          <div
            className="modal-header"
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(165, 180, 252, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(15, 20, 41, 0.75)',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: theme.bg,
                  border: `1px solid ${theme.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {theme.icon}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: theme.bg,
                      color: theme.color,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    {theme.badge}
                  </span>
                  {detailData?.account_code && !detailData.account_code.includes('TOTAL') && (
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      [{detailData.account_code}]
                    </span>
                  )}
                  {isInitialConsolidated && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                      }}
                    >
                      {viewLevel === 'BRANCH_LIST' ? '🌐 KONSOLIDASI (PILIH CABANG)' : `📍 CABANG: ${activeViewOutletTitle}`}
                    </span>
                  )}
                </div>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#ffffff',
                    margin: '4px 0 0 0',
                  }}
                >
                  {detailData?.account_name || accountName || 'Rincian Akun Neraca'}
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="hide-mobile" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Periode: {period?.from} s/d {period?.to}
                </div>
                <div style={{ fontSize: 11, color: 'var(--accent-bright)', fontWeight: 600 }}>
                  {activeViewOutletTitle}
                </div>
              </div>
              <button
                onClick={onClose}
                className="btn btn-ghost btn-icon"
                style={{
                  borderRadius: 8,
                  color: 'var(--text-secondary)',
                  width: 34,
                  height: 34,
                }}
                title="Tutup (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* MODAL BODY */}
          <div
            className="modal-body"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {loading ? (
              <div style={{ padding: '60px 0' }}>
                <LoadingState message="Memuat audit trail & rincian data neraca..." />
              </div>
            ) : !detailData ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: 'var(--text-secondary)',
                }}
              >
                <AlertCircle size={36} color="var(--warning)" style={{ margin: '0 auto 10px' }} />
                <div>Tidak ada rincian data yang ditemukan untuk akun ini.</div>
              </div>
            ) : (
              <>
                {/* 1. TOP HIGHLIGHT CARD: TOTAL VALUE & EXPLANATION */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(20, 26, 52, 0.9) 0%, rgba(15, 20, 41, 0.95) 100%)',
                    border: `1px solid ${theme.border}`,
                    borderRadius: 12,
                    padding: '12px 18px',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--text-secondary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {viewLevel === 'BRANCH_LIST'
                          ? 'Total Saldo Konsolidasi (Semua Cabang):'
                          : `Total Saldo Akun [${activeViewOutletTitle}]:`}
                      </span>
                      <div
                        className="mono"
                        style={{
                          fontSize: 24,
                          fontWeight: 800,
                          color: theme.color,
                          margin: '1px 0 0 0',
                        }}
                      >
                        {rupiah(activeViewBalance)}
                      </div>
                    </div>

                    {detailData.formula && (
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(165, 180, 252, 0.12)',
                          borderRadius: 8,
                          padding: '6px 12px',
                          maxWidth: '520px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#fbbf24',
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Rumus Akuntansi:
                        </span>
                        <div
                          className="mono"
                          style={{
                            fontSize: 11,
                            color: 'var(--text-primary)',
                            marginTop: 2,
                            lineHeight: 1.35,
                          }}
                        >
                          {detailData.formula}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Explanation text */}
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: '#cbd5e1',
                      borderTop: '1px solid rgba(165, 180, 252, 0.08)',
                      paddingTop: 8,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <Info size={15} color={theme.color} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <strong style={{ color: '#ffffff' }}>Sumber Nilai: </strong>
                      {detailData.explanation}
                    </div>
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* LEVEL 1 VIEW: DRILL-DOWN CABANG (HANYA SAAT FILTER KONSOLIDASI & BRANCH_LIST) */}
                {/* ========================================================================= */}
                {isInitialConsolidated && viewLevel === 'BRANCH_LIST' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: '#38bdf8',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Building2 size={15} color="#38bdf8" />
                        PILIH CABANG UNTUK MELIHAT RINCIAN MUTASI & JURNAL:
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDrilldownOutlet({
                            outlet_id: 'ALL',
                            outlet_name: 'Semua Cabang (Konsolidasi Total)',
                            balance: detailData.amount,
                          });
                          setViewLevel('DETAIL');
                        }}
                        style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.4)',
                          color: 'var(--accent-bright)',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>Lihat Rincian Seluruh Cabang Sekaligus</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>

                    {/* Branch Grid Cards */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: 14,
                      }}
                    >
                      {detailData.outlets_breakdown && detailData.outlets_breakdown.length > 0 ? (
                        detailData.outlets_breakdown.map((out) => {
                          const hasTx = out.tx_count > 0 || Math.abs(out.balance) > 0;
                          return (
                            <div
                              key={out.outlet_id}
                              onClick={() => {
                                setDrilldownOutlet(out);
                                setViewLevel('DETAIL');
                              }}
                              style={{
                                background: 'rgba(21, 28, 54, 0.85)',
                                border: '1px solid rgba(165, 180, 252, 0.15)',
                                borderRadius: 12,
                                padding: '16px',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                gap: 12,
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                position: 'relative',
                                overflow: 'hidden',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.6)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(99, 102, 241, 0.25)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(165, 180, 252, 0.15)';
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              {/* Card Top */}
                              <div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div
                                      style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 8,
                                        background: 'rgba(56, 189, 248, 0.12)',
                                        border: '1px solid rgba(56, 189, 248, 0.25)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                      }}
                                    >
                                      <Building2 size={18} color="#38bdf8" />
                                    </div>
                                    <div>
                                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
                                        {out.outlet_name}
                                      </h4>
                                      {out.address && (
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                          {out.address}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      background: hasTx ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                      color: hasTx ? '#10b981' : 'var(--text-muted)',
                                      border: `1px solid ${hasTx ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {out.tx_count} Mutasi
                                  </span>
                                </div>

                                {/* Saldo di cabang */}
                                <div style={{ marginTop: 14 }}>
                                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                                    Saldo Pos Akun di Cabang Ini:
                                  </div>
                                  <div
                                    className="mono"
                                    style={{
                                      fontSize: 20,
                                      fontWeight: 800,
                                      color: out.balance < 0 ? '#f43f5e' : '#10b981',
                                      marginTop: 2,
                                    }}
                                  >
                                    {rupiah(out.balance)}
                                  </div>
                                </div>
                              </div>

                              {/* Card Bottom / Stats Breakdown */}
                              <div
                                style={{
                                  borderTop: '1px solid rgba(165, 180, 252, 0.08)',
                                  paddingTop: 10,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: 11,
                                }}
                              >
                                <div style={{ display: 'flex', gap: 10 }}>
                                  <span style={{ color: '#10b981', fontWeight: 600 }}>
                                    D: {rupiah(out.total_debit)}
                                  </span>
                                  <span style={{ color: '#f43f5e', fontWeight: 600 }}>
                                    K: {rupiah(out.total_credit)}
                                  </span>
                                </div>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    color: 'var(--accent-bright)',
                                    fontWeight: 700,
                                  }}
                                >
                                  Detail Mutasi <ArrowRight size={12} />
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
                          Tidak ada daftar rincian per cabang.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* ========================================================================= */
                  /* LEVEL 2 VIEW: RINCIAN MUTASI & JURNAL (DETAIL MODE)                       */
                  /* ========================================================================= */
                  <>
                    {/* Navigation Bar & Branch Quick Switcher when initial filter was consolidated */}
                    {isInitialConsolidated && (
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(165, 180, 252, 0.12)',
                          borderRadius: 10,
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 10,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setViewLevel('BRANCH_LIST')}
                          style={{
                            background: 'rgba(56, 189, 248, 0.12)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            color: '#38bdf8',
                            borderRadius: 8,
                            padding: '5px 12px',
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <ArrowRight size={13} style={{ transform: 'rotate(180deg)' }} />
                          <span>Kembali ke Pilihan Cabang</span>
                        </button>

                        {/* Quick Branch Pills */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 2 }}>
                            Pindah Cabang:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setDrilldownOutlet({
                                outlet_id: 'ALL',
                                outlet_name: 'Semua Cabang (Konsolidasi Total)',
                                balance: detailData.amount,
                              });
                            }}
                            style={{
                              padding: '3px 8px',
                              fontSize: 11,
                              borderRadius: 6,
                              border:
                                !drilldownOutlet || drilldownOutlet.outlet_id === 'ALL'
                                  ? '1px solid var(--accent-bright)'
                                  : '1px solid rgba(255, 255, 255, 0.1)',
                              background:
                                !drilldownOutlet || drilldownOutlet.outlet_id === 'ALL'
                                  ? 'rgba(99, 102, 241, 0.3)'
                                  : 'rgba(255, 255, 255, 0.03)',
                              color:
                                !drilldownOutlet || drilldownOutlet.outlet_id === 'ALL'
                                  ? '#ffffff'
                                  : 'var(--text-secondary)',
                              cursor: 'pointer',
                              fontWeight:
                                !drilldownOutlet || drilldownOutlet.outlet_id === 'ALL' ? 700 : 500,
                            }}
                          >
                            Semua Cabang
                          </button>
                          {detailData.outlets_breakdown?.map((out) => {
                            const isSelected =
                              drilldownOutlet && String(drilldownOutlet.outlet_id) === String(out.outlet_id);
                            return (
                              <button
                                key={out.outlet_id}
                                type="button"
                                onClick={() => setDrilldownOutlet(out)}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: 11,
                                  borderRadius: 6,
                                  border: isSelected
                                    ? '1px solid var(--accent-bright)'
                                    : '1px solid rgba(255, 255, 255, 0.1)',
                                  background: isSelected
                                    ? 'rgba(99, 102, 241, 0.3)'
                                    : 'rgba(255, 255, 255, 0.03)',
                                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  fontWeight: isSelected ? 700 : 500,
                                }}
                              >
                                {out.outlet_name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 2. FORMULA COMPONENTS (KPI CARDS) */}
                    {detailData.components && detailData.components.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            marginBottom: 6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Layers size={13} color="var(--accent-bright)" />
                          Komponen Pembentuk Nilai:
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(auto-fit, minmax(130px, 1fr))`,
                            gap: 8,
                          }}
                        >
                          {detailData.components.map((comp, idx) => {
                            const compColor =
                              comp.type === 'success'
                                ? '#10b981'
                                : comp.type === 'danger'
                                ? '#f43f5e'
                                : comp.type === 'warning'
                                ? '#f59e0b'
                                : comp.type === 'primary'
                                ? theme.color
                                : '#a78bfa';

                            const formatVal = (v) => {
                              if (comp.format === 'number') return Number(v).toLocaleString('id-ID');
                              if (comp.format === 'string') return String(v);
                              return rupiah(v);
                            };

                            return (
                              <div
                                key={idx}
                                style={{
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  border: '1px solid rgba(165, 180, 252, 0.08)',
                                  borderRadius: 8,
                                  padding: '6px 10px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: 'var(--text-secondary)',
                                    fontWeight: 600,
                                    marginBottom: 2,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                  title={`${comp.prefix ? comp.prefix + ' ' : ''}${comp.label}`}
                                >
                                  {comp.prefix ? `${comp.prefix} ` : ''}
                                  {comp.label}
                                </div>
                                <div
                                  className="mono"
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 800,
                                    color: compColor,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {formatVal(comp.value)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 3. DETAILED TABLE LIST */}
                    {detailData.columns && detailData.columns.length > 0 && (
                      <div
                        style={{
                          background: 'rgba(15, 20, 41, 0.5)',
                          border: '1px solid rgba(165, 180, 252, 0.12)',
                          borderRadius: 12,
                          display: 'flex',
                          flexDirection: 'column',
                          flex: 1,
                          minHeight: '280px',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Table Control Bar */}
                        <div
                          style={{
                            padding: '8px 14px',
                            borderBottom: '1px solid rgba(165, 180, 252, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            {/* Search Box */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(165, 180, 252, 0.12)',
                                borderRadius: 8,
                                padding: '4px 10px',
                                width: '240px',
                              }}
                            >
                              <Search size={14} color="var(--text-muted)" />
                              <input
                                type="text"
                                placeholder="Cari rincian data..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#ffffff',
                                  fontSize: 12,
                                  outline: 'none',
                                  width: '100%',
                                }}
                              />
                              {searchTerm && (
                                <button
                                  onClick={() => setSearchTerm('')}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: 0,
                                  }}
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>

                            {/* View Mode Segmented Switcher */}
                            {hasCategory && (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  background: 'rgba(255, 255, 255, 0.04)',
                                  borderRadius: 8,
                                  padding: 2,
                                  border: '1px solid rgba(165, 180, 252, 0.12)',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => setGroupBy('category')}
                                  title="Kelompokkan berdasarkan Jenis Transaksi"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    fontWeight: effectiveGroupBy === 'category' ? 700 : 500,
                                    background:
                                      effectiveGroupBy === 'category'
                                        ? 'rgba(99, 102, 241, 0.85)'
                                        : 'transparent',
                                    color: effectiveGroupBy === 'category' ? '#ffffff' : 'var(--text-secondary)',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    transition: 'all 0.12s ease',
                                  }}
                                >
                                  <Tag size={12} />
                                  Group Transaksi
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setGroupBy('date')}
                                  title="Kelompokkan berdasarkan Tanggal"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    fontWeight: effectiveGroupBy === 'date' ? 700 : 500,
                                    background:
                                      effectiveGroupBy === 'date'
                                        ? 'rgba(99, 102, 241, 0.85)'
                                        : 'transparent',
                                    color: effectiveGroupBy === 'date' ? '#ffffff' : 'var(--text-secondary)',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    transition: 'all 0.12s ease',
                                  }}
                                >
                                  <Calendar size={12} />
                                  Group Tanggal
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setGroupBy('none')}
                                  title="Tampilkan semua baris dalam satu tabel datar"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    fontWeight: effectiveGroupBy === 'none' ? 700 : 500,
                                    background:
                                      effectiveGroupBy === 'none'
                                        ? 'rgba(99, 102, 241, 0.85)'
                                        : 'transparent',
                                    color: effectiveGroupBy === 'none' ? '#ffffff' : 'var(--text-secondary)',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    transition: 'all 0.12s ease',
                                  }}
                                >
                                  <Layers size={12} />
                                  Tabel Datar
                                </button>
                              </div>
                            )}

                            {/* Expand / Collapse All Button */}
                            {effectiveGroupBy !== 'none' && groupedData.length > 1 && (
                              <button
                                type="button"
                                onClick={toggleCollapseAll}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: 'var(--text-secondary)',
                                  background: 'rgba(255, 255, 255, 0.04)',
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  border: '1px solid rgba(165, 180, 252, 0.1)',
                                  cursor: 'pointer',
                                }}
                              >
                                {isAllCollapsed ? 'Buka Semua Kelompok' : 'Tutup Semua Kelompok'}
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                              Menampilkan <strong>{filteredItems.length}</strong> mutasi
                              {effectiveGroupBy !== 'none' && groupedData.length > 0
                                ? ` (${groupedData.length} kelompok)`
                                : ''}
                            </span>

                            <button
                              onClick={handleExport}
                              disabled={exporting || !filteredItems.length}
                              className="btn btn-secondary btn-sm"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 11.5,
                                padding: '5px 10px',
                              }}
                            >
                              <FileSpreadsheet size={13} color="#10b981" />
                              {exporting ? 'Mengekspor...' : 'Ekspor Excel'}
                            </button>
                          </div>
                        </div>

                        {/* Scrollable Container */}
                        <div
                          style={{
                            flex: 1,
                            minHeight: '220px',
                            maxHeight: '440px',
                            overflowY: 'auto',
                            overflowX: 'auto',
                          }}
                        >
                          {filteredItems.length === 0 ? (
                            <div
                              style={{
                                textAlign: 'center',
                                padding: '48px 16px',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {searchTerm
                                ? 'Tidak ada data yang cocok dengan pencarian'
                                : 'Belum ada data rincian mutasi untuk cabang ini'}
                            </div>
                          ) : effectiveGroupBy === 'none' ? (
                            /* FLAT TABLE MODE */
                            <table
                              style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: 12,
                              }}
                            >
                              <thead
                                style={{
                                  position: 'sticky',
                                  top: 0,
                                  background: '#151c36',
                                  zIndex: 2,
                                  boxShadow: '0 1px 0 rgba(165, 180, 252, 0.1)',
                                }}
                              >
                                <tr>
                                  <th
                                    style={{
                                      padding: '8px 10px',
                                      textAlign: 'center',
                                      width: 38,
                                      color: 'var(--text-muted)',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    #
                                  </th>
                                  {detailData.columns.map((col, idx) => (
                                    <th
                                      key={idx}
                                      style={{
                                        padding: '8px 12px',
                                        textAlign: col.align || 'left',
                                        color: 'var(--text-secondary)',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.03em',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {col.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {filteredItems.map((item, rowIdx) =>
                                  renderTableRow(item, rowIdx, detailData.columns)
                                )}
                              </tbody>
                              {totalFilteredAmount > 0 && (
                                <tfoot
                                  style={{
                                    borderTop: '2px solid rgba(165, 180, 252, 0.15)',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    fontWeight: 700,
                                  }}
                                >
                                  <tr>
                                    <td
                                      colSpan={detailData.columns.length}
                                      style={{ padding: '9px 12px', textAlign: 'right' }}
                                    >
                                      Subtotal Rincian Terfilter:
                                    </td>
                                    <td
                                      style={{
                                        padding: '9px 12px',
                                        textAlign: 'right',
                                        color: theme.color,
                                      }}
                                    >
                                      <span className="mono" style={{ fontSize: 13, fontWeight: 800 }}>
                                        {rupiah(totalFilteredAmount)}
                                      </span>
                                    </td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          ) : (
                            /* GROUPED VIEW MODE (By Category or Date) */
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                                padding: '12px',
                              }}
                            >
                              {groupedData.map((group, gIdx) => {
                                const isCollapsed = Boolean(collapsedGroups[group.key]);
                                const GroupIcon = group.icon || Layers;

                                // Hide redundant column inside group table
                                const visibleCols = detailData.columns.filter((col) => {
                                  if (effectiveGroupBy === 'category' && col.key === 'category') return false;
                                  if (effectiveGroupBy === 'date' && col.key === 'date') return false;
                                  return true;
                                });

                                return (
                                  <div
                                    key={group.key || gIdx}
                                    style={{
                                      background: 'rgba(21, 28, 54, 0.75)',
                                      border: `1px solid ${group.badgeBorder || 'rgba(165, 180, 252, 0.15)'}`,
                                      borderRadius: 10,
                                      overflow: 'hidden',
                                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
                                      transition: 'border-color 0.15s ease',
                                    }}
                                  >
                                    {/* Accordion Group Header */}
                                    <div
                                      onClick={() => toggleGroup(group.key)}
                                      style={{
                                        padding: '10px 14px',
                                        background: isCollapsed
                                          ? 'rgba(255, 255, 255, 0.02)'
                                          : 'linear-gradient(90deg, rgba(99, 102, 241, 0.09) 0%, rgba(255, 255, 255, 0.02) 100%)',
                                        borderBottom: isCollapsed
                                          ? 'none'
                                          : '1px solid rgba(165, 180, 252, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        gap: 12,
                                        transition: 'background 0.15s ease',
                                      }}
                                      onMouseEnter={(e) =>
                                        (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')
                                      }
                                      onMouseLeave={(e) =>
                                        (e.currentTarget.style.background = isCollapsed
                                          ? 'rgba(255, 255, 255, 0.02)'
                                          : 'linear-gradient(90deg, rgba(99, 102, 241, 0.09) 0%, rgba(255, 255, 255, 0.02) 100%)')
                                      }
                                    >
                                      {/* Left: Chevron, Icon, Title, Badge, Description */}
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 10,
                                          flex: 1,
                                          minWidth: 0,
                                        }}
                                      >
                                        <div
                                          style={{
                                            color: 'var(--text-muted)',
                                            display: 'flex',
                                            alignItems: 'center',
                                          }}
                                        >
                                          {isCollapsed ? (
                                            <ChevronRight size={16} />
                                          ) : (
                                            <ChevronDown size={16} />
                                          )}
                                        </div>

                                        <div
                                          style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 8,
                                            background: group.badgeBg || 'rgba(99, 102, 241, 0.15)',
                                            border: `1px solid ${
                                              group.badgeBorder || 'rgba(99, 102, 241, 0.3)'
                                            }`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                          }}
                                        >
                                          <GroupIcon
                                            size={16}
                                            color={group.iconColor || 'var(--accent-bright)'}
                                          />
                                        </div>

                                        <div style={{ minWidth: 0 }}>
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 8,
                                              flexWrap: 'wrap',
                                            }}
                                          >
                                            <span
                                              style={{
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: group.iconColor || '#ffffff',
                                                letterSpacing: '0.01em',
                                              }}
                                            >
                                              {group.title}
                                            </span>

                                            <span
                                              style={{
                                                fontSize: 10.5,
                                                fontWeight: 700,
                                                padding: '2px 8px',
                                                borderRadius: 999,
                                                background: 'rgba(255, 255, 255, 0.08)',
                                                color: '#e2e8f0',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                              }}
                                            >
                                              {group.items.length} Mutasi
                                            </span>
                                          </div>

                                          {group.subtitle && (
                                            <div
                                              style={{
                                                fontSize: 11,
                                                color: 'var(--text-muted)',
                                                marginTop: 2,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                              }}
                                              title={group.subtitle}
                                            >
                                              {group.subtitle}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Right: Totals (Debit/Credit/Net) */}
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 12,
                                          flexShrink: 0,
                                        }}
                                      >
                                        {group.totalDebit > 0 && (
                                          <div style={{ textAlign: 'right' }}>
                                            <div
                                              style={{
                                                fontSize: 9.5,
                                                color: 'var(--text-muted)',
                                                textTransform: 'uppercase',
                                                fontWeight: 600,
                                              }}
                                            >
                                              Masuk (D)
                                            </div>
                                            <div
                                              className="mono"
                                              style={{
                                                fontSize: 11.5,
                                                fontWeight: 700,
                                                color: '#10b981',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'flex-end',
                                                gap: 2,
                                              }}
                                            >
                                              <ArrowDownLeft size={12} />
                                              +{rupiah(group.totalDebit)}
                                            </div>
                                          </div>
                                        )}

                                        {group.totalCredit > 0 && (
                                          <div style={{ textAlign: 'right' }}>
                                            <div
                                              style={{
                                                fontSize: 9.5,
                                                color: 'var(--text-muted)',
                                                textTransform: 'uppercase',
                                                fontWeight: 600,
                                              }}
                                            >
                                              Keluar (K)
                                            </div>
                                            <div
                                              className="mono"
                                              style={{
                                                fontSize: 11.5,
                                                fontWeight: 700,
                                                color: '#f43f5e',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'flex-end',
                                                gap: 2,
                                              }}
                                            >
                                              <ArrowUpRight size={12} />
                                              -{rupiah(group.totalCredit)}
                                            </div>
                                          </div>
                                        )}

                                        <div
                                          style={{
                                            background: 'rgba(0, 0, 0, 0.25)',
                                            border: '1px solid rgba(165, 180, 252, 0.12)',
                                            borderRadius: 6,
                                            padding: '4px 8px',
                                            textAlign: 'right',
                                            minWidth: 90,
                                          }}
                                        >
                                          <div
                                            style={{
                                              fontSize: 9.5,
                                              color: 'var(--text-muted)',
                                              fontWeight: 600,
                                              textTransform: 'uppercase',
                                            }}
                                          >
                                            Net Mutasi
                                          </div>
                                          <div
                                            className="mono"
                                            style={{
                                              fontSize: 11.5,
                                              fontWeight: 800,
                                              color:
                                                group.netAmount > 0
                                                  ? '#10b981'
                                                  : group.netAmount < 0
                                                  ? '#f43f5e'
                                                  : 'var(--text-muted)',
                                            }}
                                          >
                                            {rupiah(group.netAmount)}
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Accordion Group Table */}
                                    {!isCollapsed && (
                                      <div style={{ overflowX: 'auto' }}>
                                        <table
                                          style={{
                                            width: '100%',
                                            borderCollapse: 'collapse',
                                            fontSize: 12,
                                          }}
                                        >
                                          <thead
                                            style={{
                                              background: 'rgba(15, 20, 41, 0.95)',
                                              boxShadow: '0 1px 0 rgba(165, 180, 252, 0.08)',
                                            }}
                                          >
                                            <tr>
                                              <th
                                                style={{
                                                  padding: '7px 8px',
                                                  textAlign: 'center',
                                                  width: 38,
                                                  color: 'var(--text-muted)',
                                                  fontSize: 10.5,
                                                  fontWeight: 700,
                                                }}
                                              >
                                                #
                                              </th>
                                              {visibleCols.map((col, idx) => (
                                                <th
                                                  key={idx}
                                                  style={{
                                                    padding: '7px 10px',
                                                    textAlign: col.align || 'left',
                                                    color: 'var(--text-secondary)',
                                                    fontSize: 10.5,
                                                    fontWeight: 700,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.03em',
                                                    whiteSpace: 'nowrap',
                                                  }}
                                                >
                                                  {col.label}
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {group.items.map((item, rowIdx) =>
                                              renderTableRow(item, rowIdx, visibleCols)
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* MODAL FOOTER */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid rgba(165, 180, 252, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(15, 20, 41, 0.75)',
              gap: 12,
            }}
          >
            <div>
              {detailData?.action_link && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    onClose();
                    navigate(detailData.action_link);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: 'var(--accent-bright)',
                    borderColor: 'rgba(99, 102, 241, 0.4)',
                  }}
                >
                  <ExternalLink size={13} />
                  {detailData.action_label || 'Buka Modul Terkait'}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleSyncJournals}
                disabled={syncing || loading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#10b981',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  background: 'rgba(16, 185, 129, 0.08)',
                  fontWeight: 600,
                }}
                title="Kalkulasi dan posting ulang seluruh jurnal pembukuan dari seluruh riwayat transaksi"
              >
                <RotateCcw size={13} className={syncing ? 'spin-anim' : ''} />
                <span>{syncing ? 'Menyinkronkan...' : 'Sinkronkan Jurnal'}</span>
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Journal Voucher Modal */}
      <JournalVoucherModal
        isOpen={voucherModal.isOpen}
        onClose={() => setVoucherModal({ isOpen: false, journalId: null, entryNo: null })}
        journalId={voucherModal.journalId}
        entryNo={voucherModal.entryNo}
      />
    </>
  );
}
