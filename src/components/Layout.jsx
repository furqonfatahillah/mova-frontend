import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, UtensilsCrossed, ShoppingCart,
  ArrowUpDown, ClipboardList, BarChart2, TrendingUp, DollarSign,
  AlertTriangle, LogOut, ScrollText, Menu, X, Clock,
  Store, Send, Users, Building2, ChefHat, Trash2, Percent, Landmark, Wallet
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useOutlet as useOutletContext } from '../context/OutletContext';

export default function Layout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('pos_user') || '{}');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const {
    outlets,
    activeOutletId,
    activeOutlet,
    changeOutlet,
    businesses,
    currentBusiness,
    activeBusinessId,
    changeBusiness,
    isSuperadminPlatform,
    isOwnerBisnis,
    isOwnerWebsite,
    isOwnerOutlet,
    isPegawai,
    userBusinessName,
  } = useOutletContext();

  const navSections = [
    ...(isSuperadminPlatform ? [
      {
        label: 'SaaS Platform',
        items: [
          { to: '/businesses', label: 'Kelola Penyewa (SaaS)', icon: Building2 },
        ],
      },
    ] : []),
    {
      label: 'Overview',
      items: [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Master Data',
      items: [
        { to: '/bahan', label: 'Master Bahan', icon: Package },
        { to: '/menu', label: 'Master Menu', icon: UtensilsCrossed },
        ...(isOwnerWebsite || isOwnerOutlet ? [
          { to: '/outlet', label: 'Cabang Outlet', icon: Store }
        ] : []),
        ...(!isPegawai ? [
          {
            to: '/users',
            label: isOwnerOutlet ? 'Kelola Pegawai' : 'Kelola Pengguna',
            icon: Users,
            isUserMgmt: true
          }
        ] : []),
      ],
    },
    {
      label: 'Operasional',
      items: [
        { to: '/pos', label: 'POS / Transaksi', icon: ShoppingCart },
        { to: '/shift', label: 'Kelola Shift', icon: Clock },
        { to: '/batch-prep', label: 'Produksi Batch (Prep)', icon: ChefHat },
        { to: '/waste', label: 'Bahan Terbuang (Waste)', icon: Trash2 },
        { to: '/diskon', label: 'Promo & Diskon', icon: Percent },
        { to: '/transfer', label: 'Transfer Bahan', icon: Send },
        { to: '/kartu-stok', label: 'Kartu Stok', icon: ScrollText },
        { to: '/movement', label: 'Riwayat Mutasi', icon: ArrowUpDown },
        { to: '/opname', label: 'Stock Opname', icon: ClipboardList },
      ],
    },
    {
      label: 'Analitik',
      items: [
        { to: '/profit-loss', label: 'Laba Rugi (P&L)', icon: Landmark },
        { to: '/cash-flow', label: 'Arus Kas (Cash Flow)', icon: Wallet },
        { to: '/variance/bahan', label: 'Variance Bahan', icon: BarChart2 },
        { to: '/variance/menu', label: 'Variance Menu', icon: TrendingUp },
        { to: '/profitability', label: 'Profitability', icon: DollarSign },
        { to: '/root-cause', label: 'Root Cause', icon: AlertTriangle },
      ],
    },
  ];

  useEffect(() => {
    if (!isPegawai) {
      fetchPendingCount();
    }
  }, [isPegawai]);

  async function fetchPendingCount() {
    try {
      const { data } = await api.get('/users?status=pending');
      setPendingCount(data.counts?.pending || 0);
    } catch {}
  }

  async function handleLogout() {
    try {
      await api.post('/logout');
    } catch {}
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    toast.success('Berhasil keluar');
    navigate('/login');
  }

  return (
    <div className="app-layout">
      {/* Mobile Topbar */}
      <header className="mobile-topbar">
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => setSidebarOpen(true)}
          aria-label="Buka Menu Navigasi"
        >
          <Menu size={22} />
        </button>
        <div className="mobile-topbar-brand">
          <div className="sidebar-logo-icon" style={{ width: 28, height: 28, margin: 0, borderRadius: 7, padding: 3 }}>
            <img src="/mova%20logo.svg" alt="MOVA POS Logo" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: '#ffffff' }}>MOVA</span>
          {/* Active outlet badge on mobile */}
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
            background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)',
            color: 'var(--accent-bright)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {activeOutlet?.name || 'Cabang'}
          </span>
        </div>
        <div className="mobile-topbar-user">
          <div className="sidebar-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
            {user.name?.[0]?.toUpperCase() || 'A'}
          </div>
        </div>
      </header>

      {/* Backdrop for Mobile Sidebar */}
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="sidebar-logo-icon">
              <img src="/mova%20logo.svg" alt="MOVA POS Logo" />
            </div>
            {/* Close Button on Mobile Drawer */}
            <button
              className="btn btn-ghost btn-icon mobile-close-btn"
              onClick={() => setSidebarOpen(false)}
              aria-label="Tutup Menu"
            >
              <X size={20} />
            </button>
          </div>
          <h1>MOVA POS</h1>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }} title="Filosofi: mendorong bisnis untuk terus bergerak dan berkembang">
            Move Your Business Forward
          </p>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map(({ to, label, icon: Icon, isUserMgmt }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={16} className="nav-icon" />
                    <span>{label}</span>
                  </div>
                  {isUserMgmt && pendingCount > 0 && (
                    <span
                      style={{
                        background: '#f59e0b',
                        color: '#11162d',
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '1px 7px',
                        borderRadius: 10,
                        lineHeight: '15px',
                        boxShadow: '0 0 10px rgba(245, 158, 11, 0.5)'
                      }}
                      title={`${pendingCount} pendaftar menunggu persetujuan`}
                    >
                      {pendingCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer User Info */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.name || 'User'}</div>
              <div className="sidebar-user-role" style={{ fontSize: 11, color: 'var(--accent-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                {isOwnerWebsite ? 'Owner Website' : isOwnerOutlet ? `Owner (${user.outlet_name || 'Outlet'})` : `Pegawai (${user.outlet_name || 'Kasir'})`}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-ghost btn-icon"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content fade-in">
        {/* Top Header Bar: Active Branch Status & Quick Switcher */}
        <div className="top-header-bar">
          <div className="top-header-left">
            <div className="top-header-outlet-info">
              <div className="top-header-icon">
                <Store size={18} />
              </div>
              <div>
                <div className="top-header-outlet-label">
                  Cabang Operasional Aktif
                </div>
                <div className="top-header-outlet-name">
                  <span>{activeOutlet?.name || 'Cabang Terpilih'}</span>
                  {activeOutlet?.is_main && (
                    <span className="top-header-badge pusat">PUSAT</span>
                  )}
                  {!isOwnerWebsite && (
                    <span className="top-header-badge terisolasi">TERISOLASI</span>
                  )}
                </div>
              </div>
            </div>

            {/* Business Badge */}
            <div className="top-header-business-badge">
              <Building2 size={14} style={{ color: 'var(--accent-bright)' }} />
              <span className="top-header-business-name">
                {userBusinessName}
              </span>
              {currentBusiness?.package_type && (
                <span className="top-header-pkg-badge">
                  {currentBusiness.package_type}
                </span>
              )}
            </div>
          </div>

          <div className="top-header-right">
            {/* Superadmin Tenant Switcher */}
            {isSuperadminPlatform && businesses.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="top-header-switcher-label">Tenant:</span>
                <select
                  className="form-control top-header-tenant-select"
                  value={activeBusinessId || ''}
                  onChange={(e) => changeBusiness(e.target.value)}
                >
                  <option value="">🌐 Semua Tenant (Platform)</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      🏢 {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isOwnerWebsite ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                <span className="top-header-switcher-label">Ganti Cabang:</span>
                <select
                  id="global-outlet-switcher"
                  className="form-control top-header-outlet-select"
                  value={activeOutletId}
                  onChange={(e) => changeOutlet(e.target.value)}
                >
                  <option value="ALL">🌐 Semua Cabang (Konsolidasi)</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.is_main ? '🏢 ' : '📍 '} {o.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="top-header-isolated-badge">
                <span>Mutasi & stok bahan diisolasi khusus cabang {user.outlet_name || 'ini'}</span>
              </div>
            )}
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
