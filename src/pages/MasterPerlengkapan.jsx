import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Edit2, Check, X, Store, Trash2, Search,
  ExternalLink, ScrollText, UtensilsCrossed, AlertTriangle,
  PackageCheck, RefreshCw, ShoppingBag, Package, FileSpreadsheet
} from 'lucide-react';
import api from '../api/client';
import {
  rupiah, num, fmtQtyVal, LoadingState, PageHeader, AuditInfo,
  SATUAN_BELI_OPTIONS, SATUAN_PAKAI_OPTIONS,
  getSuggestedConversion, UnitSelect
} from '../components/ui';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import ImportMasterModal from '../components/ImportMasterModal';

const KATEGORI_PERLENGKAPAN_OPTIONS = [
  'Perlengkapan',
  'Cup & Gelas',
  'Sedotan / Pipet',
  'Tissue',
  'Tutup Cup / Sealer',
  'Kantong & Paperbag',
  'Kemasan & Box',
  'Sendok & Garpu',
  'Lainnya',
];

const PRESET_PERLENGKAPAN = [
  {
    code: 'CUP-16',
    name: 'Cup Dingin 16oz Sablon',
    category: 'Perlengkapan',
    unit_beli: 'Slop',
    unit_pakai: 'pcs',
    konversi: 50,
    harga: 25000,
    stok_min: 100,
  },
  {
    code: 'CUP-22',
    name: 'Cup Dingin 22oz Sablon',
    category: 'Perlengkapan',
    unit_beli: 'Slop',
    unit_pakai: 'pcs',
    konversi: 50,
    harga: 30000,
    stok_min: 100,
  },
  {
    code: 'PIPET-BOBA',
    name: 'Sedotan Boba Steril (Wrap)',
    category: 'Perlengkapan',
    unit_beli: 'Pack',
    unit_pakai: 'pcs',
    konversi: 100,
    harga: 15000,
    stok_min: 200,
  },
  {
    code: 'TISSUE-MEJA',
    name: 'Tissue Makan Meja (Lunch Paper)',
    category: 'Perlengkapan',
    unit_beli: 'Pack',
    unit_pakai: 'lembar',
    konversi: 250,
    harga: 12500,
    stok_min: 500,
  },
  {
    code: 'LID-SEALER',
    name: 'Roll Plastik Sealer Cup',
    category: 'Perlengkapan',
    unit_beli: 'Roll',
    unit_pakai: 'pcs',
    konversi: 1200,
    harga: 75000,
    stok_min: 300,
  },
];

const emptyForm = {
  code: '',
  name: '',
  category: 'Perlengkapan',
  type: 'RAW',
  unit_beli: 'Slop',
  unit_pakai: 'pcs',
  konversi: 50,
  harga: 0,
  stok_awal: 0,
  stok_min: 50,
  tolerance: 5,
  active: true,
};

function FormCell({ data, setData, field, type = 'text', style = {}, availableCategories = KATEGORI_PERLENGKAPAN_OPTIONS }) {
  if (field === 'category') {
    const rawList = availableCategories.includes(data.category) || !data.category
      ? availableCategories
      : [data.category, ...availableCategories];
    const seenCat = new Set();
    const categories = [];
    for (const c of rawList) {
      if (!c) continue;
      const key = String(c).trim().toLowerCase();
      if (!seenCat.has(key)) {
        seenCat.add(key);
        categories.push(c);
      }
    }
    return (
      <select
        className="form-control"
        style={{
          padding: '5px 8px',
          fontSize: 12,
          minWidth: 100,
          cursor: 'pointer',
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          borderColor: 'var(--border-strong)',
          ...style,
        }}
        value={data.category ?? 'Perlengkapan'}
        onChange={e => setData(p => ({ ...p, category: e.target.value }))}
      >
        {categories.map(cat => (
          <option key={cat} value={cat} style={{ background: '#11162d', color: '#ffffff' }}>
            {cat}
          </option>
        ))}
      </select>
    );
  }
  if (field === 'unit_beli') {
    const perlengkapanBeliOptions = ['Slop', 'Dus', 'Pack', 'Roll', 'Bungkus', 'Rim', 'Box', 'Pcs', 'Ikat'];
    return (
      <UnitSelect
        value={data.unit_beli}
        options={perlengkapanBeliOptions}
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
    const perlengkapanPakaiOptions = ['pcs', 'lembar', 'buah', 'roll', 'set'];
    return (
      <UnitSelect
        value={data.unit_pakai}
        options={perlengkapanPakaiOptions}
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

export default function MasterPerlengkapan() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubCat, setFilterSubCat] = useState('ALL');
  const [breakdownModal, setBreakdownModal] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const { activeOutletId, activeOutlet } = useOutlet();

  useEffect(() => {
    fetchPerlengkapan();
  }, [activeOutletId]);

  async function fetchPerlengkapan() {
    setLoading(true);
    try {
      const targetOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : undefined;
      const { data } = await api.get('/ingredients', { params: { outlet_id: targetOutlet } });

      // Saring item yang berkategori perlengkapan atau kata kunci cup, pipet, sedotan, tissue, kemasan, packaging
      const perlengkapanList = (data || []).filter(i => {
        const cat = (i.category || '').toLowerCase();
        const name = (i.name || '').toLowerCase();
        const code = (i.code || '').toUpperCase();
        return (
          cat.includes('perlengkapan') ||
          cat.includes('packaging') ||
          cat.includes('kemasan') ||
          cat.includes('cup') ||
          cat.includes('pipet') ||
          cat.includes('sedotan') ||
          cat.includes('tissue') ||
          cat.includes('sealer') ||
          cat.includes('kantong') ||
          cat.includes('paperbag') ||
          cat.includes('box') ||
          cat.includes('sendok') ||
          cat.includes('garpu') ||
          name.includes('cup') ||
          name.includes('pipet') ||
          name.includes('sedotan') ||
          name.includes('tissue') ||
          name.includes('sealer') ||
          name.includes('kantong') ||
          name.includes('paperbag') ||
          name.includes('box') ||
          name.includes('sendok') ||
          name.includes('garpu') ||
          code.startsWith('PLK-') ||
          code.startsWith('PKG-')
        );
      });

      setItems(perlengkapanList);
    } catch {
      toast.error('Gagal memuat data perlengkapan');
    } finally {
      setLoading(false);
    }
  }

  const displayedItems = useMemo(() => {
    return items.filter(it => {
      if (filterSubCat === 'LOW_STOCK') {
        const isLow = Number(it.current_stock ?? 0) <= Number(it.current_stok_min ?? it.stok_min ?? 0);
        if (!isLow) return false;
      } else if (filterSubCat !== 'ALL') {
        const cat = (it.category || '').toLowerCase();
        const name = (it.name || '').toLowerCase();
        const sub = filterSubCat.toLowerCase();
        if (!cat.includes(sub) && !name.includes(sub)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (it.name || '').toLowerCase().includes(q);
        const matchCode = (it.code || '').toLowerCase().includes(q);
        const matchCat = (it.category || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCat) return false;
      }

      return true;
    });
  }, [items, filterSubCat, searchQuery]);

  // Statistik KPI
  const stats = useMemo(() => {
    const totalCount = items.length;
    const totalNilai = items.reduce((acc, it) => {
      const hppPakai = (Number(it.harga) || 0) / Math.max(Number(it.konversi) || 1, 1);
      const stock = Math.max(Number(it.current_stock) || 0, 0);
      return acc + (stock * hppPakai);
    }, 0);
    const lowStockCount = items.filter(it => Number(it.current_stock ?? 0) <= Number(it.current_stok_min ?? it.stok_min ?? 0)).length;
    return { totalCount, totalNilai, lowStockCount };
  }, [items]);

  function startEdit(item) {
    setEditing(item.id);
    setEditData({ ...item });
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const payload = {
        ...editData,
        type: 'RAW',
        category: editData.category || 'Perlengkapan',
        harga: Number(editData.harga || 0),
        konversi: Number(editData.konversi || 1),
        stok_min: Number(editData.stok_min || 0),
        tolerance: Number(editData.tolerance || 0),
      };
      const { data } = await api.put(`/ingredients/${editing}`, payload);
      setItems(prev => prev.map(i => i.id === editing ? data : i));
      setEditing(null);
      toast.success('Data perlengkapan diperbarui');
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(m => toast.error(m));
      else toast.error('Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  }

  async function saveNew() {
    if (!addForm.code.trim() || !addForm.name.trim()) {
      toast.error('Kode dan Nama perlengkapan wajib diisi!');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...addForm,
        type: 'RAW',
        category: addForm.category || 'Perlengkapan',
        harga: Number(addForm.harga || 0),
        konversi: Number(addForm.konversi || 1),
        stok_min: Number(addForm.stok_min || 0),
        tolerance: Number(addForm.tolerance || 0),
      };
      const { data } = await api.post('/ingredients', payload);
      setItems(prev => [...prev, data]);
      setShowAdd(false);
      setAddForm(emptyForm);
      toast.success(`Perlengkapan "${data.name}" berhasil ditambahkan!`);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(m => toast.error(m));
      else toast.error(err.response?.data?.message || 'Gagal menambah perlengkapan');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Hapus perlengkapan "${item.name}" (${item.code})? Data stok terkait akan ikut terhapus.`)) return;
    try {
      await api.delete(`/ingredients/${item.id}`);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success(`Perlengkapan "${item.name}" dihapus`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus perlengkapan');
    }
  }

  function applyPreset(preset) {
    setAddForm({
      ...emptyForm,
      ...preset,
    });
    setShowAdd(true);
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="Master Perlengkapan & Packaging"
        subtitle="Kelola stok perlengkapan operasional cafe/resto (cup, sedotan, pipet, tissue, tutup cup, kantong plastik). Seluruh item otomatis terintegrasi dengan Kartu Stok dan Gramasi Resep Menu."
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowImportModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}
              title="Import data perlengkapan dari file Excel"
            >
              <FileSpreadsheet size={14} /> Import Excel
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/bahan')}
              title="Buka Master Resep & HPP Bahan"
            >
              <Package size={14} /> Master Bahan
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/kartu-stok')}
              title="Buka Kartu Stok Gudang"
            >
              <ScrollText size={14} /> Kartu Stok
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/menu')}
              title="Gunakan perlengkapan pada resep menu"
            >
              <UtensilsCrossed size={14} /> Resep Menu
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setShowAdd(true);
                setAddForm(emptyForm);
              }}
            >
              <Plus size={15} /> Tambah Perlengkapan
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="stat-cards mb-4">
        <div className="stat-card">
          <div className="stat-label">Total Perlengkapan Terdata</div>
          <div className="stat-value">{stats.totalCount} <span style={{ fontSize: 13, fontWeight: 500 }}>Item</span></div>
          <div className="stat-sub">Cup, sedotan, tissue, packaging</div>
        </div>

        <div className="stat-card ok">
          <div className="stat-label">Estimasi Nilai Stok Perlengkapan</div>
          <div className="stat-value ok">{rupiah(stats.totalNilai)}</div>
          <div className="stat-sub">Berdasarkan stok fisik di cabang aktif</div>
        </div>

        <div className={`stat-card ${stats.lowStockCount > 0 ? 'danger' : 'ok'}`}>
          <div className="stat-label">Perlengkapan Menipis (Kritis)</div>
          <div className={`stat-value ${stats.lowStockCount > 0 ? 'danger' : 'ok'}`}>
            {stats.lowStockCount} <span style={{ fontSize: 13, fontWeight: 500 }}>Item</span>
          </div>
          <div className="stat-sub">
            {stats.lowStockCount > 0 ? 'Perlu dilakukan PO / restock segera' : 'Seluruh stok di atas batas minimum'}
          </div>
        </div>
      </div>

      {/* Preset Quick Add Bar */}
      <div className="card mb-4" style={{ padding: '12px 18px', background: 'rgba(99, 102, 241, 0.05)', borderColor: 'rgba(99, 102, 241, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 12.5, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShoppingBag size={15} style={{ color: 'var(--accent-bright)' }} />
            <span><strong>Template Cepat:</strong> Daftarkan perlengkapan umum cafe dengan 1 klik:</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRESET_PERLENGKAPAN.map(p => (
              <button
                key={p.code}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => applyPreset(p)}
                style={{ fontSize: 11.5, padding: '4px 9px' }}
              >
                + {p.name.split(' ')[0]} {p.name.split(' ')[1] || ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Integration Info Banner */}
      <div className="card mb-4" style={{ padding: '12px 18px', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PackageCheck size={18} style={{ color: '#10b981' }} />
            <div style={{ fontSize: 12.5, color: '#e2e8f0' }}>
              <strong>Otomatis Terhubung ke Kartu Stok & POS:</strong> Setiap item perlengkapan di bawah ini dapat langsung dipilih saat meracik resep di <strong>Master Menu</strong>. Saat kasir membuat nota di POS, stok cup/sedotan/tissue akan berkurang otomatis sesuai gramasi pemakaian.
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/menu')}
            style={{ fontSize: 12, color: '#34d399', whiteSpace: 'nowrap' }}
          >
            Buka Master Menu & Resep <ExternalLink size={12} style={{ marginLeft: 4 }} />
          </button>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `Semua Perlengkapan (${items.length})` },
            { id: 'cup', label: 'Cup & Gelas' },
            { id: 'sedotan', label: 'Sedotan / Pipet' },
            { id: 'tissue', label: 'Tissue' },
            { id: 'sealer', label: 'Tutup / Sealer' },
            { id: 'LOW_STOCK', label: `Stok Menipis (${items.filter(i => Number(i.current_stock ?? 0) <= Number(i.current_stok_min ?? i.stok_min ?? 0)).length})` },
          ].map(tab => (
            <button
              key={tab.id}
              className={`btn btn-sm ${filterSubCat === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterSubCat(tab.id)}
              style={{
                fontSize: 12,
                ...(tab.id === 'LOW_STOCK' && filterSubCat === 'LOW_STOCK' ? { background: '#f43f5e', borderColor: '#f43f5e', color: '#ffffff' } : {}),
                ...(tab.id === 'LOW_STOCK' && filterSubCat !== 'LOW_STOCK' ? { color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.4)' } : {})
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: 260 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Cari perlengkapan / kode..."
            style={{ paddingLeft: 30, fontSize: 12.5, height: 34 }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 90 }}>Kode</th>
              <th>Nama Perlengkapan</th>
              <th style={{ minWidth: 120 }}>Kategori</th>
              <th style={{ minWidth: 90 }}>Satuan Beli</th>
              <th style={{ minWidth: 90 }}>Satuan Pakai</th>
              <th style={{ minWidth: 120 }}>Konversi Masuk</th>
              <th className="right" style={{ minWidth: 120 }}>Harga Beli (Bon)</th>
              <th className="right" style={{ minWidth: 120 }}>Biaya Satuan Pakai</th>
              <th className="right" style={{ minWidth: 120 }}>Stok Cabang Ini</th>
              <th className="right" style={{ width: 85 }}>Stok Min</th>
              <th className="right" style={{ width: 70 }}>Toleransi</th>
              <th style={{ minWidth: 150 }}>Riwayat Audit</th>
              <th style={{ width: 110 }} className="center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {/* Inline Add Row */}
            {showAdd && (
              <tr style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--accent-bright)' }}>
                <td>
                  <FormCell data={addForm} setData={setAddForm} field="code" style={{ width: 85 }} />
                </td>
                <td>
                  <FormCell data={addForm} setData={setAddForm} field="name" />
                </td>
                <td>
                  <FormCell data={addForm} setData={setAddForm} field="category" style={{ width: 120 }} />
                </td>
                <td>
                  <FormCell data={addForm} setData={setAddForm} field="unit_beli" style={{ width: 85 }} />
                </td>
                <td>
                  <FormCell data={addForm} setData={setAddForm} field="unit_pakai" style={{ width: 85 }} />
                </td>
                <td>
                  <FormCell data={addForm} setData={setAddForm} field="konversi" type="number" style={{ width: 75 }} />
                </td>
                <td>
                  <FormCell data={addForm} setData={setAddForm} field="harga" type="number" style={{ width: 95 }} />
                </td>
                <td className="mono right">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-bright)' }}>
                      {rupiah(addForm.konversi > 0 ? (addForm.harga / addForm.konversi) : addForm.harga)}
                    </span>
                    <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>/{addForm.unit_pakai}</span>
                  </div>
                </td>
                <td className="mono right text-muted">—</td>
                <td>
                  <FormCell data={addForm} setData={setAddForm} field="stok_min" type="number" style={{ width: 75 }} />
                </td>
                <td>
                  <FormCell data={addForm} setData={setAddForm} field="tolerance" type="number" style={{ width: 55 }} />
                </td>
                <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Item Baru</span></td>
                <td className="center">
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <button className="btn btn-primary btn-sm" onClick={saveNew} disabled={saving} title="Simpan Perlengkapan">
                      <Check size={13} />
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(false)} title="Batal">
                      <X size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {loading ? (
              <tr>
                <td colSpan={13} style={{ padding: 40, textAlign: 'center' }}>
                  <LoadingState text="Memuat daftar master perlengkapan..." />
                </td>
              </tr>
            ) : displayedItems.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  {searchQuery || filterSubCat !== 'ALL'
                    ? 'Tidak ditemukan perlengkapan yang cocok dengan filter.'
                    : 'Belum ada perlengkapan yang terdaftar. Klik "+ Tambah Perlengkapan" atau gunakan Template Cepat di atas.'}
                </td>
              </tr>
            ) : (
              displayedItems.map(item => {
                const isEd = editing === item.id;
                const hargaPakai = (Number(item.harga) || 0) / Math.max(Number(item.konversi) || 1, 1);
                const isLow = Number(item.current_stock ?? 0) <= Number(item.current_stok_min ?? item.stok_min ?? 0);

                return (
                  <tr key={item.id} className={isEd ? 'selected' : ''}>
                    <td className="mono" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 12 }}>
                      {isEd ? <FormCell data={editData} setData={setEditData} field="code" style={{ width: 85 }} /> : item.code}
                    </td>

                    <td style={{ fontWeight: 600 }}>
                      {isEd ? (
                        <FormCell data={editData} setData={setEditData} field="name" />
                      ) : (
                        <div>
                          <div style={{ color: '#ffffff' }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Satuan pakai: <strong style={{ color: 'var(--text-secondary)' }}>{item.unit_pakai}</strong>
                          </div>
                        </div>
                      )}
                    </td>

                    <td>
                      {isEd ? (
                        <FormCell data={editData} setData={setEditData} field="category" style={{ width: 120 }} />
                      ) : (
                        <span style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          display: 'inline-block'
                        }}>
                          {item.category || 'Perlengkapan'}
                        </span>
                      )}
                    </td>

                    <td>
                      {isEd ? <FormCell data={editData} setData={setEditData} field="unit_beli" style={{ width: 85 }} /> : <span className="pill pill-muted mono" style={{ fontSize: 11 }}>{item.unit_beli}</span>}
                    </td>

                    <td>
                      {isEd ? <FormCell data={editData} setData={setEditData} field="unit_pakai" style={{ width: 85 }} /> : <span className="pill pill-ok mono" style={{ fontSize: 11 }}>{item.unit_pakai}</span>}
                    </td>

                    <td className="mono">
                      {isEd
                        ? <FormCell data={editData} setData={setEditData} field="konversi" type="number" style={{ width: 75 }} />
                        : <span style={{ fontSize: 12 }}>1 {item.unit_beli} = <strong style={{ color: 'var(--accent-bright)' }}>{num(item.konversi)}</strong> {item.unit_pakai}</span>
                      }
                    </td>

                    {/* Harga Beli Bon */}
                    <td className="mono right">
                      {isEd ? (
                        <FormCell data={editData} setData={setEditData} field="harga" type="number" style={{ width: 95 }} />
                      ) : (
                        <div>
                          <div style={{ fontWeight: 700, color: '#ffffff' }}>{rupiah(item.harga)}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>/{item.unit_beli}</div>
                        </div>
                      )}
                    </td>

                    {/* Harga Satuan Pakai */}
                    <td className="mono right">
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--accent-bright)', fontSize: 13 }}>
                          {rupiah(hargaPakai)}
                        </div>
                        <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>per {item.unit_pakai}</div>
                      </div>
                    </td>

                    {/* Stok Fisik Cabang Aktif */}
                    <td className="mono right">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: isLow ? 'var(--danger)' : 'var(--ok)' }}>
                          {fmtQtyVal(item.current_stock, item.unit_pakai, hargaPakai)}
                        </span>
                        {item.outlet_stocks?.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setBreakdownModal(item)}
                            style={{
                              background: 'none',
                              border: 'none',
                              fontSize: 10,
                              color: 'var(--accent-bright)',
                              cursor: 'pointer',
                              padding: 0,
                              textDecoration: 'underline',
                              marginTop: 2
                            }}
                          >
                            Rincian {item.outlet_stocks.length} Cabang
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="mono right">
                      {isEd
                        ? <FormCell data={editData} setData={setEditData} field="stok_min" type="number" style={{ width: 75 }} />
                        : fmtQtyVal(item.current_stok_min ?? item.stok_min, item.unit_pakai, hargaPakai)}
                    </td>

                    <td className="mono right">
                      {isEd
                        ? <FormCell data={editData} setData={setEditData} field="tolerance" type="number" style={{ width: 55 }} />
                        : `${item.tolerance || 0}%`}
                    </td>

                    <td>
                      <AuditInfo
                        createdAt={item.created_at}
                        createdBy={item.created_by_name}
                        updatedAt={item.updated_at}
                        updatedBy={item.updated_by_name}
                      />
                    </td>

                    <td className="center">
                      {isEd ? (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving} title="Simpan">
                            <Check size={13} />
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)} title="Batal">
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Catat Perlengkapan Rusak / Pecah (Waste)"
                            onClick={() => navigate('/waste', { state: { preselectIngredientId: item.id } })}
                            style={{ padding: '4px 7px', color: '#f43f5e' }}
                          >
                            <Trash2 size={13} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => startEdit(item)}
                            title="Edit Data Perlengkapan"
                            style={{ padding: '4px 7px' }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm text-danger"
                            onClick={() => handleDelete(item)}
                            title="Hapus Perlengkapan"
                            style={{ padding: '4px 7px' }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
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
                  Sebaran Stok Perlengkapan Antar-Cabang
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

      <ImportMasterModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        targetMaster="PERLENGKAPAN"
        onSuccess={() => {
          fetchPerlengkapan();
        }}
      />
    </div>
  );
}
