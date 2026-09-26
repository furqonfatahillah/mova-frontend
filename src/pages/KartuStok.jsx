import { useState, useEffect, useMemo } from 'react';
import {
  ScrollText, Plus, Search, Filter, ArrowUpRight, ArrowDownLeft,
  AlertTriangle, Calendar, Printer, X, Check, RefreshCw, Eye, Store,
  ArrowLeft, Building2, ChevronRight, Calculator,
  Truck, PackageCheck, CheckCircle2, ShieldCheck, Clock, ArrowRight, RotateCcw, AlertCircle,
  ShoppingBag, FileSpreadsheet, Trash2
} from 'lucide-react';
import api from '../api/client';
import { rupiah, num, LoadingState, PageHeader, AuditInfo, PeriodPicker, SearchableSelect } from '../components/ui';
import { getTodayStr, getMonthStartStr, getMonthEndStr } from '../utils/date';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import ImportMasterModal from '../components/ImportMasterModal';

const MUTATION_TYPES = [
  { value: 'PURCHASE', label: 'Pembelian (PO)', sign: '+', color: 'var(--ok)', bg: 'rgba(16, 217, 122, 0.12)', border: 'rgba(16, 217, 122, 0.3)' },
  { value: 'SALE_USAGE', label: 'Penjualan (POS)', sign: '-', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)' },
  { value: 'WASTE', label: 'Waste / Rusak', sign: '-', color: 'var(--danger)', bg: 'rgba(255, 77, 109, 0.12)', border: 'rgba(255, 77, 109, 0.3)' },
  { value: 'ADJUSTMENT_IN', label: 'Penyesuaian (+)', sign: '+', color: 'var(--accent-bright)', bg: 'var(--accent-dim)', border: 'var(--border-accent)' },
  { value: 'ADJUSTMENT_OUT', label: 'Penyesuaian (-)', sign: '-', color: 'var(--warn)', bg: 'rgba(245, 166, 35, 0.12)', border: 'rgba(245, 166, 35, 0.3)' },
  { value: 'TRANSFER_IN', label: 'Transfer Masuk', sign: '+', color: 'var(--ok)', bg: 'rgba(16, 217, 122, 0.12)', border: 'rgba(16, 217, 122, 0.3)' },
  { value: 'TRANSFER_OUT', label: 'Transfer Keluar', sign: '-', color: 'var(--warn)', bg: 'rgba(245, 166, 35, 0.12)', border: 'rgba(245, 166, 35, 0.3)' },
  { value: 'PREP_USAGE', label: 'Bahan Olahan Masak (Prep Out)', sign: '-', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)' },
  { value: 'PREP_OUTPUT', label: 'Hasil Olahan (Prep In)', sign: '+', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)' },
];

export const STOCK_CARD_CATEGORIES = [
  { key: 'ALL', label: 'Semua Kategori' },
  { key: 'BAHAN', label: 'Bahan' },
  { key: 'PERLENGKAPAN', label: 'Perlengkapan' },
  { key: 'SEMI_FINISHED', label: 'Bahan Setengah Jadi' },
];

export function getItemClassification(it) {
  if (!it) return 'BAHAN';

  // 1. Bahan Setengah Jadi (Semi-Finished / Batch Prep / Olahan)
  const isSemi =
    it.type === 'SEMI_FINISHED' ||
    it.prep_recipe ||
    Boolean(it.is_semi_finished) ||
    ['olahan', 'prep', 'setengah jadi', 'semi_finished', 'semi-finished', 'semi finished'].some(kw =>
      (it.category || '').toLowerCase().includes(kw) ||
      (it.name || '').toLowerCase().includes(kw)
    );
  if (isSemi) return 'SEMI_FINISHED';

  // 2. Perlengkapan (Packaging, Cup, Pipet, Sedotan, Tissue, Kantong, Kemasan, dll.)
  const cat = (it.category || '').toLowerCase();
  const name = (it.name || '').toLowerCase();
  const code = (it.code || '').toUpperCase();

  const perlengkapanKeywords = [
    'perlengkapan', 'packaging', 'kemasan', 'cup', 'gelas', 'pipet', 'sedotan',
    'tissue', 'tisu', 'sealer', 'seal', 'kantong', 'plastik', 'kresek', 'box',
    'dus', 'paper', 'lid', 'tutup', 'sendok', 'garpu', 'straw', 'pembungkus',
    'mika', 'stiker', 'label'
  ];

  const isPerlengkapan =
    perlengkapanKeywords.some(kw => cat.includes(kw) || name.includes(kw)) ||
    code.startsWith('CUP') ||
    code.startsWith('PIPET') ||
    code.startsWith('TIS') ||
    code.startsWith('LID') ||
    code.startsWith('PKG') ||
    code.startsWith('KMS') ||
    /^C\d+/.test(code);

  if (isPerlengkapan) return 'PERLENGKAPAN';

  // 3. Bahan (Bahan Mentah / Raw Materials)
  return 'BAHAN';
}

export default function KartuStok() {
  const {
    activeOutletId,
    activeOutlet,
    isOwnerBisnis,
    isSuperadminPlatform,
    isPlatformAdmin,
    canSwitchOutlet,
    outlets,
    currentUser,
    userOutletName,
    dateRange: period,
  } = useOutlet();

  // Top level tab: 'stock_card' (Kartu Stok Gudang) | 'in_transit' (Persediaan Dalam Perjalanan)
  const [activeTab, setActiveTab] = useState('stock_card');

  // Resolved warehouse/outlet from global context
  const selectedOutletId = useMemo(() => {
    if (!canSwitchOutlet) {
      return String(currentUser?.outlet_id || activeOutletId || '1');
    }
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      return String(activeOutletId);
    }
    const defaultOut = outlets.find(o => o.is_main) || outlets[0];
    return String(defaultOut?.id || '1');
  }, [canSwitchOutlet, currentUser?.outlet_id, activeOutletId, outlets]);

  // Selected ingredient (when empty, displays items summary list; when set, displays specific stock card)
  const [selectedIngId, setSelectedIngId] = useState('');

  // Summary list state (Level 1)
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [itemCategory, setItemCategory] = useState('ALL');

  // Stock card detail state (Level 2)
  const [ingredients, setIngredients] = useState([]);
  const [stockCard, setStockCard] = useState(null);
  const [cardLoading, setCardLoading] = useState(false);

  // In-Transit Transfers state (Persediaan Dalam Perjalanan)
  const [inTransitList, setInTransitList] = useState([]);
  const [inTransitLoading, setInTransitLoading] = useState(false);
  const [inTransitSearch, setInTransitSearch] = useState('');
  const [detailTransitTransfer, setDetailTransitTransfer] = useState(null);

  // Approval Receive Modal state
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveTargetTransfer, setReceiveTargetTransfer] = useState(null);
  const [receiveItems, setReceiveItems] = useState([]);
  const [receivedNotesInput, setReceivedNotesInput] = useState('Barang diterima dalam kondisi baik.');
  const [receiveDisposition, setReceiveDisposition] = useState('RECORD_AS_WASTE');
  const [receiveReturnReason, setReceiveReturnReason] = useState('Barang rusak saat pengiriman / rusak di jalan');
  const [receiving, setReceiving] = useState(false);

  // Shift Drill-down Modal
  const [shiftModal, setShiftModal] = useState(null);
  const [shiftModalLoading, setShiftModalLoading] = useState(false);
  const [shiftModalData, setShiftModalData] = useState(null);

  // Filters inside detail stock card
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'IN' | 'OUT' | type
  const [searchTerm, setSearchTerm] = useState('');

  // Import Saldo Awal Modal
  const [showImportModal, setShowImportModal] = useState(false);

  // Modal Add Mutation
  const [modalOpen, setModalOpen] = useState(false);
  const [supplierList, setSupplierList] = useState([]);
  const [mutationForm, setMutationForm] = useState({
    outlet_id: '',
    date: getTodayStr(),
    type: 'PURCHASE',
    payment_type: 'CASH', // 'CASH' | 'BANK' | 'QRIS' | 'HUTANG'
    supplier_name: '',
    purchase_no: '',
    due_date: '',
    initial_paid: '',
    payment_method: 'CASH',
    note: '',
    is_in_transit: false,
    transit_source_name: 'Shopee',
    transit_expedition: 'Shopee Xpress',
    transit_tracking_no: '',
    items: [
      {
        ingredient_id: '',
        unit_type: 'BELI',
        qty: '',
        unit_price: '',
        total_price: '',
        note: '',
        waste_reason: 'SPOILED'
      }
    ]
  });
  const [saving, setSaving] = useState(false);

  // Initial fetch ingredients & suppliers for master list
  useEffect(() => {
    fetchIngredients();
    fetchSuppliers();
  }, []);

  async function fetchIngredients() {
    try {
      const { data } = await api.get('/ingredients');
      setIngredients(data);
    } catch {
      toast.error('Gagal memuat master bahan baku');
    }
  }

  async function fetchSuppliers() {
    try {
      const { data } = await api.get('/payables/suppliers');
      setSupplierList(data || []);
    } catch {
      // ignore
    }
  }

  // Fetch summary items & in-transit items when selectedOutletId or period changes
  useEffect(() => {
    if (selectedOutletId) {
      fetchSummary();
      fetchInTransitTransfers();
    }
  }, [selectedOutletId, period]);

  // Fetch specific stock card when selectedIngId, selectedOutletId, or period changes
  useEffect(() => {
    if (selectedIngId && selectedOutletId) {
      fetchStockCard();
    }
  }, [selectedIngId, selectedOutletId, period]);

  // In-Transit Transfers Fetcher (Barang yang menuju ke cabang tujuan terpilih)
  async function fetchInTransitTransfers() {
    if (!selectedOutletId) return;
    setInTransitLoading(true);
    try {
      const { data } = await api.get('/transfers', {
        params: {
          destination_outlet_id: selectedOutletId,
          status: 'IN_TRANSIT,PENDING',
        },
      });
      setInTransitList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Gagal memuat persediaan dalam perjalanan:', err);
    } finally {
      setInTransitLoading(false);
    }
  }

  async function fetchSummary() {
    if (!selectedOutletId) return;
    setSummaryLoading(true);
    try {
      const { data } = await api.get('/stock-card/summary', {
        params: {
          outlet_id: selectedOutletId,
          from: period.from,
          to: period.to,
        },
      });
      setSummaryData(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memuat ringkasan bahan di gudang');
    } finally {
      setSummaryLoading(false);
    }
  }

  async function fetchStockCard() {
    if (!selectedIngId || !selectedOutletId) return;
    setCardLoading(true);
    try {
      const { data } = await api.get('/stock-card', {
        params: {
          ingredient_id: selectedIngId,
          from: period.from,
          to: period.to,
          outlet_id: selectedOutletId,
        },
      });
      setStockCard(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memuat kartu stok bahan');
    } finally {
      setCardLoading(false);
    }
  }

  async function handleOpenShiftDetail(shiftId) {
    if (!shiftId) return;
    setShiftModal(shiftId);
    setShiftModalLoading(true);
    try {
      const { data } = await api.get(`/shifts/${shiftId}/transactions`, {
        params: { ingredient_id: selectedIngId },
      });
      setShiftModalData(data);
    } catch {
      toast.error('Gagal memuat rincian transaksi shift');
      setShiftModal(null);
    } finally {
      setShiftModalLoading(false);
    }
  }

  // Multi-item manipulation & auto-calculation handlers for mutation form
  function handleAddMutationItem() {
    const defaultIng = ingredients[0];
    const targetPrice = defaultIng
      ? (defaultIng.outlet_stocks?.find(os => String(os.outlet_id) === String(selectedOutletId))?.harga ?? defaultIng.current_harga ?? defaultIng.harga ?? '')
      : '';
    setMutationForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ingredient_id: defaultIng?.id || '',
          unit_type: 'BELI',
          qty: '',
          unit_price: targetPrice,
          total_price: '',
          note: '',
          waste_reason: 'SPOILED'
        }
      ]
    }));
  }

  function handleRemoveMutationItem(idx) {
    if (mutationForm.items.length <= 1) {
      toast.error('Minimal harus ada 1 baris bahan.');
      return;
    }
    setMutationForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  }

  function handleMutationItemChange(idx, field, val) {
    setMutationForm(prev => {
      const newItems = [...prev.items];
      const cur = { ...newItems[idx] };

      if (field === 'ingredient_id') {
        const idNum = Number(val);
        const ing = ingredients.find(i => i.id === idNum);
        cur.ingredient_id = idNum;
        const targetPrice = ing
          ? (ing.outlet_stocks?.find(os => String(os.outlet_id) === String(selectedOutletId))?.harga ?? ing.current_harga ?? ing.harga ?? '')
          : '';
        cur.unit_price = targetPrice;
        if (Number(cur.qty) > 0 && targetPrice !== '') {
          cur.total_price = Math.round(Number(cur.qty) * Number(targetPrice));
        }
      } else if (field === 'qty') {
        cur.qty = val;
        const numQ = parseFloat(val) || 0;
        const numUp = parseFloat(cur.unit_price) || 0;
        if (numQ > 0 && cur.unit_price !== '') {
          cur.total_price = Math.round(numQ * numUp);
        } else if (val === '') {
          cur.total_price = '';
        }
      } else if (field === 'unit_price') {
        cur.unit_price = val;
        const numUp = parseFloat(val) || 0;
        const numQ = parseFloat(cur.qty) || 0;
        if (numQ > 0 && val !== '') {
          cur.total_price = Math.round(numQ * numUp);
        } else if (val === '') {
          cur.total_price = '';
        }
      } else if (field === 'total_price') {
        cur.total_price = val;
        const numTot = parseFloat(val) || 0;
        const numQ = parseFloat(cur.qty) || 0;
        if (numQ > 0 && val !== '') {
          cur.unit_price = Number((numTot / numQ).toFixed(2));
        } else if (val === '') {
          cur.unit_price = '';
        }
      } else {
        cur[field] = val;
      }

      newItems[idx] = cur;
      return { ...prev, items: newItems };
    });
  }

  const mutationGrandTotal = useMemo(() => {
    return (mutationForm.items || []).reduce((acc, it) => {
      const tot = Number(it.total_price) || (Number(it.qty) * Number(it.unit_price)) || 0;
      return acc + tot;
    }, 0);
  }, [mutationForm.items]);

  async function handleAddMutation(e) {
    e.preventDefault();
    if (!mutationForm.items || mutationForm.items.length === 0) {
      toast.error('Tambahkan minimal satu bahan.');
      return;
    }

    for (let i = 0; i < mutationForm.items.length; i++) {
      const it = mutationForm.items[i];
      if (!it.ingredient_id) {
        toast.error(`Pilih bahan pada baris #${i + 1}`);
        return;
      }
      if (!it.qty || Number(it.qty) <= 0) {
        toast.error(`Qty pada baris #${i + 1} harus lebih besar dari 0`);
        return;
      }
    }

    if (mutationForm.type === 'PURCHASE' && mutationForm.payment_type === 'HUTANG' && !mutationForm.supplier_name?.trim()) {
      toast.error('Harap masukkan nama supplier untuk transaksi hutang/tempo');
      return;
    }

    setSaving(true);
    try {
      const targetOutlet = mutationForm.outlet_id || selectedOutletId || 1;

      // 1. Kategori PERSIDIAAN DALAM PERJALANAN (Online / Shopee / Ekspedisi)
      if (mutationForm.type === 'PURCHASE' && mutationForm.is_in_transit) {
        const sourceName = (mutationForm.transit_source_name || '').trim() || 'Shopee';
        const courier = (mutationForm.transit_expedition || '').trim() || 'Kurir Ekspedisi';
        const tracking = (mutationForm.transit_tracking_no || '').trim() || null;

        const payload = {
          date: mutationForm.date,
          source_type: 'EXTERNAL',
          source_name: sourceName,
          destination_type: 'OUTLET',
          destination_outlet_id: Number(targetOutlet),
          transfer_type: 'INBOUND',
          status: 'IN_TRANSIT',
          driver_name: courier,
          vehicle_no: tracking,
          payment_type: mutationForm.payment_type || 'CASH',
          payment_method: mutationForm.payment_method || 'CASH',
          supplier_name: mutationForm.payment_type === 'HUTANG' ? mutationForm.supplier_name : sourceName,
          purchase_no: mutationForm.purchase_no || null,
          due_date: mutationForm.payment_type === 'HUTANG' ? (mutationForm.due_date || null) : null,
          initial_paid: mutationForm.payment_type === 'HUTANG' && mutationForm.initial_paid ? Number(mutationForm.initial_paid) : 0,
          notes: mutationForm.note ? `${mutationForm.note} (via ${sourceName})` : `Pembelian online via ${sourceName}`,
          items: mutationForm.items.map(it => {
            const ing = ingredients.find(i => Number(i.id) === Number(it.ingredient_id));
            const factor = Number(ing?.konversi) || 1;
            const isBeli = it.unit_type === 'BELI';
            const inputQ = Number(it.qty);
            const baseQ = isBeli ? Number((inputQ * factor).toFixed(4)) : inputQ;
            const inputUnit = isBeli ? (ing?.unit_beli || 'Kg') : (ing?.unit_pakai || 'gram');
            const baseUnit = ing?.unit_pakai || 'gram';
            return {
              item_type: 'INGREDIENT',
              ingredient_id: Number(it.ingredient_id),
              input_qty: inputQ,
              input_unit: inputUnit,
              qty: baseQ,
              unit: baseUnit,
              unit_price: it.unit_price !== '' ? Number(it.unit_price) : undefined,
              total_price: it.total_price !== '' ? Number(it.total_price) : (Number(it.qty) * Number(it.unit_price) || undefined),
              notes: it.note || (tracking ? `No. Resi: ${tracking}` : null),
            };
          })
        };

        const { data } = await api.post('/transfers', payload);
        toast.success(`Pembelian dari ${sourceName} (${data.transfer_no}) berhasil dicatat ke Persediaan Dalam Perjalanan! Menunggu Approval Receive saat paket tiba.`);
        setModalOpen(false);
        setActiveTab('in_transit');
        fetchInTransitTransfers();
        return;
      }

      // 2. Kategori BUKAN DALAM PERJALANAN (Belanja Langsung / Mutasi Real-time)
      const payload = {
        date: mutationForm.date,
        outlet_id: Number(targetOutlet),
        type: mutationForm.type,
        payment_type: mutationForm.type === 'PURCHASE' ? (mutationForm.payment_type || 'CASH') : undefined,
        supplier_name: (mutationForm.type === 'PURCHASE' && mutationForm.payment_type === 'HUTANG') ? mutationForm.supplier_name : undefined,
        purchase_no: (mutationForm.type === 'PURCHASE' && mutationForm.purchase_no) ? mutationForm.purchase_no : undefined,
        due_date: (mutationForm.type === 'PURCHASE' && mutationForm.payment_type === 'HUTANG') ? (mutationForm.due_date || undefined) : undefined,
        initial_paid: (mutationForm.type === 'PURCHASE' && mutationForm.payment_type === 'HUTANG' && mutationForm.initial_paid !== '') ? Number(mutationForm.initial_paid) : undefined,
        payment_method: (mutationForm.type === 'PURCHASE' && mutationForm.payment_type === 'HUTANG') ? (mutationForm.payment_method || 'CASH') : undefined,
        notes: mutationForm.note || undefined,
        items: mutationForm.items.map(it => ({
          ingredient_id: Number(it.ingredient_id),
          qty: Number(it.qty),
          unit_type: mutationForm.type === 'PURCHASE' ? (it.unit_type || 'BELI') : 'PAKAI',
          unit_price: mutationForm.type === 'PURCHASE' && it.unit_price !== '' ? Number(it.unit_price) : undefined,
          total_price: mutationForm.type === 'PURCHASE' && it.total_price !== '' ? Number(it.total_price) : undefined,
          waste_reason: mutationForm.type === 'WASTE' ? (it.waste_reason || 'SPOILED') : undefined,
          note: it.note || undefined,
        }))
      };

      const res = await api.post('/movements/bulk', payload);
      toast.success(res.data.message || 'Mutasi stok berhasil dicatat!');
      setModalOpen(false);
      fetchSummary();
      fetchSuppliers();
      if (selectedIngId) fetchStockCard();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan mutasi stok');
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function openItemStockCard(ingId) {
    setSelectedIngId(ingId);
  }

  function backToSummaryList() {
    setSelectedIngId('');
    setStockCard(null);
  }

  // In-Transit: Open receive & approval modal
  function openReceiveModal(trf) {
    setReceiveTargetTransfer(trf);
    setReceivedNotesInput('Barang diterima dalam kondisi baik.');
    setReceiveDisposition('RECORD_AS_WASTE');
    setReceiveReturnReason('Barang rusak saat pengiriman / rusak di jalan');

    const mappedItems = (trf.items || []).map(it => {
      const isProd = it.item_type === 'PRODUCT';
      const name = isProd ? (it.menu?.name || it.item_name || 'Produk') : (it.ingredient?.name || it.item_name || 'Bahan');
      const origQty = Number(it.input_qty || it.qty || 0);
      return {
        id: it.id,
        name,
        code: isProd ? (it.menu?.code || 'PRD') : (it.ingredient?.code || 'BB'),
        is_product: isProd,
        unit: it.input_unit || it.unit || (isProd ? 'pcs' : 'satuan'),
        base_unit: it.unit || 'satuan',
        base_qty: Number(it.qty || 0),
        input_qty: origQty,
        received_qty: origQty,
        difference: 0,
        reason: '',
      };
    });
    setReceiveItems(mappedItems);
    setReceiveModalOpen(true);
  }

  function handleReceiveItemQtyChange(idx, val) {
    setReceiveItems(prev => {
      const copy = [...prev];
      const orig = copy[idx].input_qty;
      const numVal = val === '' ? '' : Math.max(0, Number(val));
      const validReceived = typeof numVal === 'number' ? Math.min(orig, numVal) : 0;
      copy[idx] = {
        ...copy[idx],
        received_qty: val === '' ? '' : validReceived,
        difference: Math.max(0, orig - (val === '' ? 0 : validReceived)),
      };
      return copy;
    });
  }

  function handleReceiveItemReasonChange(idx, val) {
    setReceiveItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], reason: val };
      return copy;
    });
  }

  function handleSetAllReceivedFull() {
    setReceiveItems(prev => prev.map(it => ({
      ...it,
      received_qty: it.input_qty,
      difference: 0,
    })));
  }

  async function handleConfirmReceive(e) {
    e?.preventDefault();
    if (!receiveTargetTransfer) return;

    let totalDiff = 0;
    for (const it of receiveItems) {
      const recQ = Number(it.received_qty === '' ? 0 : it.received_qty);
      if (recQ < 0) {
        toast.error(`Jumlah diterima untuk ${it.name} tidak boleh negatif!`);
        return;
      }
      if (recQ > it.input_qty) {
        toast.error(`Jumlah diterima untuk ${it.name} (${recQ}) tidak boleh melebihi jumlah kirim (${it.input_qty})!`);
        return;
      }
      totalDiff += (it.input_qty - recQ);
    }

    setReceiving(true);
    try {
      const payload = {
        received_notes: receivedNotesInput || null,
        return_disposition: totalDiff > 0 ? receiveDisposition : undefined,
        return_reason: totalDiff > 0 ? receiveReturnReason : undefined,
        items: receiveItems.map(it => ({
          id: it.id,
          received_qty: Number(it.received_qty === '' ? 0 : it.received_qty),
          reason: it.reason || undefined,
        })),
      };

      const { data } = await api.post(`/transfers/${receiveTargetTransfer.id}/receive`, payload);

      toast.success(data.message || 'Transfer berhasil di-approve! Stok telah resmi masuk ke kartu stok gudang.');
      setReceiveModalOpen(false);

      // Re-fetch in-transit and summary data immediately
      fetchInTransitTransfers();
      fetchSummary();
      if (selectedIngId) fetchStockCard();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses approval receive');
    } finally {
      setReceiving(false);
    }
  }

  const currentOutlet = outlets.find(o => String(o.id) === String(selectedOutletId)) || activeOutlet || { name: userOutletName || 'Cabang Penempatan' };
  const selectedIng = ingredients.find(i => i.id === Number(selectedIngId));
  const activeModalIng = ingredients.find(i => Number(i.id) === Number(mutationForm.ingredient_id));

  const activeModalIngPrice = useMemo(() => {
    if (!activeModalIng) return 0;
    const targetOutlet = mutationForm.outlet_id || selectedOutletId;
    if (targetOutlet && activeModalIng.outlet_stocks?.length) {
      const match = activeModalIng.outlet_stocks.find(os => String(os.outlet_id) === String(targetOutlet));
      if (match && match.harga) return match.harga;
    }
    return activeModalIng.current_harga ?? activeModalIng.harga ?? 0;
  }, [activeModalIng, mutationForm.outlet_id, selectedOutletId]);

  // Kelompok bahan/perlengkapan untuk SearchableSelect di modal mutasi
  const mutationIngredientGroups = useMemo(() => {
    if (!ingredients || !ingredients.length) return [];

    const perlengkapan = [];
    const olahan = [];
    const mentah = [];

    for (const i of ingredients) {
      const cls = getItemClassification(i);
      const isPerlengkapan = cls === 'PERLENGKAPAN';
      const isOlahan = cls === 'SEMI_FINISHED';

      const item = {
        value: i.id,
        label: i.name,
        code: i.code,
        category: i.category,
        badge: isPerlengkapan ? 'Perlengkapan' : (isOlahan ? 'Setengah Jadi' : 'Bahan'),
        sublabel: `${i.unit_pakai} • Stok: ${num(i.current_stock ?? 0)}`,
        raw: i,
      };

      if (isPerlengkapan) {
        perlengkapan.push(item);
      } else if (isOlahan) {
        olahan.push(item);
      } else {
        mentah.push(item);
      }
    }

    const groups = [];
    if (mentah.length > 0) groups.push({ group: 'Bahan Baku Mentah', items: mentah });
    if (perlengkapan.length > 0) groups.push({ group: 'Perlengkapan & Kemasan (Cup, Pipet, Tissue)', items: perlengkapan });
    if (olahan.length > 0) groups.push({ group: 'Bahan Setengah Jadi (Prep / Olahan)', items: olahan });
    return groups;
  }, [ingredients]);

  // Hitung jumlah item persediaan per klasifikasi (Semua, Bahan, Perlengkapan, Bahan Setengah Jadi)
  const categoryCounts = useMemo(() => {
    const counts = { ALL: 0, BAHAN: 0, PERLENGKAPAN: 0, SEMI_FINISHED: 0 };
    if (!summaryData?.items) return counts;
    counts.ALL = summaryData.items.length;
    for (const it of summaryData.items) {
      const cls = getItemClassification(it);
      if (counts[cls] !== undefined) {
        counts[cls]++;
      }
    }
    return counts;
  }, [summaryData]);

  // Filtered in-transit transfers
  const filteredInTransitList = useMemo(() => {
    if (!inTransitList) return [];
    if (!inTransitSearch.trim()) return inTransitList;
    const q = inTransitSearch.toLowerCase();
    return inTransitList.filter(t => {
      const matchNo = (t.transfer_no || '').toLowerCase().includes(q);
      const matchSrc = (t.source_display_name || t.source_name || t.source_outlet?.name || '').toLowerCase().includes(q);
      const matchDriver = (t.driver_name || '').toLowerCase().includes(q);
      const matchNotes = (t.notes || '').toLowerCase().includes(q);
      const matchItems = (t.items || []).some(it => {
        const name = (it.item_type === 'PRODUCT' ? (it.menu?.name || it.item_name) : (it.ingredient?.name || it.item_name)) || '';
        return name.toLowerCase().includes(q);
      });
      return matchNo || matchSrc || matchDriver || matchNotes || matchItems;
    });
  }, [inTransitList, inTransitSearch]);

  // Filtered summary items (Berdasarkan filter klasifikasi & pencarian teks)
  const filteredSummaryItems = useMemo(() => {
    if (!summaryData?.items) return [];
    return summaryData.items.filter(it => {
      if (itemCategory !== 'ALL') {
        const cls = getItemClassification(it);
        if (cls !== itemCategory) return false;
      }
      if (itemSearch.trim()) {
        const q = itemSearch.toLowerCase();
        const matchName = it.name.toLowerCase().includes(q);
        const matchCode = it.code.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [summaryData, itemCategory, itemSearch]);

  // Filtered detail rows
  const filteredDetailRows = useMemo(() => {
    if (!stockCard?.rows) return [];
    return stockCard.rows.filter(row => {
      // Type filter
      if (typeFilter === 'IN' && row.qty_in <= 0) return false;
      if (typeFilter === 'OUT' && row.qty_out <= 0) return false;
      if (typeFilter !== 'ALL' && typeFilter !== 'IN' && typeFilter !== 'OUT' && row.type !== typeFilter) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchRef = (row.ref || '').toLowerCase().includes(term);
        const matchNote = (row.note || '').toLowerCase().includes(term);
        const matchType = (row.type || '').toLowerCase().includes(term);
        if (!matchRef && !matchNote && !matchType) return false;
      }

      return true;
    });
  }, [stockCard, typeFilter, searchTerm]);

  function getTypeBadge(type) {
    const t = MUTATION_TYPES.find(x => x.value === type) || {
      label: type,
      color: 'var(--text-secondary)',
      bg: 'rgba(255,255,255,0.05)',
      border: 'var(--border)'
    };
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          color: t.color,
          background: t.bg,
          border: `1px solid ${t.border}`,
          whiteSpace: 'nowrap'
        }}
      >
        {t.label}
      </span>
    );
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="Kartu Stok (Stock Card)"
        subtitle={canSwitchOutlet
          ? "Pilih gudang/cabang dan periode tanggal untuk memantau pergerakan stok per bahan baku."
          : "Pantau pergerakan kartu stok dan riwayat mutasi bahan baku pada cabang penempatan Anda."}
        action={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {selectedIngId && (
              <button className="btn btn-secondary" onClick={backToSummaryList} title="Kembali ke Daftar Bahan">
                <ArrowLeft size={14} /> Daftar Bahan
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => setShowImportModal(true)}
              title="Import Saldo Awal Fisik untuk Transisi/Migrasi Aplikasi"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
            >
              <FileSpreadsheet size={15} color="var(--primary)" />
              <span>Import Saldo Awal</span>
            </button>
            <button className="btn btn-secondary" onClick={handlePrint} title="Cetak Laporan">
              <Printer size={14} /> Cetak
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                const targetIngId = selectedIngId || (ingredients[0]?.id || '');
                const targetIng = ingredients.find(i => String(i.id) === String(targetIngId));
                const targetPrice = targetIng
                  ? (targetIng.outlet_stocks?.find(os => String(os.outlet_id) === String(selectedOutletId))?.harga ?? targetIng.current_harga ?? targetIng.harga ?? '')
                  : '';
                setMutationForm({
                  outlet_id: selectedOutletId,
                  date: getTodayStr(),
                  type: 'PURCHASE',
                  payment_type: 'CASH',
                  supplier_name: '',
                  purchase_no: '',
                  due_date: '',
                  initial_paid: '',
                  payment_method: 'CASH',
                  note: '',
                  is_in_transit: false,
                  transit_source_name: 'Shopee',
                  transit_expedition: 'Shopee Xpress',
                  transit_tracking_no: '',
                  items: [
                    {
                      ingredient_id: targetIngId,
                      unit_type: 'BELI',
                      unit_price: targetPrice,
                      total_price: '',
                      qty: '',
                      note: '',
                      waste_reason: 'SPOILED',
                    }
                  ]
                });
                setModalOpen(true);
              }}
            >
              <Plus size={15} /> Catat Mutasi
            </button>
          </div>
        }
      />

      {/* Tab Navigation: Kartu Stok vs Persediaan Dalam Perjalanan */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <button
          className={`btn ${activeTab === 'stock_card' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('stock_card')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 18px',
            fontWeight: 700,
            fontSize: 13.5,
            borderRadius: 8,
            border: activeTab === 'stock_card' ? '1px solid var(--accent-bright)' : '1px solid var(--border)',
            background: activeTab === 'stock_card' ? 'var(--accent)' : 'rgba(255,255,255,0.02)',
            color: activeTab === 'stock_card' ? '#ffffff' : 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          <ScrollText size={16} />
          <span>Kartu Stok Gudang</span>
        </button>

        <button
          className={`btn ${activeTab === 'in_transit' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => {
            setActiveTab('in_transit');
            fetchInTransitTransfers();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 18px',
            fontWeight: 700,
            fontSize: 13.5,
            borderRadius: 8,
            border: activeTab === 'in_transit' ? '1px solid #f59e0b' : '1px solid var(--border)',
            background: activeTab === 'in_transit' ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' : 'rgba(255,255,255,0.02)',
            color: activeTab === 'in_transit' ? '#ffffff' : 'var(--text-secondary)',
            position: 'relative',
            cursor: 'pointer'
          }}
        >
          <Truck size={16} />
          <span>Persediaan Dalam Perjalanan</span>
          {inTransitList.length > 0 && (
            <span style={{
              background: activeTab === 'in_transit' ? '#ffffff' : '#f59e0b',
              color: activeTab === 'in_transit' ? '#92400e' : '#000000',
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 800,
              marginLeft: 4,
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              {inTransitList.length} Dalam Transit
            </span>
          )}
        </button>

        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            fetchSummary();
            fetchInTransitTransfers();
            if (selectedIngId) fetchStockCard();
          }}
          disabled={summaryLoading || cardLoading || inTransitLoading}
          title="Refresh Data"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
        >
          <RefreshCw size={13} className={summaryLoading || cardLoading || inTransitLoading ? 'spin' : ''} />
          Segarkan
        </button>
      </div>

      {activeTab === 'stock_card' && (
        <>
          {/* ========================================================================= */}
          {/* VIEW 1: DAFTAR BAHAN BAKU DI GUDANG INI (Tampil Setelah Pilih Gudang)      */}
          {/* ========================================================================= */}
          {!selectedIngId && (
        <div className="fade-in">
          {/* Warehouse KPI Summary Cards */}
          <div className="stat-cards mb-5">
            <div className="stat-card accent">
              <div className="stat-label">Gudang / Cabang Aktif</div>
              <div className="stat-value accent" style={{ fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentOutlet?.name || 'Gudang Pusat'}
              </div>
              <div className="stat-sub">{currentOutlet?.is_main ? 'Gudang Distribusi Pusat' : 'Outlet Operasional Cabang'}</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Total Jenis Bahan Terdata</div>
              <div className="stat-value">
                {summaryData?.summary?.total_items || 0} <span style={{ fontSize: 14, fontWeight: 500 }}>Bahan</span>
              </div>
              <div className="stat-sub">Di gudang ini untuk periode terpilih</div>
            </div>

            <div className={`stat-card ${(summaryData?.summary?.total_low_stock || 0) > 0 ? 'danger' : 'ok'}`}>
              <div className="stat-label">Bahan Kritis / Menipis</div>
              <div className={`stat-value ${(summaryData?.summary?.total_low_stock || 0) > 0 ? 'danger' : 'ok'}`}>
                {summaryData?.summary?.total_low_stock || 0} <span style={{ fontSize: 14, fontWeight: 500 }}>Bahan</span>
              </div>
              <div className="stat-sub">
                {(summaryData?.summary?.total_low_stock || 0) > 0 ? '⚠️ Memerlukan restock segera' : '✓ Seluruh stok di atas batas minimum'}
              </div>
            </div>

            <div className="stat-card ok">
              <div className="stat-label">Total Nilai Persediaan</div>
              <div className="stat-value ok">
                {rupiah(summaryData?.summary?.total_nilai || 0)}
              </div>
              <div className="stat-sub">Estimasi nilai stok akhir berjalan</div>
            </div>
          </div>

          {/* Items Filter & Search Bar */}
          <div className="card mb-4" style={{ padding: '12px 18px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STOCK_CARD_CATEGORIES.map(cat => {
                  const count = categoryCounts[cat.key] ?? 0;
                  const isActive = itemCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setItemCategory(cat.key)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        fontWeight: isActive ? 600 : 500,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{cat.label}</span>
                      <span
                        style={{
                          fontSize: 10.5,
                          padding: '1px 6px',
                          borderRadius: 10,
                          background: isActive ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)',
                          color: isActive ? '#ffffff' : 'var(--text-secondary)',
                          fontWeight: 700,
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search Box */}
              <div style={{ position: 'relative', width: 260 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Cari nama atau kode bahan..."
                  style={{ paddingLeft: 30, paddingRight: 10, fontSize: 12.5, height: 34 }}
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                />
                {itemSearch && (
                  <button
                    onClick={() => setItemSearch('')}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Items Summary Table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {itemCategory === 'PERLENGKAPAN' ? 'Daftar Perlengkapan & Packaging' :
                   itemCategory === 'SEMI_FINISHED' ? 'Daftar Bahan Setengah Jadi (Prep / Olahan)' :
                   itemCategory === 'BAHAN' ? 'Daftar Bahan Baku Mentah' :
                   'Daftar Persediaan & Bahan'} di {currentOutlet?.name || 'Gudang'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Periode: <strong>{period.from}</strong> s/d <strong>{period.to}</strong> · Klik nama item untuk membuka kartu stok & buku besar mutasi lengkap.
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Menampilkan <strong>{filteredSummaryItems.length}</strong> item
              </span>
            </div>

            {summaryLoading ? (
              <LoadingState />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 45 }} className="center">No</th>
                      <th style={{ width: 95 }}>Kode</th>
                      <th style={{ minWidth: 180 }}>Nama Bahan Baku</th>
                      <th style={{ width: 100 }}>Kategori</th>
                      <th className="right" style={{ width: 110 }}>Stok Awal ({period.from})</th>
                      <th className="right" style={{ width: 95 }}>Masuk (+)</th>
                      <th className="right" style={{ width: 95 }}>Keluar (-)</th>
                      <th className="right" style={{ width: 115 }}>Stok Akhir ({period.to})</th>
                      <th style={{ width: 75 }}>Satuan</th>
                      <th className="right" style={{ width: 120 }}>Harga Satuan</th>
                      <th className="right" style={{ width: 135 }}>Nilai Stok (Rp)</th>
                      <th className="right" style={{ width: 85 }}>Stok Min</th>
                      <th className="center" style={{ width: 90 }}>Status</th>
                      <th className="center" style={{ width: 115 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSummaryItems.length === 0 ? (
                      <tr>
                        <td colSpan={14} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                          Tidak ada item yang sesuai dengan filter atau kriteria pencarian.
                        </td>
                      </tr>
                    ) : (
                      filteredSummaryItems.map((it, idx) => {
                        const statusClass = it.is_empty ? 'pill-danger' : (it.is_low ? 'pill-warn' : 'pill-ok');
                        const statusLabel = it.is_empty ? 'HABIS' : (it.is_low ? 'MENIPIS' : 'AMAN');

                        return (
                          <tr
                            key={it.id}
                            style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
                            onClick={() => openItemStockCard(it.id)}
                            className="table-row-hover"
                          >
                            <td className="mono center" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {idx + 1}
                            </td>
                            <td className="mono" style={{ fontWeight: 600, color: 'var(--accent-bright)' }}>
                              {it.code}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: '#ffffff' }}>
                                  {it.name}
                                </span>
                                <ArrowUpRight size={13} color="var(--accent-bright)" style={{ opacity: 0.7 }} />
                              </div>
                            </td>
                            <td>
                              {(() => {
                                const cls = getItemClassification(it);
                                const isPkg = cls === 'PERLENGKAPAN';
                                const isSemi = cls === 'SEMI_FINISHED';
                                const badgeStyle = isPkg
                                  ? { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)', label: 'Perlengkapan' }
                                  : isSemi
                                  ? { bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15', border: 'rgba(234, 179, 8, 0.3)', label: 'Setengah Jadi' }
                                  : { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)', label: 'Bahan' };

                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <span
                                      style={{
                                        fontSize: 10.5,
                                        padding: '2px 7px',
                                        borderRadius: 4,
                                        display: 'inline-block',
                                        width: 'fit-content',
                                        fontWeight: 600,
                                        background: badgeStyle.bg,
                                        color: badgeStyle.text,
                                        border: `1px solid ${badgeStyle.border}`,
                                      }}
                                    >
                                      {badgeStyle.label}
                                    </span>
                                    {it.category && !['Perlengkapan', 'Bahan', 'Setengah Jadi', 'Raw', 'SEMI_FINISHED'].includes(it.category) && (
                                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                        {it.category}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="mono right" style={{ color: 'var(--text-secondary)' }}>
                              {num(it.stok_awal)}
                            </td>
                            <td className="mono right" style={{ color: it.total_masuk > 0 ? 'var(--ok)' : 'var(--text-muted)', fontWeight: it.total_masuk > 0 ? 600 : 400 }}>
                              {it.total_masuk > 0 ? `+${num(it.total_masuk)}` : '0'}
                            </td>
                            <td className="mono right" style={{ color: it.total_keluar > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: it.total_keluar > 0 ? 600 : 400 }}>
                              {it.total_keluar > 0 ? `-${num(it.total_keluar)}` : '0'}
                            </td>
                            <td className="mono right" style={{ fontWeight: 700, fontSize: 13.5, color: it.stok_akhir < 0 ? 'var(--danger)' : (it.is_low ? 'var(--warn)' : 'var(--accent-bright)') }}>
                              {num(it.stok_akhir)}
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                              {it.unit_pakai}
                            </td>
                            {/* Harga Satuan */}
                            <td className="mono right" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              {rupiah(it.harga_satuan || (it.harga_beli && it.konversi ? it.harga_beli / it.konversi : 0))}
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 2 }}>/{it.unit_pakai}</span>
                            </td>
                            {/* Nilai Stok (Rp) */}
                            <td className="mono right" style={{ fontWeight: 800, fontSize: 13, color: '#34d399' }} title="Estimasi Nilai Persediaan Stok Akhir">
                              {rupiah(it.nilai_stok || 0)}
                            </td>
                            <td className="mono right" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                              {num(it.stok_min)}
                            </td>
                            <td className="center">
                              <span className={`pill ${statusClass}`} style={{ fontSize: 10 }}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="center" onClick={e => e.stopPropagation()}>
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ padding: '4px 10px', fontSize: 11.5 }}
                                onClick={() => openItemStockCard(it.id)}
                              >
                                <Eye size={12} /> Buka Kartu
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {filteredSummaryItems.length > 0 && (
                    <tfoot>
                      <tr style={{ background: 'rgba(255, 255, 255, 0.03)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                        <td colSpan={4} style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                          TOTAL KESELURUHAN:
                        </td>
                        <td className="mono right" style={{ color: 'var(--text-secondary)' }}>
                          {num(filteredSummaryItems.reduce((acc, x) => acc + Number(x.stok_awal || 0), 0))}
                        </td>
                        <td className="mono right" style={{ color: 'var(--ok)' }}>
                          +{num(filteredSummaryItems.reduce((acc, x) => acc + Number(x.total_masuk || 0), 0))}
                        </td>
                        <td className="mono right" style={{ color: 'var(--danger)' }}>
                          -{num(filteredSummaryItems.reduce((acc, x) => acc + Number(x.total_keluar || 0), 0))}
                        </td>
                        <td className="mono right" style={{ color: 'var(--accent-bright)' }}>
                          {num(filteredSummaryItems.reduce((acc, x) => acc + Number(x.stok_akhir || 0), 0))}
                        </td>
                        <td></td>
                        <td></td>
                        <td className="mono right" style={{ color: '#34d399', fontSize: 13.5, fontWeight: 800 }}>
                          {rupiah(filteredSummaryItems.reduce((acc, x) => acc + Number(x.nilai_stok || 0), 0))}
                        </td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: KARTU STOK DETAIL ITEM TERPILIH DI GUDANG & RANGE TANGGAL TERSEBUT */}
      {/* ========================================================================= */}
      {selectedIngId && (
        <div className="fade-in">
          {/* Breadcrumb & Quick Switch Bar */}
          <div className="card mb-4" style={{ padding: '12px 18px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid var(--border-accent)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="btn btn-secondary btn-sm" onClick={backToSummaryList} style={{ padding: '5px 10px' }}>
                  <ArrowLeft size={13} /> Kembali ke Daftar Bahan
                </button>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{currentOutlet?.name || 'Gudang'}</span>
                  <ChevronRight size={13} color="var(--text-muted)" />
                  <strong style={{ color: 'var(--accent-bright)' }}>{selectedIng?.name || 'Bahan'}</strong>
                  {selectedIng && (() => {
                    const cls = getItemClassification(selectedIng);
                    const isPkg = cls === 'PERLENGKAPAN';
                    const isSemi = cls === 'SEMI_FINISHED';
                    const badgeStyle = isPkg
                      ? { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)', label: 'Perlengkapan' }
                      : isSemi
                      ? { bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15', border: 'rgba(234, 179, 8, 0.3)', label: 'Setengah Jadi' }
                      : { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)', label: 'Bahan' };
                    return (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontWeight: 600,
                          background: badgeStyle.bg,
                          color: badgeStyle.text,
                          border: `1px solid ${badgeStyle.border}`,
                        }}
                      >
                        {badgeStyle.label}
                      </span>
                    );
                  })()}
                  <ChevronRight size={13} color="var(--text-muted)" />
                  <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>{period.from} s/d {period.to}</span>
                </div>
              </div>

              {/* Quick Ingredient Switcher Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Pindah Bahan:</span>
                <select
                  className="form-control"
                  style={{ fontSize: 12, padding: '4px 8px', maxWidth: 220 }}
                  value={selectedIngId}
                  onChange={e => setSelectedIngId(Number(e.target.value))}
                >
                  {ingredients.map(i => {
                    const cls = getItemClassification(i);
                    const tag = cls === 'PERLENGKAPAN' ? '[Perlengkapan] ' : (cls === 'SEMI_FINISHED' ? '[Setengah Jadi] ' : '');
                    return (
                      <option key={i.id} value={i.id} style={{ background: '#11162d', color: '#ffffff' }}>
                        {tag}{i.code} - {i.name}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Summary KPI Cards for Selected Ingredient */}
          {cardLoading ? (
            <div className="mb-4"><LoadingState /></div>
          ) : stockCard && (
            <div className="stat-cards mb-5">
              {/* Saldo Awal */}
              <div className="stat-card accent">
                <div className="stat-label">Saldo Awal Periode</div>
                <div className="stat-value accent">
                  {num(stockCard.stok_awal)} <span style={{ fontSize: 14, fontWeight: 500 }}>{stockCard.ingredient.unit_pakai}</span>
                </div>
                <div className="stat-sub">Per tanggal {stockCard.period.from} di {stockCard.outlet_name}</div>
              </div>

              {/* Total Masuk */}
              <div className="stat-card ok">
                <div className="stat-label">Total Masuk (+)</div>
                <div className="stat-value ok">
                  +{num(stockCard.total_masuk)} <span style={{ fontSize: 14, fontWeight: 500 }}>{stockCard.ingredient.unit_pakai}</span>
                </div>
                <div className="stat-sub">Pembelian: +{num(stockCard.total_pembelian)}</div>
              </div>

              {/* Total Keluar */}
              <div className="stat-card danger">
                <div className="stat-label">Total Keluar (-)</div>
                <div className="stat-value danger">
                  -{num(stockCard.total_keluar)} <span style={{ fontSize: 14, fontWeight: 500 }}>{stockCard.ingredient.unit_pakai}</span>
                </div>
                <div className="stat-sub">POS: {num(stockCard.total_penjualan)} · Waste: {num(stockCard.total_waste)}</div>
              </div>

              {/* Saldo Akhir */}
              <div className={`stat-card ${stockCard.is_below_min ? 'danger' : 'ok'}`}>
                <div className="stat-label">Saldo Akhir Berjalan</div>
                <div className={`stat-value ${stockCard.is_below_min ? 'danger' : 'ok'}`}>
                  {num(stockCard.stok_akhir)} <span style={{ fontSize: 14, fontWeight: 500 }}>{stockCard.ingredient.unit_pakai}</span>
                </div>
                <div style={{ marginTop: 4, fontWeight: 700, color: '#34d399', fontSize: 13.5 }}>
                  ≈ {rupiah(stockCard.nilai_stok_akhir || 0)}
                </div>
                <div className="stat-sub" style={{ color: stockCard.is_below_min ? 'var(--danger)' : 'var(--ok)' }}>
                  {stockCard.is_below_min ? '⚠️ Di bawah batas stok minimum' : '✓ Stok aman di atas batas minimum'}
                </div>
              </div>
            </div>
          )}

          {/* Detail Filter & Search Bar */}
          <div className="card mb-4" style={{ padding: '12px 18px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Quick Filter Buttons */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  className={`btn btn-sm ${typeFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setTypeFilter('ALL')}
                >
                  Semua ({stockCard?.rows?.length || 0})
                </button>
                <button
                  className={`btn btn-sm ${typeFilter === 'IN' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setTypeFilter('IN')}
                  style={{ color: typeFilter !== 'IN' ? 'var(--ok)' : undefined }}
                >
                  <ArrowUpRight size={12} /> Masuk Saja
                </button>
                <button
                  className={`btn btn-sm ${typeFilter === 'OUT' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setTypeFilter('OUT')}
                  style={{ color: typeFilter !== 'OUT' ? 'var(--danger)' : undefined }}
                >
                  <ArrowDownLeft size={12} /> Keluar Saja
                </button>
                <button
                  className={`btn btn-sm ${typeFilter === 'PURCHASE' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setTypeFilter('PURCHASE')}
                >
                  Pembelian
                </button>
                <button
                  className={`btn btn-sm ${typeFilter === 'SALE_USAGE' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setTypeFilter('SALE_USAGE')}
                >
                  Penjualan POS
                </button>
                <button
                  className={`btn btn-sm ${typeFilter === 'WASTE' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setTypeFilter('WASTE')}
                >
                  Waste
                </button>
                <button
                  className={`btn btn-sm ${typeFilter === 'TRANSFER_IN' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setTypeFilter('TRANSFER_IN')}
                >
                  Transfer Masuk
                </button>
                <button
                  className={`btn btn-sm ${typeFilter === 'TRANSFER_OUT' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setTypeFilter('TRANSFER_OUT')}
                >
                  Transfer Keluar
                </button>
              </div>

              {/* Search Box */}
              <div style={{ position: 'relative', width: 240 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Cari ref / catatan..."
                  style={{ paddingLeft: 30, paddingRight: 10, fontSize: 12, height: 32 }}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Kartu Stok Ledger Table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  Buku Besar Mutasi — {selectedIng?.name} ({selectedIng?.code})
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Gudang: <strong style={{ color: 'var(--accent-bright)' }}>{stockCard?.outlet_name || currentOutlet?.name}</strong> ·
                  Satuan Pakai: <span className="mono" style={{ color: 'var(--accent)' }}>{selectedIng?.unit_pakai}</span> ·
                  Konversi: 1 {selectedIng?.unit_beli} = {num(selectedIng?.konversi)} {selectedIng?.unit_pakai} ·
                  Harga Beli: <span className="mono" style={{ color: 'var(--text-primary)' }}>{rupiah(selectedIng?.harga)}/{selectedIng?.unit_beli}</span> ·
                  Harga Pakai: <span className="mono" style={{ color: 'var(--accent-bright)', fontWeight: 600 }}>{rupiah(selectedIng?.harga / (selectedIng?.konversi || 1))}/{selectedIng?.unit_pakai}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Menampilkan <strong>{filteredDetailRows.length}</strong> transaksi mutasi
                </span>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>No</th>
                    <th style={{ width: 105 }}>Tanggal</th>
                    <th style={{ width: 130 }}>Gudang / Cabang</th>
                    <th style={{ width: 140 }}>No. Referensi</th>
                    <th>Keterangan / Aktivitas</th>
                    <th style={{ width: 135 }}>Tipe Mutasi</th>
                    <th className="right" style={{ width: 110 }}>Masuk (+)</th>
                    <th className="right" style={{ width: 110 }}>Keluar (-)</th>
                    <th className="right" style={{ width: 130 }}>Saldo Berjalan</th>
                    <th className="right" style={{ width: 135 }}>Nilai Saldo (Rp)</th>
                    <th style={{ minWidth: 140 }}>Petugas / Audit</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row Opening Balance */}
                  <tr style={{ background: 'var(--accent-dim)', fontStyle: 'italic' }}>
                    <td className="mono center">—</td>
                    <td className="mono" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{period.from}</td>
                    <td><span style={{ fontSize: 11, color: 'var(--accent-bright)', fontWeight: 600 }}>{stockCard?.outlet_name || currentOutlet?.name}</span></td>
                    <td className="mono" style={{ color: 'var(--text-muted)' }}>SALDO-AWAL</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent)' }}>Saldo Awal per {period.from}</td>
                    <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saldo Awal</span></td>
                    <td className="mono right">—</td>
                    <td className="mono right">—</td>
                    <td className="mono right" style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 13.5 }}>
                      {num(stockCard?.stok_awal)} {selectedIng?.unit_pakai}
                    </td>
                    <td className="mono right" style={{ fontWeight: 700, color: '#34d399', fontSize: 12.5 }}>
                      {rupiah(Math.max(0, stockCard?.stok_awal || 0) * (selectedIng?.harga / (selectedIng?.konversi || 1)))}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>Sistem</td>
                  </tr>

                  {/* Mutation Rows */}
                  {filteredDetailRows.length > 0 ? (
                    filteredDetailRows.map((row, idx) => (
                      <tr key={row.id || idx}>
                        <td className="mono center" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {idx + 1}
                        </td>
                        <td className="mono" style={{ fontSize: 12 }}>
                          {row.date}
                        </td>
                        <td>
                          <span style={{ fontSize: 11, color: '#c7d2fe', fontWeight: 600 }}>
                            {row.outlet_name || 'Outlet'}
                          </span>
                        </td>
                        <td className="mono" style={{ fontSize: 12 }}>
                          {row.shift_id ? (
                            <button
                              className="btn btn-sm"
                              style={{
                                padding: '3px 8px',
                                fontSize: 11,
                                color: 'var(--accent-bright)',
                                border: '1px solid var(--border-accent)',
                                background: 'var(--accent-dim)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                cursor: 'pointer'
                              }}
                              onClick={() => handleOpenShiftDetail(row.shift_id)}
                              title="Klik untuk melihat rincian transaksi POS di shift ini"
                            >
                              <Eye size={12} /> {row.ref}
                            </button>
                          ) : (
                            <span style={{ color: 'var(--accent-bright)' }}>{row.ref}</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12.5 }}>
                          {row.note || '—'}
                        </td>
                        <td>
                          {getTypeBadge(row.type)}
                        </td>
                        <td className="mono right" style={{ color: row.qty_in > 0 ? 'var(--ok)' : 'var(--text-muted)', fontWeight: row.qty_in > 0 ? 600 : 400 }}>
                          {row.qty_in > 0 ? `+${num(row.qty_in)}` : '—'}
                        </td>
                        <td className="mono right" style={{ color: row.qty_out > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: row.qty_out > 0 ? 600 : 400 }}>
                          {row.qty_out > 0 ? `-${num(row.qty_out)}` : '—'}
                        </td>
                        <td className="mono right" style={{ fontWeight: 700, fontSize: 13, color: row.balance < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                          {num(row.balance)} {selectedIng?.unit_pakai}
                        </td>
                        <td className="mono right" style={{ fontWeight: 700, fontSize: 12.5, color: row.balance < 0 ? 'var(--danger)' : '#34d399' }}>
                          {rupiah(Math.max(0, row.balance || 0) * (selectedIng?.harga / (selectedIng?.konversi || 1)))}
                          {row.unit_price ? (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
                              PO: @{rupiah(row.unit_price)}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <AuditInfo
                            createdAt={row.created_at}
                            createdBy={row.created_by_name || row.user}
                            updatedAt={row.changed_at}
                            updatedBy={row.changed_by_name}
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                        Tidak ada transaksi mutasi stok yang sesuai dengan filter.
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* Table Footer with Totals */}
                {stockCard && (
                  <tfoot>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', fontWeight: 700, borderTop: '2px solid var(--border-strong)' }}>
                      <td colSpan={6} style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11, color: 'var(--text-secondary)' }}>
                        Total Periode ({period.from} s/d {period.to})
                      </td>
                      <td className="mono right" style={{ color: 'var(--ok)', fontSize: 13 }}>
                        +{num(stockCard.total_masuk)}
                      </td>
                      <td className="mono right" style={{ color: 'var(--danger)', fontSize: 13 }}>
                        -{num(stockCard.total_keluar)}
                      </td>
                      <td className="mono right" style={{ color: stockCard.stok_akhir < 0 ? 'var(--danger)' : 'var(--accent)', fontSize: 14 }}>
                        {num(stockCard.stok_akhir)} {selectedIng?.unit_pakai}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )}

      {/* ========================================================================= */}
      {/* VIEW 3: PERSEDIAAN DALAM PERJALANAN (STOCK IN TRANSIT & APPROVAL RECEIVE) */}
      {/* ========================================================================= */}
      {activeTab === 'in_transit' && (
        <div className="fade-in">
          {/* Warehouse & Transit KPI Cards */}
          <div className="stat-cards mb-5">
            <div className="stat-card accent">
              <div className="stat-label">Cabang Penerima (Tujuan)</div>
              <div className="stat-value accent" style={{ fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentOutlet?.name || 'Gudang Pusat'}
              </div>
              <div className="stat-sub">Stok akan ditambahkan ke gudang ini</div>
            </div>

            <div className="stat-card" style={{ borderColor: inTransitList.length > 0 ? 'rgba(245, 166, 35, 0.4)' : undefined }}>
              <div className="stat-label">Surat Jalan Dalam Perjalanan</div>
              <div className="stat-value" style={{ color: inTransitList.length > 0 ? '#f59e0b' : 'inherit' }}>
                {inTransitList.length} <span style={{ fontSize: 14, fontWeight: 500 }}>Pengiriman</span>
              </div>
              <div className="stat-sub">
                {inTransitList.length > 0 ? '⚠️ Menunggu approval / konfirmasi terima' : '✓ Tidak ada antrean pengiriman aktif'}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Total Jenis Barang / Bahan</div>
              <div className="stat-value">
                {inTransitList.reduce((acc, t) => acc + (t.items?.length || 0), 0)} <span style={{ fontSize: 14, fontWeight: 500 }}>Item</span>
              </div>
              <div className="stat-sub">Total rincian barang yang sedang diangkut</div>
            </div>

            <div className="stat-card ok">
              <div className="stat-label">Status Pembukuan Kartu Stok</div>
              <div className="stat-value ok" style={{ fontSize: 16 }}>
                Belum Dibukukan
              </div>
              <div className="stat-sub">Masuk kartu stok saat Approval Receive</div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="card mb-4" style={{ padding: '12px 18px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ position: 'relative', width: 340 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: 30, fontSize: 12.5 }}
                  placeholder="Cari No. Surat Jalan, pengirim, driver, bahan..."
                  value={inTransitSearch}
                  onChange={e => setInTransitSearch(e.target.value)}
                />
                {inTransitSearch && (
                  <button
                    onClick={() => setInTransitSearch('')}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Menampilkan <strong>{filteredInTransitList.length}</strong> pengiriman
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={fetchInTransitTransfers}
                  disabled={inTransitLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw size={13} className={inTransitLoading ? 'spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>

          {/* In-Transit List / Cards */}
          {inTransitLoading ? (
            <div className="card mb-4" style={{ padding: 40 }}>
              <LoadingState text="Memeriksa persediaan dalam perjalanan..." />
            </div>
          ) : filteredInTransitList.length === 0 ? (
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(245, 166, 35, 0.12)',
                border: '1px solid rgba(245, 166, 35, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: '#f59e0b'
              }}>
                <Truck size={32} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}>
                {inTransitSearch ? 'Tidak Ditemukan Pengiriman Terkait' : 'Tidak Ada Persediaan Dalam Perjalanan'}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 20px', lineHeight: 1.5 }}>
                {inTransitSearch
                  ? `Tidak ada pengiriman dalam perjalanan yang cocok dengan kata kunci "${inTransitSearch}".`
                  : `Semua pengiriman yang ditujukan ke cabang ${currentOutlet?.name} telah selesai diterima dan sudah resmi dibukukan ke dalam Kartu Stok.`}
              </p>
              <button className="btn btn-secondary" onClick={() => setActiveTab('stock_card')}>
                <ScrollText size={15} /> Buka Kartu Stok Gudang
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap" style={{ margin: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 145 }}>No. Dokumen</th>
                      <th style={{ width: 100 }}>Tanggal</th>
                      <th style={{ minWidth: 150 }}>Sumber / Pengirim</th>
                      <th style={{ minWidth: 160 }}>Cabang Penerima</th>
                      <th style={{ minWidth: 200 }}>Rincian Barang</th>
                      <th style={{ minWidth: 140 }}>Kurir / No. Resi</th>
                      <th style={{ width: 170 }} className="center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInTransitList.map(trf => {
                      const totalItemCount = trf.items?.length || 0;
                      const isOnlinePurchase = trf.source_type === 'EXTERNAL' || trf.transfer_type === 'INBOUND';
                      const sourceName = trf.source_display_name || trf.source_outlet?.name || trf.source_name || (isOnlinePurchase ? 'Shopee' : 'Cabang Asal');
                      const destName = trf.destination_display_name || trf.destination_outlet?.name || trf.destination_name || currentOutlet?.name || 'Cabang Tujuan';
                      const summaryItems = (trf.items || []).map(it => {
                        const isProd = it.item_type === 'PRODUCT';
                        const name = isProd ? (it.menu?.name || it.item_name || 'Produk Retail') : (it.ingredient?.name || it.item_name || 'Bahan Baku');
                        return `${name} (${num(it.input_qty || it.qty)} ${it.input_unit || it.unit || 'satuan'})`;
                      }).join(', ');

                      return (
                        <tr
                          key={trf.id}
                          onClick={() => setDetailTransitTransfer(trf)}
                          style={{ cursor: 'pointer' }}
                          title="Klik untuk melihat detail lengkap pengiriman"
                        >
                          <td className="mono" style={{ fontWeight: 700, color: '#fbbf24' }}>
                            {trf.transfer_no}
                          </td>
                          <td className="mono" style={{ fontSize: 12.5 }}>
                            {trf.date}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontWeight: 600, color: '#ffffff' }}>{sourceName}</span>
                              <span style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: isOnlinePurchase ? '#ff6b4a' : '#93c5fd'
                              }}>
                                {isOnlinePurchase ? 'Belanja Online' : 'Transfer Antar-Cabang'}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 500, color: '#e2e8f0' }}>{destName}</span>
                          </td>
                          <td>
                            <div style={{ fontSize: 12, maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <strong style={{ color: 'var(--accent-bright)' }}>{totalItemCount} item:</strong>{' '}
                              <span style={{ color: 'var(--text-secondary)' }}>{summaryItems}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            <div>{trf.driver_name || (isOnlinePurchase ? 'Ekspedisi Online' : 'Kurir Internal')}</div>
                            {trf.vehicle_no && (
                              <span className="mono" style={{ fontSize: 11, color: '#fbbf24' }}>
                                [{trf.vehicle_no}]
                              </span>
                            )}
                          </td>
                          <td className="center" onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setDetailTransitTransfer(trf)}
                                title="Lihat Detail Lengkap"
                                style={{ padding: '5px 10px', fontSize: 12 }}
                              >
                                <Eye size={13} style={{ marginRight: 4 }} />
                                Detail
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => openReceiveModal(trf)}
                                title="Approval Terima & Masuk Stok"
                                style={{
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                  padding: '5px 12px',
                                  fontSize: 12,
                                  borderRadius: 6,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5
                                }}
                              >
                                <PackageCheck size={14} />
                                Receive
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DETAIL PENGIRIMAN PERSEDIAAN DALAM PERJALANAN                       */}
      {/* ========================================================================= */}
      {detailTransitTransfer && (() => {
        const trf = detailTransitTransfer;
        const isOnlinePurchase = trf.source_type === 'EXTERNAL' || trf.transfer_type === 'INBOUND';
        const sourceName = trf.source_display_name || trf.source_outlet?.name || trf.source_name || (isOnlinePurchase ? 'Shopee' : 'Cabang Asal');
        const destName = trf.destination_display_name || trf.destination_outlet?.name || trf.destination_name || currentOutlet?.name || 'Cabang Tujuan';

        return (
          <div className="modal-overlay" onClick={() => setDetailTransitTransfer(null)}>
            <div
              className="modal-content"
              style={{ maxWidth: 760, width: '92%' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="mono" style={{ fontSize: 16, fontWeight: 800, color: '#fbbf24' }}>
                    {trf.transfer_no}
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: isOnlinePurchase ? 'rgba(238, 77, 45, 0.18)' : 'rgba(245, 158, 11, 0.18)',
                    color: isOnlinePurchase ? '#ff6b4a' : '#f59e0b',
                    border: `1px solid ${isOnlinePurchase ? 'rgba(238, 77, 45, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
                  }}>
                    {isOnlinePurchase ? `Belanja Online: ${sourceName}` : 'Dalam Perjalanan'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Tanggal Pesan/Kirim: <strong style={{ color: '#ffffff' }}>{trf.date}</strong>
                  </span>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => setDetailTransitTransfer(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {/* Logistics Route Strip */}
                <div style={{
                  padding: '12px 14px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: 8,
                  border: '1px solid var(--border-soft)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 12,
                  fontSize: 12,
                  marginBottom: 16
                }}>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      {isOnlinePurchase ? 'Sumber / Marketplace' : 'Cabang Pengirim (Asal)'}
                    </div>
                    <div style={{ fontWeight: 700, color: isOnlinePurchase ? '#fbbf24' : '#93c5fd', marginTop: 2 }}>
                      {sourceName}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Cabang Penerima (Tujuan)</div>
                    <div style={{ fontWeight: 700, color: '#c084fc', marginTop: 2 }}>
                      {destName}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      {isOnlinePurchase ? 'Kurir & No. Resi' : 'Kurir / Supir'}
                    </div>
                    <div style={{ fontWeight: 600, color: '#ffffff', marginTop: 2 }}>
                      {trf.driver_name || (isOnlinePurchase ? 'Ekspedisi Online' : 'Kurir Internal')}
                      {trf.vehicle_no && (
                        <span className="mono" style={{ color: '#fbbf24', marginLeft: 6 }}>
                          [{trf.vehicle_no}]
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Dibuat Oleh</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {trf.creator?.name || 'Staf Cabang'}
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#ffffff' }}>
                    Daftar Barang & Bahan Dikirim ({trf.items?.length || 0} item):
                  </div>
                  <div className="table-wrap" style={{ border: '1px solid var(--border-soft)', borderRadius: 8 }}>
                    <table style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: 45, textAlign: 'center' }}>No</th>
                          <th style={{ width: 80 }}>Tipe</th>
                          <th style={{ width: 90 }}>Kode</th>
                          <th>Nama Barang / Bahan</th>
                          <th className="right" style={{ width: 110 }}>Qty Dikirim</th>
                          <th style={{ width: 80 }}>Satuan</th>
                          <th className="right" style={{ width: 140 }}>Konversi Masuk</th>
                          <th>Catatan Item</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(trf.items || []).map((it, idx) => {
                          const isProd = it.item_type === 'PRODUCT';
                          const name = isProd ? (it.menu?.name || it.item_name || 'Produk Retail') : (it.ingredient?.name || it.item_name || 'Bahan Baku');
                          const code = isProd ? (it.menu?.code || 'PRD') : (it.ingredient?.code || 'BB');
                          const hasConv = !isProd && it.input_unit && it.unit && it.input_unit.toLowerCase() !== it.unit.toLowerCase();

                          return (
                            <tr key={it.id || idx}>
                              <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                              <td>
                                <span style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  background: isProd ? 'rgba(56, 189, 248, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                                  color: isProd ? '#38bdf8' : 'var(--accent-bright)'
                                }}>
                                  {isProd ? 'Retail' : 'Bahan'}
                                </span>
                              </td>
                              <td className="mono" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{code}</td>
                              <td style={{ fontWeight: 700, color: '#ffffff' }}>{name}</td>
                              <td className="mono right" style={{ fontWeight: 700, color: '#38bdf8', fontSize: 13 }}>
                                {num(it.input_qty || it.qty)}
                              </td>
                              <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                                {it.input_unit || it.unit || 'satuan'}
                              </td>
                              <td className="mono right" style={{ color: hasConv ? 'var(--accent-bright)' : 'var(--text-muted)', fontSize: 12 }}>
                                {hasConv ? `${num(it.qty)} ${it.unit}` : '—'}
                              </td>
                              <td style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                                {it.total_price ? (
                                  <span>
                                    <strong style={{ color: '#34d399' }}>{rupiah(it.total_price)}</strong>
                                    {it.unit_price ? <span style={{ color: '#94a3b8', marginLeft: 4 }}>({rupiah(it.unit_price)}/{it.input_unit || it.unit})</span> : ''}
                                    {it.notes ? <span style={{ marginLeft: 6 }}>• {it.notes}</span> : ''}
                                  </span>
                                ) : (
                                  it.notes || '—'
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sender Notes */}
                {trf.notes && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-soft)',
                    fontSize: 12,
                    color: 'var(--text-secondary)'
                  }}>
                    <strong>Catatan Pengirim:</strong> {trf.notes}
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDetailTransitTransfer(null)}
                >
                  Tutup
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setDetailTransitTransfer(null);
                    openReceiveModal(trf);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 800,
                    padding: '8px 18px',
                    fontSize: 13,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    boxShadow: '0 3px 12px rgba(16, 185, 129, 0.35)',
                    cursor: 'pointer'
                  }}
                >
                  <PackageCheck size={16} />
                  <span>Approval Receive (Terima & Masuk Stok)</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL APPROVAL RECEIVE: VERIFIKASI & MASUKKAN STOK KE GUDANG               */}
      {/* ========================================================================= */}
      {receiveModalOpen && receiveTargetTransfer && (() => {
        const totalDiff = receiveItems.reduce((acc, it) => acc + (Number(it.difference) || 0), 0);
        const totalReceived = receiveItems.reduce((acc, it) => acc + Number(it.received_qty === '' ? 0 : it.received_qty), 0);

        return (
          <div className="modal-overlay" onClick={() => !receiving && setReceiveModalOpen(false)}>
            <div
              className="modal-content"
              style={{ maxWidth: 740, width: '100%', maxHeight: '92vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="modal-header">
                <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={20} color="var(--ok)" />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>
                      Approval Penerimaan Barang (Masuk ke Kartu Stok)
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 500, marginTop: 2 }}>
                      No. Surat Jalan: <span className="mono" style={{ color: 'var(--accent-bright)', fontWeight: 700 }}>{receiveTargetTransfer.transfer_no}</span>
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: 4 }}
                  onClick={() => !receiving && setReceiveModalOpen(false)}
                  disabled={receiving}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleConfirmReceive}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Logistics Summary Info */}
                  <div style={{
                    padding: '10px 14px',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: 8,
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: 10,
                    fontSize: 12
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Asal (Pengirim): </span>
                      <strong style={{ color: '#93c5fd' }}>{receiveTargetTransfer.source_display_name || receiveTargetTransfer.source_outlet?.name || receiveTargetTransfer.source_name || 'Cabang Asal'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Tujuan (Penerima): </span>
                      <strong style={{ color: '#c084fc' }}>{receiveTargetTransfer.destination_display_name || receiveTargetTransfer.destination_outlet?.name || currentOutlet?.name || 'Cabang Tujuan'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Driver: </span>
                      <strong style={{ color: '#ffffff' }}>{receiveTargetTransfer.driver_name || 'Kurir'}</strong>
                    </div>
                  </div>

                  {/* Informational Guidance */}
                  <div style={{
                    padding: '10px 14px',
                    background: 'rgba(16, 217, 122, 0.08)',
                    border: '1px solid rgba(16, 217, 122, 0.25)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#86efac',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={16} color="var(--ok)" />
                      <span>Verifikasi fisik barang yang tiba. Setelah di-approve, mutasi <strong>TRANSFER_IN</strong> resmi masuk ke Kartu Stok.</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={handleSetAllReceivedFull}
                      style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(16, 217, 122, 0.2)', color: '#ffffff', fontWeight: 700 }}
                    >
                      ✓ Set Semua Diterima Penuh
                    </button>
                  </div>

                  {/* Items Verification List */}
                  <div className="card" style={{ background: 'var(--bg-main)', padding: 12, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: '#ffffff' }}>
                      Rincian Barang yang Diterima:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {receiveItems.map((it, idx) => {
                        const isDiff = it.difference > 0;
                        return (
                          <div
                            key={it.id}
                            style={{
                              padding: '10px 12px',
                              background: isDiff ? 'rgba(239, 68, 68, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                              border: isDiff ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-soft)',
                              borderRadius: 8
                            }}
                          >
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 150px', gap: 10, alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: '#ffffff' }}>
                                  {it.name}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                  Kode: <span className="mono">{it.code}</span> · Dikirim: <strong className="mono" style={{ color: '#38bdf8' }}>{num(it.input_qty)} {it.unit}</strong>
                                </div>
                              </div>

                              <div>
                                <label style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                                  Fisik Diterima ({it.unit})
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  max={it.input_qty}
                                  className="form-control mono right"
                                  style={{
                                    padding: '5px 8px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    borderColor: isDiff ? 'var(--danger)' : 'var(--ok)',
                                    color: isDiff ? '#fb7185' : 'var(--ok)'
                                  }}
                                  value={it.received_qty}
                                  onChange={e => handleReceiveItemQtyChange(idx, e.target.value)}
                                  required
                                />
                              </div>

                              <div style={{ textAlign: 'right' }}>
                                {isDiff ? (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '3px 8px',
                                    background: 'rgba(239, 68, 68, 0.18)',
                                    color: '#fb7185',
                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 700
                                  }}>
                                    ⚠️ Selisih: -{num(it.difference)} {it.unit}
                                  </span>
                                ) : (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '3px 8px',
                                    background: 'rgba(16, 217, 122, 0.15)',
                                    color: 'var(--ok)',
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 700
                                  }}>
                                    ✓ Lengkap
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Reason for difference */}
                            {isDiff && (
                              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed rgba(239, 68, 68, 0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 11, color: '#fca5a5', whiteSpace: 'nowrap' }}>
                                  Alasan item ini kurang / rusak:
                                </span>
                                <input
                                  type="text"
                                  className="form-control"
                                  style={{ padding: '3px 8px', fontSize: 11.5 }}
                                  placeholder="Contoh: 2 pcs kemasan pecah saat pengiriman"
                                  value={it.reason || ''}
                                  onChange={e => handleReceiveItemReasonChange(idx, e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary & Difference Disposition */}
                  {totalDiff > 0 ? (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: 8,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fb7185', fontWeight: 700, fontSize: 12.5 }}>
                        <AlertTriangle size={15} />
                        <span>Terdapat Selisih Fisik: {num(totalDiff)} Satuan Barang</span>
                      </div>
                      <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                        Stok yang masuk ke Kartu Stok cabang ini hanya sejumlah fisik yang diterima (<strong>{num(totalReceived)} unit</strong>). Tentukan perlakuan untuk selisih {num(totalDiff)} unit tersebut:
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            padding: '8px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            background: receiveDisposition === 'RECORD_AS_WASTE' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${receiveDisposition === 'RECORD_AS_WASTE' ? 'rgba(239, 68, 68, 0.5)' : 'var(--border-soft)'}`
                          }}
                        >
                          <input
                            type="radio"
                            name="receive_disposition"
                            value="RECORD_AS_WASTE"
                            checked={receiveDisposition === 'RECORD_AS_WASTE'}
                            onChange={() => setReceiveDisposition('RECORD_AS_WASTE')}
                            style={{ marginTop: 2 }}
                          />
                          <div>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#ffffff' }}>💥 Catat Sebagai Waste</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                              Barang rusak/pecah di jalan. Masuk ke Waste Tracking & HPP kerugian.
                            </div>
                          </div>
                        </label>

                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            padding: '8px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            background: receiveDisposition === 'RETURN_TO_SOURCE' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${receiveDisposition === 'RETURN_TO_SOURCE' ? 'rgba(99, 102, 241, 0.5)' : 'var(--border-soft)'}`
                          }}
                        >
                          <input
                            type="radio"
                            name="receive_disposition"
                            value="RETURN_TO_SOURCE"
                            checked={receiveDisposition === 'RETURN_TO_SOURCE'}
                            onChange={() => setReceiveDisposition('RETURN_TO_SOURCE')}
                            style={{ marginTop: 2 }}
                          />
                          <div>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#ffffff' }}>↩️ Kembalikan ke Cabang Asal</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                              Barang ditolak kurir. Stok cabang pengirim akan dipulihkan.
                            </div>
                          </div>
                        </label>
                      </div>

                      <div className="form-group mb-0">
                        <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Alasan Utama Selisih / Kerusakan</label>
                        <select
                          className="form-control"
                          style={{ fontSize: 11.5 }}
                          value={receiveReturnReason}
                          onChange={e => setReceiveReturnReason(e.target.value)}
                        >
                          <option value="Barang rusak saat pengiriman / rusak di jalan">Barang rusak saat pengiriman / rusak di jalan</option>
                          <option value="Barang tidak segar / basi / kedaluwarsa">Barang tidak segar / basi / kedaluwarsa</option>
                          <option value="Kemasan bocor / pecah">Kemasan bocor / pecah</option>
                          <option value="Kurang kirim dari pihak pengirim">Kurang kirim dari pihak pengirim</option>
                          <option value="Salah kirim varian / jenis item">Salah kirim varian / jenis item</option>
                          <option value="Lainnya">Alasan Lainnya</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      background: 'rgba(16, 217, 122, 0.06)',
                      border: '1px solid rgba(16, 217, 122, 0.25)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: '#86efac',
                      fontSize: 12,
                      fontWeight: 600
                    }}>
                      <CheckCircle2 size={16} color="var(--ok)" />
                      <span>Semua barang ({receiveItems.length} item) diterima lengkap sesuai pengiriman. Stok cabang tujuan akan bertambah penuh.</span>
                    </div>
                  )}

                  {/* General Receive Notes */}
                  <div className="form-group mb-0">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 11.5 }}>Catatan Penerimaan (Opsional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Contoh: Diterima dalam kondisi baik oleh staf piket"
                      value={receivedNotesInput}
                      onChange={e => setReceivedNotesInput(e.target.value)}
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setReceiveModalOpen(false)}
                    disabled={receiving}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={receiving}
                    style={{
                      background: totalDiff > 0
                        ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      fontWeight: 800,
                      padding: '8px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <PackageCheck size={16} />
                    {receiving
                      ? 'Memproses Approval & Memasukkan Stok...'
                      : (totalDiff > 0 ? `Approve Terima (${num(totalReceived)} Unit) & Masuk Stok` : '✓ Approve & Masukkan ke Kartu Stok')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal Catat Mutasi Manual (Mendukung Pencatatan Banyak Bahan Sekaligus & Beragam Metode Bayar) */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: 880, width: '100%', maxHeight: '94vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ScrollText size={18} color="var(--primary)" />
                <div>
                  <div className="modal-title" style={{ fontSize: 16, fontWeight: 700 }}>
                    Catat Mutasi Stok & Pembelian Bahan
                  </div>
                  <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Bisa mencatat banyak bahan sekaligus dalam satu nota belanja / mutasi stok.
                  </span>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddMutation}>
              <div className="modal-body" style={{ padding: '16px 20px' }}>
                {/* 1. INFORMASI LOKASI, TANGGAL & TIPE MUTASI */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>Gudang / Cabang Outlet</label>
                    {canSwitchOutlet ? (
                      <select
                        className="form-control"
                        value={mutationForm.outlet_id || selectedOutletId}
                        onChange={e => setMutationForm(f => ({ ...f, outlet_id: e.target.value }))}
                      >
                        {outlets.map(o => (
                          <option key={o.id} value={o.id} style={{ background: '#11162d', color: '#ffffff' }}>
                            {o.name} {o.is_main ? '(Pusat)' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{
                        padding: '9px 12px',
                        background: 'rgba(99, 102, 241, 0.12)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 12.5,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span>{currentOutlet?.name || userOutletName || 'Cabang Penempatan'}</span>
                        <span style={{ fontSize: 10, color: 'var(--ok)', background: 'rgba(16, 217, 122, 0.15)', padding: '2px 6px', borderRadius: 4 }}>
                          Terkunci
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>Tanggal Transaksi</label>
                    <input
                      type="date"
                      className="form-control mono"
                      required
                      value={mutationForm.date}
                      onChange={e => setMutationForm(f => ({ ...f, date: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>Tipe Mutasi</label>
                    <select
                      className="form-control"
                      value={mutationForm.type}
                      onChange={e => setMutationForm(f => ({ ...f, type: e.target.value }))}
                    >
                      <option value="PURCHASE">Pembelian Bahan (Masuk +)</option>
                      <option value="WASTE">Waste / Bahan Rusak (Keluar -)</option>
                      <option value="ADJUSTMENT_IN">Penyesuaian Bertambah (Masuk +)</option>
                      <option value="ADJUSTMENT_OUT">Penyesuaian Berkurang (Keluar -)</option>
                      <option value="TRANSFER_IN">Transfer Masuk (Masuk +)</option>
                      <option value="TRANSFER_OUT">Transfer Keluar (Keluar -)</option>
                    </select>
                  </div>
                </div>

                {/* 2. KHUSUS PEMBELIAN (PURCHASE): KATEGORI FISIK & METODE PEMBAYARAN */}
                {mutationForm.type === 'PURCHASE' && (
                  <>
                    {/* Kategori Penerimaan Fisik */}
                    <div style={{
                      background: mutationForm.is_in_transit ? 'rgba(245, 158, 11, 0.08)' : 'rgba(99, 102, 241, 0.05)',
                      border: `1px solid ${mutationForm.is_in_transit ? 'rgba(245, 158, 11, 0.35)' : 'var(--border)'}`,
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 14
                    }}>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: mutationForm.is_in_transit ? '#fbbf24' : '#93c5fd', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Truck size={14} />
                        Kategori Penerimaan / Pengiriman Fisik:
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setMutationForm(f => ({ ...f, is_in_transit: false }))}
                          style={{
                            padding: '8px 10px',
                            fontSize: 12,
                            fontWeight: 700,
                            borderRadius: 8,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                            background: !mutationForm.is_in_transit ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                            border: !mutationForm.is_in_transit ? '1.5px solid #10b981' : '1px solid var(--border)',
                            color: !mutationForm.is_in_transit ? '#34d399' : 'var(--text-secondary)',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <CheckCircle2 size={14} />
                            <span>Bukan Transit (Belanja Langsung)</span>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.85 }}>(Langsung Masuk Kartu Stok)</span>
                        </button>

                        <button
                          type="button"
                          className="btn"
                          onClick={() => setMutationForm(f => ({ ...f, is_in_transit: true }))}
                          style={{
                            padding: '8px 10px',
                            fontSize: 12,
                            fontWeight: 700,
                            borderRadius: 8,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                            background: mutationForm.is_in_transit ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.03)',
                            border: mutationForm.is_in_transit ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                            color: mutationForm.is_in_transit ? '#fbbf24' : 'var(--text-secondary)',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Truck size={14} />
                            <span>Dalam Perjalanan (Online / Ekspedisi)</span>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.85 }}>(Menunggu Approval Paket Tiba)</span>
                        </button>
                      </div>

                      {mutationForm.is_in_transit && (
                        <div style={{ marginTop: 12, borderTop: '1px dashed rgba(245, 158, 11, 0.3)', paddingTop: 10 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 10 }}>
                            <div>
                              <label className="form-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Marketplace / Toko</label>
                              <input
                                type="text"
                                className="form-control"
                                style={{ fontSize: 12 }}
                                placeholder="Misal: Shopee / Tokopedia"
                                value={mutationForm.transit_source_name}
                                onChange={e => setMutationForm(f => ({ ...f, transit_source_name: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="form-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Kurir / Ekspedisi</label>
                              <input
                                type="text"
                                className="form-control"
                                style={{ fontSize: 12 }}
                                placeholder="Misal: J&T / SPX"
                                value={mutationForm.transit_expedition}
                                onChange={e => setMutationForm(f => ({ ...f, transit_expedition: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="form-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>No. Resi (Opsional)</label>
                              <input
                                type="text"
                                className="form-control mono"
                                style={{ fontSize: 12 }}
                                placeholder="Contoh: SPXID0123"
                                value={mutationForm.transit_tracking_no}
                                onChange={e => setMutationForm(f => ({ ...f, transit_tracking_no: e.target.value }))}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* METODE PEMBAYARAN: TUNAI, BANK, QRIS, ATAU HUTANG SUPPLIER */}
                    <div style={{
                      background: mutationForm.payment_type === 'HUTANG' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.06)',
                      border: `1px solid ${mutationForm.payment_type === 'HUTANG' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.3)'}`,
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 14
                    }}>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: mutationForm.payment_type === 'HUTANG' ? '#f87171' : '#34d399', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <ShoppingBag size={14} />
                        Metode Pembayaran Belanja Bahan:
                      </label>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: mutationForm.payment_type === 'HUTANG' ? 12 : 0 }}>
                        {[
                          { value: 'CASH', label: 'Tunai / Kasir', sub: 'Kas Langsung' },
                          { value: 'BANK', label: 'Transfer Bank', sub: 'Rekening Bank' },
                          { value: 'QRIS', label: 'QRIS', sub: 'Scan QRIS' },
                          { value: 'HUTANG', label: 'Hutang / Tempo', sub: 'Buku Hutang Supplier' },
                        ].map(m => {
                          const isSel = mutationForm.payment_type === m.value;
                          return (
                            <button
                              key={m.value}
                              type="button"
                              className="btn"
                              onClick={() => {
                                if (m.value === 'HUTANG') {
                                  const defaultDue = new Date();
                                  defaultDue.setDate(defaultDue.getDate() + 30);
                                  const dueStr = defaultDue.toISOString().slice(0, 10);
                                  setMutationForm(f => ({ ...f, payment_type: 'HUTANG', due_date: f.due_date || dueStr }));
                                } else {
                                  setMutationForm(f => ({ ...f, payment_type: m.value }));
                                }
                              }}
                              style={{
                                padding: '8px 6px',
                                fontSize: 12,
                                fontWeight: 700,
                                borderRadius: 8,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 3,
                                background: isSel
                                  ? (m.value === 'HUTANG' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)')
                                  : 'rgba(255,255,255,0.03)',
                                border: isSel
                                  ? (m.value === 'HUTANG' ? '1.5px solid #ef4444' : '1.5px solid #10b981')
                                  : '1px solid var(--border)',
                                color: isSel
                                  ? (m.value === 'HUTANG' ? '#f87171' : '#34d399')
                                  : 'var(--text-secondary)',
                                cursor: 'pointer'
                              }}
                            >
                              <span>{m.label}</span>
                              <span style={{ fontSize: 9.5, fontWeight: 500, opacity: 0.85 }}>{m.sub}</span>
                            </button>
                          );
                        })}
                      </div>

                      {mutationForm.payment_type === 'HUTANG' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10, borderTop: '1px dashed rgba(239,68,68,0.3)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                            <div>
                              <label className="form-label" style={{ fontSize: 11, color: '#fca5a5', fontWeight: 600 }}>
                                Nama Supplier *
                              </label>
                              <input
                                type="text"
                                list="supplier-options"
                                className="form-control"
                                style={{ fontSize: 12 }}
                                placeholder="Ketik / pilih supplier..."
                                value={mutationForm.supplier_name || ''}
                                onChange={e => setMutationForm(f => ({ ...f, supplier_name: e.target.value }))}
                                required={mutationForm.payment_type === 'HUTANG'}
                              />
                              <datalist id="supplier-options">
                                {supplierList.map((s, idx) => (
                                  <option key={idx} value={s.name} />
                                ))}
                              </datalist>
                            </div>

                            <div>
                              <label className="form-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                No. Faktur / Bon / PO
                              </label>
                              <input
                                type="text"
                                className="form-control mono"
                                style={{ fontSize: 12 }}
                                placeholder="Contoh: INV-2026/09/001"
                                value={mutationForm.purchase_no || ''}
                                onChange={e => setMutationForm(f => ({ ...f, purchase_no: e.target.value }))}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div>
                              <label className="form-label" style={{ fontSize: 11, color: '#fca5a5', fontWeight: 600 }}>
                                Tanggal Jatuh Tempo *
                              </label>
                              <input
                                type="date"
                                className="form-control mono"
                                style={{ fontSize: 12 }}
                                value={mutationForm.due_date || ''}
                                onChange={e => setMutationForm(f => ({ ...f, due_date: e.target.value }))}
                                required={mutationForm.payment_type === 'HUTANG'}
                              />
                            </div>

                            <div>
                              <label className="form-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Uang Muka / DP (Opsional)
                              </label>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                className="form-control mono"
                                style={{ fontSize: 12 }}
                                placeholder="Rp 0"
                                value={mutationForm.initial_paid || ''}
                                onChange={e => setMutationForm(f => ({ ...f, initial_paid: e.target.value }))}
                              />
                            </div>
                          </div>

                          {Number(mutationForm.initial_paid) > 0 && (
                            <div>
                              <label className="form-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Metode Bayar Uang Muka (DP)
                              </label>
                              <select
                                className="form-control"
                                style={{ fontSize: 12 }}
                                value={mutationForm.payment_method || 'CASH'}
                                onChange={e => setMutationForm(f => ({ ...f, payment_method: e.target.value }))}
                              >
                                <option value="CASH">Tunai (Kas Kasir)</option>
                                <option value="TRANSFER">Transfer Bank</option>
                                <option value="QRIS">QRIS</option>
                                <option value="PETTY_CASH">Kas Kecil (Petty Cash)</option>
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* 3. RINCIAN DAFTAR BAHAN BAKU / PERLENGKAPAN (BANYAK SEKALIGUS) */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 14
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0' }}>
                      <ScrollText size={15} color="var(--primary)" />
                      <span>Rincian Bahan Baku / Perlengkapan:</span>
                      <span className="pill pill-primary" style={{ fontSize: 11, padding: '2px 8px' }}>
                        {mutationForm.items.length} Bahan
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={handleAddMutationItem}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, padding: '4px 10px', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                    >
                      <Plus size={13} /> + Tambah Baris Bahan
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {mutationForm.items.map((it, idx) => {
                      const selectedIng = ingredients.find(i => Number(i.id) === Number(it.ingredient_id));
                      const ub = (selectedIng?.unit_beli || 'Kg').trim();
                      const up = (selectedIng?.unit_pakai || 'gram').trim();
                      const factor = Number(selectedIng?.konversi) || 1;
                      const isConvertible = ub.toLowerCase() !== up.toLowerCase() && factor > 1;

                      return (
                        <div
                          key={idx}
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid var(--border-soft)',
                            borderRadius: 10,
                            padding: 12
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#93c5fd' }}>
                              Item #{idx + 1}
                            </span>
                            {mutationForm.items.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() => handleRemoveMutationItem(idx)}
                                style={{ padding: '2px 6px', color: 'var(--danger)' }}
                                title="Hapus baris ini"
                              >
                                <Trash2 size={13} /> Hapus
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 8 }}>
                            <div>
                              <label className="form-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pilih Bahan / Perlengkapan *</label>
                              <SearchableSelect
                                options={mutationIngredientGroups}
                                value={it.ingredient_id}
                                onChange={val => handleMutationItemChange(idx, 'ingredient_id', val)}
                                placeholder="-- Pilih Bahan / Perlengkapan --"
                                searchPlaceholder="Cari nama atau kode bahan..."
                                size="sm"
                              />
                            </div>

                            <div>
                              <label className="form-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Satuan Input</label>
                              {mutationForm.type === 'PURCHASE' && isConvertible ? (
                                <select
                                  className="form-control"
                                  value={it.unit_type || 'BELI'}
                                  onChange={e => handleMutationItemChange(idx, 'unit_type', e.target.value)}
                                  style={{ fontSize: 12 }}
                                >
                                  <option value="BELI">Satuan Beli ({ub})</option>
                                  <option value="PAKAI">Satuan Pakai ({up})</option>
                                </select>
                              ) : (
                                <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 6, fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>
                                  {mutationForm.type === 'PURCHASE' ? (it.unit_type === 'BELI' ? ub : up) : up}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: mutationForm.type === 'PURCHASE' ? '1fr 1fr 1fr' : (mutationForm.type === 'WASTE' ? '1fr 1fr' : '1fr'),
                            gap: 10
                          }}>
                            <div>
                              <label className="form-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Jumlah Qty ({mutationForm.type === 'PURCHASE' ? (it.unit_type === 'BELI' ? ub : up) : up}) *
                              </label>
                              <input
                                type="number"
                                step="any"
                                min="0.0001"
                                className="form-control mono"
                                required
                                placeholder="0"
                                value={it.qty}
                                onChange={e => handleMutationItemChange(idx, 'qty', e.target.value)}
                                style={{ fontSize: 12.5 }}
                              />
                            </div>

                            {mutationForm.type === 'PURCHASE' && (
                              <>
                                <div>
                                  <label className="form-label" style={{ fontSize: 11, color: '#34d399', fontWeight: 700 }}>
                                    Total Nota (Rp)
                                  </label>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    className="form-control mono"
                                    placeholder="Total di bon"
                                    value={it.total_price}
                                    onChange={e => handleMutationItemChange(idx, 'total_price', e.target.value)}
                                    style={{ fontSize: 12.5, borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34d399', fontWeight: 700 }}
                                  />
                                </div>
                                <div>
                                  <label className="form-label" style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>
                                    Harga Satuan (Rp)
                                  </label>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    className="form-control mono"
                                    placeholder="Harga / unit"
                                    value={it.unit_price}
                                    onChange={e => handleMutationItemChange(idx, 'unit_price', e.target.value)}
                                    style={{ fontSize: 12.5, borderColor: 'rgba(96, 165, 250, 0.4)', color: '#60a5fa', fontWeight: 700 }}
                                  />
                                </div>
                              </>
                            )}

                            {mutationForm.type === 'WASTE' && (
                              <div>
                                <label className="form-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Alasan Waste</label>
                                <select
                                  className="form-control"
                                  style={{ fontSize: 12 }}
                                  value={it.waste_reason || 'SPOILED'}
                                  onChange={e => handleMutationItemChange(idx, 'waste_reason', e.target.value)}
                                >
                                  <option value="SPOILED">Basi / Kedaluwarsa</option>
                                  <option value="BURNT_MISTAKE">Gosong / Salah Masak</option>
                                  <option value="SPILLED_DROPPED">Tumpah / Rusak</option>
                                  <option value="QUALITY_REJECT">Sortir Kualitas</option>
                                  <option value="SUPPLIER_DEFECT">Cacat Penerimaan</option>
                                  <option value="OTHER">Lainnya</option>
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAddMutationItem}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12 }}
                    >
                      <Plus size={14} /> + Tambah Baris Bahan Lain
                    </button>
                  </div>
                </div>

                {/* 4. GRAND TOTAL SUMMARY BANNER */}
                {mutationForm.type === 'PURCHASE' && mutationGrandTotal > 0 && (
                  <div style={{
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: 10,
                    marginBottom: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Total Nilai Faktur / Bon ({mutationForm.items.length} Bahan):
                      </div>
                      <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: '#34d399', marginTop: 2 }}>
                        {rupiah(mutationGrandTotal)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="pill pill-primary" style={{ fontWeight: 700, fontSize: 12, padding: '4px 10px' }}>
                        Metode: {mutationForm.payment_type === 'HUTANG' ? 'HUTANG (Tempo)' : (mutationForm.payment_type === 'BANK' ? 'Transfer Bank' : (mutationForm.payment_type === 'QRIS' ? 'QRIS' : 'Tunai / Kas'))}
                      </span>
                      {mutationForm.payment_type === 'HUTANG' && Number(mutationForm.initial_paid) > 0 && (
                        <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 4 }}>
                          DP: {rupiah(mutationForm.initial_paid)} | Sisa: {rupiah(Math.max(0, mutationGrandTotal - Number(mutationForm.initial_paid)))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. CATATAN / NO REFERENSI */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Catatan Faktur / Transaksi (Opsional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Misal: Bon Pasar Pagi / Belanja Mingguan"
                    value={mutationForm.note}
                    onChange={e => setMutationForm(f => ({ ...f, note: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={saving}
                  style={{
                    fontWeight: 800,
                    background: (mutationForm.type === 'PURCHASE' && mutationForm.is_in_transit)
                      ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                      : 'var(--primary)',
                    color: '#ffffff'
                  }}
                >
                  <Check size={14} /> {saving
                    ? 'Menyimpan...'
                    : (mutationForm.type === 'PURCHASE' && mutationForm.is_in_transit)
                      ? `Simpan ${mutationForm.items.length} Item ke Dalam Perjalanan`
                      : `Simpan Mutasi (${mutationForm.items.length} Bahan)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail Transaksi Shift */}
      {shiftModal && (
        <div className="modal-overlay" onClick={() => setShiftModal(null)}>
          <div className="modal-content" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={18} style={{ color: 'var(--accent-bright)' }} />
                Rincian Transaksi Shift #{shiftModal} — {selectedIng?.name}
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShiftModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {shiftModalLoading ? (
                <div style={{ padding: 40, textAlign: 'center' }}><LoadingState /></div>
              ) : (
                <>
                  {/* Shift Summary Cards */}
                  <div className="grid-3 gap-3 mb-4">
                    <div style={{ padding: '10px 12px', background: 'rgba(15, 20, 42, 0.6)', border: '1px solid var(--border)', borderRadius: 10 }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Sesi Shift</div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2, color: '#ffffff' }}>
                        {shiftModalData?.shift?.shift_name || `Shift #${shiftModal}`}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Kasir: {shiftModalData?.shift?.user?.name || 'Kasir'}
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', background: 'rgba(15, 20, 42, 0.6)', border: '1px solid var(--border)', borderRadius: 10 }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Penjualan Shift</div>
                      <div className="mono" style={{ fontWeight: 700, fontSize: 13, marginTop: 2, color: 'var(--ok)' }}>
                        {rupiah(shiftModalData?.total_sales)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {shiftModalData?.total_transactions || 0} transaksi POS
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', borderRadius: 10 }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Bahan {selectedIng?.name}</div>
                      <div className="mono" style={{ fontWeight: 700, fontSize: 13.5, marginTop: 2, color: 'var(--danger)' }}>
                        -{num(shiftModalData?.total_ingredient_usage)} {selectedIng?.unit_pakai}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--accent-bright)' }}>
                        Dibukukan di Kartu Stok
                      </div>
                    </div>
                  </div>

                  {/* Table of transactions contributing to this usage */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#ffffff' }}>
                      Daftar Transaksi Yang Menggunakan Bahan Ini:
                    </div>

                    {shiftModalData?.transactions?.length > 0 ? (
                      <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width: 60 }}>TRX</th>
                              <th>Jam</th>
                              <th>Menu Dipesan</th>
                              <th className="right">Porsi</th>
                              <th className="right">Total Penjualan</th>
                              <th className="right">Pemakaian Bahan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shiftModalData.transactions.map(t => (
                              <tr key={t.id}>
                                <td className="mono" style={{ color: 'var(--accent-bright)' }}>#{t.id}</td>
                                <td className="mono" style={{ fontSize: 12 }}>{t.time}</td>
                                <td style={{ fontWeight: 600 }}>{t.menu_name}</td>
                                <td className="mono right">{t.qty}x</td>
                                <td className="mono right">{rupiah(t.total_price)}</td>
                                <td className="mono right" style={{ color: t.ingredient_usage > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600 }}>
                                  {t.ingredient_usage > 0 ? `-${num(t.ingredient_usage)} ${t.ingredient_unit}` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: 'rgba(255,255,255,0.03)', fontWeight: 700, borderTop: '2px solid var(--border-strong)' }}>
                              <td colSpan={5} style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--text-secondary)' }}>
                                Total Pemakaian Bahan Selama Shift
                              </td>
                              <td className="mono right" style={{ color: 'var(--danger)', fontSize: 13 }}>
                                -{num(shiftModalData.total_ingredient_usage)} {selectedIng?.unit_pakai}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                        Tidak ada transaksi dalam shift ini.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShiftModal(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Import Saldo Awal (Transisi Aplikasi & Kartu Stok) */}
      <ImportMasterModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        targetMaster="SALDO_AWAL"
        onSuccess={() => {
          fetchSummary();
          fetchIngredients();
          if (selectedIngId) fetchStockCard();
        }}
      />
    </div>
  );
}
