import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Check, X, Store, Sparkles, Info, Calculator, ChefHat, Flame, Trash2, FileSpreadsheet } from 'lucide-react';
import api from '../api/client';
import {
  rupiah, num, fmtQtyVal, LoadingState, PageHeader, AuditInfo,
  SATUAN_BELI_OPTIONS, SATUAN_PAKAI_OPTIONS, KATEGORI_BAHAN_OPTIONS,
  getSuggestedConversion, UnitSelect
} from '../components/ui';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import ImportMasterModal from '../components/ImportMasterModal';

const emptyForm = {
  code: '', name: '', category: 'Perlengkapan', type: 'RAW', unit_beli: 'Slop',
  unit_pakai: 'pcs', konversi: 50, harga: 0,
  stok_awal: 0, stok_min: 0, tolerance: 5, yield_qty: 1, yield_unit: 'potong', active: true,
};

function FormCell({ data, setData, field, type = 'text', style = {}, availableCategories = KATEGORI_BAHAN_OPTIONS }) {
  if (field === 'category') {
    return (
      <select
        className="form-control"
        style={{
          padding: '5px 8px',
          fontSize: 12,
          minWidth: 95,
          cursor: 'pointer',
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          borderColor: 'var(--border-strong)',
          ...style,
        }}
        value={data.category ?? 'Protein'}
        onChange={e => setData(p => ({ ...p, category: e.target.value }))}
      >
        {availableCategories.map(cat => (
          <option key={cat} value={cat} style={{ background: '#11162d', color: '#ffffff' }}>
            {cat}
          </option>
        ))}
      </select>
    );
  }
  if (field === 'unit_beli') {
    return (
      <UnitSelect
        value={data.unit_beli}
        options={SATUAN_BELI_OPTIONS}
        style={{ minWidth: 85, ...style }}
        onChange={val => {
          const sug = getSuggestedConversion(val, data.unit_pakai);
          setData(p => ({
            ...p,
            unit_beli: val,
            ...(sug ? { konversi: sug } : {})
          }));
        }}
      />
    );
  }
  if (field === 'unit_pakai') {
    return (
      <UnitSelect
        value={data.unit_pakai}
        options={SATUAN_PAKAI_OPTIONS}
        style={{ minWidth: 85, ...style }}
        onChange={val => {
          const sug = getSuggestedConversion(data.unit_beli, val);
          setData(p => ({
            ...p,
            unit_pakai: val,
            ...(sug ? { konversi: sug } : {})
          }));
        }}
      />
    );
  }
  return (
    <input
      type={type}
      step={type === 'number' ? 'any' : undefined}
      className="form-control"
      style={{ padding: '5px 8px', fontSize: 12, minWidth: 70, ...style }}
      value={data[field] ?? ''}
      onChange={e => setData(p => ({ ...p, [field]: type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value }))}
    />
  );
}

export default function MasterBahan() {
  const navigate = useNavigate();
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'RAW' | 'SEMI_FINISHED'
  const [editing, setEditing] = useState(null); // id being edited
  const [editData, setEditData] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [breakdownModal, setBreakdownModal] = useState(null);

  // Sub-Recipe configuration modal
  const [subRecipeModal, setSubRecipeModal] = useState(null);
  const [savingSubRecipe, setSavingSubRecipe] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [dbCategories, setDbCategories] = useState([]);
  const { activeOutletId, activeOutlet } = useOutlet();

  const availableCategories = useMemo(() => {
    const fromDb = dbCategories.map(c => c.name).filter(Boolean);
    const custom = ingredients.map(i => i.category).filter(Boolean);
    return Array.from(new Set([...KATEGORI_BAHAN_OPTIONS, ...fromDb, ...custom]));
  }, [ingredients, dbCategories]);

  const rawIngredients = useMemo(() => {
    return ingredients.filter(i => i.type !== 'SEMI_FINISHED');
  }, [ingredients]);

  const displayedIngredients = useMemo(() => {
    return ingredients.filter(i => {
      const cat = (i.category || '').toLowerCase();
      const code = (i.code || '').toUpperCase();
      const isPerl = cat.includes('perlengkapan') ||
        cat.includes('packaging') ||
        cat.includes('kemasan') ||
        code.startsWith('PLK-') ||
        code.startsWith('PKG-');
      if (typeFilter === 'PERLENGKAPAN') return isPerl;
      if (typeFilter === 'RAW') return i.type !== 'SEMI_FINISHED' && !isPerl;
      if (typeFilter === 'SEMI_FINISHED') return i.type === 'SEMI_FINISHED';
      if (typeFilter === 'LOW_STOCK') return Number(i.current_stock ?? 0) <= Number(i.current_stok_min ?? i.stok_min ?? 0);
      return true;
    });
  }, [ingredients, typeFilter]);

  useEffect(() => { fetchIngredients(); }, [activeOutletId]);

  async function fetchIngredients() {
    try {
      const targetOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : undefined;
      const [ingRes, catRes] = await Promise.all([
        api.get('/ingredients', { params: { outlet_id: targetOutlet } }),
        api.get('/categories?type=INGREDIENT').catch(() => ({ data: [] })),
      ]);
      setIngredients(ingRes.data || []);
      setDbCategories(catRes.data || []);
    } catch { toast.error('Gagal memuat bahan'); }
    finally { setLoading(false); }
  }

  function startEdit(ing) {
    setEditing(ing.id);
    setEditData({ ...ing });
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const payload = {
        ...editData,
        type: editData.type || 'RAW',
        harga: Number(editData.harga || 0),
        konversi: Number(editData.konversi || 1),
        stok_min: Number(editData.stok_min || 0),
        tolerance: Number(editData.tolerance || 0),
        yield_qty: editData.type === 'SEMI_FINISHED' ? Number(editData.yield_qty || 1) : null,
        yield_unit: editData.type === 'SEMI_FINISHED' ? editData.yield_unit : null,
      };
      const { data } = await api.put(`/ingredients/${editing}`, payload);
      setIngredients(prev => prev.map(i => i.id === editing ? data : i));
      setEditing(null);
      toast.success('Bahan diperbarui');
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(m => toast.error(m));
      else toast.error('Gagal menyimpan');
    } finally { setSaving(false); }
  }

  async function saveNew() {
    setSaving(true);
    try {
      const payload = {
        ...addForm,
        type: addForm.type || 'RAW',
        harga: Number(addForm.harga || 0),
        konversi: Number(addForm.konversi || 1),
        stok_min: Number(addForm.stok_min || 0),
        tolerance: Number(addForm.tolerance || 0),
        yield_qty: addForm.type === 'SEMI_FINISHED' ? Number(addForm.yield_qty || 1) : null,
        yield_unit: addForm.type === 'SEMI_FINISHED' ? addForm.yield_unit : null,
      };
      const { data } = await api.post('/ingredients', payload);
      setIngredients(prev => [...prev, data]);
      setShowAdd(false);
      setAddForm(emptyForm);
      toast.success('Bahan ditambahkan');
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(m => toast.error(m));
      else toast.error('Gagal menambah bahan');
    } finally { setSaving(false); }
  }

  function openSubRecipeEditor(ing) {
    const existingRecipe = ing.prep_recipe;
    if (existingRecipe) {
      setSubRecipeModal({
        ingredient_id: ing.id,
        ingredient_name: ing.name,
        name: existingRecipe.name,
        output_qty: existingRecipe.output_qty,
        output_unit: existingRecipe.output_unit,
        notes: existingRecipe.notes || '',
        items: existingRecipe.items?.map(it => ({
          ingredient_id: it.ingredient_id,
          qty: it.qty,
          unit: it.unit,
          waste_std: it.waste_std || 0,
        })) || [{ ingredient_id: '', qty: 1, unit: 'gram', waste_std: 0 }]
      });
    } else {
      setSubRecipeModal({
        ingredient_id: ing.id,
        ingredient_name: ing.name,
        name: `Standar Resep ${ing.name}`,
        output_qty: ing.yield_qty || 1,
        output_unit: ing.yield_unit || ing.unit_pakai || 'potong',
        notes: '',
        items: [
          { ingredient_id: '', qty: 1, unit: 'gram', waste_std: 0 }
        ]
      });
    }
  }

  async function handleSaveSubRecipe() {
    if (!subRecipeModal.name) {
      toast.error('Nama resep wajib diisi');
      return;
    }
    if (!subRecipeModal.output_qty || Number(subRecipeModal.output_qty) <= 0) {
      toast.error('Output standar harus lebih besar dari 0');
      return;
    }
    const validItems = subRecipeModal.items.filter(i => i.ingredient_id && Number(i.qty) > 0);
    if (validItems.length === 0) {
      toast.error('Tambahkan minimal 1 bahan mentah');
      return;
    }

    setSavingSubRecipe(true);
    try {
      const payload = {
        ingredient_id: subRecipeModal.ingredient_id,
        name: subRecipeModal.name,
        output_qty: Number(subRecipeModal.output_qty),
        output_unit: subRecipeModal.output_unit,
        notes: subRecipeModal.notes,
        items: validItems.map(it => ({
          ingredient_id: Number(it.ingredient_id),
          qty: Number(it.qty),
          unit: it.unit,
          waste_std: Number(it.waste_std || 0),
        })),
      };

      await api.post('/prep-recipes', payload);
      toast.success('Resep olahan berhasil disimpan!');
      setSubRecipeModal(null);
      fetchIngredients();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan resep';
      toast.error(msg);
    } finally {
      setSavingSubRecipe(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="fade-in">
      <PageHeader
        title="Master Bahan Baku"
        subtitle="Data bahan, satuan, konversi, harga beli rata-rata bergerak (Moving Average), harga satuan pakai, dan batas toleransi."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowImportModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}
            >
              <FileSpreadsheet size={14} />
              Import Excel
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/perlengkapan')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: 'rgba(99, 102, 241, 0.4)', color: 'var(--accent-bright)' }}
            >
              <Store size={14} />
              Master Perlengkapan
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/waste')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: 'rgba(244, 63, 94, 0.4)', color: '#f43f5e' }}
            >
              Bahan Terbuang (Waste)
            </button>
            <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
              + Tambah Bahan
            </button>
          </div>
        }
      />

      {/* Accounting Method Banner */}
      <div className="card mb-4" style={{
        padding: '12px 18px',
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.4) 0%, rgba(15, 23, 42, 0.7) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgba(139, 92, 246, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-bright)'
          }}>
            <Calculator size={16} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Metode Penilaian Persediaan: Weighted Moving Average (Rata-Rata Bergerak)</span>
              <span className="pill pill-accent mono" style={{ fontSize: 10 }}>Aktif (PSAK 14)</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Harga beli tidak perlu di-input manual terus menerus. Setiap kali Anda mencatat transaksi Pembelian / Restock di <strong>Kartu Stok</strong>, sistem otomatis meng-update harga pokok rata-rata (Moving Average) & HPP bahan baku secara real-time.
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          className={`btn btn-sm ${typeFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTypeFilter('ALL')}
        >
          Semua Bahan ({ingredients.length})
        </button>
        <button
          className={`btn btn-sm ${typeFilter === 'PERLENGKAPAN' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTypeFilter('PERLENGKAPAN')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            borderColor: typeFilter === 'PERLENGKAPAN' ? '#00B14F' : 'rgba(0, 177, 79, 0.4)',
            background: typeFilter === 'PERLENGKAPAN' ? '#00B14F' : undefined,
            color: typeFilter === 'PERLENGKAPAN' ? '#ffffff' : '#10d97a'
          }}
        >
          Perlengkapan ({ingredients.filter(i => (i.category || '').toLowerCase().includes('perlengkapan')).length})
        </button>
        <button
          className={`btn btn-sm ${typeFilter === 'RAW' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTypeFilter('RAW')}
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
        >
          Bahan Mentah ({ingredients.filter(i => i.type !== 'SEMI_FINISHED' && !(i.category || '').toLowerCase().includes('perlengkapan')).length})
        </button>
        <button
          className={`btn btn-sm ${typeFilter === 'SEMI_FINISHED' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTypeFilter('SEMI_FINISHED')}
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
        >
          Bahan Olahan ({ingredients.filter(i => i.type === 'SEMI_FINISHED').length})
        </button>
        <button
          className={`btn btn-sm ${typeFilter === 'LOW_STOCK' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTypeFilter('LOW_STOCK')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: typeFilter === 'LOW_STOCK' ? '#f43f5e' : undefined,
            color: typeFilter === 'LOW_STOCK' ? '#ffffff' : '#f43f5e',
            borderColor: 'rgba(244, 63, 94, 0.4)'
          }}
        >
          Stok Menipis ({ingredients.filter(i => Number(i.current_stock ?? 0) <= Number(i.current_stok_min ?? i.stok_min ?? 0)).length})
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Tipe</th>
              <th>Nama</th>
              <th style={{ minWidth: 100 }}>Kategori</th>
              <th style={{ minWidth: 90 }}>Satuan Beli</th>
              <th style={{ minWidth: 90 }}>Satuan Pakai</th>
              <th style={{ minWidth: 110 }}>Konversi</th>
              <th className="right" style={{ minWidth: 140 }}>Harga Rata-Rata (Moving Avg)</th>
              <th className="right" style={{ minWidth: 135 }}>Harga Satuan Pakai</th>
              <th className="right" style={{ minWidth: 125 }}>Harga PO Terakhir</th>
              <th className="right">Stok Cabang</th>
              <th className="right">Stok Min</th>
              <th className="right">Tolerance %</th>
              <th style={{ minWidth: 160 }}>Riwayat Audit</th>
              <th className="center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {/* Add row */}
            {showAdd && (
              <tr style={{ background: 'var(--accent-dim)' }}>
                <td><FormCell data={addForm} setData={setAddForm} availableCategories={availableCategories} field="code" style={{ width: 80 }} /></td>
                <td>
                  <select
                    className="form-control"
                    style={{ padding: '5px 8px', fontSize: 11.5, minWidth: 90 }}
                    value={addForm.type || 'RAW'}
                    onChange={e => setAddForm(p => ({ ...p, type: e.target.value }))}
                  >
                    <option value="RAW">Bahan Mentah</option>
                    <option value="SEMI_FINISHED">Bahan Olahan</option>
                  </select>
                </td>
                <td>
                  <FormCell data={addForm} setData={setAddForm} availableCategories={availableCategories} field="name" />
                  {addForm.type === 'SEMI_FINISHED' && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
                      <input
                        type="number"
                        step="any"
                        placeholder="Yield"
                        className="form-control mono text-center"
                        style={{ padding: '3px 6px', fontSize: 11, width: 55 }}
                        value={addForm.yield_qty || ''}
                        onChange={e => setAddForm(p => ({ ...p, yield_qty: e.target.value }))}
                      />
                      <input
                        type="text"
                        placeholder="Satuan (potong)"
                        className="form-control"
                        style={{ padding: '3px 6px', fontSize: 11, width: 85 }}
                        value={addForm.yield_unit || ''}
                        onChange={e => setAddForm(p => ({ ...p, yield_unit: e.target.value }))}
                      />
                    </div>
                  )}
                </td>
                <td><FormCell data={addForm} setData={setAddForm} availableCategories={availableCategories} field="category" style={{ width: 95 }} /></td>
                <td><FormCell data={addForm} setData={setAddForm} availableCategories={availableCategories} field="unit_beli" style={{ width: 85 }} /></td>
                <td><FormCell data={addForm} setData={setAddForm} availableCategories={availableCategories} field="unit_pakai" style={{ width: 85 }} /></td>
                <td><FormCell data={addForm} setData={setAddForm} availableCategories={availableCategories} field="konversi" type="number" style={{ width: 75 }} /></td>
                <td className="mono right">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>0</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Otomatis dari Kartu Stok</span>
                  </div>
                </td>
                <td className="mono right">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>0</span>
                    <span style={{ fontSize: 10, color: 'var(--accent-bright)', fontWeight: 500 }}>
                      Otomatis /{addForm.unit_pakai}
                    </span>
                  </div>
                </td>
                <td className="mono right text-muted" title="Harga PO Terakhir">—</td>
                <td className="mono right text-muted" title="Stok Cabang">—</td>
                <td><FormCell data={addForm} setData={setAddForm} availableCategories={availableCategories} field="stok_min" type="number" style={{ width: 75 }} /></td>
                <td><FormCell data={addForm} setData={setAddForm} availableCategories={availableCategories} field="tolerance" type="number" style={{ width: 55 }} /></td>
                <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Data Baru</span></td>
                <td className="center">
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <button className="btn btn-primary btn-sm" onClick={saveNew} disabled={saving}>
                      <Check size={12} />
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(false)}>
                      <X size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {displayedIngredients.map(ing => {
              const isEd = editing === ing.id;
              const hargaPakai = ing.harga / (ing.konversi || 1);
              return (
                <tr key={ing.id} className={isEd ? 'selected' : ''}>
                  <td className="mono" style={{ color: 'var(--accent)', fontSize: 12 }}>{ing.code}</td>
                  <td>
                    {ing.type === 'SEMI_FINISHED' ? (
                      <span className="pill" style={{ fontSize: 10.5, background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                        Olahan
                      </span>
                    ) : (
                      <span className="pill" style={{ fontSize: 10.5, background: 'rgba(34, 197, 94, 0.12)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                        Mentah
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {isEd ? (
                      <FormCell data={editData} setData={setEditData} availableCategories={availableCategories} field="name" />
                    ) : (
                      <div>
                        <div>{ing.name}</div>
                        {ing.type === 'SEMI_FINISHED' && ing.yield_qty && (
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                            Batch yield: {num(ing.yield_qty)} {ing.yield_unit || ing.unit_pakai}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {isEd ? (
                      <FormCell data={editData} setData={setEditData} availableCategories={availableCategories} field="category" style={{ width: 95 }} />
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-soft)',
                          display: 'inline-block'
                        }}
                      >
                        {ing.category}
                      </span>
                    )}
                  </td>
                  <td>{isEd ? <FormCell data={editData} setData={setEditData} availableCategories={availableCategories} field="unit_beli" style={{ width: 85 }} /> : <span className="pill pill-muted mono" style={{ fontSize: 11 }}>{ing.unit_beli}</span>}</td>
                  <td>{isEd ? <FormCell data={editData} setData={setEditData} availableCategories={availableCategories} field="unit_pakai" style={{ width: 85 }} /> : <span className="pill pill-ok mono" style={{ fontSize: 11 }}>{ing.unit_pakai}</span>}</td>
                  <td className="mono">
                    {isEd
                      ? <FormCell data={editData} setData={setEditData} availableCategories={availableCategories} field="konversi" type="number" style={{ width: 75 }} />
                      : <span style={{ fontSize: 12 }}>1 {ing.unit_beli} = <strong style={{ color: 'var(--accent-bright)' }}>{num(ing.konversi)}</strong> {ing.unit_pakai}</span>
                    }
                  </td>
                  {/* Harga Beli Moving Average */}
                  <td className="mono right">
                    <div>
                      <div style={{ fontWeight: 700, color: '#ffffff' }}>{rupiah(ing.harga)}</div>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
                        <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'rgba(124, 58, 237, 0.18)', color: 'var(--accent-bright)', fontWeight: 600 }}>
                          Moving Avg
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>/{ing.unit_beli}</span>
                      </div>
                    </div>
                  </td>
                  {/* Harga Satuan Pakai (Otomatis) */}
                  <td className="mono right">
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--accent-bright)', fontSize: 12.5 }}>
                        {rupiah(hargaPakai)} <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>/{ing.unit_pakai}</span>
                      </div>
                      <span style={{ fontSize: 9.5, color: 'var(--ok)', background: 'rgba(16, 217, 122, 0.1)', padding: '1px 5px', borderRadius: 3 }}>
                        Terkonversi
                      </span>
                    </div>
                  </td>
                  {/* Harga PO Terakhir */}
                  <td className="mono right">
                    <div style={{ fontSize: 12, fontWeight: 600, color: ing.last_purchase_price ? '#34d399' : 'var(--text-muted)' }}>
                      {ing.last_purchase_price ? rupiah(ing.last_purchase_price) : '—'}
                    </div>
                    {ing.last_purchase_price && ing.last_purchase_price !== ing.harga && (
                      <div style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: ing.last_purchase_price > ing.harga ? '#fb7185' : '#34d399',
                        marginTop: 2
                      }}>
                        {ing.last_purchase_price > ing.harga ? '▲ Lebih Tinggi' : '▼ Lebih Rendah'}
                      </div>
                    )}
                  </td>
                  <td className="mono right">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontWeight: 700, color: ing.current_stock <= (ing.current_stok_min ?? ing.stok_min) ? 'var(--danger)' : 'var(--ok)' }}>
                        {fmtQtyVal(ing.current_stock, ing.unit_pakai, hargaPakai)}
                      </span>
                      {ing.outlet_stocks?.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setBreakdownModal(ing)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: 10,
                            color: 'var(--accent-bright)',
                            cursor: 'pointer',
                            padding: 0,
                            textDecoration: 'underline'
                          }}
                        >
                          Rincian {ing.outlet_stocks.length} Cabang
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="mono right">
                    {isEd ? <FormCell data={editData} setData={setEditData} availableCategories={availableCategories} field="stok_min" type="number" style={{ width: 75 }} /> : fmtQtyVal(ing.current_stok_min ?? ing.stok_min, ing.unit_pakai, hargaPakai)}
                  </td>
                  <td className="mono right">
                    {isEd ? <FormCell data={editData} setData={setEditData} availableCategories={availableCategories} field="tolerance" type="number" style={{ width: 55 }} /> : `${ing.tolerance}%`}
                  </td>
                  <td>
                    <AuditInfo
                      createdAt={ing.created_at}
                      createdBy={ing.created_by_name}
                      updatedAt={ing.updated_at}
                      updatedBy={ing.updated_by_name}
                    />
                  </td>
                  <td className="center">
                    {isEd ? (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>
                          <Check size={12} />
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        {ing.type === 'SEMI_FINISHED' && (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Resep Bahan Olahan (Sub-Recipe)"
                              onClick={() => openSubRecipeEditor(ing)}
                              style={{ padding: '4px 7px', color: 'var(--accent-bright)' }}
                            >
                              <ChefHat size={13} />
                            </button>
                            <button
                              className="btn btn-primary btn-sm"
                              title="Masak di Dapur Batch Prep"
                              onClick={() => navigate('/batch-prep')}
                              style={{ padding: '4px 7px' }}
                            >
                              <Flame size={13} />
                            </button>
                          </>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Catat Bahan Rusak / Basi (Waste)"
                          onClick={() => navigate('/waste', { state: { preselectIngredientId: ing.id } })}
                          style={{ padding: '4px 7px', color: '#f43f5e' }}
                        >
                          <Trash2 size={12} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(ing)}>
                          <Edit2 size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Multi-Branch Stock Breakdown Modal */}
      {breakdownModal && (
        <div className="modal-overlay" onClick={() => setBreakdownModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Sebaran Stok Bahan Antar-Cabang
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {breakdownModal.code} — {breakdownModal.name} ({breakdownModal.unit_pakai})
                </span>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setBreakdownModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {breakdownModal.outlet_stocks?.map((os) => {
                const hppPari = breakdownModal.konversi > 0 ? (breakdownModal.harga / breakdownModal.konversi) : breakdownModal.harga;
                return (
                  <div
                    key={os.outlet_id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: os.is_main ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid',
                      borderColor: os.is_main ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.07)',
                      borderRadius: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{os.outlet_name}</span>
                        {os.is_main && (
                          <span style={{ fontSize: 9.5, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>
                            PUSAT
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Par Level Min: {fmtQtyVal(os.stok_min, breakdownModal.unit_pakai, hppPari)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontWeight: 800, fontSize: 13, color: os.is_low ? 'var(--danger)' : 'var(--ok)' }}>
                        {fmtQtyVal(os.stock, breakdownModal.unit_pakai, hppPari)}
                      </div>
                      <span style={{ fontSize: 10, color: os.is_low ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {os.is_low ? 'Di bawah par level' : 'Aman'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button className="btn btn-secondary" onClick={() => setBreakdownModal(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Recipe Configuration Modal */}
      {subRecipeModal && (
        <div className="modal-overlay" onClick={() => setSubRecipeModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ChefHat size={18} style={{ color: 'var(--accent-bright)' }} />
                  Atur Resep Olahan: {subRecipeModal.ingredient_name}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Standar formula bahan mentah per batch masak
                </span>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSubRecipeModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label className="form-label" style={{ fontSize: 11.5 }}>Nama Sub-Recipe:</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: 12 }}
                  value={subRecipeModal.name}
                  onChange={e => setSubRecipeModal(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 11.5 }}>Output 1 Batch:</label>
                <input
                  type="number"
                  step="any"
                  className="form-control mono text-center"
                  style={{ fontSize: 12 }}
                  value={subRecipeModal.output_qty}
                  onChange={e => setSubRecipeModal(p => ({ ...p, output_qty: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 11.5 }}>Satuan Hasil:</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: 12 }}
                  value={subRecipeModal.output_unit}
                  onChange={e => setSubRecipeModal(p => ({ ...p, output_unit: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="form-label" style={{ fontSize: 11.5 }}>Catatan / SOP Racik Dapur:</label>
              <textarea
                className="form-control"
                rows={2}
                style={{ fontSize: 12 }}
                value={subRecipeModal.notes}
                onChange={e => setSubRecipeModal(p => ({ ...p, notes: e.target.value }))}
                placeholder="Petunjuk marinasi, lama ungkep, standar api..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff' }}>Komposisi Bahan Mentah:</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSubRecipeModal(p => ({
                  ...p,
                  items: [...p.items, { ingredient_id: '', qty: 1, unit: 'gram', waste_std: 0 }]
                }))}
              >
                + Tambah Bahan
              </button>
            </div>

            <div className="table-wrap" style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 14 }}>
              <table style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Bahan Mentah</th>
                    <th style={{ width: 90 }}>Qty</th>
                    <th style={{ width: 100 }}>Satuan</th>
                    <th style={{ width: 80 }}>Waste %</th>
                    <th style={{ width: 40 }} className="center">Hapus</th>
                  </tr>
                </thead>
                <tbody>
                  {subRecipeModal.items.map((it, idx) => (
                    <tr key={idx}>
                      <td>
                        <select
                          className="form-control"
                          style={{ fontSize: 12, padding: '4px 8px' }}
                          value={it.ingredient_id}
                          onChange={e => {
                            const cid = Number(e.target.value);
                            const raw = rawIngredients.find(r => r.id === cid);
                            setSubRecipeModal(p => {
                              const items = [...p.items];
                              items[idx] = { ...items[idx], ingredient_id: cid, unit: raw?.unit_pakai || items[idx].unit };
                              return { ...p, items };
                            });
                          }}
                        >
                          <option value="">-- Pilih Bahan Mentah --</option>
                          {rawIngredients.map(r => (
                            <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          className="form-control mono right"
                          style={{ fontSize: 12, padding: '4px 6px' }}
                          value={it.qty}
                          onChange={e => {
                            const val = e.target.value;
                            setSubRecipeModal(p => {
                              const items = [...p.items];
                              items[idx] = { ...items[idx], qty: val };
                              return { ...p, items };
                            });
                          }}
                        />
                      </td>
                      <td>
                        <UnitSelect
                          value={it.unit}
                          options={SATUAN_PAKAI_OPTIONS}
                          style={{ fontSize: 12, padding: '4px 6px' }}
                          onChange={val => {
                            setSubRecipeModal(p => {
                              const items = [...p.items];
                              items[idx] = { ...items[idx], unit: val };
                              return { ...p, items };
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          className="form-control mono right"
                          style={{ fontSize: 12, padding: '4px 6px' }}
                          value={it.waste_std}
                          onChange={e => {
                            const val = e.target.value;
                            setSubRecipeModal(p => {
                              const items = [...p.items];
                              items[idx] = { ...items[idx], waste_std: val };
                              return { ...p, items };
                            });
                          }}
                        />
                      </td>
                      <td className="center">
                        {subRecipeModal.items.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon btn-sm text-danger"
                            onClick={() => {
                              setSubRecipeModal(p => ({
                                ...p,
                                items: p.items.filter((_, i) => i !== idx)
                              }));
                            }}
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSubRecipeModal(null);
                  navigate('/batch-prep');
                }}
              >
                Buka Halaman Produksi Dapur
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setSubRecipeModal(null)} disabled={savingSubRecipe}>
                  Batal
                </button>
                <button className="btn btn-primary" onClick={handleSaveSubRecipe} disabled={savingSubRecipe}>
                  {savingSubRecipe ? 'Menyimpan...' : 'Simpan Resep'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ImportMasterModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        targetMaster="INGREDIENT"
        onSuccess={() => {
          fetchIngredients();
        }}
      />
    </div>
  );
}
