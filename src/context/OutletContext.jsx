import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api/client';

const OutletContext = createContext(null);

export function OutletProvider({ children }) {
  const [outlets, setOutlets] = useState([]);
  const [loadingOutlets, setLoadingOutlets] = useState(true);
  const [businesses, setBusinesses] = useState([]);
  const [currentBusiness, setCurrentBusiness] = useState(null);

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pos_user') || '{}');
    } catch {
      return {};
    }
  });

  const refreshCurrentUser = useCallback(async () => {
    try {
      const { data } = await api.get('/me');
      if (data) {
        setCurrentUser(data);
        localStorage.setItem('pos_user', JSON.stringify(data));
      }
    } catch { }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('pos_token')) {
      refreshCurrentUser();
    }
  }, [refreshCurrentUser]);

  const isSuperadminPlatform =
    currentUser.role === 'superadmin_platform' ||
    currentUser.role === 'superadmin' ||
    Boolean(currentUser.is_superadmin_platform);

  const isOwnerWebsite =
    currentUser.role === 'owner_website' ||
    Boolean(currentUser.is_owner_website);

  const isPlatformAdmin = isSuperadminPlatform || isOwnerWebsite;

  const isOwnerBisnis =
    currentUser.role === 'owner_bisnis' ||
    currentUser.role === 'owner' ||
    currentUser.role === 'admin' ||
    Boolean(currentUser.is_owner_bisnis);

  const isOwnerOutlet =
    currentUser.role === 'owner_outlet' ||
    currentUser.role === 'manager_outlet' ||
    Boolean(currentUser.is_owner_outlet);

  const isPegawai = !isPlatformAdmin && !isOwnerBisnis && !isOwnerOutlet;

  // Active business ID for Platform Admin (Superadmin / Owner Website)
  const [activeBusinessId, setActiveBusinessIdState] = useState(() => {
    if (isPlatformAdmin) {
      return localStorage.getItem('pos_active_business_id') || '';
    }
    return currentUser.business_id ? String(currentUser.business_id) : '';
  });

  // For owner_bisnis / platform admin: can be a specific outlet ID or 'ALL'
  // For branch manager/pegawai: strictly locked to user's assigned outlet
  const [activeOutletId, setActiveOutletIdState] = useState(() => {
    if (!isOwnerBisnis && !isPlatformAdmin && currentUser.outlet_id) {
      return String(currentUser.outlet_id);
    }
    return localStorage.getItem('pos_active_outlet_id') || (currentUser.outlet_id ? String(currentUser.outlet_id) : '1');
  });

  // Reactive lock: Always force employee/outlet users to their assigned outlet
  useEffect(() => {
    if (!isOwnerBisnis && !isPlatformAdmin && currentUser?.outlet_id) {
      const forcedId = String(currentUser.outlet_id);
      setActiveOutletIdState(forcedId);
      localStorage.setItem('pos_active_outlet_id', forcedId);
    }
  }, [isOwnerBisnis, isPlatformAdmin, currentUser?.outlet_id]);

  const [coinData, setCoinData] = useState(null);
  const [loadingCoins, setLoadingCoins] = useState(false);

  const fetchOutlets = useCallback(async () => {
    setLoadingOutlets(true);
    try {
      const { data } = await api.get('/outlets');
      setOutlets(data || []);
    } catch (err) {
      console.error('Failed to fetch outlets:', err);
    } finally {
      setLoadingOutlets(false);
    }
  }, []);

  const fetchBusinessData = useCallback(async () => {
    try {
      if (isPlatformAdmin) {
        const { data } = await api.get('/businesses');
        setBusinesses(data);
        if (activeBusinessId) {
          const b = data.find(item => String(item.id) === String(activeBusinessId));
          setCurrentBusiness(b || null);
        } else {
          setCurrentBusiness(null);
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
  }, [isPlatformAdmin, activeBusinessId, currentUser]);

  const fetchCoinData = useCallback(async () => {
    try {
      if (isPlatformAdmin && !activeBusinessId) {
        // Platform admin in global view does NOT have a tenant coin balance
        setCoinData(null);
        return;
      }
      setLoadingCoins(true);
      const params = isPlatformAdmin && activeBusinessId ? { business_id: activeBusinessId } : {};
      const { data } = await api.get('/my-business/coins', { params });
      if (data?.is_platform_admin && !activeBusinessId) {
        setCoinData(null);
      } else {
        setCoinData(data);
      }
    } catch (err) {
      // Non-blocking failover
    } finally {
      setLoadingCoins(false);
    }
  }, [isPlatformAdmin, activeBusinessId]);

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

  const changeOutlet = useCallback((outletId) => {
    if (!isOwnerBisnis && !isPlatformAdmin) return; // Disallow branch users from switching
    const val = String(outletId);
    setActiveOutletIdState(val);
    localStorage.setItem('pos_active_outlet_id', val);
    window.dispatchEvent(new CustomEvent('pos:outlet_changed', { detail: val }));
  }, [isOwnerBisnis, isPlatformAdmin]);

  const changeBusiness = useCallback((businessId) => {
    if (!isPlatformAdmin) return;
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
  }, [isPlatformAdmin, businesses, fetchOutlets, fetchCoinData]);

  // Find the active outlet object
  const activeOutlet = useMemo(() => {
    if (!isOwnerBisnis && !isPlatformAdmin && currentUser?.outlet_id) {
      return outlets.find((o) => String(o.id) === String(currentUser.outlet_id)) || {
        id: currentUser.outlet_id,
        name: currentUser.outlet_name || 'Cabang Penempatan',
        code: 'OUT',
        is_main: false,
      };
    }
    if (activeOutletId === 'ALL' || activeOutletId === 'all') {
      return { id: 'ALL', name: 'Semua Cabang (Konsolidasi)', code: 'ALL', is_main: false };
    }
    return outlets.find((o) => String(o.id) === String(activeOutletId)) || outlets[0] || null;
  }, [outlets, activeOutletId, isOwnerBisnis, isPlatformAdmin, currentUser]);

  const hasCoinBalance = !isPlatformAdmin || Boolean(activeBusinessId);

  const canSwitchOutlet = isPlatformAdmin || isOwnerBisnis;

  const value = useMemo(() => ({
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
    isOwnerWebsite,
    isPlatformAdmin,
    isOwnerBisnis,
    isOwnerOutlet,
    isPegawai,
    canSwitchOutlet,
    userOutletId: currentUser.outlet_id,
    userOutletName: currentUser.outlet_name,
    userBusinessName: currentUser.business_name || currentBusiness?.name || (isPlatformAdmin ? '🌐 Platform Provider MOVA' : 'MOVA Cloud'),
    refreshOutlets: fetchOutlets,
    refreshBusiness: fetchBusinessData,
    coinData,
    loadingCoins,
    hasCoinBalance,
    coinBalance: Number(coinData?.coin_balance ?? 0),
    coinsPerTransaction: Number(coinData?.coins_per_transaction ?? 1),
    remainingTransactions: Number(coinData?.remaining_transactions ?? 0),
    isCoinLow: Boolean(coinData?.is_coin_low),
    isCoinOut: Boolean(coinData?.is_coin_out),
    refreshCoins: fetchCoinData,
    userReferralCode: currentUser?.referral_code,
    refreshUser: refreshCurrentUser,
  }), [
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
    isOwnerWebsite,
    isPlatformAdmin,
    isOwnerBisnis,
    isOwnerOutlet,
    isPegawai,
    canSwitchOutlet,
    fetchOutlets,
    fetchBusinessData,
    coinData,
    loadingCoins,
    hasCoinBalance,
    fetchCoinData,
    refreshCurrentUser,
  ]);

  return <OutletContext.Provider value={value}>{children}</OutletContext.Provider>;
}

export function useOutlet() {
  const context = useContext(OutletContext);
  if (!context) {
    throw new Error('useOutlet must be used within an OutletProvider');
  }
  return context;
}
