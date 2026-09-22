import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Save, X, Edit2, Trash2, UtensilsCrossed, Check, Layers, Sliders,
  CheckSquare, Tag, Package, Scissors, Sparkles, AlertCircle, RefreshCw, Barcode, Info,
  Copy, Search, Calculator, TrendingUp, TrendingDown, Clock, Activity,
  ArrowUpRight, ArrowDownRight, FileSpreadsheet, History, Calendar, Filter, Store
} from 'lucide-react';
import api from '../api/client';
import { useOutlet } from '../context/OutletContext';
import {
  rupiah, num, LoadingState, PageHeader, AuditInfo, formatDateTime,
  SATUAN_PAKAI_OPTIONS, UnitSelect, SearchableSelect
} from '../components/ui';
import { getTodayStr } from '../utils/date';
import toast from 'react-hot-toast';

export default function MasterMenu() {
  const { outlets = [], activeOutletId } = useOutlet?.() || {};

  const [menus, setMenus] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [modifierGroups, setModifierGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('recipe'); // 'recipe' | 'modifiers' | 'hpp-history'
  const [selectedType, setSelectedType] = useState('ALL'); // 'ALL' | 'RECIPE' | 'DIRECT' | 'SERVICE'

  // State Riwayat HPP (Weighted Moving Average)
  const [hppHistoryData, setHppHistoryData] = useState(null);
  const [hppLoading, setHppLoading] = useState(false);
  const [hppOutletId, setHppOutletId] = useState(() => activeOutletId || 'ALL');
  const [hppDateFrom, setHppDateFrom] = useState('');
  const [hppDateTo, setHppDateTo] = useState('');

  // Quick Restock State for Direct Product
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [restockQty, setRestockQty] = useState(10);
  const [restockTotalCost, setRestockTotalCost] = useState('');
  const [restockCost, setRestockCost] = useState('');
  const [restocking, setRestocking] = useState(false);

  // Modal State for Add/Edit Menu
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [menuForm, setMenuForm] = useState({
    code: '',
    barcode: '',
    name: '',
    description: '',
    category: 'Main',
    item_type: 'RECIPE', // 'RECIPE' | 'DIRECT' | 'SERVICE'
    track_stock: true,
    stock: 0,
    min_stock: 5,
    price: '',
    cost_price: '',
    unit: 'porsi',
  });

  // Modal State for Modifier Group
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupMenuSearch, setGroupMenuSearch] = useState('');
  const [groupForm, setGroupForm] = useState({
    name: '',
    selection_type: 'SINGLE',
    is_required: false,
    menu_ids: [],
    options: [
      { name: '', price: 0, ingredient_id: '', qty: 0, unit: 'gram' }
    ]
  });

  const perlengkapanIngredients = useMemo(() => {
    return (ingredients || []).filter(i => {
      const cat = (i.category || '').toLowerCase();
      const name = (i.name || '').toLowerCase();
      return (
        cat.includes('perlengkapan') ||
        cat.includes('packaging') ||
        cat.includes('kemasan') ||
        cat.includes('cup') ||
        cat.includes('pipet') ||
        cat.includes('sedotan') ||
        cat.includes('tissue') ||
        name.includes('cup') ||
        name.includes('pipet') ||
        name.includes('sedotan') ||
        name.includes('tissue') ||
        name.includes('sealer')
      );
    });
  }, [ingredients]);

  const semiFinishedIngredients = useMemo(() => {
    return (ingredients || []).filter(i => i.type === 'SEMI_FINISHED');
  }, [ingredients]);

  const rawIngredients = useMemo(() => {
    const perlengkapanIds = new Set(perlengkapanIngredients.map(p => p.id));
    return (ingredients || []).filter(i => i.type !== 'SEMI_FINISHED' && !perlengkapanIds.has(i.id));
  }, [ingredients, perlengkapanIngredients]);

  // Kelompok item untuk SearchableSelect ala Select2
  const searchableIngredientGroups = useMemo(() => {
    const groups = [];

    if (perlengkapanIngredients.length > 0) {
      groups.push({
        group: 'Perlengkapan & Kemasan (Cup, Sedotan, Tissue, Tutup)',
        items: perlengkapanIngredients.map(i => ({
          value: i.id,
          label: i.name,
          code: i.code,
          category: i.category || 'Perlengkapan',
          badge: 'Perlengkapan',
          sublabel: `${rupiah((i.harga || 0) / Math.max(i.konversi || 1, 1))}/${i.unit_pakai}`,
          raw: i,
        })),
      });
    }

    if (semiFinishedIngredients.length > 0) {
      groups.push({
        group: 'Bahan Olahan (Prep / Semi-Finished)',
        items: semiFinishedIngredients.map(i => ({
          value: i.id,
          label: i.name,
          code: i.code,
          category: i.category || 'Bahan Olahan',
          badge: 'Olahan',
          sublabel: `${rupiah((i.harga || 0) / Math.max(i.konversi || 1, 1))}/${i.unit_pakai}`,
          raw: i,
        })),
      });
    }

    if (rawIngredients.length > 0) {
      groups.push({
        group: 'Bahan Baku Mentah (Raw Material)',
        items: rawIngredients.map(i => ({
          value: i.id,
          label: i.name,
          code: i.code,
          category: i.category || 'Bahan Mentah',
          badge: 'Mentah',
          sublabel: `${rupiah((i.harga || 0) / Math.max(i.konversi || 1, 1))}/${i.unit_pakai}`,
          raw: i,
        })),
      });
    }

    return groups;
  }, [perlengkapanIngredients, semiFinishedIngredients, rawIngredients]);

  const searchableModifierIngredientGroups = useMemo(() => {
    return [
      {
        group: '',
        items: [
          { value: '', label: '-- Tanpa Potong Bahan (Catatan / Rasa Saja) --', sublabel: null, badge: null }
        ]
      },
      ...searchableIngredientGroups
    ];
  }, [searchableIngredientGroups]);

  useEffect(() => { fetchAll(); }, []);

  const fetchHppHistory = async (menuId = selected?.id, targetOutletId = hppOutletId, from = hppDateFrom, to = hppDateTo) => {
    if (!menuId) return;
    setHppLoading(true);
    try {
      const params = {};
      if (targetOutletId && targetOutletId !== 'ALL' && targetOutletId !== 'all') {
        params.outlet_id = targetOutletId;
      }
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get(`/menus/${menuId}/hpp-history`, { params });
      setHppHistoryData(res.data);
    } catch (err) {
      console.error('Gagal memuat riwayat HPP:', err);
      toast.error('Gagal mengambil data riwayat HPP menu');
    } finally {
      setHppLoading(false);
    }
  };

  useEffect(() => {
    if (selected?.id && activeTab === 'hpp-history') {
      fetchHppHistory(selected.id, hppOutletId, hppDateFrom, hppDateTo);
    }
  }, [selected?.id, activeTab, hppOutletId]);

  const handleExportHppExcel = async () => {
    if (!hppHistoryData || !selected) return;
    try {
      toast.loading('Menyiapkan file Excel riwayat HPP...', { id: 'export-hpp' });
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const historyRows = [
        ['LAPORAN RIWAYAT PERUBAHAN HPP (WEIGHTED MOVING AVERAGE)'],
        ['Menu', selected.name],
        ['Kode Menu', selected.code],
        ['Kategori', selected.category || 'Main'],
        ['Harga Jual', selected.price || 0],
        ['HPP Saat Ini', hppHistoryData.current_hpp || 0],
        ['Margin Saat Ini (%)', `${hppHistoryData.current_margin_pct || 0}%`],
        ['Tanggal Cetak', new Date().toLocaleString('id-ID')],
        [],
        ['No', 'Tanggal', 'Cabang', 'Tipe Pemicu', 'HPP Sebelum', 'HPP Sesudah', 'Selisih (Rp)', 'Perubahan (%)', 'Margin Sebelum', 'Margin Sesudah', 'Bahan Pemicu', 'Catatan / Alasan', 'Petugas']
      ];

      (hppHistoryData.history || []).forEach((h, idx) => {
        historyRows.push([
          idx + 1,
          h.date || '',
          h.outlet?.name || 'Semua Cabang (Pusat)',
          h.trigger_type || '',
          h.hpp_before || 0,
          h.hpp_after || 0,
          h.diff || 0,
          `${h.percentage_change || 0}%`,
          `${h.margin_before_pct || 0}%`,
          `${h.margin_after_pct || 0}%`,
          h.ingredient_name || h.ingredient?.name || '-',
          h.notes || '',
          h.user?.name || '-'
        ]);
      });

      const wsHistory = XLSX.utils.aoa_to_sheet(historyRows);
      XLSX.utils.book_append_sheet(wb, wsHistory, 'Riwayat Perubahan HPP');

      if (hppHistoryData.ingredients_breakdown?.length > 0) {
        const breakdownRows = [
          ['KOMPOSISI BAHAN PEMBENTUK HPP TERKINI (1 PORSI)'],
          ['Menu', selected.name],
          ['Total HPP Porsi', hppHistoryData.current_hpp || 0],
          [],
          ['No', 'Bahan Baku / Komponen', 'Tipe', 'Takaran Porsi', 'Satuan', 'Harga Satuan Avg (Rp)', 'Subtotal Biaya (Rp)', 'Kontribusi (%)']
        ];

        hppHistoryData.ingredients_breakdown.forEach((b, idx) => {
          breakdownRows.push([
            idx + 1,
            b.name || '',
            b.type || '',
            b.qty || 0,
            b.unit || '',
            b.cost_per_unit || 0,
            b.subtotal || 0,
            `${b.contribution_pct || 0}%`
          ]);
        });

        const wsBreakdown = XLSX.utils.aoa_to_sheet(breakdownRows);
        XLSX.utils.book_append_sheet(wb, wsBreakdown, 'Komposisi Bahan');
      }

      XLSX.writeFile(wb, `Riwayat_HPP_${selected.code}_${selected.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
      toast.success('File Excel riwayat HPP berhasil diunduh!', { id: 'export-hpp' });
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengekspor riwayat HPP ke Excel', { id: 'export-hpp' });
    }
  };

  async function fetchAll(selectId = null) {
    try {
      const [m, i, mg] = await Promise.all([
        api.get('/menus'),
        api.get('/ingredients'),
        api.get('/modifier-groups')
      ]);
      setMenus(m.data);
      setIngredients(i.data);
      setModifierGroups(mg.data || []);
      if (selectId) {
        const found = m.data.find(item => item.id === selectId);
        if (found) setSelected(found);
      } else if (m.data.length && !selected) {
        setSelected(m.data[0]);
      } else if (selected) {
        const found = m.data.find(item => item.id === selected.id);
        setSelected(found || m.data[0] || null);
      }
    } catch {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }

  function getNextMenuCode() {
    if (!menus.length) return 'MN-001';
    const nums = menus
      .map(m => {
        const match = m.code?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return `MN-${String(max + 1).padStart(3, '0')}`;
  }

  function openCreateModal() {
    setModalMode('create');
    setMenuForm({
      code: getNextMenuCode(),
      barcode: '',
      name: '',
      description: '',
      category: 'Main',
      item_type: 'RECIPE',
      track_stock: true,
      stock: 0,
      min_stock: 5,
      price: '',
      cost_price: '',
      unit: 'porsi',
      bundle_items: [],
    });
    setModalOpen(true);
  }

  function openEditModal(menu) {
    setModalMode('edit');
    setMenuForm({
      code: menu.code,
      barcode: menu.barcode || '',
      name: menu.name,
      description: menu.description || '',
      category: menu.category || 'Main',
      item_type: menu.item_type || 'RECIPE',
      track_stock: menu.track_stock !== false,
      stock: menu.stock ?? 0,
      min_stock: menu.min_stock ?? 5,
      price: menu.price,
      cost_price: menu.cost_price ?? '',
      unit: menu.unit || (menu.item_type === 'DIRECT' ? 'pcs' : (menu.item_type === 'SERVICE' ? 'layanan' : (menu.item_type === 'BUNDLE' ? 'paket' : 'porsi'))),
      bundle_items: (menu.bundle_items || menu.bundleItems || []).map(bi => ({
        bundled_menu_id: bi.bundled_menu_id || bi.bundledMenu?.id || '',
        ingredient_id: bi.ingredient_id || '',
        qty: bi.qty || 1,
        unit: bi.unit || 'porsi'
      })),
    });
    setModalOpen(true);
  }

  function addBundleItem() {
    const firstOther = menus.find(m => m.id !== selected?.id) || menus[0];
    setMenuForm(f => ({
      ...f,
      bundle_items: [
        ...(f.bundle_items || []),
        {
          bundled_menu_id: firstOther ? firstOther.id : '',
          ingredient_id: '',
          qty: 1,
          unit: firstOther ? (firstOther.unit || 'porsi') : 'porsi'
        }
      ]
    }));
  }

  function removeBundleItem(idx) {
    setMenuForm(f => ({
      ...f,
      bundle_items: (f.bundle_items || []).filter((_, i) => i !== idx)
    }));
  }

  function updateBundleItem(idx, field, val) {
    setMenuForm(f => ({
      ...f,
      bundle_items: (f.bundle_items || []).map((bi, i) => {
        if (i !== idx) return bi;
        const updated = { ...bi, [field]: field === 'qty' ? Number(val) : val };
        if (field === 'bundled_menu_id') {
          const m = menus.find(item => item.id === Number(val));
          if (m) updated.unit = m.unit || 'porsi';
        }
        return updated;
      })
    }));
  }

  async function handleSaveMenu(e) {
    e.preventDefault();
    if (!menuForm.name.trim()) {
      toast.error('Nama produk/menu wajib diisi');
      return;
    }
    if (menuForm.price === '' || Number(menuForm.price) < 0) {
      toast.error('Harga jual tidak valid');
      return;
    }
    if (menuForm.item_type === 'BUNDLE') {
      const validItems = (menuForm.bundle_items || []).filter(bi => bi.bundled_menu_id || bi.ingredient_id);
      if (validItems.length === 0) {
        toast.error('Menu paket bundling harus memiliki minimal 1 item produk yang disertakan');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        ...menuForm,
        price: Number(menuForm.price),
        cost_price: menuForm.cost_price !== '' ? Number(menuForm.cost_price) : 0,
        stock: Number(menuForm.stock) || 0,
        min_stock: Number(menuForm.min_stock) || 0,
        bundle_items: menuForm.item_type === 'BUNDLE' ? (menuForm.bundle_items || []).map(bi => ({
          bundled_menu_id: bi.bundled_menu_id ? Number(bi.bundled_menu_id) : null,
          ingredient_id: bi.ingredient_id ? Number(bi.ingredient_id) : null,
          qty: Number(bi.qty) || 1,
          unit: bi.unit || null,
        })) : undefined,
      };

      if (modalMode === 'create') {
        const { data } = await api.post('/menus', payload);
        toast.success(`Produk "${data.name}" berhasil ditambahkan!`);
        setModalOpen(false);
        await fetchAll(data.id);
        // Otomatis ajak buat resep pertama hanya jika tipe RECIPE
        if (data.item_type === 'RECIPE') {
          setDraft([{ ingredient_id: ingredients[0]?.id || 1, qty: 100, unit: ingredients[0]?.unit_pakai || 'gram', waste_std: 0 }]);
        }
      } else {
        const { data } = await api.put(`/menus/${selected.id}`, payload);
        toast.success(`Produk "${data.name}" berhasil diperbarui!`);
        setModalOpen(false);
        await fetchAll(data.id);
      }
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(m => toast.error(m));
      else toast.error(err.response?.data?.message || 'Gagal menyimpan produk');
    } finally {
      setSaving(false);
    }
  }

  function handleRestockQtyChange(val) {
    const q = val;
    setRestockQty(q);
    const numQ = parseFloat(q) || 0;
    if (numQ > 0) {
      if (restockTotalCost !== '' && !isNaN(Number(restockTotalCost))) {
        setRestockCost(Number((parseFloat(restockTotalCost) / numQ).toFixed(2)));
      } else if (restockCost !== '' && !isNaN(Number(restockCost))) {
        setRestockTotalCost(Math.round(numQ * parseFloat(restockCost)));
      }
    }
  }

  function handleRestockTotalCostChange(val) {
    setRestockTotalCost(val);
    const numTot = parseFloat(val) || 0;
    const numQ = parseFloat(restockQty) || 0;
    if (numQ > 0 && val !== '') {
      setRestockCost(Number((numTot / numQ).toFixed(2)));
    } else if (val === '') {
      setRestockCost('');
    }
  }

  function handleRestockCostChange(val) {
    setRestockCost(val);
    const numUp = parseFloat(val) || 0;
    const numQ = parseFloat(restockQty) || 0;
    if (numQ > 0 && val !== '') {
      setRestockTotalCost(Math.round(numQ * numUp));
    } else if (val === '') {
      setRestockTotalCost('');
    }
  }

  async function handleQuickRestockDirect(e) {
    e.preventDefault();
    if (!selected) return;
    if (!restockQty || Number(restockQty) <= 0) {
      toast.error('Jumlah restock harus lebih dari 0');
      return;
    }

    setRestocking(true);
    try {
      await api.post(`/menus/${selected.id}/restock`, {
        qty: Number(restockQty),
        cost_price: restockCost !== '' ? Number(restockCost) : null,
        total_cost: restockTotalCost !== '' ? Number(restockTotalCost) : null,
      });
      toast.success(`Stok "${selected.name}" bertambah +${num(restockQty)} ${selected.unit || 'pcs'}!`);
      setRestockModalOpen(false);
      await fetchAll(selected.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menambah stok produk');
    } finally {
      setRestocking(false);
    }
  }

  async function handleDeleteMenu(menu) {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus menu "${menu.name}"?`)) return;
    try {
      await api.delete(`/menus/${menu.id}`);
      toast.success(`Menu "${menu.name}" dihapus`);
      setSelected(null);
      setDraft(null);
      await fetchAll();
    } catch {
      toast.error('Gagal menghapus menu');
    }
  }

  function openCreateGroupModal() {
    setEditingGroup(null);
    setGroupMenuSearch('');
    setGroupForm({
      name: '',
      selection_type: 'SINGLE',
      is_required: false,
      menu_ids: selected ? [selected.id] : [],
      options: [
        { name: '', price: 0, ingredient_id: '', qty: 0, unit: 'gram' },
        { name: '', price: 0, ingredient_id: '', qty: 0, unit: 'gram' }
      ]
    });
    setGroupModalOpen(true);
  }

  function openEditGroupModal(group) {
    setEditingGroup(group);
    setGroupMenuSearch('');
    setGroupForm({
      name: group.name,
      selection_type: group.selection_type || 'SINGLE',
      is_required: Boolean(group.is_required),
      menu_ids: (group.menus || []).map(m => m.id),
      options: (group.options || []).map(opt => ({
        id: opt.id,
        name: opt.name,
        price: opt.price || 0,
        ingredient_id: opt.ingredient_id || '',
        qty: opt.qty || 0,
        unit: opt.unit || 'gram',
      }))
    });
    setGroupModalOpen(true);
  }

  function openDuplicateGroupModal(group) {
    setEditingGroup(null);
    setGroupMenuSearch('');
    const currentType = group.selection_type || 'SINGLE';
    const targetType = currentType === 'SINGLE' ? 'MULTIPLE' : 'SINGLE';
    const typeLabel = targetType === 'SINGLE' ? 'Pilih 1 / Radio' : 'Bebas / Checkbox';

    setGroupForm({
      name: `${group.name} (${typeLabel})`,
      selection_type: targetType,
      is_required: targetType === 'SINGLE',
      menu_ids: [],
      options: (group.options || []).map(opt => ({
        name: opt.name,
        price: opt.price || 0,
        ingredient_id: opt.ingredient_id || '',
        qty: opt.qty || 0,
        unit: opt.unit || 'gram',
      }))
    });
    setGroupModalOpen(true);
    toast.success(`Duplikasi siap! Ubah nama, tipe pilihan, dan pilih menu tujuannya.`, { duration: 4000 });
  }

  function applyGroupPreset(type) {
    if (type === 'EXTRA_TOPPING') {
      setGroupForm(f => ({
        ...f,
        name: f.name.trim() ? f.name : 'Extra Topping Tambahan',
        selection_type: 'MULTIPLE',
        is_required: false,
      }));
      toast.success('Template Extra Topping (Banyak Pilihan / Checkbox) diterapkan');
    } else if (type === 'SINGLE_CHOICE') {
      setGroupForm(f => ({
        ...f,
        name: f.name.trim() ? f.name : 'Pilihan Topping / Saus Paket',
        selection_type: 'SINGLE',
        is_required: true,
      }));
      toast.success('Template Pilihan Tunggal Paket (Wajib 1 - Radio) diterapkan');
    } else if (type === 'LEVEL_PEDAS') {
      setGroupForm(f => ({
        ...f,
        name: f.name.trim() ? f.name : 'Level Pedas',
        selection_type: 'SINGLE',
        is_required: true,
      }));
      toast.success('Template Level Pedas (Wajib 1 - Radio) diterapkan');
    } else if (type === 'UKURAN_PORTION') {
      setGroupForm(f => ({
        ...f,
        name: f.name.trim() ? f.name : 'Ukuran Porsi',
        selection_type: 'SINGLE',
        is_required: true,
      }));
      toast.success('Template Ukuran Porsi (Wajib 1 - Radio) diterapkan');
    }
  }

  function addGroupOption() {
    setGroupForm(prev => ({
      ...prev,
      options: [
        ...prev.options,
        { name: '', price: 0, ingredient_id: '', qty: 0, unit: 'gram' }
      ]
    }));
  }

  function removeGroupOption(idx) {
    setGroupForm(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== idx)
    }));
  }

  function updateGroupOption(idx, field, val) {
    setGroupForm(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === idx ? {
        ...opt,
        [field]: field === 'price' || field === 'qty' ? Number(val) : val
      } : opt)
    }));
  }

  function toggleGroupMenu(menuId) {
    setGroupForm(prev => {
      const exists = prev.menu_ids.includes(menuId);
      return {
        ...prev,
        menu_ids: exists
          ? prev.menu_ids.filter(id => id !== menuId)
          : [...prev.menu_ids, menuId]
      };
    });
  }

  async function handleSaveModifierGroup(e) {
    e.preventDefault();
    if (!groupForm.name.trim()) {
      toast.error('Nama kelompok modifier wajib diisi (contoh: Level Pedas, Extra Topping)');
      return;
    }
    const validOptions = groupForm.options.filter(o => o.name.trim() !== '');
    if (validOptions.length === 0) {
      toast.error('Minimal harus ada 1 pilihan opsi varian');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: groupForm.name.trim(),
        selection_type: groupForm.selection_type,
        is_required: groupForm.is_required,
        min_selection: groupForm.is_required ? 1 : 0,
        max_selection: groupForm.selection_type === 'SINGLE' ? 1 : null,
        menu_ids: groupForm.menu_ids,
        options: validOptions.map((opt, idx) => ({
          name: opt.name.trim(),
          price: Number(opt.price) || 0,
          ingredient_id: opt.ingredient_id ? Number(opt.ingredient_id) : null,
          qty: Number(opt.qty) || 0,
          unit: opt.unit || null,
          sort_order: idx,
        })),
      };

      if (editingGroup) {
        await api.put(`/modifier-groups/${editingGroup.id}`, payload);
        toast.success(`Kelompok modifier "${payload.name}" berhasil diperbarui!`);
      } else {
        await api.post('/modifier-groups', payload);
        toast.success(`Kelompok modifier "${payload.name}" berhasil dibuat!`);
      }

      setGroupModalOpen(false);
      await fetchAll(selected?.id);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(m => toast.error(m));
      else toast.error(err.response?.data?.message || 'Gagal menyimpan kelompok modifier');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteModifierGroup(group) {
    if (!window.confirm(`Hapus kelompok modifier "${group.name}"? Pilihan ini tidak akan muncul lagi di menu.`)) return;
    try {
      await api.delete(`/modifier-groups/${group.id}`);
      toast.success(`Kelompok modifier "${group.name}" berhasil dihapus.`);
      await fetchAll(selected?.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus modifier');
    }
  }

  async function handleToggleMenuModifier(groupId) {
    if (!selected) return;
    const currentGroupIds = (selected.modifier_groups || []).map(g => g.id);
    const newGroupIds = currentGroupIds.includes(groupId)
      ? currentGroupIds.filter(id => id !== groupId)
      : [...currentGroupIds, groupId];

    try {
      await api.post(`/menus/${selected.id}/modifiers`, {
        modifier_group_ids: newGroupIds
      });
      toast.success('Varian menu diperbarui!');
      await fetchAll(selected.id);
    } catch {
      toast.error('Gagal memperbarui varian menu');
    }
  }

  const activeRecipe = selected?.recipes?.[0]; // version desc

  const isDirect = selected?.item_type === 'DIRECT';
  const isService = selected?.item_type === 'SERVICE';
  const isBundle = selected?.item_type === 'BUNDLE';
  const isRecipe = !isDirect && !isService && !isBundle;

  const estimatedHpp = Number(selected?.cost_price || 0);

  const bomHpp = activeRecipe
    ? (activeRecipe.items || []).reduce((sum, it) => {
        const ing = ingredients.find(i => i.id === it.ingredient_id);
        return ing ? sum + (Number(it.qty) || 0) * (Number(ing.harga || 0) / Math.max(Number(ing.konversi || 1), 1)) : sum;
      }, 0)
    : 0;

  const draftHpp = draft
    ? draft.reduce((sum, it) => {
        const ing = ingredients.find(i => i.id === it.ingredient_id);
        return ing ? sum + (Number(it.qty) || 0) * (Number(ing.harga || 0) / Math.max(Number(ing.konversi || 1), 1)) : sum;
      }, 0)
    : 0;

  const effectiveRecipeHpp = draft ? draftHpp : bomHpp;

  const hpp = isBundle
    ? (selected?.bundle_items || selected?.bundleItems || []).reduce((sum, bi) => {
        const bm = menus.find(m => m.id === (bi.bundled_menu_id || bi.bundledMenu?.id));
        if (bm) {
          const bmHpp = bm.item_type === 'DIRECT' || bm.item_type === 'SERVICE'
            ? Number(bm.cost_price || 0)
            : (bm.recipes?.[0] ? (bm.recipes[0].items || []).reduce((s, it) => {
                const ing = ingredients.find(i => i.id === it.ingredient_id);
                return ing ? s + it.qty * (ing.harga / (ing.konversi || 1)) : s;
              }, 0) : Number(bm.cost_price || 0));
          return sum + (Number(bi.qty || 1) * bmHpp);
        }
        return sum;
      }, 0)
    : (isDirect || isService
      ? estimatedHpp
      : (activeRecipe || draft ? effectiveRecipeHpp : estimatedHpp));

  const targetMarginPct = selected?.price > 0 && estimatedHpp > 0
    ? Math.round(((selected.price - estimatedHpp) / selected.price) * 100)
    : null;

  const marginPct = selected?.price > 0 ? Math.round(((selected.price - hpp) / selected.price) * 100) : 0;

  const targetGrossProfit = selected?.price > 0 && estimatedHpp > 0
    ? (selected.price - estimatedHpp)
    : null;

  const actualGrossProfit = selected?.price > 0
    ? (selected.price - hpp)
    : null;

  const hppDiff = isRecipe && (activeRecipe || draft) && estimatedHpp > 0
    ? (effectiveRecipeHpp - estimatedHpp)
    : 0;

  const profitDiff = targetGrossProfit !== null && actualGrossProfit !== null
    ? (actualGrossProfit - targetGrossProfit)
    : 0;

  function startEdit() {
    if (activeRecipe?.items?.length) {
      setDraft(activeRecipe.items.map(i => ({ ...i })));
    } else {
      const first = ingredients[0];
      setDraft(first ? [{ ingredient_id: first.id, qty: 100, unit: first.unit_pakai, waste_std: 0 }] : []);
    }
  }

  function addItem() {
    const first = ingredients[0];
    if (!first) return;
    setDraft(d => [...d, { ingredient_id: first.id, qty: 0, unit: first.unit_pakai, waste_std: 0 }]);
  }

  function updateDraft(idx, field, val) {
    setDraft(d => d.map((it, i) => i === idx
      ? { ...it, [field]: field === 'qty' || field === 'waste_std' ? Number(val) : val }
      : it
    ));
  }

  async function commitRecipe() {
    if (!draft || !draft.length) {
      toast.error('Resep harus memiliki minimal 1 bahan baku');
      return;
    }
    setSaving(true);
    try {
      const today = getTodayStr();
      await api.post(`/menus/${selected.id}/recipes`, {
        date: today,
        items: draft,
      });
      await fetchAll(selected.id);
      setDraft(null);
      toast.success('Resep (BOM) versi baru berhasil disimpan!');
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(m => toast.error(m));
      else toast.error('Gagal menyimpan recipe');
    } finally {
      setSaving(false);
    }
  }

  const filteredMenus = useMemo(() => {
    return menus.filter(m => {
      if (selectedType === 'ALL') return true;
      return (m.item_type || 'RECIPE') === selectedType;
    });
  }, [menus, selectedType]);

  if (loading) return <LoadingState />;

  return (
    <div className="fade-in">
      <PageHeader
        title="Master Produk & Menu (Universal POS)"
        subtitle="Kelola produk olahan resep (F&B/BOM), barang jadi retail langsung (stok & modal), dan jasa layanan non-stok."
        action={
          <button className="btn btn-primary" onClick={openCreateModal}>
            + Tambah Produk / Menu
          </button>
        }
      />

      <div className="grid-sidebar">
        {/* Menu List */}
        <div>
          {/* Type Filter Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: 'rgba(255,255,255,0.03)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
            {[
              { id: 'ALL', label: 'Semua' },
              { id: 'RECIPE', label: 'Resep' },
              { id: 'DIRECT', label: 'Retail' },
              { id: 'SERVICE', label: 'Jasa' },
              { id: 'BUNDLE', label: 'Paket' },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedType(t.id)}
                style={{
                  flex: 1,
                  padding: '5px 2px',
                  borderRadius: 6,
                  border: 'none',
                  background: selectedType === t.id ? 'var(--accent)' : 'transparent',
                  color: selectedType === t.id ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: selectedType === t.id ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Daftar Produk ({filteredMenus.length})
            </span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, padding: '3px 8px' }}
              onClick={openCreateModal}
            >
              + Tambah
            </button>
          </div>

          <div className="recipe-list">
            {filteredMenus.map(m => {
              const mIsDirect = m.item_type === 'DIRECT';
              const mIsService = m.item_type === 'SERVICE';
              const mStock = m.current_stock ?? m.stock ?? 0;

              return (
                <button
                  key={m.id}
                  className={`recipe-item${selected?.id === m.id ? ' active' : ''}`}
                  onClick={() => { setSelected(m); setDraft(null); }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="recipe-item-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {mIsDirect && <Package size={13} color="#60a5fa" />}
                      {mIsService && <Scissors size={13} color="#c084fc" />}
                      {m.item_type === 'BUNDLE' && <Layers size={13} color="#f43f5e" />}
                      {!mIsDirect && !mIsService && m.item_type !== 'BUNDLE' && <UtensilsCrossed size={13} color="#34d399" />}
                      <span>{m.name}</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 4 }}>
                      {m.code}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span className="recipe-item-price">{rupiah(m.price)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {mIsDirect && (
                        <span style={{
                          fontSize: 9.5,
                          background: mStock <= (m.min_stock || 0) ? 'rgba(244, 63, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: mStock <= (m.min_stock || 0) ? '#f43f5e' : '#93c5fd',
                          border: `1px solid ${mStock <= (m.min_stock || 0) ? 'rgba(244, 63, 94, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                          padding: '0 4px',
                          borderRadius: 4
                        }}>
                          Stok: {num(mStock)} {m.unit || 'pcs'}
                        </span>
                      )}
                      {mIsService && (
                        <span style={{
                          fontSize: 9.5,
                          background: 'rgba(168, 85, 247, 0.15)',
                          color: '#e9d5ff',
                          border: '1px solid rgba(168, 85, 247, 0.3)',
                          padding: '0 4px',
                          borderRadius: 4
                        }}>
                          Jasa
                        </span>
                      )}
                      {m.item_type === 'BUNDLE' && (
                        <span style={{
                          fontSize: 9.5,
                          background: 'rgba(244, 63, 94, 0.15)',
                          color: '#fda4af',
                          border: '1px solid rgba(244, 63, 94, 0.3)',
                          padding: '0 4px',
                          borderRadius: 4
                        }}>
                          🎁 Bundling
                        </span>
                      )}
                      {!mIsDirect && !mIsService && m.item_type !== 'BUNDLE' && (
                        <span style={{
                          fontSize: 9.5,
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#6ee7b7',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          padding: '0 4px',
                          borderRadius: 4
                        }}>
                          Resep
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Secondary Comparative Row: Estimasi HPP vs BOM HPP */}
                  {!mIsService && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 5,
                      paddingTop: 4,
                      borderTop: '1px dashed rgba(255, 255, 255, 0.06)',
                      fontSize: 10.5,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ color: 'var(--text-muted)' }} title="Estimasi HPP Dasar Target">
                          Est: <strong style={{ color: '#93c5fd' }}>{m.cost_price > 0 ? rupiah(m.cost_price) : '-'}</strong>
                        </span>
                        <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>·</span>
                        <span style={{ color: 'var(--text-muted)' }} title="HPP Resep (Kalkulasi BOM)">
                          BOM: <strong style={{ color: 'var(--accent-bright)' }}>
                            {(() => {
                              const r = m.recipes?.[0];
                              if (!r) return m.cost_price > 0 ? rupiah(m.cost_price) : '-';
                              const bCost = (r.items || []).reduce((s, it) => {
                                const ing = ingredients.find(i => i.id === it.ingredient_id);
                                return ing ? s + (Number(it.qty) || 0) * (Number(ing.harga || 0) / Math.max(Number(ing.konversi || 1), 1)) : s;
                              }, 0);
                              return rupiah(bCost);
                            })()}
                          </strong>
                        </span>
                      </div>
                      {m.cost_price > 0 && m.recipes?.[0] && (() => {
                        const r = m.recipes[0];
                        const bCost = (r.items || []).reduce((s, it) => {
                          const ing = ingredients.find(i => i.id === it.ingredient_id);
                          return ing ? s + (Number(it.qty) || 0) * (Number(ing.harga || 0) / Math.max(Number(ing.konversi || 1), 1)) : s;
                        }, 0);
                        const isHemat = bCost <= Number(m.cost_price);
                        return (
                          <span style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: isHemat ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                            color: isHemat ? '#34d399' : '#fb7185',
                            border: `1px solid ${isHemat ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                          }}>
                            {isHemat ? 'Hemat' : 'Over'}
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Recipe Detail */}
        {selected ? (
          <div className="card">
            <div className="flex-between mb-4" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{selected.name}</div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 8px', fontSize: 11 }}
                    onClick={() => openEditModal(selected)}
                    title="Edit info menu"
                  >
                    Edit Menu
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 8px', fontSize: 11, color: 'var(--danger)' }}
                    onClick={() => handleDeleteMenu(selected)}
                    title="Hapus menu"
                  >
                    Hapus
                  </button>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Kode: <span className="mono" style={{ color: 'var(--accent)' }}>{selected.code}</span> ·
                  Kategori: {selected.category || 'Main'} ·
                  Tipe: <span className="mono" style={{ color: isDirect ? '#60a5fa' : (isService ? '#c084fc' : (isBundle ? '#f43f5e' : '#34d399')), fontWeight: 700 }}>
                    {isDirect ? 'Barang Jadi (Retail)' : (isService ? 'Jasa / Layanan' : (isBundle ? '🎁 Menu Bundling / Buy 1 Get 1' : 'Olahan Resep (BOM)'))}
                  </span> ·
                  Harga Jual: <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rupiah(selected.price)}</span>
                  {isRecipe && (
                    <> · Resep aktif: <span className="mono" style={{ color: activeRecipe ? 'var(--ok)' : 'var(--warn)' }}>
                      {activeRecipe ? `Versi ${activeRecipe.version}` : 'Belum ada resep'}
                    </span></>
                  )}
                  {isDirect && (
                    <> · Stok: <strong className="mono" style={{ color: (selected.current_stock ?? selected.stock ?? 0) <= (selected.min_stock || 0) ? 'var(--danger)' : 'var(--ok)' }}>
                      {num(selected.current_stock ?? selected.stock ?? 0)} {selected.unit || 'pcs'}
                    </strong></>
                  )}
                </div>
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border-soft)', maxWidth: 460 }}>
                  <AuditInfo
                    createdAt={selected.created_at}
                    createdBy={selected.created_by_name}
                    updatedAt={selected.updated_at}
                    updatedBy={selected.updated_by_name}
                  />
                  {activeRecipe && (
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      Resep V{activeRecipe.version}: disusun {formatDateTime(activeRecipe.created_at)} {activeRecipe.created_by_name ? `oleh ${activeRecipe.created_by_name}` : ''}
                    </div>
                  )}
                </div>
              </div>
              {/* Header Cards Comparison: Estimasi HPP Dasar vs HPP Resep (BOM) vs Varians */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {/* Card 1: Estimasi HPP Dasar (Target Input) */}
                <div style={{
                  minWidth: 140,
                  textAlign: 'right',
                  background: 'rgba(59, 130, 246, 0.08)',
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                    <span style={{ fontSize: 10.5, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                      Estimasi HPP Dasar
                    </span>
                    <span className="pill" style={{ fontSize: 9, background: 'rgba(59, 130, 246, 0.2)', color: '#bfdbfe', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      Target
                    </span>
                  </div>
                  <div className="mono" style={{ fontWeight: 700, color: '#60a5fa', fontSize: 17, marginTop: 2 }}>
                    {estimatedHpp > 0 ? rupiah(estimatedHpp) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belum diset</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {targetMarginPct !== null ? `Target Margin: ${targetMarginPct}%` : 'Margin: -'}
                  </div>
                </div>

                {/* Card 2: HPP Resep (BOM) / Aktual */}
                <div style={{
                  minWidth: 140,
                  textAlign: 'right',
                  background: 'var(--accent-dim)',
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border-accent)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                      {isRecipe ? 'HPP Resep (BOM)' : 'HPP Aktual'}
                    </span>
                    <span className="pill pill-accent mono" style={{ fontSize: 9 }}>
                      {isRecipe ? 'Moving Avg' : 'Modal'}
                    </span>
                  </div>
                  <div className="mono" style={{ fontWeight: 700, color: 'var(--accent-bright)', fontSize: 17, marginTop: 2 }}>
                    {rupiah(hpp)}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    Aktual Margin: {marginPct}%
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTab('hpp-history');
                        fetchHppHistory(selected.id);
                      }}
                      style={{
                        padding: '2px 8px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: 6,
                        color: '#34d399',
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer'
                      }}
                      title="Lihat riwayat pergerakan HPP menu ini berdasarkan perubahan harga moving average bahan baku"
                    >
                      <Clock size={11} /> Riwayat HPP
                    </button>
                  </div>
                </div>

                {/* Card 3: Varians / Selisih (Khusus Menu Resep / Olahan) */}
                {isRecipe && (activeRecipe || draft) && (
                  <div style={{
                    minWidth: 140,
                    textAlign: 'right',
                    background: estimatedHpp > 0
                      ? (hppDiff <= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)')
                      : 'rgba(255, 255, 255, 0.03)',
                    padding: '9px 14px',
                    borderRadius: 10,
                    border: estimatedHpp > 0
                      ? (hppDiff <= 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(244, 63, 94, 0.3)')
                      : '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                      <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                        Varians HPP
                      </span>
                      {estimatedHpp > 0 && (
                        <span className="pill" style={{
                          fontSize: 9,
                          background: hppDiff <= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                          color: hppDiff <= 0 ? '#34d399' : '#fb7185',
                          border: `1px solid ${hppDiff <= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
                        }}>
                          {hppDiff <= 0 ? 'Hemat' : 'Over'}
                        </span>
                      )}
                    </div>
                    <div className="mono" style={{
                      fontWeight: 700,
                      color: estimatedHpp > 0 ? (hppDiff <= 0 ? '#34d399' : '#fb7185') : 'var(--text-muted)',
                      fontSize: 17,
                      marginTop: 2
                    }}>
                      {estimatedHpp > 0 ? (
                        hppDiff < 0 ? `-${rupiah(Math.abs(hppDiff))}` : (hppDiff > 0 ? `+${rupiah(hppDiff)}` : 'Rp0 (Sesuai)')
                      ) : (
                        '—'
                      )}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      {estimatedHpp > 0 ? (
                        hppDiff <= 0
                          ? `Lebih hemat ${Math.abs(Math.round((hppDiff / estimatedHpp) * 100))}%`
                          : `Lebih mahal ${Math.round((hppDiff / estimatedHpp) * 100)}%`
                      ) : (
                        'Set estimasi di edit menu'
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border)', marginBottom: 18, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setActiveTab('recipe')}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'recipe' ? '2px solid var(--accent)' : '2px solid transparent',
                  color: activeTab === 'recipe' ? 'var(--accent-bright)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <UtensilsCrossed size={15} /> Resep Standar (BOM)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('modifiers')}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'modifiers' ? '2px solid var(--accent)' : '2px solid transparent',
                  color: activeTab === 'modifiers' ? 'var(--accent-bright)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Layers size={15} /> Varian & Modifier (Level, Saus, Topping)
                {selected.modifier_groups && selected.modifier_groups.length > 0 && (
                  <span className="pill pill-accent mono" style={{ fontSize: 10 }}>
                    {selected.modifier_groups.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('hpp-history');
                  if (selected) fetchHppHistory(selected.id);
                }}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'hpp-history' ? '2px solid var(--accent)' : '2px solid transparent',
                  color: activeTab === 'hpp-history' ? 'var(--accent-bright)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <TrendingUp size={15} /> Riwayat & Tren HPP
                {hppHistoryData?.stats?.total_changes > 0 && (
                  <span className="pill pill-accent mono" style={{ fontSize: 10 }}>
                    {hppHistoryData.stats.total_changes}
                  </span>
                )}
              </button>
            </div>

            {/* ========================================================
                TAB 1: RESEP STANDAR (BOM)
               ======================================================== */}
            {activeTab === 'recipe' && (
              <>
                {!draft ? (
                  <>
                    {activeRecipe && activeRecipe.items?.length > 0 ? (
                      <>
                        <div className="table-wrap" style={{ marginBottom: 16 }}>
                          <table>
                            <thead>
                              <tr>
                                <th>Bahan Baku</th>
                                <th className="right">Gramasi Pakai</th>
                                <th>Satuan</th>
                                <th className="right">Waste Std</th>
                                <th className="right">Estimasi Cost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeRecipe.items.map((it, idx) => {
                                const ing = ingredients.find(i => i.id === it.ingredient_id);
                                const cost = ing ? it.qty * (ing.harga / (ing.konversi || 1)) : 0;
                                return (
                                  <tr key={idx}>
                                    <td style={{ fontWeight: 500 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span>{it.ingredient?.name || ing?.name || '?'}</span>
                                        {(it.ingredient?.type === 'SEMI_FINISHED' || ing?.type === 'SEMI_FINISHED') && (
                                          <span className="pill" style={{ fontSize: 9.5, background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                                            Olahan
                                          </span>
                                        )}
                                        {((it.ingredient?.category || ing?.category || '').toLowerCase().includes('perlengkapan')) && (
                                          <span className="pill" style={{ fontSize: 9.5, background: 'rgba(0, 177, 79, 0.15)', color: '#10d97a', border: '1px solid rgba(0, 177, 79, 0.3)' }}>
                                            Perlengkapan
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="mono right">{num(it.qty)}</td>
                                    <td>{it.unit}</td>
                                    <td className="mono right">{it.waste_std}%</td>
                                    <td className="mono right" style={{ color: 'var(--accent)', fontWeight: 600 }}>{rupiah(cost)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: 'rgba(255, 255, 255, 0.04)', fontWeight: 700 }}>
                                <td colSpan={4} style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: 12 }}>
                                  Total HPP Resep (Kalkulasi BOM):
                                </td>
                                <td className="mono right" style={{ color: 'var(--accent-bright)', fontSize: 14 }}>
                                  {rupiah(bomHpp)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* Komparasi Estimasi HPP Dasar vs HPP Resep (BOM) */}
                        <div style={{
                          marginBottom: 18,
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border)',
                          borderRadius: 12,
                          padding: '16px 20px',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-bright)' }}>
                                <Sliders size={16} />
                              </div>
                              <div>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#ffffff' }}>
                                  Perbandingan Target Estimasi HPP vs Kalkulasi Resep (BOM)
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                  Evaluasi apakah komposisi bahan baku riil lebih hemat atau melebihi estimasi modal yang Anda rencanakan.
                                </div>
                              </div>
                            </div>
                            {estimatedHpp > 0 ? (
                              <span className="pill" style={{
                                fontSize: 11,
                                padding: '4px 10px',
                                fontWeight: 700,
                                background: hppDiff <= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                                color: hppDiff <= 0 ? '#34d399' : '#fb7185',
                                border: `1px solid ${hppDiff <= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                              }}>
                                {hppDiff < 0
                                  ? `Efisien: Hemat ${rupiah(Math.abs(hppDiff))} / ${selected.unit || 'porsi'}`
                                  : (hppDiff > 0 ? `Over Budget: +${rupiah(hppDiff)} / ${selected.unit || 'porsi'}` : 'Tepat Sesuai Anggaran')}
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: 11.5, color: '#60a5fa' }}
                                onClick={() => openEditModal(selected)}
                              >
                                Set Estimasi HPP Dasar
                              </button>
                            )}
                          </div>

                          <div className="table-wrap" style={{ border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 8 }}>
                            <table style={{ margin: 0 }}>
                              <thead>
                                <tr style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                                  <th style={{ fontSize: 11.5 }}>Parameter Evaluasi</th>
                                  <th className="right" style={{ fontSize: 11.5, color: '#93c5fd' }}>Estimasi HPP Dasar (Target)</th>
                                  <th className="right" style={{ fontSize: 11.5, color: 'var(--accent-bright)' }}>HPP Resep (BOM Riil)</th>
                                  <th className="right" style={{ fontSize: 11.5 }}>Selisih / Varians</th>
                                  <th className="center" style={{ fontSize: 11.5, width: 140 }}>Kesimpulan Margin</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td style={{ fontWeight: 600 }}>
                                    Biaya Pokok (HPP / {selected.unit || 'porsi'})
                                  </td>
                                  <td className="mono right" style={{ fontWeight: 600, color: '#93c5fd' }}>
                                    {estimatedHpp > 0 ? rupiah(estimatedHpp) : <span style={{ color: 'var(--text-muted)' }}>Belum diset</span>}
                                  </td>
                                  <td className="mono right" style={{ fontWeight: 700, color: 'var(--accent-bright)' }}>
                                    {rupiah(bomHpp)}
                                  </td>
                                  <td className="mono right" style={{ fontWeight: 700, color: estimatedHpp > 0 ? (hppDiff <= 0 ? '#34d399' : '#fb7185') : 'var(--text-muted)' }}>
                                    {estimatedHpp > 0 ? (
                                      hppDiff < 0 ? `-${rupiah(Math.abs(hppDiff))} (${Math.abs(Math.round((hppDiff / estimatedHpp) * 100))}%)` :
                                      (hppDiff > 0 ? `+${rupiah(hppDiff)} (+${Math.round((hppDiff / estimatedHpp) * 100)}%)` : 'Rp0 (0%)')
                                    ) : '-'}
                                  </td>
                                  <td className="center">
                                    {estimatedHpp > 0 ? (
                                      <span style={{ fontSize: 11, fontWeight: 600, color: hppDiff <= 0 ? '#34d399' : '#fb7185' }}>
                                        {hppDiff <= 0 ? 'Lebih Murah' : 'Lebih Mahal'}
                                      </span>
                                    ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>-</span>}
                                  </td>
                                </tr>
                                <tr>
                                  <td style={{ fontWeight: 600 }}>
                                    Laba Kotor (Gross Profit / {selected.unit || 'porsi'})
                                  </td>
                                  <td className="mono right" style={{ color: '#93c5fd' }}>
                                    {targetGrossProfit !== null ? rupiah(targetGrossProfit) : '-'}
                                  </td>
                                  <td className="mono right" style={{ fontWeight: 700, color: 'var(--ok)' }}>
                                    {actualGrossProfit !== null ? rupiah(actualGrossProfit) : '-'}
                                  </td>
                                  <td className="mono right" style={{ fontWeight: 700, color: profitDiff >= 0 ? '#34d399' : '#fb7185' }}>
                                    {targetGrossProfit !== null && actualGrossProfit !== null ? (
                                      profitDiff >= 0 ? `+${rupiah(profitDiff)}` : `-${rupiah(Math.abs(profitDiff))}`
                                    ) : '-'}
                                  </td>
                                  <td className="center">
                                    {targetGrossProfit !== null && actualGrossProfit !== null ? (
                                      <span style={{ fontSize: 11, fontWeight: 600, color: profitDiff >= 0 ? '#34d399' : '#fb7185' }}>
                                        {profitDiff >= 0 ? '↑ Profit Naik' : '↓ Profit Turun'}
                                      </span>
                                    ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>-</span>}
                                  </td>
                                </tr>
                                <tr>
                                  <td style={{ fontWeight: 600 }}>
                                    Gross Profit Margin (%)
                                  </td>
                                  <td className="mono right" style={{ color: '#93c5fd' }}>
                                    {targetMarginPct !== null ? `${targetMarginPct}%` : '-'}
                                  </td>
                                  <td className="mono right" style={{ fontWeight: 700, color: 'var(--ok)' }}>
                                    {marginPct}%
                                  </td>
                                  <td className="mono right" style={{ fontWeight: 700, color: targetMarginPct !== null ? (marginPct >= targetMarginPct ? '#34d399' : '#fb7185') : 'var(--text-muted)' }}>
                                    {targetMarginPct !== null ? (
                                      `${marginPct >= targetMarginPct ? '+' : ''}${marginPct - targetMarginPct}%`
                                    ) : '-'}
                                  </td>
                                  <td className="center">
                                    {targetMarginPct !== null ? (
                                      <span style={{ fontSize: 11, fontWeight: 600, color: marginPct >= targetMarginPct ? '#34d399' : '#fb7185' }}>
                                        {marginPct >= targetMarginPct ? '★ Margin Sehat' : '⚠ Perlu Ditinjau'}
                                      </span>
                                    ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>-</span>}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                          <button className="btn btn-primary" onClick={startEdit}>
                            + Revisi Resep (Versi Baru)
                          </button>
                        </div>
                      </>
                    ) : isBundle ? (
                      <div style={{
                        padding: '24px 20px',
                        background: 'rgba(244, 63, 94, 0.05)',
                        border: '1px solid rgba(244, 63, 94, 0.25)',
                        borderRadius: 12,
                        marginBottom: 16
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(244, 63, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e' }}>
                            <Layers size={22} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 16, color: '#ffffff' }}>
                              🎁 Menu Paket Bundling / Promo Buy 1 Get 1
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                              Paket bundling ini berisi beberapa item produk. Setiap kali paket ini dipesan di kasir POS, sistem otomatis menelusuri resep & memotong stok bahan baku dari seluruh item di dalamnya.
                            </div>
                          </div>
                        </div>

                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#ffffff' }}>
                          Rincian Komponen Produk Dalam Paket:
                        </div>

                        {(!selected.bundle_items && !selected.bundleItems) || (selected.bundle_items || selected.bundleItems).length === 0 ? (
                          <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                            Belum ada item di dalam paket bundling ini. Klik "Edit Menu" di atas untuk menambahkan komponen paket.
                          </div>
                        ) : (
                          <div className="table-wrap mb-3">
                            <table>
                              <thead>
                                <tr>
                                  <th>Item Komponen</th>
                                  <th className="center" style={{ width: 100 }}>Tipe Item</th>
                                  <th className="right" style={{ width: 110 }}>Jumlah Qty</th>
                                  <th className="right" style={{ width: 130 }}>Estimasi HPP/Cost</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(selected.bundle_items || selected.bundleItems || []).map((bi, idx) => {
                                  const bm = bi.bundledMenu || menus.find(m => m.id === bi.bundled_menu_id);
                                  const bmHpp = bm ? (bm.item_type === 'DIRECT' || bm.item_type === 'SERVICE' ? Number(bm.cost_price || 0) : (bm.recipes?.[0] ? (bm.recipes[0].items || []).reduce((s, it) => {
                                    const ing = ingredients.find(i => i.id === it.ingredient_id);
                                    return ing ? s + it.qty * (ing.harga / (ing.konversi || 1)) : s;
                                  }, 0) : Number(bm.cost_price || 0))) : 0;
                                  const totalBiHpp = (Number(bi.qty || 1) * bmHpp);

                                  return (
                                    <tr key={idx}>
                                      <td style={{ fontWeight: 600, color: '#ffffff' }}>
                                        {bm ? bm.name : (bi.ingredient?.name || `Item #${bi.bundled_menu_id || bi.ingredient_id}`)}
                                      </td>
                                      <td className="center">
                                        <span className="pill" style={{ fontSize: 9.5, background: bm?.item_type === 'DIRECT' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: bm?.item_type === 'DIRECT' ? '#93c5fd' : '#6ee7b7' }}>
                                          {bm?.item_type === 'DIRECT' ? 'Retail' : 'Olahan'}
                                        </span>
                                      </td>
                                      <td className="mono right" style={{ fontWeight: 700 }}>
                                        {num(bi.qty)} {bi.unit || bm?.unit || 'porsi'}
                                      </td>
                                      <td className="mono right" style={{ color: 'var(--accent-bright)', fontWeight: 600 }}>
                                        {rupiah(totalBiHpp)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : isDirect ? (
                      <div style={{
                        padding: '28px 24px',
                        background: 'rgba(59, 130, 246, 0.05)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        borderRadius: 12,
                        marginBottom: 16
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                            <Package size={24} />
                          </div>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
                              Produk Barang Jadi / Retail (Direct Stock)
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              Produk ini tidak memerlukan resep bahan baku. Stok produk dipotong langsung setiap transaksi kasir.
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
                          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stok Saat Ini</div>
                            <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: (selected.current_stock ?? selected.stock ?? 0) <= (selected.min_stock || 0) ? '#f43f5e' : '#34d399', marginTop: 2 }}>
                              {num(selected.current_stock ?? selected.stock ?? 0)} {selected.unit || 'pcs'}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stok Minimum Alert</div>
                            <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>
                              {num(selected.current_min_stock ?? selected.min_stock ?? 0)} {selected.unit || 'pcs'}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Harga Modal Beli (HPP)</div>
                            <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa', marginTop: 2 }}>
                              {rupiah(selected.cost_price || 0)}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Profit Kotor / Unit</div>
                            <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: '#10b981', marginTop: 2 }}>
                              {rupiah(selected.price - (selected.cost_price || 0))} ({marginPct}%)
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                              const defaultQ = 10;
                              const defaultCost = selected.cost_price || '';
                              setRestockQty(defaultQ);
                              setRestockCost(defaultCost);
                              setRestockTotalCost(defaultCost ? Math.round(defaultQ * Number(defaultCost)) : '');
                              setRestockModalOpen(true);
                            }}
                          >
                            + Tambah Stok Cepat (Restock)
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => openEditModal(selected)}
                          >
                            Ubah Data Retail
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={startEdit}
                            style={{ fontSize: 12 }}
                            title="Jika ingin menambahkan komposisi bahan baku opsional"
                          >
                            + Tambah Resep Bahan (Opsional)
                          </button>
                        </div>
                      </div>
                    ) : isService ? (
                      <div style={{
                        padding: '28px 24px',
                        background: 'rgba(168, 85, 247, 0.05)',
                        border: '1px solid rgba(168, 85, 247, 0.25)',
                        borderRadius: 12,
                        marginBottom: 16
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc' }}>
                            <Scissors size={24} />
                          </div>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
                              Produk Jasa & Layanan (Non-Stok Fisik)
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              Layanan ini tidak memiliki batasan stok fisik. Selalu tersedia di kasir untuk transaksi langsung.
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
                          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tarif / Harga Jual</div>
                            <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ok)', marginTop: 2 }}>
                              {rupiah(selected.price)}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Biaya Modal / Fee Petugas</div>
                            <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: '#c084fc', marginTop: 2 }}>
                              {rupiah(selected.cost_price || 0)}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Status Ketersediaan</div>
                            <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
                              ✓ Selalu Tersedia
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => openEditModal(selected)}
                        >
                          Ubah Data Layanan
                        </button>
                      </div>
                    ) : (
                      <div style={{
                        padding: '36px 20px',
                        textAlign: 'center',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px dashed var(--border-strong)',
                        borderRadius: 12,
                        marginBottom: 16
                      }}>
                        <UtensilsCrossed size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Menu ini belum memiliki Resep (BOM)</div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 16px' }}>
                          Tentukan bahan baku dan gramasi standar yang dipakai saat menu ini dipesan pelanggan agar sistem dapat menghitung pemakaian stok otomatis.
                        </p>
                        <button className="btn btn-primary" onClick={startEdit}>
                          Tentukan Resep Sekarang
                        </button>
                      </div>
                    )}

                    {selected.recipes?.length > 1 && (
                      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                        <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Histori Versi Resep:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {selected.recipes.map(v => (
                            <div
                              key={v.id}
                              className="mono"
                              style={{
                                padding: '4px 10px',
                                background: v.id === activeRecipe?.id ? 'var(--accent-dim)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${v.id === activeRecipe?.id ? 'var(--border-accent)' : 'var(--border)'}`,
                                borderRadius: 6,
                                fontSize: 12,
                                color: v.id === activeRecipe?.id ? 'var(--accent-bright)' : 'var(--text-secondary)'
                              }}
                            >
                              v{v.version} ({v.date}) {v.id === activeRecipe?.id && '● Aktif'}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{
                      padding: '10px 14px',
                      background: 'var(--accent-dim)',
                      border: '1px solid var(--border-accent)',
                      borderRadius: 8,
                      marginBottom: 14,
                      fontSize: 12.5
                    }}>
                      <strong style={{ color: 'var(--accent-bright)' }}>Mode Input Resep:</strong> Tentukan komposisi bahan dan gramasi. Setiap kali disimpan, sistem otomatis mencatat sebagai versi resep baru.
                    </div>

                    {/* Live Comparison Cards in Draft Mode */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 10,
                      marginBottom: 14,
                    }}>
                      <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 600 }}>ESTIMASI HPP DASAR (TARGET)</div>
                        <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: '#60a5fa', marginTop: 2 }}>
                          {estimatedHpp > 0 ? rupiah(estimatedHpp) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belum diset</span>}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Target Margin: {targetMarginPct !== null ? `${targetMarginPct}%` : '-'}</div>
                      </div>
                      <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, color: 'var(--accent-bright)', fontWeight: 600 }}>HPP RESEP DRAFT (LIVE)</div>
                        <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-bright)', marginTop: 2 }}>
                          {rupiah(draftHpp)}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Margin Aktual: {marginPct}%</div>
                      </div>
                      <div style={{
                        background: estimatedHpp > 0
                          ? (hppDiff <= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)')
                          : 'rgba(255, 255, 255, 0.03)',
                        border: estimatedHpp > 0
                          ? (hppDiff <= 0 ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(244, 63, 94, 0.25)')
                          : '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '10px 14px',
                      }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>SELISIH ANGGARAN</div>
                        <div className="mono" style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: estimatedHpp > 0 ? (hppDiff <= 0 ? '#34d399' : '#fb7185') : 'var(--text-muted)',
                          marginTop: 2
                        }}>
                          {estimatedHpp > 0 ? (
                            hppDiff < 0 ? `-${rupiah(Math.abs(hppDiff))}` : (hppDiff > 0 ? `+${rupiah(hppDiff)}` : 'Rp0 (Sesuai)')
                          ) : '—'}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                          {estimatedHpp > 0 ? (hppDiff <= 0 ? '🟢 Masih dalam batas target' : '⚠️ Melebihi estimasi target!') : 'Target belum diset'}
                        </div>
                      </div>
                    </div>

                    <div className="table-wrap" style={{ marginBottom: 14 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Bahan Baku</th>
                            <th className="right" style={{ width: 110 }}>Gramasi Pakai</th>
                            <th style={{ width: 90 }}>Satuan</th>
                            <th className="right" style={{ width: 90 }}>Waste Std %</th>
                            <th style={{ width: 50 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {draft.map((it, idx) => (
                            <tr key={idx}>
                              <td style={{ minWidth: 260 }}>
                                <SearchableSelect
                                  value={it.ingredient_id}
                                  onChange={(selectedId, selectedObj) => {
                                    const val = Number(selectedId);
                                    const ing = selectedObj?.raw || ingredients.find(i => i.id === val);
                                    updateDraft(idx, 'ingredient_id', val);
                                    if (ing) updateDraft(idx, 'unit', ing.unit_pakai);
                                  }}
                                  options={searchableIngredientGroups}
                                  placeholder="-- Cari Bahan Baku / Perlengkapan --"
                                  searchPlaceholder="Cari cup, pipet, susu, kopi..."
                                  size="sm"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control mono right"
                                  style={{ padding: '6px 10px', fontSize: 12.5 }}
                                  value={it.qty}
                                  onChange={e => updateDraft(idx, 'qty', e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td>
                                <UnitSelect
                                  options={SATUAN_PAKAI_OPTIONS}
                                  style={{ padding: '6px 10px', fontSize: 12.5, minWidth: 85 }}
                                  value={it.unit}
                                  onChange={val => updateDraft(idx, 'unit', val)}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control mono right"
                                  style={{ padding: '6px 10px', fontSize: 12.5 }}
                                  value={it.waste_std}
                                  onChange={e => updateDraft(idx, 'waste_std', e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td className="center">
                                <button
                                  className="btn btn-ghost btn-sm"
                                  style={{ color: 'var(--danger)', padding: '5px 8px' }}
                                  onClick={() => setDraft(d => d.filter((_, i) => i !== idx))}
                                  title="Hapus baris bahan"
                                >
                                  <X size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <button className="btn btn-secondary" onClick={addItem}>
                        + Tambah Bahan
                      </button>
                      <button className="btn btn-primary" onClick={commitRecipe} disabled={saving}>
                        {saving ? 'Menyimpan...' : 'Simpan Versi Resep'}
                      </button>
                      <button className="btn btn-ghost" onClick={() => setDraft(null)} disabled={saving}>
                        Batal
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ========================================================
                TAB 2: VARIAN & MODIFIER (LEVEL, SAUS, TOPPING)
               ======================================================== */}
            {activeTab === 'modifiers' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Layers size={16} color="var(--accent)" /> Varian & Topping Menu "{selected.name}"
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                      Atur opsi seperti Level Pedas, Pilihan Saus, Ukuran, atau Topping Tambahan yang otomatis memotong stok bahan baku terkait saat dipesan di kasir.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={openCreateGroupModal}
                  >
                    + Buat Kelompok Modifier Baru
                  </button>
                </div>

                {/* Panduan Visual Kasus Populer */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#a5b4fc', fontWeight: 700, fontSize: 13 }}>
                    <Sparkles size={15} color="var(--accent-bright)" /> Panduan Penting Pengaturan Varian & Topping:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#93c5fd', marginBottom: 2 }}>
                        🥣 1. Topping dari 2 Bahan atau Lebih (Saus Keju, Sambal Spesial, dll)?
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        Gunakan <strong>🟣 Bahan Olahan (Setengah Jadi)</strong> yang dibuat di menu <em>Master Bahan</em> & diproduksi di <em>Produksi Batch</em>. Saat kasir memilih topping ini, sistem otomatis memotong seluruh bahan mentah penyusunnya di dapur.
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#fde68a', marginBottom: 2 }}>
                        🔀 2. Menu Reguler Checkbox (Bebas), tapi Menu Paket Radio (Pilih 1)?
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        Gunakan tombol <strong>"Duplikasi"</strong> pada kelompok yang sudah ada! Anda bisa membuat versi <em>Radio (Pilih 1)</em> untuk Menu Paket dari daftar topping yang sama tanpa perlu mengetik ulang pilihan atau bahan bakunya.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 1: Checkbox selector of all modifier groups for this menu */}
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 20
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Aktifkan Kelompok Modifier pada Menu Ini:
                  </div>
                  {modifierGroups.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 18, color: 'var(--text-muted)', fontSize: 12.5 }}>
                      Belum ada kelompok modifier yang dibuat. Klik tombol <strong>"+ Buat Kelompok Modifier Baru"</strong> di atas.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {modifierGroups.map(grp => {
                        const isAssigned = (selected.modifier_groups || []).some(g => g.id === grp.id);
                        return (
                          <button
                            key={grp.id}
                            type="button"
                            onClick={() => handleToggleMenuModifier(grp.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 14px',
                              borderRadius: 8,
                              cursor: 'pointer',
                              border: isAssigned ? '1px solid var(--border-accent)' : '1px solid var(--border)',
                              background: isAssigned ? 'var(--accent-dim)' : 'rgba(255,255,255,0.03)',
                              color: isAssigned ? 'var(--accent-bright)' : 'var(--text-secondary)',
                              fontWeight: 600,
                              fontSize: 12.5,
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <span style={{
                              width: 16, height: 16, borderRadius: 4,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: isAssigned ? 'none' : '1px solid var(--border-strong)',
                              background: isAssigned ? 'var(--accent)' : 'transparent',
                              color: '#fff', fontSize: 11
                            }}>
                              {isAssigned && '✓'}
                            </span>
                            <span>{grp.name}</span>
                            <span style={{ fontSize: 11, opacity: 0.7 }}>
                              ({grp.options?.length || 0} opsi · {grp.selection_type === 'SINGLE' ? 'Radio' : 'Multi'})
                            </span>
                            {grp.is_required && (
                              <span className="pill pill-warn" style={{ fontSize: 9.5, padding: '1px 5px' }}>Wajib</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Section 2: Detailed preview of active modifiers on this menu */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 10 }}>
                    Detail Pilihan Varian Aktif ({selected.modifier_groups?.length || 0} kelompok aktif):
                  </div>

                  {!selected.modifier_groups || selected.modifier_groups.length === 0 ? (
                    <div style={{
                      padding: 24,
                      textAlign: 'center',
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px dashed var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-muted)',
                      fontSize: 12.5
                    }}>
                      Menu ini belum memiliki varian/opsi aktif. Centang kelompok modifier di atas untuk mengaktifkannya pada menu ini.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {selected.modifier_groups.map(grp => (
                        <div key={grp.id} style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          padding: 14
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 800, fontSize: 14, color: '#ffffff' }}>{grp.name}</span>
                              <span className="badge badge-info" style={{ fontSize: 10.5 }}>
                                {grp.selection_type === 'SINGLE' ? '🔘 Pilihan Tunggal (Radio)' : '☑️ Banyak Pilihan (Checkbox)'}
                              </span>
                              {grp.is_required ? (
                                <span className="pill pill-warn" style={{ fontSize: 10 }}>Wajib Dipilih</span>
                              ) : (
                                <span className="pill" style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>Opsional</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => openDuplicateGroupModal(grp)}
                                style={{ fontSize: 11, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                                title="Duplikasi kelompok ini (misal: buat versi Radio untuk Menu Paket atau Checkbox untuk Reguler)"
                              >
                                <Copy size={12} /> Duplikasi ke Tipe Lain
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => openEditGroupModal(grp)}
                                style={{ fontSize: 11, padding: '3px 8px' }}
                              >
                                Edit Kelompok
                              </button>
                            </div>
                          </div>

                          {/* Options Table */}
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Nama Opsi</th>
                                  <th className="right" style={{ width: 130 }}>Tambahan Harga</th>
                                  <th>Bahan Tambahan Terkait</th>
                                  <th className="right" style={{ width: 140 }}>Potongan Stok</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(grp.options || []).map(opt => (
                                  <tr key={opt.id}>
                                    <td style={{ fontWeight: 600, color: '#ffffff' }}>
                                      {opt.name}
                                    </td>
                                    <td className="mono right" style={{ color: opt.price > 0 ? 'var(--ok)' : 'var(--text-muted)', fontWeight: 600 }}>
                                      {opt.price > 0 ? `+${rupiah(opt.price)}` : 'Gratis'}
                                    </td>
                                    <td>
                                      {opt.ingredient ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <span style={{ color: 'var(--accent-bright)' }}>{opt.ingredient.name}</span>
                                          {opt.ingredient.type === 'SEMI_FINISHED' ? (
                                            <span className="pill" style={{ fontSize: 9, background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>Olahan</span>
                                          ) : (opt.ingredient.category || '').toLowerCase().includes('perlengkapan') ? (
                                            <span className="pill" style={{ fontSize: 9, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>Perlengkapan</span>
                                          ) : (
                                            <span className="pill" style={{ fontSize: 9, background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7' }}>Mentah</span>
                                          )}
                                        </div>
                                      ) : (
                                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 11.5 }}>
                                          Tanpa potong bahan baku
                                        </span>
                                      )}
                                    </td>
                                    <td className="mono right" style={{ color: opt.ingredient_id && opt.qty > 0 ? 'var(--warn)' : 'var(--text-muted)' }}>
                                      {opt.ingredient_id && opt.qty > 0 ? `-${num(opt.qty)} ${opt.unit || opt.ingredient?.unit_pakai || ''}` : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 3: All modifier groups catalog */}
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Semua Kelompok Modifier Bisnis ({modifierGroups.length})
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {modifierGroups.map(grp => (
                      <div key={grp.id} style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: 12
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div>
                            <strong style={{ fontSize: 13, color: '#ffffff' }}>{grp.name}</strong>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {grp.selection_type === 'SINGLE' ? '🔘 Radio (Pilih 1)' : '☑️ Multi (Checkbox)'} · {grp.is_required ? 'Wajib' : 'Opsional'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '2px 6px', fontSize: 11 }}
                              onClick={() => openDuplicateGroupModal(grp)}
                              title="Duplikasi kelompok modifier ini"
                            >
                              <Copy size={12} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '2px 6px', fontSize: 11 }}
                              onClick={() => openEditGroupModal(grp)}
                              title="Edit kelompok modifier"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '2px 6px', fontSize: 11, color: 'var(--danger)' }}
                              onClick={() => handleDeleteModifierGroup(grp)}
                              title="Hapus kelompok modifier"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          Dipakai oleh <strong>{grp.menus?.length || 0}</strong> menu resto
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================
                TAB 3: RIWAYAT & TREN HPP (WEIGHTED MOVING AVERAGE)
               ======================================================== */}
            {activeTab === 'hpp-history' && (
              <div style={{ animation: 'fadeIn 0.25s ease' }}>
                {/* Header Banner & Controls */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 16,
                  flexWrap: 'wrap',
                  gap: 12
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: 'rgba(16, 185, 129, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-bright)'
                      }}>
                        <TrendingUp size={18} />
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
                        Riwayat Perubahan HPP — {selected.name}
                      </span>
                      <span className="pill pill-accent mono" style={{ fontSize: 10 }}>
                        Weighted Moving Average
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, maxWidth: 680 }}>
                      Sistem menghitung HPP secara dinamis mengikuti pergerakan harga rata-rata bahan baku (Moving Avg). Setiap pembelian restock bahan baru, transfer cabang, atau produksi batch olahan akan tercatat otomatis pada log di bawah.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => fetchHppHistory(selected.id, hppOutletId, hppDateFrom, hppDateTo)}
                      disabled={hppLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                      title="Perbarui data riwayat HPP"
                    >
                      <RefreshCw size={13} className={hppLoading ? 'spin' : ''} /> Segarkan
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleExportHppExcel}
                      disabled={!hppHistoryData || hppLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                      title="Unduh laporan lengkap ke file Excel (.xlsx)"
                    >
                      <FileSpreadsheet size={13} /> Ekspor Excel
                    </button>
                  </div>
                </div>

                {/* 4 KPI Summary Cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 12,
                  marginBottom: 16
                }}>
                  {/* KPI 1: HPP Saat Ini */}
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 10,
                    padding: '12px 16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        HPP Saat Ini (Aktual)
                      </span>
                      <span className="pill pill-accent mono" style={{ fontSize: 9 }}>
                        Moving Avg
                      </span>
                    </div>
                    <div className="mono" style={{ fontSize: 19, fontWeight: 800, color: 'var(--accent-bright)', marginTop: 4 }}>
                      {rupiah(hppHistoryData?.current_hpp ?? hpp)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Target Dasar:</span>
                      <strong style={{ color: estimatedHpp > 0 ? '#93c5fd' : 'var(--text-muted)' }}>
                        {estimatedHpp > 0 ? rupiah(estimatedHpp) : 'Belum diset'}
                      </strong>
                    </div>
                  </div>

                  {/* KPI 2: Rentang Fluktuasi HPP */}
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: 10,
                    padding: '12px 16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Rentang Fluktuasi
                      </span>
                      <span className="pill" style={{ fontSize: 9, background: 'rgba(59, 130, 246, 0.2)', color: '#bfdbfe' }}>
                        Min – Max
                      </span>
                    </div>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: '#93c5fd', marginTop: 6 }}>
                      {rupiah(hppHistoryData?.stats?.min_hpp || (hppHistoryData?.current_hpp ?? hpp))}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 4px' }}>s/d</span>
                      {rupiah(hppHistoryData?.stats?.max_hpp || (hppHistoryData?.current_hpp ?? hpp))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Rata-rata: <strong className="mono" style={{ color: '#ffffff' }}>{rupiah(hppHistoryData?.stats?.avg_hpp || (hppHistoryData?.current_hpp ?? hpp))}</strong>
                    </div>
                  </div>

                  {/* KPI 3: Perubahan Terakhir */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '12px 16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Perubahan Terakhir
                      </span>
                      <span className="pill mono" style={{ fontSize: 9, background: 'rgba(255,255,255,0.06)' }}>
                        {hppHistoryData?.stats?.total_changes || 0} event
                      </span>
                    </div>
                    <div className="mono" style={{
                      fontSize: 17,
                      fontWeight: 800,
                      marginTop: 4,
                      color: (hppHistoryData?.stats?.latest_diff || 0) > 0 ? '#fb7185' : ((hppHistoryData?.stats?.latest_diff || 0) < 0 ? '#34d399' : 'var(--text-muted)')
                    }}>
                      {(hppHistoryData?.stats?.latest_diff || 0) > 0
                        ? `+${rupiah(hppHistoryData.stats.latest_diff)} (+${hppHistoryData.stats.latest_pct_change}%)`
                        : ((hppHistoryData?.stats?.latest_diff || 0) < 0
                            ? `-${rupiah(Math.abs(hppHistoryData.stats.latest_diff))} (${hppHistoryData.stats.latest_pct_change}%)`
                            : 'Rp0 (Stabil)')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Tanggal: <span className="mono" style={{ color: 'var(--text-secondary)' }}>{hppHistoryData?.stats?.latest_change_date || '-'}</span>
                    </div>
                  </div>

                  {/* KPI 4: Gross Margin Saat Ini */}
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: 10,
                    padding: '12px 16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#fcd34d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Margin Laba Kotor
                      </span>
                      <span className="pill mono" style={{ fontSize: 9, background: 'rgba(245, 158, 11, 0.2)', color: '#fde68a' }}>
                        Harga {rupiah(selected.price)}
                      </span>
                    </div>
                    <div className="mono" style={{ fontSize: 19, fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>
                      {hppHistoryData?.current_margin_pct ?? marginPct}%
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Laba per {selected.unit || 'porsi'}: <strong className="mono" style={{ color: '#ffffff' }}>{rupiah(selected.price - (hppHistoryData?.current_hpp ?? hpp))}</strong>
                    </div>
                  </div>
                </div>

                {/* Filter Control Bar */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  marginBottom: 18
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {/* Outlet Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Store size={14} color="var(--text-muted)" />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Cabang:</span>
                      <select
                        className="input"
                        value={hppOutletId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setHppOutletId(val);
                          fetchHppHistory(selected.id, val, hppDateFrom, hppDateTo);
                        }}
                        style={{ padding: '4px 10px', fontSize: 12, height: 32, minWidth: 160 }}
                      >
                        <option value="ALL">Semua Cabang (Konsolidasi)</option>
                        {outlets.map(o => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Date Range Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={14} color="var(--text-muted)" />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Dari:</span>
                      <input
                        type="date"
                        className="input"
                        value={hppDateFrom}
                        onChange={(e) => setHppDateFrom(e.target.value)}
                        style={{ padding: '3px 8px', fontSize: 12, height: 32 }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>s/d:</span>
                      <input
                        type="date"
                        className="input"
                        value={hppDateTo}
                        onChange={(e) => setHppDateTo(e.target.value)}
                        style={{ padding: '3px 8px', fontSize: 12, height: 32 }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => fetchHppHistory(selected.id, hppOutletId, hppDateFrom, hppDateTo)}
                        style={{ height: 32, padding: '0 10px', fontSize: 12 }}
                      >
                        Filter
                      </button>
                      {(hppDateFrom || hppDateTo || (hppOutletId !== 'ALL' && hppOutletId !== activeOutletId)) && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setHppDateFrom('');
                            setHppDateTo('');
                            setHppOutletId('ALL');
                            fetchHppHistory(selected.id, 'ALL', '', '');
                          }}
                          style={{ height: 32, padding: '0 8px', fontSize: 11, color: 'var(--text-muted)' }}
                        >
                          Reset Filter
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Total <strong>{(hppHistoryData?.history || []).length}</strong> log riwayat
                  </div>
                </div>

                {/* Section 1: Komposisi Biaya Bahan Pembentuk HPP Terkini */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 20
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                        Komposisi Biaya Bahan Pembentuk HPP Terkini (1 {selected.unit || 'porsi'})
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Proporsi biaya masing-masing bahan baku terhadap total HPP berdasarkan harga moving average saat ini.
                      </div>
                    </div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-bright)' }}>
                      Total HPP: {rupiah(hppHistoryData?.current_hpp ?? hpp)}
                    </div>
                  </div>

                  {(!hppHistoryData?.ingredients_breakdown || hppHistoryData.ingredients_breakdown.length === 0) ? (
                    <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      Menu ini belum memiliki rincian bahan baku atau belum dikonfigurasi resepnya.
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Bahan Baku / Komponen</th>
                            <th>Kategori</th>
                            <th className="right" style={{ width: 120 }}>Takaran Porsi</th>
                            <th className="right" style={{ width: 160 }}>Harga Avg Satuan</th>
                            <th className="right" style={{ width: 140 }}>Biaya Bahan</th>
                            <th style={{ width: 180 }}>Porsi terhadap HPP (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hppHistoryData.ingredients_breakdown.map((b, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600, color: '#ffffff' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: idx === 0 ? '#34d399' : (idx === 1 ? '#60a5fa' : (idx === 2 ? '#fbbf24' : '#c084fc'))
                                  }} />
                                  <span>{b.name}</span>
                                </div>
                              </td>
                              <td>
                                <span className="pill" style={{ fontSize: 9.5, background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                                  {b.category || b.type || 'Bahan'}
                                </span>
                              </td>
                              <td className="mono right" style={{ fontWeight: 600 }}>
                                {num(b.qty)} {b.unit}
                              </td>
                              <td className="mono right" style={{ color: 'var(--text-secondary)' }}>
                                {rupiah(b.cost_per_unit)} / {b.unit}
                              </td>
                              <td className="mono right" style={{ fontWeight: 700, color: '#ffffff' }}>
                                {rupiah(b.subtotal)}
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{
                                      width: `${Math.min(b.contribution_pct, 100)}%`,
                                      height: '100%',
                                      borderRadius: 4,
                                      background: idx === 0 ? 'var(--accent)' : (idx === 1 ? '#3b82f6' : (idx === 2 ? '#f59e0b' : '#a855f7'))
                                    }} />
                                  </div>
                                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', minWidth: 38 }}>
                                    {b.contribution_pct}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Section 2: Log Kronologis Riwayat Perubahan HPP */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                        Log Kronologis Riwayat Perubahan HPP
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Setiap kali harga rata-rata bahan berubah (akibat restock / mutasi / transfer), riwayat baru tercatat di bawah ini secara real-time.
                      </div>
                    </div>
                  </div>

                  {hppLoading ? (
                    <LoadingState message="Memuat riwayat perubahan HPP..." />
                  ) : (!hppHistoryData?.history || hppHistoryData.history.length === 0) ? (
                    <div style={{
                      padding: '36px 20px',
                      textAlign: 'center',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px dashed var(--border)',
                      borderRadius: 12,
                      color: 'var(--text-muted)'
                    }}>
                      <Clock size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', marginBottom: 4 }}>
                        Belum Ada Perubahan HPP yang Tercatat
                      </div>
                      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto' }}>
                        HPP menu ini saat ini adalah <strong>{rupiah(hppHistoryData?.current_hpp ?? hpp)}</strong>. Begitu bahan bakunya dibeli dengan harga baru atau resepnya direvisi, sistem akan otomatis mencatat riwayat perubahan HPP di sini.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {hppHistoryData.history.map((h) => {
                        const isUp = (h.diff || 0) > 0;
                        const isDown = (h.diff || 0) < 0;
                        const isZero = (h.diff || 0) === 0;

                        // Trigger labels & icons
                        let triggerLabel = 'Pembelian / Restock';
                        let triggerBg = 'rgba(59, 130, 246, 0.15)';
                        let triggerColor = '#93c5fd';

                        if (h.trigger_type === 'TRANSFER_IN') {
                          triggerLabel = 'Transfer Antar Cabang';
                          triggerBg = 'rgba(168, 85, 247, 0.15)';
                          triggerColor = '#d8b4fe';
                        } else if (h.trigger_type === 'BATCH_PREP') {
                          triggerLabel = 'Produksi Batch Dapur';
                          triggerBg = 'rgba(245, 158, 11, 0.15)';
                          triggerColor = '#fcd34d';
                        } else if (h.trigger_type === 'RECIPE_UPDATE') {
                          triggerLabel = 'Pembaruan Resep';
                          triggerBg = 'rgba(16, 185, 129, 0.15)';
                          triggerColor = '#6ee7b7';
                        } else if (h.trigger_type === 'DIRECT_RESTOCK') {
                          triggerLabel = 'Restock Produk Retail';
                          triggerBg = 'rgba(59, 130, 246, 0.15)';
                          triggerColor = '#93c5fd';
                        } else if (h.trigger_type === 'MANUAL_EDIT') {
                          triggerLabel = 'Penyesuaian Manual';
                          triggerBg = 'rgba(255, 255, 255, 0.1)';
                          triggerColor = '#ffffff';
                        } else if (h.trigger_type === 'BASELINE') {
                          triggerLabel = 'Acuan Awal (Baseline)';
                          triggerBg = 'rgba(16, 185, 129, 0.15)';
                          triggerColor = '#34d399';
                        }

                        return (
                          <div
                            key={h.id}
                            style={{
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid var(--border)',
                              borderRadius: 10,
                              padding: 14,
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {/* Card Header Row */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 8,
                              paddingBottom: 10,
                              borderBottom: '1px solid rgba(255,255,255,0.05)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  background: triggerBg,
                                  color: triggerColor
                                }}>
                                  {triggerLabel}
                                </span>
                                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                  {formatDateTime(h.created_at || h.date)}
                                </span>
                                {h.outlet && (
                                  <span className="pill" style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)' }}>
                                    Cabang: {h.outlet.name}
                                  </span>
                                )}
                              </div>

                              {/* HPP Before -> After & Diff Pill */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ textAlign: 'right' }}>
                                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: isZero ? 'none' : 'line-through' }}>
                                    {rupiah(h.hpp_before)}
                                  </span>
                                  <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>→</span>
                                  <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
                                    {rupiah(h.hpp_after)}
                                  </span>
                                </div>

                                <div style={{ minWidth: 100, textAlign: 'right' }}>
                                  {isUp && (
                                    <span style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: '2px 8px',
                                      borderRadius: 6,
                                      background: 'rgba(244, 63, 94, 0.15)',
                                      color: '#fb7185',
                                      border: '1px solid rgba(244, 63, 94, 0.3)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3
                                    }}>
                                      <ArrowUpRight size={12} /> +{rupiah(h.diff)} (+{h.percentage_change}%)
                                    </span>
                                  )}
                                  {isDown && (
                                    <span style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: '2px 8px',
                                      borderRadius: 6,
                                      background: 'rgba(16, 185, 129, 0.15)',
                                      color: '#34d399',
                                      border: '1px solid rgba(16, 185, 129, 0.3)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3
                                    }}>
                                      <ArrowDownRight size={12} /> -{rupiah(Math.abs(h.diff))} ({h.percentage_change}%)
                                    </span>
                                  )}
                                  {isZero && (
                                    <span className="pill" style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                                      Tetap (Rp0)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Card Body Details */}
                            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                              <div style={{ flex: 1, minWidth: 260 }}>
                                {h.ingredient_name && (
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontSize: 12,
                                    marginBottom: 4,
                                    color: '#e2e8f0'
                                  }}>
                                    <Package size={13} color="var(--accent-bright)" />
                                    <span>Bahan Pemicu: <strong>{h.ingredient_name}</strong></span>
                                    {h.portion_qty > 0 && (
                                      <span style={{ color: 'var(--text-muted)' }}>
                                        ({num(h.portion_qty)} {h.portion_unit || 'satuan'}/porsi)
                                      </span>
                                    )}
                                  </div>
                                )}
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                  {h.notes}
                                </div>
                              </div>

                              {/* Margin Impact & Audit */}
                              <div style={{ textAlign: 'right', fontSize: 11.5 }}>
                                <div style={{ color: 'var(--text-muted)' }}>
                                  Margin: <strong className="mono" style={{ color: '#ffffff' }}>{h.margin_before_pct}%</strong>
                                  <span style={{ margin: '0 4px' }}>→</span>
                                  <strong className="mono" style={{
                                    color: h.margin_after_pct >= h.margin_before_pct ? '#34d399' : '#fb7185'
                                  }}>
                                    {h.margin_after_pct}%
                                  </strong>
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                                  Dicatat: {h.user?.name || 'Sistem Otomatis'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            Pilih menu dari daftar di sebelah kiri atau klik "Tambah Menu Baru".
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Menu */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {modalMode === 'create' ? 'Tambah Menu Baru' : `Edit Menu — ${menuForm.code}`}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: 4 }}
                onClick={() => setModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMenu}>
              <div className="modal-body">
                {/* Product Type Selector */}
                <div className="form-group mb-3">
                  <label className="form-label" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} color="var(--accent)" /> Tipe Produk / Penjualan
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setMenuForm(f => ({ ...f, item_type: 'RECIPE', unit: 'porsi' }))}
                      style={{
                        padding: '10px 6px',
                        borderRadius: 8,
                        border: '1px solid',
                        borderColor: (menuForm.item_type || 'RECIPE') === 'RECIPE' ? 'var(--accent-bright)' : 'var(--border)',
                        background: (menuForm.item_type || 'RECIPE') === 'RECIPE' ? 'var(--accent-dim)' : 'rgba(255,255,255,0.02)',
                        color: (menuForm.item_type || 'RECIPE') === 'RECIPE' ? 'var(--accent-bright)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <UtensilsCrossed size={16} />
                      <span style={{ fontSize: 11, fontWeight: 700 }}>Olahan Resep</span>
                      <span style={{ fontSize: 9, opacity: 0.7 }}>Bahan Baku</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenuForm(f => ({ ...f, item_type: 'DIRECT', unit: 'pcs' }))}
                      style={{
                        padding: '10px 6px',
                        borderRadius: 8,
                        border: '1px solid',
                        borderColor: menuForm.item_type === 'DIRECT' ? '#60a5fa' : 'var(--border)',
                        background: menuForm.item_type === 'DIRECT' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                        color: menuForm.item_type === 'DIRECT' ? '#93c5fd' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Package size={16} />
                      <span style={{ fontSize: 11, fontWeight: 700 }}>Barang Jadi</span>
                      <span style={{ fontSize: 9, opacity: 0.7 }}>Retail Direct</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenuForm(f => ({ ...f, item_type: 'SERVICE', unit: 'layanan' }))}
                      style={{
                        padding: '10px 6px',
                        borderRadius: 8,
                        border: '1px solid',
                        borderColor: menuForm.item_type === 'SERVICE' ? '#c084fc' : 'var(--border)',
                        background: menuForm.item_type === 'SERVICE' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255,255,255,0.02)',
                        color: menuForm.item_type === 'SERVICE' ? '#e9d5ff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Scissors size={16} />
                      <span style={{ fontSize: 11, fontWeight: 700 }}>Jasa / Layanan</span>
                      <span style={{ fontSize: 9, opacity: 0.7 }}>Non-Stok</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenuForm(f => ({ ...f, item_type: 'BUNDLE', unit: 'paket' }))}
                      style={{
                        padding: '10px 6px',
                        borderRadius: 8,
                        border: '1px solid',
                        borderColor: menuForm.item_type === 'BUNDLE' ? '#f43f5e' : 'var(--border)',
                        background: menuForm.item_type === 'BUNDLE' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255,255,255,0.02)',
                        color: menuForm.item_type === 'BUNDLE' ? '#fda4af' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Layers size={16} />
                      <span style={{ fontSize: 11, fontWeight: 700 }}>🎁 Bundling</span>
                      <span style={{ fontSize: 9, opacity: 0.7 }}>Buy 1 Get 1</span>
                    </button>
                  </div>
                </div>

                {menuForm.item_type === 'BUNDLE' && (
                  <div className="card mb-4" style={{ padding: 14, background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.25)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Layers size={15} color="#f43f5e" /> Rincian Isi Paket Bundling / Buy 1 Get 1
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
                      Tentukan item-item yang termasuk dalam paket promo ini. Saat paket dipesan di kasir POS, sistem otomatis menelusuri resep & memotong stok bahan baku seluruh item di dalamnya.
                    </div>

                    <div className="table-wrap" style={{ marginBottom: 10 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Item Produk Disertakan</th>
                            <th className="right" style={{ width: 110 }}>Jumlah Qty</th>
                            <th style={{ width: 90 }}>Satuan</th>
                            <th style={{ width: 45 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(!menuForm.bundle_items || menuForm.bundle_items.length === 0) ? (
                            <tr>
                              <td colSpan={4} style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                                Belum ada item di dalam paket. Klik "Tambah Item Paket" di bawah.
                              </td>
                            </tr>
                          ) : (
                            menuForm.bundle_items.map((bi, idx) => (
                              <tr key={idx}>
                                <td>
                                  <select
                                    className="form-control"
                                    style={{ padding: '5px 8px', fontSize: 12 }}
                                    value={bi.bundled_menu_id || ''}
                                    onChange={e => updateBundleItem(idx, 'bundled_menu_id', e.target.value)}
                                  >
                                    <option value="">-- Pilih Menu Disertakan --</option>
                                    {menus.filter(m => m.id !== selected?.id && m.item_type !== 'BUNDLE').map(m => (
                                      <option key={m.id} value={m.id}>
                                        {m.code} - {m.name} ({rupiah(m.price)})
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0.001"
                                    className="form-control mono right"
                                    style={{ padding: '5px 8px', fontSize: 12 }}
                                    value={bi.qty}
                                    onChange={e => updateBundleItem(idx, 'qty', e.target.value)}
                                    placeholder="1"
                                  />
                                </td>
                                <td className="mono" style={{ fontSize: 12 }}>
                                  {bi.unit || 'porsi'}
                                </td>
                                <td className="center">
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: 'var(--danger)', padding: '3px 6px' }}
                                    onClick={() => removeBundleItem(idx)}
                                  >
                                    <X size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <button type="button" className="btn btn-secondary btn-sm" onClick={addBundleItem}>
                      + Tambah Item Paket
                    </button>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Kode Produk / Menu</label>
                    <input
                      type="text"
                      className="form-control mono"
                      required
                      value={menuForm.code}
                      onChange={e => setMenuForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                      placeholder="MN-004"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Barcode / SKU (Opsional)</label>
                    <input
                      type="text"
                      className="form-control mono"
                      value={menuForm.barcode}
                      onChange={e => setMenuForm(f => ({ ...f, barcode: e.target.value }))}
                      placeholder="Contoh: 8991234567"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nama Produk / Menu</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    autoFocus
                    value={menuForm.name}
                    onChange={e => setMenuForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={menuForm.item_type === 'DIRECT' ? 'Contoh: Air Mineral 600ml / Kripik Singkong' : (menuForm.item_type === 'SERVICE' ? 'Contoh: Jasa Potong Rambut / Servis' : 'Contoh: Ayam Bakar Madu')}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Kategori</label>
                    <select
                      className="form-control"
                      value={menuForm.category}
                      onChange={e => setMenuForm(f => ({ ...f, category: e.target.value }))}
                    >
                      <option value="Main">Makanan Utama (Main Course)</option>
                      <option value="Minuman">Minuman (Beverage)</option>
                      <option value="Snack">Snack / Cemilan / Retail</option>
                      <option value="Retail">Barang Jadi / Retail</option>
                      <option value="Jasa">Jasa & Layanan</option>
                      <option value="Dessert">Dessert</option>
                      <option value="Paket">Paket Hemat</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Satuan Jual</label>
                    <input
                      type="text"
                      className="form-control"
                      value={menuForm.unit}
                      onChange={e => setMenuForm(f => ({ ...f, unit: e.target.value }))}
                      placeholder={menuForm.item_type === 'DIRECT' ? 'pcs / botol' : (menuForm.item_type === 'SERVICE' ? 'layanan' : 'porsi')}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Harga Jual Kasir (Rp)</label>
                    <input
                      type="number"
                      className="form-control mono"
                      required
                      min="0"
                      step="100"
                      value={menuForm.price}
                      onChange={e => setMenuForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="25000"
                    />
                    {menuForm.price > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--ok)', marginTop: 2, display: 'block' }}>
                        Jual: {rupiah(Number(menuForm.price))}
                      </span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ color: '#60a5fa', fontWeight: 600 }}>
                      {menuForm.item_type === 'DIRECT' ? 'Harga Beli Modal / HPP (Rp)' : (menuForm.item_type === 'SERVICE' ? 'Biaya Modal Jasa (Rp)' : 'Estimasi HPP Dasar (Rp)')}
                    </label>
                    <input
                      type="number"
                      className="form-control mono"
                      min="0"
                      step="100"
                      value={menuForm.cost_price}
                      onChange={e => setMenuForm(f => ({ ...f, cost_price: e.target.value }))}
                      placeholder="Contoh: 15000"
                    />
                    {menuForm.cost_price > 0 && (
                      <span style={{ fontSize: 11, color: '#60a5fa', marginTop: 2, display: 'block' }}>
                        Modal: {rupiah(Number(menuForm.cost_price))}
                      </span>
                    )}
                  </div>
                </div>

                {/* Direct Retail Stock Controls */}
                {menuForm.item_type === 'DIRECT' && (
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Package size={14} /> Saldo Stok Retail Barang Jadi
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label className="form-label" style={{ fontSize: 11.5 }}>
                          {modalMode === 'create' ? 'Stok Awal' : 'Saldo Stok Produk'}
                        </label>
                        <input
                          type="number"
                          className="form-control mono"
                          min="0"
                          value={menuForm.stock}
                          onChange={e => setMenuForm(f => ({ ...f, stock: e.target.value }))}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: 11.5 }}>Stok Minimum Alert</label>
                        <input
                          type="number"
                          className="form-control mono"
                          min="0"
                          value={menuForm.min_stock}
                          onChange={e => setMenuForm(f => ({ ...f, min_stock: e.target.value }))}
                          placeholder="5"
                        />
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Setiap penjualan kasir untuk produk ini akan memotong saldo stok produk secara otomatis.
                    </span>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Menyimpan...' : (modalMode === 'create' ? 'Simpan Menu' : 'Update Menu')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Kelompok Modifier & Topping */}
      {groupModalOpen && (
        <div className="modal-overlay" onClick={() => setGroupModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} color="var(--accent)" />
                {editingGroup ? `Edit Kelompok Modifier — ${editingGroup.name}` : 'Buat Kelompok Modifier & Topping Baru'}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: 4 }}
                onClick={() => setGroupModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModifierGroup} style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* 1. Quick Presets / Template */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={13} style={{ color: 'var(--accent-bright)' }} /> Contoh Pengaturan Cepat:
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '2px 8px', border: '1px solid var(--border)' }}
                    onClick={() => applyGroupPreset('EXTRA_TOPPING')}
                  >
                    ☑️ Extra Topping Bebas (Checkbox)
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '2px 8px', border: '1px solid var(--border)' }}
                    onClick={() => applyGroupPreset('SINGLE_CHOICE')}
                  >
                    🔘 Pilihan Saus / Paket (Radio)
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '2px 8px', border: '1px solid var(--border)' }}
                    onClick={() => applyGroupPreset('LEVEL_PEDAS')}
                  >
                    🌶️ Level Pedas (Radio)
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '2px 8px', border: '1px solid var(--border)' }}
                    onClick={() => applyGroupPreset('UKURAN_PORTION')}
                  >
                    🥤 Ukuran Porsi (Radio)
                  </button>
                </div>

                {/* 2. Group Name & Visual Selection Type Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Nama Kelompok Varian / Modifier</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      autoFocus
                      value={groupForm.name}
                      onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Contoh: Extra Topping, Pilihan Saus, Level Pedas, Ukuran"
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Nama ini akan muncul sebagai judul kelompok varian di layar kasir POS.
                    </span>
                  </div>

                  {/* Interactive Cards for Radio vs Checkbox */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Jenis Pemilihan di Kasir POS</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginTop: 4 }}>
                      {/* Option 1: Radio */}
                      <div
                        onClick={() => setGroupForm(f => ({ ...f, selection_type: 'SINGLE' }))}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 8,
                          border: groupForm.selection_type === 'SINGLE' ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: groupForm.selection_type === 'SINGLE' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.02)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: 13, color: groupForm.selection_type === 'SINGLE' ? '#ffffff' : 'var(--text-secondary)' }}>
                            🔘 Pilihan Tunggal (Radio)
                          </strong>
                          {groupForm.selection_type === 'SINGLE' && (
                            <span style={{ fontSize: 10, background: 'var(--accent)', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>Aktif</span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          Pelanggan <strong>hanya boleh memilih 1 opsi</strong>. Sangat cocok untuk: <em>Level Pedas, Pilihan Rasa, Saus Paket Bundling, Ukuran Cup</em>.
                        </span>
                      </div>

                      {/* Option 2: Checkbox */}
                      <div
                        onClick={() => setGroupForm(f => ({ ...f, selection_type: 'MULTIPLE' }))}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 8,
                          border: groupForm.selection_type === 'MULTIPLE' ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: groupForm.selection_type === 'MULTIPLE' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.02)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: 13, color: groupForm.selection_type === 'MULTIPLE' ? '#ffffff' : 'var(--text-secondary)' }}>
                            ☑️ Banyak Pilihan (Checkbox)
                          </strong>
                          {groupForm.selection_type === 'MULTIPLE' && (
                            <span style={{ fontSize: 10, background: 'var(--accent)', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>Aktif</span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          Pelanggan <strong>bebas memilih lebih dari 1 opsi</strong>. Sangat cocok untuk: <em>Extra Topping Tambahan (Keju + Telur + Sosis)</em>.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Is Required Checkbox */}
                <div
                  onClick={() => setGroupForm(f => ({ ...f, is_required: !f.is_required }))}
                  style={{
                    background: groupForm.is_required ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${groupForm.is_required ? 'rgba(245, 158, 11, 0.35)' : 'var(--border)'}`,
                    borderRadius: 8,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    id="is_required_chk"
                    checked={groupForm.is_required}
                    onChange={e => setGroupForm(f => ({ ...f, is_required: e.target.checked }))}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="is_required_chk" style={{ fontSize: 12.5, cursor: 'pointer', margin: 0, color: groupForm.is_required ? '#fde68a' : 'var(--text-primary)' }}>
                    <strong>Wajib Dipilih di Kasir POS</strong> — Transaksi tidak bisa disimpan sebelum pelanggan memilih salah satu opsi ini (cocok untuk Level Pedas atau Pilihan Saus Paket). Jika ini topping tambahan opsional, biarkan tidak dicentang.
                  </label>
                </div>

                {/* 4. Options Table with Guidance */}
                <div>
                  {/* Guidance Box for 2+ Ingredients & Stock Deduction */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.85) 100%)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginBottom: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#93c5fd', fontWeight: 700, fontSize: 12 }}>
                      <Info size={14} /> Panduan Pemotongan Bahan Baku untuk Topping:
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      • <strong>Topping 1 Bahan Mentah:</strong> Pilih langsung bahan mentah di kolom <em>Bahan yang Dipotong</em> (misal: 🟢 <em>Keju Cheddar</em>, 🟢 <em>Telur</em>).<br />
                      • <strong>Topping Racikan 2 Bahan atau Lebih (Saus Keju, Sambal, dsb):</strong> Buat terlebih dahulu sebagai <strong>🟣 Bahan Olahan (Setengah Jadi)</strong> di menu Master Bahan & Resep, lalu pilih bahan olahan tersebut di sini agar potongan stok dapur 100% akurat.<br />
                      • <strong>Topping Tanpa Potong Stok:</strong> Pilih <em>"-- Tanpa Potong Bahan --"</em> jika hanya sebagai preferensi rasa atau catatan kasir.
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>
                      Daftar Pilihan / Opsi ({groupForm.options.length})
                    </label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={addGroupOption}
                      style={{ fontSize: 11.5, padding: '3px 10px' }}
                    >
                      + Tambah Opsi
                    </button>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Nama Opsi / Topping</th>
                          <th className="right" style={{ width: 120 }}>+ Harga (Rp)</th>
                          <th style={{ width: 250 }}>Bahan yang Dipotong</th>
                          <th className="right" style={{ width: 95 }}>Qty Potong</th>
                          <th style={{ width: 85 }}>Satuan</th>
                          <th style={{ width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupForm.options.map((opt, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                style={{ padding: '6px 8px', fontSize: 12 }}
                                required
                                value={opt.name}
                                onChange={e => updateGroupOption(idx, 'name', e.target.value)}
                                placeholder="Contoh: Extra Keju / Saus BBQ"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="500"
                                className="form-control mono right"
                                style={{ padding: '6px 8px', fontSize: 12 }}
                                value={opt.price}
                                onChange={e => updateGroupOption(idx, 'price', e.target.value)}
                                placeholder="0"
                              />
                            </td>
                            <td style={{ minWidth: 260 }}>
                              <SearchableSelect
                                value={opt.ingredient_id}
                                onChange={(ingId, selectedObj) => {
                                  const ing = selectedObj?.raw || ingredients.find(i => i.id === Number(ingId));
                                  updateGroupOption(idx, 'ingredient_id', ingId);
                                  if (ing) updateGroupOption(idx, 'unit', ing.unit_pakai);
                                }}
                                options={searchableModifierIngredientGroups}
                                placeholder="-- Tanpa Potong Bahan --"
                                searchPlaceholder="Cari topping, cup, susu..."
                                size="sm"
                              />
                              {opt.ingredient_id && (
                                <div style={{ fontSize: 9.5, marginTop: 3 }}>
                                  {ingredients.find(i => i.id === Number(opt.ingredient_id))?.type === 'SEMI_FINISHED' ? (
                                    <span style={{ color: '#c084fc', background: 'rgba(168, 85, 247, 0.15)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                      🟣 Bahan Olahan (Racikan 2+ Bahan)
                                    </span>
                                  ) : (
                                    <span style={{ color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                      🟢 Bahan Mentah Tunggal
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                className="form-control mono right"
                                style={{ padding: '6px 8px', fontSize: 12 }}
                                disabled={!opt.ingredient_id}
                                value={opt.qty}
                                onChange={e => updateGroupOption(idx, 'qty', e.target.value)}
                                placeholder={opt.ingredient_id ? "0" : "-"}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                style={{ padding: '6px 8px', fontSize: 12 }}
                                disabled={!opt.ingredient_id}
                                value={opt.unit}
                                onChange={e => updateGroupOption(idx, 'unit', e.target.value)}
                                placeholder={opt.ingredient_id ? "gram" : "-"}
                              />
                            </td>
                            <td className="center">
                              {groupForm.options.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  style={{ color: 'var(--danger)', padding: 4 }}
                                  onClick={() => removeGroupOption(idx)}
                                  title="Hapus opsi ini"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 5. Menu Assignment Checkboxes with Search and Multi-Menu Guidance */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>
                      Terapkan Kelompok Modifier ini ke Menu:
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      ({groupForm.menu_ids.length} menu terpilih)
                    </span>
                  </div>

                  {/* Search and Quick Select */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="form-control"
                        style={{ paddingLeft: 26, fontSize: 11.5, padding: '4px 8px 4px 26px' }}
                        placeholder="Cari nama menu..."
                        value={groupMenuSearch}
                        onChange={e => setGroupMenuSearch(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--border)' }}
                      onClick={() => setGroupForm(f => ({ ...f, menu_ids: menus.map(m => m.id) }))}
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--border)' }}
                      onClick={() => setGroupForm(f => ({ ...f, menu_ids: [] }))}
                    >
                      Reset
                    </button>
                  </div>

                  <div style={{
                    maxHeight: 140,
                    overflowY: 'auto',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 8,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 6
                  }}>
                    {menus
                      .filter(m => !groupMenuSearch || m.name.toLowerCase().includes(groupMenuSearch.toLowerCase()) || m.code.toLowerCase().includes(groupMenuSearch.toLowerCase()))
                      .map(m => {
                        const checked = groupForm.menu_ids.includes(m.id);
                        return (
                          <label key={m.id} style={{
                            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer',
                            padding: '4px 8px', borderRadius: 6,
                            background: checked ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.02)',
                            border: checked ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent'
                          }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleGroupMenu(m.id)}
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontWeight: checked ? 700 : 400, color: checked ? '#ffffff' : 'var(--text-secondary)' }}>{m.name}</span>
                            {m.item_type === 'BUNDLE' && (
                              <span style={{ fontSize: 9.5, background: 'rgba(244, 63, 94, 0.2)', color: '#fda4af', padding: '1px 4px', borderRadius: 4, fontWeight: 700 }}>🎁 Paket</span>
                            )}
                          </label>
                        );
                      })}
                  </div>

                  {/* Tips for Multi-Menu Radio vs Checkbox */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(45, 30, 15, 0.5) 0%, rgba(30, 20, 10, 0.75) 100%)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginTop: 10,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8
                  }}>
                    <AlertCircle size={15} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: 11.5, color: '#fde68a', lineHeight: 1.5 }}>
                      <strong>Solusi Checkbox di Menu Reguler vs Radio di Menu Paket:</strong><br />
                      Kelompok ini berlaku dengan tipe <strong>{groupForm.selection_type === 'SINGLE' ? '🔘 Pilihan Tunggal (Radio - Pilih 1)' : '☑️ Banyak Pilihan (Checkbox - Bebas)'}</strong> untuk menu yang dicentang.<br />
                      Jika topping yang sama ingin bisa dipilih banyak di <u>Menu Reguler</u> tapi hanya boleh dipilih 1 di <u>Menu Paket</u>, simpan kelompok ini, lalu klik tombol <strong>"Duplikasi"</strong> untuk membuat versi satunya dalam 1 klik!
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '12px 18px' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setGroupModalOpen(false)}
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Menyimpan...' : (editingGroup ? 'Update Kelompok Modifier' : 'Simpan Kelompok Modifier')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Quick Restock Produk Retail */}
      {restockModalOpen && selected && (
        <div className="modal-overlay" onClick={() => setRestockModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={18} color="#60a5fa" />
                Tambah Stok Retail: {selected.name}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: 4 }}
                onClick={() => setRestockModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleQuickRestockDirect}>
              <div className="modal-body">
                <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '10px 12px', borderRadius: 8, marginBottom: 14, fontSize: 12.5 }}>
                  Stok saat ini: <strong className="mono" style={{ color: '#60a5fa' }}>{num(selected.current_stock ?? selected.stock ?? 0)} {selected.unit || 'pcs'}</strong>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Jumlah Tambahan ({selected.unit || 'pcs'})</label>
                  <input
                    type="number"
                    className="form-control mono"
                    min="1"
                    step="1"
                    required
                    value={restockQty}
                    onChange={e => handleRestockQtyChange(e.target.value)}
                  />
                </div>

                {/* Two-way Auto-Division: Total Nota vs Unit Price */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label className="form-label" style={{ color: '#34d399', fontWeight: 800, fontSize: 12, margin: '0 0 5px 0' }}>
                      💵 Total Nota (Rp)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="form-control mono"
                      style={{ borderColor: 'rgba(16, 185, 129, 0.5)', background: 'rgba(0,0,0,0.25)', color: '#34d399', fontWeight: 700 }}
                      placeholder="Total di bon belanja"
                      value={restockTotalCost}
                      onChange={e => handleRestockTotalCostChange(e.target.value)}
                    />
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
                      Ketik total belanja di bon.
                    </span>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <label className="form-label" style={{ color: '#60a5fa', fontWeight: 800, fontSize: 12, margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calculator size={13} /> Modal Satuan (Rp)
                      </label>
                      <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
                        per {selected.unit || 'pcs'}
                      </span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="form-control mono"
                      style={{ borderColor: 'rgba(96, 165, 250, 0.5)', background: 'rgba(0,0,0,0.25)', color: '#60a5fa', fontWeight: 700 }}
                      placeholder="Harga modal baru"
                      value={restockCost}
                      onChange={e => handleRestockCostChange(e.target.value)}
                    />
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
                      Otomatis: Total ÷ Qty.
                    </span>
                  </div>
                </div>

                {/* Formula Preview Banner */}
                {Number(restockQty) > 0 && (Number(restockTotalCost) > 0 || Number(restockCost) > 0) && (
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
                      💡 Hasil Bagi: <strong style={{ color: '#34d399' }}>{rupiah(restockTotalCost || (Number(restockQty) * Number(restockCost)))}</strong> ÷ <strong style={{ color: '#ffffff' }}>{restockQty} {selected.unit || 'pcs'}</strong> =
                    </div>
                    <div className="mono" style={{ fontWeight: 800, color: '#60a5fa' }}>
                      {rupiah(restockCost || (Number(restockTotalCost) / Number(restockQty)))} / {selected.unit || 'pcs'}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setRestockModalOpen(false)}
                  disabled={restocking}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={restocking}
                >
                  {restocking ? 'Menambah...' : 'Konfirmasi Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
