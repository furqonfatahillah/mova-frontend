import { useState, useEffect, useMemo } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, UtensilsCrossed, ShoppingCart,
  ArrowUpDown, ClipboardList, BarChart2, TrendingUp, DollarSign,
  AlertTriangle, LogOut, ScrollText, Menu, X, Clock,
  Store, Send, Users, Building2, ChefHat, Trash2, Percent, Landmark, Wallet, Coins, Gift, Copy, Check, Receipt, Headset,
  AlertOctagon
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
    isOwnerWebsite,
    isPlatformAdmin,
    isOwnerBisnis,
    isOwnerOutlet,
    isPegawai,
    userBusinessName,
    coinBalance,
    coinsPerTransaction,
    remainingTransactions,
    isCoinLow,
    isCoinOut,
    userReferralCode,
  } = useOutletContext();

  const navSections = useMemo(() => {
    // 1. Owner Website (Penyedia SaaS / Superadmin Platform)
    if (isPlatformAdmin) {
      const basePlatformSections = [
        {
          label: 'SaaS Platform',
          items: [
            { to: '/businesses', label: 'Kelola Penyewa (SaaS)', icon: Building2 },
            { to: '/coin-management', label: 'Top Up & Koin Platform', icon: Coins },
          ],
        },
        {
          label: 'Manajemen Platform',
          items: [
            { to: '/users', label: 'Kelola Pengguna Platform', icon: Users, isUserMgmt: true },
          ],
        },
      ];

      // If Owner Website selected a tenant from the switcher, render tenant inspection section
      if (activeBusinessId) {
        return [
          ...basePlatformSections,
          {
            label: `Inspeksi: ${currentBusiness?.name || 'Tenant'}`,
            items: [
              { to: '/', label: 'Dashboard Tenant', icon: LayoutDashboard },
              { to: '/bahan', label: 'Master Bahan & Resep', icon: Package },
              { to: '/menu', label: 'Master Menu & Harga', icon: UtensilsCrossed },
              { to: '/outlet', label: 'Cabang Outlet', icon: Store },
              { to: '/pos', label: 'POS / Transaksi', icon: ShoppingCart },
              { to: '/urgent-notes', label: 'Nota Urgent', icon: AlertOctagon },
              { to: '/shift', label: 'Kelola Shift', icon: Clock },
              { to: '/batch-prep', label: 'Produksi Batch', icon: ChefHat },
              { to: '/waste', label: 'Bahan Terbuang (Waste)', icon: Trash2 },
              { to: '/diskon', label: 'Promo & Diskon', icon: Percent },
              { to: '/transfer', label: 'Transfer Stok', icon: Send },
              { to: '/kartu-stok', label: 'Kartu Stok', icon: ScrollText },
              { to: '/movement', label: 'Riwayat Mutasi', icon: ArrowUpDown },
              { to: '/opname', label: 'Stock Opname', icon: ClipboardList },
              { to: '/opex', label: 'Biaya Operasional (OPEX)', icon: Receipt },
              { to: '/profit-loss', label: 'Laba Rugi (P&L)', icon: Landmark },
              { to: '/cash-flow', label: 'Arus Kas (Cash Flow)', icon: Wallet },
              { to: '/variance/bahan', label: 'Variance Bahan', icon: BarChart2 },
              { to: '/variance/menu', label: 'Variance Menu', icon: TrendingUp },
              { to: '/profitability', label: 'Profitability', icon: DollarSign },
              { to: '/root-cause', label: 'Root Cause', icon: AlertTriangle },
            ],
          },
          {
            label: 'Bantuan & Support',
            items: [
              {
                isExternal: true,
                href: 'https://wa.me/6281244295923?text=Halo%20Admin%20Helpdesk%20MOVA%20POS,%20saya%20butuh%20bantuan.',
                label: 'Helpdesk WA (+62 812-4429-5923)',
                icon: Headset,
              },
            ],
          },
        ];
      }

      // Default Platform Mode (No Tenant Selected)
      return [
        ...basePlatformSections,
        {
          label: 'Bantuan & Support',
          items: [
            {
              isExternal: true,
              href: 'https://wa.me/6281244295923?text=Halo%20Admin%20Helpdesk%20MOVA%20POS,%20saya%20butuh%20bantuan.',
              label: 'Helpdesk WA (+62 812-4429-5923)',
              icon: Headset,
            },
          ],
        },
      ];
    }

    // 2. Owner Bisnis (Penyewa / Pemilik Resto / Cafe)
    if (isOwnerBisnis) {
      return [
        {
          label: 'Tagihan Usaha',
          items: [
            { to: '/coin-management', label: 'Cek Saldo Koin Usaha', icon: Coins },
          ],
        },
        {
          label: 'Overview',
          items: [
            { to: '/', label: 'Dashboard', icon: LayoutDashboard },
          ],
        },
        {
          label: 'Master Bisnis',
          items: [
            { to: '/bahan', label: 'Master Resep & HPP Bahan', icon: Package },
            { to: '/menu', label: 'Master Menu & Modifier', icon: UtensilsCrossed },
            { to: '/outlet', label: 'Tambah Cabang Outlet', icon: Store },
            { to: '/users', label: 'Kelola Manager & Pegawai', icon: Users, isUserMgmt: true },
          ],
        },
        {
          label: 'Operasional',
          items: [
            { to: '/pos', label: 'POS / Transaksi', icon: ShoppingCart },
            { to: '/urgent-notes', label: 'Nota Urgent (Bahan)', icon: AlertOctagon },
            { to: '/shift', label: 'Kelola Shift Kasir', icon: Clock },
            { to: '/batch-prep', label: 'Produksi Batch (Prep)', icon: ChefHat },
            { to: '/waste', label: 'Bahan Terbuang (Waste)', icon: Trash2 },
            { to: '/diskon', label: 'Master Diskon & Promo', icon: Percent },
            { to: '/transfer', label: 'Transfer Stok / Barang', icon: Send },
            { to: '/kartu-stok', label: 'Kartu Stok', icon: ScrollText },
            { to: '/movement', label: 'Riwayat Mutasi', icon: ArrowUpDown },
            { to: '/opname', label: 'Stock Opname', icon: ClipboardList },
            { to: '/opex', label: 'Biaya Operasional (OPEX)', icon: Receipt },
          ],
        },
        {
          label: 'Finansial & Analitik',
          items: [
            { to: '/profit-loss', label: 'Laba Rugi (P&L)', icon: Landmark },
            { to: '/cash-flow', label: 'Arus Kas (Cash Flow)', icon: Wallet },
            { to: '/variance/bahan', label: 'Analisis Varian Bahan', icon: BarChart2 },
            { to: '/variance/menu', label: 'Analisis Varian Menu', icon: TrendingUp },
            { to: '/profitability', label: 'Profitability (Menu Eng.)', icon: DollarSign },
            { to: '/root-cause', label: 'Root Cause Analysis', icon: AlertTriangle },
          ],
        },
        {
          label: 'Bantuan & Support',
          items: [
            {
              isExternal: true,
              href: 'https://wa.me/6281244295923?text=Halo%20Admin%20Helpdesk%20MOVA%20POS,%20saya%20butuh%20bantuan.',
              label: 'Helpdesk WA (+62 812-4429-5923)',
              icon: Headset,
            },
          ],
        },
      ];
    }

    // 3. Owner Outlet / Manager Cabang (Kepala Toko)
    if (isOwnerOutlet) {
      return [
        {
          label: 'Overview Cabang',
          items: [
            { to: '/', label: 'Dashboard Cabang', icon: LayoutDashboard },
          ],
        },
        {
          label: 'Kepegawaian Cabang',
          items: [
            { to: '/users', label: 'Kelola Pegawai Cabang', icon: Users, isUserMgmt: true },
          ],
        },
        {
          label: 'Operasional Cabang',
          items: [
            { to: '/pos', label: 'POS Kasir', icon: ShoppingCart },
            { to: '/urgent-notes', label: 'Nota Urgent', icon: AlertOctagon },
            { to: '/shift', label: 'Shift Kasir', icon: Clock },
            { to: '/batch-prep', label: 'Batch Prep Dapur', icon: ChefHat },
            { to: '/waste', label: 'Waste Log', icon: Trash2 },
            { to: '/opex', label: 'Biaya Operasional Cabang', icon: Receipt },
          ],
        },
        {
          label: 'Logistik Cabang',
          items: [
            { to: '/transfer', label: 'Transfer Bahan (Kirim/Terima)', icon: Send },
            { to: '/kartu-stok', label: 'Kartu Stok Cabang', icon: ScrollText },
            { to: '/movement', label: 'Riwayat Mutasi', icon: ArrowUpDown },
            { to: '/opname', label: 'Stock Opname Cabang', icon: ClipboardList },
          ],
        },
        {
          label: 'Analitik Cabang',
          items: [
            { to: '/variance/bahan', label: 'Analisis Varian Bahan', icon: BarChart2 },
            { to: '/variance/menu', label: 'Analisis Varian Menu', icon: TrendingUp },
          ],
        },
        {
          label: 'Bantuan & Support',
          items: [
            {
              isExternal: true,
              href: 'https://wa.me/6281244295923?text=Halo%20Admin%20Helpdesk%20MOVA%20POS,%20saya%20butuh%20bantuan.',
              label: 'Helpdesk WA (+62 812-4429-5923)',
              icon: Headset,
            },
          ],
        },
      ];
    }

    // 4. Pegawai (Kasir / Barista / Kitchen Staff)
    return [
      {
        label: 'Operasional Kasir & Dapur',
        items: [
          { to: '/pos', label: 'POS / Transaksi', icon: ShoppingCart },
          { to: '/urgent-notes', label: 'Nota Urgent', icon: AlertOctagon },
          { to: '/shift', label: 'Shift Kasir', icon: Clock },
          { to: '/batch-prep', label: 'Produksi Batch (Dapur)', icon: ChefHat },
          { to: '/waste', label: 'Bahan Terbuang (Waste)', icon: Trash2 },
          { to: '/transfer', label: 'Transfer Stok (Terima/Kirim)', icon: Send },
          { to: '/kartu-stok', label: 'Kartu Stok', icon: ScrollText },
        ],
      },
      {
        label: 'Bantuan & Support',
        items: [
          {
            isExternal: true,
            href: 'https://wa.me/6281244295923?text=Halo%20Admin%20Helpdesk%20MOVA%20POS,%20saya%20butuh%20bantuan.',
            label: 'Helpdesk WA (+62 812-4429-5923)',
            icon: Headset,
          },
        ],
      },
    ];
  }, [isPlatformAdmin, isOwnerBisnis, isOwnerOutlet, isPegawai, activeBusinessId, currentBusiness]);

  useEffect(() => {
    if (!isPegawai) {
      fetchPendingCount();
    }
  }, [isPegawai]);

  async function fetchPendingCount() {
    try {
      const { data } = await api.get('/users?status=pending');
      setPendingCount(data.counts?.pending || 0);
    } catch { }
  }

  async function handleLogout() {
    try {
      await api.post('/logout');
    } catch { }
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
              {section.items.map(({ to, href, label, icon: Icon, isUserMgmt, isExternal }) => (
                isExternal ? (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSidebarOpen(false)}
                    className="nav-item"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#25D366' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Icon size={16} className="nav-icon" style={{ color: '#25D366' }} />
                      <span style={{ fontWeight: 700 }}>{label}</span>
                    </div>
                    <span style={{ fontSize: 10, background: 'rgba(37, 211, 102, 0.15)', color: '#25D366', padding: '1px 7px', borderRadius: 6, fontWeight: 800 }}>
                      WA ↗
                    </span>
                  </a>
                ) : (
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
                )
              ))}
            </div>
          ))}
        </nav>

        {/* Footer User Info */}
        <div className="sidebar-footer">
          {/* User Referral Code Card */}
          {(userReferralCode || user.referral_code) && (
            <div
              style={{
                marginBottom: 10,
                padding: '7px 10px',
                borderRadius: 8,
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => {
                const code = userReferralCode || user.referral_code;
                navigator.clipboard.writeText(code);
                toast.success(`Kode referral Anda (${code}) disalin! Bagikan ke rekan Anda.`);
              }}
              title="Klik untuk menyalin kode referral Anda"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Gift size={13} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Kode Ref:</span>
                <strong style={{ fontSize: 12, color: '#fbbf24', letterSpacing: '0.05em' }}>
                  {userReferralCode || user.referral_code}
                </strong>
              </div>
              <Copy size={12} style={{ color: '#f59e0b', opacity: 0.8 }} />
            </div>
          )}

          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.name || 'User'}</div>
              <div className="sidebar-user-role" style={{ fontSize: 11, color: 'var(--accent-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                {user.role === 'superadmin_platform' || user.role === 'superadmin' ? 'Superadmin Platform' :
                  user.role === 'owner_bisnis' || user.role === 'owner' ? 'Owner Bisnis' :
                    user.role === 'owner_website' ? 'Owner Website' :
                      isOwnerOutlet ? `Owner (${user.outlet_name || 'Outlet'})` :
                        `Pegawai (${user.outlet_name || 'Kasir'})`}
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
            {isPlatformAdmin && !activeBusinessId ? (
              <div className="top-header-outlet-info">
                <div className="top-header-icon" style={{ background: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent-bright)' }}>
                  <Building2 size={18} />
                </div>
                <div>
                  <div className="top-header-outlet-label">
                    Mode Panel
                  </div>
                  <div className="top-header-outlet-name">
                    <span>Pusat Layanan SaaS Platform</span>
                    <span className="top-header-badge pusat" style={{ background: 'rgba(99, 102, 241, 0.25)', color: 'var(--accent-bright)' }}>SUPERADMIN</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="top-header-outlet-info">
                <div className="top-header-icon">
                  <Store size={18} />
                </div>
                <div>
                  <div className="top-header-outlet-label">
                    {isPlatformAdmin ? `Inspeksi Cabang (${currentBusiness?.name || 'Tenant'})` : 'Cabang Operasional Aktif'}
                  </div>
                  <div className="top-header-outlet-name">
                    <span>{activeOutlet?.name || 'Cabang Terpilih'}</span>
                    {activeOutlet?.is_main && (
                      <span className="top-header-badge pusat">PUSAT</span>
                    )}
                    {!isPlatformAdmin && isOwnerOutlet && (
                      <span className="top-header-badge terisolasi">TERISOLASI</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Business Badge */}
            <div className="top-header-business-badge">
              <Building2 size={14} style={{ color: 'var(--accent-bright)' }} />
              <span className="top-header-business-name">
                {isPlatformAdmin && !activeBusinessId ? '🌐 Platform Provider MOVA' : (currentBusiness?.name || userBusinessName)}
              </span>
              {currentBusiness?.package_type && (
                <span className="top-header-pkg-badge">
                  {currentBusiness.package_type}
                </span>
              )}
            </div>

            {/* Coin Balance Badge - ONLY for Owner Bisnis */}
            {isOwnerBisnis && (
              <NavLink
                to="/coin-management"
                className="top-header-coin-badge"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 12px',
                  borderRadius: 10,
                  background: isCoinOut ? 'rgba(239, 68, 68, 0.15)' : isCoinLow ? 'rgba(245, 158, 11, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                  border: `1px solid ${isCoinOut ? 'rgba(239, 68, 68, 0.35)' : isCoinLow ? 'rgba(245, 158, 11, 0.35)' : 'rgba(139, 92, 246, 0.3)'}`,
                  boxShadow: isCoinLow ? '0 0 12px rgba(245, 158, 11, 0.2)' : 'none',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
                title={`Saldo Koin Usaha: ${coinBalance} koin (${coinsPerTransaction} koin/nota). Klik untuk informasi top-up.`}
              >
                <Coins size={16} style={{ color: isCoinOut ? '#ef4444' : isCoinLow ? '#f59e0b' : 'var(--accent-bright)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: isCoinOut ? '#f87171' : isCoinLow ? '#fbbf24' : '#ffffff' }}>
                    {coinBalance.toLocaleString()} Koin
                  </span>
                  <span style={{ fontSize: 10, color: isCoinOut ? '#fca5a5' : isCoinLow ? '#fde68a' : 'var(--text-secondary)', fontWeight: 600 }}>
                    {remainingTransactions.toLocaleString()} Nota Sisa
                  </span>
                </div>
              </NavLink>
            )}

            {/* In Inspection Mode: show inspected tenant's coin balance */}
            {isPlatformAdmin && activeBusinessId && (
              <div
                className="top-header-coin-badge"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 12px',
                  borderRadius: 10,
                  background: isCoinOut ? 'rgba(239, 68, 68, 0.15)' : isCoinLow ? 'rgba(245, 158, 11, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                  border: `1px solid ${isCoinOut ? 'rgba(239, 68, 68, 0.35)' : isCoinLow ? 'rgba(245, 158, 11, 0.35)' : 'rgba(139, 92, 246, 0.3)'}`,
                }}
                title={`Saldo Koin Tenant (${currentBusiness?.name}): ${coinBalance} koin`}
              >
                <Coins size={16} style={{ color: isCoinOut ? '#ef4444' : isCoinLow ? '#f59e0b' : 'var(--accent-bright)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: isCoinOut ? '#f87171' : isCoinLow ? '#fbbf24' : '#ffffff' }}>
                    {coinBalance.toLocaleString()} Koin
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Saldo Tenant
                  </span>
                </div>
              </div>
            )}

            {/* User Referral Badge in Header */}
            {(userReferralCode || user.referral_code) && (
              <div
                className="top-header-referral-badge"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 10,
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  const code = userReferralCode || user.referral_code;
                  navigator.clipboard.writeText(code);
                  toast.success(`Kode referral Anda (${code}) disalin!`);
                }}
                title="Klik untuk menyalin kode referral Anda"
              >
                <Gift size={14} style={{ color: '#f59e0b' }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>Ref:</span>
                <strong style={{ color: '#fbbf24', fontSize: 12.5, letterSpacing: '0.05em' }}>
                  {userReferralCode || user.referral_code}
                </strong>
                <Copy size={12} style={{ color: '#f59e0b', opacity: 0.8 }} />
              </div>
            )}
          </div>

          <div className="top-header-right">
            {/* Platform Admin Tenant Switcher */}
            {isPlatformAdmin && businesses.length > 0 && (
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

            {(isPlatformAdmin ? Boolean(activeBusinessId) : isOwnerBisnis) ? (
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
            ) : !isPlatformAdmin ? (
              <div className="top-header-isolated-badge">
                <span>Mutasi & stok bahan diisolasi khusus cabang {user.outlet_name || 'ini'}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Remote Support / Inspection Mode Banner for Platform Admin */}
        {isPlatformAdmin && activeBusinessId && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            borderRadius: 12,
            padding: '10px 18px',
            margin: '0 24px 16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99, 102, 241, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 size={18} style={{ color: 'var(--accent-bright)' }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, color: '#ffffff', fontSize: 13 }}>
                  🔍 Mode Remote Support / Inspeksi Tenant Aktif: {currentBusiness?.name || 'Tenant Terpilih'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 1 }}>
                  Anda sedang menginspeksi modul operasional, resep, dan laporan finansial milik penyewa ini.
                </div>
              </div>
            </div>
            <button
              onClick={() => changeBusiness('')}
              className="btn btn-ghost btn-sm"
              style={{
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.1)',
                whiteSpace: 'nowrap',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
              title="Keluar dari mode inspeksi tenant dan kembali ke dashboard SaaS Platform"
            >
              <X size={14} />
              Keluar Mode Inspeksi
            </button>
          </div>
        )}

        {/* Out of Coins Alert Banner */}
        {(isPlatformAdmin ? (Boolean(activeBusinessId) && isCoinOut) : isCoinOut) && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.22), rgba(185, 28, 28, 0.15))',
            border: '1px solid rgba(239, 68, 68, 0.45)',
            borderRadius: 12,
            padding: '12px 18px',
            margin: '0 24px 16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 4px 20px rgba(239, 68, 68, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(239, 68, 68, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={20} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, color: '#f87171', fontSize: 14 }}>
                  {isPlatformAdmin
                    ? `🚫 Saldo Koin Tenant ${currentBusiness?.name || userBusinessName} Habis!`
                    : '🚫 Saldo Koin Transaksi Perusahaan Habis!'}
                </div>
                <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 2 }}>
                  {isPlatformAdmin
                    ? `Saldo koin bisnis penyewa ini telah habis. Sebagai Pemilik Platform, Anda dapat menambahkan koin sekarang agar kasir penyewa dapat bertransaksi.`
                    : 'Sisa koin perusahaan Anda tidak mencukupi untuk memproses nota transaksi baru di kasir. Silakan segera hubungi Pemilik Website untuk top-up koin.'}
                </div>
              </div>
            </div>
            <NavLink to="/coin-management" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
              {isPlatformAdmin ? '⚡ Top Up Koin Tenant' : 'Top Up Sekarang'}
            </NavLink>
          </div>
        )}

        {/* Low Coins Alert Banner */}
        {(isPlatformAdmin ? (Boolean(activeBusinessId) && !isCoinOut && isCoinLow) : (!isCoinOut && isCoinLow)) && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.18), rgba(217, 119, 6, 0.12))',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 12,
            padding: '12px 18px',
            margin: '0 24px 16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(245, 158, 11, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: 14 }}>
                  {isPlatformAdmin
                    ? `⚠️ Peringatan: Saldo Koin Tenant ${currentBusiness?.name || userBusinessName} Menipis (${remainingTransactions} Nota Tersisa)`
                    : `⚠️ Peringatan: Saldo Koin Menipis (${remainingTransactions} Nota Tersisa)`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {isPlatformAdmin
                    ? `Sisa koin bisnis penyewa ini tinggal ${coinBalance.toLocaleString()} koin (${remainingTransactions.toLocaleString()} nota tersisa). Anda dapat melakukan top up koin untuk penyewa ini.`
                    : <>Sisa koin perusahaan Anda tinggal <strong>{coinBalance.toLocaleString()} koin</strong> (hanya dapat digunakan untuk <strong>{remainingTransactions.toLocaleString()} nota transaksi lagi</strong> di semua cabang). Segera hubungi <strong>Pemilik Website</strong> untuk top-up koin agar operasional kasir tidak terhenti.</>}
                </div>
              </div>
            </div>
            <NavLink to="/coin-management" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
              {isPlatformAdmin ? '⚡ Top Up Koin Tenant' : 'Top Up Koin'}
            </NavLink>
          </div>
        )}

        <Outlet />
      </main>
    </div>
  );
}
