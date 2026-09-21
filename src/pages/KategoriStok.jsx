import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Layers, Package, Plus, Edit2, Trash2, CheckCircle2, Search,
  Coffee, ChefHat, Sparkles, ShoppingBag, ArrowRight, UtensilsCrossed,
  Tag, Box, Info, Check, RefreshCw, X, AlertCircle, ShieldCheck
} from 'lucide-react';
import api from '../api/client';
import { rupiah, num, LoadingState, PageHeader } from '../components/ui';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';

const PRESET_ICONS = [
  { id: 'Package', label: 'Perlengkapan / Box', icon: Package },
  { id: 'Layers', label: 'Bahan Baku (Layers)', icon: Layers },
  { id: 'ChefHat', label: 'Olahan / Dapur', icon: ChefHat },
  { id: 'Coffee', label: 'Minuman / Dairy', icon: Coffee },
  { id: 'Sparkles', label: 'Bumbu / Sirup', icon: Sparkles },
  { id: 'ShoppingBag', label: 'Packaging / Tas', icon: ShoppingBag },
  { id: 'Tag', label: 'Label / Tag', icon: Tag },
  { id: 'Box', label: 'Stok Kontainer', icon: Box },
];

const PRESET_COLORS = [
  { hex: '#00B14F', label: 'Grab / Hijau Segar' },
  { hex: '#3B82F6', label: 'Biru Modern' },
  { hex: '#8B5CF6', label: 'Ungu Elegan' },
  { hex: '#F59E0B', label: 'Amber / Hangat' },
  { hex: '#EC4899', label: 'Pink Ceria' },
  { hex: '#06B6D4', label: 'Cyan / Teal' },
  { hex: '#10B981', label: 'Emerald' },
  { hex: '#6366F1', label: 'Indigo' },
];

const QUICK_SUPPLIES = [
  {
    code: 'CUP-16OZ',
    name: 'Cup Plastik 16oz',
    category: 'Perlengkapan',
    type: 'RAW',
    unit_beli: 'Slop',
    unit_pakai: 'pcs',
    konversi: 50,
    harga: 25000,
    stok_awal: 500,
    stok_min: 100,
  },
  {
    code: 'CUP-12OZ',
    name: 'Cup Plastik 12oz',
    category: 'Perlengkapan',
    type: 'RAW',
    unit_beli: 'Slop',
    unit_pakai: 'pcs',
    konversi: 50,
    harga: 22000,
    stok_awal: 500,
    stok_min: 100,
  },
  {
    code: 'CUP-22OZ',
    name: 'Cup Plastik 22oz',
    category: 'Perlengkapan',
    type: 'RAW',
    unit_beli: 'Slop',
    unit_pakai: 'pcs',
    konversi: 50,
    harga: 30000,
    stok_awal: 300,
    stok_min: 60,
  },
  {
    code: 'PIPET',
    name: 'Pipet / Sedotan Steril',
    category: 'Perlengkapan',
    type: 'RAW',
    unit_beli: 'Pack',
    unit_pakai: 'pcs',
    konversi: 100,
    harga: 15000,
    stok_awal: 500,
    stok_min: 100,
  },
  {
    code: 'TISSUE',
    name: 'Tissue Meja / Bar',
    category: 'Perlengkapan',
    type: 'RAW',
    unit_beli: 'Pack',
    unit_pakai: 'lembar',
    konversi: 200,
    harga: 12000,
    stok_awal: 1000,
    stok_min: 200,
  },
  {
    code: 'PAPER-BAG',
    name: 'Paper Bag / Takeaway Bag',
    category: 'Perlengkapan',
    type: 'RAW',
    unit_beli: 'Pack',
    unit_pakai: 'pcs',
    konversi: 50,
    harga: 35000,
    stok_awal: 200,
    stok_min: 50,
  },
];

function getCategoryIconComponent(iconName) {
  const found = PRESET_ICONS.find(i => i.id === iconName);
  return found ? found.icon : Package;
}

export default function KategoriStok() {
  const navigate = useNavigate();
  const { activeOutletId } = useOutlet();

  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Category Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'INGREDIENT',
    color: '#00B14F',
    icon: 'Package',
    sort_order: 1,
  });
  const [submitting, setSubmitting] = useState(false);

  // Quick Supplies Modal State
  const [suppliesModalOpen, setSuppliesModalOpen] = useState(false);
  const [supplyForm, setSupplyForm] = useState(QUICK_SUPPLIES[0]);
  const [savingSupply, setSavingSupply] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [activeOutletId]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [catRes, ingRes] = await Promise.all([
        api.get('/categories?type=INGREDIENT'),
        api.get('/ingredients', { params: { outlet_id: activeOutletId !== 'ALL' ? activeOutletId : undefined } }),
      ]);
      setCategories(catRes.data || []);
      setIngredients(ingRes.data || []);

      // Auto-select Perlengkapan if available, otherwise first category
      if (!selectedCategory && (catRes.data || []).length > 0) {
        const perlengkapan = catRes.data.find(c => c.name.toLowerCase().includes('perlengkapan'));
        setSelectedCategory(perlengkapan ? perlengkapan.id : catRes.data[0].id);
      }
    } catch {
      toast.error('Gagal memuat kategori stok & bahan');
    } finally {
      setLoading(false);
    }
  }

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter(c => c.name.toLowerCase().includes(q));
  }, [categories, search]);

  // Active Category Object
  const currentCategoryObj = useMemo(() => {
    return categories.find(c => c.id === selectedCategory) || categories[0] || null;
  }, [categories, selectedCategory]);

  // Ingredients under the active selected category
  const activeIngredients = useMemo(() => {
    if (!currentCategoryObj) return [];
    return ingredients.filter(i => {
      if (i.category_id && i.category_id === currentCategoryObj.id) return true;
      return (i.category || '').trim().toLowerCase() === currentCategoryObj.name.trim().toLowerCase();
    });
  }, [ingredients, currentCategoryObj]);

  // Stats calculation
  const totalCategoriesCount = categories.length;
  const totalIngredientsCount = ingredients.length;
  const perlengkapanCount = useMemo(() => {
    return ingredients.filter(i => (i.category || '').toLowerCase().includes('perlengkapan')).length;
  }, [ingredients]);

  // Open modal to add category
  function handleOpenAddModal() {
    setEditingCategory(null);
    setFormData({
      name: '',
      type: 'INGREDIENT',
      color: '#00B14F',
      icon: 'Package',
      sort_order: categories.length + 1,
    });
    setModalOpen(true);
  }

  // Open modal to edit category
  function handleOpenEditModal(cat, e) {
    e?.stopPropagation();
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      type: cat.type || 'INGREDIENT',
      color: cat.color || '#00B14F',
      icon: cat.icon || 'Package',
      sort_order: cat.sort_order ?? 1,
    });
    setModalOpen(true);
  }

  // Save Category
  async function handleSaveCategory(e) {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Nama kategori wajib diisi!');
      return;
    }

    setSubmitting(true);
    try {
      if (editingCategory) {
        const { data } = await api.put(`/categories/${editingCategory.id}`, formData);
        toast.success(`Kategori "${data.name}" berhasil diperbarui!`);
      } else {
        const { data } = await api.post('/categories', formData);
        toast.success(`Kategori "${data.name}" berhasil ditambahkan!`);
        setSelectedCategory(data.id);
      }
      setModalOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan kategori');
    } finally {
      setSubmitting(false);
    }
  }

  // Delete Category
  async function handleDeleteCategory(cat, e) {
    e?.stopPropagation();
    if ((cat.ingredients_count || 0) > 0) {
      toast.error(`Kategori "${cat.name}" masih memiliki ${cat.ingredients_count} item bahan/perlengkapan aktif!`);
      return;
    }

    if (!window.confirm(`Hapus kategori "${cat.name}"?`)) return;

    try {
      await api.delete(`/categories/${cat.id}`);
      toast.success(`Kategori "${cat.name}" berhasil dihapus.`);
      if (selectedCategory === cat.id) {
        setSelectedCategory(null);
      }
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus kategori');
    }
  }

  // Quick Supply submit
  async function handleSaveSupply(e) {
    e.preventDefault();
    if (!supplyForm.name || !supplyForm.code) {
      toast.error('Kode dan nama perlengkapan wajib diisi!');
      return;
    }

    setSavingSupply(true);
    try {
      const payload = {
        ...supplyForm,
        category: 'Perlengkapan',
        category_id: currentCategoryObj?.id || 1,
        harga: Number(supplyForm.harga || 0),
        konversi: Number(supplyForm.konversi || 1),
        stok_awal: Number(supplyForm.stok_awal || 0),
        stok_min: Number(supplyForm.stok_min || 0),
      };

      const { data } = await api.post('/ingredients', payload);
      toast.success(`Perlengkapan "${data.name}" berhasil ditambahkan & siap masuk ke resep!`);
      setSuppliesModalOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menambahkan perlengkapan');
    } finally {
      setSavingSupply(false);
    }
  }

  return (
    <div className="page-container" style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 60 }}>
      {/* Top Header */}
      <PageHeader
        title="Kategori Stok & Perlengkapan"
        subtitle="Kelola klasifikasi stok bahan mentah, olahan, dan perlengkapan (cup, pipet, tissue) yang otomatis terintegrasi ke resep menu & kalkulasi HPP."
        breadcrumb={[
          { label: 'Master Bisnis' },
          { label: 'Kategori Stok' }
        ]}
      />

      {/* Hero Banner: Recipe Integration Notice */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 177, 79, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)',
        border: '1px solid rgba(0, 177, 79, 0.28)',
        borderRadius: 14,
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #00B14F 0%, #00873c 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(0, 177, 79, 0.3)',
            flexShrink: 0
          }}>
            <Package size={22} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Perlengkapan (Cup, Pipet, Tissue) Otomatis Terhubung ke Resep Menu</span>
              <span className="badge badge-success" style={{ fontSize: 10.5, background: '#00B14F', color: '#fff' }}>
                ✓ AKTIF DI RESEP
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, maxWidth: 760 }}>
              Semua item perlengkapan yang didaftarkan di sini otomatis muncul di modul <strong>Master Menu & Resep</strong>.
              Saat kasir menyelesaikan transaksi penjualan, stok cup, sedotan/pipet, atau tissue akan otomatis terpotong sesuai takaran resep menu!
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSuppliesModalOpen(true)}
            style={{ fontWeight: 700, borderColor: 'rgba(0, 177, 79, 0.4)', color: '#10d97a' }}
          >
            <Plus size={14} /> Tambah Perlengkapan Cepat
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/menu')}
            style={{ fontWeight: 700 }}
          >
            <UtensilsCrossed size={14} /> Buka Resep Menu <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Key Metric Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div className="card" style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Kategori Stok
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
            <span className="mono" style={{ fontSize: 24, fontWeight: 800, color: '#ffffff' }}>
              {totalCategoriesCount}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Klasifikasi</span>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Item Stok & Bahan
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
            <span className="mono" style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8' }}>
              {totalIngredientsCount}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Item Terdaftar</span>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', background: 'rgba(0, 177, 79, 0.08)', border: '1px solid rgba(0, 177, 79, 0.25)', borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: '#10d97a', fontWeight: 700, textTransform: 'uppercase' }}>
            Item Perlengkapan (Cup/Pipet/Tissue)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
            <span className="mono" style={{ fontSize: 24, fontWeight: 800, color: '#00B14F' }}>
              {perlengkapanCount}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Item Aktif</span>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Status Resep Menu
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <ShieldCheck size={18} color="#10b981" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>
              100% Siap Digunakan
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Categories Grid + Detail Items View */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left Column: Categories List & Action */}
        <div className="card" style={{ padding: 18, borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', margin: 0 }}>Daftar Kategori</h3>
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Pilih kategori untuk melihat atau menambah item bahan/perlengkapan.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleOpenAddModal}
              style={{ fontWeight: 700, gap: 4 }}
            >
              <Plus size={14} /> Kategori Baru
            </button>
          </div>

          {/* Search Category */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Cari nama kategori..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32, fontSize: 12, height: 34, borderRadius: 8 }}
            />
          </div>

          {/* Category Cards List */}
          {loading ? (
            <div style={{ padding: '30px 0' }}><LoadingState /></div>
          ) : filteredCategories.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              Tidak ada kategori yang sesuai.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredCategories.map(cat => {
                const isSelected = selectedCategory === cat.id;
                const IconComponent = getCategoryIconComponent(cat.icon);
                const accentColor = cat.color || '#3b82f6';
                const isPerlengkapan = cat.name.toLowerCase().includes('perlengkapan');

                return (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: isSelected ? accentColor : 'var(--border)',
                      background: isSelected
                        ? `linear-gradient(135deg, ${accentColor}18 0%, rgba(255,255,255,0.02) 100%)`
                        : 'rgba(255, 255, 255, 0.02)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? `0 4px 12px ${accentColor}25` : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: `${accentColor}20`,
                        border: `1px solid ${accentColor}40`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: accentColor,
                        flexShrink: 0
                      }}>
                        <IconComponent size={18} />
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#ffffff' }}>
                            {cat.name}
                          </span>
                          {isPerlengkapan && (
                            <span style={{
                              fontSize: 9.5,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: 'rgba(0, 177, 79, 0.18)',
                              border: '1px solid rgba(0, 177, 79, 0.35)',
                              color: '#10d97a',
                              fontWeight: 800
                            }}>
                              UTAMA
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                          <span className="mono" style={{ color: accentColor, fontWeight: 700 }}>
                            {cat.ingredients_count || 0}
                          </span> item stok terhubung
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={(e) => handleOpenEditModal(cat, e)}
                        title="Edit Kategori"
                        style={{ width: 28, height: 28, padding: 0 }}
                      >
                        <Edit2 size={13} style={{ color: 'var(--text-secondary)' }} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={(e) => handleDeleteCategory(cat, e)}
                        title={(cat.ingredients_count || 0) > 0 ? "Kategori tidak dapat dihapus karena memiliki item stok" : "Hapus Kategori"}
                        disabled={(cat.ingredients_count || 0) > 0}
                        style={{ width: 28, height: 28, padding: 0, opacity: (cat.ingredients_count || 0) > 0 ? 0.3 : 1 }}
                      >
                        <Trash2 size={13} style={{ color: '#f87171' }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Items under selected category */}
        <div className="card" style={{ padding: 18, borderRadius: 14, border: '1px solid var(--border)' }}>
          {currentCategoryObj ? (
            <div>
              {/* Category Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 14,
                borderBottom: '1px solid var(--border)',
                marginBottom: 16,
                flexWrap: 'wrap',
                gap: 10
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: `${currentCategoryObj.color || '#00B14F'}20`,
                    border: `1px solid ${currentCategoryObj.color || '#00B14F'}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: currentCategoryObj.color || '#00B14F'
                  }}>
                    {(() => {
                      const IconC = getCategoryIconComponent(currentCategoryObj.icon);
                      return <IconC size={20} />;
                    })()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                        {currentCategoryObj.name}
                      </h2>
                      <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                        {activeIngredients.length} item stok
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Item dalam kategori ini otomatis tersedia untuk dipilih dalam <strong>Resep Menu</strong>.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {currentCategoryObj.name.toLowerCase().includes('perlengkapan') && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSuppliesModalOpen(true)}
                      style={{ fontWeight: 700, borderColor: 'rgba(0, 177, 79, 0.4)', color: '#10d97a' }}
                    >
                      <Plus size={14} /> Tambah Cup/Pipet/Tissue
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => navigate('/bahan')}
                    style={{ fontWeight: 700 }}
                  >
                    <Package size={14} /> Buka Master Bahan
                  </button>
                </div>
              </div>

              {/* Items Table */}
              {activeIngredients.length === 0 ? (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  background: 'rgba(0,0,0,0.15)',
                  borderRadius: 12,
                  border: '1px dashed var(--border)'
                }}>
                  <Package size={36} style={{ margin: '0 auto 10px', color: 'var(--text-muted)' }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
                    Belum Ada Item di Kategori "{currentCategoryObj.name}"
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, maxWidth: 460, margin: '4px auto 14px' }}>
                    {currentCategoryObj.name.toLowerCase().includes('perlengkapan')
                      ? 'Daftarkan perlengkapan seperti Cup Plastik, Sedotan/Pipet, atau Tissue agar otomatis terhitung saat peracikan resep menu.'
                      : 'Tambahkan bahan atau stok yang tergolong dalam kategori ini dari Master Bahan.'}
                  </div>
                  {currentCategoryObj.name.toLowerCase().includes('perlengkapan') ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setSuppliesModalOpen(true)}
                      style={{ fontWeight: 700 }}
                    >
                      <Plus size={14} /> Daftarkan Cup, Pipet & Tissue Sekarang
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate('/bahan')}
                      style={{ fontWeight: 700 }}
                    >
                      <Plus size={14} /> Tambah Bahan Baru
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-responsive" style={{ maxHeight: 520, overflowY: 'auto' }}>
                  <table className="table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Kode</th>
                        <th>Nama Item</th>
                        <th>Satuan Beli / Pakai</th>
                        <th className="right">Harga Beli</th>
                        <th className="right">Biaya / Takaran</th>
                        <th className="right">Stok Fisik</th>
                        <th className="center">Status Resep</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeIngredients.map(ing => {
                        const costPerPakai = (Number(ing.harga) || 0) / (Number(ing.konversi) || 1);
                        return (
                          <tr key={ing.id}>
                            <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-bright)' }}>
                              {ing.code}
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: '#ffffff' }}>{ing.name}</div>
                              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                                {ing.type === 'SEMI_FINISHED' ? '🟣 Olahan (Batch Prep)' : '🟢 Bahan Mentah / Perlengkapan'}
                              </div>
                            </td>
                            <td>
                              <span className="mono" style={{ fontWeight: 600 }}>1 {ing.unit_beli}</span>
                              <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>=</span>
                              <span className="mono" style={{ color: 'var(--text-secondary)' }}>{ing.konversi} {ing.unit_pakai}</span>
                            </td>
                            <td className="mono right" style={{ fontWeight: 600 }}>
                              {rupiah(ing.harga)}
                            </td>
                            <td className="mono right" style={{ color: '#10d97a', fontWeight: 700 }}>
                              {rupiah(costPerPakai)} / {ing.unit_pakai}
                            </td>
                            <td className="mono right" style={{ fontWeight: 800, color: (ing.current_stock ?? 0) <= (ing.current_stok_min ?? 0) ? '#f87171' : '#ffffff' }}>
                              {num(ing.current_stock ?? 0)} {ing.unit_pakai}
                            </td>
                            <td className="center">
                              <span className="badge badge-success" style={{ fontSize: 10, fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                ✓ Masuk Resep
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Pilih salah satu kategori di sebelah kiri.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Tambah / Edit Kategori */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingCategory ? 'Edit Kategori Stok' : 'Tambah Kategori Stok Baru'}
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nama Kategori Stok *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Perlengkapan, Biji Kopi, Sirup, Cup & Packaging"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Pilih Ikon</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {PRESET_ICONS.map(item => {
                      const IconComp = item.icon;
                      const active = formData.icon === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, icon: item.id })}
                          style={{
                            padding: '10px 6px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                            border: '1px solid',
                            borderColor: active ? formData.color : 'var(--border)',
                            background: active ? `${formData.color}20` : 'rgba(255,255,255,0.03)',
                            color: active ? '#ffffff' : 'var(--text-secondary)',
                            fontSize: 10.5,
                            fontWeight: active ? 700 : 500,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <IconComp size={18} color={active ? formData.color : 'currentColor'} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 70 }}>
                            {item.id}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Warna Aksen Kategori</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {PRESET_COLORS.map(c => {
                      const selected = formData.color === c.hex;
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setFormData({ ...formData, color: c.hex })}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: c.hex,
                            border: selected ? '3px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                            boxShadow: selected ? `0 0 10px ${c.hex}` : 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                          title={c.label}
                        >
                          {selected && <Check size={14} color="#ffffff" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Urutan Tampil (Sort Order)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.sort_order}
                    onChange={e => setFormData({ ...formData, sort_order: Number(e.target.value) })}
                    min="1"
                    style={{ width: 100 }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ fontWeight: 700 }}
                >
                  {submitting ? 'Menyimpan...' : (editingCategory ? 'Simpan Perubahan' : 'Tambah Kategori')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tambah Perlengkapan Cepat (Cup / Pipet / Tissue) */}
      {suppliesModalOpen && (
        <div className="modal-backdrop" onClick={() => setSuppliesModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Daftarkan Perlengkapan Baru</h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Item perlengkapan otomatis masuk ke kategori <strong>Perlengkapan</strong> dan siap dipakai di Resep Menu.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setSuppliesModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSupply}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Preset Quick Select Buttons */}
                <div>
                  <label className="form-label" style={{ fontSize: 11 }}>Pilih Template Cepat</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {QUICK_SUPPLIES.map(tpl => {
                      const isActive = supplyForm.code === tpl.code;
                      return (
                        <button
                          key={tpl.code}
                          type="button"
                          onClick={() => setSupplyForm({ ...tpl })}
                          style={{
                            padding: '8px 8px',
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            textAlign: 'center',
                            border: '1px solid',
                            borderColor: isActive ? '#00B14F' : 'var(--border)',
                            background: isActive ? 'rgba(0, 177, 79, 0.15)' : 'rgba(255,255,255,0.03)',
                            color: isActive ? '#10d97a' : '#ffffff',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {tpl.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Kode Item *</label>
                    <input
                      type="text"
                      className="form-control mono"
                      value={supplyForm.code}
                      onChange={e => setSupplyForm({ ...supplyForm, code: e.target.value.toUpperCase() })}
                      required
                      placeholder="CUP-16OZ"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nama Perlengkapan *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={supplyForm.name}
                      onChange={e => setSupplyForm({ ...supplyForm, name: e.target.value })}
                      required
                      placeholder="Contoh: Cup Plastik 16oz"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Satuan Beli</label>
                    <input
                      type="text"
                      className="form-control"
                      value={supplyForm.unit_beli}
                      onChange={e => setSupplyForm({ ...supplyForm, unit_beli: e.target.value })}
                      placeholder="Slop / Pack / Dus"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Satuan Pakai</label>
                    <input
                      type="text"
                      className="form-control"
                      value={supplyForm.unit_pakai}
                      onChange={e => setSupplyForm({ ...supplyForm, unit_pakai: e.target.value })}
                      placeholder="pcs / lembar"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Isi per Beli (Konversi)</label>
                    <input
                      type="number"
                      className="form-control mono right"
                      value={supplyForm.konversi}
                      onChange={e => setSupplyForm({ ...supplyForm, konversi: Number(e.target.value) })}
                      required
                      min="1"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Harga Beli per {supplyForm.unit_beli || 'Satuan'}</label>
                    <input
                      type="number"
                      className="form-control mono right"
                      value={supplyForm.harga}
                      onChange={e => setSupplyForm({ ...supplyForm, harga: Number(e.target.value) })}
                      required
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stok Awal ({supplyForm.unit_pakai})</label>
                    <input
                      type="number"
                      className="form-control mono right"
                      value={supplyForm.stok_awal}
                      onChange={e => setSupplyForm({ ...supplyForm, stok_awal: Number(e.target.value) })}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stok Min ({supplyForm.unit_pakai})</label>
                    <input
                      type="number"
                      className="form-control mono right"
                      value={supplyForm.stok_min}
                      onChange={e => setSupplyForm({ ...supplyForm, stok_min: Number(e.target.value) })}
                      min="0"
                    />
                  </div>
                </div>

                {/* Live cost preview */}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(0, 177, 79, 0.1)',
                  border: '1px solid rgba(0, 177, 79, 0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Biaya HPP / Takaran Resep:</span>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: '#10d97a' }}>
                    {rupiah(Number(supplyForm.harga || 0) / Math.max(Number(supplyForm.konversi || 1), 1))} / {supplyForm.unit_pakai || 'pcs'}
                  </span>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSuppliesModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingSupply}
                  style={{ fontWeight: 700 }}
                >
                  {savingSupply ? 'Menyimpan...' : 'Simpan Perlengkapan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
