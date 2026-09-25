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
  BadgeAlert
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
    label: 'Piutang Customer',
    icon: BadgeAlert,
    title: 'LAPORAN PIUTANG CUSTOMER',
    desc: 'Daftar rincian piutang kasbon pelanggan, tanggal, no penjualan, pembayaran cicilan, dan usia piutang.',
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

  useEffect(() => {
    fetchReport();
  }, [activeTab, period?.from, period?.to, activeOutletId]);

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
      const { data } = await api.get(endpoint, {
        params: {
          from: period?.from,
          to: period?.to,
          outlet_id: targetOutlet,
          search: search.trim() || undefined,
        },
      });

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
        total_dibayar: items.reduce((s, i) => s + (Number(i.dibayar) || 0), 0),
        total_sisa_piutang: items.reduce((s, i) => s + (Number(i.sisa_piutang) || 0), 0),
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

          {/* Search Input */}
          <div style={{ minWidth: 260, position: 'relative' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="input input-sm"
              placeholder="Cari data pada laporan ini..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 30, fontSize: 12, width: '100%' }}
            />
          </div>
        </div>
      </div>

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
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Nilai Piutang</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
                {rupiah(activeSummary?.total_piutang || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Cicilan Dibayar</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                {rupiah(activeSummary?.total_dibayar || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sisa Piutang (Outstanding)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f43f5e', marginTop: 4 }}>
                {rupiah(activeSummary?.total_sisa_piutang || 0)}
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
                    <th className="right">Qty Refund</th>
                    <th>Satuan</th>
                    <th className="right">Modal (HPP)</th>
                    <th className="right">Harga</th>
                    <th className="right">Disc</th>
                    <th className="right">Total Nilai Terjual</th>
                    <th className="right">Total Nilai Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center" style={{ padding: 32, color: 'var(--text-muted)' }}>
                        Tidak ada data penjualan produk untuk periode ini.
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

            {/* 7. TAB: PIUTANG CUSTOMER */}
            {activeTab === 'customer-receivables' && (
              <table style={{ fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={{ width: 45 }}>No.</th>
                    <th>Customer</th>
                    <th>Tanggal</th>
                    <th>Jam</th>
                    <th>No.Penjualan</th>
                    <th className="right">Piutang</th>
                    <th className="right">Dibayar</th>
                    <th className="right">Sisa Piutang</th>
                    <th>Usia Piutang</th>
                    <th>Jatuh Tempo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center" style={{ padding: 32, color: 'var(--text-muted)' }}>
                        Tidak ada riwayat piutang kasbon customer dalam periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 700 }}>{item.customer}</td>
                        <td>{item.tanggal}</td>
                        <td>{item.jam}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.no_penjualan}</td>
                        <td className="right">{rupiah(item.piutang)}</td>
                        <td className="right" style={{ color: '#34d399' }}>{rupiah(item.dibayar)}</td>
                        <td className="right" style={{ fontWeight: 700, color: '#f43f5e' }}>{rupiah(item.sisa_piutang)}</td>
                        <td>{item.usia_piutang}</td>
                        <td>{item.jatuh_tempo}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 800, background: 'rgba(255, 255, 255, 0.04)', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={7}>Total Piutang</td>
                    <td className="right" style={{ color: '#f43f5e' }}>{rupiah(activeSummary?.total_sisa_piutang || 0)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
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

      {/* 7. PRINTABLE: PIUTANG CUSTOMER */}
      <div id="printable-report-customer-receivables" style={{ display: 'none' }}>
        <div style={{ padding: 15, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", color: '#000000' }}>
          <div style={{ borderBottom: '2px solid #000000', paddingBottom: 10, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 900 }}>
              {reportData.business_name}
            </h2>
            <div style={{ fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
              LAPORAN PIUTANG CUSTOMER
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              {periodText} | Cabang: {reportData.outlet_name} | Dicetak: {new Date().toLocaleString('id-ID')}
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
              {filteredItems.map((it, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 'bold' }}>{it.customer}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.tanggal}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.jam}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.no_penjualan}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{Number(it.piutang).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{Number(it.dibayar).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{Number(it.sisa_piutang).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.usia_piutang}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{it.jatuh_tempo}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 900, background: '#f4f4f4', borderTop: '2px solid #000' }}>
                <td colSpan={7} style={{ border: '1px solid #000', padding: '6px 8px' }}>Total Piutang</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{Number(activeSummary?.total_sisa_piutang || 0).toLocaleString('id-ID')}</td>
                <td colSpan={2} style={{ border: '1px solid #000', padding: '6px 8px' }}></td>
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
