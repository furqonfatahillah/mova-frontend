import { useState, useEffect } from 'react';
import { Plus, Save, X, Edit2, Trash2, UtensilsCrossed, Check, Layers, Sliders, CheckSquare, Tag } from 'lucide-react';
import api from '../api/client';
import {
  rupiah, num, LoadingState, PageHeader, AuditInfo, formatDateTime,
  SATUAN_PAKAI_OPTIONS, UnitSelect
} from '../components/ui';
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

  // Modal State for Add/Edit Menu
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [menuForm, setMenuForm] = useState({ code: '', name: '', category: 'Main', price: '' });

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
      name: '',
      category: 'Main',
      price: '',
    });
    setModalOpen(true);
  }

  function openEditModal(menu) {
    setModalMode('edit');
    setMenuForm({
      code: menu.code,
      name: menu.name,
      category: menu.category || 'Main',
      price: menu.price,
    });
    setModalOpen(true);
  }

  async function handleSaveMenu(e) {
    e.preventDefault();
    if (!menuForm.name.trim()) {
      toast.error('Nama menu wajib diisi');
      return;
    }
    if (!menuForm.price || Number(menuForm.price) < 0) {
      toast.error('Harga menu tidak valid');
      return;
    }

    setSaving(true);
    try {
      if (modalMode === 'create') {
        const { data } = await api.post('/menus', {
          ...menuForm,
          price: Number(menuForm.price),
        });
        toast.success(`Menu "${data.name}" berhasil ditambahkan!`);
        setModalOpen(false);
        await fetchAll(data.id);
        // Otomatis ajak buat resep pertama
        setDraft([{ ingredient_id: ingredients[0]?.id || 1, qty: 100, unit: ingredients[0]?.unit_pakai || 'gram', waste_std: 0 }]);
      } else {
        const { data } = await api.put(`/menus/${selected.id}`, {
          ...menuForm,
          price: Number(menuForm.price),
        });
        toast.success(`Menu "${data.name}" berhasil diperbarui!`);
        setModalOpen(false);
        await fetchAll(data.id);
      }
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(m => toast.error(m));
      else toast.error(err.response?.data?.message || 'Gagal menyimpan menu');
    } finally {
      setSaving(false);
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

  const hpp = activeRecipe
    ? (activeRecipe.items || []).reduce((sum, it) => {
        const ing = ingredients.find(i => i.id === it.ingredient_id);
        return ing ? sum + it.qty * (ing.harga / (ing.konversi || 1)) : sum;
      }, 0)
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
      const today = new Date().toISOString().slice(0, 10);
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

  if (loading) return <LoadingState />;

  return (
    <div className="fade-in">
      <PageHeader
        title="Master Menu & Recipe (BOM)"
        subtitle="Setiap menu wajib punya BOM. Perubahan gramasi otomatis membuat versi baru."
        action={
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={15} /> Tambah Menu Baru
          </button>
        }
      />

      <div className="grid-sidebar">
        {/* Menu List */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 4px' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Daftar Menu ({menus.length})
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
            {menus.map(m => (
              <button
                key={m.id}
                className={`recipe-item${selected?.id === m.id ? ' active' : ''}`}
                onClick={() => { setSelected(m); setDraft(null); }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="recipe-item-name">{m.name}</div>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 4 }}>
                    {m.code}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span className="recipe-item-price">{rupiah(m.price)}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{m.category || 'Main'}</span>
                </div>
              </button>
            ))}
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
                  Harga Jual: <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rupiah(selected.price)}</span> ·
                  Resep aktif: <span className="mono" style={{ color: activeRecipe ? 'var(--ok)' : 'var(--warn)' }}>
                    {activeRecipe ? `Versi ${activeRecipe.version}` : 'Belum ada resep'}
                  </span>
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
                <div className="form-group">
                  <label className="form-label">Kode Menu</label>
                  <input
                    type="text"
                    className="form-control mono"
                    required
                    value={menuForm.code}
                    onChange={e => setMenuForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="MN-004"
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Kode unik pengenal menu (contoh: MN-001, MN-002).
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Nama Menu</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    autoFocus
                    value={menuForm.name}
                    onChange={e => setMenuForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Contoh: Ayam Bakar Madu"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Kategori</label>
                  <select
                    className="form-control"
                    value={menuForm.category}
                    onChange={e => setMenuForm(f => ({ ...f, category: e.target.value }))}
                  >
                    <option value="Main">Main Course (Makanan Utama)</option>
                    <option value="Minuman">Minuman (Beverage)</option>
                    <option value="Snack">Snack / Cemilan</option>
                    <option value="Dessert">Dessert</option>
                    <option value="Paket">Paket Hemat</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Harga Jual (Rp)</label>
                  <input
                    type="number"
                    className="form-control mono"
                    required
                    min="0"
                    step="500"
                    value={menuForm.price}
                    onChange={e => setMenuForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="25000"
                  />
                  {menuForm.price > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>
                      Format: {rupiah(Number(menuForm.price))}
                    </span>
                  )}
                </div>
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
    </div>
  );
}
