import { useState, useEffect, useMemo } from 'react';
import {
  ChefHat, Plus, Search, Filter, Check, AlertTriangle, Clock,
  ArrowRight, Sparkles, Calculator, Package, Store, X, Eye,
  RefreshCw, Layers, Calendar, Flame, ChevronRight, CheckCircle2
} from 'lucide-react';
import api from '../api/client';
import { rupiah, num, fmtQtyVal, LoadingState, PageHeader, AuditInfo, UnitSelect, SATUAN_PAKAI_OPTIONS, PeriodPicker } from '../components/ui';
import { getTodayStr } from '../utils/date';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';

export default function BatchPrep() {
  const { activeOutletId, activeOutlet, outlets } = useOutlet();

  const [activeTab, setActiveTab] = useState('katalog'); // 'katalog' | 'riwayat'
  const [recipes, setRecipes] = useState([]);
  const [batches, setBatches] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState({
    totalOlahan: 0,
    batchHariIni: 0,
    nilaiProduksiHariIni: 0,
    stokMenipis: 0,
  });

  // Modal Masak Batch
  const [cookModalOpen, setCookModalOpen] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [selectedCookOutletId, setSelectedCookOutletId] = useState('');
  const [batchMultiplier, setBatchMultiplier] = useState(1);
  const [actualOutputQty, setActualOutputQty] = useState('');
  const [cookDate, setCookDate] = useState(getTodayStr());
  const [cookNotes, setCookNotes] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [batchPreview, setBatchPreview] = useState(null);
  const [cooking, setCooking] = useState(false);

  // Modal Detail Batch
  const [detailModalBatch, setDetailModalBatch] = useState(null);

  // Modal Edit / Buat Sub-Recipe
  const [subRecipeModal, setSubRecipeModal] = useState(null);
  const [savingRecipe, setSavingRecipe] = useState(false);

  // Riwayat Filter
  const [historyFilter, setHistoryFilter] = useState({
    search: '',
    from: '',
    to: '',
  });

  useEffect(() => {
    fetchAllData();
  }, [activeOutletId]);

  async function fetchAllData() {
    setLoading(true);
    try {
      const targetOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : undefined;

      const [recipeRes, batchRes, ingRes] = await Promise.all([
        api.get('/prep-recipes'),
        api.get('/batch-preps', { params: { outlet_id: targetOutlet } }),
        api.get('/ingredients', { params: { outlet_id: targetOutlet } }),
      ]);

      const recs = recipeRes.data || [];
      const bchs = batchRes.data?.data || batchRes.data || [];
      const ings = ingRes.data || [];

      setRecipes(recs);
      setBatches(bchs);
      setIngredients(ings);

      // Compute stats
      const todayStr = getTodayStr();
      const todayBatches = bchs.filter(b => b.date === todayStr);
      const semiFinishedIngs = ings.filter(i => i.type === 'SEMI_FINISHED');
      const lowStockCount = semiFinishedIngs.filter(i => Number(i.current_stock ?? 0) <= Number(i.current_stok_min ?? i.stok_min ?? 0)).length;

      setStats({
        totalOlahan: semiFinishedIngs.length,
        batchHariIni: todayBatches.length,
        nilaiProduksiHariIni: todayBatches.reduce((acc, b) => acc + (Number(b.total_cost) || 0), 0),
        stokMenipis: lowStockCount,
      });
    } catch {
      toast.error('Gagal memuat data bahan olahan');
    } finally {
      setLoading(false);
    }
  }

  // Fetch preview calculation when recipe, multiplier, outlet, or modal state changes
  useEffect(() => {
    if (!selectedRecipeId || !cookModalOpen) {
      setBatchPreview(null);
      return;
    }
    fetchPreview(selectedRecipeId, batchMultiplier, selectedCookOutletId);
  }, [selectedRecipeId, batchMultiplier, selectedCookOutletId, cookModalOpen]);

  async function fetchPreview(recipeId, mult, outletId) {
    setPreviewLoading(true);
    try {
      const targetOutlet = outletId || (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : (outlets[0]?.id || 1));
      const { data } = await api.get('/batch-preps/preview', {
        params: {
          prep_recipe_id: recipeId,
          batch_multiplier: mult,
          outlet_id: targetOutlet,
        }
      });
      setBatchPreview(data);
      if (!actualOutputQty || actualOutputQty === '') {
        setActualOutputQty(data.expected_output_qty);
      }
    } catch {
      toast.error('Gagal menghitung kalkulasi batch');
    } finally {
      setPreviewLoading(false);
    }
  }

  function openCookModal(recipe = null) {
    const defaultOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all'
      ? String(activeOutletId)
      : String(outlets[0]?.id || '1');
    setSelectedCookOutletId(defaultOutlet);

    if (recipe) {
      setSelectedRecipeId(recipe.id);
      setBatchMultiplier(1);
      setActualOutputQty(recipe.output_qty);
    } else if (recipes.length > 0) {
      setSelectedRecipeId(recipes[0].id);
      setBatchMultiplier(1);
      setActualOutputQty(recipes[0].output_qty);
    }
    setCookDate(getTodayStr());
    setCookNotes('');
    setCookModalOpen(true);
  }

  async function handleExecuteCook() {
    if (!selectedRecipeId) {
      toast.error('Pilih resep olahan');
      return;
    }
    if (!actualOutputQty || Number(actualOutputQty) <= 0) {
      toast.error('Hasil masak aktual harus lebih besar dari 0');
      return;
    }

    setCooking(true);
    try {
      const targetOutlet = selectedCookOutletId || (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : (outlets[0]?.id || 1));
      const payload = {
        prep_recipe_id: Number(selectedRecipeId),
        outlet_id: Number(targetOutlet),
        date: cookDate,
        batch_multiplier: Number(batchMultiplier),
        actual_output_qty: Number(actualOutputQty),
        notes: cookNotes,
        allow_shortage: true, // Allow if kitchen confirmed
      };

      const { data } = await api.post('/batch-preps', payload);
      toast.success(`Batch ${data.batch_no} berhasil dimasak & stok diperbarui!`);
      setCookModalOpen(false);
      fetchAllData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal memproses batch prep';
      toast.error(msg);
    } finally {
      setCooking(false);
    }
  }

  // Sub-Recipe Editor
  function openSubRecipeEditor(recipeOrIngredient = null) {
    if (recipeOrIngredient && recipeOrIngredient.items) {
      // Editing existing sub-recipe
      const ing = recipeOrIngredient.ingredient;
      setSubRecipeModal({
        id: recipeOrIngredient.id,
        ingredient_id: recipeOrIngredient.ingredient_id,
        name: ing?.name || recipeOrIngredient.name || '',
        category: ing?.category || 'Bahan Olahan',
        output_qty: recipeOrIngredient.output_qty,
        output_unit: recipeOrIngredient.output_unit || ing?.unit_pakai || 'kg',
        stok_min: ing?.current_stok_min ?? ing?.stok_min ?? 0,
        notes: recipeOrIngredient.notes || '',
        items: recipeOrIngredient.items.map(it => ({
          ingredient_id: it.ingredient_id,
          qty: it.qty,
          unit: it.unit,
          waste_std: it.waste_std || 0,
        })),
      });
    } else if (recipeOrIngredient && recipeOrIngredient.id) {
      // Semi-finished ingredient passed without existing recipe
      setSubRecipeModal({
        id: null,
        ingredient_id: recipeOrIngredient.id,
        name: recipeOrIngredient.name,
        category: recipeOrIngredient.category || 'Bahan Olahan',
        output_qty: recipeOrIngredient.yield_qty || 1,
        output_unit: recipeOrIngredient.yield_unit || recipeOrIngredient.unit_pakai || 'kg',
        stok_min: recipeOrIngredient.stok_min ?? 0,
        notes: '',
        items: [
          { ingredient_id: '', qty: 1, unit: 'gram', waste_std: 0 }
        ],
      });
    } else {
      // Direct creation of a NEW Bahan Olahan
      setSubRecipeModal({
        id: null,
        ingredient_id: null,
        name: '',
        category: 'Bahan Olahan',
        output_qty: 10,
        output_unit: 'kg',
        stok_min: 0,
        notes: '',
        items: [
          { ingredient_id: '', qty: 1, unit: 'gram', waste_std: 0 }
        ],
      });
    }
  }

  async function handleSaveSubRecipe() {
    if (!subRecipeModal.name?.trim()) {
      toast.error('Nama bahan olahan wajib diisi (Contoh: Ayam Marinasi)');
      return;
    }
    if (!subRecipeModal.output_qty || Number(subRecipeModal.output_qty) <= 0) {
      toast.error('Hasil 1 batch standar harus lebih besar dari 0');
      return;
    }
    if (!subRecipeModal.output_unit?.trim()) {
      toast.error('Satuan output standar wajib diisi (Contoh: kg, porsi, liter)');
      return;
    }
    const validItems = (subRecipeModal.items || []).filter(i => i.ingredient_id && Number(i.qty) > 0);
    if (validItems.length === 0) {
      toast.error('Tambahkan minimal 1 bahan mentah pendukung resep');
      return;
    }

    setSavingRecipe(true);
    try {
      const payload = {
        name: subRecipeModal.name.trim(),
        category: subRecipeModal.category?.trim() || 'Bahan Olahan',
        output_qty: Number(subRecipeModal.output_qty),
        output_unit: subRecipeModal.output_unit.trim(),
        stok_min: Number(subRecipeModal.stok_min || 0),
        notes: subRecipeModal.notes || '',
        items: validItems.map(it => ({
          ingredient_id: Number(it.ingredient_id),
          qty: Number(it.qty),
          unit: it.unit,
          waste_std: Number(it.waste_std || 0),
        })),
      };

      if (subRecipeModal.ingredient_id) {
        payload.ingredient_id = Number(subRecipeModal.ingredient_id);
      }

      await api.post('/prep-recipes', payload);
      toast.success(subRecipeModal.ingredient_id ? 'Resep bahan olahan berhasil diperbarui!' : 'Bahan olahan baru & resep berhasil didaftarkan!');
      setSubRecipeModal(null);
      fetchAllData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan resep';
      toast.error(msg);
    } finally {
      setSavingRecipe(false);
    }
  }

  const rawIngredients = useMemo(() => {
    if (!subRecipeModal?.ingredient_id) return ingredients;
    return ingredients.filter(i => Number(i.id) !== Number(subRecipeModal.ingredient_id));
  }, [ingredients, subRecipeModal?.ingredient_id]);

  const estimatedCostData = useMemo(() => {
    if (!subRecipeModal || !subRecipeModal.items) return { totalCost: 0, costPerUnit: 0 };
    let total = 0;
    for (const item of subRecipeModal.items) {
      if (!item.ingredient_id || !item.qty) continue;
      const ing = ingredients.find(i => Number(i.id) === Number(item.ingredient_id));
      if (!ing) continue;
      const konv = Math.max(Number(ing.konversi) || 1, 1);
      const costPerPakai = (Number(ing.harga) || 0) / konv;
      const isBeli = (item.unit && ing.unit_beli && item.unit.toLowerCase() === ing.unit_beli.toLowerCase());
      const baseQty = Number(item.qty) || 0;
      const qtyPakai = isBeli ? (baseQty * konv) : baseQty;
      const wasteFactor = 1 + ((Number(item.waste_std) || 0) / 100);
      total += (qtyPakai * costPerPakai * wasteFactor);
    }
    const outputQty = Number(subRecipeModal.output_qty) || 0;
    const costPerUnit = outputQty > 0 ? (total / outputQty) : 0;
    return { totalCost: Math.round(total), costPerUnit: Math.round(costPerUnit) };
  }, [subRecipeModal, ingredients]);

  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      if (historyFilter.search) {
        const s = historyFilter.search.toLowerCase();
        const matchNo = b.batch_no?.toLowerCase().includes(s);
        const matchName = b.ingredient?.name?.toLowerCase().includes(s);
        if (!matchNo && !matchName) return false;
      }
      if (historyFilter.from && b.date < historyFilter.from) return false;
      if (historyFilter.to && b.date > historyFilter.to) return false;
      return true;
    });
  }, [batches, historyFilter]);

  if (loading) return <LoadingState />;

  return (
    <div className="fade-in">
      <PageHeader
        title="Dapur Produksi Batch (Prep Goods)"
        subtitle="Kelola konversi bahan mentah menjadi bahan olahan setengah jadi (sub-recipes) dengan kalkulasi HPP dan pemotongan stok otomatis."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={fetchAllData}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="btn btn-secondary" onClick={() => openSubRecipeEditor(null)}>
              <Plus size={15} /> + Resep Olahan Baru
            </button>
            <button className="btn btn-primary" onClick={() => openCookModal()}>
              <Flame size={15} /> + Masak Batch Olahan
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid-4 mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div className="card" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
            <span>Bahan Olahan Aktif</span>
            <div style={{ padding: 6, borderRadius: 8, background: 'rgba(139, 92, 246, 0.2)', color: 'var(--accent-bright)' }}><Package size={16} /></div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#ffffff', marginTop: 8 }}>{stats.totalOlahan} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Item Olahan</span></div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Tersedia untuk resep menu POS</div>
        </div>

        <div className="card" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, rgba(20, 83, 45, 0.2) 0%, rgba(15, 23, 42, 0.6) 100%)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
            <span>Batch Dimasak Hari Ini</span>
            <div style={{ padding: 6, borderRadius: 8, background: 'rgba(34, 197, 94, 0.2)', color: 'var(--ok)' }}><Flame size={16} /></div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#ffffff', marginTop: 8 }}>{stats.batchHariIni} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Sesi Masak</span></div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Produksi batch dapur hari ini</div>
        </div>

        <div className="card" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.2) 0%, rgba(15, 23, 42, 0.6) 100%)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
            <span>Nilai Produksi Hari Ini</span>
            <div style={{ padding: 6, borderRadius: 8, background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}><Calculator size={16} /></div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', marginTop: 8 }}>{rupiah(stats.nilaiProduksiHariIni)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Total HPP bahan mentah terpakai</div>
        </div>

        <div className="card" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, rgba(136, 19, 55, 0.2) 0%, rgba(15, 23, 42, 0.6) 100%)', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
            <span>Stok Olahan Menipis</span>
            <div style={{ padding: 6, borderRadius: 8, background: 'rgba(244, 63, 94, 0.2)', color: '#fb7185' }}><AlertTriangle size={16} /></div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: stats.stokMenipis > 0 ? '#fb7185' : '#ffffff', marginTop: 8 }}>{stats.stokMenipis} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Item Kritis</span></div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Perlu dimasak ulang sebelum jam sibuk</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('katalog')}
          style={{
            padding: '10px 18px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'katalog' ? '2px solid var(--accent-bright)' : '2px solid transparent',
            color: activeTab === 'katalog' ? 'var(--accent-bright)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Layers size={15} /> Katalog Bahan Olahan & Sub-Recipes ({recipes.length})
        </button>

        <button
          onClick={() => setActiveTab('riwayat')}
          style={{
            padding: '10px 18px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'riwayat' ? '2px solid var(--accent-bright)' : '2px solid transparent',
            color: activeTab === 'riwayat' ? 'var(--accent-bright)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Clock size={15} /> Riwayat Masak Batch ({batches.length})
        </button>
      </div>

      {/* TAB 1: KATALOG BAHAN OLAHAN */}
      {activeTab === 'katalog' && (
        <div>
          {recipes.length === 0 ? (
            <div className="card text-center" style={{ padding: '50px 20px' }}>
              <ChefHat size={48} style={{ color: 'var(--accent)', margin: '0 auto 14px' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Belum Ada Resep Bahan Olahan (Sub-Recipe)</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 500, margin: '8px auto 20px' }}>
                Buat resep bahan setengah jadi seperti Ayam Ungkep Marinasi, Sambal Matang, Saus Steak, atau Kaldu Bakso untuk mempercepat operasional dapur.
              </div>
              <button className="btn btn-primary" onClick={() => openSubRecipeEditor(null)}>
                <Plus size={14} /> Buat Bahan Olahan Baru
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Formula bahan olahan dapur & standar pemotongan bahan mentah.
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => openSubRecipeEditor(null)}>
                  <Plus size={14} /> + Buat Bahan Olahan Baru
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
              {recipes.map(recipe => {
                const ing = recipe.ingredient;
                const currentStock = ing?.current_stock ?? 0;
                const minStock = ing?.current_stok_min ?? ing?.stok_min ?? 0;
                const isLow = currentStock <= minStock;

                return (
                  <div
                    key={recipe.id}
                    className="card"
                    style={{
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: isLow ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid var(--border)',
                      background: isLow ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.05) 0%, rgba(17, 22, 45, 0.8) 100%)' : 'var(--bg-card)',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                    }}
                  >
                    <div>
                      {/* Top header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--accent-bright)', fontWeight: 600 }}>
                            {ing?.code || 'PREP'}
                          </span>
                          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', marginTop: 2, marginBottom: 4 }}>
                            {ing?.name || recipe.name}
                          </h3>
                          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                            {recipe.name}
                          </div>
                        </div>

                        <span
                          className="pill"
                          style={{
                            fontSize: 11,
                            background: isLow ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: isLow ? '#fb7185' : '#34d399',
                            border: `1px solid ${isLow ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                          }}
                        >
                          {isLow ? '⚠️ Stok Menipis' : '🟢 Stok Aman'}
                        </span>
                      </div>

                      {/* Stock on Hand & Par Level */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 8,
                        padding: '10px 14px',
                        marginBottom: 12,
                        gap: 10
                      }}>
                        <div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Stok Siap Pakai</div>
                          <div style={{ fontSize: 17, fontWeight: 700, color: isLow ? '#fb7185' : '#ffffff', marginTop: 2 }}>
                            {num(currentStock)} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>{ing?.unit_pakai}</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Standar Batch</div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                            {num(recipe.output_qty)} <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{recipe.output_unit} / batch</span>
                          </div>
                        </div>
                      </div>

                      {/* Ingredients List */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span>Komposisi Bahan Mentah ({recipe.items?.length || 0} bahan):</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {recipe.items?.map(it => (
                            <div
                              key={it.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: 11.5,
                                padding: '3px 0',
                                borderBottom: '1px dashed rgba(255, 255, 255, 0.05)',
                              }}
                            >
                              <span style={{ color: 'var(--text-primary)' }}>• {it.ingredient?.name || 'Bahan Mentah'}</span>
                              <span className="mono" style={{ color: 'var(--accent-bright)' }}>
                                {num(it.qty)} {it.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Estimated Cost calculation */}
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: 'rgba(99, 102, 241, 0.08)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        marginBottom: 16,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Estimasi Total 1 Batch</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                            {rupiah(recipe.estimated_batch_cost || 0)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>HPP / {recipe.output_unit}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-bright)' }}>
                            {rupiah(recipe.estimated_unit_cost || 0)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => openSubRecipeEditor(recipe)}
                      >
                        <Layers size={13} /> Edit Resep
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1.3 }}
                        onClick={() => openCookModal(recipe)}
                      >
                        <Flame size={13} /> Masak Batch Ini
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RIWAYAT MASAK BATCH */}
      {activeTab === 'riwayat' && (
        <div>
          {/* Filters */}
          <div className="card mb-3" style={{ padding: '12px 16px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 200px', position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 32, fontSize: 12.5 }}
                placeholder="Cari Batch No atau Bahan..."
                value={historyFilter.search}
                onChange={e => setHistoryFilter(p => ({ ...p, search: e.target.value }))}
              />
            </div>

            <PeriodPicker
              from={historyFilter.from}
              to={historyFilter.to}
              onChange={({ from, to }) => setHistoryFilter(p => ({ ...p, from, to }))}
              label="Periode"
              align="left"
            />

            {(historyFilter.search || historyFilter.from || historyFilter.to) && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setHistoryFilter({ search: '', from: '', to: '' })}
              >
                Reset
              </button>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>No. Batch</th>
                  <th>Tanggal</th>
                  <th>Outlet</th>
                  <th>Bahan Olahan</th>
                  <th className="center">Pengali</th>
                  <th className="right">Hasil Jadi (Actual Yield)</th>
                  <th className="right">Total Biaya Bahan</th>
                  <th className="right">HPP per Satuan</th>
                  <th>Koki / Operator</th>
                  <th className="center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center text-muted" style={{ padding: 40 }}>
                      Tidak ada riwayat produksi batch yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map(batch => (
                    <tr key={batch.id}>
                      <td className="mono" style={{ color: 'var(--accent-bright)', fontWeight: 600, fontSize: 12 }}>
                        {batch.batch_no}
                      </td>
                      <td style={{ fontSize: 12 }}>{batch.date}</td>
                      <td style={{ fontSize: 12 }}>{batch.outlet?.name || batch.outlet_name || 'Outlet Pusat'}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#ffffff' }}>
                          {batch.ingredient?.name || 'Bahan Olahan'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {batch.prep_recipe?.name}
                        </div>
                      </td>
                      <td className="center mono" style={{ fontSize: 12 }}>
                        <span className="pill pill-accent" style={{ fontSize: 11 }}>{batch.batch_multiplier}x</span>
                      </td>
                      <td className="right mono" style={{ fontWeight: 700, color: '#34d399', fontSize: 13 }}>
                        {fmtQtyVal(batch.actual_output_qty, batch.output_unit, batch.unit_cost)}
                      </td>
                      <td className="right mono" style={{ fontWeight: 600, fontSize: 12.5 }}>
                        {rupiah(batch.total_cost)}
                      </td>
                      <td className="right mono" style={{ fontWeight: 600, color: 'var(--accent-bright)', fontSize: 12.5 }}>
                        {rupiah(batch.unit_cost)} <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>/{batch.output_unit}</span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {batch.user_name || batch.user?.name || batch.creator?.name || 'Koki Dapur'}
                      </td>
                      <td className="center">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setDetailModalBatch(batch)}
                          title="Lihat Detail Pemotongan Bahan"
                        >
                          <Eye size={12} /> Detail
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: MASAK BATCH OLAHAN BARU */}
      {cookModalOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto',
            background: '#0e1329', border: '1px solid rgba(139, 92, 246, 0.3)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(139, 92, 246, 0.2)', color: 'var(--accent-bright)' }}>
                  <Flame size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: 0 }}>Masak Batch Olahan Baru</h3>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Potong stok bahan mentah otomatis dan tambah persediaan olahan siap pakai
                  </div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setCookModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {recipes.length === 0 ? (
                <div style={{
                  padding: 20,
                  borderRadius: 10,
                  background: 'rgba(234, 179, 8, 0.08)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  marginBottom: 16,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fde047', marginBottom: 6 }}>
                    ⚠️ Belum Ada Resep Bahan Olahan Terdaftar
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 450, margin: '0 auto 14px', lineHeight: 1.5 }}>
                    Anda belum mendaftarkan komposisi resep olahan. Buat resep olahan (Sub-Recipe) terlebih dahulu untuk menentukan bahan mentah yang akan dipotong.
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setCookModalOpen(false);
                      openSubRecipeEditor(null);
                    }}
                    style={{ fontWeight: 700 }}
                  >
                    <Plus size={14} /> + Buat Resep Bahan Olahan Sekarang
                  </button>
                </div>
              ) : (
                <>
                  {/* Step 1: Select Outlet, Recipe & Multiplier */}
                  <div className="form-group mb-3">
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Gudang / Cabang Dapur Pelaksana:
                    </label>
                    <select
                      className="form-control"
                      style={{ fontSize: 13, fontWeight: 700, background: 'var(--card-bg)', color: '#ffffff' }}
                      value={selectedCookOutletId}
                      onChange={e => setSelectedCookOutletId(e.target.value)}
                    >
                      {outlets.map(o => (
                        <option key={o.id} value={o.id} style={{ background: '#11162d', color: '#ffffff' }}>
                          {o.is_main ? '🏢 ' : '📍 '} {o.name} ({o.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 16 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Pilih Bahan Olahan / Resep:
                      </label>
                      <select
                        className="form-control"
                        style={{ fontSize: 13, fontWeight: 600 }}
                        value={selectedRecipeId}
                        onChange={e => {
                          setSelectedRecipeId(e.target.value);
                          const rec = recipes.find(r => r.id === Number(e.target.value));
                          if (rec) {
                            setActualOutputQty(rec.output_qty * batchMultiplier);
                          }
                        }}
                      >
                        {recipes.map(r => (
                          <option key={r.id} value={r.id} style={{ background: '#11162d', color: '#ffffff' }}>
                            {r.ingredient?.name || r.name} ({r.output_qty} {r.output_unit}/batch)
                          </option>
                        ))}
                      </select>
                    </div>

                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Pengali Batch (Jumlah Masak):
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      className="form-control mono text-center"
                      style={{ fontSize: 14, fontWeight: 700 }}
                      value={batchMultiplier}
                      onChange={e => {
                        const val = Math.max(0.1, Number(e.target.value || 1));
                        setBatchMultiplier(val);
                        if (batchPreview) {
                          setActualOutputQty(Number((batchPreview.recipe.output_qty * val).toFixed(3)));
                        }
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 6px', fontSize: 10 }}
                        onClick={() => {
                          const n = batchMultiplier + 1;
                          setBatchMultiplier(n);
                          if (batchPreview) setActualOutputQty(Number((batchPreview.recipe.output_qty * n).toFixed(3)));
                        }}
                      >+1x</button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 6px', fontSize: 10 }}
                        onClick={() => {
                          const n = Math.max(0.5, batchMultiplier - 0.5);
                          setBatchMultiplier(n);
                          if (batchPreview) setActualOutputQty(Number((batchPreview.recipe.output_qty * n).toFixed(3)));
                        }}
                      >-0.5</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Outlet and Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Tanggal Masak:</label>
                  <input
                    type="date"
                    className="form-control"
                    style={{ fontSize: 12.5 }}
                    value={cookDate}
                    onChange={e => setCookDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Outlet Lokasi Dapur:</label>
                  <div className="form-control" style={{ fontSize: 12.5, color: 'var(--text-primary)', background: 'rgba(255, 255, 255, 0.04)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Store size={14} style={{ color: 'var(--accent-bright)' }} />
                    {activeOutlet?.name || outlets[0]?.name || 'Outlet Pusat'}
                  </div>
                </div>
              </div>

              {/* Live Preview Box */}
              {previewLoading ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Menghitung kebutuhan bahan mentah...
                </div>
              ) : batchPreview && (
                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Kebutuhan Bahan Mentah ({batchPreview.items.length} item)</span>
                    </div>
                    {batchPreview.has_shortage ? (
                      <span className="pill" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.3)', fontSize: 11 }}>
                        ⚠️ Ada Bahan Kurang
                      </span>
                    ) : (
                      <span className="pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: 11 }}>
                        🟢 Semua Stok Cukup
                      </span>
                    )}
                  </div>

                  <div className="table-wrap" style={{ maxHeight: 200, overflowY: 'auto' }}>
                    <table style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Bahan Mentah</th>
                          <th className="right">Dibutuhkan</th>
                          <th className="right">Stok Outlet</th>
                          <th className="right">Biaya (HPP)</th>
                          <th className="center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchPreview.items.map(it => (
                          <tr key={it.ingredient_id} style={{ background: !it.is_sufficient ? 'rgba(244, 63, 94, 0.08)' : 'transparent' }}>
                            <td style={{ fontWeight: 500 }}>{it.name}</td>
                            <td className="right mono" style={{ color: 'var(--accent-bright)' }}>
                              {num(it.needed_qty)} {it.unit_pakai}
                            </td>
                            <td className="right mono" style={{ color: it.is_sufficient ? '#ffffff' : '#fb7185' }}>
                              {num(it.available_stock)} {it.unit_pakai}
                            </td>
                            <td className="right mono">{rupiah(it.total_cost)}</td>
                            <td className="center">
                              {it.is_sufficient ? (
                                <span style={{ color: '#34d399', fontSize: 11 }}>Cukup</span>
                              ) : (
                                <span style={{ color: '#fb7185', fontSize: 11, fontWeight: 700 }}>
                                  Kurang {num(it.shortage)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary cost bar */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Total Biaya Bahan Mentah:
                    </span>
                    <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
                      {rupiah(batchPreview.total_estimated_cost)}
                    </span>
                  </div>
                </div>
              )}

              {/* Step 3: Actual Yield Output & Chef Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Hasil Jadi Matang Aktual (Actual Yield):
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      className="form-control mono text-right"
                      style={{ fontSize: 14, fontWeight: 700, borderColor: 'var(--accent-bright)' }}
                      value={actualOutputQty}
                      onChange={e => setActualOutputQty(e.target.value)}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 50 }}>
                      {batchPreview?.output_unit || 'potong'}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Target resep: {num(batchPreview?.expected_output_qty || 0)} {batchPreview?.output_unit}. Sesuaikan jika ada selisih susut masak.
                  </span>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Catatan Koki / Batch Notes (Opsional):
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: 12.5 }}
                    placeholder="Contoh: Dimasak oleh Chef Budi, hasil bagus..."
                    value={cookNotes}
                    onChange={e => setCookNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Bottom Estimated Unit Cost */}
              {actualOutputQty > 0 && batchPreview && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(30, 27, 75, 0.3) 100%)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--accent-bright)', fontWeight: 600 }}>
                      ⚡ Kalkulasi HPP Unit Olahan Baru:
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      Total Biaya Bahan ({rupiah(batchPreview.total_estimated_cost)}) ÷ {actualOutputQty} {batchPreview.output_unit}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: '#ffffff' }}>
                    {rupiah(batchPreview.total_estimated_cost / Number(actualOutputQty))} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>/{batchPreview.output_unit}</span>
                  </div>
                </div>
              )}
                </>
              )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCookModalOpen(false)}
                disabled={cooking}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecuteCook}
                disabled={cooking}
                style={{ minWidth: 160 }}
              >
                {cooking ? 'Memproses...' : <><Check size={14} /> Konfirmasi & Masak</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETAIL RIWAYAT BATCH */}
      {detailModalBatch && (
        <div className="modal-backdrop" style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: 650, maxHeight: '85vh', overflowY: 'auto',
            background: '#0e1329', border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--accent-bright)' }}>{detailModalBatch.batch_no}</span>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: '2px 0 0' }}>
                  Detail Produksi: {detailModalBatch.ingredient?.name}
                </h3>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setDetailModalBatch(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {/* Overview grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
                background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 8, marginBottom: 16
              }}>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Tanggal Masak</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', marginTop: 2 }}>{detailModalBatch.date}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Hasil Produksi</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399', marginTop: 2 }}>
                    {num(detailModalBatch.actual_output_qty)} {detailModalBatch.output_unit}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>HPP per Unit</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-bright)', marginTop: 2 }}>
                    {rupiah(detailModalBatch.unit_cost)}
                  </div>
                </div>
              </div>

              {detailModalBatch.notes && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, fontStyle: 'italic' }}>
                  Catatan: "{detailModalBatch.notes}"
                </div>
              )}

              {/* Deducted raw ingredients */}
              <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', marginBottom: 8 }}>
                Bahan Mentah yang Dikonsumsi (Dipotong):
              </div>
              <div className="table-wrap">
                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Bahan Mentah</th>
                      <th className="right">Jumlah Terpakai</th>
                      <th className="right">Harga Satuan</th>
                      <th className="right">Subtotal Biaya</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailModalBatch.movements?.filter(m => m.type === 'PREP_USAGE').map(mov => (
                      <tr key={mov.id}>
                        <td style={{ fontWeight: 500 }}>{mov.ingredient?.name || 'Bahan Mentah'}</td>
                        <td className="right mono" style={{ color: '#fb7185' }}>
                          -{num(mov.qty)} {mov.ingredient?.unit_pakai}
                        </td>
                        <td className="right mono">{rupiah(mov.unit_price)}</td>
                        <td className="right mono" style={{ fontWeight: 600 }}>{rupiah(mov.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} style={{ fontWeight: 700, textAlign: 'right' }}>Total HPP Batch:</td>
                      <td className="right mono" style={{ fontWeight: 700, color: '#ffffff', fontSize: 13 }}>
                        {rupiah(detailModalBatch.total_cost)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
              <button className="btn btn-secondary" onClick={() => setDetailModalBatch(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BUAT / EDIT RESEP BAHAN OLAHAN */}
      {subRecipeModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: 740, maxHeight: '90vh', overflowY: 'auto',
            background: '#0e1329', border: '1px solid rgba(139, 92, 246, 0.3)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ChefHat size={18} style={{ color: 'var(--accent-bright)' }} />
                  {subRecipeModal.ingredient_id ? `Edit Resep: ${subRecipeModal.name}` : 'Buat Bahan Olahan Baru (Sub-Recipe)'}
                </h3>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {subRecipeModal.ingredient_id
                    ? 'Perbarui standar komposisi bahan mentah dan kuantitas hasil produksi'
                    : 'Bahan olahan baru (misal: Ayam Marinasi) akan otomatis dibuat dan tersimpan di Master Bahan'}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSubRecipeModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {/* Petunjuk info pembuat olahan */}
              {!subRecipeModal.ingredient_id && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  fontSize: 12,
                  color: '#c7d2fe',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10
                }}>
                  <Sparkles size={16} style={{ color: '#818cf8', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Bahan Olahan Mandiri:</strong> Masukkan nama bahan olahan baru yang ingin dibuat (contoh: <em>Ayam Marinasi</em>).
                    Sistem langsung mendaftarkannya sebagai item baru bertipe <strong>Bahan Olahan</strong> di Master Bahan tanpa menimpa bahan mentah Anda.
                  </div>
                </div>
              )}

              {/* Baris 1: Nama & Kategori */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-bright)' }}>
                    Nama Bahan Olahan: *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: 13, fontWeight: 600 }}
                    placeholder="Contoh: Ayam Marinasi / Saus Keju Racik / Sambal Terasi"
                    value={subRecipeModal.name}
                    onChange={e => setSubRecipeModal(p => ({ ...p, name: e.target.value }))}
                    autoFocus={!subRecipeModal.ingredient_id}
                  />
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>
                    Nama bahan olahan yang akan tampil di Master Bahan & Resep Menu POS
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Kategori:
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: 12.5 }}
                    placeholder="Bahan Olahan"
                    value={subRecipeModal.category}
                    onChange={e => setSubRecipeModal(p => ({ ...p, category: e.target.value }))}
                  />
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>
                    Pengelompokan kategori bahan
                  </div>
                </div>
              </div>

              {/* Baris 2: Output Standar 1 Batch & Satuan & Stok Min */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Hasil 1 Batch Standar: *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    className="form-control mono text-center"
                    style={{ fontSize: 13, fontWeight: 700 }}
                    value={subRecipeModal.output_qty}
                    onChange={e => setSubRecipeModal(p => ({ ...p, output_qty: e.target.value }))}
                  />
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>
                    Kuantitas hasil produksi 1 kali masak
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Satuan Output: *
                  </label>
                  <UnitSelect
                    value={subRecipeModal.output_unit}
                    options={SATUAN_PAKAI_OPTIONS}
                    style={{ fontSize: 12.5 }}
                    onChange={val => setSubRecipeModal(p => ({ ...p, output_unit: val }))}
                  />
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>
                    Satuan stok olahan (kg, porsi, liter)
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Alert Stok Minimum:
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="form-control mono text-center"
                    style={{ fontSize: 12.5 }}
                    value={subRecipeModal.stok_min}
                    onChange={e => setSubRecipeModal(p => ({ ...p, stok_min: e.target.value }))}
                  />
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>
                    Peringatan jika sisa stok &le; angka ini
                  </div>
                </div>
              </div>

              {/* Baris 3: SOP Petunjuk Racik Dapur */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Petunjuk SOP Racik / Masak Dapur (Opsional):
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  style={{ fontSize: 12 }}
                  placeholder="Contoh: Marinasi daging minimal 2 jam dalam chiller sebelum digoreng..."
                  value={subRecipeModal.notes}
                  onChange={e => setSubRecipeModal(p => ({ ...p, notes: e.target.value }))}
                />
              </div>

              {/* Baris 4: Komposisi Bahan Mentah */}
              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                    Komposisi Bahan Mentah Yang Digunakan:
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Bahan-bahan mentah di bawah akan otomatis dipotong saat dapur memproses 1 batch olahan ini
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSubRecipeModal(p => ({
                      ...p,
                      items: [...p.items, { ingredient_id: '', qty: 1, unit: 'gram', waste_std: 0 }]
                    }));
                  }}
                >
                  <Plus size={13} /> Tambah Bahan Mentah
                </button>
              </div>

              <div className="table-wrap mb-3">
                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 220 }}>Bahan Mentah</th>
                      <th style={{ width: 110 }}>Kuantitas</th>
                      <th style={{ width: 110 }}>Satuan</th>
                      <th style={{ width: 90 }}>Waste %</th>
                      <th style={{ width: 40 }} className="center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subRecipeModal.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <select
                            className="form-control"
                            style={{ fontSize: 12, padding: '5px 8px' }}
                            value={item.ingredient_id}
                            onChange={e => {
                              const chosenId = Number(e.target.value);
                              const ingObj = rawIngredients.find(i => i.id === chosenId);
                              setSubRecipeModal(p => {
                                const newItems = [...p.items];
                                newItems[idx] = {
                                  ...newItems[idx],
                                  ingredient_id: chosenId,
                                  unit: ingObj?.unit_pakai || newItems[idx].unit,
                                };
                                return { ...p, items: newItems };
                              });
                            }}
                          >
                            <option value="">-- Pilih Bahan Mentah --</option>
                            {rawIngredients.map(ing => (
                              <option key={ing.id} value={ing.id}>
                                {ing.code ? `[${ing.code}] ` : ''}{ing.name} ({rupiah(ing.harga / (ing.konversi || 1))}/{ing.unit_pakai})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="any"
                            min="0.0001"
                            className="form-control mono right"
                            style={{ padding: '5px 8px', fontSize: 12 }}
                            value={item.qty}
                            onChange={e => {
                              const val = e.target.value;
                              setSubRecipeModal(p => {
                                const newItems = [...p.items];
                                newItems[idx] = { ...newItems[idx], qty: val };
                                return { ...p, items: newItems };
                              });
                            }}
                          />
                        </td>
                        <td>
                          <UnitSelect
                            value={item.unit}
                            options={SATUAN_PAKAI_OPTIONS}
                            style={{ padding: '5px 8px', fontSize: 12 }}
                            onChange={val => {
                              setSubRecipeModal(p => {
                                const newItems = [...p.items];
                                newItems[idx] = { ...newItems[idx], unit: val };
                                return { ...p, items: newItems };
                              });
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max="100"
                            className="form-control mono right"
                            style={{ padding: '5px 8px', fontSize: 12 }}
                            value={item.waste_std}
                            onChange={e => {
                              const val = e.target.value;
                              setSubRecipeModal(p => {
                                const newItems = [...p.items];
                                newItems[idx] = { ...newItems[idx], waste_std: val };
                                return { ...p, items: newItems };
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

              {/* Kalkulasi HPP Otomatis Banner */}
              <div style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.25) 0%, rgba(17, 24, 39, 0.6) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Calculator size={20} style={{ color: '#60a5fa' }} />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Kalkulasi Biaya Bahan Mentah (1 Batch)</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
                      {rupiah(estimatedCostData.totalCost)}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Estimasi HPP per {subRecipeModal.output_unit || 'satuan'}:
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--accent-bright)' }}>
                    {rupiah(estimatedCostData.costPerUnit)} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>/ {subRecipeModal.output_unit || 'unit'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSubRecipeModal(null)}
                disabled={savingRecipe}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveSubRecipe}
                disabled={savingRecipe}
              >
                {savingRecipe ? 'Menyimpan...' : (
                  <>
                    <Check size={14} />
                    {subRecipeModal.ingredient_id ? 'Simpan Resep' : 'Buat Bahan Olahan & Resep'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
