import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MasterBahan from './pages/MasterBahan';
import MasterMenu from './pages/MasterMenu';
import POS from './pages/POS';
import StockMovement from './pages/StockMovement';
import StockOpname from './pages/StockOpname';
import VarianceBahan from './pages/VarianceBahan';
import VarianceMenu from './pages/VarianceMenu';
import Profitability from './pages/Profitability';
import RootCause from './pages/RootCause';
import KartuStok from './pages/KartuStok';
import ShiftManagement from './pages/ShiftManagement';
import OutletManagement from './pages/OutletManagement';
import TransferBahan from './pages/TransferBahan';
import UserManagement from './pages/UserManagement';
import BusinessManagement from './pages/BusinessManagement';
import BatchPrep from './pages/BatchPrep';
import WasteTracking from './pages/WasteTracking';
import DiscountManagement from './pages/DiscountManagement';
import ProfitLoss from './pages/ProfitLoss';
import CashFlow from './pages/CashFlow';
import CoinManagement from './pages/CoinManagement';
import { OutletProvider } from './context/OutletContext';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('pos_token');
  return token ? children : <Navigate to="/login" replace />;
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
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={
          <PrivateRoute><Layout /></PrivateRoute>
        }>
          <Route index             element={<Dashboard />} />
          <Route path="bahan"      element={<MasterBahan />} />
          <Route path="menu"       element={<MasterMenu />} />
          <Route path="outlet"     element={<OutletManagement />} />
          <Route path="businesses" element={<BusinessManagement />} />
          <Route path="coin-management" element={<CoinManagement />} />
          <Route path="users"      element={<UserManagement />} />
          <Route path="pos"        element={<POS />} />
          <Route path="shift"      element={<ShiftManagement />} />
          <Route path="transfer"   element={<TransferBahan />} />
          <Route path="batch-prep" element={<BatchPrep />} />
          <Route path="waste"      element={<WasteTracking />} />
          <Route path="diskon"     element={<DiscountManagement />} />
          <Route path="kartu-stok" element={<KartuStok />} />
          <Route path="movement"   element={<StockMovement />} />
          <Route path="opname"     element={<StockOpname />} />
          <Route path="variance/bahan" element={<VarianceBahan />} />
          <Route path="variance/menu"  element={<VarianceMenu />} />
          <Route path="profitability"  element={<Profitability />} />
          <Route path="profit-loss"    element={<ProfitLoss />} />
          <Route path="cash-flow"      element={<CashFlow />} />
          <Route path="root-cause"     element={<RootCause />} />
        </Route>
      </Routes>
      </OutletProvider>
    </BrowserRouter>
  );
}
