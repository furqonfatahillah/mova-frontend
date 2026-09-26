import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, Receipt, Clock, AlertTriangle, ArrowRight,
  Search, X, Plus, Minus, Trash2, CheckCircle, Printer,
  CreditCard, QrCode, Banknote, Coffee, Pizza,
  Sparkles, User, Table, Store, Calendar, RotateCcw, Eye,
  Package, ShieldAlert, ArrowUpRight, Send, Bookmark, ChefHat,
  FileText, CheckCircle2, ChevronRight, PauseCircle, RefreshCw, XCircle, Users,
  Percent, Tag, Gift, Scissors, Split, Divide,
  ShoppingBag, Briefcase, Barcode, Utensils, Coins,
  Zap, AlertOctagon, Calculator,
  ChevronDown, Filter, Layers, UserCheck, UserPlus, Star, Award, Wallet
} from 'lucide-react';
import api from '../api/client';
import { rupiah, num, LoadingState, PageHeader } from '../components/ui';
import { printElement } from '../utils/print';
import { getTodayStr, getMonthStartStr, formatLocalDisplay } from '../utils/date';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import { confirmDialog } from '../utils/swal';

export default function POS() {
  const [menus, setMenus] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [urgentCount, setUrgentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL'); // 'ALL' | 'RECIPE' | 'DIRECT' | 'SERVICE'

  // Cart State
  const [cart, setCart] = useState([]);

  const [customerName, setCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [memberSearchResults, setMemberSearchResults] = useState([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [quickMemberModal, setQuickMemberModal] = useState({
    open: false,
    name: '',
    phone: '',
    saving: false,
  });
  const [orderDate, setOrderDate] = useState(getTodayStr());

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Midtrans Live Dynamic QRIS State
  const [midtransQris, setMidtransQris] = useState({
    active: false,
    loading: false,
    orderId: null,
    grossAmount: 0,
    qrImageUrl: null,
    qrString: null,
    isPaid: false,
    environment: 'sandbox',
    checking: false,
    error: null,
  });
  const [showStaticQrisFallback, setShowStaticQrisFallback] = useState(false);

  // Receipt Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);

  // History / Riwayat Nota Filters & State
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyPaymentMethod, setHistoryPaymentMethod] = useState('ALL');
  const [historyStatus, setHistoryStatus] = useState('PAID'); // 'PAID' | 'HOLD' | 'ALL'
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyViewMode, setHistoryViewMode] = useState('grouped'); // 'grouped' (per Nota) | 'flat' (rincian item)
  const [expandedHistoryOrders, setExpandedHistoryOrders] = useState({});

  // Modifier Selection Modal State
  const [modifierModal, setModifierModal] = useState({
    open: false,
    menu: null,
    status: null,
    selectedOptions: {},
    qty: 1,
    notes: '',
    isUrgent: false,
  });

  // Stock Out Alert Modal State
  const [stockAlertModal, setStockAlertModal] = useState({
    open: false,
    menu: null,
    status: null,
  });

  // Quick Restock Modal State (supports both raw ingredients & direct retail items)
  const [restockModal, setRestockModal] = useState({
    open: false,
    isDirectProduct: false,
    menuId: null,
    menuName: '',
    unit: 'pcs',
    currentStock: 0,
    ingredientId: '',
    qty: 10,
    unitType: 'BELI', // 'BELI' or 'PAKAI'
    totalPrice: '',
    unitPrice: '',
    notes: 'Restok Cepat Kasir',
    submitting: false,
  });

  // Open Bills & Table Management State
  const [openBills, setOpenBills] = useState([]);
  const [openBillsModalOpen, setOpenBillsModalOpen] = useState(false);
  const [activeOpenBillPayment, setActiveOpenBillPayment] = useState(null);
  const [appendModeBill, setAppendModeBill] = useState(null);

  const [mobileActiveTab, setMobileActiveTab] = useState('catalog');

  // Printing & Chit Modals
  const [kitchenChitModal, setKitchenChitModal] = useState({
    open: false,
    bill: null,
    items: [],
    isAdditional: false,
  });
  const [prebillModal, setPrebillModal] = useState({
    open: false,
    bill: null,
  });
  const [cancelBillModal, setCancelBillModal] = useState({
    open: false,
    bill: null,
    reason: '',
    submitting: false,
  });

  // Split Bill Modal State
  const [splitBillModal, setSplitBillModal] = useState({
    open: false,
    bill: null,
    mode: 'BY_ITEM', // 'BY_ITEM' or 'EQUAL'
    selectedItemQtys: {}, // { [trxId]: qtyToPay }
    totalSplits: 2,
    activeEqualIndex: 1,
    paymentMethod: 'CASH',
    cashReceived: '',
    customerName: '',
    notes: '',
    submitting: false,
  });

  // Discount & Voucher State
  const [availableDiscounts, setAvailableDiscounts] = useState([]);
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [customDiscountModal, setCustomDiscountModal] = useState({
    open: false,
    type: 'PERCENTAGE',
    value: '',
    name: 'Diskon Kasir',
  });



  const currentUser = JSON.parse(localStorage.getItem('pos_user') || '{}');
  const {
    activeOutletId,
    activeOutlet,
    isOwnerWebsite,
    isPlatformAdmin,
    isOwnerBisnis,
    isOwnerOutlet,
    isPegawai,
    changeOutlet,
    outlets,
    coinBalance,
    coinsPerTransaction,
    remainingTransactions,
    isCoinLow,
    isCoinOut,
    refreshCoins,
    dateRange,
  } = useOutlet();

  const historyPeriod = useMemo(() => ({
    from: dateRange?.from || getTodayStr(),
    to: dateRange?.to || getTodayStr(),
  }), [dateRange?.from, dateRange?.to]);

  const currentTargetOutlet = (!isOwnerBisnis && !isPlatformAdmin && currentUser.outlet_id)
    ? Number(currentUser.outlet_id)
    : (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all'
      ? Number(activeOutletId)
      : (currentUser.outlet_id || 1));

  useEffect(() => {
    fetchAll();
  }, [activeOutletId]);

  async function fetchOpenBills() {
    try {
      const res = await api.get('/transactions/open-bills', {
        params: { outlet_id: currentTargetOutlet }
      });
      setOpenBills(res.data || []);
    } catch (err) {
      console.error('Error fetching open bills:', err);
    }
  }

  async function fetchAll() {
    setLoading(true);
    try {
      const [m, t, i, s, ob, disc, urg] = await Promise.all([
        api.get('/menus'),
        api.get('/transactions', { params: { outlet_id: currentTargetOutlet, status: 'PAID', limit: 30 } }),
        api.get('/ingredients', { params: { outlet_id: currentTargetOutlet } }),
        api.get('/shifts/active', { params: { outlet_id: currentTargetOutlet } }),
        api.get('/transactions/open-bills', { params: { outlet_id: currentTargetOutlet } }),
        api.get('/discounts/available', { params: { outlet_id: currentTargetOutlet } }).catch(() => ({ data: [] })),
        api.get('/urgent-notes/summary', { params: { outlet_id: currentTargetOutlet } }).catch(() => ({ data: { pending_count: 0 } })),
      ]);
      setMenus(m.data.filter(x => x.active));
      setTransactions(t.data.slice(0, 30));
      setIngredients(i.data);
      setActiveShift(s.data);
      setOpenBills(ob.data || []);
      setAvailableDiscounts(disc.data || []);
      setUrgentCount(urg.data?.pending_count || 0);
    } catch {
      toast.error('Gagal memuat data POS');
    } finally {
      setLoading(false);
    }
  }

  async function fetchHistory(overridePeriod, overrideStatus, overridePayment, overrideSearch) {
    setHistoryLoading(true);
    try {
      const activeP = overridePeriod || historyPeriod;
      const activeStat = overrideStatus !== undefined ? overrideStatus : historyStatus;
      const activePay = overridePayment !== undefined ? overridePayment : historyPaymentMethod;
      const activeSearch = overrideSearch !== undefined ? overrideSearch : historySearch;

      const params = {
        outlet_id: currentTargetOutlet,
        limit: 1000,
      };
      if (activeP?.from) params.from = activeP.from;
      if (activeP?.to) params.to = activeP.to;
      if (activeStat && activeStat !== 'ALL') params.status = activeStat;
      if (activePay && activePay !== 'ALL') params.payment_method = activePay;
      if (activeSearch && activeSearch.trim()) params.search = activeSearch.trim();

      const res = await api.get('/transactions', { params });
      setTransactions(res.data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
      toast.error('Gagal memuat riwayat nota');
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (showHistory) {
      fetchHistory();
    }
  }, [showHistory, historyPeriod, historyStatus, historyPaymentMethod, currentTargetOutlet]);


  function toggleHistoryOrderExpand(orderNumber) {
    setExpandedHistoryOrders(prev => ({
      ...prev,
      [orderNumber]: !prev[orderNumber]
    }));
  }

  // Group transactions by order_number for Nota-level view
  const groupedHistory = useMemo(() => {
    const map = new Map();

    for (const t of transactions) {
      const ord = t.order_number || `TRX-${t.id}`;
      if (!map.has(ord)) {
        map.set(ord, {
          order_number: ord,
          date: t.date,
          created_at: t.created_at,
          customer_name: t.customer_name || 'Pelanggan Umum',
          order_type: t.order_type || 'DINE_IN',
          table_number: t.table_number || null,
          payment_method: t.payment_method || 'CASH',
          status: t.status || 'PAID',
          cashier_name: t.user?.name || 'Kasir',
          shift_name: t.shift?.shift_name || 'Reguler',
          outlet_name: t.outlet?.name || '',
          amount_paid: Number(t.amount_paid || 0),
          change_amount: Number(t.change_amount || 0),
          subtotal: 0,
          discount_amount: 0,
          discount_name: t.discount_name || null,
          total_price: 0,
          total_qty: 0,
          is_urgent_note: false,
          notes: t.notes || null,
          items: [],
          firstRecord: t,
        });
      }

      const order = map.get(ord);
      const itemSubtotal = Number(t.subtotal || t.total_price || 0);
      const itemDisc = Number(t.discount_amount || 0);
      const itemTotal = Number(t.total_price || 0);
      const itemQty = Number(t.qty || 1);

      order.subtotal += itemSubtotal;
      order.discount_amount += itemDisc;
      order.total_price += itemTotal;
      order.total_qty += itemQty;

      if (t.is_urgent_note) order.is_urgent_note = true;
      if (t.discount_name && !order.discount_name) order.discount_name = t.discount_name;
      if (t.notes && !order.notes) order.notes = t.notes;

      order.items.push(t);
    }

    return Array.from(map.values());
  }, [transactions]);

  const filteredGroupedHistory = useMemo(() => {
    if (!historySearch.trim()) return groupedHistory;
    const s = historySearch.toLowerCase().trim();
    return groupedHistory.filter(ord => {
      if (ord.order_number?.toLowerCase().includes(s)) return true;
      if (ord.customer_name?.toLowerCase().includes(s)) return true;
      if (ord.cashier_name?.toLowerCase().includes(s)) return true;
      if (ord.table_number?.toLowerCase().includes(s)) return true;
      if (ord.notes?.toLowerCase().includes(s)) return true;
      return ord.items.some(it =>
        it.menu?.name?.toLowerCase().includes(s) ||
        it.modifiers?.some(m => m.name?.toLowerCase().includes(s))
      );
    });
  }, [groupedHistory, historySearch]);

  const filteredFlatTransactions = useMemo(() => {
    if (!historySearch.trim()) return transactions;
    const s = historySearch.toLowerCase().trim();
    return transactions.filter(t => {
      if (t.order_number?.toLowerCase().includes(s)) return true;
      if (t.customer_name?.toLowerCase().includes(s)) return true;
      if (t.user?.name?.toLowerCase().includes(s)) return true;
      if (t.menu?.name?.toLowerCase().includes(s)) return true;
      if (t.notes?.toLowerCase().includes(s)) return true;
      return t.modifiers?.some(m => m.name?.toLowerCase().includes(s));
    });
  }, [transactions, historySearch]);

  const historyStats = useMemo(() => {
    const totalOrders = filteredGroupedHistory.length;
    const totalOmset = filteredGroupedHistory.reduce((sum, ord) => sum + (ord.total_price || 0), 0);
    const totalItems = filteredGroupedHistory.reduce((sum, ord) => sum + (ord.total_qty || 0), 0);
    const aov = totalOrders > 0 ? Math.round(totalOmset / totalOrders) : 0;
    return { totalOrders, totalOmset, totalItems, aov };
  }, [filteredGroupedHistory]);

  // Categories extraction
  const categories = useMemo(() => {
    const cats = new Set(menus.map(m => m.category || 'Lainnya'));
    return ['ALL', ...Array.from(cats)];
  }, [menus]);

  // Calculate available servings and stock status for any product type
  function getMenuStockStatus(menu, visitedIds = new Set()) {
    const itemType = menu.item_type || (menu.recipes && menu.recipes.length > 0 ? 'RECIPE' : (menu.track_stock ? 'DIRECT' : 'RECIPE'));

    // 1. Jasa / Layanan (SERVICE) - Tidak ada stok fisik & tidak butuh resep
    if (itemType === 'SERVICE') {
      return {
        itemType: 'SERVICE',
        hasRecipe: false,
        isService: true,
        availableServings: 9999,
        isSoldOut: false,
        isLowStock: false,
        reason: null,
        limitingIngredient: null,
        limitingItem: null,
        details: [],
        bundleItemsSummary: [],
      };
    }

    // 2. Retail / Barang Jadi (DIRECT) - Stok langsung per produk / outlet
    if (itemType === 'DIRECT') {
      const directStock = Number(menu.current_stock ?? menu.stock ?? 0);
      const trackStock = menu.track_stock !== false;
      const isSoldOut = trackStock && directStock <= 0;
      const minStock = Number(menu.current_min_stock ?? menu.min_stock ?? 5);
      const isLowStock = trackStock && !isSoldOut && directStock <= minStock;

      return {
        itemType: 'DIRECT',
        hasRecipe: false,
        isDirect: true,
        availableServings: directStock,
        trackStock,
        isSoldOut,
        isLowStock,
        reason: isSoldOut ? 'Stok produk habis' : null,
        limitingIngredient: null,
        limitingItem: null,
        details: [{
          id: menu.id,
          name: menu.name,
          required: 1,
          unit: menu.unit || 'pcs',
          stock: directStock,
          possibleServings: directStock,
          isDeficit: isSoldOut,
        }],
        bundleItemsSummary: [],
      };
    }

    // 3. Paket Bundling / Combo / Buy 1 Get 1 (BUNDLE)
    if (itemType === 'BUNDLE') {
      const bundleItems = menu.bundle_items || menu.bundleItems || [];

      if (bundleItems.length === 0) {
        return {
          itemType: 'BUNDLE',
          hasRecipe: false,
          isBundle: true,
          availableServings: 0,
          isSoldOut: true,
          isLowStock: false,
          reason: 'Belum ada rincian menu dalam paket bundling',
          limitingIngredient: null,
          limitingItem: { name: 'Isi paket kosong' },
          details: [],
          bundleItemsSummary: [],
        };
      }

      // Guard terhadap siklus rekursif bundling
      const currentVisited = new Set(visitedIds);
      currentVisited.add(menu.id);

      let minBundles = Infinity;
      let limitingItem = null;
      const details = [];
      const bundleItemsSummary = [];

      for (const bi of bundleItems) {
        const reqQty = Number(bi.qty) || 1;
        const targetMenuId = bi.bundled_menu_id || bi.bundledMenu?.id;

        if (targetMenuId) {
          // Komponen adalah menu lain (olahan resep / retail)
          const targetMenu = menus.find(m => m.id === targetMenuId) || bi.bundledMenu;
          if (!targetMenu) {
            minBundles = 0;
            limitingItem = { id: targetMenuId, name: `Menu #${targetMenuId}` };
            details.push({
              id: targetMenuId,
              name: `Menu #${targetMenuId}`,
              required: reqQty,
              unit: 'porsi',
              stock: 0,
              possibleServings: 0,
              isDeficit: true,
              isBundledMenu: true,
            });
            bundleItemsSummary.push({
              id: targetMenuId,
              name: `Menu #${targetMenuId}`,
              qty: reqQty,
              unit: 'porsi',
              availableServings: 0,
              isSoldOut: true,
            });
            continue;
          }

          let targetStatus;
          if (currentVisited.has(targetMenu.id)) {
            targetStatus = { availableServings: 0, isSoldOut: true };
          } else {
            targetStatus = getMenuStockStatus(targetMenu, currentVisited);
          }

          const targetAvailable = targetStatus.availableServings ?? 0;
          const possibleFromThisItem = Math.max(0, Math.floor(targetAvailable / reqQty));
          const isDeficit = targetStatus.isSoldOut || possibleFromThisItem <= 0;
          const subLimiting = targetStatus.limitingIngredient || targetStatus.limitingItem;

          details.push({
            id: targetMenu.id,
            name: targetMenu.name,
            required: reqQty,
            unit: targetMenu.unit || 'porsi',
            stock: targetAvailable,
            possibleServings: possibleFromThisItem,
            isDeficit,
            isBundledMenu: true,
            subLimiting,
          });

          bundleItemsSummary.push({
            id: targetMenu.id,
            name: targetMenu.name,
            qty: reqQty,
            unit: targetMenu.unit || 'porsi',
            availableServings: targetAvailable,
            isSoldOut: isDeficit,
            subLimiting,
          });

          if (possibleFromThisItem < minBundles) {
            minBundles = possibleFromThisItem;
            limitingItem = {
              id: targetMenu.id,
              name: targetMenu.name,
              available: targetAvailable,
              required: reqQty,
              unit: targetMenu.unit || 'porsi',
              subLimiting,
            };
          }
        } else if (bi.ingredient_id) {
          // Komponen adalah bahan baku langsung
          const ing = ingredients.find(i => i.id === bi.ingredient_id) || bi.ingredient;
          const currentStock = ing ? (ing.current_stock ?? ing.stok_awal ?? 0) : 0;
          const possibleFromThisItem = Math.max(0, Math.floor(currentStock / reqQty));
          const isDeficit = currentStock < reqQty;

          details.push({
            id: bi.ingredient_id,
            name: ing?.name || `Bahan #${bi.ingredient_id}`,
            required: reqQty,
            unit: bi.unit || ing?.unit_pakai || 'satuan',
            stock: currentStock,
            possibleServings: possibleFromThisItem,
            isDeficit,
            isBundledMenu: false,
          });

          bundleItemsSummary.push({
            id: bi.ingredient_id,
            name: ing?.name || `Bahan #${bi.ingredient_id}`,
            qty: reqQty,
            unit: bi.unit || ing?.unit_pakai || 'satuan',
            availableServings: possibleFromThisItem,
            isSoldOut: isDeficit,
          });

          if (possibleFromThisItem < minBundles) {
            minBundles = possibleFromThisItem;
            limitingItem = {
              id: bi.ingredient_id,
              name: ing?.name || `Bahan #${bi.ingredient_id}`,
              available: currentStock,
              required: reqQty,
              unit: bi.unit || ing?.unit_pakai || 'satuan',
            };
          }
        }
      }

      const availableServings = minBundles === Infinity ? 0 : minBundles;
      const isSoldOut = availableServings <= 0;
      const isLowStock = !isSoldOut && availableServings <= 5;

      return {
        itemType: 'BUNDLE',
        hasRecipe: true,
        isBundle: true,
        availableServings,
        isSoldOut,
        isLowStock,
        limitingItem,
        limitingIngredient: limitingItem,
        details,
        bundleItemsSummary,
      };
    }

    // 4. Olahan Resep / F&B (RECIPE)
    const recipe = menu.recipes?.[0];
    if (!recipe || !recipe.items || recipe.items.length === 0) {
      return {
        itemType: 'RECIPE',
        hasRecipe: false,
        availableServings: 9999,
        isSoldOut: false,
        isLowStock: false,
        reason: 'Belum ada resep aktif (Penjualan Bebas)',
        limitingIngredient: null,
        limitingItem: null,
        details: [],
        bundleItemsSummary: [],
      };
    }

    let minServings = Infinity;
    let limitingIngredient = null;
    const details = [];

    for (const item of recipe.items) {
      const ing = ingredients.find(i => i.id === item.ingredient_id) || item.ingredient;
      const currentStock = ing ? (ing.current_stock ?? ing.stok_awal ?? 0) : 0;
      const requiredQty = Number(item.qty) || 1;
      const possibleServings = Math.max(0, Math.floor(currentStock / requiredQty));
      const isDeficit = currentStock < requiredQty;

      details.push({
        id: item.ingredient_id,
        name: ing?.name || `Bahan #${item.ingredient_id}`,
        required: requiredQty,
        unit: item.unit || ing?.unit_pakai || 'satuan',
        stock: currentStock,
        possibleServings,
        isDeficit,
      });

      if (possibleServings < minServings) {
        minServings = possibleServings;
        limitingIngredient = {
          id: item.ingredient_id,
          name: ing?.name || `Bahan #${item.ingredient_id}`,
          unit: item.unit || ing?.unit_pakai || 'satuan',
          stock: currentStock,
          required: requiredQty,
        };
      }
    }

    const availableServings = minServings === Infinity ? 0 : minServings;
    const isSoldOut = availableServings <= 0;
    const isLowStock = !isSoldOut && availableServings <= 5;

    return {
      itemType: 'RECIPE',
      hasRecipe: true,
      availableServings,
      isSoldOut,
      isLowStock,
      limitingIngredient,
      limitingItem: limitingIngredient,
      details,
      bundleItemsSummary: [],
    };
  }

  // Filtered menus with stock status attached
  const filteredMenus = useMemo(() => {
    return menus
      .filter(m => {
        const itemType = m.item_type || 'RECIPE';
        const matchType = selectedType === 'ALL' || itemType === selectedType;
        const matchCat = selectedCategory === 'ALL' || (m.category || 'Lainnya') === selectedCategory;
        const q = searchQuery.toLowerCase().trim();
        const matchSearch = !q ||
          m.name.toLowerCase().includes(q) ||
          (m.code && m.code.toLowerCase().includes(q)) ||
          (m.barcode && m.barcode.toLowerCase().includes(q));
        return matchType && matchCat && matchSearch;
      })
      .map(m => ({
        ...m,
        stockStatus: getMenuStockStatus(m),
      }));
  }, [menus, selectedCategory, selectedType, searchQuery, ingredients]);

  // Member autocomplete search
  async function searchMembers(query = '') {
    setSearchingMembers(true);
    try {
      const res = await api.get('/customers/search-pos', { params: { q: query } });
      setMemberSearchResults(res.data || []);
    } catch (e) {
      setMemberSearchResults([]);
    } finally {
      setSearchingMembers(false);
    }
  }

  function handleSelectCustomer(cust) {
    setSelectedCustomer(cust);
    setCustomerName(cust.name);
    setMemberSearchOpen(false);
    toast.success(`Member "${cust.name}" dipilih (${num(cust.total_points || 0)} poin)!`);
  }

  function handleClearCustomer() {
    setSelectedCustomer(null);
    setCustomerName('');
    if (appliedDiscount && appliedDiscount.requires_points > 0) {
      setAppliedDiscount(null);
      toast.info(`Diskon "${appliedDiscount.name}" dilepas karena member dibatalkan.`);
    }
  }

  async function handleQuickRegisterMember(e) {
    e.preventDefault();
    if (!quickMemberModal.name.trim() || !quickMemberModal.phone.trim()) {
      toast.error('Nama dan Nomor HP wajib diisi.');
      return;
    }
    setQuickMemberModal(p => ({ ...p, saving: true }));
    try {
      const res = await api.post('/customers', {
        name: quickMemberModal.name.trim(),
        phone: quickMemberModal.phone.trim(),
      });
      const newMember = res.data.customer;
      toast.success(res.data.message || `Member ${newMember.name} berhasil didaftarkan!`);
      setSelectedCustomer(newMember);
      setCustomerName(newMember.name);
      setQuickMemberModal({ open: false, name: '', phone: '', saving: false });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mendaftarkan member.');
      setQuickMemberModal(p => ({ ...p, saving: false }));
    }
  }

  // Cart calculations (supporting modifier addon prices & discounts)
  const cartGrossSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + ((item.unitPrice ?? item.menu.price) * item.qty), 0);
  }, [cart]);

  const cartDiscountAmount = useMemo(() => {
    if (!appliedDiscount || cartGrossSubtotal <= 0) return 0;
    if (appliedDiscount.reward_type === 'FREE_MENU') {
      const freeMenuPrice = appliedDiscount.reward_menu ? Number(appliedDiscount.reward_menu.price) : 0;
      return Math.min(freeMenuPrice > 0 ? freeMenuPrice : Number(appliedDiscount.value || 0), cartGrossSubtotal);
    }
    const rate = Number(appliedDiscount.value ?? appliedDiscount.rate ?? 0);
    const maxCap = appliedDiscount.max_discount_amount ?? appliedDiscount.max_discount;
    if (appliedDiscount.type === 'PERCENTAGE') {
      const raw = Math.round((cartGrossSubtotal * rate) / 100);
      return maxCap ? Math.min(raw, Number(maxCap)) : raw;
    } else {
      return Math.min(rate, cartGrossSubtotal);
    }
  }, [appliedDiscount, cartGrossSubtotal]);

  const cartTotal = useMemo(() => {
    return Math.max(0, cartGrossSubtotal - cartDiscountAmount);
  }, [cartGrossSubtotal, cartDiscountAmount]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }, [cart]);

  // Total to be paid in payment modal (either active open bill or current cart total)
  const payableTotal = activeOpenBillPayment ? Number(activeOpenBillPayment.total_price) : cartTotal;

  // Change amount calculation for CASH
  const parsedCash = parseFloat(cashReceived) || 0;
  const changeAmount = Math.max(0, parsedCash - payableTotal);
  const isCashSufficient = paymentMethod !== 'CASH' || parsedCash >= payableTotal;

  // Auto-remove applied discount if cart drops below min_order_amount
  useEffect(() => {
    if (appliedDiscount && appliedDiscount.min_order_amount && cartGrossSubtotal > 0 && cartGrossSubtotal < Number(appliedDiscount.min_order_amount)) {
      toast.error(`Diskon "${appliedDiscount.name}" dibatalkan: minimal pembelian ${rupiah(appliedDiscount.min_order_amount)}`);
      setAppliedDiscount(null);
    }
  }, [cartGrossSubtotal, appliedDiscount]);

  // Apply Voucher Code
  async function handleApplyVoucherCode() {
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) {
      toast.error('Ketik kode voucher terlebih dahulu.');
      return;
    }
    if (cartGrossSubtotal <= 0) {
      toast.error('Masukkan menu ke keranjang terlebih dahulu.');
      return;
    }
    setValidatingPromo(true);
    try {
      const { data } = await api.post('/discounts/validate-code', {
        code,
        subtotal: cartGrossSubtotal,
        outlet_id: currentTargetOutlet,
        date: orderDate,
        customer_id: selectedCustomer?.id || undefined,
      });
      setAppliedDiscount(data.discount);
      setPromoCodeInput('');
      toast.success(`Voucher "${data.discount.code || data.discount.name}" aktif! Hemat ${rupiah(data.discount_amount)}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Kode voucher tidak valid atau belum memenuhi syarat.');
    } finally {
      setValidatingPromo(false);
    }
  }

  // Select Direct Promo
  function handleSelectPromo(promo) {
    if (promo.min_order_amount && cartGrossSubtotal < Number(promo.min_order_amount)) {
      toast.error(`Minimal belanja ${rupiah(promo.min_order_amount)} untuk promo ini.`);
      return;
    }
    if (promo.requires_points && promo.requires_points > 0) {
      if (!selectedCustomer) {
        toast.error(`Promo "${promo.name}" memerlukan penukaran ${promo.requires_points} poin. Silakan pilih member terlebih dahulu.`);
        return;
      }
      if ((selectedCustomer.total_points || 0) < promo.requires_points) {
        toast.error(`Poin member ${selectedCustomer.name} tidak cukup (${selectedCustomer.total_points || 0}/${promo.requires_points} poin).`);
        return;
      }
    }
    setAppliedDiscount(promo);
    setPromoModalOpen(false);
    toast.success(`Promo "${promo.name}" diterapkan!`);
  }

  // Apply Custom Manual Cashier Discount
  function handleApplyCustomDiscount() {
    const val = parseFloat(customDiscountModal.value);
    if (isNaN(val) || val <= 0) {
      toast.error('Masukkan nilai diskon yang valid.');
      return;
    }
    if (customDiscountModal.type === 'PERCENTAGE' && val > 100) {
      toast.error('Diskon persentase tidak boleh lebih dari 100%.');
      return;
    }
    setAppliedDiscount({
      id: null,
      name: customDiscountModal.name?.trim() || 'Diskon Kasir',
      code: null,
      type: customDiscountModal.type,
      rate: val,
      max_discount: null,
      min_order_amount: 0,
    });
    setCustomDiscountModal({
      open: false,
      type: 'PERCENTAGE',
      value: '',
      name: 'Diskon Kasir',
    });
    setPromoModalOpen(false);
    toast.success('Diskon manual kasir berhasil diterapkan!');
  }

  // Remove Applied Discount
  function handleRemoveDiscount() {
    setAppliedDiscount(null);
    toast.info('Diskon telah dilepas.');
  }

  // Handle card click
  function handleMenuCardClick(menu, status) {
    const currentStatus = status || getMenuStockStatus(menu);

    // If out of stock, trigger quick restock for direct items or ingredient alert for recipes
    if (currentStatus.isSoldOut) {
      if (currentStatus.itemType === 'DIRECT') {
        const defaultQty = 10;
        const defaultUnitPrice = menu.cost_price || '';
        const defaultTotalPrice = defaultUnitPrice ? Math.round(defaultQty * Number(defaultUnitPrice)) : '';
        setRestockModal({
          open: true,
          isDirectProduct: true,
          menuId: menu.id,
          menuName: menu.name,
          unit: menu.unit || 'pcs',
          currentStock: currentStatus.availableServings,
          ingredientId: '',
          qty: defaultQty,
          unitType: 'PAKAI',
          totalPrice: defaultTotalPrice,
          unitPrice: defaultUnitPrice,
          notes: 'Restok Cepat Kasir',
          submitting: false,
        });
        return;
      } else {
        setStockAlertModal({
          open: true,
          menu,
          status: currentStatus,
        });
        return;
      }
    }

    // If menu has modifier groups, open modifier modal
    if (menu.modifier_groups && menu.modifier_groups.length > 0) {
      openModifierModal(menu, currentStatus);
      return;
    }

    // Otherwise add to cart directly
    addItemToCart(menu);
  }

  // Open Modifier Customization Modal
  function openModifierModal(menu, status, isUrgent = false) {
    const initialSelection = {};
    (menu.modifier_groups || []).forEach(group => {
      const isSingleChoice = group.max_selection === 1;
      const isRequired = (group.min_selection ?? 0) >= 1;
      if (isSingleChoice && isRequired && group.options && group.options.length > 0) {
        initialSelection[group.id] = [group.options[0].id];
      } else {
        initialSelection[group.id] = [];
      }
    });

    setModifierModal({
      open: true,
      menu,
      status: status || getMenuStockStatus(menu),
      selectedOptions: initialSelection,
      qty: 1,
      notes: '',
      isUrgent: Boolean(isUrgent),
    });
  }

  // Toggle modifier option
  function handleToggleModifierOption(group, option) {
    setModifierModal(prev => {
      const current = prev.selectedOptions[group.id] || [];
      const isSingleChoice = group.selection_type === 'SINGLE' || group.max_selection === 1;

      if (isSingleChoice) {
        const isSelected = current.includes(option.id);
        const isRequired = Boolean(group.is_required) || (group.min_selection ?? 0) >= 1;
        if (isSelected && !isRequired) {
          return {
            ...prev,
            selectedOptions: {
              ...prev.selectedOptions,
              [group.id]: [],
            }
          };
        }
        return {
          ...prev,
          selectedOptions: {
            ...prev.selectedOptions,
            [group.id]: [option.id],
          }
        };
      } else {
        const isSelected = current.includes(option.id);
        let updated;
        if (isSelected) {
          updated = current.filter(id => id !== option.id);
        } else {
          if (group.max_selection && current.length >= group.max_selection) {
            toast.error(`Maksimal ${group.max_selection} pilihan untuk ${group.name}`);
            return prev;
          }
          updated = [...current, option.id];
        }
        return {
          ...prev,
          selectedOptions: {
            ...prev.selectedOptions,
            [group.id]: updated,
          }
        };
      }
    });
  }

  // Calculate modal total
  function calculateModalTotal() {
    if (!modifierModal.menu) return 0;
    const base = Number(modifierModal.menu.price) || 0;
    let extra = 0;
    (modifierModal.menu.modifier_groups || []).forEach(group => {
      const selectedIds = modifierModal.selectedOptions[group.id] || [];
      (group.options || []).forEach(opt => {
        if (selectedIds.includes(opt.id)) {
          extra += Number(opt.price) || 0;
        }
      });
    });
    return (base + extra) * modifierModal.qty;
  }

  // Confirm modifier selection and add to cart
  function handleConfirmModifierModal() {
    const { menu, selectedOptions, qty, notes, isUrgent } = modifierModal;
    if (!menu) return;

    // Validate min_selection
    for (const group of (menu.modifier_groups || [])) {
      const selected = selectedOptions[group.id] || [];
      const isRequired = Boolean(group.is_required) || (group.min_selection ?? 0) >= 1;
      const min = isRequired ? Math.max(1, group.min_selection ?? 0) : (group.min_selection ?? 0);
      if (min > 0 && selected.length < min) {
        toast.error(`Harap pilih minimal ${min} opsi untuk "${group.name}".`);
        return;
      }
    }

    // Flatten selected options with details
    const selectedModifierObjects = [];
    (menu.modifier_groups || []).forEach(group => {
      const selectedIds = selectedOptions[group.id] || [];
      (group.options || []).forEach(opt => {
        if (selectedIds.includes(opt.id)) {
          selectedModifierObjects.push({
            id: opt.id,
            group_id: group.id,
            group_name: group.name,
            name: opt.name,
            price: Number(opt.price) || 0,
            ingredient_id: opt.ingredient_id,
            ingredient_name: opt.ingredient?.name,
            qty: opt.qty,
            unit: opt.unit || opt.ingredient?.unit_pakai,
          });
        }
      });
    });

    addItemToCart(menu, notes, selectedModifierObjects, qty, isUrgent);
    setModifierModal({
      open: false,
      menu: null,
      status: null,
      selectedOptions: {},
      qty: 1,
      notes: '',
      isUrgent: false,
    });
    toast.success(`"${menu.name}" ditambahkan ke keranjang${isUrgent ? ' (Nota Urgent)' : ''}.`);
  }

  // Add item to cart with modifier & urgent note support
  function addItemToCart(menu, forcedNote = '', selectedModifiers = [], initialQty = 1, isUrgent = false) {
    const sortedModIds = [...(selectedModifiers || [])].map(m => m.id).sort((a, b) => a - b);
    const cartKey = `${menu.id}_${sortedModIds.join('-')}${isUrgent ? '_urgent' : ''}`;
    const extraPrice = (selectedModifiers || []).reduce((sum, m) => sum + (Number(m.price) || 0), 0);
    const unitPrice = Number(menu.price) + extraPrice;

    setCart(prev => {
      const existingIndex = prev.findIndex(item => (item.cartKey || `${item.menu.id}_`) === cartKey);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          qty: updated[existingIndex].qty + initialQty,
          notes: forcedNote || updated[existingIndex].notes,
          isUrgent: isUrgent || updated[existingIndex].isUrgent,
        };
        return updated;
      } else {
        return [...prev, {
          cartKey,
          menu,
          qty: initialQty,
          notes: forcedNote,
          selectedModifiers: selectedModifiers || [],
          unitPrice,
          isUrgent: Boolean(isUrgent),
        }];
      }
    });
  }

  // Create Urgent Order (Partial Stock Deduction & Pending Deficit Log)
  function handleCreateUrgentOrder() {
    if (stockAlertModal.menu) {
      const m = stockAlertModal.menu;
      const currentStatus = stockAlertModal.status;
      setStockAlertModal({ open: false, menu: null, status: null });

      if (m.modifier_groups?.length > 0) {
        openModifierModal(m, { isSoldOut: false, hasRecipe: true }, true);
        return;
      }

      addItemToCart(m, '⚡ Nota Urgent (Stok tergantung)', [], 1, true);
      toast.success(`"${m.name}" ditambahkan sebagai Nota Urgent.`);
    }
  }

  // Force add out-of-stock item (Emergency Order)
  function handleForceAddToCart() {
    if (stockAlertModal.menu) {
      const m = stockAlertModal.menu;
      setStockAlertModal({ open: false, menu: null, status: null });
      if (m.modifier_groups?.length > 0) {
        openModifierModal(m, { isSoldOut: false, hasRecipe: true });
        return;
      }
      addItemToCart(m, 'Bahan darurat / fisik tersedia', [], 1, true);
      toast.success(`"${m.name}" dimasukkan ke keranjang (Order Darurat).`);
    }
  }

  // Open Quick Restock Modal
  function handleOpenRestock(ingredientId) {
    const ingId = ingredientId || (ingredients[0]?.id?.toString() || '');
    const ing = ingredients.find(i => String(i.id) === String(ingId));
    const defaultQty = 5;
    const defaultUnitPrice = ing?.harga || '';
    const defaultTotalPrice = defaultUnitPrice ? Math.round(defaultQty * Number(defaultUnitPrice)) : '';
    setRestockModal({
      open: true,
      ingredientId: ingId,
      qty: defaultQty,
      unitType: 'BELI',
      totalPrice: defaultTotalPrice,
      unitPrice: defaultUnitPrice,
      notes: 'Pembelian darurat kasir',
      submitting: false,
    });
  }

  // Quick Restock Auto-Calculation handlers
  function handleRestockQtyChange(val) {
    const q = val;
    setRestockModal(prev => {
      const numQ = parseFloat(q) || 0;
      let newUnitPrice = prev.unitPrice;
      let newTotalPrice = prev.totalPrice;

      if (numQ > 0) {
        if (prev.totalPrice !== '' && !isNaN(Number(prev.totalPrice))) {
          newUnitPrice = Number((parseFloat(prev.totalPrice) / numQ).toFixed(2));
        } else if (prev.unitPrice !== '' && !isNaN(Number(prev.unitPrice))) {
          newTotalPrice = Math.round(numQ * parseFloat(prev.unitPrice));
        }
      }

      return {
        ...prev,
        qty: q,
        unitPrice: newUnitPrice,
        totalPrice: newTotalPrice,
      };
    });
  }

  function handleRestockTotalPriceChange(val) {
    const tot = val;
    setRestockModal(prev => {
      const numTot = parseFloat(tot) || 0;
      const numQ = parseFloat(prev.qty) || 0;
      let newUnitPrice = prev.unitPrice;

      if (numQ > 0 && tot !== '') {
        newUnitPrice = Number((numTot / numQ).toFixed(2));
      } else if (tot === '') {
        newUnitPrice = '';
      }

      return {
        ...prev,
        totalPrice: tot,
        unitPrice: newUnitPrice,
      };
    });
  }

  function handleRestockUnitPriceChange(val) {
    const up = val;
    setRestockModal(prev => {
      const numUp = parseFloat(up) || 0;
      const numQ = parseFloat(prev.qty) || 0;
      let newTotalPrice = prev.totalPrice;

      if (numQ > 0 && up !== '') {
        newTotalPrice = Math.round(numQ * numUp);
      } else if (up === '') {
        newTotalPrice = '';
      }

      return {
        ...prev,
        unitPrice: up,
        totalPrice: newTotalPrice,
      };
    });
  }

  // Handle Barcode Scanner / Enter in search bar
  function handleSearchKeyDown(e) {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const exactMatch = filteredMenus.find(m =>
        (m.barcode && m.barcode.toLowerCase() === q) ||
        (m.code && m.code.toLowerCase() === q) ||
        m.name.toLowerCase() === q
      ) || filteredMenus[0];

      if (exactMatch) {
        handleMenuCardClick(exactMatch, exactMatch.stockStatus);
        setSearchQuery('');
        toast.success(`"${exactMatch.name}" ditambahkan ke pesanan`);
      }
    }
  }

  // Submit Quick Restock (handles both direct retail products & raw ingredients)
  async function handleSubmitRestock(e) {
    e.preventDefault();
    setRestockModal(p => ({ ...p, submitting: true }));
    try {
      if (restockModal.isDirectProduct && restockModal.menuId) {
        await api.post(`/menus/${restockModal.menuId}/restock`, {
          qty: Number(restockModal.qty),
          cost_price: restockModal.unitPrice !== '' ? Number(restockModal.unitPrice) : undefined,
          total_cost: restockModal.totalPrice !== '' ? Number(restockModal.totalPrice) : undefined,
          outlet_id: currentTargetOutlet,
          notes: restockModal.notes || 'Restok barang retail kasir',
        });

        toast.success(`Stok "${restockModal.menuName}" bertambah +${num(restockModal.qty)} ${restockModal.unit || 'pcs'}!`);

        const [m, s] = await Promise.all([
          api.get('/menus', { params: { outlet_id: currentTargetOutlet } }),
          api.get('/shifts/active', { params: { outlet_id: currentTargetOutlet } }),
        ]);
        setMenus(m.data.filter(x => x.active));
        setActiveShift(s.data);

        setRestockModal(p => ({ ...p, open: false, submitting: false }));
        if (stockAlertModal.open) {
          setStockAlertModal({ open: false, menu: null, status: null });
        }
        return;
      }

      const ing = ingredients.find(i => i.id === Number(restockModal.ingredientId));
      if (!ing) return;

      const conversion = Number(ing.konversi) || 1;
      const netQty = restockModal.unitType === 'BELI'
        ? Number(restockModal.qty) * conversion
        : Number(restockModal.qty);

      await api.post('/movements', {
        date: orderDate,
        ingredient_id: ing.id,
        type: 'PURCHASE',
        qty: Number(restockModal.qty),
        unit_type: restockModal.unitType,
        unit_price: restockModal.unitPrice !== '' ? Number(restockModal.unitPrice) : null,
        total_price: restockModal.totalPrice !== '' ? Number(restockModal.totalPrice) : null,
        outlet_id: currentTargetOutlet,
        note: restockModal.notes || 'Pembelian darurat kasir',
      });

      toast.success(`Stok "${ing.name}" bertambah +${num(netQty)} ${ing.unit_pakai} di ${activeOutlet?.name || 'cabang ini'}!`);

      // Refresh ingredients and active shift for this outlet
      const [updatedIngs, s] = await Promise.all([
        api.get('/ingredients', { params: { outlet_id: currentTargetOutlet } }),
        api.get('/shifts/active', { params: { outlet_id: currentTargetOutlet } }),
      ]);
      setIngredients(updatedIngs.data);
      setActiveShift(s.data);

      setRestockModal(p => ({ ...p, open: false, submitting: false }));
      if (stockAlertModal.open) {
        setStockAlertModal({ open: false, menu: null, status: null });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menambah stok.');
      setRestockModal(p => ({ ...p, submitting: false }));
    }
  }

  // Update item quantity
  function updateQty(targetKey, delta) {
    setCart(prev => {
      return prev
        .map(item => {
          const itemKey = item.cartKey || item.menu.id;
          if (itemKey === targetKey || item.menu.id === targetKey) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  }

  // Update item note
  function updateItemNotes(targetKey, noteText) {
    setCart(prev => prev.map(item => {
      const itemKey = item.cartKey || item.menu.id;
      return (itemKey === targetKey || item.menu.id === targetKey) ? { ...item, notes: noteText } : item;
    }));
  }

  // Remove single item
  function removeFromCart(targetKey) {
    setCart(prev => prev.filter(item => {
      const itemKey = item.cartKey || item.menu.id;
      return itemKey !== targetKey && item.menu.id !== targetKey;
    }));
  }

  // Clear entire cart
  async function clearCart() {
    if (cart.length === 0) return;
    const confirmed = await confirmDialog({
      title: 'Kosongkan Keranjang?',
      text: 'Kosongkan semua pesanan di keranjang belanja?',
      confirmText: 'Ya, Kosongkan',
      cancelText: 'Batal',
      isDanger: true,
    });
    if (confirmed) {
      setCart([]);
      setCustomerName('');
      setOrderNotes('');
      setAppliedDiscount(null);
      setPromoCodeInput('');
    }
  }

  // Open payment modal for regular cart
  function handleOpenPayment() {
    if (cart.length === 0) {
      toast.error('Keranjang pesanan masih kosong.');
      return;
    }
    setActiveOpenBillPayment(null);
    setCashReceived(cartTotal.toString());
    setPaymentMethod('CASH');
    setPaymentModalOpen(true);
  }

  // Open payment modal for an existing open bill
  function handleOpenPayOpenBill(bill) {
    setActiveOpenBillPayment(bill);
    setPaymentMethod('CASH');
    setCashReceived(Number(bill.total_price).toString());
    setOrderNotes('');
    setPaymentModalOpen(true);
  }

  // Open Split Bill modal
  function handleOpenSplitBill(bill) {
    const initialQtys = {};
    (bill.items || []).forEach(it => {
      initialQtys[it.id] = 0;
    });

    const isExistingEqualSplit = (bill.paid_splits_count || 0) > 0 && (bill.split_total || 0) > 0;
    const totalSplits = isExistingEqualSplit ? Number(bill.split_total) : 2;
    const paidIndices = bill.paid_split_indices || [];

    // Pick first unpaid index
    let nextUnpaid = 1;
    for (let i = 1; i <= totalSplits; i++) {
      if (!paidIndices.includes(i)) {
        nextUnpaid = i;
        break;
      }
    }

    const equalPartAmount = Math.round((Number(bill.total_price) || 0) / totalSplits);

    setSplitBillModal({
      open: true,
      bill,
      mode: isExistingEqualSplit ? 'EQUAL' : 'BY_ITEM',
      selectedItemQtys: initialQtys,
      totalSplits,
      activeEqualIndex: nextUnpaid,
      paymentMethod: 'CASH',
      cashReceived: isExistingEqualSplit ? equalPartAmount.toString() : '',
      customerName: isExistingEqualSplit ? `Tamu ${nextUnpaid}/${totalSplits}` : '',
      notes: '',
      submitting: false,
    });
  }

  // Adjust item qty to pay in Split by Item
  function handleSplitItemQtyChange(itemId, delta, maxQty) {
    setSplitBillModal(prev => {
      const current = prev.selectedItemQtys[itemId] || 0;
      const next = Math.max(0, Math.min(maxQty, current + delta));
      const updated = { ...prev.selectedItemQtys, [itemId]: next };

      let sub = 0;
      (prev.bill?.items || []).forEach(it => {
        const q = updated[it.id] || 0;
        const unitPrice = (Number(it.subtotal) || Number(it.total_price)) / (Number(it.qty) || 1);
        sub += unitPrice * q;
      });

      return {
        ...prev,
        selectedItemQtys: updated,
        cashReceived: sub > 0 ? sub.toString() : '',
      };
    });
  }

  // Select all items for split
  function handleSelectAllSplitItems() {
    setSplitBillModal(prev => {
      const updated = {};
      let sub = 0;
      (prev.bill?.items || []).forEach(it => {
        updated[it.id] = it.qty;
        sub += Number(it.total_price);
      });
      return {
        ...prev,
        selectedItemQtys: updated,
        cashReceived: sub.toString(),
      };
    });
  }

  // Clear all split item selections
  function handleClearSplitItems() {
    setSplitBillModal(prev => {
      const updated = {};
      (prev.bill?.items || []).forEach(it => {
        updated[it.id] = 0;
      });
      return {
        ...prev,
        selectedItemQtys: updated,
        cashReceived: '',
      };
    });
  }

  // Submit Split by Item
  async function handleSubmitSplitByItem() {
    const { bill, selectedItemQtys, paymentMethod, cashReceived, customerName, notes } = splitBillModal;
    if (!bill) return;

    const itemsToPay = Object.entries(selectedItemQtys)
      .filter(([_, q]) => q > 0)
      .map(([id, q]) => ({ id: Number(id), qty: q }));

    if (itemsToPay.length === 0) {
      toast.error('Pilih minimal 1 menu/porsi untuk dibayar pada bagian ini.');
      return;
    }

    let subtotal = 0;
    (bill.items || []).forEach(it => {
      const q = selectedItemQtys[it.id] || 0;
      if (q > 0) {
        const unit = (Number(it.subtotal) || Number(it.total_price)) / (Number(it.qty) || 1);
        subtotal += unit * q;
      }
    });

    const parsedCash = parseFloat(cashReceived) || 0;
    if (paymentMethod === 'CASH' && parsedCash < subtotal) {
      toast.error('Nominal uang tunai kurang dari total bagian ini!');
      return;
    }

    const changeAmount = paymentMethod === 'CASH' ? Math.max(0, parsedCash - subtotal) : 0;

    setSplitBillModal(p => ({ ...p, submitting: true }));
    try {
      const payload = {
        items: itemsToPay,
        payment_method: paymentMethod,
        amount_paid: paymentMethod === 'CASH' ? parsedCash : subtotal,
        change_amount: changeAmount,
        customer_name: customerName || undefined,
        notes: notes || undefined,
      };

      const { data } = await api.post(`/transactions/open-bills/${bill.order_number}/split-by-item`, payload);

      toast.success(`Pembayaran Bagian ${data.split_index} (${data.order_number}) berhasil!`);

      // Show Thermal Receipt for this split
      setCompletedOrder({
        order_number: data.order_number,
        parent_order_number: data.parent_order_number,
        split_index: data.split_index,
        split_type: 'BY_ITEM',
        date: data.date || getTodayStr(),
        customer_name: data.customer_name || 'Pelanggan',
        payment_method: data.payment_method,
        amount_paid: data.amount_paid,
        change_amount: data.change_amount,
        subtotal: data.subtotal,
        discount_amount: data.discount_amount || 0,
        total_price: data.total_price,
        remaining_total: data.remaining_total,
        is_table_closed: data.is_table_closed,
        items: data.items || [],
        cashier: currentUser.name || 'Kasir',
        shift_name: activeShift?.shift?.shift_name || 'Reguler',
        outlet_name: activeOutlet?.name || currentUser.outlet_name || 'Outlet',
        created_at: data.paid_at || new Date().toLocaleString('id-ID'),
      });

      setSplitBillModal(p => ({ ...p, open: false, submitting: false }));
      setOpenBillsModalOpen(false);
      setReceiptModalOpen(true);
      window.dispatchEvent(new CustomEvent('pos:transaction_completed'));
      refreshCoins?.();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses split bill.');
      setSplitBillModal(p => ({ ...p, submitting: false }));
    }
  }

  // Submit Split Evenly
  async function handleSubmitSplitEvenly(splitIndex, splitAmount) {
    const { bill, totalSplits, paymentMethod, cashReceived, customerName, notes } = splitBillModal;
    if (!bill) return;

    const parsedCash = parseFloat(cashReceived) || 0;
    if (paymentMethod === 'CASH' && parsedCash < splitAmount) {
      toast.error('Nominal uang tunai kurang dari nominal patungan!');
      return;
    }

    const changeAmount = paymentMethod === 'CASH' ? Math.max(0, parsedCash - splitAmount) : 0;

    setSplitBillModal(p => ({ ...p, submitting: true }));
    try {
      const payload = {
        total_splits: Number(totalSplits),
        split_index: Number(splitIndex),
        split_amount: Number(splitAmount),
        payment_method: paymentMethod,
        amount_paid: paymentMethod === 'CASH' ? parsedCash : splitAmount,
        change_amount: changeAmount,
        customer_name: customerName || `Tamu ${splitIndex}/${totalSplits}`,
        notes: notes || undefined,
      };

      const { data } = await api.post(`/transactions/open-bills/${bill.order_number}/split-evenly`, payload);

      toast.success(`Pembayaran Patungan Bagian ${data.split_index}/${data.split_total} berhasil!`);

      setCompletedOrder({
        order_number: data.order_number,
        parent_order_number: data.parent_order_number,
        split_index: data.split_index,
        split_total: data.split_total,
        split_type: 'EQUAL',
        date: data.date || getTodayStr(),
        customer_name: data.customer_name,
        payment_method: data.payment_method,
        amount_paid: data.amount_paid,
        change_amount: data.change_amount,
        subtotal: data.subtotal,
        discount_amount: 0,
        total_price: data.total_price,
        remaining_total: data.remaining_total,
        is_table_closed: data.is_table_closed,
        items: data.items || [],
        cashier: currentUser.name || 'Kasir',
        shift_name: activeShift?.shift?.shift_name || 'Reguler',
        outlet_name: activeOutlet?.name || currentUser.outlet_name || 'Outlet',
        created_at: data.paid_at || new Date().toLocaleString('id-ID'),
      });

      setSplitBillModal(p => ({ ...p, open: false, submitting: false }));
      setOpenBillsModalOpen(false);
      setReceiptModalOpen(true);
      window.dispatchEvent(new CustomEvent('pos:transaction_completed'));
      refreshCoins?.();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses pembayaran patungan.');
      setSplitBillModal(p => ({ ...p, submitting: false }));
    }
  }

  // Hold order (Save as Open Bill)
  async function handleHoldOrder() {
    if (cart.length === 0) {
      toast.error('Keranjang pesanan masih kosong.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        date: orderDate,
        customer_name: selectedCustomer ? selectedCustomer.name : (customerName || undefined),
        customer_id: selectedCustomer ? selectedCustomer.id : undefined,
        status: 'HOLD',
        notes: orderNotes || undefined,
        shift_id: activeShift?.shift?.id || undefined,
        outlet_id: currentTargetOutlet,
        discount_id: appliedDiscount?.id || undefined,
        discount_amount: cartDiscountAmount || 0,
        discount_name: appliedDiscount?.name || undefined,
        discount_type: appliedDiscount?.type || undefined,
        discount_rate: appliedDiscount?.value ?? appliedDiscount?.rate ?? undefined,
        is_urgent_note: cart.some(i => i.isUrgent),
        items: cart.map(item => ({
          menu_id: item.menu.id,
          qty: item.qty,
          notes: item.notes || undefined,
          is_urgent: Boolean(item.isUrgent),
          modifier_option_ids: (item.selectedModifiers || []).map(m => m.id),
          modifiers: item.selectedModifiers || [],
        })),
      };

      const { data } = await api.post('/transactions', payload);

      toast.success(`Tagihan ${data.order_number} berhasil disimpan (Open Bill)!`);

      // Open Kitchen Chit Modal automatically
      setKitchenChitModal({
        open: true,
        bill: {
          order_number: data.order_number,
          customer_name: data.customer_name || customerName || 'Pelanggan',
          cashier: currentUser.name || 'Kasir',
          outlet_name: activeOutlet?.name || 'Outlet',
          created_at: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        },
        items: data.items || cart.map(i => ({ menu_name: i.menu.name, qty: i.qty, notes: i.notes, modifiers: i.selectedModifiers })),
        isAdditional: false,
      });

      // Clear cart
      setCart([]);
      setCustomerName('');
      setSelectedCustomer(null);
      setOrderNotes('');
      setAppliedDiscount(null);
      setPromoCodeInput('');

      // Refresh open bills
      fetchOpenBills();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan tagihan terbuka.');
    } finally {
      setSubmitting(false);
    }
  }


  // Start append mode for an open bill
  function handleStartAppendItems(bill) {
    setAppendModeBill(bill);
    setCustomerName(bill.customer_name || '');
    setCart([]);
    setOpenBillsModalOpen(false);
    toast.success(`Mode Tambah Menu aktif untuk ${bill.order_number}. Silakan pilih menu di katalog.`);
  }

  // Submit append items to existing open bill
  async function handleSubmitAppendItems(targetBill = appendModeBill) {
    const activeTarget = targetBill || appendModeBill;
    if (!activeTarget) return;
    if (cart.length === 0) {
      toast.error('Pilih minimal 1 menu tambahan untuk dikirim ke dapur!');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        is_urgent_note: cart.some(i => i.isUrgent),
        items: cart.map(item => ({
          menu_id: item.menu.id,
          qty: item.qty,
          notes: item.notes || undefined,
          is_urgent: Boolean(item.isUrgent),
          modifier_option_ids: (item.selectedModifiers || []).map(m => m.id),
          modifiers: item.selectedModifiers || [],
        })),
      };

      const { data } = await api.post(`/transactions/${activeTarget.order_number}/add-items`, payload);

      toast.success(`Pesanan tambahan berhasil dikirim untuk ${activeTarget.order_number}!`);

      // Open Kitchen Chit for newly added items only
      setKitchenChitModal({
        open: true,
        bill: {
          order_number: activeTarget.order_number,
          customer_name: activeTarget.customer_name || 'Pelanggan',
          cashier: currentUser.name || 'Kasir',
          outlet_name: activeOutlet?.name || 'Outlet',
          created_at: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        },
        items: data.added_items || cart.map(i => ({ menu_name: i.menu.name, qty: i.qty, notes: i.notes, modifiers: i.selectedModifiers })),
        isAdditional: true,
      });

      setCart([]);
      setAppendModeBill(null);
      setCustomerName('');
      fetchOpenBills();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menambahkan menu ke tagihan terbuka.');
    } finally {
      setSubmitting(false);
    }
  }

  // Open Pre-bill Modal
  function handleOpenPrebill(bill) {
    setPrebillModal({
      open: true,
      bill,
    });
  }

  // Open Kitchen Chit Modal
  function handleOpenKitchenChit(bill) {
    setKitchenChitModal({
      open: true,
      bill: {
        order_number: bill.order_number,
        customer_name: bill.customer_name || 'Pelanggan',
        cashier: bill.cashier?.name || currentUser.name || 'Kasir',
        outlet_name: activeOutlet?.name || bill.outlet_name || 'Outlet',
        created_at: bill.created_at || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      },
      items: bill.items || [],
      isAdditional: false,
    });
  }

  // Confirm cancel open bill
  async function handleConfirmCancelBill() {
    if (!cancelBillModal.bill) return;
    setCancelBillModal(p => ({ ...p, submitting: true }));
    try {
      await api.post(`/transactions/${cancelBillModal.bill.order_number}/cancel`, {
        reason: cancelBillModal.reason || undefined,
      });
      toast.success(`Tagihan ${cancelBillModal.bill.order_number} berhasil dibatalkan.`);
      setCancelBillModal({ open: false, bill: null, reason: '', submitting: false });
      fetchOpenBills();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membatalkan tagihan.');
      setCancelBillModal(p => ({ ...p, submitting: false }));
    }
  }

  // ====================================================
  // MIDTRANS LIVE DYNAMIC QRIS INTEGRATION
  // ====================================================
  async function generateMidtransQris() {
    if (payableTotal <= 0) {
      toast.error('Nominal tagihan harus lebih dari Rp 0!');
      return;
    }

    setMidtransQris(prev => ({ ...prev, loading: true, error: null, isPaid: false }));
    try {
      const orderRef = activeOpenBillPayment
        ? activeOpenBillPayment.order_number
        : ('MOVA-' + Date.now().toString().slice(-8) + '-' + Math.floor(Math.random() * 900 + 100));

      const { data } = await api.post('/payment-gateways/midtrans/charge-qris', {
        gross_amount: payableTotal,
        order_id: orderRef,
        customer_name: selectedCustomer ? selectedCustomer.name : (customerName || 'Pelanggan'),
      });

      if (data.status === 'success') {
        setMidtransQris({
          active: true,
          loading: false,
          orderId: data.order_id,
          grossAmount: data.gross_amount,
          qrImageUrl: data.qr_image_url,
          qrString: data.qr_string,
          isPaid: false,
          environment: data.environment || 'sandbox',
          checking: false,
          error: null,
        });
        toast.success('QRIS Dinamis Midtrans siap! Customer dapat scan sekarang.');
      } else {
        throw new Error(data.message || 'Gagal membuat tagihan QRIS Midtrans');
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || 'Gagal menghubungi Midtrans';
      setMidtransQris(prev => ({ ...prev, loading: false, error: msg }));
      toast.error(msg);
    }
  }

  async function checkMidtransPaymentStatus(orderId) {
    if (!orderId || midtransQris.isPaid) return;
    setMidtransQris(prev => ({ ...prev, checking: true }));
    try {
      const { data } = await api.get(`/payment-gateways/midtrans/status/${orderId}`);
      if (data.is_paid) {
        setMidtransQris(prev => ({ ...prev, isPaid: true, checking: false }));
        toast.success('🎉 Pembayaran QRIS Midtrans BERHASIL & LUNAS!');
        setTimeout(() => {
          handleProcessOrder();
        }, 1200);
      } else {
        setMidtransQris(prev => ({ ...prev, checking: false }));
      }
    } catch (err) {
      setMidtransQris(prev => ({ ...prev, checking: false }));
    }
  }

  // Auto-polling for Midtrans QRIS status while modal is open
  useEffect(() => {
    let interval = null;
    if (paymentModalOpen && paymentMethod === 'QRIS' && midtransQris.active && midtransQris.orderId && !midtransQris.isPaid) {
      interval = setInterval(() => {
        checkMidtransPaymentStatus(midtransQris.orderId);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [paymentModalOpen, paymentMethod, midtransQris.active, midtransQris.orderId, midtransQris.isPaid]);

  // Reset QRIS when closing payment modal
  useEffect(() => {
    if (!paymentModalOpen) {
      setMidtransQris({
        active: false,
        loading: false,
        orderId: null,
        grossAmount: 0,
        qrImageUrl: null,
        qrString: null,
        isPaid: false,
        environment: 'sandbox',
        checking: false,
        error: null,
      });
      setShowStaticQrisFallback(false);
    }
  }, [paymentModalOpen]);

  // Submit payment (Handles both regular cart and open bill payment)
  async function handleProcessOrder() {
    if (!isCashSufficient) {
      toast.error('Nominal uang tunai yang diterima kurang!');
      return;
    }

    setSubmitting(true);
    try {
      if (activeOpenBillPayment) {
        // Paying an open bill
        const payload = {
          payment_method: paymentMethod,
          amount_paid: (paymentMethod === 'CASH' || paymentMethod === 'KASBON') ? parsedCash : Number(activeOpenBillPayment.total_price),
          change_amount: paymentMethod === 'CASH' ? changeAmount : 0,
          notes: orderNotes || undefined,
        };

        const { data } = await api.post(`/transactions/${activeOpenBillPayment.order_number}/pay`, payload);

        setCompletedOrder({
          order_number: data.order_number,
          date: data.paid_at || getTodayStr(),
          customer_name: data.customer_name || 'Pelanggan Umum',
          payment_method: data.payment_method,
          amount_paid: data.amount_paid,
          change_amount: data.change_amount,
          subtotal: data.subtotal || (Number(data.total_price) + Number(data.discount_amount || 0)),
          discount_amount: data.discount_amount || 0,
          discount_name: data.discount_name || null,
          total_price: data.total_price,
          items: data.items,
          cashier: currentUser.name || 'Kasir',
          shift_name: activeShift?.shift?.shift_name || 'Reguler',
          outlet_name: activeOutlet?.name || currentUser.outlet_name || 'Outlet',
          created_at: data.paid_at || new Date().toLocaleString('id-ID'),
        });

        toast.success(`Pembayaran ${data.order_number} berhasil lunas!`);
        setActiveOpenBillPayment(null);
        setPaymentModalOpen(false);
        setOpenBillsModalOpen(false);
        setReceiptModalOpen(true);

        // Refresh data & coins
        window.dispatchEvent(new CustomEvent('pos:transaction_completed'));
        refreshCoins?.();
        fetchAll();
      } else {
        // Direct cart checkout
        const payload = {
          date: orderDate,
          customer_name: selectedCustomer ? selectedCustomer.name : (customerName || undefined),
          customer_id: selectedCustomer ? selectedCustomer.id : undefined,
          payment_method: paymentMethod,
          amount_paid: (paymentMethod === 'CASH' || paymentMethod === 'KASBON') ? parsedCash : cartTotal,
          change_amount: paymentMethod === 'CASH' ? changeAmount : 0,
          notes: orderNotes || undefined,
          shift_id: activeShift?.shift?.id || undefined,
          outlet_id: currentTargetOutlet,
          discount_id: appliedDiscount?.id || undefined,
          discount_amount: cartDiscountAmount || 0,
          discount_name: appliedDiscount?.name || undefined,
          discount_type: appliedDiscount?.type || undefined,
          discount_rate: appliedDiscount?.value ?? appliedDiscount?.rate ?? undefined,
          is_urgent_note: cart.some(i => i.isUrgent),
          items: cart.map(item => ({
            menu_id: item.menu.id,
            qty: item.qty,
            notes: item.notes || undefined,
            is_urgent: Boolean(item.isUrgent),
            modifier_option_ids: (item.selectedModifiers || []).map(m => m.id),
            modifiers: item.selectedModifiers || [],
          })),
        };

        const { data } = await api.post('/transactions', payload);

        setCompletedOrder({
          order_number: data.order_number,
          date: data.date,
          customer_name: data.customer_name || 'Pelanggan Umum',
          customer: data.customer || selectedCustomer || null,
          earned_points: (data.customer || selectedCustomer) ? 1 : 0,
          payment_method: data.payment_method,
          amount_paid: data.amount_paid,
          change_amount: data.change_amount,
          subtotal: data.subtotal || cartGrossSubtotal,
          discount_amount: data.discount_amount || cartDiscountAmount,
          discount_name: data.discount_name || appliedDiscount?.name,
          total_price: data.total_price,
          items: data.items,
          is_urgent_note: data.is_urgent_note,
          urgent_status: data.urgent_status,
          cashier: data.cashier?.name || currentUser.name || 'Kasir',
          shift_name: activeShift?.shift?.shift_name || 'Reguler',
          outlet_name: activeOutlet?.name || currentUser.outlet_name || 'Outlet',
          created_at: data.created_at || new Date().toLocaleString('id-ID'),
        });

        toast.success(`Pesanan ${data.order_number} berhasil dicatat di ${activeOutlet?.name || 'cabang'}!`);

        // Reset cart and modals
        setCart([]);
        setCustomerName('');
        setSelectedCustomer(null);
        setOrderNotes('');
        setAppliedDiscount(null);
        setPromoCodeInput('');
        setPaymentModalOpen(false);
        setReceiptModalOpen(true);

        window.dispatchEvent(new CustomEvent('pos:transaction_completed'));
        refreshCoins?.();
        fetchAll();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses transaksi.');
    } finally {
      setSubmitting(false);
    }
  }

  // Trigger print
  function handlePrintReceipt() {
    printElement('printable-thermal-receipt', `Struk - ${completedOrder?.order_number || ''}`, {
      isThermal: true,
      pageSize: '80mm auto'
    });
  }

  // Reprint full order from history
  function handleReprintOrder(order) {
    if (!order) return;
    setCompletedOrder({
      order_number: order.order_number,
      date: order.date,
      customer_name: order.customer_name || 'Pelanggan Umum',
      order_type: order.order_type || 'DINE_IN',
      table_number: order.table_number || null,
      payment_method: order.payment_method || 'CASH',
      amount_paid: order.amount_paid || order.total_price,
      change_amount: order.change_amount || 0,
      subtotal: order.subtotal || order.total_price,
      discount_amount: order.discount_amount || 0,
      discount_name: order.discount_name || null,
      total_price: order.total_price,
      items: (order.items || []).map(t => ({
        menu_name: t.menu?.name || 'Menu',
        price: (t.menu?.price || t.total_price / t.qty),
        qty: t.qty,
        total_price: t.total_price,
        notes: t.notes,
        modifiers: t.modifiers || [],
      })),
      cashier: order.cashier_name || currentUser.name || 'Kasir',
      shift_name: order.shift_name || 'Reguler',
      created_at: order.created_at || order.date,
    });
    setReceiptModalOpen(true);
  }

  // Reprint from flat history row
  function handleReprint(trx) {
    const ordNumber = trx.order_number || `TRX-${trx.id}`;
    const matchingItems = transactions.filter(t => (t.order_number || `TRX-${t.id}`) === ordNumber);
    const itemsToPrint = matchingItems.length > 0 ? matchingItems : [trx];
    const totalP = itemsToPrint.reduce((s, it) => s + Number(it.total_price || 0), 0);
    const subtotalP = itemsToPrint.reduce((s, it) => s + Number(it.subtotal || it.total_price || 0), 0);
    const totalDisc = itemsToPrint.reduce((s, it) => s + Number(it.discount_amount || 0), 0);

    setCompletedOrder({
      order_number: ordNumber,
      date: trx.date,
      customer_name: trx.customer_name || 'Pelanggan Umum',
      order_type: trx.order_type || 'DINE_IN',
      table_number: trx.table_number || null,
      payment_method: trx.payment_method || 'CASH',
      amount_paid: trx.amount_paid || totalP,
      change_amount: trx.change_amount || 0,
      subtotal: subtotalP,
      discount_amount: totalDisc,
      discount_name: trx.discount_name || null,
      total_price: totalP,
      items: itemsToPrint.map(it => ({
        menu_name: it.menu?.name || 'Menu',
        price: (it.menu?.price || it.total_price / it.qty),
        qty: it.qty,
        total_price: it.total_price,
        notes: it.notes,
        modifiers: it.modifiers || [],
      })),
      cashier: trx.user?.name || currentUser.name || 'Kasir',
      shift_name: trx.shift?.shift_name || 'Reguler',
      created_at: trx.created_at || trx.date,
    });
    setReceiptModalOpen(true);
  }

  if (loading) return <LoadingState />;

  const restockSelectedIng = ingredients.find(i => i.id === Number(restockModal.ingredientId));

  return (
    <div className="fade-in">
      <PageHeader
        title="POS / Kasir MOVA"
        subtitle="Katalog menu visual, kontrol stok porsi real-time, keranjang pesanan, dan cetak struk thermal."
        action={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleOpenRestock()}
              title="Tambah Stok Bahan Baku"
            >
              <Package size={14} /> Tambah Stok Cepat
            </button>

            {/* Open Bills Management Button */}
            <button
              className="btn btn-sm"
              onClick={() => setOpenBillsModalOpen(true)}
              style={{
                background: openBills.length > 0 ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(217, 119, 6, 0.3) 100%)' : 'rgba(255, 255, 255, 0.05)',
                border: openBills.length > 0 ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid var(--border)',
                color: openBills.length > 0 ? '#fcd34d' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontWeight: openBills.length > 0 ? 700 : 500,
                boxShadow: openBills.length > 0 ? '0 0 15px rgba(245, 158, 11, 0.2)' : 'none'
              }}
              title="Kelola pesanan tersimpan / tagihan terbuka (Hold Order)"
            >
              <Clock size={14} style={{ color: openBills.length > 0 ? '#fbbf24' : 'inherit' }} />
              <span>Tagihan Terbuka</span>
              <span style={{
                background: openBills.length > 0 ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                color: openBills.length > 0 ? '#000000' : 'var(--text-muted)',
                fontWeight: 800,
                fontSize: 11,
                padding: '1px 7px',
                borderRadius: 10,
                minWidth: 18,
                textAlign: 'center'
              }}>
                {openBills.length}
              </span>
            </button>

            {/* Quick Link to Urgent Notes */}
            <Link
              to="/urgent-notes"
              className="btn btn-sm"
              style={{
                background: urgentCount > 0 ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(220, 38, 38, 0.3) 100%)' : 'rgba(255, 255, 255, 0.05)',
                border: urgentCount > 0 ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--border)',
                color: urgentCount > 0 ? '#fca5a5' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontWeight: urgentCount > 0 ? 700 : 500,
                textDecoration: 'none',
                boxShadow: urgentCount > 0 ? '0 0 15px rgba(239, 68, 68, 0.2)' : 'none'
              }}
              title="Daftar Nota Urgent & Bahan Tergantung"
            >
              <AlertOctagon size={14} style={{ color: urgentCount > 0 ? '#ef4444' : 'inherit' }} />
              <span>Nota Urgent</span>
              {urgentCount > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 11,
                  padding: '1px 7px',
                  borderRadius: 10,
                  minWidth: 18,
                  textAlign: 'center'
                }}>
                  {urgentCount}
                </span>
              )}
            </Link>

            <button
              className={`btn ${showHistory ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setShowHistory(!showHistory)}
            >
              <Receipt size={14} />
              {showHistory ? 'Kembali ke Kasir' : 'Riwayat Nota'}
            </button>
          </div>
        }
      />

      {/* Active Shift Banner */}
      {activeShift?.shift ? (
        <div style={{
          background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.12) 0%, rgba(124, 58, 237, 0.1) 100%)',
          border: '1px solid var(--ok-border)',
          borderRadius: 12,
          padding: '12px 18px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--ok)', boxShadow: '0 0 10px var(--ok)' }} />
            <span style={{ fontSize: 13, color: '#ffffff' }}>
              Shift Aktif: <strong>{activeShift.shift.shift_name}</strong> · Kasir: <strong>{activeShift.shift.user?.name}</strong>
            </span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--accent-bright)' }}>
              ({activeShift.total_transactions} trx · {rupiah(activeShift.total_sales)})
            </span>
          </div>
          <Link to="/shift" className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }}>
            Kelola Shift <ArrowRight size={12} />
          </Link>
        </div>
      ) : (
        <div style={{
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 12,
          padding: '12px 18px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} style={{ color: 'var(--warn)' }} />
            <div>
              <strong style={{ color: '#ffffff', fontSize: 13 }}>Belum Ada Shift Kasir yang Dibuka</strong>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Buka shift kasir terlebih dahulu agar transaksi diakumulasikan ke closing shift.
              </p>
            </div>
          </div>
          <Link to="/shift" className="btn btn-primary btn-sm">
            Buka Shift Sekarang
          </Link>
        </div>
      )}

      {/* Consolidated Warning Banner in POS */}
      {isOwnerWebsite && (activeOutletId === 'ALL' || activeOutletId === 'all') && (
        <div style={{
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Store size={18} style={{ color: '#38bdf8' }} />
            <div>
              <strong style={{ color: '#ffffff', fontSize: 13 }}>Mode Semua Cabang (Konsolidasi) Aktif di POS</strong>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Transaksi kasir idealnya dilakukan per cabang outlet agar stok bahan baku berkurang di cabang yang tepat.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {outlets.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => changeOutlet(o.id)}
                className="btn btn-sm btn-outline"
                style={{ fontSize: 11.5, padding: '4px 10px' }}
              >
                Pilih {o.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          VIEW 1: HISTORY / RIWAYAT NOTA TRANSAKSI TAB
         ======================================================== */}
      {showHistory ? (
        <div className="card" style={{ padding: '20px 22px' }}>
          {/* Header Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 20,
            borderBottom: '1px solid var(--border)',
            paddingBottom: 16
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', gap: 10, color: '#ffffff' }}>
                <Receipt size={22} style={{ color: 'var(--accent-bright)' }} />
                <span>Riwayat Nota & Transaksi Kasir</span>
                <span className="badge badge-neutral mono" style={{ fontSize: 11, padding: '2px 8px' }}>
                  {filteredGroupedHistory.length} Nota
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Arsip nota transaksi penjualan periode <strong>{formatLocalDisplay(historyPeriod.from)}</strong> s/d <strong>{formatLocalDisplay(historyPeriod.to)}</strong>.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* View Mode Toggle: Grup per Nota vs Rincian Item */}
              <div style={{
                display: 'inline-flex',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 2
              }}>
                <button
                  type="button"
                  onClick={() => setHistoryViewMode('grouped')}
                  className={`btn btn-sm ${historyViewMode === 'grouped' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11.5, padding: '4px 10px', height: 32, display: 'flex', alignItems: 'center', gap: 5 }}
                  title="Tampilan dikelompokkan per Nota / Transaksi"
                >
                  <Layers size={13} />
                  <span>Grup per Nota</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryViewMode('flat')}
                  className={`btn btn-sm ${historyViewMode === 'flat' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11.5, padding: '4px 10px', height: 32, display: 'flex', alignItems: 'center', gap: 5 }}
                  title="Tampilan daftar rincian semua item/menu"
                >
                  <FileText size={13} />
                  <span>Rincian Item</span>
                </button>
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fetchHistory()}
                disabled={historyLoading}
                title="Muat ulang data riwayat nota"
                style={{ height: 32, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={13} className={historyLoading ? 'spin' : ''} />
                <span>Segarkan</span>
              </button>

              {/* Kembali ke Kasir Button */}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowHistory(false)}
                style={{ height: 32, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                <ShoppingCart size={14} />
                <span>Kembali ke Kasir</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Metrics for the Filtered Period */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 20
          }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(17, 22, 45, 0.6) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 12,
              padding: '12px 16px'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ok)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Omset ({filteredGroupedHistory.length} Nota)
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                {rupiah(historyStats.totalOmset)}
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(17, 22, 45, 0.6) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 12,
              padding: '12px 16px'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Transaksi (Nota)
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#a5b4fc', marginTop: 4 }}>
                {historyStats.totalOrders} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>nota</span>
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(17, 22, 45, 0.6) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 12,
              padding: '12px 16px'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Rata-Rata per Nota (AOV)
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#fde047', marginTop: 4 }}>
                {rupiah(historyStats.aov)}
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(17, 22, 45, 0.6) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              borderRadius: 12,
              padding: '12px 16px'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Item Terjual
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#e9d5ff', marginTop: 4 }}>
                {historyStats.totalItems} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>item</span>
              </div>
            </div>
          </div>

          {/* Filter Toolbar (Range Tanggal + Presets + Status + Metode + Search) */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.22)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            {/* Filter Bar: Search, Payment Method, and Status Filter Tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              {/* Search Box */}
              <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Cari No. Order, Menu, Pelanggan, atau Kasir..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  style={{ paddingLeft: 36, paddingRight: historySearch ? 32 : 12, height: 36, fontSize: 12.5, borderRadius: 8 }}
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch('')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Payment Method Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Metode:</span>
                <select
                  className="form-control"
                  value={historyPaymentMethod}
                  onChange={e => setHistoryPaymentMethod(e.target.value)}
                  style={{ width: 150, height: 36, fontSize: 12, borderRadius: 8 }}
                >
                  <option value="ALL">Semua Metode</option>
                  <option value="CASH">Tunai (CASH)</option>
                  <option value="QRIS">QRIS</option>
                  <option value="TRANSFER">Transfer Bank</option>
                  <option value="DEBIT">Kartu Debit</option>
                  <option value="CREDIT">Kartu Kredit</option>
                </select>
              </div>

              {/* Status Filter Tabs */}
              <div style={{ display: 'flex', gap: 5, background: 'rgba(0,0,0,0.3)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setHistoryStatus('PAID')}
                  className={`btn btn-sm ${historyStatus === 'PAID' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11.5, padding: '3px 10px', height: 28 }}
                >
                  ✓ Lunas (PAID)
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatus('HOLD')}
                  className={`btn btn-sm ${historyStatus === 'HOLD' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11.5, padding: '3px 10px', height: 28 }}
                >
                  ⏳ Tertunda (HOLD)
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatus('ALL')}
                  className={`btn btn-sm ${historyStatus === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11.5, padding: '3px 10px', height: 28 }}
                >
                  Semua Status
                </button>
              </div>
            </div>
          </div>

          {/* Main Table / Grouped Cards Area */}
          {historyLoading ? (
            <div style={{ padding: '40px 0' }}><LoadingState /></div>
          ) : filteredGroupedHistory.length === 0 ? (
            <div style={{
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px dashed var(--border)',
              borderRadius: 12,
              padding: '48px 24px',
              textAlign: 'center'
            }}>
              <Receipt size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', opacity: 0.5 }} />
              <h4 style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', margin: '0 0 6px' }}>
                Tidak Ada Riwayat Transaksi
              </h4>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0 }}>
                Tidak ditemukan transaksi pada rentang tanggal {formatLocalDisplay(historyPeriod.from)} s/d {formatLocalDisplay(historyPeriod.to)}
                {historySearch ? ` dengan pencarian "${historySearch}"` : ''}.
              </p>
            </div>
          ) : historyViewMode === 'grouped' ? (
            /* GROUPED VIEW: PER NOTA / ORDER */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredGroupedHistory.map((order) => {
                const isExpanded = Boolean(expandedHistoryOrders[order.order_number]);
                return (
                  <div
                    key={order.order_number}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      transition: 'all 0.2s ease',
                      boxShadow: isExpanded ? '0 4px 20px rgba(0, 0, 0, 0.35)' : 'none'
                    }}
                  >
                    {/* Order Summary Header (Click to toggle expansion) */}
                    <div
                      onClick={() => toggleHistoryOrderExpand(order.order_number)}
                      style={{
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12,
                        cursor: 'pointer',
                        userSelect: 'none',
                        background: isExpanded ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                        borderBottom: isExpanded ? '1px solid var(--border)' : 'none'
                      }}
                    >
                      {/* Left: Chevron + Order Number + Status Badges + Metas */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 6,
                          background: 'rgba(255, 255, 255, 0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--accent-bright)',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease'
                        }}>
                          <ChevronDown size={15} />
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span className="mono" style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--accent-bright)' }}>
                              #{order.order_number}
                            </span>
                            <span
                              className={`badge ${order.payment_method === 'GRAB' ? 'badge-success' : 'badge-neutral'}`}
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                ...(order.payment_method === 'GRAB' ? { background: '#00B14F', color: '#ffffff', borderColor: '#00B14F' } : {})
                              }}
                            >
                              {order.payment_method || 'CASH'}
                            </span>
                            <span className={`badge ${order.status === 'PAID' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10.5 }}>
                              {order.status === 'PAID' ? 'LUNAS' : 'HOLD'}
                            </span>
                            {order.is_urgent_note && (
                              <span className="badge badge-danger" style={{ fontSize: 10.5 }}>
                                NOTA URGENT
                              </span>
                            )}
                            <span className="badge badge-info" style={{ fontSize: 11 }}>
                              {order.customer_name} {order.table_number ? `· Meja ${order.table_number}` : ''}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, flexWrap: 'wrap' }}>
                            <span>{order.created_at ? formatLocalDisplay(order.created_at, true) : order.date}</span>
                            <span>Kasir: <strong style={{ color: '#ffffff' }}>{order.cashier_name}</strong></span>
                            <span><strong>{order.items.length}</strong> menu ({order.total_qty} porsi)</span>
                            {order.notes && <span style={{ color: 'var(--text-muted)' }}>*{order.notes}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Right: Total Price + Action Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--ok)' }}>
                            {rupiah(order.total_price)}
                          </div>
                          {order.discount_amount > 0 && (
                            <div style={{ fontSize: 11, color: '#f87171' }}>
                              Hemat: {rupiah(order.discount_amount)} {order.discount_name ? `(${order.discount_name})` : ''}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReprintOrder(order);
                          }}
                          title="Cetak Ulang Struk Kasir Lengkap"
                          style={{ fontSize: 11.5, padding: '4px 10px', height: 32, display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                          <Printer size={13} />
                          <span>Struk</span>
                        </button>
                      </div>
                    </div>

                    {/* Expanded Items Table */}
                    {isExpanded && (
                      <div style={{ padding: '14px 18px', background: 'rgba(0, 0, 0, 0.2)' }}>
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Menu / Item</th>
                                <th className="right">Harga Satuan</th>
                                <th className="right">Qty</th>
                                <th className="right">Subtotal</th>
                                <th className="right">Diskon</th>
                                <th className="right">Total</th>
                                <th>Catatan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items.map((it, itIdx) => (
                                <tr key={it.id || itIdx}>
                                  <td style={{ fontWeight: 600 }}>
                                    <div>{it.menu?.name}</div>
                                    {it.modifiers && it.modifiers.length > 0 && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                        {it.modifiers.map((m, mIdx) => (
                                          <span key={mIdx} style={{
                                            fontSize: 10,
                                            background: 'rgba(139, 92, 246, 0.15)',
                                            color: '#c4b5fd',
                                            border: '1px solid rgba(139, 92, 246, 0.25)',
                                            padding: '1px 5px',
                                            borderRadius: 4
                                          }}>
                                            {m.name} {Number(m.price) > 0 && `(+${rupiah(m.price)})`}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="mono right" style={{ fontSize: 12 }}>
                                    {rupiah(it.menu?.price || it.total_price / it.qty)}
                                  </td>
                                  <td className="mono right">{it.qty}</td>
                                  <td className="mono right" style={{ fontSize: 12 }}>
                                    {rupiah(it.subtotal || it.total_price)}
                                  </td>
                                  <td className="mono right" style={{ fontSize: 12, color: it.discount_amount > 0 ? '#f87171' : 'inherit' }}>
                                    {it.discount_amount > 0 ? `-${rupiah(it.discount_amount)}` : '—'}
                                  </td>
                                  <td className="mono right" style={{ fontWeight: 700, color: 'var(--ok)' }}>
                                    {rupiah(it.total_price)}
                                  </td>
                                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {it.notes || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* FLAT VIEW: PER ITEM TABLE */
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>No. Order</th>
                    <th>Tanggal</th>
                    <th>Menu</th>
                    <th className="right">Qty</th>
                    <th className="right">Total</th>
                    <th>Metode</th>
                    <th>Pelanggan</th>
                    <th>Kasir</th>
                    <th className="center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFlatTransactions.map(t => (
                    <tr key={t.id}>
                      <td className="mono" style={{ fontSize: 12, color: 'var(--accent-bright)', fontWeight: 600 }}>
                        {t.order_number || `TRX-${t.id}`}
                      </td>
                      <td className="mono" style={{ fontSize: 12 }}>{t.date}</td>
                      <td style={{ fontWeight: 500 }}>
                        <div>{t.menu?.name}</div>
                        {t.modifiers && t.modifiers.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {t.modifiers.map((m, mIdx) => (
                              <span key={mIdx} style={{
                                fontSize: 10,
                                background: 'rgba(139, 92, 246, 0.15)',
                                color: '#c4b5fd',
                                border: '1px solid rgba(139, 92, 246, 0.25)',
                                padding: '1px 5px',
                                borderRadius: 4,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3
                              }}>
                                <span>{m.name}</span>
                                {Number(m.price) > 0 && <strong style={{ color: '#a78bfa' }}>+{rupiah(m.price)}</strong>}
                              </span>
                            ))}
                          </div>
                        )}
                        {t.notes && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>*{t.notes}</div>
                        )}
                      </td>
                      <td className="mono right">{t.qty}</td>
                      <td className="mono right" style={{ color: 'var(--ok)', fontWeight: 600 }}>{rupiah(t.total_price)}</td>
                      <td>
                        <span
                          className={`badge ${t.payment_method === 'GRAB' ? 'badge-success' : 'badge-neutral'}`}
                          style={{
                            fontSize: 11,
                            ...(t.payment_method === 'GRAB' ? { background: '#00B14F', color: '#ffffff', borderColor: '#00B14F' } : {})
                          }}
                        >
                          {t.payment_method || 'CASH'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: 11 }}>
                          {t.customer_name || 'Pelanggan Umum'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.user?.name || '-'}</td>
                      <td className="center">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleReprint(t)}
                          title="Cetak Ulang Struk"
                          style={{ padding: '4px 8px' }}
                        >
                          <Printer size={13} style={{ marginRight: 4 }} /> Struk
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ========================================================
            VIEW 2: POS CASHIER (GRID MENU & INTERACTIVE CART)
           ======================================================== */}
          {/* Mobile Tab Switcher (Katalog Menu vs Keranjang) */}
          <div className="pos-mobile-tabs">
            <button
              type="button"
              className={`pos-mobile-tab-btn ${mobileActiveTab === 'catalog' ? 'active' : ''}`}
              onClick={() => setMobileActiveTab('catalog')}
            >
              <Utensils size={15} />
              <span>Katalog Menu</span>
              <span className="badge-count">{filteredMenus.length}</span>
            </button>
            <button
              type="button"
              className={`pos-mobile-tab-btn ${mobileActiveTab === 'cart' ? 'active' : ''}`}
              onClick={() => setMobileActiveTab('cart')}
            >
              <ShoppingCart size={15} />
              <span>Keranjang</span>
              {cart.length > 0 && (
                <span className="badge-count cart-active">{cart.reduce((sum, item) => sum + item.qty, 0)}</span>
              )}
            </button>
          </div>

          <div className="pos-container">
            {/* SISI KIRI: KATALOG MENU */}
            <div className={`pos-catalog-column ${mobileActiveTab === 'cart' ? 'mobile-hidden' : ''}`}>
              {/* Open Bills Bar */}
              {openBills.length > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: 10, padding: '8px 14px', marginBottom: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>
                    <Clock size={15} />
                    <span>{openBills.length} Tagihan Terbuka</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenBillsModalOpen(true)}
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: 11, padding: '3px 9px', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.4)', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Clock size={12} /> Kelola Open Bills
                  </button>
                </div>
              )}


              {/* Search & Type & Category Tabs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {/* Search Bar with Barcode scanner support */}
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Cari menu, barcode retail, atau jasa (Enter untuk scan)..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    style={{ paddingLeft: 40, paddingRight: searchQuery ? 65 : 40, borderRadius: 12 }}
                  />
                  <div style={{ position: 'absolute', right: searchQuery ? 34 : 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                    <Barcode size={18} title="Dukungan Barcode Scanner" />
                  </div>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {/* Product Type Filter Tabs */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { id: 'ALL', label: 'Semua Tipe' },
                    { id: 'RECIPE', label: 'Resep (F&B)' },
                    { id: 'DIRECT', label: 'Retail / Barang Jadi' },
                    { id: 'SERVICE', label: 'Jasa / Layanan' },
                    { id: 'BUNDLE', label: 'Paket / Bundling' },
                  ].map(t => {
                    const isAct = selectedType === t.id;
                    const count = t.id === 'ALL'
                      ? menus.length
                      : menus.filter(m => (m.item_type || 'RECIPE') === t.id).length;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedType(t.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 8,
                          fontSize: 11.5,
                          fontWeight: isAct ? 800 : 500,
                          background: isAct ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
                          color: isAct ? '#fff' : 'var(--text-secondary)',
                          border: '1px solid',
                          borderColor: isAct ? 'var(--accent)' : 'var(--border)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {t.label}
                        <span style={{
                          fontSize: 10,
                          padding: '1px 5px',
                          borderRadius: 6,
                          background: isAct ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                          color: isAct ? '#fff' : 'var(--text-muted)'
                        }}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Category Pills */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {categories.map(cat => {
                    const count = cat === 'ALL'
                      ? (selectedType === 'ALL' ? menus.length : menus.filter(m => (m.item_type || 'RECIPE') === selectedType).length)
                      : menus.filter(m => (m.category || 'Lainnya') === cat && (selectedType === 'ALL' || (m.item_type || 'RECIPE') === selectedType)).length;
                    return (
                      <button
                        key={cat}
                        className={`pos-category-pill ${selectedCategory === cat ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat)}
                      >
                        {cat === 'ALL' ? 'Semua Kategori' : cat}
                        <span style={{
                          fontSize: 10,
                          background: selectedCategory === cat ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                          padding: '1px 6px',
                          borderRadius: 10
                        }}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Menu Cards Grid */}
              <div className="pos-menu-grid">
                {filteredMenus.length === 0 ? (
                  <div className="card center" style={{ gridColumn: '1 / -1', padding: 40 }}>
                    <p style={{ color: 'var(--text-secondary)' }}>Tidak ada menu yang cocok dengan pencarian.</p>
                  </div>
                ) : (
                  filteredMenus.map(menu => {
                    const cartItem = cart.find(it => it.menu.id === menu.id);
                    const status = menu.stockStatus;
                    const isDrink = (menu.category || '').toLowerCase().includes('minum');

                    return (
                      <div
                        key={menu.id}
                        className={`pos-menu-card ${cartItem ? 'in-cart' : ''} ${status.isSoldOut ? 'sold-out' : ''}`}
                        onClick={() => handleMenuCardClick(menu, status)}
                      >
                        {/* Badge if in cart */}
                        {cartItem && (
                          <div className="pos-menu-badge">
                            x{cartItem.qty}
                          </div>
                        )}

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div className="pos-menu-icon" style={{
                              background: status.isSoldOut ? 'rgba(244, 63, 94, 0.15)' : (
                                menu.item_type === 'SERVICE' ? 'rgba(168, 85, 247, 0.15)' :
                                menu.item_type === 'DIRECT' ? 'rgba(59, 130, 246, 0.15)' :
                                menu.item_type === 'BUNDLE' ? 'rgba(244, 63, 94, 0.15)' : undefined
                              ),
                              borderColor: status.isSoldOut ? 'rgba(244, 63, 94, 0.3)' : (
                                menu.item_type === 'SERVICE' ? 'rgba(168, 85, 247, 0.3)' :
                                menu.item_type === 'DIRECT' ? 'rgba(59, 130, 246, 0.3)' :
                                menu.item_type === 'BUNDLE' ? 'rgba(244, 63, 94, 0.3)' : undefined
                              ),
                              color: status.isSoldOut ? '#fb7185' : (
                                menu.item_type === 'SERVICE' ? '#c084fc' :
                                menu.item_type === 'DIRECT' ? '#60a5fa' :
                                menu.item_type === 'BUNDLE' ? '#fda4af' : undefined
                              ),
                            }}>
                              {menu.item_type === 'SERVICE' ? <Briefcase size={22} /> :
                               menu.item_type === 'DIRECT' ? <ShoppingBag size={22} /> :
                               menu.item_type === 'BUNDLE' ? <Gift size={22} /> :
                               (isDrink ? <Coffee size={22} /> : <Utensils size={22} />)}
                            </div>

                            {/* Stock Status Badge */}
                            {menu.item_type === 'SERVICE' ? (
                              <span className="pos-stock-badge in-stock" style={{ background: 'rgba(168, 85, 247, 0.15)', borderColor: 'rgba(168, 85, 247, 0.35)', color: '#c084fc' }}>
                                Layanan
                              </span>
                            ) : menu.item_type === 'DIRECT' ? (
                              status.isSoldOut ? (
                                <span className="pos-stock-badge sold-out">
                                  Habis
                                </span>
                              ) : status.isLowStock ? (
                                <span className="pos-stock-badge low-stock">
                                  Sisa {status.availableServings} {menu.unit || 'pcs'}
                                </span>
                              ) : (
                                <span className="pos-stock-badge in-stock" style={{ background: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.35)', color: '#93c5fd' }}>
                                  Stok {status.availableServings} {menu.unit || 'pcs'}
                                </span>
                              )
                            ) : menu.item_type === 'BUNDLE' ? (
                              status.isSoldOut ? (
                                <span className="pos-stock-badge sold-out">
                                  Habis
                                </span>
                              ) : status.isLowStock ? (
                                <span className="pos-stock-badge low-stock">
                                  Sisa {status.availableServings} paket
                                </span>
                              ) : (
                                <span className="pos-stock-badge in-stock" style={{ background: 'rgba(244, 63, 94, 0.15)', borderColor: 'rgba(244, 63, 94, 0.35)', color: '#fda4af' }}>
                                  {status.availableServings} paket
                                </span>
                              )
                            ) : (
                              status.isSoldOut ? (
                                <span className="pos-stock-badge sold-out">
                                  Habis
                                </span>
                              ) : status.isLowStock ? (
                                <span className="pos-stock-badge low-stock">
                                  Sisa {status.availableServings}
                                </span>
                              ) : (
                                <span className="pos-stock-badge in-stock">
                                  {status.availableServings} porsi
                                </span>
                              )
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
                            <span style={{ fontSize: 11, color: 'var(--accent-bright)', fontWeight: 600 }}>
                              {menu.category || 'Menu'}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {menu.item_type === 'BUNDLE' && (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: 'rgba(244, 63, 94, 0.18)',
                                  color: '#fda4af',
                                  border: '1px solid rgba(244, 63, 94, 0.35)',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3
                                }}>
                                  <Gift size={9} /> Bundling
                                </span>
                              )}
                              {menu.modifier_groups && menu.modifier_groups.length > 0 && (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: 'rgba(139, 92, 246, 0.18)',
                                  color: '#c4b5fd',
                                  border: '1px solid rgba(139, 92, 246, 0.35)',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3
                                }}>
                                  <Sparkles size={9} /> {menu.modifier_groups.length} Varian
                                </span>
                              )}
                            </div>
                          </div>
                          <h4 style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: status.isSoldOut ? '#fca5a5' : '#ffffff',
                            marginBottom: 4,
                            lineHeight: 1.3
                          }}>
                            {menu.name}
                          </h4>

                          {/* Bundle Items Breakdown Preview */}
                          {menu.item_type === 'BUNDLE' && status.bundleItemsSummary && status.bundleItemsSummary.length > 0 && (
                            <div style={{
                              marginTop: 5,
                              marginBottom: 4,
                              padding: '5px 7px',
                              background: 'rgba(0, 0, 0, 0.22)',
                              borderRadius: 6,
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                            }}>
                              <div style={{
                                fontSize: 9.5,
                                color: 'var(--text-secondary)',
                                marginBottom: 3,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                fontWeight: 700
                              }}>
                                <Gift size={10} style={{ color: '#f43f5e' }} />
                                <span>Isi Paket:</span>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                {status.bundleItemsSummary.map((item, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      fontSize: 9.5,
                                      padding: '1px 5px',
                                      borderRadius: 4,
                                      background: item.isSoldOut ? 'rgba(244, 63, 94, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                                      color: item.isSoldOut ? '#fb7185' : 'var(--text-primary)',
                                      border: `1px solid ${item.isSoldOut ? 'rgba(244, 63, 94, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
                                      fontWeight: item.isSoldOut ? 700 : 500,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 2,
                                    }}
                                    title={item.isSoldOut ? `${item.name} stoknya habis!` : `${item.qty} ${item.name}`}
                                  >
                                    {item.qty > 1 ? `${item.qty}x ` : ''}{item.name}
                                    {item.isSoldOut && (
                                      <span style={{ color: '#f43f5e', fontSize: 9, fontWeight: 800 }}>
                                        (Habis)
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="mono" style={{ fontWeight: 800, color: status.isSoldOut ? '#fb7185' : 'var(--ok)', fontSize: 13.5 }}>
                            {rupiah(menu.price)}
                          </span>
                          {status.isSoldOut ? (
                            <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 600 }}>
                              {status.limitingItem ? `${status.limitingItem.name} Habis` : (status.limitingIngredient ? `${status.limitingIngredient.name} Habis` : (menu.item_type === 'DIRECT' ? '+ Klik Restok' : '! Habis'))}
                            </span>
                          ) : menu.item_type === 'SERVICE' ? (
                            <span style={{ fontSize: 10, color: '#c084fc', fontWeight: 700 }}>
                              ⚡ Jasa
                            </span>
                          ) : menu.item_type === 'DIRECT' ? (
                            <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700 }}>
                              📦 Retail
                            </span>
                          ) : menu.item_type === 'BUNDLE' ? (
                            <span style={{ fontSize: 10, color: '#fda4af', fontWeight: 700 }}>
                              🎁 {status.bundleItemsSummary?.length || 0} Menu
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: status.hasRecipe ? 'var(--text-muted)' : '#f59e0b', fontWeight: 600 }} title={status.hasRecipe ? 'Resep Aktif' : 'Bebas Resep'}>
                              {status.hasRecipe ? '✓ Resep' : '⚡ Bebas'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* SISI KANAN: KERANJANG PESANAN (CART PANEL) */}
            <div className={`pos-cart-panel ${mobileActiveTab === 'catalog' ? 'mobile-hidden' : ''}`}>
              {/* Header Keranjang */}
              <div className="pos-cart-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, color: '#ffffff' }}>
                    <ShoppingCart size={18} style={{ color: 'var(--accent)' }} />
                    Pesanan Pelanggan
                  </div>
                  {cart.length > 0 && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={clearCart}
                      style={{ fontSize: 11, color: 'var(--danger)', padding: '2px 8px' }}
                    >
                      <RotateCcw size={12} style={{ marginRight: 4 }} /> Kosongkan
                    </button>
                  )}
                </div>

                {/* Append Mode Active Banner */}
                {appendModeBill && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    marginBottom: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <div style={{ fontSize: 11.5, color: '#fcd34d' }}>
                      <strong>Tambah Menu:</strong> <span className="mono">({appendModeBill.order_number})</span>
                      {appendModeBill.customer_name && ` · ${appendModeBill.customer_name}`}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAppendModeBill(null);
                        setCart([]);
                        setCustomerName('');
                      }}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 6px', fontSize: 10.5, color: '#fb7185' }}
                    >
                      Batal
                    </button>
                  </div>
                )}

                {/* Member / Customer Selection Bar */}
                <div style={{ position: 'relative', marginBottom: 6 }}>
                  {selectedCustomer ? (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.16) 0%, rgba(168, 85, 247, 0.12) 100%)',
                      border: '1px solid rgba(99, 102, 241, 0.35)',
                      borderRadius: 8,
                      padding: '7px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'rgba(99, 102, 241, 0.25)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#c084fc', flexShrink: 0
                        }}>
                          <UserCheck size={15} />
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <strong style={{ fontSize: 12, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {selectedCustomer.name}
                            </strong>
                            <span className="mono" style={{ fontSize: 9.5, background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', padding: '0 4px', borderRadius: 3 }}>
                              {selectedCustomer.code}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5 }}>
                            <span style={{ color: '#fbbf24', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Coins size={11} /> {num(selectedCustomer.total_points || 0)} Poin
                            </span>
                            <span style={{ color: '#34d399', fontSize: 10 }}>
                              (+1 Poin nota)
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={handleClearCustomer}
                        title="Batal pilih member"
                        style={{ padding: 3, color: 'var(--text-muted)' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Pelanggan / Cari No HP Member..."
                          value={customerName}
                          onFocus={() => {
                            setMemberSearchOpen(true);
                            searchMembers(customerName);
                          }}
                          onChange={e => {
                            const val = e.target.value;
                            setCustomerName(val);
                            setMemberSearchOpen(true);
                            searchMembers(val);
                          }}
                          style={{ fontSize: 12, padding: '7px 10px', borderRadius: 8 }}
                        />
                        {customerName && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            onClick={() => {
                              setCustomerName('');
                              setMemberSearchOpen(false);
                            }}
                            style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', padding: 2 }}
                          >
                            <X size={13} />
                          </button>
                        )}

                        {/* Member Autocomplete Dropdown */}
                        {memberSearchOpen && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 100,
                            marginTop: 4,
                            background: '#161c38',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            borderRadius: 8,
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                            maxHeight: 220,
                            overflowY: 'auto'
                          }}>
                            <div style={{ padding: '6px 10px', fontSize: 10.5, color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
                              <span>PILIH MEMBER TERDAFTAR</span>
                              <button
                                type="button"
                                onClick={() => setMemberSearchOpen(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}
                              >
                                Tutup
                              </button>
                            </div>
                            {searchingMembers ? (
                              <div style={{ padding: '12px', textAlign: 'center', fontSize: 11.5, color: 'var(--text-muted)' }}>
                                Mencari member...
                              </div>
                            ) : memberSearchResults.length === 0 ? (
                              <div style={{ padding: '12px 10px', textAlign: 'center', fontSize: 11.5, color: 'var(--text-muted)' }}>
                                Tidak ada member ditemukan.
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMemberSearchOpen(false);
                                    setQuickMemberModal({ open: true, name: customerName, phone: '', saving: false });
                                  }}
                                  className="btn btn-ghost btn-sm"
                                  style={{ color: '#34d399', fontSize: 11, display: 'block', margin: '4px auto 0' }}
                                >
                                  + Daftarkan "{customerName || 'Pelanggan'}" Jadi Member
                                </button>
                              </div>
                            ) : (
                              memberSearchResults.map(m => (
                                <div
                                  key={m.id}
                                  onClick={() => handleSelectCustomer(m)}
                                  style={{
                                    padding: '8px 10px',
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'background 0.15s'
                                  }}
                                  className="table-row-hover"
                                >
                                  <div>
                                    <div style={{ fontWeight: 700, color: '#ffffff', fontSize: 12 }}>
                                      {m.name} <span className="mono" style={{ fontSize: 9.5, color: '#a5b4fc', marginLeft: 4 }}>({m.code})</span>
                                    </div>
                                    <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                                      {m.phone}
                                    </div>
                                  </div>
                                  <span style={{
                                    fontSize: 10.5,
                                    fontWeight: 800,
                                    color: '#fbbf24',
                                    background: 'rgba(245, 158, 11, 0.12)',
                                    padding: '2px 6px',
                                    borderRadius: 4
                                  }}>
                                    {num(m.total_points || 0)} Poin
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setQuickMemberModal({ open: true, name: customerName, phone: '', saving: false })}
                        title="Daftar Member Baru (+1 Poin Transaksi)"
                        style={{
                          fontSize: 11,
                          padding: '0 8px',
                          borderRadius: 8,
                          color: '#34d399',
                          borderColor: 'rgba(16, 185, 129, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          flexShrink: 0
                        }}
                      >
                        <UserPlus size={13} />
                        + Member
                      </button>
                    </div>
                  )}
                </div>
              </div>


              {/* Cart Item List */}
              <div className="pos-cart-list">
                {cart.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 14px', color: 'var(--text-muted)' }}>
                    <div style={{
                      width: 50, height: 50, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.04)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 12px', color: 'var(--text-muted)'
                    }}>
                      <ShoppingCart size={24} />
                    </div>
                    <strong style={{ display: 'block', color: '#ffffff', fontSize: 13, marginBottom: 4 }}>
                      Keranjang Kosong
                    </strong>
                    <span style={{ fontSize: 11.5 }}>
                      Klik menu di katalog sisi kiri untuk memasukkan pesanan.
                    </span>
                  </div>
                ) : (
                  cart.map(item => {
                    const status = getMenuStockStatus(item.menu);
                    const itemKey = item.cartKey || item.menu.id;
                    const effectiveUnitPrice = item.unitPrice ?? item.menu.price;

                    return (
                      <div key={itemKey} className="pos-cart-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ flex: 1, paddingRight: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span>{item.menu.name}</span>
                              {item.menu.item_type === 'BUNDLE' && (
                                <span style={{ fontSize: 10, color: '#fda4af', background: 'rgba(244,63,94,0.18)', border: '1px solid rgba(244,63,94,0.35)', padding: '1px 6px', borderRadius: 4, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Gift size={10} /> BUNDLING
                                </span>
                              )}
                              {item.isUrgent && (
                                <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', padding: '1px 6px', borderRadius: 4, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Zap size={10} /> NOTA URGENT
                                </span>
                              )}
                              {status.isSoldOut && !item.isUrgent && (
                                <span style={{ fontSize: 10, color: 'var(--danger)', background: 'rgba(244,63,94,0.15)', padding: '1px 5px', borderRadius: 4 }}>
                                  Stok Habis
                                </span>
                              )}
                            </div>

                            {/* Bundle breakdown pills in cart */}
                            {item.menu.item_type === 'BUNDLE' && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                                {(item.menu.bundle_items || item.menu.bundleItems || []).map((bi, bIdx) => {
                                  const bm = menus.find(m => m.id === (bi.bundled_menu_id || bi.bundledMenu?.id)) || bi.bundledMenu;
                                  const name = bm?.name || (bi.ingredient?.name || `Item #${bi.bundled_menu_id || bi.ingredient_id}`);
                                  return (
                                    <span key={bIdx} style={{
                                      fontSize: 10,
                                      background: 'rgba(244, 63, 94, 0.12)',
                                      border: '1px solid rgba(244, 63, 94, 0.25)',
                                      color: '#fda4af',
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 2,
                                    }}>
                                      {Number(bi.qty) > 1 ? `${bi.qty}x ` : ''}{name}
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* Selected Modifiers Pills */}
                            {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                {item.selectedModifiers.map((mod, mIdx) => (
                                  <span key={mIdx} style={{
                                    fontSize: 10,
                                    background: 'rgba(139, 92, 246, 0.15)',
                                    border: '1px solid rgba(139, 92, 246, 0.3)',
                                    color: '#c4b5fd',
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3
                                  }}>
                                    <span>{mod.name}</span>
                                    {Number(mod.price) > 0 && (
                                      <strong style={{ color: '#a78bfa' }}>+{rupiah(mod.price)}</strong>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
                              {rupiah(effectiveUnitPrice)} {item.selectedModifiers?.length > 0 && `(Dasar ${rupiah(item.menu.price)})`}
                            </div>
                          </div>
                          <div className="mono" style={{ fontWeight: 700, fontSize: 13, color: 'var(--ok)' }}>
                            {rupiah(effectiveUnitPrice * item.qty)}
                          </div>
                        </div>

                        {/* Controls & Item Note */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              className="pos-qty-btn"
                              onClick={() => updateQty(itemKey, -1)}
                            >
                              <Minus size={12} />
                            </button>
                            <span className="mono" style={{ minWidth: 20, textAlign: 'center', fontWeight: 700, fontSize: 13, color: '#ffffff' }}>
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              className="pos-qty-btn"
                              onClick={() => updateQty(itemKey, 1)}
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="text"
                              placeholder="Catatan..."
                              value={item.notes || ''}
                              onChange={e => updateItemNotes(itemKey, e.target.value)}
                              style={{
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid var(--border)',
                                borderRadius: 6,
                                padding: '3px 6px',
                                fontSize: 11,
                                color: '#ffffff',
                                width: 110,
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => removeFromCart(itemKey)}
                              style={{
                                background: 'none', border: 'none',
                                color: 'var(--danger)', cursor: 'pointer',
                                padding: 4, display: 'flex', alignItems: 'center'
                              }}
                              title="Hapus menu ini"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Cart Footer / Checkout Action */}
              <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'rgba(15, 23, 42, 0.6)' }}>
                {/* Discount & Voucher Section */}
                {!appendModeBill && (
                  <div style={{
                    marginBottom: 12,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px dashed rgba(255, 255, 255, 0.15)',
                  }}>
                    {appliedDiscount ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            background: 'rgba(16, 185, 129, 0.18)',
                            color: '#34d399',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3
                          }}>
                            <Tag size={11} />
                            {appliedDiscount.type === 'PERCENTAGE' ? `${appliedDiscount.value ?? appliedDiscount.rate}%` : 'Rp'}
                          </span>
                          <div>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#ffffff' }}>
                              {appliedDiscount.name}
                            </div>
                            <div style={{ fontSize: 10, color: '#34d399', fontWeight: 600 }}>
                              Hemat -{rupiah(cartDiscountAmount)}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveDiscount}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 4,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Hapus diskon"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <Tag size={12} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-muted)' }} />
                            <input
                              type="text"
                              placeholder="Kode Voucher..."
                              value={promoCodeInput}
                              onChange={e => setPromoCodeInput(e.target.value.toUpperCase())}
                              onKeyDown={e => { if (e.key === 'Enter') handleApplyVoucherCode(); }}
                              style={{
                                width: '100%',
                                padding: '5px 8px 5px 26px',
                                background: 'rgba(0, 0, 0, 0.25)',
                                border: '1px solid var(--border)',
                                borderRadius: 6,
                                fontSize: 11,
                                color: '#ffffff',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                                letterSpacing: '0.04em'
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleApplyVoucherCode}
                            disabled={validatingPromo || !promoCodeInput.trim()}
                            style={{ fontSize: 11, padding: '4px 8px' }}
                          >
                            {validatingPromo ? 'Cek...' : 'Terapkan'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setPromoModalOpen(true)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent-bright)',
                              cursor: 'pointer',
                              fontSize: 10.5,
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: 0
                            }}
                          >
                            <Gift size={11} /> Promo Tersedia ({availableDiscounts.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustomDiscountModal(p => ({ ...p, open: true }))}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              fontSize: 10.5,
                              padding: 0
                            }}
                          >
                            + Diskon Kasir
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Subtotal, Diskon, Total breakdown */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  <span>Subtotal ({cartItemCount} menu):</span>
                  <span className="mono">{rupiah(cartGrossSubtotal)}</span>
                </div>
                {cartDiscountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11.5, color: '#34d399', fontWeight: 600 }}>
                    <span>Potongan Diskon:</span>
                    <span className="mono">-{rupiah(cartDiscountAmount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'baseline', paddingTop: 4, borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#ffffff' }}>
                    {appendModeBill ? 'Tambahan Tagihan:' : 'Total Tagihan:'}
                  </span>
                  <span className="mono" style={{ fontSize: 19, fontWeight: 800, color: appendModeBill ? '#fbbf24' : 'var(--ok)' }}>
                    {rupiah(cartTotal)}
                  </span>
                </div>

                {appendModeBill ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      type="button"
                      className="btn w-full"
                      onClick={() => handleSubmitAppendItems()}
                      disabled={cart.length === 0 || submitting}
                      style={{
                        background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                        color: '#ffffff',
                        justifyContent: 'center',
                        padding: '12px',
                        fontSize: 13.5,
                        fontWeight: 800,
                        boxShadow: cart.length > 0 ? '0 4px 20px rgba(217, 119, 6, 0.4)' : 'none'
                      }}
                    >
                      <ChefHat size={16} style={{ marginRight: 6 }} />
                      Kirim Tambahan ke Dapur ({rupiah(cartTotal)})
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setAppendModeBill(null);
                        setCart([]);
                        setCustomerName('');
                      }}
                      style={{ justifyContent: 'center' }}
                    >
                      Batal Mode Tambah
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1.35fr', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleHoldOrder}
                      disabled={cart.length === 0 || submitting}
                      style={{
                        justifyContent: 'center',
                        padding: '12px 6px',
                        fontSize: 12.5,
                        fontWeight: 700,
                        background: 'rgba(245, 158, 11, 0.12)',
                        borderColor: 'rgba(245, 158, 11, 0.35)',
                        color: '#fbbf24',
                      }}
                      title="Simpan pesanan belum bayar / tagihan terbuka (Hold Order)"
                    >
                      <Bookmark size={14} style={{ marginRight: 4 }} />
                      Hold Bill
                    </button>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleOpenPayment}
                      disabled={cart.length === 0}
                      style={{
                        justifyContent: 'center',
                        padding: '12px 6px',
                        fontSize: 12.5,
                        fontWeight: 800,
                        boxShadow: cart.length > 0 ? '0 4px 20px var(--accent-glow)' : 'none'
                      }}
                    >
                      Bayar ({rupiah(cartTotal)}) <ArrowRight size={14} style={{ marginLeft: 4 }} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Floating Mobile Cart Bar (Sticky at bottom on narrow screens) */}
          {cart.length > 0 && mobileActiveTab === 'catalog' && (
            <div className="pos-floating-mobile-bar">
              <div className="pos-floating-bar-info">
                <div className="pos-floating-bar-badge">
                  <ShoppingCart size={15} />
                  <span>{cart.reduce((sum, item) => sum + item.qty, 0)} item</span>
                </div>
                <div className="pos-floating-bar-price">
                  <span style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>Total:</span>
                  <strong className="mono" style={{ fontSize: 14.5, color: '#34d399' }}>{rupiah(cartTotal)}</strong>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setMobileActiveTab('cart')}
                style={{ fontWeight: 800, padding: '8px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                Lihat Keranjang <ArrowRight size={14} />
              </button>
            </div>
          )}
        </>
      )}

      {/* ========================================================
          MODAL A: PERINGATAN BAHAN HABIS / DEFISIT
         ======================================================== */}
      {stockAlertModal.open && stockAlertModal.menu && (
        <div className="modal-overlay" onClick={() => setStockAlertModal({ open: false, menu: null, status: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fb7185'
              }}>
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  {stockAlertModal.menu.item_type === 'BUNDLE' ? 'Stok Paket Bundling Tidak Cukup!' : 'Stok Bahan Tidak Mencukupi!'}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {stockAlertModal.menu.item_type === 'BUNDLE' ? 'Ada menu isi paket yang kehabisan stok' : 'Peringatan ketersediaan bahan baku di sistem'}
                </span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 14 }}>
              {stockAlertModal.menu.item_type === 'BUNDLE' ? (
                <>Paket <strong>{stockAlertModal.menu.name}</strong> tidak dapat dipesan karena ada menu isi paket yang stoknya habis atau tidak mencukupi takaran paket:</>
              ) : (
                <>Menu <strong>{stockAlertModal.menu.name}</strong> membutuhkan bahan baku yang saat ini stoknya habis atau di bawah takaran resep:</>
              )}
            </p>

            {/* Breakdown Table */}
            <div style={{
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 10,
              marginBottom: 16,
              maxHeight: 180,
              overflowY: 'auto'
            }}>
              {stockAlertModal.status.details.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 4px',
                  borderBottom: idx < stockAlertModal.status.details.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  fontSize: 12
                }}>
                  <div>
                    <strong style={{ color: item.isDeficit ? '#fb7185' : '#ffffff' }}>
                      {item.name}
                    </strong>
                    {item.isBundledMenu ? (
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                        Butuh: {num(item.required)} {item.unit} / paket {item.subLimiting && <span style={{ color: '#fb7185' }}>({item.subLimiting.name} habis)</span>}
                      </div>
                    ) : (
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                        Butuh: {num(item.required)} {item.unit} / porsi
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="mono" style={{
                      fontWeight: 700,
                      color: item.isDeficit ? 'var(--danger)' : 'var(--ok)'
                    }}>
                      {num(item.stock)} {item.unit}
                    </span>
                    <div style={{ fontSize: 10, color: item.isDeficit ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {item.isDeficit ? '❌ Habis / Defisit' : (stockAlertModal.menu.item_type === 'BUNDLE' ? `✓ ${item.possibleServings} paket` : `✓ ${item.possibleServings} porsi`)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* PRIMARY ACTION: Buat Nota Urgent (Potong sisa & gantungkan kekurangan) */}
              <button
                type="button"
                className="btn btn-warning"
                onClick={handleCreateUrgentOrder}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#000000',
                  fontWeight: 800,
                  fontSize: 13,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                }}
              >
                <Zap size={16} /> Buat Nota Urgent (Potong Sisa Stok & Gantungkan Kekurangan)
              </button>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setStockAlertModal({ open: false, menu: null, status: null })}
                  style={{ flex: 1, minWidth: 80, justifyContent: 'center' }}
                >
                  Batal
                </button>
                <Link
                  to={stockAlertModal.menu?.item_type === 'DIRECT'
                    ? `/transfer?destination_outlet_id=${currentTargetOutlet}&menu_id=${stockAlertModal.menu.id}&item_type=PRODUCT`
                    : (stockAlertModal.menu?.item_type === 'BUNDLE' && stockAlertModal.status.limitingItem?.id
                        ? `/transfer?destination_outlet_id=${currentTargetOutlet}&menu_id=${stockAlertModal.status.limitingItem.id}&item_type=PRODUCT`
                        : `/transfer?destination_outlet_id=${currentTargetOutlet}&ingredient_id=${stockAlertModal.status.limitingIngredient?.id || ''}`
                      )
                  }
                  className="btn btn-outline"
                  style={{ flex: 1.5, minWidth: 140, justifyContent: 'center', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Send size={14} /> Minta Transfer
                </Link>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleOpenRestock(stockAlertModal.status.limitingItem?.subLimiting?.id || stockAlertModal.status.limitingIngredient?.id)}
                  style={{ flex: 1.8, minWidth: 150, justifyContent: 'center', fontWeight: 700 }}
                >
                  <Package size={14} style={{ marginRight: 4 }} /> Restok Beli
                </button>
              </div>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleForceAddToCart}
                style={{ fontSize: 11.5, color: 'var(--text-secondary)', justifyContent: 'center' }}
              >
                Tetap Jual (Order Darurat / Bahan Ada di Dapur) <ArrowUpRight size={13} style={{ marginLeft: 4 }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL B: TAMBAH STOK CEPAT (QUICK RESTOCK)
         ======================================================== */}
      {restockModal.open && (
        <div className="modal-overlay" onClick={() => setRestockModal(p => ({ ...p, open: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {restockModal.isDirectProduct ? <ShoppingBag size={18} style={{ color: '#60a5fa' }} /> : <Package size={18} style={{ color: 'var(--accent)' }} />}
                  {restockModal.isDirectProduct ? `Restok Cepat Produk Retail` : 'Tambah Stok Cepat Bahan Baku'}
                </h3>
                <span style={{ fontSize: 11.5, color: 'var(--accent-bright)', fontWeight: 600 }}>
                  📍 Cabang: {activeOutlet?.name || 'Cabang Aktif'}
                  {restockModal.isDirectProduct && ` · ${restockModal.menuName} (Sisa: ${num(restockModal.currentStock)} ${restockModal.unit})`}
                </span>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setRestockModal(p => ({ ...p, open: false }))}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitRestock}>
              {restockModal.isDirectProduct ? (
                <>
                  {/* Direct Retail Restock */}
                  <div className="form-group mb-3">
                    <label className="form-label">Nama Produk Retail</label>
                    <input
                      type="text"
                      className="form-control"
                      value={restockModal.menuName}
                      disabled
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#ffffff', fontWeight: 700 }}
                    />
                  </div>

                  <div className="form-group mb-3">
                    <label className="form-label">Jumlah Penambahan ({restockModal.unit || 'pcs'})</label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      className="form-control mono"
                      value={restockModal.qty}
                      onChange={e => handleRestockQtyChange(e.target.value)}
                      required
                      placeholder="Contoh: 10"
                      autoFocus
                    />
                  </div>

                  {/* Two-Way Auto-Division: Total Nota vs Unit Price */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label className="form-label" style={{ color: '#34d399', fontWeight: 800, fontSize: 12, margin: '0 0 5px 0' }}>
                        Total Nota (Rp)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="form-control mono"
                        style={{ borderColor: 'rgba(16, 185, 129, 0.5)', background: 'rgba(0,0,0,0.25)', color: '#34d399', fontWeight: 700 }}
                        placeholder="Total di bon belanja"
                        value={restockModal.totalPrice}
                        onChange={e => handleRestockTotalPriceChange(e.target.value)}
                      />
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
                        Ketik total belanja di bon.
                      </span>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <label className="form-label" style={{ color: '#60a5fa', fontWeight: 800, fontSize: 12, margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calculator size={13} /> Modal/Satuan (Rp)
                        </label>
                        <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
                          per {restockModal.unit || 'pcs'}
                        </span>
                      </div>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="form-control mono"
                        style={{ borderColor: 'rgba(96, 165, 250, 0.5)', background: 'rgba(0,0,0,0.25)', color: '#60a5fa', fontWeight: 700 }}
                        placeholder="Harga satuan modal"
                        value={restockModal.unitPrice}
                        onChange={e => handleRestockUnitPriceChange(e.target.value)}
                      />
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
                        Otomatis: Total ÷ Qty.
                      </span>
                    </div>
                  </div>

                  {/* Formula Preview Banner */}
                  {Number(restockModal.qty) > 0 && (Number(restockModal.totalPrice) > 0 || Number(restockModal.unitPrice) > 0) && (
                    <div style={{
                      marginBottom: 12,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px dashed rgba(52, 211, 153, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11.5,
                      flexWrap: 'wrap',
                      gap: 4
                    }}>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        💡 Hasil Bagi: <strong style={{ color: '#34d399' }}>{rupiah(restockModal.totalPrice || (Number(restockModal.qty) * Number(restockModal.unitPrice)))}</strong> ÷ <strong style={{ color: '#ffffff' }}>{restockModal.qty} {restockModal.unit || 'pcs'}</strong> =
                      </div>
                      <div className="mono" style={{ fontWeight: 800, color: '#60a5fa' }}>
                        {rupiah(restockModal.unitPrice || (Number(restockModal.totalPrice) / Number(restockModal.qty)))} / {restockModal.unit || 'pcs'}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Select Ingredient */}
                  <div className="form-group mb-3">
                    <label className="form-label">Pilih Bahan Baku</label>
                    <select
                      className="form-control"
                      value={restockModal.ingredientId}
                      onChange={e => {
                        const newId = e.target.value;
                        const ing = ingredients.find(i => String(i.id) === String(newId));
                        const curQ = Number(restockModal.qty) || 5;
                        const defaultUnitPrice = ing?.harga || '';
                        const defaultTotalPrice = defaultUnitPrice ? Math.round(curQ * Number(defaultUnitPrice)) : '';
                        setRestockModal(p => ({
                          ...p,
                          ingredientId: newId,
                          unitPrice: defaultUnitPrice,
                          totalPrice: defaultTotalPrice,
                        }));
                      }}
                      required
                    >
                      {ingredients.map(ing => (
                        <option key={ing.id} value={ing.id}>
                          {ing.code} - {ing.name} (Sisa: {num(ing.current_stock ?? ing.stok_awal)} {ing.unit_pakai})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity and Unit Mode */}
                  <div className="form-group mb-3">
                    <label className="form-label">Jumlah Penambahan</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8 }}>
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        className="form-control mono"
                        value={restockModal.qty}
                        onChange={e => handleRestockQtyChange(e.target.value)}
                        required
                      />
                      <select
                        className="form-control"
                        value={restockModal.unitType}
                        onChange={e => {
                          const newType = e.target.value;
                          setRestockModal(p => ({ ...p, unitType: newType }));
                        }}
                      >
                        <option value="BELI">
                          {restockSelectedIng?.unit_beli || 'Satuan Beli'} ({restockSelectedIng?.konversi || 1000}x)
                        </option>
                        <option value="PAKAI">
                          {restockSelectedIng?.unit_pakai || 'Satuan Pakai'}
                        </option>
                      </select>
                    </div>
                    {restockSelectedIng && restockModal.unitType === 'BELI' && (
                      <span style={{ fontSize: 11, color: 'var(--accent-bright)', marginTop: 4, display: 'block' }}>
                        = {num(Number(restockModal.qty) * (Number(restockSelectedIng.konversi) || 1))} {restockSelectedIng.unit_pakai}
                      </span>
                    )}
                  </div>

                  {/* Two-Way Auto-Division: Total Nota vs Unit Price for Ingredients */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label className="form-label" style={{ color: '#34d399', fontWeight: 800, fontSize: 12, margin: '0 0 5px 0' }}>
                        Total Nota (Rp)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="form-control mono"
                        style={{ borderColor: 'rgba(16, 185, 129, 0.5)', background: 'rgba(0,0,0,0.25)', color: '#34d399', fontWeight: 700 }}
                        placeholder="Total di bon belanja"
                        value={restockModal.totalPrice}
                        onChange={e => handleRestockTotalPriceChange(e.target.value)}
                      />
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
                        Ketik total belanja di bon/nota.
                      </span>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <label className="form-label" style={{ color: '#60a5fa', fontWeight: 800, fontSize: 12, margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calculator size={13} /> Harga Satuan (Rp)
                        </label>
                        <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
                          per {restockModal.unitType === 'BELI' ? restockSelectedIng?.unit_beli : restockSelectedIng?.unit_pakai}
                        </span>
                      </div>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="form-control mono"
                        style={{ borderColor: 'rgba(96, 165, 250, 0.5)', background: 'rgba(0,0,0,0.25)', color: '#60a5fa', fontWeight: 700 }}
                        placeholder="Hasil bagi otomatis..."
                        value={restockModal.unitPrice}
                        onChange={e => handleRestockUnitPriceChange(e.target.value)}
                      />
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
                        Otomatis: Total ÷ Qty.
                      </span>
                    </div>
                  </div>

                  {/* Formula Preview Banner */}
                  {Number(restockModal.qty) > 0 && (Number(restockModal.totalPrice) > 0 || Number(restockModal.unitPrice) > 0) && (
                    <div style={{
                      marginBottom: 12,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px dashed rgba(52, 211, 153, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11.5,
                      flexWrap: 'wrap',
                      gap: 4
                    }}>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        💡 Hasil Bagi: <strong style={{ color: '#34d399' }}>{rupiah(restockModal.totalPrice || (Number(restockModal.qty) * Number(restockModal.unitPrice)))}</strong> ÷ <strong style={{ color: '#ffffff' }}>{restockModal.qty} {restockModal.unitType === 'BELI' ? restockSelectedIng?.unit_beli : restockSelectedIng?.unit_pakai}</strong> =
                      </div>
                      <div className="mono" style={{ fontWeight: 800, color: '#60a5fa' }}>
                        {rupiah(restockModal.unitPrice || (Number(restockModal.totalPrice) / Number(restockModal.qty)))} / {restockModal.unitType === 'BELI' ? restockSelectedIng?.unit_beli : restockSelectedIng?.unit_pakai}
                      </div>
                    </div>
                  )}

                  <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginBottom: 10, display: 'block' }}>
                    ⚡ Sistem otomatis mengupdate HPP menu menggunakan metode <strong>Moving Average</strong>.
                  </span>
                </>
              )}

              {/* Note */}
              <div className="form-group mb-3">
                <label className="form-label">Catatan</label>
                <input
                  type="text"
                  className="form-control"
                  value={restockModal.notes}
                  onChange={e => setRestockModal(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Misal: Beli di pasar lokal / Masuk kiriman supplier"
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRestockModal(p => ({ ...p, open: false }))}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={restockModal.submitting}
                  style={{ flex: 2, justifyContent: 'center', fontWeight: 800 }}
                >
                  {restockModal.submitting ? 'Menyimpan...' : 'Simpan Stok Masuk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 1: PEMBAYARAN CERDAS (PAYMENT MODAL)
         ======================================================== */}
      {paymentModalOpen && (
        <div className="modal-overlay" onClick={() => setPaymentModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Banknote size={20} style={{ color: activeOpenBillPayment ? '#fbbf24' : 'var(--accent)' }} />
                {activeOpenBillPayment ? 'Pelunasan Tagihan Terbuka (Open Bill)' : 'Pembayaran Transaksi'}
              </h3>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setPaymentModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* SaaS Coin Status Indicator */}
            <div style={{
              background: isCoinOut
                ? 'rgba(239, 68, 68, 0.15)'
                : isCoinLow
                  ? 'rgba(245, 158, 11, 0.12)'
                  : 'rgba(139, 92, 246, 0.12)',
              border: `1px solid ${isCoinOut ? 'rgba(239, 68, 68, 0.4)' : isCoinLow ? 'rgba(245, 158, 11, 0.35)' : 'rgba(139, 92, 246, 0.25)'}`,
              borderRadius: 12,
              padding: '8px 12px',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Coins size={18} style={{ color: isCoinOut ? '#ef4444' : isCoinLow ? '#f59e0b' : 'var(--accent-bright)', flexShrink: 0 }} />
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: isCoinOut ? '#f87171' : isCoinLow ? '#fbbf24' : '#ffffff' }}>
                    {isCoinOut ? 'Saldo Koin Perusahaan Habis!' : `Sisa Koin Perusahaan: ${coinBalance} koin`}
                  </div>
                  <div style={{ fontSize: 11, color: isCoinOut ? '#fca5a5' : 'var(--text-secondary)' }}>
                    {isCoinOut
                      ? 'Transaksi kasir terkunci hingga koin diisi oleh Pemilik Website.'
                      : `Nota ini memotong ${coinsPerTransaction} koin (${remainingTransactions} nota lagi)`
                    }
                  </div>
                </div>
              </div>
              {isCoinLow && !isCoinOut && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: '#f59e0b', color: '#11162d', whiteSpace: 'nowrap' }}>
                  &le; 20 NOTA
                </span>
              )}
            </div>

            {/* Total Display */}
            <div style={{
              background: activeOpenBillPayment
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.28) 100%)'
                : 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(79, 70, 229, 0.25) 100%)',
              border: activeOpenBillPayment ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: 14,
              padding: '12px 16px',
              textAlign: 'center',
              marginBottom: 12
            }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                {activeOpenBillPayment ? 'Total Tagihan Terbuka' : 'Total Tagihan Pembayaran'}
              </span>
              <div className="mono" style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>
                {rupiah(payableTotal)}
              </div>
              <div style={{ fontSize: 12, color: activeOpenBillPayment ? '#fcd34d' : 'var(--accent-bright)', marginTop: 4 }}>
                {activeOpenBillPayment ? (
                  `No: ${activeOpenBillPayment.order_number}${activeOpenBillPayment.customer_name ? ` · ${activeOpenBillPayment.customer_name}` : ''} (${activeOpenBillPayment.total_items || activeOpenBillPayment.items?.length || 0} item)`
                ) : (
                  `${customerName ? `${customerName} · ` : ''}${cartItemCount} item`
                )}
              </div>

              {/* If discount applied on regular cart */}
              {!activeOpenBillPayment && cartDiscountAmount > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px dashed rgba(255,255,255,0.18)',
                  fontSize: 12
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal: {rupiah(cartGrossSubtotal)}</span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>Diskon: -{rupiah(cartDiscountAmount)}</span>
                </div>
              )}

              {/* If discount applied on open bill */}
              {activeOpenBillPayment && Number(activeOpenBillPayment.discount_amount) > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px dashed rgba(255,255,255,0.18)',
                  fontSize: 12
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal: {rupiah(Number(activeOpenBillPayment.subtotal) || (Number(activeOpenBillPayment.total_price) + Number(activeOpenBillPayment.discount_amount)))}</span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>Diskon ({activeOpenBillPayment.discount_name}): -{rupiah(activeOpenBillPayment.discount_amount)}</span>
                </div>
              )}
            </div>

            {/* Payment Method Pills */}
            <div className="form-group mb-3">
              <label className="form-label">Metode Pembayaran</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {[
                  { key: 'CASH', label: 'Tunai', icon: Banknote },
                  { key: 'QRIS', label: 'QRIS', icon: QrCode },
                  { key: 'TRANSFER', label: 'Transfer', icon: CreditCard },
                  { key: 'GRAB', label: 'GrabFood', icon: ShoppingBag },
                  { key: 'KASBON', label: 'Kasbon', icon: Wallet },
                ].map(m => {
                  const Icon = m.icon;
                  const active = paymentMethod === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m.key);
                        if (m.key === 'KASBON') {
                          setCashReceived('0');
                        } else if (m.key !== 'CASH') {
                          setCashReceived(payableTotal.toString());
                        }
                      }}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        border: '1px solid',
                        borderColor: active ? (m.key === 'GRAB' ? '#00B14F' : 'var(--accent-bright)') : 'var(--border)',
                        background: active ? (m.key === 'GRAB' ? 'linear-gradient(135deg, #00B14F 0%, #00873c 100%)' : 'var(--accent-gradient)') : 'rgba(255,255,255,0.04)',
                        color: '#ffffff',
                        fontWeight: active ? 700 : 500,
                        fontSize: 12,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Icon size={18} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CASH Payment Fields */}
            {paymentMethod === 'CASH' && (
              <div className="form-group mb-3">
                <label className="form-label">Uang Diterima (Rp)</label>
                <input
                  type="number"
                  className="form-control"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  placeholder="0"
                  style={{ fontSize: 16, fontWeight: 700, padding: '10px 14px' }}
                />

                {/* Quick Cash Buttons */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  <button
                    type="button"
                    className="pos-quick-cash-btn"
                    onClick={() => setCashReceived(payableTotal.toString())}
                  >
                    Uang Pas
                  </button>
                  {[20000, 50000, 100000, 200000].map(amt => (
                    amt >= payableTotal && (
                      <button
                        key={amt}
                        type="button"
                        className="pos-quick-cash-btn"
                        onClick={() => setCashReceived(amt.toString())}
                      >
                        {rupiah(amt)}
                      </button>
                    )
                  ))}
                </div>

                {/* Change Calculation */}
                <div style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: isCashSufficient ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                  border: `1px solid ${isCashSufficient ? 'var(--ok-border)' : 'rgba(244, 63, 94, 0.3)'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isCashSufficient ? 'var(--ok)' : 'var(--danger)' }}>
                    {isCashSufficient ? 'Kembalian:' : 'Uang Kurang:'}
                  </span>
                  <span className="mono" style={{ fontSize: 16, fontWeight: 800, color: isCashSufficient ? 'var(--ok)' : 'var(--danger)' }}>
                    {isCashSufficient ? rupiah(changeAmount) : rupiah(payableTotal - parsedCash)}
                  </span>
                </div>
              </div>
            )}

            {/* QRIS Midtrans Dynamic & Static Section */}
            {paymentMethod === 'QRIS' && (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: 18,
                marginBottom: 16,
              }}>
                {/* 1. Active Midtrans Dynamic QRIS Screen */}
                {midtransQris.active && midtransQris.qrImageUrl && !showStaticQrisFallback ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 20,
                      background: midtransQris.isPaid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                      color: midtransQris.isPaid ? '#34d399' : '#38bdf8',
                      fontSize: 11,
                      fontWeight: 700,
                      marginBottom: 12
                    }}>
                      <Zap size={13} />
                      {midtransQris.isPaid ? 'PEMBAYARAN DITERIMA & LUNAS' : `MIDTRANS QRIS DINAMIS (${midtransQris.environment.toUpperCase()})`}
                    </div>

                    {/* QR Code Container */}
                    <div style={{
                      width: 200, height: 200,
                      background: '#ffffff',
                      borderRadius: 12,
                      margin: '0 auto 12px',
                      padding: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                      border: midtransQris.isPaid ? '3px solid #10b981' : '1px solid #e2e8f0',
                      position: 'relative'
                    }}>
                      <img
                        src={midtransQris.qrImageUrl}
                        alt="Midtrans QRIS Code"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                      {midtransQris.isPaid && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(16, 185, 129, 0.9)',
                          borderRadius: 10,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff'
                        }}>
                          <CheckCircle2 size={48} />
                          <span style={{ fontSize: 13, fontWeight: 800, marginTop: 6 }}>LUNAS</span>
                        </div>
                      )}
                    </div>

                    {/* Order & Nominal Info */}
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', marginBottom: 2 }}>
                      {rupiah(midtransQris.grossAmount)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                      Ref Order: <span className="mono" style={{ color: 'var(--text-secondary)' }}>{midtransQris.orderId}</span>
                    </div>

                    {/* Live Status Indicator */}
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: midtransQris.isPaid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.08)',
                      border: `1px solid ${midtransQris.isPaid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.25)'}`,
                      marginBottom: 12,
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      color: midtransQris.isPaid ? '#34d399' : '#e0f2fe'
                    }}>
                      {midtransQris.isPaid ? (
                        <>
                          <CheckCircle2 size={16} />
                          <strong>Pembayaran sukses! Menyelesaikan nota kasir...</strong>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={14} className={midtransQris.checking ? "spin" : ""} style={{ animation: 'spin 2s linear infinite' }} />
                          <span>Menunggu customer scan & bayar... (Cek otomatis aktif)</span>
                        </>
                      )}
                    </div>

                    {/* Action buttons */}
                    {!midtransQris.isPaid && (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => checkMidtransPaymentStatus(midtransQris.orderId)}
                          disabled={midtransQris.checking}
                          style={{ fontSize: 12, padding: '6px 12px' }}
                        >
                          <RefreshCw size={13} className={midtransQris.checking ? "spin" : ""} />
                          {midtransQris.checking ? 'Mengecek...' : 'Cek Status Sekarang'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => generateMidtransQris()}
                          style={{ fontSize: 12, padding: '6px 12px', color: 'var(--text-muted)' }}
                        >
                          Generate Ulang
                        </button>
                      </div>
                    )}
                  </div>
                ) : !showStaticQrisFallback ? (
                  /* 2. Prompt to Generate Midtrans Dynamic QRIS */
                  <div style={{ textAlign: 'center', padding: '6px 4px' }}>
                    <div style={{
                      width: 50, height: 50,
                      borderRadius: '50%',
                      background: 'rgba(56, 189, 248, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 10px',
                      color: '#38bdf8'
                    }}>
                      <QrCode size={26} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>
                      Pembayaran QRIS Dinamis Midtrans
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 auto 16px', maxWidth: 360 }}>
                      Sistem akan membuat kode QR resmi dengan nominal terkunci sebesar <strong>{rupiah(payableTotal)}</strong>. Saat customer scan & bayar, kasir otomatis lunas tanpa perlu klik manual.
                    </p>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => generateMidtransQris()}
                      disabled={midtransQris.loading}
                      style={{
                        width: '100%',
                        padding: '12px 18px',
                        fontSize: 13,
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #0284c7, #8b5cf6)',
                        border: 'none',
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 4px 16px rgba(2, 132, 199, 0.3)'
                      }}
                    >
                      {midtransQris.loading ? (
                        <>
                          <RefreshCw size={16} className="spin" />
                          <span>Menghubungi Midtrans...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={16} />
                          <span>Buat QRIS Midtrans ({rupiah(payableTotal)})</span>
                        </>
                      )}
                    </button>

                    <div style={{ marginTop: 14 }}>
                      <button
                        type="button"
                        onClick={() => setShowStaticQrisFallback(true)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: 11.5,
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Atau gunakan QRIS Statis Toko (Konfirmasi Kasir Manual)
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 3. Static QRIS Fallback (Manual Confirmation) */
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>
                        QRIS STATIS TOKO (MANUAL)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowStaticQrisFallback(false)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#38bdf8',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        ⚡ Pakai Midtrans Dinamis
                      </button>
                    </div>

                    <div style={{
                      width: 140, height: 140,
                      background: '#ffffff',
                      borderRadius: 10,
                      margin: '0 auto 12px',
                      padding: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <QrCode size={110} color="#000000" />
                      <span style={{ fontSize: 9, color: '#000', fontWeight: 800 }}>MOVA QRIS</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Arahkan kamera / e-wallet pelanggan ke kode QR di atas.
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--accent-bright)', marginTop: 4 }}>
                      BCA · Mandiri · GoPay · OVO · DANA · ShopeePay
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* KASBON Info & Customer prompt */}
            {paymentMethod === 'KASBON' && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 12,
                padding: 14,
                marginBottom: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
                  <Wallet size={16} /> Kasbon Customer (Hutang Pelanggan)
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Transaksi akan terhubung ke Buku Kasbon Customer. Sisa tagihan dapat dicicil atau dilunasi kemudian.
                </div>
                <div className="form-group mb-3">
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Nama Pelanggan / Debitur <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Masukkan Nama Pelanggan..."
                    style={{ fontSize: 13, background: 'rgba(0,0,0,0.3)' }}
                    required
                  />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>DP / Uang Tunai Dibayar Sekarang (Opsional)</label>
                  <input
                    type="number"
                    className="form-control mono"
                    value={cashReceived}
                    onChange={e => setCashReceived(e.target.value)}
                    placeholder="0 (Kosongkan/Isi 0 jika Full Kasbon)"
                    style={{ fontSize: 13, background: 'rgba(0,0,0,0.3)' }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Sisa kasbon yang dicatat: <strong style={{ color: '#fbbf24' }}>{rupiah(Math.max(0, payableTotal - (Number(cashReceived) || 0)))}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Transfer / Debit */}
            {paymentMethod === 'TRANSFER' && (
              <div className="form-group mb-3">
                <label className="form-label">No. Referensi / Bank / EDC</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: EDC Mandiri / Trf BCA Ref #12345"
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                />
              </div>
            )}

            {/* Grab / GrabFood */}
            {paymentMethod === 'GRAB' && (
              <div className="form-group mb-3">
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(0, 177, 79, 0.1)',
                  border: '1px solid rgba(0, 177, 79, 0.3)',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: '#00B14F',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: 16
                  }}>
                    G
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#10d97a' }}>Metode Grab / GrabFood</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Pembayaran non-tunai langsung tercatat via pesanan Grab.</div>
                  </div>
                </div>
                <label className="form-label">No. Pesanan Grab / PIN Driver (Opsional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: GF-8291 / GF-A12B"
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                />
              </div>
            )}

            {/* Submit Action */}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPaymentModalOpen(false)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleProcessOrder}
                disabled={submitting || !isCashSufficient || isCoinOut || remainingTransactions < 1}
                style={{ flex: 2, justifyContent: 'center', fontWeight: 800 }}
              >
                {submitting
                  ? 'Memproses...'
                  : (isCoinOut || remainingTransactions < 1)
                    ? 'Koin Habis - Hubungi Owner'
                    : 'Selesaikan & Cetak Struk'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: PRATINJAU & CETAK STRUK THERMAL (58mm/80mm)
         ======================================================== */}
      {receiptModalOpen && completedOrder && (
        <div className="modal-overlay" onClick={() => setReceiptModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 390, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={16} color="var(--ok)" /> Struk Pembayaran
              </span>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setReceiptModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* THERMAL RECEIPT DISPLAY */}
            <div id="printable-thermal-receipt" className="thermal-receipt-preview">
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: '0.05em' }}>
                  MOVA POS
                </div>
                <div style={{ fontSize: 10, opacity: 0.8 }}>
                  Move Your Business Forward
                </div>
                <div style={{ fontSize: 9.5, marginTop: 4 }}>
                  Outlet: {activeShift?.shift?.outlet?.name || 'Cabang Utama'}
                </div>
                {completedOrder.parent_order_number && (
                  <div style={{
                    fontSize: 10,
                    fontWeight: 900,
                    border: '1.5px solid #000',
                    padding: '2px 6px',
                    margin: '4px auto 0',
                    display: 'inline-block',
                    letterSpacing: '0.04em'
                  }}>
                    *** SPLIT BILL {completedOrder.split_type === 'EQUAL' ? `(PATUNGAN ${completedOrder.split_index}/${completedOrder.split_total})` : `(BAGIAN ${completedOrder.split_index})`} ***
                  </div>
                )}
                {completedOrder.is_urgent_note && (
                  <div style={{
                    fontSize: 10,
                    fontWeight: 900,
                    border: '1.5px solid #000',
                    background: '#000',
                    color: '#fff',
                    padding: '2px 6px',
                    margin: '4px auto 0',
                    display: 'inline-block',
                    letterSpacing: '0.04em'
                  }}>
                    *** NOTA URGENT (BAHAN TERGANTUNG) ***
                  </div>
                )}
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

              {/* Order Meta */}
              <div style={{ fontSize: 10.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>No. Nota:</span>
                  <strong>{completedOrder.order_number}</strong>
                </div>
                {completedOrder.parent_order_number && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span>Tagihan Induk:</span>
                    <strong>{completedOrder.parent_order_number}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Waktu:</span>
                  <span>{completedOrder.created_at}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Kasir / Shift:</span>
                  <span>{completedOrder.cashier} ({completedOrder.shift_name})</span>
                </div>
                {completedOrder.customer_name && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Pelanggan:</span>
                    <span>{completedOrder.customer_name}</span>
                  </div>
                )}
                {completedOrder.customer && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000', fontWeight: 800 }}>
                      <span>Status Keanggotaan:</span>
                      <span>MEMBER ({completedOrder.customer.code})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000', fontWeight: 800 }}>
                      <span>Poin Transaksi Ini:</span>
                      <span>+1 Poin</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000', fontWeight: 800 }}>
                      <span>Saldo Poin Member:</span>
                      <span>{Number(completedOrder.customer.total_points ?? 0)} Poin</span>
                    </div>
                  </>
                )}

              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

              {/* Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {completedOrder.items.map((it, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{it.menu_name}</strong>
                      <strong>{rupiah(it.total_price)}</strong>
                    </div>
                    {it.modifiers && it.modifiers.length > 0 && (
                      <div style={{ fontSize: 9.5, color: '#333333', paddingLeft: 6, margin: '1px 0' }}>
                        {it.modifiers.map((m, mIdx) => (
                          <div key={mIdx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>+ {m.name}</span>
                            {Number(m.price) > 0 && <span>+{rupiah(m.price)}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, opacity: 0.8 }}>
                      <span>{it.qty} x {rupiah(it.price)}</span>
                      {it.notes && <span>*{it.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

              {/* Totals & Payment */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {Number(completedOrder.discount_amount) > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
                      <span>Subtotal:</span>
                      <span>{rupiah(completedOrder.subtotal || (Number(completedOrder.total_price) + Number(completedOrder.discount_amount)))}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 700 }}>
                      <span>Diskon ({completedOrder.discount_name || 'Promo'}):</span>
                      <span>-{rupiah(completedOrder.discount_amount)}</span>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 900 }}>
                  <span>TOTAL:</span>
                  <span>{rupiah(completedOrder.total_price)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
                  <span>Metode:</span>
                  <span style={{ fontWeight: 700, color: completedOrder.payment_method === 'GRAB' ? '#00B14F' : 'inherit' }}>
                    {completedOrder.payment_method === 'GRAB' ? 'GRAB / GrabFood' : completedOrder.payment_method}
                  </span>
                </div>
                {completedOrder.payment_method === 'CASH' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
                      <span>Bayar (Tunai):</span>
                      <span>{rupiah(completedOrder.amount_paid)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800 }}>
                      <span>Kembalian:</span>
                      <span>{rupiah(completedOrder.change_amount)}</span>
                    </div>
                  </>
                )}
                {(completedOrder.payment_method === 'KASBON' || completedOrder.payment_method === 'PIUTANG') && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
                      <span>DP / Tunai Dibayar:</span>
                      <span>{Number(completedOrder.amount_paid) > 0 ? rupiah(completedOrder.amount_paid) : 'Rp0 (Full Kasbon)'}</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      fontWeight: 900,
                      marginTop: 2,
                      paddingTop: 2,
                      borderTop: '1px dotted #000'
                    }}>
                      <span>SISA KASBON / HUTANG:</span>
                      <span>{rupiah(Math.max(0, (Number(completedOrder.total_price) || 0) - (Number(completedOrder.amount_paid) || 0)))}</span>
                    </div>
                  </>
                )}
                {completedOrder.remaining_total !== undefined && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 10.5,
                    marginTop: 4,
                    paddingTop: 4,
                    borderTop: '1px dotted #000',
                    fontWeight: 800
                  }}>
                    <span>{completedOrder.is_table_closed ? 'STATUS:' : 'SISA TAGIHAN:'}</span>
                    <span>{completedOrder.is_table_closed ? 'LUNAS (SELESAI)' : rupiah(completedOrder.remaining_total)}</span>
                  </div>
                )}
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }} />

              {/* Footer */}
              <div style={{ textAlign: 'center', fontSize: 9.5, opacity: 0.85, marginTop: 8 }}>
                <div>Terima kasih atas kunjungan Anda!</div>
                <div>Layanan Konsumen: halo@movapos.id</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setReceiptModalOpen(false)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Pesanan Baru
              </button>
              <button
                className="btn btn-primary"
                onClick={handlePrintReceipt}
                style={{ flex: 1, justifyContent: 'center', fontWeight: 800 }}
              >
                <Printer size={15} style={{ marginRight: 6 }} /> Cetak Struk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: DAFTAR TAGIHAN TERBUKA (OPEN BILLS MANAGER)
         ======================================================== */}
      {openBillsModalOpen && (
        <div className="modal-overlay" onClick={() => setOpenBillsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 840, width: '95%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Clock size={20} style={{ color: '#fbbf24' }} />
                  Daftar Tagihan Terbuka (Open Bills)
                  <span style={{
                    fontSize: 12,
                    background: '#f59e0b',
                    color: '#000000',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 12
                  }}>
                    {openBills.length} Tagihan
                  </span>
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  Tagihan pesanan yang sedang berjalan. Belum memotong stok & belum masuk closing kasir.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={fetchOpenBills}
                  title="Segarkan data tagihan"
                >
                  <RefreshCw size={13} style={{ marginRight: 4 }} /> Segarkan
                </button>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => setOpenBillsModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* List / Grid of Open Bills */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
              {openBills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 16px' }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px', color: 'var(--ok)'
                  }}>
                    <CheckCircle2 size={32} />
                  </div>
                  <h4 style={{ color: '#ffffff', fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>
                    Tidak Ada Tagihan Terbuka
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, maxWidth: 360, margin: '0 auto 16px' }}>
                    Semua pesanan saat ini sudah diselesaikan (lunas).
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setOpenBillsModalOpen(false)}
                  >
                    Mulai Pesanan Baru
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
                  {openBills.map(bill => (
                    <div key={bill.order_number} className="pos-openbill-card">
                      <div>
                        {/* Top Meta */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                              color: '#000000',
                              fontWeight: 900,
                              fontSize: 14,
                              padding: '4px 10px',
                              borderRadius: 8,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5
                            }}>
                              <Receipt size={14} />
                              {bill.order_number}
                            </div>
                            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                              {bill.customer_name ? `(${bill.customer_name})` : ''}
                            </span>
                          </div>

                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 11, color: '#fbbf24',
                            background: 'rgba(245, 158, 11, 0.12)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            padding: '3px 8px', borderRadius: 8
                          }}>
                            <Clock size={11} />
                            <span>{bill.duration_mins} menit lalu</span>
                          </div>
                        </div>

                        {/* Order No & Cashier */}
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                          <span>No: <strong className="mono" style={{ color: 'var(--text-secondary)' }}>{bill.order_number}</strong></span>
                          <span>Kasir: {bill.cashier?.name || 'Kasir'}</span>
                        </div>

                        {/* Items list preview */}
                        <div style={{
                          background: 'rgba(0,0,0,0.25)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: 8,
                          padding: '8px 10px',
                          maxHeight: 120,
                          overflowY: 'auto',
                          marginBottom: 10
                        }}>
                          {bill.items?.map((it, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '3px 0', borderBottom: idx < bill.items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                              <div>
                                <strong style={{ color: '#ffffff' }}>{it.qty}x</strong> <span style={{ color: 'var(--text-secondary)' }}>{it.menu_name}</span>
                                {it.modifiers && it.modifiers.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2 }}>
                                    {it.modifiers.map((m, mIdx) => (
                                      <span key={mIdx} style={{ fontSize: 9.5, color: '#c4b5fd', background: 'rgba(139, 92, 246, 0.15)', padding: '0 4px', borderRadius: 3 }}>
                                        {m.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {it.notes && <div style={{ fontSize: 10, color: 'var(--accent-bright)' }}>*{it.notes}</div>}
                              </div>
                              <span className="mono" style={{ color: '#ffffff' }}>{rupiah(it.total_price)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Total Subtotal */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 4 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Total Sementara ({bill.total_items} item):</span>
                          <span className="mono" style={{ fontSize: 17, fontWeight: 900, color: '#fbbf24' }}>
                            {rupiah(bill.total_price)}
                          </span>
                        </div>

                        {/* Equal Split Progress Banner if partially paid */}
                        {bill.paid_splits_count > 0 && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(168, 85, 247, 0.12)',
                            border: '1px solid rgba(168, 85, 247, 0.35)',
                            padding: '6px 10px',
                            borderRadius: 6,
                            marginTop: 6,
                            fontSize: 11
                          }}>
                            <span style={{ color: '#d8b4fe', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Scissors size={11} /> Patungan: {bill.paid_splits_count}/{bill.split_total} Lunas ({rupiah(bill.paid_splits_total)})
                            </span>
                            <span className="mono" style={{ color: '#fbbf24', fontWeight: 800 }}>
                              Sisa: {rupiah(bill.remaining_balance)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => handleStartAppendItems(bill)}
                          style={{ flex: 1, minWidth: 100, fontSize: 11, padding: '5px 8px', justifyContent: 'center' }}
                          title="Tambah menu makanan/minuman baru ke tagihan ini"
                        >
                          <Plus size={12} style={{ marginRight: 3 }} /> Tambah Menu
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleOpenKitchenChit(bill)}
                          style={{ flex: 1, minWidth: 90, fontSize: 11, padding: '5px 8px', justifyContent: 'center' }}
                          title="Cetak tiket dapur untuk koki (tanpa harga)"
                        >
                          <ChefHat size={12} style={{ marginRight: 3 }} /> Tiket Dapur
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleOpenPrebill(bill)}
                          style={{ flex: 1, minWidth: 90, fontSize: 11, padding: '5px 8px', justifyContent: 'center' }}
                          title="Cetak lembar cek tagihan sementara untuk tamu"
                        >
                          <FileText size={12} style={{ marginRight: 3 }} /> Pre-Bill
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleOpenSplitBill(bill)}
                          style={{
                            flex: 1,
                            minWidth: 95,
                            fontSize: 11,
                            padding: '5px 8px',
                            justifyContent: 'center',
                            background: 'rgba(168, 85, 247, 0.16)',
                            border: '1px solid rgba(168, 85, 247, 0.4)',
                            color: '#d8b4fe',
                            fontWeight: 700
                          }}
                          title="Pisah tagihan per menu atau bagi rata (Split Bill)"
                        >
                          <Scissors size={12} style={{ marginRight: 3 }} /> Split Bill
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleOpenPayOpenBill(bill)}
                          style={{ flex: 1.2, minWidth: 110, fontSize: 11.5, fontWeight: 800, padding: '5px 10px', justifyContent: 'center' }}
                          title="Selesaikan pembayaran tagihan ini"
                        >
                          <Banknote size={13} style={{ marginRight: 4 }} /> Bayar Lunas
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => setCancelBillModal({ open: true, bill, reason: '', submitting: false })}
                          style={{ padding: '5px 8px', color: 'var(--danger)', fontSize: 11 }}
                          title="Batalkan / Void tagihan ini"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setOpenBillsModalOpen(false)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 4: CETAK TIKET DAPUR (KITCHEN CHIT)
         ======================================================== */}
      {kitchenChitModal.open && kitchenChitModal.bill && (
        <div className="modal-overlay" onClick={() => setKitchenChitModal({ open: false, bill: null, items: [], isAdditional: false })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ChefHat size={16} style={{ color: '#fbbf24' }} />
                {kitchenChitModal.isAdditional ? 'Tiket Dapur (Menu Tambahan)' : 'Tiket Dapur (Kitchen Chit)'}
              </span>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setKitchenChitModal({ open: false, bill: null, items: [], isAdditional: false })}
              >
                <X size={18} />
              </button>
            </div>

            {/* Printable Kitchen Chit Container */}
            <div id="printable-kitchen-chit" className="thermal-receipt-preview" style={{ background: '#ffffff', color: '#000000' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 8 }}>
                <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: '0.05em' }}>
                  *** TIKET DAPUR / KITCHEN ***
                </div>
                {kitchenChitModal.isAdditional && (
                  <div style={{ fontSize: 11, fontWeight: 800, background: '#000', color: '#fff', padding: '1px 4px', margin: '2px auto', display: 'inline-block' }}>
                    + PESANAN TAMBAHAN +
                  </div>
                )}
                <div style={{ fontSize: 9.5, marginTop: 2 }}>
                  {kitchenChitModal.bill.outlet_name}
                </div>
              </div>

              {/* Huge Table Box */}
              <div style={{
                border: '2px solid #000',
                padding: '6px 8px',
                textAlign: 'center',
                marginBottom: 8,
                borderRadius: 4
              }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  NOMOR ORDER:
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.05em' }}>
                  {kitchenChitModal.bill.order_number}
                </div>
                {kitchenChitModal.bill.customer_name && (
                  <div style={{ fontSize: 10, marginTop: 2 }}>
                    Pelanggan: <strong>{kitchenChitModal.bill.customer_name}</strong>
                  </div>
                )}
              </div>

              {/* Meta */}
              <div style={{ fontSize: 9.5, display: 'flex', justifyContent: 'space-between', marginBottom: 6, borderBottom: '1px dashed #000', paddingBottom: 6 }}>
                <div>No: <strong>{kitchenChitModal.bill.order_number}</strong></div>
                <div>Jam: {kitchenChitModal.bill.created_at}</div>
              </div>

              {/* Items without price */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0' }}>
                {kitchenChitModal.items.map((it, idx) => (
                  <div key={idx} style={{ borderBottom: '1px dotted #ccc', paddingBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 900, minWidth: 26 }}>
                        {it.qty}x
                      </span>
                      <strong style={{ fontSize: 13, flex: 1 }}>
                        {it.menu_name || it.name}
                      </strong>
                    </div>
                    {it.modifiers && it.modifiers.length > 0 && (
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#b45309', paddingLeft: 34, marginTop: 2 }}>
                        {it.modifiers.map((m, mIdx) => (
                          <div key={mIdx}>👉 {m.group_name ? `${m.group_name}: ` : ''}{m.name}</div>
                        ))}
                      </div>
                    )}
                    {it.notes && (
                      <div style={{ fontSize: 10.5, fontStyle: 'italic', paddingLeft: 34, marginTop: 2 }}>
                        * Catatan: {it.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '2px dashed #000', marginTop: 10, paddingTop: 6, textAlign: 'center', fontSize: 9 }}>
                <div>Kasir: {kitchenChitModal.bill.cashier}</div>
                <div style={{ marginTop: 2 }}>Harap sajikan makanan hangat & higienis.</div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setKitchenChitModal({ open: false, bill: null, items: [], isAdditional: false })}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Tutup
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => printElement('printable-kitchen-chit', `Kitchen Chit - ${kitchenChitModal.bill.order_number || ''}`, { isThermal: true, pageSize: '80mm auto' })}
                style={{ flex: 1.5, justifyContent: 'center', fontWeight: 800, background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' }}
              >
                <Printer size={15} style={{ marginRight: 6 }} /> Cetak ke Dapur
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 5: CETAK PRE-BILL (TAGIHAN SEMENTARA)
         ======================================================== */}
      {prebillModal.open && prebillModal.bill && (
        <div className="modal-overlay" onClick={() => setPrebillModal({ open: false, bill: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 390, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={16} style={{ color: 'var(--accent)' }} /> Tagihan Sementara (Pre-Bill)
              </span>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setPrebillModal({ open: false, bill: null })}
              >
                <X size={18} />
              </button>
            </div>

            {/* Printable Pre-bill Container */}
            <div id="printable-prebill" className="thermal-receipt-preview" style={{ background: '#ffffff', color: '#000000' }}>
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>MOVA POS</div>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                  LEMBAR CEK TAGIHAN (PRE-BILL)
                </div>
                <div style={{ fontSize: 9, fontStyle: 'italic', color: '#444' }}>
                  ** BUKAN BUKTI PEMBAYARAN SAH **
                </div>
                <div style={{ fontSize: 9.5, marginTop: 4 }}>
                  {activeShift?.shift?.outlet?.name || prebillModal.bill.outlet_name || 'Outlet Utama'}
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              <div style={{ fontSize: 10.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>No. Order:</span>
                  <strong>{prebillModal.bill.order_number}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Pelanggan:</span>
                  <strong>{prebillModal.bill.customer_name || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Waktu Pesan:</span>
                  <span>{prebillModal.bill.created_at || new Date().toLocaleString('id-ID')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Kasir:</span>
                  <span>{prebillModal.bill.cashier?.name || currentUser.name || 'Kasir'}</span>
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              {/* Items Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, margin: '6px 0' }}>
                {prebillModal.bill.items?.map((it, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{it.menu_name}</strong>
                      <strong>{rupiah(it.total_price)}</strong>
                    </div>
                    {it.modifiers && it.modifiers.length > 0 && (
                      <div style={{ fontSize: 9, color: '#555', paddingLeft: 6, margin: '1px 0' }}>
                        {it.modifiers.map((m, mIdx) => (
                          <div key={mIdx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>+ {m.name}</span>
                            {Number(m.price) > 0 && <span>+{rupiah(m.price)}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, opacity: 0.8 }}>
                      <span>{it.qty} x {rupiah(it.price)}</span>
                      {it.notes && <span>*{it.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 900 }}>
                <span>TOTAL SEMENTARA:</span>
                <span>{rupiah(prebillModal.bill.total_price)}</span>
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              <div style={{ textAlign: 'center', fontSize: 9.5, marginTop: 8 }}>
                <div>Mohon periksa kembali pesanan Anda.</div>
                <div>Silakan selesaikan pembayaran di kasir.</div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPrebillModal({ open: false, bill: null })}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Tutup
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => printElement('printable-prebill', `Pre-Bill - ${prebillModal.bill.order_number || ''}`, { isThermal: true, pageSize: '80mm auto' })}
                style={{ flex: 1.5, justifyContent: 'center', fontWeight: 800 }}
              >
                <Printer size={15} style={{ marginRight: 6 }} /> Cetak Lembar Tagihan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 6: BATALKAN / VOID TAGIHAN TERBUKA
         ======================================================== */}
      {cancelBillModal.open && cancelBillModal.bill && (
        <div className="modal-overlay" onClick={() => setCancelBillModal({ open: false, bill: null, reason: '', submitting: false })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fb7185'
              }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Batalkan Tagihan Terbuka?
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {cancelBillModal.bill.order_number}{cancelBillModal.bill.customer_name ? ` (${cancelBillModal.bill.customer_name})` : ''}
                </span>
              </div>
            </div>

            <p style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 14 }}>
              Apakah Anda yakin ingin membatalkan tagihan sebesar <strong>{rupiah(cancelBillModal.bill.total_price)}</strong>? Tagihan ini akan diberi status <strong>CANCELLED</strong>.
            </p>

            <div className="form-group mb-3">
              <label className="form-label">Alasan Pembatalan (opsional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Misal: Pelanggan batal / Salah input"
                value={cancelBillModal.reason}
                onChange={e => setCancelBillModal(p => ({ ...p, reason: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCancelBillModal({ open: false, bill: null, reason: '', submitting: false })}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmCancelBill}
                disabled={cancelBillModal.submitting}
                style={{ flex: 1.5, justifyContent: 'center', fontWeight: 800 }}
              >
                {cancelBillModal.submitting ? 'Membatalkan...' : 'Ya, Batalkan Tagihan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 7: PILIH VARIAN & MODIFIER (LEVEL, SAUS, TOPPING)
         ======================================================== */}
      {modifierModal.open && modifierModal.menu && (
        <div className="modal-overlay" onClick={() => setModifierModal({ open: false, menu: null, status: null, selectedOptions: {}, qty: 1, notes: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 540, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-bright)', background: 'rgba(139, 92, 246, 0.15)', padding: '2px 8px', borderRadius: 6 }}>
                    {modifierModal.menu.category || 'Menu'}
                  </span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--ok)' }}>
                    Dasar: {rupiah(modifierModal.menu.price)}
                  </span>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} style={{ color: '#a78bfa' }} />
                  {modifierModal.menu.name}
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setModifierModal({ open: false, menu: null, status: null, selectedOptions: {}, qty: 1, notes: '' })}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body: Groups & Options */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(modifierModal.menu.modifier_groups || []).map(group => {
                const isSingleChoice = group.selection_type === 'SINGLE' || group.max_selection === 1;
                const min = group.min_selection ?? 0;
                const isRequired = Boolean(group.is_required) || min >= 1;
                const selectedList = modifierModal.selectedOptions[group.id] || [];

                return (
                  <div key={group.id} style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: 12
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13.5, color: '#ffffff' }}>
                          {group.name}
                        </span>
                        {group.description && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({group.description})</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 10,
                          padding: '2px 7px',
                          borderRadius: 6,
                          fontWeight: 700,
                          background: isSingleChoice ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: isSingleChoice ? 'var(--accent-bright)' : '#34d399',
                          border: isSingleChoice ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)'
                        }}>
                          {isSingleChoice ? 'Pilih 1 Opsi' : 'Pilihan Bebas'}
                        </span>
                        <span style={{
                          fontSize: 10,
                          padding: '2px 7px',
                          borderRadius: 6,
                          fontWeight: 700,
                          background: isRequired && selectedList.length === 0 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.07)',
                          color: isRequired && selectedList.length === 0 ? '#fb7185' : 'var(--text-secondary)',
                          border: isRequired && selectedList.length === 0 ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid var(--border)'
                        }}>
                          {isRequired ? '🔴 Wajib' : '⚪ Opsional'}
                        </span>
                      </div>
                    </div>

                    {/* Options List */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                      {(group.options || []).map(opt => {
                        const isSelected = selectedList.includes(opt.id);
                        const extraPrice = Number(opt.price) || 0;

                        return (
                          <div
                            key={opt.id}
                            onClick={() => handleToggleModifierOption(group, opt)}
                            style={{
                              padding: '9px 12px',
                              borderRadius: 8,
                              cursor: 'pointer',
                              border: isSelected ? '1.5px solid var(--accent-bright)' : '1px solid rgba(255, 255, 255, 0.08)',
                              background: isSelected ? 'rgba(139, 92, 246, 0.18)' : 'rgba(0, 0, 0, 0.25)',
                              transition: 'all 0.15s ease',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 16, height: 16,
                                borderRadius: isSingleChoice ? '50%' : 4,
                                border: isSelected ? '2px solid var(--accent-bright)' : '1.5px solid rgba(255, 255, 255, 0.3)',
                                background: isSelected ? 'var(--accent-bright)' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}>
                                {isSelected && (
                                  <div style={{
                                    width: isSingleChoice ? 6 : 8,
                                    height: isSingleChoice ? 6 : 8,
                                    background: '#000000',
                                    borderRadius: isSingleChoice ? '50%' : 1
                                  }} />
                                )}
                              </div>
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#ffffff' : 'var(--text-secondary)' }}>
                                  {opt.name}
                                </div>
                                {opt.ingredient && (
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                    <span>✂ {num(opt.qty)} {opt.unit || opt.ingredient.unit_pakai} {opt.ingredient.name}</span>
                                    {opt.ingredient.type === 'SEMI_FINISHED' && (
                                      <span style={{ fontSize: 8.5, background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', padding: '0 4px', borderRadius: 3, fontWeight: 700 }}>
                                        Olahan
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <span className="mono" style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: extraPrice > 0 ? '#fbbf24' : 'var(--text-muted)'
                            }}>
                              {extraPrice > 0 ? `+${rupiah(extraPrice)}` : 'Gratis'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Special Instructions / Notes */}
              <div>
                <label className="form-label" style={{ fontSize: 11.5 }}>Catatan Tambahan untuk Koki (Opsional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Misal: Saus dipisah, jangan terlalu asin, dll."
                  value={modifierModal.notes}
                  onChange={e => setModifierModal(p => ({ ...p, notes: e.target.value }))}
                  style={{ fontSize: 12 }}
                />
              </div>
            </div>

            {/* Footer Calculation & Action */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                {/* Quantity Control */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Jumlah:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="pos-qty-btn"
                      onClick={() => setModifierModal(p => ({ ...p, qty: Math.max(1, p.qty - 1) }))}
                    >
                      <Minus size={12} />
                    </button>
                    <span className="mono" style={{ minWidth: 24, textAlign: 'center', fontWeight: 800, fontSize: 14, color: '#ffffff' }}>
                      {modifierModal.qty}
                    </span>
                    <button
                      type="button"
                      className="pos-qty-btn"
                      onClick={() => setModifierModal(p => ({ ...p, qty: p.qty + 1 }))}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>

                {/* Subtotal preview */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Total Menu + Varian:
                  </div>
                  <div className="mono" style={{ fontSize: 17, fontWeight: 900, color: 'var(--ok)' }}>
                    {rupiah(calculateModalTotal())}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModifierModal({ open: false, menu: null, status: null, selectedOptions: {}, qty: 1, notes: '' })}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmModifierModal}
                  style={{ flex: 2, justifyContent: 'center', fontWeight: 800 }}
                >
                  <ShoppingCart size={15} style={{ marginRight: 6 }} /> Masukkan ke Keranjang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: PILIH PROMO & DISKON TERSEDIA
         ======================================================== */}
      {promoModalOpen && (
        <div className="modal-overlay" onClick={() => setPromoModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'rgba(236, 72, 153, 0.15)',
                  border: '1px solid rgba(236, 72, 153, 0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#f472b6'
                }}>
                  <Gift size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Promo & Diskon Tersedia
                  </h3>
                  <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Pilih promo aktif untuk {activeOutlet?.name || 'cabang ini'}
                  </span>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setPromoModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {availableDiscounts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                  <Tag size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>Tidak ada promo aktif</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Gunakan kode voucher khusus atau tambahkan diskon manual kasir.</div>
                </div>
              ) : (
                availableDiscounts.map(disc => {
                  const meetsMin = !disc.min_order_amount || cartGrossSubtotal >= Number(disc.min_order_amount);
                  const isSelected = appliedDiscount?.id === disc.id;
                  const isPointPromo = disc.requires_points > 0;
                  const memberHasEnoughPoints = isPointPromo ? (selectedCustomer && (selectedCustomer.total_points || 0) >= disc.requires_points) : true;
                  const canUse = meetsMin && (!isPointPromo || memberHasEnoughPoints);

                  return (
                    <div
                      key={disc.id}
                      style={{
                        background: isSelected ? 'rgba(16, 185, 129, 0.12)' : (isPointPromo ? 'rgba(245, 158, 11, 0.05)' : 'rgba(255, 255, 255, 0.03)'),
                        border: isSelected ? '1px solid var(--ok)' : (isPointPromo ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border)'),
                        borderRadius: 10,
                        padding: '12px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          {disc.reward_type === 'FREE_MENU' ? (
                            <span style={{
                              background: 'rgba(236, 72, 153, 0.18)',
                              color: '#f472b6',
                              border: '1px solid rgba(236, 72, 153, 0.35)',
                              fontSize: 10.5,
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: 4,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <Gift size={11} /> FREE MENU: {disc.reward_menu?.name || 'Menu'}
                            </span>
                          ) : (
                            <span style={{
                              background: disc.type === 'PERCENTAGE' ? 'rgba(236, 72, 153, 0.18)' : 'rgba(59, 130, 246, 0.18)',
                              color: disc.type === 'PERCENTAGE' ? '#f472b6' : '#60a5fa',
                              border: `1px solid ${disc.type === 'PERCENTAGE' ? 'rgba(236, 72, 153, 0.35)' : 'rgba(59, 130, 246, 0.35)'}`,
                              fontSize: 10.5,
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: 4
                            }}>
                              {disc.type === 'PERCENTAGE' ? `${disc.value ?? disc.rate}% OFF` : `POTONGAN ${rupiah(disc.value ?? disc.rate)}`}
                            </span>
                          )}

                          {isPointPromo && (
                            <span style={{
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: 4,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3
                            }}>
                              <Coins size={10} /> Butuh {disc.requires_points} Poin
                            </span>
                          )}

                          {disc.code && (
                            <span className="mono" style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 4, color: '#fcd34d' }}>
                              {disc.code}
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#ffffff' }}>
                          {disc.name}
                        </div>
                        {disc.description && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {disc.description}
                          </div>
                        )}
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 10 }}>
                          {disc.min_order_amount > 0 && (
                            <span>Min. belanja: {rupiah(disc.min_order_amount)}</span>
                          )}
                          {(Number(disc.max_discount_amount) > 0 || Number(disc.max_discount) > 0) && (
                            <span>Maks. diskon: {rupiah(disc.max_discount_amount || disc.max_discount)}</span>
                          )}
                        </div>
                      </div>

                      <div>
                        {isSelected ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleRemoveDiscount}
                            style={{ fontSize: 11, color: 'var(--danger)' }}
                          >
                            Lepas
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={!canUse}
                            onClick={() => handleSelectPromo(disc)}
                            style={{
                              fontSize: 11,
                              background: isPointPromo ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : undefined,
                              borderColor: isPointPromo ? '#f59e0b' : undefined,
                            }}
                          >
                            {!meetsMin
                              ? 'Min Belum Cukup'
                              : isPointPromo
                                ? (!selectedCustomer ? 'Pilih Member Dulu' : (!memberHasEnoughPoints ? `Poin Kurang (${selectedCustomer.total_points}/${disc.requires_points})` : `Tukar ${disc.requires_points} Poin`))
                                : 'Gunakan'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setPromoModalOpen(false);
                  setCustomDiscountModal({ open: true, type: 'PERCENTAGE', value: '', name: 'Diskon Kasir' });
                }}
              >
                <Percent size={13} style={{ marginRight: 5 }} /> Buat Diskon Manual Kasir
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPromoModalOpen(false)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: DISKON MANUAL KASIR (CUSTOM DISCOUNT)
         ======================================================== */}
      {customDiscountModal.open && (
        <div className="modal-overlay" onClick={() => setCustomDiscountModal(p => ({ ...p, open: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Percent size={18} style={{ color: '#ec4899' }} />
                Diskon Manual Kasir
              </h3>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setCustomDiscountModal(p => ({ ...p, open: false }))}
              >
                <X size={18} />
              </button>
            </div>

            <div className="form-group mb-3">
              <label className="form-label">Keterangan / Alasan Diskon</label>
              <input
                type="text"
                className="form-control"
                placeholder="Contoh: Diskon Karyawan, Tamu VIP, Komplain"
                value={customDiscountModal.name}
                onChange={e => setCustomDiscountModal(p => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="form-group mb-3">
              <label className="form-label">Tipe Diskon</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setCustomDiscountModal(p => ({ ...p, type: 'PERCENTAGE' }))}
                  style={{
                    padding: '8px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 12,
                    border: '1px solid',
                    borderColor: customDiscountModal.type === 'PERCENTAGE' ? 'var(--accent-bright)' : 'var(--border)',
                    background: customDiscountModal.type === 'PERCENTAGE' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.04)',
                    color: '#ffffff'
                  }}
                >
                  Persentase (%)
                </button>
                <button
                  type="button"
                  onClick={() => setCustomDiscountModal(p => ({ ...p, type: 'FIXED' }))}
                  style={{
                    padding: '8px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 12,
                    border: '1px solid',
                    borderColor: customDiscountModal.type === 'FIXED' ? 'var(--accent-bright)' : 'var(--border)',
                    background: customDiscountModal.type === 'FIXED' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.04)',
                    color: '#ffffff'
                  }}
                >
                  Nominal Tunai (Rp)
                </button>
              </div>
            </div>

            <div className="form-group mb-3">
              <label className="form-label">
                {customDiscountModal.type === 'PERCENTAGE' ? 'Besar Diskon (%)' : 'Potongan Harga (Rp)'}
              </label>
              <input
                type="number"
                className="form-control"
                placeholder={customDiscountModal.type === 'PERCENTAGE' ? '10' : '15000'}
                value={customDiscountModal.value}
                onChange={e => setCustomDiscountModal(p => ({ ...p, value: e.target.value }))}
                style={{ fontSize: 16, fontWeight: 700 }}
              />
            </div>

            {/* Live Calculation Preview */}
            {customDiscountModal.value && Number(customDiscountModal.value) > 0 && (
              <div style={{
                background: 'rgba(236, 72, 153, 0.12)',
                border: '1px solid rgba(236, 72, 153, 0.3)',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 16,
                fontSize: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                  <span className="mono">{rupiah(cartGrossSubtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, color: '#f472b6', fontWeight: 600 }}>
                  <span>Potongan:</span>
                  <span className="mono">
                    -{rupiah(customDiscountModal.type === 'PERCENTAGE'
                      ? Math.round((cartGrossSubtotal * Number(customDiscountModal.value)) / 100)
                      : Math.min(Number(customDiscountModal.value), cartGrossSubtotal)
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.15)', paddingTop: 4, fontWeight: 800, color: '#ffffff' }}>
                  <span>Estimasi Bayar:</span>
                  <span className="mono">
                    {rupiah(Math.max(0, cartGrossSubtotal - (customDiscountModal.type === 'PERCENTAGE'
                      ? Math.round((cartGrossSubtotal * Number(customDiscountModal.value)) / 100)
                      : Math.min(Number(customDiscountModal.value), cartGrossSubtotal)
                    )))}
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCustomDiscountModal(p => ({ ...p, open: false }))}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleApplyCustomDiscount}
                disabled={!customDiscountModal.value || Number(customDiscountModal.value) <= 0}
                style={{ flex: 2, justifyContent: 'center', fontWeight: 800 }}
              >
                Terapkan Diskon
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
           MODAL: SPLIT BILL (PISAH TAGIHAN)
         ======================================================== */}
      {splitBillModal.open && splitBillModal.bill && (() => {
        const bill = splitBillModal.bill;
        const billTotal = Number(bill.total_price) || 0;

        // Calculate selected total for BY_ITEM
        let splitItemTotal = 0;
        let splitItemCount = 0;
        (bill.items || []).forEach(it => {
          const q = splitBillModal.selectedItemQtys[it.id] || 0;
          if (q > 0) {
            const unit = (Number(it.subtotal) || Number(it.total_price)) / (Number(it.qty) || 1);
            splitItemTotal += unit * q;
            splitItemCount += q;
          }
        });
        const remainingAfterItemSplit = Math.max(0, billTotal - splitItemTotal);

        // Calculate for EQUAL
        const splits = Math.max(2, Number(splitBillModal.totalSplits) || 2);
        const equalPartAmount = Math.round(billTotal / splits);

        // Current target payment
        const targetAmount = splitBillModal.mode === 'BY_ITEM' ? splitItemTotal : equalPartAmount;
        const parsedCash = parseFloat(splitBillModal.cashReceived) || 0;
        const cashChange = Math.max(0, parsedCash - targetAmount);
        const isCashSufficient = splitBillModal.paymentMethod !== 'CASH' || parsedCash >= targetAmount;
        const canSubmit = splitBillModal.mode === 'BY_ITEM'
          ? (splitItemCount > 0 && isCashSufficient && !splitBillModal.submitting)
          : (targetAmount > 0 && isCashSufficient && !splitBillModal.submitting);

        return (
          <div className="modal-overlay" onClick={() => setSplitBillModal(p => ({ ...p, open: false }))}>
            <div
              className="modal-content"
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: 680,
                width: '95%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                padding: 20,
                gap: 14
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Scissors size={18} style={{ color: '#c084fc' }} />
                    Pisah Tagihan (Split Bill)
                    <span style={{
                      fontSize: 12,
                      background: 'rgba(192, 132, 252, 0.2)',
                      color: '#d8b4fe',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontWeight: 700,
                      border: '1px solid rgba(192, 132, 252, 0.4)'
                    }}>
                      {bill.order_number}
                    </span>
                  </h3>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3 }}>
                    Nota Induk: <span className="mono" style={{ color: '#fff' }}>{bill.order_number}</span> · Total Tagihan: <strong className="mono" style={{ color: '#fbbf24' }}>{rupiah(billTotal)}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  onClick={() => setSplitBillModal(p => ({ ...p, open: false }))}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Mode Toggle Switcher */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                background: 'rgba(255,255,255,0.03)',
                padding: 4,
                borderRadius: 10,
                border: '1px solid var(--border)'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setSplitBillModal(p => ({
                      ...p,
                      mode: 'BY_ITEM',
                      cashReceived: splitItemTotal > 0 ? splitItemTotal.toString() : ''
                    }));
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    border: '1px solid',
                    borderColor: splitBillModal.mode === 'BY_ITEM' ? '#c084fc' : 'transparent',
                    background: splitBillModal.mode === 'BY_ITEM' ? 'rgba(192, 132, 252, 0.2)' : 'transparent',
                    color: splitBillModal.mode === 'BY_ITEM' ? '#ffffff' : 'var(--text-secondary)'
                  }}
                >
                  <Utensils size={14} /> Pisah per Menu (Item Split)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSplitBillModal(p => ({
                      ...p,
                      mode: 'EQUAL',
                      cashReceived: equalPartAmount > 0 ? equalPartAmount.toString() : ''
                    }));
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    border: '1px solid',
                    borderColor: splitBillModal.mode === 'EQUAL' ? '#c084fc' : 'transparent',
                    background: splitBillModal.mode === 'EQUAL' ? 'rgba(192, 132, 252, 0.2)' : 'transparent',
                    color: splitBillModal.mode === 'EQUAL' ? '#ffffff' : 'var(--text-secondary)'
                  }}
                >
                  <Users size={14} /> Bagi Rata Nominal (Patungan)
                </button>
              </div>

              {/* Scrollable Body Content */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 }}>
                {/* ====================================================
                    TAB 1: PISAH PER MENU (BY ITEM)
                   ==================================================== */}
                {splitBillModal.mode === 'BY_ITEM' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        Pilih menu & jumlah porsi yang dibayar oleh tamu ini:
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          onClick={handleSelectAllSplitItems}
                          style={{ fontSize: 11, padding: '2px 8px' }}
                        >
                          Pilih Semua
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-ghost"
                          onClick={handleClearSplitItems}
                          style={{ fontSize: 11, padding: '2px 8px', color: 'var(--danger)' }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    {/* Menu Items Stepper List */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      maxHeight: 210,
                      overflowY: 'auto',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 8,
                      background: 'rgba(0,0,0,0.2)'
                    }}>
                      {(bill.items || []).map(it => {
                        const qSelected = splitBillModal.selectedItemQtys[it.id] || 0;
                        const unitPrice = (Number(it.subtotal) || Number(it.total_price)) / (Number(it.qty) || 1);
                        const isSelected = qSelected > 0;

                        return (
                          <div
                            key={it.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: 6,
                              background: isSelected ? 'rgba(192, 132, 252, 0.1)' : 'rgba(255,255,255,0.02)',
                              border: '1px solid',
                              borderColor: isSelected ? 'rgba(192, 132, 252, 0.35)' : 'rgba(255,255,255,0.05)'
                            }}
                          >
                            <div style={{ flex: 1, paddingRight: 10 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff' }}>
                                {it.menu_name}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                                {rupiah(unitPrice)} / porsi · Tersisa: <strong style={{ color: '#fbbf24' }}>{it.qty} porsi</strong>
                              </div>
                              {it.modifiers && it.modifiers.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                                  {it.modifiers.map((m, mIdx) => (
                                    <span key={mIdx} style={{ fontSize: 9, color: '#c4b5fd', background: 'rgba(139, 92, 246, 0.15)', padding: '0 4px', borderRadius: 3 }}>
                                      {m.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Stepper Controls */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: '1px solid var(--border)' }}>
                                <button
                                  type="button"
                                  onClick={() => handleSplitItemQtyChange(it.id, -1, it.qty)}
                                  disabled={qSelected <= 0}
                                  style={{
                                    width: 28,
                                    height: 28,
                                    border: 'none',
                                    background: 'transparent',
                                    color: qSelected <= 0 ? 'var(--text-muted)' : '#ffffff',
                                    cursor: qSelected <= 0 ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <Minus size={12} />
                                </button>
                                <span style={{ width: 28, textAlign: 'center', fontSize: 12.5, fontWeight: 800, color: isSelected ? '#d8b4fe' : 'var(--text-secondary)' }}>
                                  {qSelected}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleSplitItemQtyChange(it.id, 1, it.qty)}
                                  disabled={qSelected >= it.qty}
                                  style={{
                                    width: 28,
                                    height: 28,
                                    border: 'none',
                                    background: 'transparent',
                                    color: qSelected >= it.qty ? 'var(--text-muted)' : '#ffffff',
                                    cursor: qSelected >= it.qty ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>

                              {/* Row Total */}
                              <div className="mono" style={{ width: 75, textAlign: 'right', fontSize: 12, fontWeight: 700, color: isSelected ? '#ffffff' : 'var(--text-muted)' }}>
                                {rupiah(unitPrice * qSelected)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Split Balance Summary */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                      marginTop: 8,
                      background: 'rgba(255,255,255,0.03)',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)'
                    }}>
                      <div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>Total Bagian Ini ({splitItemCount} item):</div>
                        <div className="mono" style={{ fontSize: 15, fontWeight: 900, color: '#c084fc' }}>
                          {rupiah(splitItemTotal)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>Sisa Tagihan Nanti:</div>
                        <div className="mono" style={{ fontSize: 15, fontWeight: 800, color: remainingAfterItemSplit === 0 ? 'var(--ok)' : '#fbbf24' }}>
                          {remainingAfterItemSplit === 0 ? 'Lunas (Selesai)' : rupiah(remainingAfterItemSplit)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ====================================================
                    TAB 2: BAGI RATA NOMINAL (EQUAL SPLIT)
                   ==================================================== */}
                {splitBillModal.mode === 'EQUAL' && (
                  <div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      Pilih jumlah tamu untuk membagi rata total tagihan <strong className="mono" style={{ color: '#fff' }}>{rupiah(billTotal)}</strong>:
                    </div>

                    {/* Split Count Selector Buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 12 }}>
                      {[2, 3, 4, 5, 6].map(n => {
                        const isLocked = (bill.paid_splits_count || 0) > 0;
                        const isCur = splitBillModal.totalSplits === n;
                        const partVal = Math.round(billTotal / n);
                        return (
                          <button
                            key={n}
                            type="button"
                            disabled={isLocked && !isCur}
                            onClick={() => {
                              if (isLocked) return;
                              setSplitBillModal(p => ({
                                ...p,
                                totalSplits: n,
                                activeEqualIndex: 1,
                                cashReceived: partVal.toString()
                              }));
                            }}
                            style={{
                              padding: '8px 4px',
                              borderRadius: 8,
                              cursor: (isLocked && !isCur) ? 'not-allowed' : 'pointer',
                              textAlign: 'center',
                              opacity: (isLocked && !isCur) ? 0.4 : 1,
                              border: '1px solid',
                              borderColor: isCur ? '#c084fc' : 'var(--border)',
                              background: isCur ? 'rgba(192, 132, 252, 0.2)' : 'rgba(255,255,255,0.03)',
                              color: isCur ? '#ffffff' : 'var(--text-secondary)'
                            }}
                          >
                            <div style={{ fontSize: 12.5, fontWeight: 800 }}>{n} Orang</div>
                            <div className="mono" style={{ fontSize: 9.5, opacity: 0.85, marginTop: 2 }}>
                              @{rupiah(partVal)}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Installment Slot Cards */}
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      {(bill.paid_splits_count || 0) > 0
                        ? `Bagian ${(bill.paid_splits_count)} dari ${splits} sudah lunas. Pilih bagian berikutnya yang dibayar:`
                        : 'Pilih bagian yang dibayar sekarang:'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6 }}>
                      {Array.from({ length: splits }).map((_, idx) => {
                        const splitNum = idx + 1;
                        const isPaidSlot = (bill.paid_split_indices || []).includes(splitNum);
                        const isSelectedSlot = (splitBillModal.activeEqualIndex || 1) === splitNum && !isPaidSlot;
                        return (
                          <div
                            key={splitNum}
                            onClick={() => {
                              if (isPaidSlot) return;
                              setSplitBillModal(p => ({
                                ...p,
                                activeEqualIndex: splitNum,
                                customerName: p.customerName || `Tamu ${splitNum}/${splits}`,
                                cashReceived: equalPartAmount.toString()
                              }));
                            }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 8,
                              cursor: isPaidSlot ? 'default' : 'pointer',
                              border: '1px solid',
                              borderColor: isPaidSlot ? 'rgba(34, 197, 94, 0.4)' : (isSelectedSlot ? '#c084fc' : 'rgba(255,255,255,0.08)'),
                              background: isPaidSlot ? 'rgba(34, 197, 94, 0.12)' : (isSelectedSlot ? 'rgba(192, 132, 252, 0.15)' : 'rgba(255,255,255,0.02)'),
                              opacity: isPaidSlot ? 0.75 : 1,
                              textAlign: 'center'
                            }}
                          >
                            <div style={{ fontSize: 11.5, fontWeight: 800, color: isPaidSlot ? '#86efac' : (isSelectedSlot ? '#d8b4fe' : '#ffffff') }}>
                              Bagian {splitNum} dari {splits}
                            </div>
                            <div className="mono" style={{ fontSize: 13, fontWeight: 900, color: isPaidSlot ? '#86efac' : '#fbbf24', marginTop: 2 }}>
                              {rupiah(equalPartAmount)}
                            </div>
                            <div style={{ fontSize: 9.5, color: isPaidSlot ? '#86efac' : (isSelectedSlot ? '#c084fc' : 'var(--text-muted)'), marginTop: 2, fontWeight: isPaidSlot ? 700 : 400 }}>
                              {isPaidSlot ? '✓ Sudah Lunas' : (isSelectedSlot ? '● Aktif Dibayar' : 'Klik untuk Pilih')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ====================================================
                    SHARED PAYMENT SECTION
                   ==================================================== */}
                <div style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}>
                  {/* Guest Name & Notes in 2 Cols */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group mb-0">
                      <label className="form-label" style={{ fontSize: 11 }}>Nama / Identitas Tamu (Opsional)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder={splitBillModal.mode === 'BY_ITEM' ? "Contoh: Budi (Ayam Geprek)" : `Tamu ${(splitBillModal.activeEqualIndex || 1)}/${splits}`}
                        value={splitBillModal.customerName}
                        onChange={e => setSplitBillModal(p => ({ ...p, customerName: e.target.value }))}
                      />
                    </div>
                    <div className="form-group mb-0">
                      <label className="form-label" style={{ fontSize: 11 }}>Catatan Pembayaran</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Contoh: Split bill pesanan"
                        value={splitBillModal.notes}
                        onChange={e => setSplitBillModal(p => ({ ...p, notes: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Payment Method Pills */}
                  <div>
                    <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>Metode Pembayaran</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                      {[
                        { id: 'CASH', label: 'Tunai', icon: Banknote },
                        { id: 'QRIS', label: 'QRIS', icon: QrCode },
                        { id: 'TRANSFER', label: 'Transfer', icon: ArrowRight },
                        { id: 'DEBIT', label: 'Debit/EDC', icon: CreditCard },
                        { id: 'GRAB', label: 'Grab', icon: ShoppingBag },
                      ].map(m => {
                        const Icon = m.icon;
                        const isCur = splitBillModal.paymentMethod === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSplitBillModal(p => ({
                                ...p,
                                paymentMethod: m.id,
                                cashReceived: m.id === 'CASH' && !p.cashReceived ? targetAmount.toString() : p.cashReceived
                              }));
                            }}
                            style={{
                              padding: '6px 8px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 5,
                              border: '1px solid',
                              borderColor: isCur ? '#c084fc' : 'var(--border)',
                              background: isCur ? 'rgba(192, 132, 252, 0.25)' : 'rgba(255,255,255,0.03)',
                              color: isCur ? '#ffffff' : 'var(--text-secondary)'
                            }}
                          >
                            <Icon size={12} /> {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cash Controls */}
                  {splitBillModal.paymentMethod === 'CASH' && (
                    <div style={{
                      background: 'rgba(0,0,0,0.25)',
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Nominal Tunai Diterima:</span>
                        {targetAmount > 0 && (
                          <button
                            type="button"
                            className="btn btn-xs btn-outline"
                            onClick={() => setSplitBillModal(p => ({ ...p, cashReceived: targetAmount.toString() }))}
                            style={{ fontSize: 10, padding: '1px 6px' }}
                          >
                            Uang Pas ({rupiah(targetAmount)})
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="number"
                          className="form-control"
                          placeholder={targetAmount > 0 ? targetAmount.toString() : "0"}
                          value={splitBillModal.cashReceived}
                          onChange={e => setSplitBillModal(p => ({ ...p, cashReceived: e.target.value }))}
                          style={{ fontSize: 16, fontWeight: 800, flex: 1 }}
                        />
                        <div style={{ textAlign: 'right', minWidth: 120 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Kembalian:</div>
                          <div className="mono" style={{ fontSize: 15, fontWeight: 900, color: cashChange > 0 ? 'var(--ok)' : '#ffffff' }}>
                            {rupiah(cashChange)}
                          </div>
                        </div>
                      </div>

                      {/* Quick Cash Presets */}
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        {[20000, 50000, 100000].map(val => (
                          <button
                            key={val}
                            type="button"
                            className="btn btn-xs btn-secondary"
                            onClick={() => setSplitBillModal(p => ({ ...p, cashReceived: val.toString() }))}
                            style={{ fontSize: 10, padding: '2px 6px' }}
                          >
                            {rupiah(val)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* QRIS Visual Hint */}
                  {splitBillModal.paymentMethod === 'QRIS' && (
                    <div style={{
                      textAlign: 'center',
                      padding: 10,
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 8,
                      border: '1px solid var(--border)'
                    }}>
                      <QrCode size={40} style={{ margin: '0 auto 4px', color: '#c084fc' }} />
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                        Scan QRIS untuk nominal <span className="mono" style={{ color: '#fbbf24' }}>{rupiah(targetAmount)}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                        Konfirmasi pelunasan setelah saldo masuk ke rekening outlet.
                      </div>
                    </div>
                  )}

                  {/* Grab Visual Hint */}
                  {splitBillModal.paymentMethod === 'GRAB' && (
                    <div style={{
                      textAlign: 'center',
                      padding: 10,
                      background: 'rgba(0, 177, 79, 0.08)',
                      borderRadius: 8,
                      border: '1px solid rgba(0, 177, 79, 0.3)'
                    }}>
                      <div style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: '#00B14F',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 900,
                        fontSize: 15,
                        marginBottom: 4
                      }}>
                        G
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#10d97a' }}>
                        Metode Grab / GrabFood untuk nominal <span className="mono" style={{ color: '#fff' }}>{rupiah(targetAmount)}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                        Pembayaran non-tunai langsung via transaksi GrabFood.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Action Buttons */}
              <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSplitBillModal(p => ({ ...p, open: false }))}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Tutup
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (splitBillModal.mode === 'BY_ITEM') {
                      handleSubmitSplitByItem();
                    } else {
                      handleSubmitSplitEvenly(splitBillModal.activeEqualIndex || 1, equalPartAmount);
                    }
                  }}
                  disabled={!canSubmit}
                  style={{
                    flex: 2,
                    justifyContent: 'center',
                    fontWeight: 800,
                    background: canSubmit ? 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)' : undefined,
                    border: 'none'
                  }}
                >
                  <Scissors size={14} style={{ marginRight: 6 }} />
                  {splitBillModal.submitting
                    ? 'Memproses Pembayaran...'
                    : `Bayar Bagian Ini · ${rupiah(targetAmount)}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Daftar Member Baru Cepat (Quick Add Member di POS) */}
      {quickMemberModal.open && (
        <div className="modal-backdrop" onClick={() => setQuickMemberModal(p => ({ ...p, open: false }))}>
          <div
            className="modal-card"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 440, width: '92%' }}
          >
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ padding: 6, borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                  <UserPlus size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                  Daftar Member Baru
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setQuickMemberModal(p => ({ ...p, open: false }))}
                style={{ padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickRegisterMember}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 0' }}>
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: 12, color: '#a7f3d0' }}>
                  Member baru akan otomatis mendapatkan <strong>+1 Poin Loyalitas</strong> setiap kali transaksi lunas.
                </div>

                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                    Nama Lengkap Pelanggan <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Budi Santoso"
                    value={quickMemberModal.name}
                    onChange={e => setQuickMemberModal(p => ({ ...p, name: e.target.value }))}
                    autoFocus
                    required
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                    Nomor WhatsApp / HP <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="Contoh: 081234567890"
                    value={quickMemberModal.phone}
                    onChange={e => setQuickMemberModal(p => ({ ...p, phone: e.target.value }))}
                    required
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setQuickMemberModal(p => ({ ...p, open: false }))}
                  disabled={quickMemberModal.saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={quickMemberModal.saving}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderColor: '#10b981',
                    fontWeight: 700,
                    minWidth: 140
                  }}
                >
                  {quickMemberModal.saving ? 'Mendaftarkan...' : 'Simpan & Pilih Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
