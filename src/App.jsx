import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import { LoadingState } from './components/ui';
import { OutletProvider } from './context/OutletContext';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy loaded page components for fast initial load and code-splitting
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MasterBahan = lazy(() => import('./pages/MasterBahan'));
const MasterPerlengkapan = lazy(() => import('./pages/MasterPerlengkapan'));
const MasterMenu = lazy(() => import('./pages/MasterMenu'));
const POS = lazy(() => import('./pages/POS'));
const StockMovement = lazy(() => import('./pages/StockMovement'));
const StockOpname = lazy(() => import('./pages/StockOpname'));
const VarianceBahan = lazy(() => import('./pages/VarianceBahan'));
const VarianceMenu = lazy(() => import('./pages/VarianceMenu'));
const Profitability = lazy(() => import('./pages/Profitability'));
const RootCause = lazy(() => import('./pages/RootCause'));
const KartuStok = lazy(() => import('./pages/KartuStok'));
const ShiftManagement = lazy(() => import('./pages/ShiftManagement'));
const OutletManagement = lazy(() => import('./pages/OutletManagement'));
const TransferBahan = lazy(() => import('./pages/TransferBahan'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const BusinessManagement = lazy(() => import('./pages/BusinessManagement'));
const BatchPrep = lazy(() => import('./pages/BatchPrep'));
const WasteTracking = lazy(() => import('./pages/WasteTracking'));
const DiscountManagement = lazy(() => import('./pages/DiscountManagement'));
const ProfitLoss = lazy(() => import('./pages/ProfitLoss'));
const CashFlow = lazy(() => import('./pages/CashFlow'));
const CoinManagement = lazy(() => import('./pages/CoinManagement'));
const OpexManagement = lazy(() => import('./pages/OpexManagement'));
const UrgentNotes = lazy(() => import('./pages/UrgentNotes'));
const Receivables = lazy(() => import('./pages/Receivables'));

function PrivateRoute({ children }) {
  const token = localStorage.getItem('pos_token');
  return token ? children : <Navigate to="/login" replace />;
}

function RoleRoute({ roles, children }) {
  const token = localStorage.getItem('pos_token');
  if (!token) return <Navigate to="/login" replace />;

  const user = JSON.parse(localStorage.getItem('pos_user') || '{}');
  const isSuperadminPlatform = user.role === 'superadmin_platform' || user.role === 'superadmin' || Boolean(user.is_superadmin_platform);
  const isOwnerWebsite = user.role === 'owner_website' || Boolean(user.is_owner_website);
  const isPlatformAdmin = isSuperadminPlatform || isOwnerWebsite;
  const isOwnerBisnis = user.role === 'owner_bisnis' || user.role === 'owner' || user.role === 'admin' || Boolean(user.is_owner_bisnis);
  const isOwnerOutlet = user.role === 'owner_outlet' || user.role === 'manager_outlet' || Boolean(user.is_owner_outlet);
  const isPegawai = !isPlatformAdmin && !isOwnerBisnis && !isOwnerOutlet;

  let allowed = false;
  if ((roles.includes('platform_admin') || roles.includes('superadmin') || roles.includes('owner_website')) && isPlatformAdmin) allowed = true;
  if (roles.includes('owner_bisnis') && (isOwnerBisnis || isPlatformAdmin)) allowed = true;
  if (roles.includes('owner_outlet') && (isOwnerOutlet || isOwnerBisnis || isPlatformAdmin)) allowed = true;
  if (roles.includes('pegawai')) allowed = true; // All authenticated roles can access operational routes

  if (!allowed) {
    return <Navigate to={isPegawai ? "/pos" : "/"} replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <OutletProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#11162d',
            color: '#ffffff',
            border: '1px solid rgba(165, 180, 252, 0.2)',
            borderRadius: '10px',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '13px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#11162d' } },
          error:   { iconTheme: { primary: '#f43f5e', secondary: '#11162d' } },
        }}
      />
      <ErrorBoundary>
        <Suspense fallback={<LoadingState />}>
          <Routes>
            <Route path="/login"           element={<Login />} />
            <Route path="/register"        element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/" element={
              <PrivateRoute><Layout /></PrivateRoute>
            }>
              {/* Dashboard & Master Data */}
              <Route index             element={<RoleRoute roles={['owner_outlet', 'owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><Dashboard /></RoleRoute>} />
              <Route path="bahan"      element={<RoleRoute roles={['owner_outlet', 'owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><MasterBahan /></RoleRoute>} />
              <Route path="perlengkapan" element={<RoleRoute roles={['owner_outlet', 'owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><MasterPerlengkapan /></RoleRoute>} />
              <Route path="menu"       element={<RoleRoute roles={['owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><MasterMenu /></RoleRoute>} />
              <Route path="outlet"     element={<RoleRoute roles={['owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><OutletManagement /></RoleRoute>} />
              <Route path="users"      element={<RoleRoute roles={['owner_outlet', 'owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><UserManagement /></RoleRoute>} />

              {/* SaaS Platform (Superadmin / Website Owner ONLY & Tenant Coin Billing) */}
              <Route path="businesses" element={<RoleRoute roles={['platform_admin', 'superadmin', 'owner_website']}><BusinessManagement /></RoleRoute>} />
              <Route path="coin-management" element={<RoleRoute roles={['owner_bisnis', 'owner_website', 'superadmin', 'platform_admin']}><CoinManagement /></RoleRoute>} />

              {/* Operasional (Staff & Kasir Accessible) */}
              <Route path="pos"          element={<RoleRoute roles={['pegawai']}><POS /></RoleRoute>} />
              <Route path="urgent-notes" element={<RoleRoute roles={['pegawai']}><UrgentNotes /></RoleRoute>} />
              <Route path="shift"        element={<RoleRoute roles={['pegawai']}><ShiftManagement /></RoleRoute>} />
              <Route path="transfer"     element={<RoleRoute roles={['pegawai']}><TransferBahan /></RoleRoute>} />
              <Route path="batch-prep"   element={<RoleRoute roles={['pegawai']}><BatchPrep /></RoleRoute>} />
              <Route path="waste"        element={<RoleRoute roles={['pegawai']}><WasteTracking /></RoleRoute>} />
              <Route path="kartu-stok"   element={<RoleRoute roles={['pegawai']}><KartuStok /></RoleRoute>} />

              {/* Operasional Manajemen (Owner Bisnis & Manager Cabang) */}
              <Route path="diskon"       element={<RoleRoute roles={['owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><DiscountManagement /></RoleRoute>} />
              <Route path="movement"     element={<RoleRoute roles={['owner_outlet', 'owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><StockMovement /></RoleRoute>} />
              <Route path="opname"       element={<RoleRoute roles={['owner_outlet', 'owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><StockOpname /></RoleRoute>} />
              <Route path="opex"         element={<RoleRoute roles={['owner_outlet', 'owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><OpexManagement /></RoleRoute>} />
              <Route path="expenses"     element={<RoleRoute roles={['owner_outlet', 'owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><OpexManagement /></RoleRoute>} />

              {/* Analitik & Keuangan */}
              <Route path="variance/bahan" element={<RoleRoute roles={['owner_outlet', 'owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><VarianceBahan /></RoleRoute>} />
              <Route path="variance/menu"  element={<RoleRoute roles={['owner_outlet', 'owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><VarianceMenu /></RoleRoute>} />
              <Route path="profit-loss"    element={<RoleRoute roles={['owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><ProfitLoss /></RoleRoute>} />
              <Route path="cash-flow"      element={<RoleRoute roles={['owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><CashFlow /></RoleRoute>} />
              <Route path="piutang"        element={<RoleRoute roles={['owner_outlet', 'owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><Receivables /></RoleRoute>} />
              <Route path="profitability"  element={<RoleRoute roles={['owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><Profitability /></RoleRoute>} />
              <Route path="root-cause"     element={<RoleRoute roles={['owner_bisnis', 'platform_admin', 'owner_website', 'superadmin']}><RootCause /></RoleRoute>} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
      </OutletProvider>
    </BrowserRouter>
  );
}
