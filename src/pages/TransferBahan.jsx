import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send, Plus, Eye, Printer, X, Check, Trash2,
  Calendar, Store, Truck, FileText, AlertCircle, RefreshCw,
  ArrowLeftRight, ShoppingBag, Package, MapPin, Building,
  Search, ArrowRight, ShieldCheck, CheckCircle2, PackageCheck, Clock
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { PageHeader, LoadingState, AuditInfo, MiniCard, num } from '../components/ui';
import { printElement } from '../utils/print';
import { useOutlet } from '../context/OutletContext';

export default function TransferBahan() {
  const { currentBusiness, userBusinessName } = useOutlet();
  const [searchParams] = useSearchParams();
  const [transfers, setTransfers] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [saving, setSaving] = useState(false);

  // Modal Receive state
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveTargetTransfer, setReceiveTargetTransfer] = useState(null);
  const [receivedNotesInput, setReceivedNotesInput] = useState('');
  const [receiving, setReceiving] = useState(false);

  // Form state
  const todayStr = new Date().toISOString().slice(0, 10);
  const [formData, setFormData] = useState({
    date: todayStr,
    source_mode: 'OUTLET', // 'OUTLET' or 'CUSTOM'
    source_outlet_id: '',
    source_name: '',
    destination_mode: 'OUTLET', // 'OUTLET' or 'CUSTOM'
    destination_outlet_id: '',
    destination_name: '',
    driver_name: '',
    vehicle_no: '',
    notes: '',
    items: [
      {
        item_type: 'INGREDIENT', // 'INGREDIENT' or 'PRODUCT'
        ingredient_id: '',
        menu_id: '',
        input_qty: '',
        input_unit: '',
        qty: '',
        unit: '',
        notes: ''
      }
    ]
  });

  // Load all initial data
  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [trfRes, outRes, ingRes, menuRes] = await Promise.all([
        api.get('/transfers'),
        api.get('/outlets'),
        api.get('/ingredients'),
        api.get('/menus').catch(() => ({ data: [] })),
      ]);
      setTransfers(trfRes.data || []);
      setOutlets(outRes.data || []);
      setIngredients(ingRes.data || []);
      setMenus((menuRes.data || []).filter(m => m.active));

      const mainOut = outRes.data.find(o => o.is_main) || outRes.data[0];

      // Check URL query params for quick prefill from POS
      const destParam = searchParams.get('destination_outlet_id');
      const ingParam = searchParams.get('ingredient_id');
      const menuParam = searchParams.get('menu_id');
      const typeParam = searchParams.get('item_type');

      if (destParam || ingParam || menuParam) {
        initCreateModalFromParams(
          destParam,
          ingParam,
          menuParam,
          typeParam,
          outRes.data,
          ingRes.data,
          menuRes.data
        );
      }
    } catch {
      toast.error('Gagal memuat data transfer');
    } finally {
      setLoading(false);
    }
  }

  // Auto-init create modal when URL params are present
  function initCreateModalFromParams(destId, ingId, menuId, itemType, outList, ingList, menuList) {
    const isProduct = itemType === 'PRODUCT' || Boolean(menuId);
    const destOutlet = outList.find(o => String(o.id) === String(destId));
    const altSource = outList.find(o => String(o.id) !== String(destId)) || outList[0];

    const initialItem = isProduct ? {
      item_type: 'PRODUCT',
      ingredient_id: '',
      menu_id: menuId || (menuList[0]?.id || ''),
      input_qty: '5',
      input_unit: 'pcs',
      qty: 5,
      unit: 'pcs',
      notes: 'Permintaan dari Kasir POS'
    } : {
      item_type: 'INGREDIENT',
      ingredient_id: ingId || (ingList[0]?.id || ''),
      menu_id: '',
      input_qty: '5',
      input_unit: ingList[0]?.unit_beli || ingList[0]?.unit_pakai || 'gram',
      qty: 5,
      unit: ingList[0]?.unit_pakai || 'gram',
      notes: 'Permintaan dari Kasir POS'
    };

    setFormData({
      date: new Date().toISOString().slice(0, 10),
      source_mode: 'OUTLET',
      source_outlet_id: altSource ? String(altSource.id) : '',
      source_name: '',
      destination_mode: 'OUTLET',
      destination_outlet_id: destOutlet ? String(destOutlet.id) : (outList[1]?.id ? String(outList[1].id) : ''),
      destination_name: '',
      driver_name: '',
      vehicle_no: '',
      notes: 'Permintaan stok tambahan antar cabang',
      items: [initialItem]
    });
    setCreateModalOpen(true);
  }

  // Filter retail direct products
  const directMenus = useMemo(() => {
    return menus.filter(m => m.item_type === 'DIRECT' || m.track_stock || m.is_direct);
  }, [menus]);

  // Open Create Modal cleanly
  function openCreateModal() {
    const firstOut = outlets[0];
    const secondOut = outlets.length > 1 ? outlets[1] : null;
    const firstIng = ingredients[0];
    const defaultUnit = firstIng?.unit_beli || firstIng?.unit_pakai || 'gram';

    setFormData({
      date: new Date().toISOString().slice(0, 10),
      source_mode: 'OUTLET',
      source_outlet_id: firstOut ? String(firstOut.id) : '',
      source_name: '',
      destination_mode: 'OUTLET',
      destination_outlet_id: secondOut ? String(secondOut.id) : '',
      destination_name: '',
      driver_name: '',
      vehicle_no: '',
      notes: '',
      items: [
        {
          item_type: 'INGREDIENT',
          ingredient_id: firstIng ? firstIng.id : '',
          menu_id: '',
          input_qty: '',
          input_unit: defaultUnit,
          qty: '',
          unit: firstIng ? firstIng.unit_pakai : 'gram',
          notes: ''
        }
      ]
    });
    setCreateModalOpen(true);
  }

  // Swap Locations 1-Click
  function handleSwapLocations() {
    setFormData(prev => {
      const nextSourceMode = prev.destination_mode;
      const nextSourceOutlet = prev.destination_outlet_id;
      const nextSourceName = prev.destination_name;

      const nextDestMode = prev.source_mode;
      const nextDestOutlet = prev.source_outlet_id;
      const nextDestName = prev.source_name;

      return {
        ...prev,
        source_mode: nextSourceMode,
        source_outlet_id: nextSourceOutlet,
        source_name: nextSourceName,
        destination_mode: nextDestMode,
        destination_outlet_id: nextDestOutlet,
        destination_name: nextDestName,
      };
    });
    toast.success('Lokasi asal dan tujuan berhasil ditukar!');
  }

  // Add Item Row
  function handleAddItem(type = 'INGREDIENT') {
    if (type === 'PRODUCT') {
      const firstMenu = directMenus[0] || menus[0];
      setFormData(p => ({
        ...p,
        items: [
          ...p.items,
          {
            item_type: 'PRODUCT',
            ingredient_id: '',
            menu_id: firstMenu ? firstMenu.id : '',
            input_qty: '',
            input_unit: firstMenu?.unit || 'pcs',
            qty: '',
            unit: firstMenu?.unit || 'pcs',
            notes: ''
          }
        ]
      }));
    } else {
      const firstIng = ingredients[0];
      const defaultUnit = firstIng?.unit_beli || firstIng?.unit_pakai || 'gram';
      setFormData(p => ({
        ...p,
        items: [
          ...p.items,
          {
            item_type: 'INGREDIENT',
            ingredient_id: firstIng ? firstIng.id : '',
            menu_id: '',
            input_qty: '',
            input_unit: defaultUnit,
            qty: '',
            unit: firstIng ? firstIng.unit_pakai : 'gram',
            notes: ''
          }
        ]
      }));
    }
  }

  // Remove Item Row
  function handleRemoveItem(index) {
    if (formData.items.length <= 1) {
      toast.error('Dokumen transfer harus memiliki minimal 1 barang / bahan!');
      return;
    }
    setFormData(p => ({
      ...p,
      items: p.items.filter((_, i) => i !== index)
    }));
  }

  // Handle Item Row Changes
  function handleItemChange(index, field, value) {
    setFormData(p => {
      const newItems = [...p.items];
      const current = { ...newItems[index] };

      if (field === 'item_type') {
        current.item_type = value;
        if (value === 'PRODUCT') {
          const firstMenu = directMenus[0] || menus[0];
          current.menu_id = firstMenu ? firstMenu.id : '';
          current.ingredient_id = '';
          current.input_unit = firstMenu?.unit || 'pcs';
          current.unit = firstMenu?.unit || 'pcs';
          current.qty = current.input_qty || '';
        } else {
          const firstIng = ingredients[0];
          current.ingredient_id = firstIng ? firstIng.id : '';
          current.menu_id = '';
          current.input_unit = firstIng?.unit_beli || firstIng?.unit_pakai || 'gram';
          current.unit = firstIng ? firstIng.unit_pakai : 'gram';
          current.qty = current.input_qty || '';
        }
      } else if (field === 'menu_id') {
        const mId = Number(value);
        const selMenu = menus.find(m => m.id === mId);
        current.menu_id = mId;
        current.input_unit = selMenu?.unit || 'pcs';
        current.unit = selMenu?.unit || 'pcs';
        current.qty = Number(current.input_qty || 0);
      } else if (field === 'ingredient_id') {
        const ingId = Number(value);
        const selected = ingredients.find(i => i.id === ingId);
        const newUnit = selected?.unit_beli || selected?.unit_pakai || 'gram';
        current.ingredient_id = ingId;
        current.input_unit = newUnit;
        current.unit = selected ? selected.unit_pakai : 'gram';

        const ub = (selected?.unit_beli || '').trim();
        const factor = Number(selected?.konversi) || 1;
        const isConvertible = selected && ub && selected.unit_pakai && ub.toLowerCase() !== selected.unit_pakai.toLowerCase() && factor > 1;
        const isBeli = isConvertible && newUnit.toLowerCase() === ub.toLowerCase();
        current.qty = isBeli ? (Number(current.input_qty || 0) * factor) : Number(current.input_qty || 0);
      } else if (field === 'input_qty') {
        current.input_qty = value;
        if (current.item_type === 'PRODUCT') {
          current.qty = Number(value || 0);
        } else {
          const selected = ingredients.find(i => i.id === Number(current.ingredient_id));
          const ub = (selected?.unit_beli || '').trim();
          const factor = Number(selected?.konversi) || 1;
          const isConvertible = selected && ub && selected.unit_pakai && ub.toLowerCase() !== selected.unit_pakai.toLowerCase() && factor > 1;
          const isBeli = isConvertible && current.input_unit && current.input_unit.toLowerCase() === ub.toLowerCase();
          current.qty = isBeli ? (Number(value || 0) * factor) : Number(value || 0);
        }
      } else if (field === 'input_unit') {
        current.input_unit = value;
        if (current.item_type === 'INGREDIENT') {
          const selected = ingredients.find(i => i.id === Number(current.ingredient_id));
          const ub = (selected?.unit_beli || '').trim();
          const factor = Number(selected?.konversi) || 1;
          const isConvertible = selected && ub && selected.unit_pakai && ub.toLowerCase() !== selected.unit_pakai.toLowerCase() && factor > 1;
          const isBeli = isConvertible && value && value.toLowerCase() === ub.toLowerCase();
          current.qty = isBeli ? (Number(current.input_qty || 0) * factor) : Number(value || 0);
        }
      } else {
        current[field] = value;
      }

      newItems[index] = current;
      return { ...p, items: newItems };
    });
  }

  // Check live stock of an item at source outlet
  function getSourceStockInfo(item) {
    if (formData.source_mode !== 'OUTLET' || !formData.source_outlet_id) {
      return null;
    }
    const sourceOutletId = Number(formData.source_outlet_id);

    if (item.item_type === 'PRODUCT') {
      const menu = menus.find(m => m.id === Number(item.menu_id));
      if (!menu) return null;
      const om = menu.outlet_menus?.find(x => x.outlet_id === sourceOutletId);
      const availStock = om ? Number(om.stock) : Number(menu.stock || 0);
      return {
        stock: availStock,
        unit: menu.unit || 'pcs',
        isLow: availStock <= 5,
        isDeficit: availStock < Number(item.input_qty || 0)
      };
    } else {
      const ing = ingredients.find(i => i.id === Number(item.ingredient_id));
      if (!ing) return null;
      const outStock = ing.outlet_stocks?.find(os => os.outlet_id === sourceOutletId);
      const availStock = outStock ? Number(outStock.current) : Number(ing.current_stock ?? ing.stok_awal ?? 0);
      const neededBaseQty = Number(item.qty || 0);
      return {
        stock: availStock,
        unit: ing.unit_pakai || 'satuan',
        isLow: availStock <= 10,
        isDeficit: neededBaseQty > 0 && availStock < neededBaseQty
      };
    }
  }

  // Submit Create Transfer
  async function handleCreateTransfer(e) {
    e.preventDefault();

    // Validate origin
    const sourceIsOutlet = formData.source_mode === 'OUTLET';
    const sourceName = sourceIsOutlet ? '' : formData.source_name.trim();
    const sourceOutletId = sourceIsOutlet ? Number(formData.source_outlet_id) : null;

    if (sourceIsOutlet && !sourceOutletId) {
      toast.error('Pilih outlet pengirim terlebih dahulu!');
      return;
    }
    if (!sourceIsOutlet && !sourceName) {
      toast.error('Ketik nama lokasi / gudang asal pengirim!');
      return;
    }

    // Validate destination
    const destIsOutlet = formData.destination_mode === 'OUTLET';
    const destName = destIsOutlet ? '' : formData.destination_name.trim();
    const destOutletId = destIsOutlet ? Number(formData.destination_outlet_id) : null;

    if (destIsOutlet && !destOutletId) {
      toast.error('Pilih cabang outlet penerima terlebih dahulu!');
      return;
    }
    if (!destIsOutlet && !destName) {
      toast.error('Ketik nama lokasi / cabang tujuan penerima!');
      return;
    }

    // Origin and destination must not be identical outlet
    if (sourceIsOutlet && destIsOutlet && sourceOutletId === destOutletId) {
      toast.error('Outlet pengirim dan penerima tidak boleh sama!');
      return;
    }

    // Validate items
    for (const it of formData.items) {
      const isProd = it.item_type === 'PRODUCT';
      if (isProd && !it.menu_id) {
        toast.error('Pilih produk retail pada semua baris produk!');
        return;
      }
      if (!isProd && !it.ingredient_id) {
        toast.error('Pilih bahan baku pada semua baris bahan!');
        return;
      }
      const valQty = Number(it.input_qty ?? it.qty);
      if (!valQty || valQty <= 0) {
        toast.error('Jumlah transfer harus lebih besar dari 0!');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        date: formData.date,
        source_type: sourceIsOutlet ? 'OUTLET' : 'EXTERNAL',
        source_outlet_id: sourceOutletId,
        source_name: sourceName || undefined,
        destination_type: destIsOutlet ? 'OUTLET' : 'EXTERNAL',
        destination_outlet_id: destOutletId,
        destination_name: destName || undefined,
        driver_name: formData.driver_name || null,
        vehicle_no: formData.vehicle_no || null,
        status: 'IN_TRANSIT',
        notes: formData.notes || null,
        items: formData.items.map(it => {
          if (it.item_type === 'PRODUCT') {
            const menu = menus.find(m => m.id === Number(it.menu_id));
            const q = Number(it.input_qty || it.qty);
            return {
              item_type: 'PRODUCT',
              menu_id: Number(it.menu_id),
              input_qty: q,
              input_unit: it.input_unit || menu?.unit || 'pcs',
              qty: q,
              unit: menu?.unit || 'pcs',
              notes: it.notes || null,
            };
          } else {
            const ing = ingredients.find(i => i.id === Number(it.ingredient_id));
            const ub = (ing?.unit_beli || '').trim();
            const up = (ing?.unit_pakai || '').trim();
            const factor = Number(ing?.konversi) || 1;
            const isConvertible = ub && up && ub.toLowerCase() !== up.toLowerCase() && factor > 1;
            const isBeli = isConvertible && it.input_unit && it.input_unit.toLowerCase() === ub.toLowerCase();
            const inputQ = Number(it.input_qty ?? it.qty);
            const baseQ = isBeli ? inputQ * factor : inputQ;

            return {
              item_type: 'INGREDIENT',
              ingredient_id: Number(it.ingredient_id),
              input_qty: inputQ,
              input_unit: it.input_unit || up || 'gram',
              qty: baseQ,
              unit: up || it.unit || 'gram',
              notes: it.notes || null,
            };
          }
        })
      };

      const { data } = await api.post('/transfers', payload);
      setTransfers(prev => [data, ...prev]);
      setCreateModalOpen(false);
      toast.success(`Surat Jalan ${data.transfer_no} berhasil dikirim! Menunggu konfirmasi terima di cabang tujuan.`);

      // Open detail modal immediately for user convenience (print ready)
      setSelectedTransfer(data);
      setDetailModalOpen(true);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) {
        Object.values(errors).flat().forEach(m => toast.error(m));
      } else {
        toast.error(err.response?.data?.message || 'Gagal memproses transfer barang');
      }
    } finally {
      setSaving(false);
    }
  }

  // Open Receive Modal
  function openReceiveModal(trf) {
    setReceiveTargetTransfer(trf);
    setReceivedNotesInput('Barang diterima lengkap dan sesuai kondisi.');
    setReceiveModalOpen(true);
  }

  // Submit Receive Transfer
  async function handleConfirmReceive(e) {
    e?.preventDefault();
    if (!receiveTargetTransfer) return;

    setReceiving(true);
    try {
      const { data } = await api.post(`/transfers/${receiveTargetTransfer.id}/receive`, {
        received_notes: receivedNotesInput
      });

      setTransfers(prev => prev.map(t => (t.id === data.transfer.id ? data.transfer : t)));
      if (selectedTransfer?.id === data.transfer.id) {
        setSelectedTransfer(data.transfer);
      }

      setReceiveModalOpen(false);
      toast.success(data.message || 'Transfer berhasil diterima!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses penerimaan transfer');
    } finally {
      setReceiving(false);
    }
  }

  // Cancel Transfer
  async function handleCancelTransfer(transfer) {
    if (transfer.status === 'CANCELLED') return;
    if (!window.confirm(`Apakah Anda yakin ingin membatalkan dokumen transfer "${transfer.transfer_no}"? Saldo stok bahan dan produk retail akan otomatis dikembalikan.`)) {
      return;
    }

    try {
      const { data } = await api.post(`/transfers/${transfer.id}/cancel`);
      setTransfers(prev => prev.map(t => (t.id === transfer.id ? data.transfer : t)));
      if (selectedTransfer?.id === transfer.id) {
        setSelectedTransfer(data.transfer);
      }
      toast.success(data.message || 'Transfer berhasil dibatalkan dan stok dipulihkan.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membatalkan transfer');
    }
  }

  function printDeliveryOrder() {
    printElement('printable-surat-jalan', `Surat Jalan Transfer - ${selectedTransfer?.transfer_no || ''}`);
  }

  // Filtered transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      let matchStatus = false;
      if (filterStatus === 'ALL') matchStatus = true;
      else if (filterStatus === 'IN_TRANSIT') matchStatus = t.status === 'IN_TRANSIT' || t.status === 'PENDING';
      else matchStatus = t.status === filterStatus;

      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        t.transfer_no.toLowerCase().includes(q) ||
        (t.source_display_name && t.source_display_name.toLowerCase().includes(q)) ||
        (t.destination_display_name && t.destination_display_name.toLowerCase().includes(q)) ||
        (t.driver_name && t.driver_name.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [transfers, filterStatus, searchQuery]);

  if (loading) return <LoadingState />;

  const inTransitCount = transfers.filter(t => t.status === 'IN_TRANSIT' || t.status === 'PENDING').length;
  const completedCount = transfers.filter(t => t.status === 'COMPLETED').length;
  const totalItemsCount = transfers.reduce((acc, t) => acc + (t.total_items || t.items?.length || 0), 0);

  return (
    <div className="fade-in">
      <PageHeader
        title="Transfer Barang Antar Cabang"
        subtitle={`Distribusi bahan baku dan produk retail langsung antar cabang di dalam ${userBusinessName || 'perusahaan Anda'} dengan bukti surat jalan dan fitur penerimaan.`}
        action={
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Send size={15} /> Buat Transfer Antar Cabang
          </button>
        }
      />

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }} className="mb-6">
        <MiniCard
          label="Total Dokumen Transfer"
          value={`${transfers.length} Dokumen`}
          color="var(--accent)"
        />
        <MiniCard
          label="Dalam Perjalanan (Transit)"
          value={`${inTransitCount} Menunggu Terima`}
          color="var(--warning)"
        />
        <MiniCard
          label="Transfer Selesai / Diterima"
          value={`${completedCount} Selesai`}
          color="var(--ok)"
        />
        <MiniCard
          label="Total Alokasi Barang Terdistribusi"
          value={`${totalItemsCount} Unit/Pos`}
          color="var(--accent-bright)"
        />
      </div>

      {/* Filters & Search Bar */}
      <div className="card mb-4" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Cari no surat jalan, cabang asal, cabang tujuan, atau kurir..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 36, fontSize: 13 }}
            />
          </div>

          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'Semua' },
              { id: 'IN_TRANSIT', label: `Transit (${inTransitCount})` },
              { id: 'COMPLETED', label: 'Selesai' },
              { id: 'CANCELLED', label: 'Dibatalkan' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${filterStatus === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterStatus(tab.id)}
                style={{ fontSize: 12, padding: '4px 10px' }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transfers List Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Riwayat Dokumen Transfer Barang</div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Menampilkan <strong>{filteredTransfers.length}</strong> dari {transfers.length} riwayat
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 145 }}>No. Surat Jalan</th>
                <th style={{ width: 95 }}>Tanggal</th>
                <th style={{ minWidth: 160 }}>Cabang Pengirim (Asal)</th>
                <th style={{ minWidth: 160 }}>Cabang Penerima (Tujuan)</th>
                <th style={{ minWidth: 220 }}>Rincian Barang & Bahan</th>
                <th style={{ minWidth: 130 }}>Kurir / Supir</th>
                <th style={{ width: 110 }} className="center">Status</th>
                <th style={{ minWidth: 150 }}>Riwayat Audit</th>
                <th style={{ width: 140 }} className="center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                    Tidak ada riwayat transfer yang cocok. Klik tombol "Buat Transfer Barang" di atas.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map(trf => {
                  const isCancelled = trf.status === 'CANCELLED';
                  const isInTransit = trf.status === 'IN_TRANSIT' || trf.status === 'PENDING';
                  const sourceText = trf.source_display_name || trf.source_outlet?.name || trf.source_name || 'Lokasi Asal';
                  const destText = trf.destination_display_name || trf.destination_outlet?.name || trf.destination_name || 'Lokasi Tujuan';

                  return (
                    <tr key={trf.id} style={{ opacity: isCancelled ? 0.6 : 1 }}>
                      <td className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                        {trf.transfer_no}
                      </td>
                      <td className="mono" style={{ fontSize: 12.5 }}>
                        {trf.date}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          {trf.source_outlet ? <Store size={13} color="var(--text-muted)" /> : <Building size={13} color="#60a5fa" />}
                          <span style={{ fontWeight: 500 }}>{sourceText}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          {trf.destination_outlet ? <Store size={13} color="var(--accent-bright)" /> : <Building size={13} color="#c084fc" />}
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {destText}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>
                          <span style={{ fontWeight: 600, color: 'var(--accent-bright)' }}>
                            {trf.items?.length || trf.total_items} macam item:
                          </span>{' '}
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {trf.items?.map(it => {
                              const isProd = it.item_type === 'PRODUCT';
                              const name = isProd ? (it.menu?.name || it.item_name || 'Produk') : (it.ingredient?.name || it.item_name || 'Bahan');
                              const hasConv = !isProd && it.input_unit && it.unit && it.input_unit !== it.unit && it.input_qty;
                              const badge = isProd ? '📦 ' : '🧪 ';
                              return hasConv
                                ? `${badge}${name} (${num(it.input_qty)} ${it.input_unit} ≈ ${num(it.qty)} ${it.unit})`
                                : `${badge}${name} (${num(it.input_qty || it.qty)} ${it.input_unit || it.unit})`;
                            }).join(', ') || '—'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>
                          {trf.driver_name ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Truck size={12} color="var(--text-muted)" />
                              <span>{trf.driver_name} {trf.vehicle_no && `(${trf.vehicle_no})`}</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Kurir Internal / —</span>
                          )}
                        </div>
                      </td>
                      <td className="center">
                        {isCancelled ? (
                          <span className="pill pill-danger" style={{ fontSize: 10.5 }}>BATAL</span>
                        ) : isInTransit ? (
                          <span className="pill pill-warning" style={{ fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Truck size={11} /> TRANSIT
                          </span>
                        ) : (
                          <span className="pill pill-ok" style={{ fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={11} /> SELESAI
                          </span>
                        )}
                      </td>
                      <td>
                        <AuditInfo
                          createdAt={trf.created_at}
                          createdBy={trf.created_by_name}
                          updatedAt={trf.updated_at}
                          updatedBy={trf.updated_by_name}
                        />
                      </td>
                      <td className="center">
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                          {isInTransit && (
                            <button
                              className="btn btn-sm"
                              onClick={() => openReceiveModal(trf)}
                              title="Terima Transfer & Masukkan Stok ke Cabang Tujuan"
                              style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: '#ffffff',
                                padding: '4px 8px',
                                fontSize: 11,
                                fontWeight: 700,
                                border: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                              }}
                            >
                              <CheckCircle2 size={12} /> Terima
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setSelectedTransfer(trf);
                              setDetailModalOpen(true);
                            }}
                            title="Lihat & Cetak Surat Jalan"
                            style={{ padding: '4px 8px' }}
                          >
                            <Eye size={13} />
                          </button>
                          {!isCancelled && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleCancelTransfer(trf)}
                              title="Batalkan Dokumen Transfer"
                              style={{ padding: '4px 8px', color: 'var(--danger)' }}
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Confirm Receive Transfer */}
      {receiveModalOpen && receiveTargetTransfer && (
        <div className="modal-backdrop" onClick={() => setReceiveModalOpen(false)}>
          <div
            className="modal-content card"
            style={{ maxWidth: 540, width: '100%', margin: '20px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={20} color="var(--ok)" />
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                    Konfirmasi Penerimaan Transfer Barang
                  </h3>
                  <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    No. Surat Jalan: <strong className="mono" style={{ color: 'var(--accent-bright)' }}>{receiveTargetTransfer.transfer_no}</strong>
                  </span>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setReceiveModalOpen(false)}
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmReceive}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 10,
                padding: 14,
                marginBottom: 16
              }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginBottom: 6 }}>
                  📦 Cabang Penerima (Tujuan): <strong>{receiveTargetTransfer.destination_display_name || receiveTargetTransfer.destination_name}</strong>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Dengan mengonfirmasi penerimaan ini, seluruh stok <strong>{receiveTargetTransfer.items?.length || receiveTargetTransfer.total_items} jenis barang/bahan</strong> akan otomatis masuk dan menambah saldo inventaris cabang tujuan.
                </div>
              </div>

              <div className="form-group mb-4">
                <label className="form-label" style={{ fontWeight: 600 }}>Catatan Penerimaan / Kondisi Barang</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: Barang diterima lengkap dan sesuai kondisi"
                  value={receivedNotesInput}
                  onChange={e => setReceivedNotesInput(e.target.value)}
                />
              </div>

              <div className="flex-between">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setReceiveModalOpen(false)}
                  disabled={receiving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={receiving}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 800,
                    padding: '8px 18px'
                  }}
                >
                  {receiving ? 'Memproses Penerimaan...' : (
                    <>
                      <CheckCircle2 size={15} /> Konfirmasi & Tambah Stok
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Buat Transfer Fleksibel */}
      {createModalOpen && (
        <div className="modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div
            className="modal-content card"
            style={{ maxWidth: 840, width: '100%', margin: '20px', maxHeight: '94vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Send size={18} color="var(--accent-bright)" />
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                    Form Transfer Barang Antar Cabang
                  </h3>
                  <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Kirim stok bahan baku maupun produk retail langsung antar cabang dalam perusahaan Anda.
                  </span>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setCreateModalOpen(false)}
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer}>
              {/* COMPANY SCOPE & BRANCH-TO-BRANCH SELECTOR WITH 1-CLICK SWAP */}
              <div style={{
                background: 'rgba(99, 102, 241, 0.04)',
                border: '1px solid rgba(99, 102, 241, 0.18)',
                borderRadius: 12,
                padding: 14,
                marginBottom: 14
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--accent-bright)' }}>
                    <Store size={14} />
                    <span>Internal Transfer Antar Cabang:</span>
                    <span className="pill pill-primary" style={{ fontSize: 10.5, padding: '2px 8px' }}>
                      🏢 {userBusinessName || currentBusiness?.name || 'Perusahaan Aktif'}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    🔒 Bebas dari cabang mana saja ke cabang mana saja dalam 1 perusahaan
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px 1fr', gap: 10, alignItems: 'center' }}>
                  {/* CABANG PENGIRIM (ASAL) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <label className="form-label mb-0" style={{ fontWeight: 700, color: '#93c5fd', fontSize: 12 }}>
                        Cabang Asal (Pengirim)
                      </label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className={`btn btn-xs ${formData.source_mode === 'OUTLET' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setFormData(p => ({ ...p, source_mode: 'OUTLET' }))}
                          style={{ fontSize: 10, padding: '1px 6px' }}
                        >
                          Cabang
                        </button>
                        <button
                          type="button"
                          className={`btn btn-xs ${formData.source_mode === 'CUSTOM' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setFormData(p => ({ ...p, source_mode: 'CUSTOM' }))}
                          style={{ fontSize: 10, padding: '1px 6px' }}
                        >
                          Manual
                        </button>
                      </div>
                    </div>

                    {formData.source_mode === 'OUTLET' ? (
                      <select
                        className="form-control"
                        style={{ fontWeight: 600 }}
                        value={formData.source_outlet_id}
                        onChange={e => setFormData(p => ({ ...p, source_outlet_id: e.target.value }))}
                        required
                      >
                        <option value="">-- Pilih Cabang Pengirim --</option>
                        {outlets.map(o => (
                          <option key={o.id} value={o.id} style={{ background: '#11162d', color: '#ffffff' }}>
                            {o.name} {o.is_main ? '(Pusat)' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Misal: Gudang Utama / Supplier A"
                        value={formData.source_name}
                        onChange={e => setFormData(p => ({ ...p, source_name: e.target.value }))}
                        required
                      />
                    )}
                  </div>

                  {/* 1-CLICK SWAP BUTTON */}
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      onClick={handleSwapLocations}
                      title="Tukar Lokasi Asal <-> Tujuan"
                      style={{
                        borderRadius: '50%',
                        width: 36,
                        height: 36,
                        padding: 0,
                        border: '1px solid var(--accent)',
                        color: 'var(--accent-bright)'
                      }}
                    >
                      <ArrowLeftRight size={15} />
                    </button>
                  </div>

                  {/* CABANG PENERIMA (TUJUAN) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <label className="form-label mb-0" style={{ fontWeight: 700, color: '#c084fc', fontSize: 12 }}>
                        Cabang Tujuan (Penerima)
                      </label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className={`btn btn-xs ${formData.destination_mode === 'OUTLET' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setFormData(p => ({ ...p, destination_mode: 'OUTLET' }))}
                          style={{ fontSize: 10, padding: '1px 6px' }}
                        >
                          Cabang
                        </button>
                        <button
                          type="button"
                          className={`btn btn-xs ${formData.destination_mode === 'CUSTOM' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setFormData(p => ({ ...p, destination_mode: 'CUSTOM' }))}
                          style={{ fontSize: 10, padding: '1px 6px' }}
                        >
                          Manual
                        </button>
                      </div>
                    </div>

                    {formData.destination_mode === 'OUTLET' ? (
                      <select
                        className="form-control"
                        style={{ fontWeight: 600 }}
                        value={formData.destination_outlet_id}
                        onChange={e => setFormData(p => ({ ...p, destination_outlet_id: e.target.value }))}
                        required
                      >
                        <option value="">-- Pilih Cabang Penerima --</option>
                        {outlets.map(o => (
                          <option key={o.id} value={o.id} style={{ background: '#11162d', color: '#ffffff' }}>
                            {o.name} {o.is_main ? '(Pusat)' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Misal: Cabang Baru / Event Booth"
                        value={formData.destination_name}
                        onChange={e => setFormData(p => ({ ...p, destination_name: e.target.value }))}
                        required
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* LOGISTIK & TANGGAL */}
              <div className="grid-3 gap-3 mb-4">
                <div>
                  <label className="form-label">Tanggal Pengiriman</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.date}
                    onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Nama Kurir / Supir</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Misal: Budi (Kurir Internal)"
                    value={formData.driver_name}
                    onChange={e => setFormData(p => ({ ...p, driver_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Plat / No. Kendaraan</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Misal: B 1234 CD"
                    value={formData.vehicle_no}
                    onChange={e => setFormData(p => ({ ...p, vehicle_no: e.target.value }))}
                  />
                </div>
              </div>

              {/* DAFTAR BARANG YANG DITRANSFER */}
              <div className="card mb-4" style={{ background: 'var(--bg-card-subtle)', padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>Rincian Barang & Bahan Baku:</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleAddItem('INGREDIENT')}
                      style={{ fontSize: 11.5, padding: '3px 8px' }}
                    >
                      <Plus size={13} /> Tambah Bahan Baku
                    </button>
                    {directMenus.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleAddItem('PRODUCT')}
                        style={{ fontSize: 11.5, padding: '3px 8px', color: 'var(--accent-bright)' }}
                      >
                        <Plus size={13} /> Tambah Produk Retail
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {formData.items.map((item, idx) => {
                    const isProd = item.item_type === 'PRODUCT';
                    const stockInfo = getSourceStockInfo(item);
                    const selectedIng = !isProd ? ingredients.find(i => i.id === Number(item.ingredient_id)) : null;
                    const ub = selectedIng ? (selectedIng.unit_beli || '').trim() : '';
                    const up = selectedIng ? (selectedIng.unit_pakai || '').trim() : '';
                    const factor = selectedIng ? (Number(selectedIng.konversi) || 1) : 1;
                    const isConvertible = selectedIng && ub && up && ub.toLowerCase() !== up.toLowerCase() && factor > 1;
                    const isUsingUnitBeli = isConvertible && item.input_unit && item.input_unit.toLowerCase() === ub.toLowerCase();
                    const liveBaseQty = isUsingUnitBeli ? (Number(item.input_qty || 0) * factor) : Number(item.input_qty || 0);

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          background: 'var(--bg-main)',
                          border: '1px solid var(--border-soft)'
                        }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 110px 100px 1fr 32px', gap: 8, alignItems: 'center' }}>
                          {/* Item Type */}
                          <select
                            className="form-control"
                            style={{ padding: '6px 8px', fontSize: 11.5, fontWeight: 700 }}
                            value={item.item_type}
                            onChange={e => handleItemChange(idx, 'item_type', e.target.value)}
                          >
                            <option value="INGREDIENT" style={{ background: '#11162d', color: '#ffffff' }}>🧪 Bahan</option>
                            <option value="PRODUCT" style={{ background: '#11162d', color: '#ffffff' }}>📦 Produk</option>
                          </select>

                          {/* Item Selector */}
                          {isProd ? (
                            <select
                              className="form-control"
                              style={{ padding: '6px 8px', fontSize: 12.5 }}
                              value={item.menu_id}
                              onChange={e => handleItemChange(idx, 'menu_id', e.target.value)}
                              required
                            >
                              <option value="">-- Pilih Produk Retail --</option>
                              {directMenus.map(m => (
                                <option key={m.id} value={m.id} style={{ background: '#11162d', color: '#ffffff' }}>
                                  {m.name} ({m.code || 'PRD'})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              className="form-control"
                              style={{ padding: '6px 8px', fontSize: 12.5 }}
                              value={item.ingredient_id}
                              onChange={e => handleItemChange(idx, 'ingredient_id', e.target.value)}
                              required
                            >
                              <option value="">-- Pilih Bahan Baku --</option>
                              {ingredients.map(i => (
                                <option key={i.id} value={i.id} style={{ background: '#11162d', color: '#ffffff' }}>
                                  {i.name} ({i.code || 'BB'})
                                </option>
                              ))}
                            </select>
                          )}

                          {/* Quantity Input */}
                          <input
                            type="number"
                            step="any"
                            min="0.0001"
                            className="form-control mono right"
                            style={{ padding: '6px 8px', fontSize: 12.5 }}
                            placeholder="Jumlah"
                            value={item.input_qty ?? item.qty}
                            onChange={e => handleItemChange(idx, 'input_qty', e.target.value)}
                            required
                          />

                          {/* Unit Selector */}
                          {!isProd && isConvertible ? (
                            <select
                              className="form-control"
                              style={{
                                padding: '6px 8px',
                                fontSize: 12,
                                fontWeight: 600,
                                background: 'var(--bg-card)',
                                borderColor: 'var(--accent)',
                                color: 'var(--accent-bright)'
                              }}
                              value={item.input_unit || ub}
                              onChange={e => handleItemChange(idx, 'input_unit', e.target.value)}
                            >
                              <option value={ub} style={{ background: '#11162d', color: '#ffffff' }}>
                                {ub} ({factor}x)
                              </option>
                              <option value={up} style={{ background: '#11162d', color: '#ffffff' }}>
                                {up} (Terkecil)
                              </option>
                            </select>
                          ) : (
                            <div
                              className="pill pill-muted mono"
                              style={{
                                fontSize: 11.5,
                                textAlign: 'center',
                                padding: '6px 8px',
                                border: '1px solid var(--border-soft)',
                                color: 'var(--text-secondary)'
                              }}
                            >
                              {item.input_unit || item.unit || (isProd ? 'pcs' : 'gram')}
                            </div>
                          )}

                          {/* Item Note */}
                          <input
                            type="text"
                            className="form-control"
                            style={{ padding: '6px 8px', fontSize: 12 }}
                            placeholder="Catatan item"
                            value={item.notes}
                            onChange={e => handleItemChange(idx, 'notes', e.target.value)}
                          />

                          {/* Remove button */}
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            style={{ padding: 4, color: 'var(--danger)' }}
                            onClick={() => handleRemoveItem(idx)}
                            disabled={formData.items.length <= 1}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Stock & Conversion Subtext */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 11.5 }}>
                          {stockInfo ? (
                            <span style={{ color: stockInfo.isDeficit ? '#fb7185' : '#86efac', fontWeight: 600 }}>
                              {stockInfo.isDeficit ? '⚠️ Defisit stok di cabang asal: ' : '✓ Sisa di cabang asal: '}
                              <strong>{num(stockInfo.stock)} {stockInfo.unit}</strong>
                            </span>
                          ) : <span />}

                          {!isProd && isConvertible && isUsingUnitBeli && Number(item.input_qty) > 0 && (
                            <span style={{ color: 'var(--accent-bright)' }}>
                              ⚡ Terkonversi: <strong>{num(liveBaseQty)} {up}</strong> (1 {ub} = {num(factor)} {up})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* General Note */}
              <div className="form-group mb-4">
                <label className="form-label">Keterangan / Alasan Transfer (Opsional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: Stok menipis di cabang / persiapan promo akhir pekan"
                  value={formData.notes}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                />
              </div>

              <div className="flex-between">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ fontWeight: 800 }}
                >
                  {saving ? 'Mengirim & Memproses...' : (
                    <>
                      <Send size={14} /> Kirim & Cetak Surat Jalan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail & Surat Jalan (Print-Friendly) */}
      {detailModalOpen && selectedTransfer && (
        <div className="modal-backdrop" onClick={() => setDetailModalOpen(false)}>
          <div
            className="modal-content card"
            style={{ maxWidth: 740, width: '100%', margin: '20px', maxHeight: '92vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Actions Header */}
            <div className="flex-between mb-4 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="var(--accent-bright)" />
                <span style={{ fontSize: 15, fontWeight: 700 }}>
                  Surat Jalan Transfer Barang — {selectedTransfer.transfer_no}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(selectedTransfer.status === 'IN_TRANSIT' || selectedTransfer.status === 'PENDING') && (
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setDetailModalOpen(false);
                      openReceiveModal(selectedTransfer);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      fontWeight: 700
                    }}
                  >
                    <CheckCircle2 size={14} /> Terima Transfer
                  </button>
                )}
                <button
                  className="btn btn-primary btn-sm"
                  onClick={printDeliveryOrder}
                >
                  <Printer size={13} /> Cetak Surat Jalan
                </button>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => setDetailModalOpen(false)}
                  style={{ padding: 4 }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Printable Delivery Order Content */}
            <div
              id="printable-surat-jalan"
              style={{
                padding: '20px 24px',
                background: '#ffffff',
                color: '#1e293b',
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}
            >
              {/* Header Surat Jalan */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 14, marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#1e1b4b', letterSpacing: '-0.02em' }}>
                    {userBusinessName || currentBusiness?.name || 'MOVA POS'}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    Dokumen Resmi Transfer Barang Antar Cabang Internal Perusahaan
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#4f46e5' }}>
                    SURAT JALAN TRANSFER ANTAR CABANG
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                    {selectedTransfer.transfer_no}
                  </div>
                </div>
              </div>

              {/* Meta Grid (Source & Destination) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 12.5, marginBottom: 16 }}>
                <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                    Cabang Pengirim (Asal)
                  </div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>
                    {selectedTransfer.source_display_name || selectedTransfer.source_outlet?.name || selectedTransfer.source_name || 'Cabang Asal'}
                  </div>
                  <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>
                    PIC: {selectedTransfer.source_outlet?.pic_name || 'Kepala Cabang / Pengirim'} · Telp: {selectedTransfer.source_outlet?.phone || '—'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11.5, marginTop: 2 }}>
                    {selectedTransfer.source_outlet?.address || ''}
                  </div>
                </div>

                <div style={{ padding: '10px 12px', background: '#eef2ff', borderRadius: 6, border: '1px solid #c7d2fe' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', marginBottom: 4 }}>
                    Cabang Penerima (Tujuan)
                  </div>
                  <div style={{ fontWeight: 700, color: '#1e1b4b', fontSize: 13.5 }}>
                    {selectedTransfer.destination_display_name || selectedTransfer.destination_outlet?.name || selectedTransfer.destination_name || 'Cabang Tujuan'}
                  </div>
                  <div style={{ color: '#334155', fontSize: 12, marginTop: 2 }}>
                    PIC: {selectedTransfer.destination_outlet?.pic_name || 'Store Manager / Penerima'} · Telp: {selectedTransfer.destination_outlet?.phone || '—'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11.5, marginTop: 2 }}>
                    {selectedTransfer.destination_outlet?.address || ''}
                  </div>
                </div>
              </div>

              {/* Delivery Logistics */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#334155', padding: '6px 12px', background: '#f1f5f9', borderRadius: 6, marginBottom: 14 }}>
                <div><strong>Tanggal Kirim:</strong> {selectedTransfer.date}</div>
                <div><strong>Supir / Kurir:</strong> {selectedTransfer.driver_name || 'Kurir Internal'}</div>
                <div><strong>No. Kendaraan:</strong> {selectedTransfer.vehicle_no || '—'}</div>
                <div>
                  <strong>Status:</strong>{' '}
                  <span style={{
                    fontWeight: 700,
                    color: selectedTransfer.status === 'CANCELLED' ? '#ef4444' : selectedTransfer.status === 'COMPLETED' ? '#16a34a' : '#d97706'
                  }}>
                    {selectedTransfer.status === 'IN_TRANSIT' ? 'DALAM PERJALANAN (TRANSIT)' : selectedTransfer.status}
                  </span>
                </div>
              </div>

              {/* Audit Receive Info if completed */}
              {selectedTransfer.received_at && (
                <div style={{ fontSize: 11.5, color: '#047857', padding: '8px 12px', background: '#ecfdf5', borderRadius: 6, border: '1px solid #a7f3d0', marginBottom: 14 }}>
                  ✓ <strong>Telah Diterima Pada:</strong> {new Date(selectedTransfer.received_at).toLocaleString('id-ID')} oleh <strong>{selectedTransfer.received_by_name || 'Kasir/Staf Cabang Tujuan'}</strong>
                  {selectedTransfer.received_notes && <div style={{ marginTop: 2 }}><strong>Catatan Penerimaan:</strong> {selectedTransfer.received_notes}</div>}
                </div>
              )}

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 20 }}>
                <thead>
                  <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 40 }}>No</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', width: 75 }}>Tipe</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', width: 90 }}>Kode</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Nama Barang / Bahan</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: 90 }}>Jumlah</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', width: 80 }}>Satuan</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: 130 }}>Konversi Stok</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTransfer.items?.map((it, idx) => {
                    const isProd = it.item_type === 'PRODUCT';
                    const code = isProd ? (it.menu?.code || 'PRD') : (it.ingredient?.code || 'BB');
                    const name = isProd ? (it.menu?.name || it.item_name) : (it.ingredient?.name || it.item_name);
                    const hasConv = !isProd && it.input_unit && it.unit && it.input_unit !== it.unit;

                    return (
                      <tr key={it.id || idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: isProd ? '#dbeafe' : '#f1f5f9',
                            color: isProd ? '#1e40af' : '#475569'
                          }}>
                            {isProd ? 'Retail' : 'Bahan'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600, color: '#4f46e5' }}>
                          {code}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>
                          {name}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                          {num(it.input_qty || it.qty)}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#0f172a', fontWeight: 600 }}>
                          {it.input_unit || it.unit}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: hasConv ? '#4f46e5' : '#64748b', fontSize: 12 }}>
                          {hasConv ? `${num(it.qty)} ${it.unit}` : '— (Tetap)'}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#64748b', fontSize: 11.5 }}>
                          {it.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Notes */}
              {selectedTransfer.notes && (
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 20, padding: '6px 10px', background: '#f8fafc', borderRadius: 4, borderLeft: '3px solid #4f46e5' }}>
                  <strong>Catatan Khusus:</strong> {selectedTransfer.notes}
                </div>
              )}

              {/* Signatures */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 24, textAlign: 'center', fontSize: 12 }}>
                <div>
                  <div style={{ color: '#64748b', marginBottom: 45 }}>Diserahkan Oleh,</div>
                  <div style={{ fontWeight: 700, borderTop: '1px solid #94a3b8', paddingTop: 4, color: '#0f172a' }}>
                    ( {selectedTransfer.source_outlet?.pic_name || 'Petugas Cabang'} )
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Pengirim (Cabang Asal)</div>
                </div>

                <div>
                  <div style={{ color: '#64748b', marginBottom: 45 }}>Dibawa / Diantar Oleh,</div>
                  <div style={{ fontWeight: 700, borderTop: '1px solid #94a3b8', paddingTop: 4, color: '#0f172a' }}>
                    ( {selectedTransfer.driver_name || 'Kurir / Driver'} )
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Ekspedisi / Pengantar</div>
                </div>

                <div>
                  <div style={{ color: '#64748b', marginBottom: 45 }}>Diterima Oleh,</div>
                  <div style={{ fontWeight: 700, borderTop: '1px solid #94a3b8', paddingTop: 4, color: '#0f172a' }}>
                    ( {selectedTransfer.received_by_name || selectedTransfer.destination_outlet?.pic_name || 'Store Manager'} )
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Penerima (Cabang Tujuan)</div>
                </div>
              </div>
            </div>

            {/* Print CSS styles */}
            <style>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                #printable-surat-jalan, #printable-surat-jalan * {
                  visibility: visible;
                }
                #printable-surat-jalan {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  box-shadow: none !important;
                }
              }
            `}</style>
          </div>
        </div>
      )}
    </div>
  );
}
