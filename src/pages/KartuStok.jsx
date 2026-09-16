import { useState, useEffect, useMemo } from 'react';
import {
  ScrollText, Plus, Search, Filter, ArrowUpRight, ArrowDownLeft,
  AlertTriangle, Calendar, Printer, X, Check, RefreshCw, Eye, Store,
  ArrowLeft, Building2, ChevronRight
} from 'lucide-react';
import api from '../api/client';
import { rupiah, num, LoadingState, PageHeader, AuditInfo, PeriodPicker } from '../components/ui';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';

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

export default function KartuStok() {
  const { activeOutletId, activeOutlet, isOwnerBisnis, isSuperadminPlatform, outlets } = useOutlet();

  // Selected warehouse/outlet and date period
  const [selectedOutletId, setSelectedOutletId] = useState(() => {
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      return String(activeOutletId);
    }
    return '';
  });
  const [period, setPeriod] = useState({ from: '2026-08-01', to: '2026-08-31' });

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

  // Shift Drill-down Modal
  const [shiftModal, setShiftModal] = useState(null);
  const [shiftModalLoading, setShiftModalLoading] = useState(false);
  const [shiftModalData, setShiftModalData] = useState(null);

  // Filters inside detail stock card
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'IN' | 'OUT' | type
  const [searchTerm, setSearchTerm] = useState('');

  // Modal Add Mutation
  const [modalOpen, setModalOpen] = useState(false);
  const [mutationForm, setMutationForm] = useState({
    ingredient_id: '',
    outlet_id: '',
    date: new Date().toISOString().slice(0, 10),
    type: 'PURCHASE',
    unit_type: 'BELI',
    unit_price: '',
    qty: '',
    note: '',
    waste_reason: 'SPOILED',
  });
  const [saving, setSaving] = useState(false);

  // Initialize selectedOutletId when outlets load
  useEffect(() => {
    if (outlets.length > 0 && !selectedOutletId) {
      const defaultOut = outlets.find(o => o.is_main) || outlets[0];
      setSelectedOutletId(String(defaultOut.id));
    }
  }, [outlets, selectedOutletId]);

  // Initial fetch ingredients for master list
  useEffect(() => {
    fetchIngredients();
  }, []);

  async function fetchIngredients() {
    try {
      const { data } = await api.get('/ingredients');
      setIngredients(data);
    } catch {
      toast.error('Gagal memuat master bahan baku');
    }
  }

  // Fetch summary items when selectedOutletId or period changes
  useEffect(() => {
    if (selectedOutletId) {
      fetchSummary();
    }
  }, [selectedOutletId, period]);

  // Fetch specific stock card when selectedIngId, selectedOutletId, or period changes
  useEffect(() => {
    if (selectedIngId && selectedOutletId) {
      fetchStockCard();
    }
  }, [selectedIngId, selectedOutletId, period]);

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

  async function handleAddMutation(e) {
    e.preventDefault();
    if (!mutationForm.qty || Number(mutationForm.qty) <= 0) {
      toast.error('Qty mutasi harus lebih besar dari 0');
      return;
    }
    setSaving(true);
    try {
      const targetOutlet = mutationForm.outlet_id || selectedOutletId || 1;
      const payload = {
        ...mutationForm,
        ingredient_id: Number(mutationForm.ingredient_id || ingredients[0]?.id),
        qty: Number(mutationForm.qty),
        outlet_id: Number(targetOutlet),
        unit_type: mutationForm.type === 'PURCHASE' ? (mutationForm.unit_type || 'BELI') : 'PAKAI',
        unit_price: mutationForm.type === 'PURCHASE' && mutationForm.unit_price !== '' ? Number(mutationForm.unit_price) : undefined,
        waste_reason: mutationForm.type === 'WASTE' ? (mutationForm.waste_reason || 'SPOILED') : undefined,
      };
      await api.post('/movements', payload);
      toast.success('Mutasi stok berhasil dicatat!');
      setModalOpen(false);
      setMutationForm(f => ({ ...f, qty: '', note: '', unit_price: '' }));
      // Refresh data
      fetchSummary();
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

  const currentOutlet = outlets.find(o => String(o.id) === String(selectedOutletId));
  const selectedIng = ingredients.find(i => i.id === Number(selectedIngId));
  const activeModalIng = ingredients.find(i => Number(i.id) === Number(mutationForm.ingredient_id));

  // Available categories in current summary
  const availableCategories = useMemo(() => {
    const cats = (summaryData?.items || []).map(i => i.category).filter(Boolean);
    return ['ALL', ...Array.from(new Set(cats))];
  }, [summaryData]);

  // Filtered summary items
  const filteredSummaryItems = useMemo(() => {
    if (!summaryData?.items) return [];
    return summaryData.items.filter(it => {
      if (itemCategory !== 'ALL' && it.category !== itemCategory) return false;
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
        subtitle="Pilih gudang/cabang dan periode tanggal untuk memantau pergerakan stok per bahan baku."
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            {selectedIngId && (
              <button className="btn btn-secondary" onClick={backToSummaryList} title="Kembali ke Daftar Bahan">
                <ArrowLeft size={14} /> Daftar Bahan
              </button>
            )}
            <button className="btn btn-secondary" onClick={handlePrint} title="Cetak Laporan">
              <Printer size={14} /> Cetak
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                const targetIngId = selectedIngId || (ingredients[0]?.id || '');
                const targetIng = ingredients.find(i => String(i.id) === String(targetIngId));
                setMutationForm({
                  ingredient_id: targetIngId,
                  outlet_id: selectedOutletId,
                  date: new Date().toISOString().slice(0, 10),
                  type: 'PURCHASE',
                  unit_type: 'BELI',
                  unit_price: targetIng?.harga || '',
                  qty: '',
                  note: '',
                  waste_reason: 'SPOILED',
                });
                setModalOpen(true);
              }}
            >
              <Plus size={15} /> Catat Mutasi
            </button>
          </div>
        }
      />

      {/* Control Bar: Pilih Gudang & Range Tanggal */}
      <div className="card mb-5" style={{ padding: '16px 20px', border: '1px solid var(--border-accent)', background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Gudang / Outlet Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-bright)', fontWeight: 700, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
              <Store size={16} /> Pilih Gudang:
            </div>
            <select
              className="form-control"
              style={{ fontWeight: 700, fontSize: 13.5, borderColor: 'var(--accent)', background: 'var(--bg-card)', color: '#ffffff' }}
              value={selectedOutletId}
              onChange={e => {
                setSelectedOutletId(e.target.value);
              }}
            >
              {outlets.map(o => (
                <option key={o.id} value={o.id} style={{ background: '#11162d', color: '#ffffff' }}>
                  {o.is_main ? '🏢 ' : '📍 '} {o.name} {o.is_main ? '(Gudang Utama / Pusat)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date Period Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <PeriodPicker from={period.from} to={period.to} onChange={setPeriod} align="right" />

            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setPeriod({ from: '2026-08-01', to: '2026-08-31' })}
              title="Set ke Agustus 2026"
            >
              Agustus 2026
            </button>

            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
                setPeriod({ from: `${y}-${m}-01`, to: `${y}-${m}-${lastDay}` });
              }}
              title="Set ke Bulan Berjalan"
            >
              Bulan Ini
            </button>

            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                fetchSummary();
                if (selectedIngId) fetchStockCard();
              }}
              disabled={summaryLoading || cardLoading}
              title="Refresh Data"
            >
              <RefreshCw size={13} className={summaryLoading || cardLoading ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </div>

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
                {availableCategories.map(cat => (
                  <button
                    key={cat}
                    className={`btn btn-sm ${itemCategory === cat ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setItemCategory(cat)}
                  >
                    {cat === 'ALL' ? 'Semua Kategori' : cat}
                  </button>
                ))}
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
                  Daftar Bahan Baku di {currentOutlet?.name || 'Gudang'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Periode: <strong>{period.from}</strong> s/d <strong>{period.to}</strong> · Klik nama bahan baku untuk membuka kartu stok & buku besar mutasi lengkap.
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Menampilkan <strong>{filteredSummaryItems.length}</strong> bahan baku
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
                      <th style={{ width: 100 }}>Kode</th>
                      <th style={{ minWidth: 200 }}>Nama Bahan Baku</th>
                      <th style={{ width: 110 }}>Kategori</th>
                      <th className="right" style={{ width: 120 }}>Stok Awal ({period.from})</th>
                      <th className="right" style={{ width: 110 }}>Masuk (+)</th>
                      <th className="right" style={{ width: 110 }}>Keluar (-)</th>
                      <th className="right" style={{ width: 130 }}>Stok Akhir ({period.to})</th>
                      <th style={{ width: 80 }}>Satuan</th>
                      <th className="right" style={{ width: 95 }}>Stok Min</th>
                      <th className="center" style={{ width: 100 }}>Status</th>
                      <th className="center" style={{ width: 130 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSummaryItems.length === 0 ? (
                      <tr>
                        <td colSpan={12} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                          Tidak ada bahan baku yang sesuai dengan kriteria pencarian.
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
                              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                                {it.category}
                              </span>
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
                  {ingredients.map(i => (
                    <option key={i.id} value={i.id} style={{ background: '#11162d', color: '#ffffff' }}>
                      {i.code} - {i.name}
                    </option>
                  ))}
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
                      <td colSpan={10} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
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

      {/* Modal Catat Mutasi Manual */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Catat Mutasi Stok Manual</div>
              <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddMutation}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Bahan Baku</label>
                  <select
                    className="form-control"
                    value={mutationForm.ingredient_id}
                    onChange={e => {
                      const newId = Number(e.target.value);
                      const ing = ingredients.find(i => i.id === newId);
                      setMutationForm(f => ({
                        ...f,
                        ingredient_id: newId,
                        unit_price: f.type === 'PURCHASE' ? (ing?.harga || '') : f.unit_price
                      }));
                    }}
                  >
                    {ingredients.map(i => (
                      <option key={i.id} value={i.id} style={{ background: '#11162d', color: '#ffffff' }}>
                        {i.code} - {i.name} ({i.unit_pakai})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Gudang / Cabang Outlet</label>
                  <select
                    className="form-control"
                    value={mutationForm.outlet_id || selectedOutletId}
                    onChange={e => setMutationForm(f => ({ ...f, outlet_id: e.target.value }))}
                  >
                    {outlets.map(o => (
                      <option key={o.id} value={o.id} style={{ background: '#11162d', color: '#ffffff' }}>
                        {o.is_main ? '🏢 ' : '📍 '} {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Tanggal Transaksi</label>
                  <input
                    type="date"
                    className="form-control mono"
                    required
                    value={mutationForm.date}
                    onChange={e => setMutationForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tipe Mutasi</label>
                  <select
                    className="form-control"
                    value={mutationForm.type}
                    onChange={e => {
                      const newType = e.target.value;
                      setMutationForm(f => ({
                        ...f,
                        type: newType,
                        unit_price: newType === 'PURCHASE' && !f.unit_price ? (activeModalIng?.harga || '') : f.unit_price
                      }));
                    }}
                  >
                    <option value="PURCHASE">Pembelian Bahan (Masuk +)</option>
                    <option value="WASTE">Waste / Bahan Rusak (Keluar -)</option>
                    <option value="ADJUSTMENT_IN">Penyesuaian Stok Bertambah (Masuk +)</option>
                    <option value="ADJUSTMENT_OUT">Penyesuaian Stok Berkurang (Keluar -)</option>
                    <option value="TRANSFER_IN">Transfer Masuk (Masuk +)</option>
                    <option value="TRANSFER_OUT">Transfer Keluar (Keluar -)</option>
                  </select>
                </div>

                {mutationForm.type === 'PURCHASE' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Satuan Input Qty & Harga</label>
                      <div style={{ display: 'flex', gap: 16, marginTop: 4, background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
                          <input
                            type="radio"
                            name="unit_type"
                            value="BELI"
                            checked={mutationForm.unit_type === 'BELI'}
                            onChange={e => setMutationForm(f => ({ ...f, unit_type: e.target.value }))}
                          />
                          Satuan Beli ({activeModalIng?.unit_beli || 'Kg'})
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
                          <input
                            type="radio"
                            name="unit_type"
                            value="PAKAI"
                            checked={mutationForm.unit_type === 'PAKAI'}
                            onChange={e => setMutationForm(f => ({ ...f, unit_type: e.target.value }))}
                          />
                          Satuan Pakai ({activeModalIng?.unit_pakai || 'gram'})
                        </label>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Jumlah / Qty Pembelian ({mutationForm.unit_type === 'BELI' ? (activeModalIng?.unit_beli || 'satuan beli') : (activeModalIng?.unit_pakai || 'satuan pakai')})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        className="form-control mono"
                        required
                        placeholder={mutationForm.unit_type === 'BELI' ? 'Contoh: 5' : 'Contoh: 5000'}
                        value={mutationForm.qty}
                        onChange={e => setMutationForm(f => ({ ...f, qty: e.target.value }))}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Harga Beli Satuan (Rp per {mutationForm.unit_type === 'BELI' ? (activeModalIng?.unit_beli || 'unit beli') : (activeModalIng?.unit_pakai || 'unit pakai')})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="form-control mono"
                        placeholder="Contoh: 25000"
                        value={mutationForm.unit_price}
                        onChange={e => setMutationForm(f => ({ ...f, unit_price: e.target.value }))}
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'block' }}>
                        ⚡ Kosongkan jika ingin menggunakan harga Moving Average saat ini ({rupiah(activeModalIng?.harga || 0)}/{activeModalIng?.unit_beli}).
                      </span>
                    </div>

                    {Number(mutationForm.qty) > 0 && Number(mutationForm.unit_price) > 0 && (
                      <div style={{ padding: '10px 14px', background: 'rgba(124, 58, 237, 0.12)', border: '1px solid var(--border-accent)', borderRadius: 8, marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Estimasi Total Nilai Pembelian:</div>
                        <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-bright)', marginTop: 2 }}>
                          {rupiah(Number(mutationForm.qty) * Number(mutationForm.unit_price))}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#38bdf8', marginTop: 4 }}>
                          ⚡ HPP Moving Average akan dihitung ulang secara otomatis oleh sistem saat mutasi disimpan.
                        </div>
                      </div>
                    )}
                  </>
                )}

                {mutationForm.type !== 'PURCHASE' && (
                  <div className="form-group">
                    <label className="form-label">
                      Jumlah / Qty ({activeModalIng?.unit_pakai || 'satuan pakai'})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      className="form-control mono"
                      required
                      placeholder="Contoh: 500"
                      value={mutationForm.qty}
                      onChange={e => setMutationForm(f => ({ ...f, qty: e.target.value }))}
                    />
                  </div>
                )}

                {mutationForm.type === 'WASTE' && (
                  <div className="form-group">
                    <label className="form-label">Alasan Waste / Rusak</label>
                    <select
                      className="form-control"
                      value={mutationForm.waste_reason || 'SPOILED'}
                      onChange={e => setMutationForm(f => ({ ...f, waste_reason: e.target.value }))}
                    >
                      <option value="SPOILED">Basi / Kedaluwarsa</option>
                      <option value="BURNT_MISTAKE">Gosong / Kesalahan Masak</option>
                      <option value="SPILLED_DROPPED">Tumpah / Jatuh / Rusak</option>
                      <option value="QUALITY_REJECT">Sortir Kualitas / Trimming</option>
                      <option value="SUPPLIER_DEFECT">Cacat Penerimaan Suplier</option>
                      <option value="OTHER">Lainnya</option>
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">No. Referensi / Catatan</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: PO-0820 dari Supplier Surya"
                    value={mutationForm.note}
                    onChange={e => setMutationForm(f => ({ ...f, note: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Check size={14} /> {saving ? 'Menyimpan...' : 'Simpan Mutasi'}
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
    </div>
  );
}
