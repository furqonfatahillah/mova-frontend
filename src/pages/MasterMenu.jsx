import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Save, X, Edit2, Trash2, UtensilsCrossed, Check, Layers, Sliders,
  CheckSquare, Tag, Package, Scissors, Sparkles, AlertCircle, RefreshCw, Barcode
} from 'lucide-react';
import api from '../api/client';
import {
  rupiah, num, LoadingState, PageHeader, AuditInfo, formatDateTime,
  SATUAN_PAKAI_OPTIONS, UnitSelect
} from '../components/ui';
import { getTodayStr } from '../utils/date';
import toast from 'react-hot-toast';

export default function MasterMenu() {
  const [menus, setMenus] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [modifierGroups, setModifierGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('recipe'); // 'recipe' | 'modifiers'
  const [selectedType, setSelectedType] = useState('ALL'); // 'ALL' | 'RECIPE' | 'DIRECT' | 'SERVICE'

  // Quick Restock State for Direct Product
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [restockQty, setRestockQty] = useState(10);
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
  const [groupForm, setGroupForm] = useState({
    name: '',
    selection_type: 'SINGLE',
    is_required: false,
    menu_ids: [],
    options: [
      { name: '', price: 0, ingredient_id: '', qty: 0, unit: 'gram' }
    ]
  });

  useEffect(() => { fetchAll(); }, []);

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
      ? Number(selected?.cost_price || 0)
      : (activeRecipe
        ? (activeRecipe.items || []).reduce((sum, it) => {
          const ing = ingredients.find(i => i.id === it.ingredient_id);
          return ing ? sum + it.qty * (ing.harga / (ing.konversi || 1)) : sum;
        }, 0)
        : Number(selected?.cost_price || 0)));

  const marginPct = selected?.price > 0 ? Math.round(((selected.price - hpp) / selected.price) * 100) : 0;

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
            <Plus size={15} /> Tambah Produk / Menu
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
              <Plus size={12} /> Tambah
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
                    <Edit2 size={12} /> Edit Menu
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 8px', fontSize: 11, color: 'var(--danger)' }}
                    onClick={() => handleDeleteMenu(selected)}
                    title="Hapus menu"
                  >
                    <Trash2 size={12} /> Hapus
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
              <div style={{ textAlign: 'right', background: 'var(--accent-dim)', padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-accent)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>HPP Teoritis</span>
                  <span className="pill pill-accent mono" style={{ fontSize: 9 }}>Moving Avg</span>
                </div>
                <div className="mono" style={{ fontWeight: 700, color: 'var(--accent-bright)', fontSize: 18, marginTop: 2 }}>{rupiah(hpp)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Margin: {selected.price > 0 ? Math.round(((selected.price - hpp) / selected.price) * 100) : 0}%
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
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
                          </table>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button className="btn btn-primary" onClick={startEdit}>
                            <Plus size={14} /> Revisi Resep (Versi Baru)
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
                              setRestockQty(10);
                              setRestockCost(selected.cost_price || '');
                              setRestockModalOpen(true);
                            }}
                          >
                            <Plus size={14} /> Tambah Stok Cepat (Restock)
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => openEditModal(selected)}
                          >
                            <Edit2 size={14} /> Ubah Data Retail
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
                          <Edit2 size={14} /> Ubah Data Layanan
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
                          <Plus size={14} /> Tentukan Resep Sekarang
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
                              <td>
                                <select
                                  className="form-control"
                                  style={{ padding: '6px 10px', fontSize: 12.5 }}
                                  value={it.ingredient_id}
                                  onChange={e => {
                                    const selectedId = Number(e.target.value);
                                    const ing = ingredients.find(i => i.id === selectedId);
                                    updateDraft(idx, 'ingredient_id', selectedId);
                                    if (ing) updateDraft(idx, 'unit', ing.unit_pakai);
                                  }}
                                >
                                  {ingredients.map(i => (
                                    <option key={i.id} value={i.id}>
                                      {i.type === 'SEMI_FINISHED' ? '🟣 [Olahan] ' : '🟢 [Mentah] '}
                                      {i.name} ({i.category}) — {rupiah(i.harga / (i.konversi || 1))}/{i.unit_pakai}
                                    </option>
                                  ))}
                                </select>
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
                        <Plus size={13} /> Tambah Bahan
                      </button>
                      <button className="btn btn-primary" onClick={commitRecipe} disabled={saving}>
                        <Save size={13} /> {saving ? 'Menyimpan...' : 'Simpan Versi Resep'}
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
                    <Plus size={13} /> Buat Kelompok Modifier Baru
                  </button>
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
                                {grp.selection_type === 'SINGLE' ? 'Pilihan Tunggal (Radio)' : 'Banyak Pilihan (Checkbox)'}
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
                                className="btn btn-ghost btn-sm"
                                onClick={() => openEditGroupModal(grp)}
                                style={{ fontSize: 11, padding: '3px 8px' }}
                              >
                                <Edit2 size={12} /> Edit Kelompok
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
                                          {opt.ingredient.type === 'SEMI_FINISHED' && (
                                            <span className="pill" style={{ fontSize: 9, background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>Olahan</span>
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
                              {grp.selection_type === 'SINGLE' ? 'Radio (Pilih 1)' : 'Multi (Checkbox)'} · {grp.is_required ? 'Wajib' : 'Opsional'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
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
                      <Plus size={12} /> Tambah Item Paket
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
                  <Check size={14} /> {saving ? 'Menyimpan...' : (modalMode === 'create' ? 'Simpan Menu' : 'Update Menu')}
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
                {/* Group Name & Selection Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Nama Kelompok Varian / Modifier</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      autoFocus
                      value={groupForm.name}
                      onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Contoh: Level Pedas, Ukuran, Extra Topping, Saus"
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Nama kelompok yang akan muncul di layar kasir POS.
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Jenis Pemilihan</label>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="selection_type"
                          value="SINGLE"
                          checked={groupForm.selection_type === 'SINGLE'}
                          onChange={() => setGroupForm(f => ({ ...f, selection_type: 'SINGLE' }))}
                        />
                        <span>Pilihan Tunggal (Radio)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="selection_type"
                          value="MULTIPLE"
                          checked={groupForm.selection_type === 'MULTIPLE'}
                          onChange={() => setGroupForm(f => ({ ...f, selection_type: 'MULTIPLE' }))}
                        />
                        <span>Banyak Pilihan (Checkbox)</span>
                      </label>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {groupForm.selection_type === 'SINGLE' ? 'Pelanggan hanya boleh pilih 1 opsi (misal Level 1 ATAU 2).' : 'Pelanggan bebas memilih lebih dari 1 opsi (misal Keju + Sosis).'}
                    </span>
                  </div>
                </div>

                {/* Is Required Checkbox */}
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}>
                  <input
                    type="checkbox"
                    id="is_required_chk"
                    checked={groupForm.is_required}
                    onChange={e => setGroupForm(f => ({ ...f, is_required: e.target.checked }))}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="is_required_chk" style={{ fontSize: 13, cursor: 'pointer', margin: 0 }}>
                    <strong>Wajib Dipilih di Kasir POS</strong> — Transaksi tidak bisa disimpan sebelum pelanggan memilih opsi ini (cocok untuk Level Pedas atau Ukuran).
                  </label>
                </div>

                {/* Options Table */}
                <div>
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
                      <Plus size={12} /> Tambah Opsi
                    </button>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Nama Opsi</th>
                          <th className="right" style={{ width: 120 }}>+ Harga (Rp)</th>
                          <th style={{ width: 220 }}>Bahan yang Dipotong</th>
                          <th className="right" style={{ width: 90 }}>Qty Stok</th>
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
                                placeholder="Contoh: Level 2 / Large / Keju"
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
                            <td>
                              <select
                                className="form-control"
                                style={{ padding: '6px 8px', fontSize: 12 }}
                                value={opt.ingredient_id}
                                onChange={e => {
                                  const ingId = e.target.value;
                                  const ing = ingredients.find(i => i.id === Number(ingId));
                                  updateGroupOption(idx, 'ingredient_id', ingId);
                                  if (ing) updateGroupOption(idx, 'unit', ing.unit_pakai);
                                }}
                              >
                                <option value="">-- Tanpa Potong Bahan --</option>
                                {ingredients.map(i => (
                                  <option key={i.id} value={i.id}>
                                    {i.type === 'SEMI_FINISHED' ? '🟣 [Olahan] ' : '🟢 [Mentah] '}
                                    {i.name} ({i.unit_pakai})
                                  </option>
                                ))}
                              </select>
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
                                placeholder="0"
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
                                placeholder="gram"
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

                {/* Menu Assignment Checkboxes */}
                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                    Terapkan Kelompok Modifier ini ke Menu:
                  </label>
                  <div style={{
                    maxHeight: 140,
                    overflowY: 'auto',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 10,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 8
                  }}>
                    {menus.map(m => {
                      const checked = groupForm.menu_ids.includes(m.id);
                      return (
                        <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleGroupMenu(m.id)}
                            style={{ cursor: 'pointer' }}
                          />
                          <span>{m.name}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({m.code})</span>
                        </label>
                      );
                    })}
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
                  <Check size={14} /> {saving ? 'Menyimpan...' : (editingGroup ? 'Update Kelompok Modifier' : 'Simpan Kelompok Modifier')}
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
                    onChange={e => setRestockQty(e.target.value)}
                  />
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Harga Modal Beli Baru (Rp) (Opsional)</label>
                  <input
                    type="number"
                    className="form-control mono"
                    min="0"
                    step="100"
                    value={restockCost}
                    onChange={e => setRestockCost(e.target.value)}
                    placeholder={`Saat ini: ${rupiah(selected.cost_price || 0)}`}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Jika diisi, modal pokok (HPP) produk akan diperbarui.
                  </span>
                </div>
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
                  <Check size={14} /> {restocking ? 'Menambah...' : 'Konfirmasi Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
