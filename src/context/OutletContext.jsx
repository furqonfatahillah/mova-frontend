import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api/client';

const OutletContext = createContext(null);

export function OutletProvider({ children }) {
  const [outlets, setOutlets] = useState([]);
  const [loadingOutlets, setLoadingOutlets] = useState(true);
  const [businesses, setBusinesses] = useState([]);
  const [currentBusiness, setCurrentBusiness] = useState(null);

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('pos_user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const isSuperadminPlatform =
    currentUser.role === 'superadmin_platform' ||
    currentUser.role === 'superadmin' ||
    Boolean(currentUser.is_superadmin_platform);

  const isOwnerBisnis =
    currentUser.role === 'owner_bisnis' ||
    currentUser.role === 'owner_website' ||
    currentUser.role === 'owner' ||
    currentUser.role === 'admin' ||
    Boolean(currentUser.is_owner_bisnis) ||
    Boolean(currentUser.is_owner_website);

  const isOwnerOutlet =
    currentUser.role === 'owner_outlet' ||
    currentUser.role === 'manager_outlet' ||
    Boolean(currentUser.is_owner_outlet);

  const isPegawai = !isSuperadminPlatform && !isOwnerBisnis && !isOwnerOutlet;

  // Active business ID for Superadmin
  const [activeBusinessId, setActiveBusinessIdState] = useState(() => {
    if (!isSuperadminPlatform && currentUser.business_id) {
      return String(currentUser.business_id);
    }
    return localStorage.getItem('pos_active_business_id') || (currentUser.business_id ? String(currentUser.business_id) : '');
  });

  // For owner_bisnis / superadmin: can be a specific outlet ID or 'ALL'
  // For branch manager/pegawai: strictly locked to user's assigned outlet
  const [activeOutletId, setActiveOutletIdState] = useState(() => {
    if (!isOwnerBisnis && !isSuperadminPlatform && currentUser.outlet_id) {
      return String(currentUser.outlet_id);
    }
    return localStorage.getItem('pos_active_outlet_id') || (currentUser.outlet_id ? String(currentUser.outlet_id) : '1');
  });

  const [coinData, setCoinData] = useState(null);
  const [loadingCoins, setLoadingCoins] = useState(false);

  const fetchOutlets = useCallback(async () => {
    setLoadingOutlets(true);
    try {
      const { data } = await api.get('/outlets');
      setOutlets(data);
      // If current active outlet is not in the list and not 'ALL', set to first outlet
      if (data && data.length > 0) {
        const found = data.some(o => String(o.id) === String(activeOutletId));
        if (!found && activeOutletId !== 'ALL') {
          const firstId = String(data[0].id);
          setActiveOutletIdState(firstId);
          localStorage.setItem('pos_active_outlet_id', firstId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch outlets:', err);
    } finally {
      setLoadingOutlets(false);
    }
  }, [activeOutletId]);

  const fetchBusinessData = useCallback(async () => {
    try {
      if (isSuperadminPlatform) {
        const { data } = await api.get('/businesses');
        setBusinesses(data);
        if (activeBusinessId) {
          const b = data.find(item => String(item.id) === String(activeBusinessId));
          setCurrentBusiness(b || data[0] || null);
        } else if (data.length > 0) {
          setCurrentBusiness(data[0]);
        }
      } else if (currentUser.business) {
        setCurrentBusiness(currentUser.business);
      } else if (currentUser.business_id) {
        const { data } = await api.get('/my-business');
        setCurrentBusiness(data);
      }
    } catch (err) {
      console.error('Failed to fetch business data:', err);
    }
  }, [isSuperadminPlatform, activeBusinessId, currentUser]);

  const fetchCoinData = useCallback(async () => {
    try {
      setLoadingCoins(true);
      const params = isSuperadminPlatform && activeBusinessId ? { business_id: activeBusinessId } : {};
      const { data } = await api.get('/my-business/coins', { params });
      setCoinData(data);
    } catch (err) {
      // Non-blocking failover
    } finally {
      setLoadingCoins(false);
    }
  }, [isSuperadminPlatform, activeBusinessId]);

  useEffect(() => {
    fetchOutlets();
    fetchBusinessData();
    fetchCoinData();

    const handleTxCompleted = () => {
      fetchCoinData();
    };
    window.addEventListener('pos:transaction_completed', handleTxCompleted);
    return () => {
      window.removeEventListener('pos:transaction_completed', handleTxCompleted);
    };
  }, [fetchOutlets, fetchBusinessData, fetchCoinData]);

  const changeOutlet = (outletId) => {
    if (!isOwnerBisnis && !isSuperadminPlatform) return; // Disallow branch users from switching
    const val = String(outletId);
    setActiveOutletIdState(val);
    localStorage.setItem('pos_active_outlet_id', val);
    window.dispatchEvent(new CustomEvent('pos:outlet_changed', { detail: val }));
  };

  const changeBusiness = (businessId) => {
    if (!isSuperadminPlatform) return;
    const val = String(businessId);
    setActiveBusinessIdState(val);
    if (val) {
      localStorage.setItem('pos_active_business_id', val);
    } else {
      localStorage.removeItem('pos_active_business_id');
    }
    const b = businesses.find(item => String(item.id) === val);
    setCurrentBusiness(b || null);
    fetchOutlets();
    fetchCoinData();
    window.dispatchEvent(new CustomEvent('pos:business_changed', { detail: val }));
  };

  // Find the active outlet object
  const activeOutlet = useMemo(() => {
    if (activeOutletId === 'ALL' || activeOutletId === 'all') {
      return { id: 'ALL', name: 'Semua Cabang (Konsolidasi)', code: 'ALL', is_main: false };
    }
    return outlets.find((o) => String(o.id) === String(activeOutletId)) || outlets[0] || null;
  }, [outlets, activeOutletId]);

  const value = {
    outlets,
    loadingOutlets,
    currentUser,
    activeOutletId,
    activeOutlet,
    changeOutlet,
    businesses,
    currentBusiness,
    activeBusinessId,
    changeBusiness,
    isSuperadminPlatform,
    isOwnerBisnis,
    isOwnerWebsite: isOwnerBisnis || isSuperadminPlatform,
    isOwnerOutlet,
    isPegawai,
    userOutletId: currentUser.outlet_id,
    userOutletName: currentUser.outlet_name,
    userBusinessName: currentUser.business_name || currentBusiness?.name || 'MOVA Cloud',
    refreshOutlets: fetchOutlets,
    refreshBusiness: fetchBusinessData,
    coinData,
    loadingCoins,
    coinBalance: Number(coinData?.coin_balance ?? 0),
    coinsPerTransaction: Number(coinData?.coins_per_transaction ?? 1),
    remainingTransactions: Number(coinData?.remaining_transactions ?? 0),
    isCoinLow: Boolean(coinData?.is_coin_low),
    isCoinOut: Boolean(coinData?.is_coin_out),
    refreshCoins: fetchCoinData,
  };

  return <OutletContext.Provider value={value}>{children}</OutletContext.Provider>;
}

export function useOutlet() {
  const context = useContext(OutletContext);
  if (!context) {
    throw new Error('useOutlet must be used within an OutletProvider');
  }
  return context;
}
