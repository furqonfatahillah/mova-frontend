import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Trash2, HelpCircle,
  Layers, FileSpreadsheet, Printer, X, Download, ShieldCheck, Building2,
  Calendar, User, Plus, LayoutGrid, RotateCw, Search, Check, DollarSign,
  CreditCard, Clock, ArrowUpRight, ArrowDownRight, ShoppingBag, Receipt,
  Wallet, PieChart, Activity, SlidersHorizontal, ArrowRight, Sparkles, RefreshCw
} from 'lucide-react';
import api from '../api/client';
import { rupiah, pct, num, StatusPill, LoadingState, PeriodPicker, PageHeader } from '../components/ui';
import { getWasteReason } from './StockMovement';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import { exportDashboardToExcel } from '../utils/exportReport';
import { printElement } from '../utils/print';

// -------------------------------------------------------------
// METADATA WIDGET DARI ACCURATE ONLINE / MOVA POS ECOSYSTEM
// -------------------------------------------------------------
const WIDGET_CATALOG = [
  {
    id: 'activity',
    title: 'Aktifitas Terakhir Anda',
    subtitle: 'Menampilkan transaksi kasir dan aktifitas operasional terkini',
    icon: Activity,
    color: '#0284c7', // vibrant sky blue
    bg: 'rgba(2, 132, 199, 0.12)',
    category: 'operasional',
  },
  {
    id: 'sales_trend',
    title: 'Tren Penjualan',
    subtitle: 'Menampilkan tren omzet dan volume transaksi harian dalam periode aktif',
    icon: TrendingUp,
    color: '#6366f1', // indigo
    bg: 'rgba(99, 102, 241, 0.12)',
    category: 'penjualan',
  },
  {
    id: 'pnl',
    title: 'Laba/Rugi Periode Ini',
    subtitle: 'Menampilkan pendapatan, nilai HPP, pengeluaran beban, dan laba bersih',
    icon: PieChart,
    color: '#10b981', // emerald
    bg: 'rgba(16, 185, 129, 0.12)',
    category: 'keuangan',
  },
  {
    id: 'expenses',
    title: 'Beban Perusahaan',
    subtitle: 'Menampilkan beban operasional tertinggi dalam perusahaan',
    icon: ArrowDownRight,
    color: '#f97316', // orange
    bg: 'rgba(249, 115, 22, 0.12)',
    category: 'keuangan',
  },
  {
    id: 'cash_flow',
    title: 'Arus Kas',
    subtitle: 'Menampilkan arus kas masuk, kas keluar, dan saldo operasional',
    icon: Wallet,
    color: '#06b6d4', // cyan
    bg: 'rgba(6, 182, 212, 0.12)',
    category: 'keuangan',
  },
  {
    id: 'sales_summary',
    title: 'Penjualan & Piutang',
    subtitle: 'Menampilkan ringkasan penjualan tunai, non-tunai, dan faktur piutang belum lunas (kasbon)',
    icon: Receipt,
    color: '#a855f7', // purple
    bg: 'rgba(168, 85, 247, 0.12)',
    category: 'penjualan',
  },
  {
    id: 'min_stock',
    title: 'Barang Stok Minimum',
    subtitle: 'Menampilkan barang & bahan yang menipis dan perlu dipesan bagian pembelian',
    icon: AlertTriangle,
    color: '#f59e0b', // amber
    bg: 'rgba(245, 158, 11, 0.12)',
    category: 'stok',
  },
  {
    id: 'top_products',
    title: 'Produk Terlaris',
    subtitle: 'Menampilkan 5 menu paling laris dan kontribusi omzet penjualan',
    icon: ShoppingBag,
    color: '#ec4899', // pink
    bg: 'rgba(236, 72, 153, 0.12)',
    category: 'penjualan',
  },
  {
    id: 'cost_control',
    title: 'Audit Variance & Resep',
    subtitle: 'Evaluasi status variance fisik vs teoritis (Normal, Waspada, Tidak Wajar)',
    icon: Layers,
    color: '#8b5cf6', // violet
    bg: 'rgba(139, 92, 246, 0.12)',
    category: 'stok',
  },
  {
    id: 'waste',
    title: 'Kerugian Waste & Limbah',
    subtitle: 'Rincian bahan baku rusak, basi, atau terbuang resmi di dapur/bar',
    icon: Trash2,
    color: '#ef4444', // red
    bg: 'rgba(239, 68, 68, 0.12)',
    category: 'stok',
  },
  {
    id: 'active_shift',
    title: 'Shift Kasir & Operasional',
    subtitle: 'Menampilkan kasir aktif yang bertugas, modal awal kasir, dan omzet shift berjalan',
    icon: Clock,
    color: '#14b8a6', // teal
    bg: 'rgba(20, 184, 166, 0.12)',
    category: 'operasional',
  },
];

const PRESET_LAYOUTS = {
  all: {
    id: 'all',
    name: 'Dashboard Utama (Lengkap)',
    widgets: ['activity', 'sales_trend', 'pnl', 'expenses', 'cash_flow', 'sales_summary', 'min_stock', 'top_products', 'cost_control', 'waste'],
  },
  finance: {
    id: 'finance',
    name: 'Fokus Keuangan & Laba Rugi',
    widgets: ['pnl', 'expenses', 'cash_flow', 'sales_summary', 'sales_trend'],
  },
  stock: {
    id: 'stock',
    name: 'Fokus Dapur & Stok',
    widgets: ['min_stock', 'cost_control', 'waste', 'activity'],
  },
  sales: {
    id: 'sales',
    name: 'Fokus Kasir & Penjualan',
    widgets: ['sales_trend', 'top_products', 'sales_summary', 'active_shift', 'activity'],
  },
};

const DEFAULT_WIDGETS = PRESET_LAYOUTS.all.widgets;

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [widgetsData, setWidgetsData] = useState(null);
  const [varData, setVarData] = useState([]);
  const [varMenuData, setVarMenuData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showWidgetModal, setShowWidgetModal] = useState(false);

  // Widget customizer states
  const [activeWidgets, setActiveWidgets] = useState(() => {
    try {
      const saved = localStorage.getItem('mova_active_widgets_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_WIDGETS;
  });

  const [selectedPreset, setSelectedPreset] = useState(() => {
    return localStorage.getItem('mova_widget_preset_v2') || 'all';
  });

  const [widgetSearch, setWidgetSearch] = useState('');
  const [widgetCategory, setWidgetCategory] = useState('all');

  const {
    activeOutletId,
    activeOutlet,
    currentBusiness,
    isPlatformAdmin,
    activeBusinessId,
    businesses,
    changeBusiness,
    dateRange: period,
  } = useOutlet();

  const currentUser = JSON.parse(localStorage.getItem('pos_user') || '{}');
  const businessName = currentBusiness?.name || currentUser?.business?.name || 'MOVA POS F&B Management';
  const outletName = (activeOutlet && activeOutletId !== 'ALL' && activeOutletId !== 'all') ? activeOutlet.name : 'Semua Cabang (Konsolidasi)';

  // Persist active widgets
  useEffect(() => {
    localStorage.setItem('mova_active_widgets_v2', JSON.stringify(activeWidgets));
  }, [activeWidgets]);

  useEffect(() => {
    localStorage.setItem('mova_widget_preset_v2', selectedPreset);
  }, [selectedPreset]);

  useEffect(() => {
    if (isPlatformAdmin && !activeBusinessId) {
      setLoading(false);
      return;
    }
    fetchAll();
  }, [period, activeOutletId, isPlatformAdmin, activeBusinessId]);

  async function fetchAll(isSilentRefresh = false) {
    if (!isSilentRefresh) setLoading(true);
    setRefreshing(true);
    try {
      const targetOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : undefined;
      const params = { from: period.from, to: period.to, outlet_id: targetOutlet };

      const [dashRes, wgtRes, varBahanRes, varMenuRes] = await Promise.all([
        api.get('/reports/dashboard', { params }),
        api.get('/reports/widgets', { params }).catch(() => ({ data: null })),
        api.get('/reports/variance/ingredients', { params }).catch(() => ({ data: [] })),
        api.get('/reports/variance/menus', { params }).catch(() => ({ data: [] })),
      ]);

      setData(dashRes.data);
      if (wgtRes.data) setWidgetsData(wgtRes.data);
      if (varBahanRes.data) {
        setVarData(varBahanRes.data.slice(0, 5).filter(v => v.variance_value !== null).sort((a, b) => Math.abs(b.variance_value) - Math.abs(a.variance_value)));
      }
      if (varMenuRes.data) {
        setVarMenuData(varMenuRes.data.slice(0, 5).sort((a, b) => Math.abs(b.variance_value) - Math.abs(a.variance_value)));
      }
    } catch {
      toast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
      setTimeout(() => setRefreshing(false), 300);
    }
  }

  function handlePresetChange(presetKey) {
    setSelectedPreset(presetKey);
    if (presetKey !== 'custom' && PRESET_LAYOUTS[presetKey]) {
      setActiveWidgets(PRESET_LAYOUTS[presetKey].widgets);
      toast.success(`Tampilan diubah ke "${PRESET_LAYOUTS[presetKey].name}"`);
    }
  }

  function toggleWidget(widgetId) {
    setSelectedPreset('custom');
    if (activeWidgets.includes(widgetId)) {
      setActiveWidgets(prev => prev.filter(id => id !== widgetId));
      const w = WIDGET_CATALOG.find(x => x.id === widgetId);
      toast(`Widget "${w?.title || widgetId}" disembunyikan`, { icon: '👁️‍🗨️' });
    } else {
      setActiveWidgets(prev => [...prev, widgetId]);
      const w = WIDGET_CATALOG.find(x => x.id === widgetId);
      toast.success(`Widget "${w?.title || widgetId}" ditambahkan`);
    }
  }

  function handleResetDefault() {
    setSelectedPreset('all');
    setActiveWidgets(DEFAULT_WIDGETS);
    toast.success('Tampilan widget dikembalikan ke Dashboard Utama');
  }

  async function handleExportExcel() {
    try {
      const fname = await exportDashboardToExcel({
        data,
        varData,
        varMenuData,
        period,
        outletName,
        businessName,
        userName: currentUser?.name || 'Administrator',
      });
      toast.success(`Laporan Excel berhasil diunduh: ${fname}`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengekspor laporan ke Excel');
    }
  }

  function handlePrintPdf() {
    printElement(
      'printable-dashboard-report',
      `Laporan Eksekutif Cost Control - ${period.from} sd ${period.to}`,
      { orientation: 'portrait' }
    );
  }

  // Filtered widgets in modal
  const filteredCatalog = useMemo(() => {
    return WIDGET_CATALOG.filter(w => {
      const matchSearch =
        w.title.toLowerCase().includes(widgetSearch.toLowerCase()) ||
        w.subtitle.toLowerCase().includes(widgetSearch.toLowerCase());
      const matchCategory =
        widgetCategory === 'all' || w.category === widgetCategory;
      return matchSearch && matchCategory;
    });
  }, [widgetSearch, widgetCategory]);

  if (loading) return <LoadingState />;

  // -------------------------------------------------------------
  // PLATFORM ADMIN / SAAS OWNER HERO SCREEN
  // -------------------------------------------------------------
  if (isPlatformAdmin && !activeBusinessId) {
    return (
      <div className="fade-in">
        <PageHeader
          title="Panel Pengelola Platform SaaS (Owner Website)"
          subtitle="Kelola ekosistem bisnis MOVA POS, alokasi koin operasional penyewa, dan pengguna platform."
        />

        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.08))',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: 16,
          padding: 24,
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{
                background: 'rgba(99, 102, 241, 0.25)',
                color: 'var(--accent-bright)',
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 20,
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                🌐 Superadmin / Owner Website
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {businesses.length} Bisnis Penyewa Terdaftar
              </span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Pusat Manajemen Infrastruktur SaaS
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 6, maxWidth: 650, lineHeight: 1.5 }}>
              Sebagai Pemilik Website / Penyedia Platform, Anda mengelola lisensi penyewa dan tarif koin per transaksi. Untuk melihat atau membantu operasional dapur/resto penyewa, silakan pilih tenant di bawah atau gunakan <strong>Tenant Switcher</strong> di header.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/businesses')}
              className="btn btn-primary"
              style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Building2 size={16} /> Kelola Penyewa (SaaS)
            </button>
            <button
              onClick={() => navigate('/coin-management')}
              className="btn btn-secondary"
              style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              Top Up & Koin Platform
            </button>
          </div>
        </div>

        {/* Tenant Cards */}
        <div style={{ marginBottom: 30 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', marginBottom: 14 }}>
            🔍 Remote Assistance / Inspeksi Dapur & Resto Penyewa
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {businesses.map((b) => (
              <div
                key={b.id}
                onClick={() => changeBusiness(b.id)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 14,
                  padding: 18,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Building2 size={18} style={{ color: 'var(--accent-bright)' }} />
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: b.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: b.status === 'active' ? '#34d399' : '#f87171'
                    }}>
                      {b.status?.toUpperCase() || 'ACTIVE'}
                    </span>
                  </div>
                  <div style={{ fontWeight: 800, color: '#ffffff', fontSize: 15 }}>
                    {b.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Owner: {b.owner_name || b.email || 'Penyewa'}
                  </div>
                </div>

                <div style={{
                  paddingTop: 10,
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12
                }}>
                  <span style={{ color: 'var(--accent-bright)', fontWeight: 600 }}>
                    🪙 {Number(b.coin_balance || 0).toLocaleString()} Koin
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
                    Inspeksi Tenant ➔
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Fallbacks for widgets
  const wgt = widgetsData || {};
  const pnl = wgt.pnl || {};
  const cash = wgt.cash_flow || {};
  const salesRec = wgt.sales_receivables || {};
  const minStock = wgt.min_stock_items || [];
  const activities = wgt.recent_activities || [];
  const topProducts = wgt.top_products || [];
  const opexBreakdown = wgt.opex_breakdown || [];
  const salesTrend = wgt.sales_trend || [];
  const activeShift = wgt.active_shift;

  // Cost control summary fallback
  const statusCounts = wgt.cost_control?.status_counts || data?.status_counts || { NORMAL: 0, WASPADA: 0, 'TIDAK WAJAR': 0 };
  const totalVarianceLoss = wgt.cost_control?.total_variance_loss || data?.total_variance_loss || 0;
  const totalWasteValue = wgt.cost_control?.total_waste_value || data?.total_waste_value || 0;
  const topWaste = data?.top_waste || [];

  return (
    <div className="fade-in">
      {/* -------------------------------------------------------------
          TOP BAR ACCURATE ONLINE STYLE: [+ Widget] & LAYOUT SELECTOR
          ------------------------------------------------------------- */}
      <div style={{
        background: 'rgba(20, 26, 52, 0.65)',
        border: '1px solid rgba(165, 180, 252, 0.15)',
        borderRadius: 12,
        padding: '12px 18px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Left: + Widget Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowWidgetModal(true)}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 700,
              fontSize: 13,
              padding: '8px 16px',
              borderRadius: 8,
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.35)',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            }}
            title="Pilih widget yang ingin ditampilkan pada dashboard"
          >
            <Plus size={16} /> Widget
          </button>

          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <LayoutGrid size={14} style={{ color: 'var(--accent-bright)' }} />
            <span><strong>{activeWidgets.length}</strong> widget aktif ditampilkan</span>
          </span>
        </div>

        {/* Right: Layout Preset Dropdown & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Preset Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Tampilan:</span>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="form-control"
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(15, 20, 41, 0.85)',
                color: '#ffffff',
                borderColor: 'rgba(165, 180, 252, 0.25)',
                minWidth: 200,
              }}
            >
              <option value="all">Dashboard Utama (Lengkap)</option>
              <option value="finance">💰 Fokus Keuangan & Laba Rugi</option>
              <option value="stock">🍳 Fokus Dapur & Stok</option>
              <option value="sales">🏷️ Fokus Kasir & Penjualan</option>
              {selectedPreset === 'custom' && <option value="custom">⚙️ Tampilan Kustom Saya</option>}
            </select>
          </div>

          {/* Quick Refresh */}
          <button
            onClick={() => fetchAll(true)}
            className="btn btn-secondary btn-sm"
            style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 6 }}
            title="Segarkan seluruh data widget"
          >
            <RotateCw size={14} className={refreshing ? 'spin-anim' : ''} />
          </button>

          {/* Export Excel */}
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
              fontSize: 12,
            }}
            onClick={handleExportExcel}
            title="Unduh laporan lengkap dalam format Excel (.xlsx)"
          >
            <FileSpreadsheet size={14} /> Export Excel
          </button>

          {/* PDF Modal */}
          <button
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12 }}
            onClick={() => setShowReportModal(true)}
            title="Pratinjau dokumen eksekutif & cetak PDF"
          >
            <Printer size={14} /> Cetak / PDF
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          WIDGET MODAL (ACCURATE ONLINE STYLE: EXACT LOOK & FEEL)
          ------------------------------------------------------------- */}
      {showWidgetModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowWidgetModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 7, 16, 0.75)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: 16,
          }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 680,
              maxHeight: '85vh',
              background: '#0d132b',
              border: '1px solid rgba(165, 180, 252, 0.28)',
              borderRadius: 14,
              boxShadow: '0 25px 65px rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 22px',
              borderBottom: '1px solid rgba(165, 180, 252, 0.15)',
              background: 'rgba(255, 255, 255, 0.02)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99, 102, 241, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-bright)' }}>
                  <LayoutGrid size={17} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
                    Widget Dashboard
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Pilih modul informasi bisnis yang ingin Anda pantau di layar utama
                  </div>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowWidgetModal(false)}
                style={{ padding: 6 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input Bar (Like Accurate Screenshot) */}
            <div style={{ padding: '14px 22px 10px', background: 'rgba(0, 0, 0, 0.15)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ketik kata kunci (contoh: Penjualan, Laba, Stok, Kas...)"
                  value={widgetSearch}
                  onChange={(e) => setWidgetSearch(e.target.value)}
                  style={{
                    paddingLeft: 38,
                    borderRadius: 9,
                    fontSize: 13,
                    background: 'rgba(15, 20, 41, 0.9)',
                    borderColor: 'rgba(165, 180, 252, 0.25)',
                  }}
                  autoFocus
                />
              </div>

              {/* Category Pills */}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'Semua Widget' },
                  { id: 'keuangan', label: '💰 Keuangan & Laba' },
                  { id: 'penjualan', label: '🏷️ Penjualan & Kasir' },
                  { id: 'stok', label: '🍳 Stok & Dapur' },
                  { id: 'operasional', label: '⏱️ Operasional' },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setWidgetCategory(c.id)}
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 20,
                      border: '1px solid',
                      borderColor: widgetCategory === c.id ? 'var(--accent)' : 'rgba(165, 180, 252, 0.15)',
                      background: widgetCategory === c.id ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                      color: widgetCategory === c.id ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Widget Catalog List */}
            <div style={{ overflowY: 'auto', padding: '12px 22px 20px', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredCatalog.map((item) => {
                  const IconComp = item.icon;
                  const isChecked = activeWidgets.includes(item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleWidget(item.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid',
                        borderColor: isChecked ? 'rgba(139, 92, 246, 0.45)' : 'rgba(165, 180, 252, 0.12)',
                        borderRadius: 10,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)';
                        e.currentTarget.style.background = isChecked ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.04)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isChecked ? 'rgba(139, 92, 246, 0.45)' : 'rgba(165, 180, 252, 0.12)';
                        e.currentTarget.style.background = isChecked ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {/* Colored Icon Badge */}
                        <div style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: item.bg,
                          border: `1px solid ${item.color}40`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          color: item.color,
                        }}>
                          <IconComp size={22} />
                        </div>

                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#ffffff' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                            {item.subtitle}
                          </div>
                        </div>
                      </div>

                      {/* Action Pill / Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWidget(item.id);
                        }}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '6px 14px',
                          borderRadius: 8,
                          border: '1px solid',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          background: isChecked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                          borderColor: isChecked ? 'rgba(16, 185, 129, 0.4)' : 'rgba(99, 102, 241, 0.4)',
                          color: isChecked ? '#34d399' : 'var(--accent-bright)',
                        }}
                      >
                        {isChecked ? (
                          <>
                            <Check size={14} /> Ditampilkan
                          </>
                        ) : (
                          <>
                            <Plus size={14} /> Tambahkan
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}

                {filteredCatalog.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-secondary)' }}>
                    Tidak ada widget yang cocok dengan pencarian "{widgetSearch}".
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 22px',
              borderTop: '1px solid rgba(165, 180, 252, 0.15)',
              background: 'rgba(255, 255, 255, 0.02)',
              fontSize: 12,
            }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleResetDefault}
                style={{ fontSize: 12, color: 'var(--text-secondary)' }}
              >
                Reset ke Tampilan Default
              </button>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowWidgetModal(false)}
                style={{ fontWeight: 700 }}
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODULAR WIDGETS GRID (ACCURATE ONLINE STYLE)
          ------------------------------------------------------------- */}
      {activeWidgets.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <LayoutGrid size={44} style={{ color: 'var(--accent-bright)', margin: '0 auto 14px', opacity: 0.7 }} />
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', margin: 0 }}>
            Belum ada widget yang ditampilkan
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 440, margin: '8px auto 20px', lineHeight: 1.5 }}>
            Pilih modul informasi apa saja yang ingin Anda pantau di dashboard sesuai kebutuhan operasional usaha Anda.
          </p>
          <button
            onClick={() => setShowWidgetModal(true)}
            className="btn btn-primary"
            style={{ fontWeight: 700 }}
          >
            <Plus size={16} /> Buka Pilihan Widget
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}>
          {/* ========================================================
              WIDGET 1: AKTIFITAS TERAKHIR ANDA (ACCURATE TIMELINE)
              ======================================================== */}
          {activeWidgets.includes('activity') && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <WidgetHeader
                title={`Aktifitas Terakhir Anda (${businessName})`}
                icon={Activity}
                color="#0284c7"
                onRefresh={() => fetchAll(true)}
                onClose={() => toggleWidget('activity')}
              />
              <div style={{ flex: 1, maxHeight: 310, overflowY: 'auto', paddingRight: 4 }}>
                {activities.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {activities.map((act) => (
                      <div
                        key={act.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(165, 180, 252, 0.08)',
                        }}
                      >
                        {/* Time & Date Column */}
                        <div style={{ minWidth: 68, textAlign: 'center', paddingRight: 10, borderRight: '1px solid rgba(165, 180, 252, 0.12)' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-bright)' }}>
                            {act.time}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {act.date}
                          </div>
                        </div>

                        {/* Description & Action */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#ffffff' }}>
                            {act.title}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {act.description}
                          </div>
                          <div style={{ fontSize: 10.5, color: '#818cf8', marginTop: 4 }}>
                            Kasir: <strong>{act.user_name}</strong> • Pembayaran: <span style={{ textTransform: 'uppercase' }}>{act.payment_method}</span>
                          </div>
                        </div>

                        {/* Amount */}
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#34d399', whiteSpace: 'nowrap' }}>
                          {rupiah(act.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 10px', color: 'var(--text-secondary)', fontSize: 13 }}>
                    Tidak ada aktifitas transaksi pada rentang tanggal ini.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              WIDGET 2: TREN PENJUALAN (ACCURATE CHART / BAR GRAPH)
              ======================================================== */}
          {activeWidgets.includes('sales_trend') && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <WidgetHeader
                title="Tren Penjualan"
                icon={TrendingUp}
                color="#6366f1"
                badge={`Total: ${rupiah(pnl.net_sales || 0)}`}
                onRefresh={() => fetchAll(true)}
                onClose={() => toggleWidget('sales_trend')}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {salesTrend.length > 0 ? (
                  <div>
                    {/* Bar visualization */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                      gap: 6,
                      height: 160,
                      padding: '16px 8px 10px',
                      borderBottom: '1px solid rgba(165, 180, 252, 0.15)',
                    }}>
                      {salesTrend.map((st, idx) => {
                        const maxVal = Math.max(...salesTrend.map(x => Number(x.total_revenue || 0)), 1);
                        const pctH = Math.max(8, Math.round((Number(st.total_revenue || 0) / maxVal) * 100));
                        const dayLabel = new Date(st.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });

                        return (
                          <div
                            key={idx}
                            style={{
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              height: '100%',
                              justifyContent: 'flex-end',
                            }}
                            title={`${st.date}: ${rupiah(st.total_revenue)} (${st.order_count || 0} pesanan)`}
                          >
                            <span style={{ fontSize: 9.5, color: '#c4b5fd', marginBottom: 4, fontWeight: 700 }}>
                              {Number(st.total_revenue) > 0 ? `${Math.round(st.total_revenue / 1000)}k` : '0'}
                            </span>
                            <div
                              style={{
                                width: '80%',
                                maxWidth: 28,
                                height: `${pctH}%`,
                                background: 'linear-gradient(180deg, #818cf8 0%, #4f46e5 100%)',
                                borderRadius: '4px 4px 0 0',
                                transition: 'height 0.3s ease',
                              }}
                            />
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6, whiteSpace: 'nowrap' }}>
                              {dayLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginTop: 12, padding: '0 4px' }}>
                      <span>Total Transaksi: <strong>{salesRec.order_count || 0} pesanan</strong></span>
                      <span style={{ color: '#34d399', fontWeight: 600 }}>Rata-rata: {rupiah(salesRec.order_count ? Math.round(pnl.net_sales / salesRec.order_count) : 0)}/pesanan</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-secondary)', fontSize: 13 }}>
                    Belum ada riwayat penjualan pada periode ini.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              WIDGET 3: LABA / RUGI TAHUN INI (ACCURATE DONUT + P&L)
              ======================================================== */}
          {activeWidgets.includes('pnl') && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <WidgetHeader
                title="Laba/Rugi Periode Ini"
                icon={PieChart}
                color="#10b981"
                onRefresh={() => fetchAll(true)}
                onClose={() => toggleWidget('pnl')}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 16, alignItems: 'center', flex: 1 }}>
                {/* Circular indicator */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    border: '5px solid rgba(16, 185, 129, 0.25)',
                    borderTopColor: '#10b981',
                    borderRightColor: '#6366f1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                  }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: (pnl.net_profit || 0) >= 0 ? '#34d399' : '#f87171' }}>
                      {pct(pnl.net_margin || 0)}
                    </span>
                    <span style={{ fontSize: 9.5, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Net Margin
                    </span>
                  </div>
                </div>

                {/* Metrics Breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                      Pendapatan Bersih
                    </span>
                    <strong style={{ color: '#ffffff' }}>{rupiah(pnl.net_sales || 0)}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                      Nilai HPP (Bahan Baku)
                    </span>
                    <span style={{ color: '#fbbf24', fontWeight: 600 }}>{rupiah(pnl.cogs || 0)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                      Beban Pengeluaran (OPEX)
                    </span>
                    <span style={{ color: '#f87171', fontWeight: 600 }}>{rupiah(pnl.opex || 0)}</span>
                  </div>

                  <div style={{
                    marginTop: 4,
                    paddingTop: 8,
                    borderTop: '1px solid rgba(165, 180, 252, 0.15)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontWeight: 800,
                  }}>
                    <span style={{ color: '#ffffff' }}>Laba Bersih Usaha</span>
                    <span style={{ color: (pnl.net_profit || 0) >= 0 ? '#34d399' : '#f87171', fontSize: 15 }}>
                      {rupiah(pnl.net_profit || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              WIDGET 4: BEBAN PERUSAHAAN (ACCURATE OPEX BREAKDOWN)
              ======================================================== */}
          {activeWidgets.includes('expenses') && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <WidgetHeader
                title="Beban Perusahaan"
                icon={ArrowDownRight}
                color="#f97316"
                badge={`Total: ${rupiah(pnl.opex || 0)}`}
                onRefresh={() => fetchAll(true)}
                onClose={() => toggleWidget('expenses')}
              />
              <div style={{ flex: 1 }}>
                {opexBreakdown.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {opexBreakdown.map((item, idx) => (
                      <div key={idx}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                          <span style={{ color: '#ffffff', fontWeight: 600 }}>{item.category}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            <strong style={{ color: '#fb923c' }}>{rupiah(item.amount)}</strong> ({item.percentage}%)
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 4, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, item.percentage)}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #f97316, #fb923c)',
                              borderRadius: 4,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 10px', color: 'var(--text-secondary)', fontSize: 13 }}>
                    Belum ada pengeluaran beban operasional tercatat pada periode ini.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              WIDGET 5: ARUS KAS (ACCURATE CASH FLOW STATEMENT)
              ======================================================== */}
          {activeWidgets.includes('cash_flow') && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <WidgetHeader
                title="Arus Kas"
                icon={Wallet}
                color="#06b6d4"
                onRefresh={() => fetchAll(true)}
                onClose={() => toggleWidget('cash_flow')}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, flex: 1, alignItems: 'center' }}>
                <div style={{ padding: '14px 12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ArrowUpRight size={14} /> Kas Masuk
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', marginTop: 6 }}>
                    {rupiah(cash.cash_in || 0)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Penjualan & Kas Masuk
                  </div>
                </div>

                <div style={{ padding: '14px 12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ArrowDownRight size={14} /> Kas Keluar
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', marginTop: 6 }}>
                    {rupiah(cash.cash_out || 0)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Beban & Pengeluaran
                  </div>
                </div>

                <div style={{ padding: '14px 12px', background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.25)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: '#22d3ee', fontWeight: 700 }}>
                    Arus Kas Bersih
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: (cash.net || 0) >= 0 ? '#34d399' : '#f87171', marginTop: 6 }}>
                    {rupiah(cash.net || 0)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Saldo Operasional Periode
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              WIDGET 6: PENJUALAN & PIUTANG (ACCURATE RECEIVABLES)
              ======================================================== */}
          {activeWidgets.includes('sales_summary') && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <WidgetHeader
                title="Penjualan & Piutang (Kasbon)"
                icon={Receipt}
                color="#a855f7"
                onRefresh={() => fetchAll(true)}
                onClose={() => toggleWidget('sales_summary')}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, flex: 1, alignItems: 'center' }}>
                <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(165, 180, 252, 0.1)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Faktur Lunas (Terbayar)</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                    {rupiah(salesRec.paid_sales || 0)}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Tunai, QRIS, Debit, Transfer
                  </div>
                </div>

                <div style={{ padding: '12px 14px', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11.5, color: '#fb7185', fontWeight: 600 }}>Belum Lunas (Kasbon Customer)</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#fb7185', marginTop: 4 }}>
                    {rupiah(salesRec.unpaid_receivables || 0)}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {Number(salesRec.overdue_receivables || 0) > 0 ? (
                      <span style={{ color: '#ef4444' }}>⚠️ Lewat Jatuh Tempo: {rupiah(salesRec.overdue_receivables)}</span>
                    ) : (
                      'Belum Jatuh Tempo'
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              WIDGET 7: BARANG STOK MINIMUM (ACCURATE MIN STOCK ALERT)
              ======================================================== */}
          {activeWidgets.includes('min_stock') && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <WidgetHeader
                title="Barang Stok Minimum"
                icon={AlertTriangle}
                color="#f59e0b"
                badge={`${minStock.length} perlu restock`}
                onRefresh={() => fetchAll(true)}
                onClose={() => toggleWidget('min_stock')}
              />
              <div style={{ flex: 1, maxHeight: 260, overflowY: 'auto' }}>
                {minStock.length > 0 ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Bahan / Barang</th>
                          <th className="right">Sisa Stok</th>
                          <th className="right">Batas Min</th>
                          <th className="right">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {minStock.map((it) => (
                          <tr key={it.id}>
                            <td style={{ fontWeight: 600 }}>{it.name}</td>
                            <td className="mono right" style={{ color: it.current_stock <= 0 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                              {num(it.current_stock)} {it.unit}
                            </td>
                            <td className="mono right" style={{ color: 'var(--text-secondary)' }}>
                              {num(it.min_stock)} {it.unit}
                            </td>
                            <td className="right">
                              <span style={{
                                fontSize: 10,
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: it.status === 'HABIS' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                color: it.status === 'HABIS' ? '#f87171' : '#fbbf24',
                              }}>
                                {it.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 10px', color: '#34d399', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={28} />
                    <span>Seluruh stok bahan baku berada dalam kondisi aman (di atas batas minimum).</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              WIDGET 8: PRODUK TERLARIS (TOP SELLING MENU)
              ======================================================== */}
          {activeWidgets.includes('top_products') && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <WidgetHeader
                title="Produk Terlaris"
                icon={ShoppingBag}
                color="#ec4899"
                onRefresh={() => fetchAll(true)}
                onClose={() => toggleWidget('top_products')}
              />
              <div style={{ flex: 1, maxHeight: 260, overflowY: 'auto' }}>
                {topProducts.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {topProducts.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: idx === 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(165, 180, 252, 0.1)',
                            color: idx === 0 ? '#fbbf24' : 'var(--text-secondary)',
                            fontWeight: 800,
                            fontSize: 11,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {idx + 1}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, color: '#ffffff', fontSize: 13 }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              Terjual: <strong>{p.qty} porsi</strong>
                            </div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#34d399', fontSize: 13 }}>
                          {rupiah(p.revenue)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 10px', color: 'var(--text-secondary)', fontSize: 13 }}>
                    Belum ada menu terjual pada periode ini.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              WIDGET 9: AUDIT VARIANCE & RESEP (SIGNATURE COST CONTROL)
              ======================================================== */}
          {activeWidgets.includes('cost_control') && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <WidgetHeader
                title="Audit Variance & Resep"
                icon={Layers}
                color="#8b5cf6"
                onRefresh={() => fetchAll(true)}
                onClose={() => toggleWidget('cost_control')}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <div style={{ padding: '8px 10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#34d399', fontWeight: 700 }}>✓ NORMAL</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#34d399', marginTop: 2 }}>{statusCounts.NORMAL ?? 0}</div>
                  </div>
                  <div style={{ padding: '8px 10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>⚠ WASPADA</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>{statusCounts.WASPADA ?? 0}</div>
                  </div>
                  <div style={{ padding: '8px 10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }}>✕ ANOMALI</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#f87171', marginTop: 2 }}>{statusCounts['TIDAK WAJAR'] ?? 0}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(244, 63, 94, 0.08)', borderRadius: 8, border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#fb7185' }}>Selisih Tak Jelas (Shrinkage)</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fb7185', marginTop: 2 }}>{rupiah(totalVarianceLoss)}</div>
                  </div>
                  <button
                    onClick={() => navigate('/variance/bahan')}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11.5, alignSelf: 'center' }}
                  >
                    Buka Audit Resep →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              WIDGET 10: KERUGIAN WASTE & LIMBAH DAPUR
              ======================================================== */}
          {activeWidgets.includes('waste') && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <WidgetHeader
                title="Kerugian Waste & Limbah"
                icon={Trash2}
                color="#ef4444"
                badge={`Rugi: ${rupiah(totalWasteValue)}`}
                onRefresh={() => fetchAll(true)}
                onClose={() => toggleWidget('waste')}
              />
              <div style={{ flex: 1, maxHeight: 240, overflowY: 'auto' }}>
                {topWaste.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {topWaste.map((tw, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: 'rgba(239, 68, 68, 0.05)',
                          border: '1px solid rgba(239, 68, 68, 0.15)',
                          borderRadius: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#ffffff', fontSize: 13 }}>{tw.ingredient?.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            Terbuang: <strong style={{ color: '#fb923c' }}>{num(tw.waste_qty || tw.waste)} {tw.ingredient?.unit_pakai}</strong>
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#ef4444', fontSize: 13 }}>
                          {rupiah(tw.waste_value || 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 10px', color: '#34d399', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={28} />
                    <span>Tidak ada catatan limbah atau bahan baku rusak resmi pada periode ini.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              WIDGET 11: SHIFT KASIR & OPERASIONAL
              ======================================================== */}
          {activeWidgets.includes('active_shift') && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <WidgetHeader
                title="Shift Kasir Aktif"
                icon={Clock}
                color="#14b8a6"
                onRefresh={() => fetchAll(true)}
                onClose={() => toggleWidget('active_shift')}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {activeShift ? (
                  <div style={{ padding: '14px', background: 'rgba(20, 184, 166, 0.08)', border: '1px solid rgba(20, 184, 166, 0.25)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#2dd4bf', background: 'rgba(20, 184, 166, 0.2)', padding: '2px 8px', borderRadius: 6 }}>
                        ● SHIFT AKTIF
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Mulai: {activeShift.started_at}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
                      {activeShift.cashier_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Cabang: {activeShift.outlet_name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(165, 180, 252, 0.15)', fontSize: 12.5 }}>
                      <span>Modal Awal Kas: <strong>{rupiah(activeShift.initial_cash || 0)}</strong></span>
                      <span style={{ color: '#34d399', fontWeight: 700 }}>Omzet Shift: {rupiah(activeShift.total_sales || 0)}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 10px', color: 'var(--text-secondary)', fontSize: 13 }}>
                    Tidak ada kasir yang sedang membuka shift saat ini.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          PRINTABLE EXECUTIVE REPORT MODAL (PRESERVED)
          ------------------------------------------------------------- */}
      {showReportModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowReportModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 7, 16, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16
          }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 920,
              maxHeight: '92vh',
              background: '#0d1226',
              border: '1px solid rgba(165, 180, 252, 0.25)',
              borderRadius: 14,
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Modal Action Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(79, 70, 229, 0.15)', color: 'var(--accent-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                    Pratinjau Dokumen Laporan Eksekutif
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Format resmi siap cetak / simpan sebagai PDF untuk Akuntan, Mitra & Investor
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleExportExcel}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34d399' }}
                >
                  <FileSpreadsheet size={14} /> Export Excel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handlePrintPdf}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}
                >
                  <Printer size={14} /> Cetak / Simpan PDF
                </button>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => setShowReportModal(false)}
                  style={{ padding: 6, marginLeft: 4 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Document Paper Container */}
            <div style={{ overflowY: 'auto', padding: '24px 28px', background: '#0a0e20' }}>
              <div
                id="printable-dashboard-report"
                className="printable-document"
                style={{
                  padding: '30px 36px',
                  background: '#ffffff',
                  color: '#0f172a',
                  borderRadius: 10,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                  maxWidth: 850,
                  margin: '0 auto'
                }}
              >
                {/* 1. KOP RESMI LAPORAN */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5px solid #0f172a', paddingBottom: 16, marginBottom: 20 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#4f46e5' }} />
                      <span style={{ fontWeight: 800, fontSize: 18, color: '#1e1b4b', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                        {businessName}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginTop: 3 }}>
                      LAPORAN EKSEKUTIF COST CONTROL & ANALISIS VARIANSI
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      MOVA POS — Advanced Inventory Cost Accounting & Recipe Yield Protection
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#4f46e5', background: '#eef2ff', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Dokumen Manajemen F&B
                    </span>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                      No. Dokumen: <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>REP-CC-{period.from.replace(/-/g, '')}-{period.to.replace(/-/g, '')}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Waktu Cetak: {new Date().toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                {/* 2. PARAMETER AUDIT METADATA */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 20, fontSize: 11.5 }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 700 }}>Cabang / Gudang</div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginTop: 1 }}>{outletName}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 700 }}>Rentang Periode Audit</div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginTop: 1 }}>{period.from} s/d {period.to}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 700 }}>Otorisasi Dokumen</div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginTop: 1 }}>{currentUser?.name || 'Administrator'}</div>
                  </div>
                </div>

                {/* 3. EXECUTIVE KPI CARDS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                  <div style={{ padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                    <div style={{ fontSize: 10.5, color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>Bahan Sesuai Resep</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d', marginTop: 4 }}>{statusCounts.NORMAL ?? 0} Bahan</div>
                    <div style={{ fontSize: 10, color: '#16a34a', marginTop: 2 }}>Akurasi takaran koki optimal</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                    <div style={{ fontSize: 10.5, color: '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>Peringatan Toleransi</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#b45309', marginTop: 4 }}>{(statusCounts.WASPADA ?? 0) + (statusCounts['TIDAK WAJAR'] ?? 0)} Bahan</div>
                    <div style={{ fontSize: 10, color: '#d97706', marginTop: 2 }}>Perlu kalibrasi takaran dapur</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8 }}>
                    <div style={{ fontSize: 10.5, color: '#9f1239', fontWeight: 700, textTransform: 'uppercase' }}>Nilai Kerugian Waste</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#be123c', marginTop: 4 }}>{rupiah(totalWasteValue)}</div>
                    <div style={{ fontSize: 10, color: '#e11d48', marginTop: 2 }}>Bahan basi, gosong, tumpah</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: 8 }}>
                    <div style={{ fontSize: 10.5, color: '#86198f', fontWeight: 700, textTransform: 'uppercase' }}>Selisih Fisik Tak Jelas</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#a21caf', marginTop: 4 }}>{rupiah(totalVarianceLoss)}</div>
                    <div style={{ fontSize: 10, color: '#c026d3', marginTop: 2 }}>Anomali fisik vs teoritis</div>
                  </div>
                </div>

                {/* 4. TABLE AUDIT BAHAN */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', borderBottom: '1.5px solid #cbd5e1', paddingBottom: 6, marginBottom: 10 }}>
                    1. AUDIT BAHAN BAKU DENGAN SELISIH TERTINGGI (TOP ANOMALIES)
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Bahan Baku</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>% Deviasi</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Nilai Selisih (Rp)</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Klasifikasi Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {varData.slice(0, 5).map((iv, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{iv.ingredient?.name}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{pct(iv.variance_pct)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: iv.variance_value > 0 ? '#b91c1c' : '#15803d' }}>
                            {rupiah(iv.variance_value)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: iv.status === 'NORMAL' ? '#dcfce7' : iv.status === 'WASPADA' ? '#fef3c7' : '#fee2e2', color: iv.status === 'NORMAL' ? '#166534' : iv.status === 'WASPADA' ? '#92400e' : '#991b1b' }}>
                              {iv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 5. TANDA TANGAN VALIDASI */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 36, paddingTop: 16, borderTop: '1px solid #cbd5e1', textAlign: 'center', fontSize: 11 }}>
                  <div>
                    <div style={{ color: '#64748b' }}>Dipersiapkan Oleh:</div>
                    <div style={{ height: 48 }} />
                    <div style={{ fontWeight: 700, borderTop: '1px solid #cbd5e1', paddingTop: 4 }}>Staff Dapur / Kasir</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b' }}>Diperiksa & Diaudit:</div>
                    <div style={{ height: 48 }} />
                    <div style={{ fontWeight: 700, borderTop: '1px solid #cbd5e1', paddingTop: 4 }}>Store Manager / Cost Controller</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b' }}>Disetujui Oleh:</div>
                    <div style={{ height: 48 }} />
                    <div style={{ fontWeight: 700, borderTop: '1px solid #cbd5e1', paddingTop: 4 }}>Owner / Direksi Usaha</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// HELPER COMPONENT: WIDGET CARD HEADER (ACCURATE STYLE)
// -------------------------------------------------------------
function WidgetHeader({ title, icon: Icon, color, badge, onRefresh, onClose }) {
  const [spin, setSpin] = useState(false);

  function handleRefreshClick() {
    setSpin(true);
    if (onRefresh) onRefresh();
    setTimeout(() => setSpin(false), 500);
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 12,
      marginBottom: 14,
      borderBottom: '1px solid rgba(165, 180, 252, 0.12)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          background: `${color}18`,
          border: `1px solid ${color}35`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color,
        }}>
          <Icon size={15} />
        </div>
        <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
          {title}
        </h4>
        {badge && (
          <span style={{
            fontSize: 10.5,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 6,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(165, 180, 252, 0.15)',
            color: 'var(--text-secondary)',
          }}>
            {badge}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          type="button"
          onClick={handleRefreshClick}
          className="btn btn-ghost btn-icon"
          style={{ padding: 5, color: 'var(--text-secondary)' }}
          title="Segarkan data widget"
        >
          <RotateCw size={14} className={spin ? 'spin-anim' : ''} />
        </button>

        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-icon"
          style={{ padding: 5, color: 'var(--text-secondary)' }}
          title="Sembunyikan widget dari dashboard"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
