import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { rupiah, num, LoadingState, PageHeader } from '../components/ui';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';

const PRESET_COLORS = [
  { hex: '#00B14F', label: 'Hijau (Perlengkapan)' },
  { hex: '#3B82F6', label: 'Biru (Bahan Baku)' },
  { hex: '#8B5CF6', label: 'Ungu (Bahan Olahan)' },
  { hex: '#F59E0B', label: 'Amber (Dairy / Minuman)' },
  { hex: '#EC4899', label: 'Pink (Bumbu / Sirup)' },
  { hex: '#06B6D4', label: 'Cyan (Packaging)' },
  { hex: '#64748B', label: 'Abu-abu (Umum)' },
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
    name: 'Paper Bag / Kantong',
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

      if (!selectedCategory && (catRes.data || []).length > 0) {
        const perlengkapan = catRes.data.find(c => c.name.toLowerCase().includes('perlengkapan'));
        setSelectedCategory(perlengkapan ? perlengkapan.id : catRes.data[0].id);
      }
    } catch {
      toast.error('Gagal memuat kategori stok');
    } finally {
      setLoading(false);
    }
  }

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter(c => c.name.toLowerCase().includes(q));
  }, [categories, search]);

  const currentCategoryObj = useMemo(() => {
    return categories.find(c => c.id === selectedCategory) || categories[0] || null;
  }, [categories, selectedCategory]);

  const activeIngredients = useMemo(() => {
    if (!currentCategoryObj) return [];
    return ingredients.filter(i => {
      if (i.category_id && i.category_id === currentCategoryObj.id) return true;
      return (i.category || '').trim().toLowerCase() === currentCategoryObj.name.trim().toLowerCase();
    });
  }, [ingredients, currentCategoryObj]);

  const totalCategoriesCount = categories.length;
  const totalIngredientsCount = ingredients.length;
  const perlengkapanCount = useMemo(() => {
    return ingredients.filter(i => (i.category || '').toLowerCase().includes('perlengkapan')).length;
  }, [ingredients]);

  function handleOpenAddModal() {
    setEditingCategory(null);
    setFormData({
      name: '',
      type: 'INGREDIENT',
      color: '#00B14F',
      sort_order: categories.length + 1,
    });
    setModalOpen(true);
  }

  function handleOpenEditModal(cat, e) {
    e?.stopPropagation();
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      type: cat.type || 'INGREDIENT',
      color: cat.color || '#00B14F',
      sort_order: cat.sort_order ?? 1,
    });
    setModalOpen(true);
  }

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
        toast.success(`Kategori "${data.name}" berhasil diperbarui`);
      } else {
        const { data } = await api.post('/categories', formData);
        toast.success(`Kategori "${data.name}" berhasil ditambahkan`);
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

  async function handleDeleteCategory(cat, e) {
    e?.stopPropagation();
    if ((cat.ingredients_count || 0) > 0) {
      toast.error(`Kategori "${cat.name}" masih memiliki ${cat.ingredients_count} item stok aktif.`);
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

  async function handleSaveSupply(e) {
    e.preventDefault();
    if (!supplyForm.name || !supplyForm.code) {
      toast.error('Kode dan nama item wajib diisi');
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
      toast.success(`Item "${data.name}" berhasil disimpan`);
      setSuppliesModalOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menambahkan perlengkapan');
    } finally {
      setSavingSupply(false);
    }
  }

  return (
    <div className="page-container" style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
      {/* Page Header */}
      <PageHeader
        title="Kategori Stok & Perlengkapan"
        subtitle="Kelola klasifikasi stok bahan dan perlengkapan (cup, pipet, tissue). Seluruh item dapat langsung digunakan pada Resep Menu."
        breadcrumb={[
          { label: 'Master Bisnis' },
          { label: 'Kategori Stok' }
        ]}
      />

      {/* Clear Text Notice Banner */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#ffffff' }}>
            Integrasi Resep Menu & Pengurangan Stok Otomatis
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Item dalam kategori Perlengkapan (cup, pipet/sedotan, tissue) otomatis dapat dipilih saat meracik resep di Master Menu. Stok akan otomatis terpotong saat pesanan diselesaikan di kasir.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSuppliesModalOpen(true)}
            style={{ fontWeight: 600 }}
          >
            + Tambah Perlengkapan Cepat
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/menu')}
            style={{ fontWeight: 600 }}
          >
            Buka Resep Menu
          </button>
        </div>
      </div>

      {/* Clean Metric Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
            Total Kategori Stok
          </div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
            {totalCategoriesCount} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>kategori</span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
            Total Item Stok & Bahan
          </div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
            {totalIngredientsCount} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>item</span>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
            Item Perlengkapan Terdaftar
          </div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: '#10d97a', marginTop: 4 }}>
            {perlengkapanCount} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>item (cup/pipet/tissue)</span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18, alignItems: 'start' }}>
        {/* Left Column: Categories List */}
        <div className="card" style={{ padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Kategori</span>
            <button
              type="button"
              className="btn btn-primary btn-xs"
              onClick={handleOpenAddModal}
              style={{ fontWeight: 600 }}
            >
              + Kategori
            </button>
          </div>

          {/* Search Category */}
          <input
            type="text"
            className="form-control"
            placeholder="Cari kategori..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontSize: 12, height: 32, marginBottom: 10, borderRadius: 6 }}
          />

          {/* Category List */}
          {loading ? (
            <div style={{ padding: '20px 0' }}><LoadingState /></div>
          ) : filteredCategories.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              Tidak ada kategori.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredCategories.map(cat => {
                const isSelected = selectedCategory === cat.id;
                const accentColor = cat.color || '#3b82f6';

                return (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: isSelected ? accentColor : 'var(--border)',
                      background: isSelected ? 'rgba(255,255,255,0.06)' : 'rgba(255, 255, 255, 0.01)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'border-color 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: accentColor,
                          flexShrink: 0
                        }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: '#ffffff' }}>
                          {cat.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {cat.ingredients_count || 0} item stok
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={(e) => handleOpenEditModal(cat, e)}
                        style={{ fontSize: 11, padding: '2px 6px', color: 'var(--text-secondary)' }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={(e) => handleDeleteCategory(cat, e)}
                        disabled={(cat.ingredients_count || 0) > 0}
                        style={{
                          fontSize: 11,
                          padding: '2px 6px',
                          color: (cat.ingredients_count || 0) > 0 ? 'var(--text-muted)' : '#f87171',
                          opacity: (cat.ingredients_count || 0) > 0 ? 0.35 : 1
                        }}
                        title={(cat.ingredients_count || 0) > 0 ? "Kategori tidak dapat dihapus karena memiliki item stok" : "Hapus Kategori"}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Items in selected category */}
        <div className="card" style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)' }}>
          {currentCategoryObj ? (
            <div>
              {/* Category Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 12,
                borderBottom: '1px solid var(--border)',
                marginBottom: 14,
                flexWrap: 'wrap',
                gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: currentCategoryObj.color || '#00B14F'
                    }}
                  />
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
                      {currentCategoryObj.name}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                      ({activeIngredients.length} item)
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {currentCategoryObj.name.toLowerCase().includes('perlengkapan') && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSuppliesModalOpen(true)}
                      style={{ fontWeight: 600 }}
                    >
                      + Tambah Cup / Pipet / Tissue
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => navigate('/bahan')}
                    style={{ fontWeight: 600 }}
                  >
                    Buka Master Bahan
                  </button>
                </div>
              </div>

              {/* Items Table */}
              {activeIngredients.length === 0 ? (
                <div style={{
                  padding: '36px 16px',
                  textAlign: 'center',
                  background: 'rgba(0,0,0,0.1)',
                  borderRadius: 8,
                  border: '1px dashed var(--border)'
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>
                    Belum ada item di kategori "{currentCategoryObj.name}"
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 14 }}>
                    {currentCategoryObj.name.toLowerCase().includes('perlengkapan')
                      ? 'Daftarkan cup, pipet/sedotan, atau tissue agar otomatis terhitung di resep menu.'
                      : 'Tambahkan bahan baku atau stok ke kategori ini melalui Master Bahan.'}
                  </div>
                  {currentCategoryObj.name.toLowerCase().includes('perlengkapan') ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setSuppliesModalOpen(true)}
                    >
                      + Tambah Cup, Pipet & Tissue
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate('/bahan')}
                    >
                      + Tambah Bahan
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
                        <th className="center">Resep</th>
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
                              <div style={{ fontWeight: 600, color: '#ffffff' }}>{ing.name}</div>
                              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                                {ing.type === 'SEMI_FINISHED' ? 'Bahan Olahan' : 'Bahan Mentah / Kemasan'}
                              </div>
                            </td>
                            <td>
                              <span className="mono">1 {ing.unit_beli}</span>
                              <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>=</span>
                              <span className="mono" style={{ color: 'var(--text-secondary)' }}>{ing.konversi} {ing.unit_pakai}</span>
                            </td>
                            <td className="mono right">
                              {rupiah(ing.harga)}
                            </td>
                            <td className="mono right" style={{ color: '#10d97a', fontWeight: 600 }}>
                              {rupiah(costPerPakai)} / {ing.unit_pakai}
                            </td>
                            <td className="mono right" style={{ fontWeight: 700, color: (ing.current_stock ?? 0) <= (ing.current_stok_min ?? 0) ? '#f87171' : '#ffffff' }}>
                              {num(ing.current_stock ?? 0)} {ing.unit_pakai}
                            </td>
                            <td className="center">
                              <span className="badge badge-neutral" style={{ fontSize: 10, fontWeight: 600 }}>
                                Aktif di Resep
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
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
              Pilih salah satu kategori di sebelah kiri.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Tambah / Edit Kategori */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingCategory ? 'Edit Kategori Stok' : 'Tambah Kategori Stok'}
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Nama Kategori *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Perlengkapan, Bahan Baku, Kemasan"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Warna Label Kategori</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {PRESET_COLORS.map(c => {
                      const selected = formData.color === c.hex;
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setFormData({ ...formData, color: c.hex })}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: c.hex,
                            border: selected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.15)',
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease'
                          }}
                          title={c.label}
                        />
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

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                  style={{ fontWeight: 600 }}
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tambah Perlengkapan Cepat */}
      {suppliesModalOpen && (
        <div className="modal-backdrop" onClick={() => setSuppliesModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Tambah Perlengkapan</h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Item otomatis masuk ke kategori Perlengkapan dan dapat dipilih pada Resep Menu.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setSuppliesModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSupply}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Template buttons */}
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
                            padding: '6px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'center',
                            border: '1px solid',
                            borderColor: isActive ? '#00B14F' : 'var(--border)',
                            background: isActive ? 'rgba(0, 177, 79, 0.15)' : 'rgba(255,255,255,0.02)',
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
                      placeholder="Slop / Pack"
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
                    <label className="form-label">Isi per Satuan Beli</label>
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
                    <label className="form-label">Harga Beli (Rp)</label>
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

                <div style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Biaya per Takaran Resep:</span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: '#10d97a' }}>
                    {rupiah(Number(supplyForm.harga || 0) / Math.max(Number(supplyForm.konversi || 1), 1))} / {supplyForm.unit_pakai || 'pcs'}
                  </span>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSuppliesModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={savingSupply}
                  style={{ fontWeight: 600 }}
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
