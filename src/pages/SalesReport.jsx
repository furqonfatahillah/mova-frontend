import { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import { rupiah, LoadingState, PageHeader } from '../components/ui';
import { useOutlet } from '../context/OutletContext';
import toast from 'react-hot-toast';
import {
  FileSpreadsheet,
  Printer,
  Search,
  RefreshCw,
  Calendar,
  Store,
  TrendingUp,
  Award,
  CreditCard,
  ShoppingBag,
  Users,
  Percent,
  Clock,
  CheckCircle2,
  DollarSign,
  Flame,
  BadgeAlert,
  X
} from 'lucide-react';
import { printElement } from '../utils/print';
import {
  exportSalesByProductToExcel,
  exportPointRedemptionsToExcel,
  exportSalesPaymentsToExcel,
  exportSalesTransactionsToExcel,
  exportSalesByCustomerToExcel,
  exportPeakHoursToExcel,
  exportCustomerReceivablesToExcel,
  exportPromosToExcel,
} from '../utils/exportReport';

const TABS = [
  {
    id: 'by-product',
    label: 'Penjualan per Produk',
    icon: ShoppingBag,
    title: 'LAPORAN PENJUALAN PER PRODUK',
    desc: 'Rekap volume terjual, refund, HPP modal, harga, diskon, dan omzet per varian menu produk.',
  },
  {
    id: 'point-redemptions',
    label: 'Penukaran Poin',
    icon: Award,
    title: 'LAPORAN PENUKARAN POIN',
    desc: 'Riwayat penukaran loyalty reward poin pelanggan/member menjadi diskon oleh kasir.',
  },
  {
    id: 'payments',
    label: 'Pembayaran Penjualan',
    icon: CreditCard,
    title: 'LAPORAN PEMBAYARAN PENJUALAN',
    desc: 'Rincian metode penerimaan kas (Tunai, QRIS, EDC, Transfer Bank), setoran akun kas, dan piutang.',
  },
  {
    id: 'transactions',
    label: 'Transaksi Penjualan (Detail)',
    icon: TrendingUp,
    title: 'Laporan Transaksi Penjualan',
    desc: 'Ledger item pesanan lengkap dengan breakdown HPP modal, harga jual, margin profit, dan kasir.',
  },
  {
    id: 'by-customer',
    label: 'Penjualan per Customer',
    icon: Users,
    title: 'LAPORAN DAFTAR PENJUALAN PER CUSTOMER',
    desc: 'Daftar pembelanjaan produk detail yang dikelompokkan berdasarkan nama dan kode pelanggan.',
  },
  {
    id: 'peak-hours',
    label: 'Waktu Teramai',
    icon: Clock,
    title: 'LAPORAN WAKTU TERAMAI',
    desc: 'Analisis jam sibuk 24 jam berdasarkan total penjualan, rata-rata, transaksi, produk terjual, dan tamu.',
  },
  {
    id: 'customer-receivables',
    label: 'Buku Piutang (AR)',
    icon: BadgeAlert,
    title: 'LAPORAN BUKU PIUTANG (AR CUSTOMER & AR MERCHANT)',
    desc: 'Daftar rincian piutang kasbon pelanggan, piutang non-tunai merchant (QRIS & E-Commerce/Delivery), komisi MDR, dan status pencairan (settlement).',
  },
  {
    id: 'promos',
    label: 'Laporan Promo',
    icon: Percent,
    title: 'LAPORAN PROMO',
    desc: 'Rekapitulasi penggunaan voucher/promo diskon, frekuensi transaksi, dan total nilai promo yang diberikan.',
  },
];

function formatIndoDate(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      return `${parts[2]} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export default function SalesReport() {
  const [activeTab, setActiveTab] = useState('by-product');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [arTypeFilter, setArTypeFilter] = useState('ALL'); // 'ALL' | 'CUSTOMER' | 'MERCHANT_QRIS' | 'MERCHANT_ECOMMERCE'
  const [reportData, setReportData] = useState({
    items: [],
    summary: {},
    business_name: 'MOVA POS',
    outlet_name: 'Semua Cabang (Konsolidasi)',
  });

  const { activeOutletId, activeOutlet, currentBusiness, dateRange: period } = useOutlet();
  const currentUser = JSON.parse(localStorage.getItem('pos_user') || '{}');
  const businessName = currentBusiness?.name || currentUser?.business?.name || 'MOVA POS';
  const outletName = (activeOutlet && activeOutletId !== 'ALL' && activeOutletId !== 'all') ? activeOutlet.name : 'Semua Cabang (Konsolidasi)';

  // Comparison & Evaluation States
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareMode, setCompareMode] = useState('previous_month'); // 'previous_month' | 'previous_period' | 'previous_year' | 'custom'
  const [customCompareFrom, setCustomCompareFrom] = useState('');
  const [customCompareTo, setCustomCompareTo] = useState('');

  // Default custom compare dates to 1 month prior
  useEffect(() => {
    if (period?.from && !customCompareFrom) {
      try {
        const dFrom = new Date(period.from);
        dFrom.setMonth(dFrom.getMonth() - 1);
        setCustomCompareFrom(dFrom.toISOString().slice(0, 10));

        const dTo = new Date(period.to);
        dTo.setMonth(dTo.getMonth() - 1);
        setCustomCompareTo(dTo.toISOString().slice(0, 10));
      } catch {}
    }
  }, [period]);

  useEffect(() => {
    fetchReport();
  }, [activeTab, period?.from, period?.to, activeOutletId, compareEnabled, compareMode, customCompareFrom, customCompareTo, arTypeFilter]);

  async function fetchReport() {
    setLoading(true);
    try {
      let endpoint = '';
      if (activeTab === 'by-product') endpoint = '/reports/sales/by-product';
      else if (activeTab === 'point-redemptions') endpoint = '/reports/sales/point-redemptions';
      else if (activeTab === 'payments') endpoint = '/reports/sales/payments';
      else if (activeTab === 'transactions') endpoint = '/reports/sales/transactions';
      else if (activeTab === 'by-customer') endpoint = '/reports/sales/by-customer';
      else if (activeTab === 'peak-hours') endpoint = '/reports/sales/peak-hours';
      else if (activeTab === 'customer-receivables') endpoint = '/reports/sales/customer-receivables';
      else if (activeTab === 'promos') endpoint = '/reports/sales/promos';

      const targetOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : undefined;
      const params = {
        from: period?.from,
        to: period?.to,
        outlet_id: targetOutlet,
        search: search.trim() || undefined,
      };

      if (activeTab === 'customer-receivables' && arTypeFilter !== 'ALL') {
        params.ar_type = arTypeFilter;
      }

      if (compareEnabled) {
        params.compare = 1;
        params.compare_with = compareMode;
        if (compareMode === 'custom' && customCompareFrom && customCompareTo) {
          params.compare_from = customCompareFrom;
          params.compare_to = customCompareTo;
        }
      }

      const { data } = await api.get(endpoint, { params });

      setReportData({
        items: data.items || [],
        summary: data.summary || {},
        business_name: data.business_name || businessName,
        outlet_name: data.outlet_name || outletName,
        period: data.period || period,
      });
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengambil data laporan penjualan');
    } finally {
      setLoading(false);
    }
  }

  // Filter items client-side by search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return reportData.items;
    const q = search.toLowerCase();
    return reportData.items.filter((item) => {
      return Object.values(item).some((val) => {
        if (typeof val === 'string' || typeof val === 'number') {
          return String(val).toLowerCase().includes(q);
        }
        return false;
      });
    });
  }, [reportData.items, search]);

  const searchPlaceholder = useMemo(() => {
    switch (activeTab) {
      case 'by-product':
        return 'Cari nama produk, SKU, kategori...';
      case 'point-redemptions':
        return 'Cari customer, no transaksi, reward...';
      case 'payments':
        return 'Cari no penjualan, customer, kasir...';
      case 'transactions':
        return 'Cari no nota, produk, customer, kasir...';
      case 'by-customer':
        return 'Cari nama customer, no nota, produk...';
      case 'peak-hours':
        return 'Cari jam operasional atau hari...';
      case 'customer-receivables':
        return 'Cari nama pelanggan, nota piutang...';
      case 'promos':
        return 'Cari nama promo, kode voucher...';
      default:
        return 'Cari data pada laporan ini...';
    }
  }, [activeTab]);

  // Recalculate summary if filtered
  const activeSummary = useMemo(() => {
    if (!search.trim()) return reportData.summary;
    const items = filteredItems;
    if (activeTab === 'by-product') {
      return {
        total_qty_sold: items.reduce((s, i) => s + (Number(i.qty_sold) || 0), 0),
        total_qty_refund: items.reduce((s, i) => s + (Number(i.qty_refund) || 0), 0),
        total_modal: items.reduce((s, i) => s + ((Number(i.cost_price) || 0) * (Number(i.qty_sold) || 0)), 0),
        total_discount: items.reduce((s, i) => s + (Number(i.discount_amount) || 0), 0),
        total_sales: items.reduce((s, i) => s + (Number(i.total_sales) || 0), 0),
        total_refund: items.reduce((s, i) => s + (Number(i.total_refund) || 0), 0),
      };
    }
    if (activeTab === 'point-redemptions') {
      return {
        total_qty: items.length,
        total_nilai: items.reduce((s, i) => s + (Number(i.nilai) || 0), 0),
        total_points: items.reduce((s, i) => s + (Number(i.points_used) || 0), 0),
      };
    }
    if (activeTab === 'payments') {
      return {
        total_transaction: items.reduce((s, i) => s + (Number(i.total_transaction) || 0), 0),
        total_paid: items.reduce((s, i) => s + (Number(i.paid_amount) || 0), 0),
        total_receivable: items.reduce((s, i) => s + (Number(i.receivable_amount) || 0), 0),
      };
    }
    if (activeTab === 'transactions') {
      return {
        total_discount: items.reduce((s, i) => s + (Number(i.discount_extra) || 0), 0),
        total_sales: items.reduce((s, i) => s + (Number(i.penjualan) || 0), 0),
        total_receivable: items.reduce((s, i) => s + (Number(i.piutang) || 0), 0),
        total_profit: items.reduce((s, i) => s + (Number(i.profit) || 0), 0),
      };
    }
    if (activeTab === 'by-customer') {
      return {
        total_sales: items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0),
        total_paid: items.reduce((s, i) => s + (Number(i.total_paid) || 0), 0),
        total_receivable: items.reduce((s, i) => s + (Number(i.receivable) || 0), 0),
      };
    }
    if (activeTab === 'peak-hours') {
      return {
        total_sales: items.reduce((s, i) => s + (Number(i.total_penjualan) || 0), 0),
        total_transactions: items.reduce((s, i) => s + (Number(i.transaksi) || 0), 0),
        total_products: items.reduce((s, i) => s + (Number(i.produk) || 0), 0),
        total_guests: items.reduce((s, i) => s + (Number(i.tamu) || 0), 0),
      };
    }
    if (activeTab === 'customer-receivables') {
      return {
        total_piutang: items.reduce((s, i) => s + (Number(i.piutang) || 0), 0),
        total_gross_piutang: items.reduce((s, i) => s + (Number(i.piutang) || 0), 0),
        total_mdr_fee: items.reduce((s, i) => s + (Number(i.mdr_fee) || 0), 0),
        total_net_piutang: items.reduce((s, i) => s + (Number(i.net_amount || i.piutang) || 0), 0),
        total_dibayar: items.reduce((s, i) => s + (Number(i.dibayar) || 0), 0),
        total_sisa_piutang: items.reduce((s, i) => s + (Number(i.sisa_piutang) || 0), 0),
        total_customer_piutang: items.filter(i => (i.ar_type || 'CUSTOMER') === 'CUSTOMER').reduce((s, i) => s + (Number(i.sisa_piutang) || 0), 0),
        total_merchant_qris: items.filter(i => i.ar_type === 'MERCHANT_QRIS').reduce((s, i) => s + (Number(i.sisa_piutang) || 0), 0),
        total_merchant_ecommerce: items.filter(i => i.ar_type === 'MERCHANT_ECOMMERCE').reduce((s, i) => s + (Number(i.sisa_piutang) || 0), 0),
        total_unsettled_merchant: items.filter(i => i.ar_type !== 'CUSTOMER' && i.settlement_status !== 'SETTLED').reduce((s, i) => s + (Number(i.sisa_piutang) || 0), 0),
      };
    }
    if (activeTab === 'promos') {
      return {
        total_promo: items.reduce((s, i) => s + (Number(i.jumlah_transaksi) || 0), 0),
        total_nilai: items.reduce((s, i) => s + (Number(i.nilai) || 0), 0),
        total_penjualan_promo: items.reduce((s, i) => s + (Number(i.penjualan_promo) || 0), 0),
      };
    }
    return reportData.summary;
  }, [reportData.summary, filteredItems, search, activeTab]);

  // Export handlers
  async function handleExportExcel() {
    try {
      const payload = {
        items: filteredItems,
        summary: activeSummary,
        period: period || { from: '', to: '' },
        outletName: outletName,
        businessName: businessName,
      };

      let fname = '';
      if (activeTab === 'by-product') {
        fname = await exportSalesByProductToExcel(payload);
      } else if (activeTab === 'point-redemptions') {
        fname = await exportPointRedemptionsToExcel(payload);
      } else if (activeTab === 'payments') {
        fname = await exportSalesPaymentsToExcel(payload);
      } else if (activeTab === 'transactions') {
        fname = await exportSalesTransactionsToExcel(payload);
      } else if (activeTab === 'by-customer') {
        fname = await exportSalesByCustomerToExcel(payload);
      } else if (activeTab === 'peak-hours') {
        fname = await exportPeakHoursToExcel(payload);
      } else if (activeTab === 'customer-receivables') {
        fname = await exportCustomerReceivablesToExcel(payload);
      } else if (activeTab === 'promos') {
        fname = await exportPromosToExcel(payload);
      }
      toast.success(`Laporan Excel berhasil diunduh: ${fname}`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengekspor laporan ke Excel');
    }
  }

  function handlePrintPdf() {
    const isLandscape =
      activeTab === 'transactions' ||
      activeTab === 'by-customer' ||
      activeTab === 'peak-hours' ||
      activeTab === 'customer-receivables';
    const currentTabMeta = TABS.find((t) => t.id === activeTab);
    const title = `${currentTabMeta?.title || 'Laporan Penjualan'} (${period?.from || ''} sd ${period?.to || ''})`;
    const printElId = `printable-report-${activeTab}`;

    printElement(printElId, title, {
      orientation: isLandscape ? 'landscape' : 'portrait',
      size: isLandscape ? 'A4 landscape' : 'A4 portrait',
    });
  }

  const currentTabInfo = TABS.find((t) => t.id === activeTab);
  const periodText = period?.from === period?.to
    ? `Per ${formatIndoDate(period?.from)}`
    : `Per ${formatIndoDate(period?.from)} s/d ${formatIndoDate(period?.to)}`;

  return (
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div className="flex-between mb-4 flex-wrap gap-3">
        <div>
          <PageHeader
            title="Laporan Penjualan (POS)"
            subtitle={currentTabInfo?.desc || 'Pusat analisis transaksi, penjualan produk, kasir, dan pembayaran.'}
          />
        </div>

        {/* Global Export Buttons */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchReport}
            disabled={loading}
            title="Muat ulang data"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Segarkan
          </button>

          <button
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderColor: 'rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              background: 'rgba(16, 185, 129, 0.08)',
              fontWeight: 600,
            }}
            onClick={handleExportExcel}
            title="Unduh format spreadsheet Microsoft Excel (.xlsx)"
          >
            <FileSpreadsheet size={15} /> Export Excel
          </button>

          <button
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderColor: 'rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.08)',
              fontWeight: 600,
            }}
            onClick={handlePrintPdf}
            title="Unduh / Cetak Dokumen PDF Resmi"
          >
            <Printer size={15} /> Export PDF / Cetak
          </button>
        </div>
      </div>

      {/* Report Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginBottom: 18,
          overflowX: 'auto',
          paddingBottom: 4,
          borderBottom: '1px solid var(--border)',
        }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearch('');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 15px',
                borderRadius: '8px 8px 0 0',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                background: isActive ? 'rgba(79, 70, 229, 0.12)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar Card (Uses Global Navbar Filters) */}
      <div
        className="card mb-4"
        style={{
          padding: '12px 18px',
          background: 'var(--bg-card)',
          borderRadius: 12,
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Visual Indicator of Active Scope from Global Navbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                fontSize: 12,
                color: '#38bdf8',
                fontWeight: 600,
              }}
              title="Periode sinkron otomatis dengan filter tanggal di navbar"
            >
              <Calendar size={14} />
              <span>Periode Global: <strong>{periodText}</strong></span>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                fontSize: 12,
                color: '#34d399',
                fontWeight: 600,
              }}
              title="Cabang sinkron otomatis dengan pilihan cabang di navbar"
            >
              <Store size={14} />
              <span>Cabang: <strong>{outletName}</strong></span>
            </div>
          </div>

          {/* Themed Search Bar - MOVA Midnight Violet Design System */}
          <div className="search-box" style={{ minWidth: 280, maxWidth: 380, flex: '1 1 280px' }}>
            <Search size={15} className="search-box-icon" />
            <input
              type="text"
              className="search-box-input"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <>
                <span className="search-box-badge">
                  {filteredItems.length} hasil
                </span>
                <button
                  type="button"
                  className="search-box-clear"
                  onClick={() => setSearch('')}
                  title="Hapus pencarian (Esc)"
                >
                  <X size={12} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mode Perbandingan & Evaluasi Bisnis Bar */}
      <div
        className="card mb-4"
        style={{
          padding: '14px 18px',
          background: compareEnabled
            ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.06))'
            : 'var(--bg-card)',
          borderRadius: 12,
          border: compareEnabled
            ? '1.5px solid rgba(139, 92, 246, 0.45)'
            : '1px solid var(--border)',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* Left: Toggle & Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() => setCompareEnabled(!compareEnabled)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                border: '1px solid',
                background: compareEnabled ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255, 255, 255, 0.05)',
                borderColor: compareEnabled ? '#8b5cf6' : 'rgba(165, 180, 252, 0.2)',
                color: '#ffffff',
                boxShadow: compareEnabled ? '0 2px 10px rgba(99, 102, 241, 0.4)' : 'none',
                transition: 'all 0.18s ease',
              }}
            >
              <TrendingUp size={15} />
              <span>{compareEnabled ? '✓ Mode Evaluasi Aktif' : '+ Aktifkan Mode Perbandingan'}</span>
            </button>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                Evaluasi Performa Bisnis & Perbandingan Periode
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                Bandingkan omzet penjualan, kuantitas produk, dan kas dengan bulan lalu atau rentang tanggal kustom.
              </div>
            </div>
          </div>

          {/* Right: Comparison Mode Selector (Visible when compareEnabled is true) */}
          {compareEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Bandingkan Dengan:</span>
              <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.25)', padding: 3, borderRadius: 8, border: '1px solid rgba(165, 180, 252, 0.15)' }}>
                {[
                  { id: 'previous_month', label: '📅 Bulan Lalu (MoM)' },
                  { id: 'previous_period', label: '🗓️ Periode Sebelumnya' },
                  { id: 'previous_year', label: '📆 Tahun Lalu (YoY)' },
                  { id: 'custom', label: '🎯 Tanggal Kustom' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setCompareMode(mode.id)}
                    style={{
                      fontSize: 11.5,
                      fontWeight: compareMode === mode.id ? 700 : 500,
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      background: compareMode === mode.id ? 'var(--accent)' : 'transparent',
                      color: compareMode === mode.id ? '#ffffff' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Custom date range picker (if custom mode is selected) */}
        {compareEnabled && compareMode === 'custom' && (
          <div style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid rgba(165, 180, 252, 0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Rentang Tanggal Pembanding:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="date"
                className="form-control"
                style={{ padding: '4px 8px', fontSize: 12, width: 140 }}
                value={customCompareFrom}
                onChange={(e) => setCustomCompareFrom(e.target.value)}
              />
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>s/d</span>
              <input
                type="date"
                className="form-control"
                style={{ padding: '4px 8px', fontSize: 12, width: 140 }}
                value={customCompareTo}
                onChange={(e) => setCustomCompareTo(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Comparison Range Info Badge */}
        {compareEnabled && activeSummary?.comparison && (
          <div style={{
            marginTop: 10,
            padding: '6px 12px',
            background: 'rgba(99, 102, 241, 0.1)',
            borderRadius: 6,
            fontSize: 11.5,
            color: '#c4b5fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}>
            <span>
              🔍 Membandingkan: <strong>{periodText}</strong> VS <strong>{formatIndoDate(activeSummary.comparison.period?.from)} s/d {formatIndoDate(activeSummary.comparison.period?.to)}</strong>
            </span>
            <span style={{ fontWeight: 700, color: '#34d399' }}>
              ✓ Data evaluasi pertumbuhan berhasil dikalkulasi
            </span>
          </div>
        )}
      </div>

      {/* Comparison Growth Scorecards (Evaluasi Pertumbuhan Bisnis) */}
      {compareEnabled && activeSummary?.comparison && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}>
          {/* Card 1: Omzet Growth */}
          {activeSummary.comparison.sales && (
            <div className="card" style={{ padding: '14px 16px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Pertumbuhan Omzet
                </span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: activeSummary.comparison.sales.growth_pct >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: activeSummary.comparison.sales.growth_pct >= 0 ? '#34d399' : '#f87171',
                }}>
                  {activeSummary.comparison.sales.growth_pct >= 0 ? '▲ +' : '▼ '}
                  {activeSummary.comparison.sales.growth_pct}%
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', marginTop: 6 }}>
                {rupiah(activeSummary.comparison.sales.current)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                Lalu: {rupiah(activeSummary.comparison.sales.previous)} ({activeSummary.comparison.sales.delta >= 0 ? '+' : ''}{rupiah(activeSummary.comparison.sales.delta)})
              </div>
            </div>
          )}

          {/* Card 2: Qty Sold Growth */}
          {activeSummary.comparison.qty && (
            <div className="card" style={{ padding: '14px 16px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Volume Produk Terjual
                </span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: activeSummary.comparison.qty.growth_pct >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: activeSummary.comparison.qty.growth_pct >= 0 ? '#34d399' : '#f87171',
                }}>
                  {activeSummary.comparison.qty.growth_pct >= 0 ? '▲ +' : '▼ '}
                  {activeSummary.comparison.qty.growth_pct}%
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8', marginTop: 6 }}>
                {activeSummary.comparison.qty.current?.toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                Lalu: {activeSummary.comparison.qty.previous?.toLocaleString('id-ID')} ({activeSummary.comparison.qty.delta >= 0 ? '+' : ''}{activeSummary.comparison.qty.delta})
              </div>
            </div>
          )}

          {/* Card 3: Total Transaction Growth */}
          {activeSummary.comparison.total_transaction && (
            <div className="card" style={{ padding: '14px 16px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Total Pembayaran
                </span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: activeSummary.comparison.total_transaction.growth_pct >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: activeSummary.comparison.total_transaction.growth_pct >= 0 ? '#34d399' : '#f87171',
                }}>
                  {activeSummary.comparison.total_transaction.growth_pct >= 0 ? '▲ +' : '▼ '}
                  {activeSummary.comparison.total_transaction.growth_pct}%
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#34d399', marginTop: 6 }}>
                {rupiah(activeSummary.comparison.total_transaction.current)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                Lalu: {rupiah(activeSummary.comparison.total_transaction.previous)}
              </div>
            </div>
          )}

          {/* Card 4: Discount Growth */}
          {activeSummary.comparison.discount && (
            <div className="card" style={{ padding: '14px 16px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Diskon & Promo Diberikan
                </span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#fbbf24',
                }}>
                  {activeSummary.comparison.discount.growth_pct >= 0 ? '▲ +' : '▼ '}
                  {activeSummary.comparison.discount.growth_pct}%
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24', marginTop: 6 }}>
                {rupiah(activeSummary.comparison.discount.current)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                Lalu: {rupiah(activeSummary.comparison.discount.previous)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
        {activeTab === 'by-product' && (
          <>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Qty Terjual</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
                {(activeSummary?.total_qty_sold || 0).toLocaleString('id-ID')} <span style={{ fontSize: 13, fontWeight: 500 }}>Item</span>
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Nilai Terjual</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                {rupiah(activeSummary?.total_sales || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Modal (HPP)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>
                {rupiah(activeSummary?.total_modal || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estimasi Gross Profit</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#a78bfa', marginTop: 4 }}>
                {rupiah((activeSummary?.total_sales || 0) - (activeSummary?.total_modal || 0))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'point-redemptions' && (
          <>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Penukaran</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
                {(activeSummary?.total_qty || 0).toLocaleString('id-ID')} <span style={{ fontSize: 13, fontWeight: 500 }}>Transaksi</span>
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Poin Ditukarkan</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
                {(activeSummary?.total_points || 0).toLocaleString('id-ID')} <span style={{ fontSize: 13, fontWeight: 500 }}>Poin</span>
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Nilai Reward / Diskon</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                {rupiah(activeSummary?.total_nilai || 0)}
              </div>
            </div>
          </>
        )}

        {activeTab === 'payments' && (
          <>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Transaksi</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
                {rupiah(activeSummary?.total_transaction || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Kas Diterima (Bayar)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                {rupiah(activeSummary?.total_paid || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Piutang Kasbon</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f43f5e', marginTop: 4 }}>
                {rupiah(activeSummary?.total_receivable || 0)}
              </div>
            </div>
          </>
        )}

        {activeTab === 'transactions' && (
          <>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Penjualan</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                {rupiah(activeSummary?.total_sales || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Diskon Diberikan</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>
                {rupiah(activeSummary?.total_discount || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Piutang</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f43f5e', marginTop: 4 }}>
                {rupiah(activeSummary?.total_receivable || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Profit Bersih</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#a78bfa', marginTop: 4 }}>
                {rupiah(activeSummary?.total_profit || 0)}
              </div>
            </div>
          </>
        )}

        {activeTab === 'by-customer' && (
          <>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Belanja Customer</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                {rupiah(activeSummary?.total_sales || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Pembayaran Masuk</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
                {rupiah(activeSummary?.total_paid || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sisa Piutang Customer</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f43f5e', marginTop: 4 }}>
                {rupiah(activeSummary?.total_receivable || 0)}
              </div>
            </div>
          </>
        )}

        {activeTab === 'peak-hours' && (
          <>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Penjualan 24 Jam</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                {rupiah(activeSummary?.total_sales || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Transaksi</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
                {(activeSummary?.total_transactions || 0).toLocaleString('id-ID')}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rata-rata per Transaksi</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>
                {rupiah(activeSummary?.avg_sales_overall || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Produk Terjual</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#a78bfa', marginTop: 4 }}>
                {(activeSummary?.total_products || 0).toLocaleString('id-ID')}
              </div>
            </div>
          </>
        )}

        {activeTab === 'customer-receivables' && (
          <>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Sisa Piutang Usaha</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f43f5e', marginTop: 4 }}>
                {rupiah(activeSummary?.total_sisa_piutang || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Piutang Customer (Kasbon)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
                {rupiah(activeSummary?.total_customer_piutang ?? 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>AR Merchant QRIS (Belum Cair)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>
                {rupiah(activeSummary?.total_merchant_qris || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>AR E-Commerce (Belum Cair)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#a78bfa', marginTop: 4 }}>
                {rupiah(activeSummary?.total_merchant_ecommerce || 0)}
              </div>
            </div>
          </>
        )}

        {activeTab === 'promos' && (
          <>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Transaksi Promo</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
                {(activeSummary?.total_promo || 0).toLocaleString('id-ID')} <span style={{ fontSize: 13, fontWeight: 500 }}>Kali</span>
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Nilai Promo / Diskon</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>
                {rupiah(activeSummary?.total_nilai || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Penjualan dengan Promo</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                {rupiah(activeSummary?.total_penjualan_promo || 0)}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Interactive Table */}
      {loading ? (
        <LoadingState />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
            {/* 1. TAB: PENJUALAN PER PRODUK */}
            {activeTab === 'by-product' && (
              <table style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ width: 45 }}>No.</th>
                    <th>Kode Produk</th>
                    <th>Nama Produk / Sub Produk</th>
                    <th className="right">Qty Terjual</th>
                    {compareEnabled && <th className="right" style={{ color: '#c4b5fd' }}>Qty Lalu</th>}
                    {compareEnabled && <th className="right" style={{ color: '#c4b5fd' }}>Selisih Qty</th>}
                    <th className="right">Qty Refund</th>
                    <th>Satuan</th>
                    <th className="right">Modal (HPP)</th>
                    <th className="right">Harga</th>
                    <th className="right">Disc</th>
                    <th className="right">Total Nilai Terjual</th>
                    {compareEnabled && <th className="right" style={{ color: '#34d399' }}>Omzet Lalu</th>}
                    {compareEnabled && <th className="center" style={{ color: '#c4b5fd' }}>Pertumbuhan %</th>}
                    <th className="right">Total Nilai Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={compareEnabled ? 15 : 11} className="text-center" style={{ padding: 36, color: 'var(--text-muted)' }}>
                        {search ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                            <div>Tidak ada produk yang cocok dengan kata kunci <strong>"{search}"</strong>.</div>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSearch('')}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                            >
                              <X size={12} /> Bersihkan Pencarian
                            </button>
                          </div>
                        ) : (
                          'Tidak ada data penjualan produk untuk periode ini.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.code || '-'}</td>
                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                        <td className="right" style={{ fontWeight: 700, color: '#38bdf8' }}>
                          {item.qty_sold?.toLocaleString('id-ID')}
                        </td>
                        {compareEnabled && (
                          <td className="right" style={{ color: '#c4b5fd' }}>
                            {(item.compare_qty_sold || 0).toLocaleString('id-ID')}
                          </td>
                        )}
                        {compareEnabled && (
                          <td className="right" style={{ fontWeight: 700, color: (item.delta_qty || 0) >= 0 ? '#34d399' : '#f87171' }}>
                            {(item.delta_qty || 0) > 0 ? '+' : ''}{(item.delta_qty || 0).toLocaleString('id-ID')}
                          </td>
                        )}
                        <td className="right" style={{ color: item.qty_refund > 0 ? '#f43f5e' : 'inherit' }}>
                          {item.qty_refund?.toLocaleString('id-ID')}
                        </td>
                        <td>{item.unit || 'Cup'}</td>
                        <td className="right">{rupiah(item.cost_price)}</td>
                        <td className="right">{rupiah(item.price)}</td>
                        <td className="right" style={{ color: item.discount_amount > 0 ? '#fbbf24' : 'inherit' }}>
                          {rupiah(item.discount_amount)}
                        </td>
                        <td className="right" style={{ fontWeight: 700, color: '#34d399' }}>
                          {rupiah(item.total_sales)}
                        </td>
                        {compareEnabled && (
                          <td className="right" style={{ color: '#94a3b8' }}>
                            {rupiah(item.compare_total_sales || 0)}
                          </td>
                        )}
                        {compareEnabled && (
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              fontSize: 10.5,
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: (item.growth_sales_pct || 0) >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: (item.growth_sales_pct || 0) >= 0 ? '#34d399' : '#f87171',
                            }}>
                              {(item.growth_sales_pct || 0) >= 0 ? '▲ +' : '▼ '}
                              {item.growth_sales_pct || 0}%
                            </span>
                          </td>
                        )}
                        <td className="right" style={{ color: item.total_refund > 0 ? '#f43f5e' : 'inherit' }}>
                          {rupiah(item.total_refund)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 800, background: 'rgba(255, 255, 255, 0.04)', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={3}>Total</td>
                    <td className="right" style={{ color: '#38bdf8' }}>
                      {activeSummary?.total_qty_sold?.toLocaleString('id-ID')}
                    </td>
                    {compareEnabled && (
                      <td className="right" style={{ color: '#c4b5fd' }}>
                        {(activeSummary?.comparison?.qty?.previous || 0).toLocaleString('id-ID')}
                      </td>
                    )}
                    {compareEnabled && (
                      <td className="right" style={{ color: (activeSummary?.comparison?.qty?.delta || 0) >= 0 ? '#34d399' : '#f87171' }}>
                        {(activeSummary?.comparison?.qty?.delta || 0) > 0 ? '+' : ''}{(activeSummary?.comparison?.qty?.delta || 0).toLocaleString('id-ID')}
                      </td>
                    )}
                    <td className="right">{activeSummary?.total_qty_refund?.toLocaleString('id-ID')}</td>
                    <td></td>
                    <td className="right">{rupiah(activeSummary?.total_modal || 0)}</td>
                    <td></td>
                    <td className="right" style={{ color: '#fbbf24' }}>
                      {rupiah(activeSummary?.total_discount || 0)}
                    </td>
                    <td className="right" style={{ color: '#34d399' }}>
                      {rupiah(activeSummary?.total_sales || 0)}
                    </td>
                    {compareEnabled && (
                      <td className="right" style={{ color: '#94a3b8' }}>
                        {rupiah(activeSummary?.comparison?.sales?.previous || 0)}
                      </td>
                    )}
                    {compareEnabled && (
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: (activeSummary?.comparison?.sales?.growth_pct || 0) >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: (activeSummary?.comparison?.sales?.growth_pct || 0) >= 0 ? '#34d399' : '#f87171',
                        }}>
                          {(activeSummary?.comparison?.sales?.growth_pct || 0) >= 0 ? '▲ +' : '▼ '}
                          {activeSummary?.comparison?.sales?.growth_pct || 0}%
                        </span>
                      </td>
                    )}
                    <td className="right">{rupiah(activeSummary?.total_refund || 0)}</td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* 2. TAB: PENUKARAN POIN */}
            {activeTab === 'point-redemptions' && (
              <table style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ width: 45 }}>No</th>
                    <th>Tanggal</th>
                    <th>Tgl. Dibuat</th>
                    <th>Dibuat Oleh</th>
                    <th>Warehouse</th>
                    <th>Customer</th>
                    <th>Kasir</th>
                    <th>No.Transaksi</th>
                    <th>Penukaran</th>
                    <th className="right">Qty</th>
                    <th className="right">Nilai</th>
                    <th className="right">Poin</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="text-center" style={{ padding: 32, color: 'var(--text-muted)' }}>
                        Tidak ada riwayat penukaran poin dalam periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{idx + 1}</td>
                        <td>{item.date}</td>
                        <td style={{ fontSize: 12 }}>{item.created_at}</td>
                        <td>{item.created_by}</td>
                        <td>{item.warehouse}</td>
                        <td style={{ fontWeight: 600 }}>{item.customer}</td>
                        <td>{item.cashier}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item.order_number}</td>
                        <td style={{ fontWeight: 600, color: '#38bdf8' }}>{item.penukaran}</td>
                        <td className="right">{item.qty}</td>
                        <td className="right" style={{ fontWeight: 700, color: '#34d399' }}>
                          {rupiah(item.nilai)}
                        </td>
                        <td className="right" style={{ fontWeight: 800, color: '#f59e0b' }}>
                          {item.points_used?.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 800, background: 'rgba(255, 255, 255, 0.04)', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={9}>Total</td>
                    <td className="right">{activeSummary?.total_qty || filteredItems.length}</td>
                    <td className="right" style={{ color: '#34d399' }}>
                      {rupiah(activeSummary?.total_nilai || 0)}
                    </td>
                    <td className="right" style={{ color: '#f59e0b' }}>
                      {(activeSummary?.total_points || 0).toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* 3. TAB: PEMBAYARAN PENJUALAN */}
            {activeTab === 'payments' && (
              <table style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ width: 45 }}>No.</th>
                    <th>Tanggal</th>
                    <th>Jam</th>
                    <th>Tgl. Dibuat</th>
                    <th>Dibuat Oleh</th>
                    <th>Warehouse</th>
                    <th>No.Penjualan</th>
                    <th>No.Pembayaran</th>
                    <th>Customer</th>
                    <th>Jenis Bayar</th>
                    <th>Disetor Ke</th>
                    <th className="right">Total Transaksi</th>
                    <th className="right">Bayar</th>
                    <th className="right">Piutang</th>
                    <th>Kasir</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="text-center" style={{ padding: 32, color: 'var(--text-muted)' }}>
                        Tidak ada riwayat pembayaran penjualan dalam periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{idx + 1}</td>
                        <td>{item.date}</td>
                        <td>{item.time}</td>
                        <td style={{ fontSize: 12 }}>{item.created_at}</td>
                        <td>{item.created_by}</td>
                        <td>{item.warehouse}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.order_number}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item.payment_number || '-'}</td>
                        <td style={{ fontWeight: 600 }}>{item.customer || '-'}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background:
                                item.payment_method === 'Tunai'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : 'rgba(56, 189, 248, 0.15)',
                              color: item.payment_method === 'Tunai' ? '#34d399' : '#38bdf8',
                              fontWeight: 600,
                            }}
                          >
                            {item.payment_method}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>{item.deposit_account}</td>
                        <td className="right" style={{ fontWeight: 600 }}>{rupiah(item.total_transaction)}</td>
                        <td className="right" style={{ fontWeight: 700, color: '#34d399' }}>
                          {rupiah(item.paid_amount)}
                        </td>
                        <td className="right" style={{ color: item.receivable_amount > 0 ? '#f43f5e' : 'inherit' }}>
                          {rupiah(item.receivable_amount)}
                        </td>
                        <td>{item.cashier}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 800, background: 'rgba(255, 255, 255, 0.04)', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={11}>Total</td>
                    <td className="right">{rupiah(activeSummary?.total_transaction || 0)}</td>
                    <td className="right" style={{ color: '#34d399' }}>{rupiah(activeSummary?.total_paid || 0)}</td>
                    <td className="right" style={{ color: '#f43f5e' }}>{rupiah(activeSummary?.total_receivable || 0)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* 4. TAB: TRANSAKSI PENJUALAN (DETAIL) */}
            {activeTab === 'transactions' && (
              <table style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>No.</th>
                    <th>Tgl & Jam</th>
                    <th>Dibuat Oleh</th>
                    <th>No.Ref</th>
                    <th>Customer</th>
                    <th>Jenis Bayar</th>
                    <th>Setor Ke</th>
                    <th>Kode Produk</th>
                    <th>Produk / Sub Produk</th>
                    <th>Kategori</th>
                    <th className="right">HPP</th>
                    <th className="right">Qty</th>
                    <th>Satuan</th>
                    <th className="right">Harga Jual</th>
                    <th className="right">Disc</th>
                    <th className="right">Subtotal</th>
                    <th className="right">Penjualan</th>
                    <th className="right">Piutang</th>
                    <th className="right">Profit</th>
                    <th>Kasir</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={20} className="text-center" style={{ padding: 32, color: 'var(--text-muted)' }}>
                        Tidak ada transaksi penjualan dalam periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => (
                      <tr key={idx} style={{ background: item.is_first_in_order ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                        <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                          {item.order_row_no || idx + 1}
                        </td>
                        <td style={{ fontSize: 11 }}>{item.date}</td>
                        <td>{item.created_by}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.order_number}</td>
                        <td style={{ fontWeight: 600 }}>{item.customer || 'Walk-in Customer'}</td>
                        <td>{item.payment_method}</td>
                        <td style={{ fontSize: 11 }}>{item.deposit_account}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item.item_code}</td>
                        <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                        <td>{item.category}</td>
                        <td className="right">{rupiah(item.cost_price)}</td>
                        <td className="right" style={{ fontWeight: 700 }}>{item.qty}</td>
                        <td>{item.unit}</td>
                        <td className="right">{rupiah(item.unit_price)}</td>
                        <td className="right" style={{ color: item.discount > 0 ? '#fbbf24' : 'inherit' }}>
                          {rupiah(item.discount)}
                        </td>
                        <td className="right" style={{ fontWeight: 600 }}>{rupiah(item.subtotal)}</td>
                        <td className="right" style={{ fontWeight: 700, color: '#34d399' }}>
                          {rupiah(item.penjualan)}
                        </td>
                        <td className="right" style={{ color: item.piutang > 0 ? '#f43f5e' : 'inherit' }}>
                          {rupiah(item.piutang)}
                        </td>
                        <td className="right" style={{ fontWeight: 700, color: item.profit >= 0 ? '#a78bfa' : '#f43f5e' }}>
                          {rupiah(item.profit)}
                        </td>
                        <td>{item.cashier}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 800, background: 'rgba(255, 255, 255, 0.04)', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={14}>Total</td>
                    <td className="right" style={{ color: '#fbbf24' }}>
                      {rupiah(activeSummary?.total_discount || 0)}
                    </td>
                    <td></td>
                    <td className="right" style={{ color: '#34d399' }}>
                      {rupiah(activeSummary?.total_sales || 0)}
                    </td>
                    <td className="right" style={{ color: '#f43f5e' }}>
                      {rupiah(activeSummary?.total_receivable || 0)}
                    </td>
                    <td className="right" style={{ color: '#a78bfa' }}>
                      {rupiah(activeSummary?.total_profit || 0)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* 5. TAB: PENJUALAN PER CUSTOMER */}
            {activeTab === 'by-customer' && (
              <table style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>No.</th>
                    <th>Tanggal</th>
                    <th>Kode Cust</th>
                    <th>Customer</th>
                    <th>No.Ref</th>
                    <th>Produk</th>
                    <th className="right">Qty</th>
                    <th>Satuan</th>
                    <th className="right">Harga Satuan</th>
                    <th className="right">Disc</th>
                    <th className="right">Total</th>
                    <th className="right">Total Bayar</th>
                    <th>Jenis Bayar</th>
                    <th className="right">Piutang</th>
                    <th>Kasir</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="text-center" style={{ padding: 32, color: 'var(--text-muted)' }}>
                        Tidak ada data penjualan per customer dalam periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ fontSize: 11 }}>{item.date}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item.customer_code || '-'}</td>
                        <td style={{ fontWeight: 600 }}>{item.customer_name || 'Walk-in'}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item.order_number}</td>
                        <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                        <td className="right" style={{ fontWeight: 700 }}>{item.qty}</td>
                        <td>{item.unit}</td>
                        <td className="right">{rupiah(item.unit_price)}</td>
                        <td className="right" style={{ color: item.discount > 0 ? '#fbbf24' : 'inherit' }}>
                          {rupiah(item.discount)}
                        </td>
                        <td className="right" style={{ fontWeight: 700 }}>{rupiah(item.subtotal)}</td>
                        <td className="right" style={{ fontWeight: 700, color: '#34d399' }}>
                          {rupiah(item.total_paid)}
                        </td>
                        <td>{item.payment_method}</td>
                        <td className="right" style={{ color: item.receivable > 0 ? '#f43f5e' : 'inherit' }}>
                          {rupiah(item.receivable)}
                        </td>
                        <td>{item.cashier}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 800, background: 'rgba(255, 255, 255, 0.04)', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={10}>Total Penjualan Semua Customer</td>
                    <td className="right">{rupiah(activeSummary?.total_sales || 0)}</td>
                    <td className="right" style={{ color: '#34d399' }}>{rupiah(activeSummary?.total_paid || 0)}</td>
                    <td></td>
                    <td className="right" style={{ color: '#f43f5e' }}>{rupiah(activeSummary?.total_receivable || 0)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* 6. TAB: WAKTU TERAMAI */}
            {activeTab === 'peak-hours' && (
              <table style={{ fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={{ width: 45 }}>No.</th>
                    <th>Waktu</th>
                    <th className="right">Total Penjualan (Rp)</th>
                    <th className="right">Rata-rata Penjualan (Rp)</th>
                    <th className="right">Penjualan (%)</th>
                    <th className="right">Transaksi</th>
                    <th className="right">Transaksi (%)</th>
                    <th className="right">Produk</th>
                    <th className="right">Produk (%)</th>
                    <th className="right">Tamu</th>
                    <th className="right">Tamu (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => (
                    <tr key={idx} style={{ background: item.total_penjualan > 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#38bdf8' }}>{item.waktu}</td>
                      <td className="right" style={{ fontWeight: 700, color: item.total_penjualan > 0 ? '#34d399' : 'inherit' }}>
                        {rupiah(item.total_penjualan)}
                      </td>
                      <td className="right">{rupiah(item.avg_penjualan)}</td>
                      <td className="right" style={{ color: '#fbbf24' }}>{item.penjualan_pct}%</td>
                      <td className="right" style={{ fontWeight: 600 }}>{item.transaksi}</td>
                      <td className="right">{item.transaksi_pct}%</td>
                      <td className="right">{item.produk}</td>
                      <td className="right">{item.produk_pct}%</td>
                      <td className="right">{item.tamu}</td>
                      <td className="right">{item.tamu_pct}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 800, background: 'rgba(255, 255, 255, 0.04)', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={2}>Total</td>
                    <td className="right" style={{ color: '#34d399' }}>{rupiah(activeSummary?.total_sales || 0)}</td>
                    <td className="right">{rupiah(activeSummary?.avg_sales_overall || 0)}</td>
                    <td className="right" style={{ color: '#fbbf24' }}>100%</td>
                    <td className="right">{activeSummary?.total_transactions || 0}</td>
                    <td className="right">100%</td>
                    <td className="right">{activeSummary?.total_products || 0}</td>
                    <td className="right">100%</td>
                    <td className="right">{activeSummary?.total_guests || 0}</td>
                    <td className="right">100%</td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* 7. TAB: BUKU PIUTANG (AR CUSTOMER & AR MERCHANT) */}
            {activeTab === 'customer-receivables' && (
              <>
                <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginRight: 6 }}>Filter Kategori Piutang:</span>
                  {[
                    { id: 'ALL', label: 'Semua Piutang' },
                    { id: 'CUSTOMER', label: 'Kasbon Customer (Pelanggan)' },
                    { id: 'MERCHANT_QRIS', label: 'AR Merchant QRIS' },
                    { id: 'MERCHANT_ECOMMERCE', label: 'AR E-Commerce (Delivery)' },
                  ].map(btn => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setArTypeFilter(btn.id)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 6,
                        border: 'none',
                        fontSize: 12,
                        fontWeight: arTypeFilter === btn.id ? 700 : 500,
                        cursor: 'pointer',
                        background: arTypeFilter === btn.id ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                        color: arTypeFilter === btn.id ? '#ffffff' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <table style={{ fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>No.</th>
                      <th>Kategori AR</th>
                      <th>Debitur / Merchant</th>
                      <th>Tanggal & Jam</th>
                      <th>No.Penjualan / Order</th>
                      <th className="right">Gross Piutang</th>
                      <th className="right">MDR / Komisi</th>
                      <th className="right">Net Piutang</th>
                      <th className="right">Dibayar / Cair</th>
                      <th className="right">Sisa Piutang</th>
                      <th style={{ textAlign: 'center' }}>Status Settlement</th>
                      <th>Jatuh Tempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="text-center" style={{ padding: 32, color: 'var(--text-muted)' }}>
                          Tidak ada catatan piutang usaha ({arTypeFilter === 'ALL' ? 'Customer & Merchant' : arTypeFilter}) dalam periode ini.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item, idx) => {
                        const isQris = item.ar_type === 'MERCHANT_QRIS';
                        const isEcom = item.ar_type === 'MERCHANT_ECOMMERCE';

                        return (
                          <tr key={idx}>
                            <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{idx + 1}</td>
                            <td>
                              <span
                                className="badge"
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: isQris
                                    ? 'rgba(245, 158, 11, 0.15)'
                                    : isEcom
                                    ? 'rgba(168, 85, 247, 0.15)'
                                    : 'rgba(56, 189, 248, 0.15)',
                                  color: isQris ? '#fbbf24' : isEcom ? '#c084fc' : '#38bdf8',
                                }}
                              >
                                {isQris ? 'AR QRIS' : isEcom ? `AR ${item.merchant_channel || 'E-COM'}` : 'CUSTOMER'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700 }}>
                              {item.customer || item.merchant_channel || '-'}
                            </td>
                            <td style={{ fontSize: 11.5 }}>
                              {item.tanggal} {item.jam && <span style={{ color: 'var(--text-muted)' }}>{item.jam}</span>}
                            </td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.no_penjualan}</td>
                            <td className="right">{rupiah(item.piutang)}</td>
                            <td className="right" style={{ color: item.mdr_fee > 0 ? '#fbbf24' : 'inherit', fontSize: 11.5 }}>
                              {item.mdr_fee > 0 ? rupiah(item.mdr_fee) : '-'}
                            </td>
                            <td className="right" style={{ fontWeight: 600 }}>
                              {rupiah(item.net_amount || item.piutang)}
                            </td>
                            <td className="right" style={{ color: '#34d399' }}>{rupiah(item.dibayar)}</td>
                            <td className="right" style={{ fontWeight: 700, color: item.sisa_piutang > 0 ? '#f43f5e' : 'inherit' }}>
                              {rupiah(item.sisa_piutang)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                className="badge"
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: (item.settlement_status === 'SETTLED' || item.sisa_piutang <= 0)
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : 'rgba(239, 68, 68, 0.15)',
                                  color: (item.settlement_status === 'SETTLED' || item.sisa_piutang <= 0)
                                    ? '#34d399'
                                    : '#f87171',
                                }}
                              >
                                {item.settlement_status || (item.sisa_piutang <= 0 ? 'LUNAS' : 'BELUM LUNAS')}
                              </span>
                            </td>
                            <td style={{ fontSize: 11.5 }}>{item.jatuh_tempo || '-'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 800, background: 'rgba(255, 255, 255, 0.04)', borderTop: '2px solid var(--border)' }}>
                      <td colSpan={5}>Total Piutang</td>
                      <td className="right">{rupiah(activeSummary?.total_gross_piutang || activeSummary?.total_piutang || 0)}</td>
                      <td className="right" style={{ color: '#fbbf24' }}>{rupiah(activeSummary?.total_mdr_fee || 0)}</td>
                      <td className="right">{rupiah(activeSummary?.total_net_piutang || 0)}</td>
                      <td className="right" style={{ color: '#34d399' }}>{rupiah(activeSummary?.total_dibayar || 0)}</td>
                      <td className="right" style={{ color: '#f43f5e' }}>{rupiah(activeSummary?.total_sisa_piutang || 0)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )}

            {/* 8. TAB: LAPORAN PROMO */}
            {activeTab === 'promos' && (
              <table style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ width: 45 }}>No.</th>
                    <th>Tanggal</th>
                    <th>Promo</th>
                    <th>Jenis</th>
                    <th className="right">Jumlah Transaksi</th>
                    <th className="right">Nilai (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center" style={{ padding: 32, color: 'var(--text-muted)' }}>
                        Tidak ada penggunaan promo atau voucher dalam periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{idx + 1}</td>
                        <td>{item.tanggal}</td>
                        <td style={{ fontWeight: 700, color: '#38bdf8' }}>{item.promo}</td>
                        <td>
                          <span className="badge" style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>
                            {item.jenis}
                          </span>
                        </td>
                        <td className="right" style={{ fontWeight: 600 }}>{item.jumlah_transaksi}</td>
                        <td className="right" style={{ fontWeight: 700, color: '#34d399' }}>{rupiah(item.nilai)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 800, background: 'rgba(255, 255, 255, 0.04)', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={4}>Total Promo</td>
                    <td className="right" style={{ color: '#38bdf8' }}>{activeSummary?.total_promo || 0}</td>
                    <td className="right" style={{ color: '#34d399' }}>{rupiah(activeSummary?.total_nilai || 0)}</td>
                  </tr>
                  <tr style={{ fontWeight: 800, background: 'rgba(255, 255, 255, 0.06)' }}>
                    <td colSpan={5}>Total Penjualan Promo</td>
                    <td className="right" style={{ color: '#a78bfa' }}>{rupiah(activeSummary?.total_penjualan_promo || 0)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HIDDEN PRINTABLE CONTAINERS FOR DIRECT HIGH-DEFINITION PDF / PRINT EXPORT */}
      {/* ========================================================================= */}

      {/* 1. PRINTABLE: PENJUALAN PER PRODUK */}
      <div id="printable-report-by-product" style={{ display: 'none' }}>
        <div style={{ padding: 15, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", color: '#000000' }}>
          <div style={{ borderBottom: '2px solid #000000', paddingBottom: 10, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 900 }}>
              {reportData.business_name}
            </h2>
            <div style={{ fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
              LAPORAN PENJUALAN PER PRODUK
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              {periodText} | Cabang: {reportData.outlet_name} | Dicetak: {new Date().toLocaleString('id-ID')}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, margin: '8px 0' }}>
            <thead>
              <tr style={{ background: '#f4f4f4', borderBottom: '1px solid #000' }}>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'center' }}>No.</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Kode Produk</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Nama Produk / Sub Produk</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Qty Terjual</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Qty Refund</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'center' }}>Satuan</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Modal</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Harga</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Disc</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Total Nilai Terjual</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Total Nilai Refund</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.code || '-'}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 'bold' }}>{it.name}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{it.qty_sold}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{it.qty_refund}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{it.unit || 'Cup'}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{Number(it.cost_price).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{Number(it.price).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{Number(it.discount_amount).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{Number(it.total_sales).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{Number(it.total_refund).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 900, background: '#f4f4f4', borderTop: '2px solid #000' }}>
                <td colSpan={3} style={{ border: '1px solid #000', padding: '6px 8px' }}>Total</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{Number(activeSummary?.total_qty_sold || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{Number(activeSummary?.total_qty_refund || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px' }}></td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{Number(activeSummary?.total_modal || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px' }}></td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{Number(activeSummary?.total_discount || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{Number(activeSummary?.total_sales || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{Number(activeSummary?.total_refund || 0).toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 2. PRINTABLE: PENUKARAN POIN */}
      <div id="printable-report-point-redemptions" style={{ display: 'none' }}>
        <div style={{ padding: 15, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", color: '#000000' }}>
          <div style={{ borderBottom: '2px solid #000000', paddingBottom: 10, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 900 }}>
              {reportData.business_name}
            </h2>
            <div style={{ fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
              LAPORAN PENUKARAN POIN
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              {periodText} | Cabang: {reportData.outlet_name} | Dicetak: {new Date().toLocaleString('id-ID')}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, margin: '8px 0' }}>
            <thead>
              <tr style={{ background: '#f4f4f4', borderBottom: '1px solid #000' }}>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'center' }}>No</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Tanggal</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Tgl. Dibuat</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Dibuat Oleh</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Warehouse</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Customer</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Kasir</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>No.Transaksi</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Penukaran</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Qty</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Nilai</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Poin</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.date}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.created_at}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.created_by}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.warehouse}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 'bold' }}>{it.customer}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.cashier}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.order_number}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.penukaran}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{it.qty}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{Number(it.nilai).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{Number(it.points_used).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 900, background: '#f4f4f4', borderTop: '2px solid #000' }}>
                <td colSpan={9} style={{ border: '1px solid #000', padding: '6px 8px' }}>Total</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{activeSummary?.total_qty || filteredItems.length}</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{Number(activeSummary?.total_nilai || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{Number(activeSummary?.total_points || 0).toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 3. PRINTABLE: PEMBAYARAN PENJUALAN */}
      <div id="printable-report-payments" style={{ display: 'none' }}>
        <div style={{ padding: 15, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", color: '#000000' }}>
          <div style={{ borderBottom: '2px solid #000000', paddingBottom: 10, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 900 }}>
              {reportData.business_name}
            </h2>
            <div style={{ fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
              LAPORAN PEMBAYARAN PENJUALAN
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              {periodText} | Cabang: {reportData.outlet_name} | Dicetak: {new Date().toLocaleString('id-ID')}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5, margin: '8px 0' }}>
            <thead>
              <tr style={{ background: '#f4f4f4', borderBottom: '1px solid #000' }}>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center' }}>No.</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>Tanggal</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>Jam</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>Tgl. Dibuat</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>Dibuat Oleh</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>Warehouse</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>No.Penjualan</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>No.Pembayaran</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>Customer</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>Jenis Bayar</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>Disetor Ke</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>Total Transaksi</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>Bayar</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>Piutang</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>Kasir</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '4px' }}>{it.date}</td>
                  <td style={{ border: '1px solid #000', padding: '4px' }}>{it.time}</td>
                  <td style={{ border: '1px solid #000', padding: '4px' }}>{it.created_at}</td>
                  <td style={{ border: '1px solid #000', padding: '4px' }}>{it.created_by}</td>
                  <td style={{ border: '1px solid #000', padding: '4px' }}>{it.warehouse}</td>
                  <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{it.order_number}</td>
                  <td style={{ border: '1px solid #000', padding: '4px' }}>{it.payment_number || ''}</td>
                  <td style={{ border: '1px solid #000', padding: '4px' }}>{it.customer || '-'}</td>
                  <td style={{ border: '1px solid #000', padding: '4px' }}>{it.payment_method}</td>
                  <td style={{ border: '1px solid #000', padding: '4px' }}>{it.deposit_account}</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{Number(it.total_transaction).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{Number(it.paid_amount).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{Number(it.receivable_amount).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '4px' }}>{it.cashier}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 900, background: '#f4f4f4', borderTop: '2px solid #000' }}>
                <td colSpan={11} style={{ border: '1px solid #000', padding: '6px' }}>Total</td>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{Number(activeSummary?.total_transaction || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{Number(activeSummary?.total_paid || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{Number(activeSummary?.total_receivable || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '6px' }}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 4. PRINTABLE: TRANSAKSI PENJUALAN (DETAIL) */}
      <div id="printable-report-transactions" style={{ display: 'none' }}>
        <div style={{ padding: 15, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", color: '#000000' }}>
          <div style={{ borderBottom: '2px solid #000000', paddingBottom: 10, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 900 }}>
              {reportData.business_name}
            </h2>
            <div style={{ fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
              Laporan Transaksi Penjualan
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              {periodText} | Cabang: {reportData.outlet_name} | Dicetak: {new Date().toLocaleString('id-ID')}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5, margin: '8px 0' }}>
            <thead>
              <tr style={{ background: '#f4f4f4', borderBottom: '1px solid #000' }}>
                <th style={{ border: '1px solid #000', padding: '4px' }}>No.</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Tgl</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Tgl. Dibuat</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Dibuat Oleh</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>No.Ref</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Customer</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Jenis Bayar</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Setor Ke</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Kode Produk</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Produk/Sub Produk</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Kategori</th>
                <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>HPP</th>
                <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>Qty</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Satuan</th>
                <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>Harga</th>
                <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>Disc</th>
                <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>Subtotal</th>
                <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>Penjualan</th>
                <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>Piutang</th>
                <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>Profit</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Kasir</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{it.order_row_no || idx + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.date}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.created_at}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.created_by}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.order_number}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.customer}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.payment_method}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.deposit_account}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.item_code}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontWeight: 'bold' }}>{it.item_name}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.category}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>{Number(it.cost_price).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>{it.qty}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.unit}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>{Number(it.unit_price).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>{Number(it.discount).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>{Number(it.subtotal).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', fontWeight: 'bold' }}>{Number(it.penjualan).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>{Number(it.piutang).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', fontWeight: 'bold' }}>{Number(it.profit).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.cashier}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 900, background: '#f4f4f4', borderTop: '2px solid #000' }}>
                <td colSpan={15} style={{ border: '1px solid #000', padding: '5px' }}>Total</td>
                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right' }}>{Number(activeSummary?.total_discount || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '5px' }}></td>
                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right' }}>{Number(activeSummary?.total_sales || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right' }}>{Number(activeSummary?.total_receivable || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right' }}>{Number(activeSummary?.total_profit || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '5px' }}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 5. PRINTABLE: PENJUALAN PER CUSTOMER */}
      <div id="printable-report-by-customer" style={{ display: 'none' }}>
        <div style={{ padding: 15, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", color: '#000000' }}>
          <div style={{ borderBottom: '2px solid #000000', paddingBottom: 10, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 900 }}>
              {reportData.business_name}
            </h2>
            <div style={{ fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
              LAPORAN DAFTAR PENJUALAN PER CUSTOMER
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              {periodText} | Cabang: {reportData.outlet_name} | Dicetak: {new Date().toLocaleString('id-ID')}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, margin: '8px 0' }}>
            <thead>
              <tr style={{ background: '#f4f4f4', borderBottom: '1px solid #000' }}>
                <th style={{ border: '1px solid #000', padding: '4px' }}>No.</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Tanggal</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Kode Cust</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Customer</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>No.Ref</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Produk</th>
                <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>Qty</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Satuan</th>
                <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>Harga Satuan</th>
                <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>Disc</th>
                <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>Total</th>
                <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>Total Bayar</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Jenis Bayar</th>
                <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>Piutang</th>
                <th style={{ border: '1px solid #000', padding: '4px' }}>Kasir</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.date}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.customer_code || '-'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontWeight: 'bold' }}>{it.customer_name || 'Walk-in'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.order_number}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.item_name}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>{it.qty}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.unit}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>{Number(it.unit_price).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>{Number(it.discount).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', fontWeight: 'bold' }}>{Number(it.subtotal).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>{Number(it.total_paid).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.payment_method}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>{Number(it.receivable).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '3px' }}>{it.cashier}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 900, background: '#f4f4f4', borderTop: '2px solid #000' }}>
                <td colSpan={10} style={{ border: '1px solid #000', padding: '5px' }}>Total Penjualan Semua Customer</td>
                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right' }}>{Number(activeSummary?.total_sales || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right' }}>{Number(activeSummary?.total_paid || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '5px' }}></td>
                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right' }}>{Number(activeSummary?.total_receivable || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '5px' }}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 6. PRINTABLE: WAKTU TERAMAI */}
      <div id="printable-report-peak-hours" style={{ display: 'none' }}>
        <div style={{ padding: 15, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", color: '#000000' }}>
          <div style={{ borderBottom: '2px solid #000000', paddingBottom: 10, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 900 }}>
              {reportData.business_name}
            </h2>
            <div style={{ fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
              LAPORAN WAKTU TERAMAI
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              {periodText} | Cabang: {reportData.outlet_name} | Dicetak: {new Date().toLocaleString('id-ID')}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5, margin: '8px 0' }}>
            <thead>
              <tr style={{ background: '#f4f4f4', borderBottom: '1px solid #000' }}>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center' }}>No.</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>Waktu</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>Total Penjualan (Rp)</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>Rata-rata Penjualan (Rp)</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>Penjualan (%)</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>Transaksi</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>Transaksi (%)</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>Produk</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>Produk (%)</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>Tamu</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>Tamu (%)</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{it.waktu}</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{Number(it.total_penjualan).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{Number(it.avg_penjualan).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{it.penjualan_pct}%</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{it.transaksi}</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{it.transaksi_pct}%</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{it.produk}</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{it.produk_pct}%</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{it.tamu}</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{it.tamu_pct}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 900, background: '#f4f4f4', borderTop: '2px solid #000' }}>
                <td colSpan={2} style={{ border: '1px solid #000', padding: '6px' }}>Total</td>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{Number(activeSummary?.total_sales || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{Number(activeSummary?.avg_sales_overall || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>100%</td>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{activeSummary?.total_transactions || 0}</td>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>100%</td>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{activeSummary?.total_products || 0}</td>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>100%</td>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{activeSummary?.total_guests || 0}</td>
                <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 7. PRINTABLE: BUKU PIUTANG (AR CUSTOMER & AR MERCHANT) */}
      <div id="printable-report-customer-receivables" style={{ display: 'none' }}>
        <div style={{ padding: 15, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", color: '#000000' }}>
          <div style={{ borderBottom: '2px solid #000000', paddingBottom: 10, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 900 }}>
              {reportData.business_name}
            </h2>
            <div style={{ fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
              LAPORAN BUKU PIUTANG USAHA (AR CUSTOMER & AR MERCHANT)
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              {periodText} | Cabang: {reportData.outlet_name} | Dicetak: {new Date().toLocaleString('id-ID')}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5, margin: '8px 0' }}>
            <thead>
              <tr style={{ background: '#f4f4f4', borderBottom: '1px solid #000' }}>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center' }}>No.</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>Kategori AR</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>Debitur / Merchant</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>Tanggal & Jam</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>No. Order / Ref</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>Gross Piutang</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>MDR/Komisi</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>Net Piutang</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>Dibayar / Cair</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'right' }}>Sisa Piutang</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'center' }}>Status Settlement</th>
                <th style={{ border: '1px solid #000', padding: '5px 4px', textAlign: 'left' }}>Jatuh Tempo</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it, idx) => {
                const arLabel = it.ar_type === 'MERCHANT_QRIS'
                  ? 'AR QRIS'
                  : it.ar_type === 'MERCHANT_ECOMMERCE'
                  ? `AR ${it.merchant_channel || 'E-COM'}`
                  : 'CUSTOMER';

                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{arLabel}</td>
                    <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{it.customer || it.merchant_channel || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '4px' }}>{it.tanggal} {it.jam || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '4px' }}>{it.no_penjualan}</td>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{Number(it.piutang).toLocaleString('id-ID')}</td>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{Number(it.mdr_fee || 0).toLocaleString('id-ID')}</td>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{Number(it.net_amount || it.piutang).toLocaleString('id-ID')}</td>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{Number(it.dibayar).toLocaleString('id-ID')}</td>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{Number(it.sisa_piutang).toLocaleString('id-ID')}</td>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{it.settlement_status || (it.sisa_piutang <= 0 ? 'SETTLED' : 'UNSETTLED')}</td>
                    <td style={{ border: '1px solid #000', padding: '4px' }}>{it.jatuh_tempo || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 900, background: '#f4f4f4', borderTop: '2px solid #000' }}>
                <td colSpan={5} style={{ border: '1px solid #000', padding: '6px 4px' }}>Total Piutang</td>
                <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'right' }}>{Number(activeSummary?.total_gross_piutang || activeSummary?.total_piutang || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'right' }}>{Number(activeSummary?.total_mdr_fee || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'right' }}>{Number(activeSummary?.total_net_piutang || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'right' }}>{Number(activeSummary?.total_dibayar || 0).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'right' }}>{Number(activeSummary?.total_sisa_piutang || 0).toLocaleString('id-ID')}</td>
                <td colSpan={2} style={{ border: '1px solid #000', padding: '6px 4px' }}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 8. PRINTABLE: LAPORAN PROMO */}
      <div id="printable-report-promos" style={{ display: 'none' }}>
        <div style={{ padding: 15, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", color: '#000000' }}>
          <div style={{ borderBottom: '2px solid #000000', paddingBottom: 10, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 900 }}>
              {reportData.business_name}
            </h2>
            <div style={{ fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
              LAPORAN PROMO
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              {periodText} | Cabang: {reportData.outlet_name} | Dicetak: {new Date().toLocaleString('id-ID')}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, margin: '8px 0' }}>
            <thead>
              <tr style={{ background: '#f4f4f4', borderBottom: '1px solid #000' }}>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'center' }}>No.</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Tanggal</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Promo</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Jenis</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Jumlah Transaksi</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Nilai (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.tanggal}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 'bold' }}>{it.promo}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.jenis}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{it.jumlah_transaksi}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{Number(it.nilai).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 900, background: '#f4f4f4', borderTop: '2px solid #000' }}>
                <td colSpan={4} style={{ border: '1px solid #000', padding: '6px 8px' }}>Total Promo</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{activeSummary?.total_promo || 0}</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{Number(activeSummary?.total_nilai || 0).toLocaleString('id-ID')}</td>
              </tr>
              <tr style={{ fontWeight: 900, background: '#f4f4f4' }}>
                <td colSpan={5} style={{ border: '1px solid #000', padding: '6px 8px' }}>Total Penjualan Promo</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{Number(activeSummary?.total_penjualan_promo || 0).toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
