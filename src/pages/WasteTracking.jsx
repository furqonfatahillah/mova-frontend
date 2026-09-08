import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Trash2, AlertTriangle, TrendingDown, DollarSign, Filter,
  Plus, Search, Calendar, Store, Flame, Package, CheckCircle2,
  X, RefreshCw, AlertCircle, ArrowDownRight, Layers, FileText
} from 'lucide-react';
import api from '../api/client';
import { num, rupiah, LoadingState, PageHeader, AuditInfo } from '../components/ui';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';

export const WASTE_CATEGORIES = [
  { value: 'EXPIRED',            label: 'Basi / Kedaluwarsa',          color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.35)', icon: Flame },
  { value: 'COOKING_ERROR',      label: 'Gosong / Salah Masak',        color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.35)', icon: AlertTriangle },
  { value: 'DELIVERY_DAMAGE',    label: 'Rusak saat Pengiriman',       color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.35)', icon: Package },
  { value: 'CUSTOMER_COMPLAINT', label: 'Komplain Tamu / Retur',       color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.35)', icon: AlertCircle },
  { value: 'DROPPED_SPILL',      label: 'Tumpah / Jatuh',              color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.35)', icon: ArrowDownRight },
  { value: 'STORAGE_DAMAGE',     label: 'Rusak Penyimpanan / Chiller', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.35)', icon: Layers },
  { value: 'OTHER',              label: 'Lainnya',                     color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.35)', icon: FileText },
];

export function getWasteCategoryMeta(val) {
  return WASTE_CATEGORIES.find(c => c.value === val) || {
    value: val || 'OTHER',
    label: val || 'Lainnya',
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.15)',
    border: 'rgba(148, 163, 184, 0.35)',
    icon: FileText
  };
}

export default function WasteTracking() {
  const location = useLocation();
  const { activeOutletId, activeOutlet, isOwnerWebsite, outlets } = useOutlet();

  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1); // Beginning of current month
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [filterReason, setFilterReason] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [wasteLogs, setWasteLogs] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Form State
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    outlet_id: '',
    ingredient_id: '',
    unit_type: 'PAKAI', // 'BELI' or 'PAKAI'
    qty: '',
    reason_category: 'EXPIRED',
    action_taken: 'Dibuang ke tempat sampah organik',
    notes: '',
  });

  const currentTargetOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all'
    ? activeOutletId
    : (outlets[0]?.id?.toString() || '1');

  useEffect(() => {
    fetchData();
  }, [activeOutletId, dateFrom, dateTo, filterReason]);

  async function fetchData() {
    setLoading(true);
    try {
      const params = {
        from: dateFrom,
        to: dateTo,
      };
      if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
        params.outlet_id = activeOutletId;
      }
      if (filterReason !== 'ALL') {
        params.reason_category = filterReason;
      }

      const [logsRes, analyticsRes, ingsRes] = await Promise.all([
        api.get('/waste-logs', { params }),
        api.get('/waste-logs/analytics', { params: { from: dateFrom, to: dateTo, outlet_id: params.outlet_id } }),
        api.get('/ingredients', { params: { outlet_id: params.outlet_id } }),
      ]);

      setWasteLogs(logsRes.data || []);
      setAnalytics(analyticsRes.data || null);
      setIngredients(ingsRes.data || []);
    } catch (err) {
      toast.error('Gagal memuat data Waste & Spoilage.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (location.state?.preselectIngredientId && ingredients.length > 0) {
      handleOpenModal(location.state.preselectIngredientId);
      window.history.replaceState({}, document.title);
    }
  }, [ingredients, location.state]);

  function handleOpenModal(preSelectedIngId = '') {
    const selectedIng = ingredients.find(i => i.id === Number(preSelectedIngId)) || ingredients[0];
    setForm({
      date: new Date().toISOString().slice(0, 10),
      outlet_id: currentTargetOutlet,
      ingredient_id: selectedIng?.id?.toString() || '',
      unit_type: 'PAKAI',
      qty: '',
      reason_category: 'EXPIRED',
      action_taken: 'Dibuang ke tempat sampah organik',
      notes: '',
    });
    setModalOpen(true);
  }

  // Selected ingredient in modal for live loss calculations
  const selectedModalIng = useMemo(() => {
    return ingredients.find(i => i.id === Number(form.ingredient_id));
  }, [ingredients, form.ingredient_id]);

  // Live Loss Cost Calculation in Modal
  const calculatedLoss = useMemo(() => {
    if (!selectedModalIng || !form.qty || Number(form.qty) <= 0) {
      return { qtyPakai: 0, costPerPakai: 0, lossCost: 0 };
    }

    const konversi = Math.max(Number(selectedModalIng.konversi) || 1, 1);
    const isUnitBeli = form.unit_type === 'BELI';
    const qtyPakai = isUnitBeli ? Number(form.qty) * konversi : Number(form.qty);
    
    let costPerPakai = (Number(selectedModalIng.harga) || 0) / konversi;
    if (costPerPakai <= 0 && Number(selectedModalIng.last_purchase_price) > 0) {
      costPerPakai = Number(selectedModalIng.last_purchase_price) / konversi;
    }

    const lossCost = qtyPakai * costPerPakai;
    return { qtyPakai, costPerPakai, lossCost };
  }, [selectedModalIng, form.qty, form.unit_type]);

  async function handleSubmitWaste(e) {
    e.preventDefault();
    if (!form.ingredient_id) {
      toast.error('Pilih bahan baku atau bahan olahan terlebih dahulu.');
      return;
    }
    if (!form.qty || Number(form.qty) <= 0) {
      toast.error('Masukkan jumlah kuantitas bahan yang terbuang.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date: form.date,
        ingredient_id: Number(form.ingredient_id),
        outlet_id: Number(form.outlet_id || currentTargetOutlet),
        unit_type: form.unit_type,
        qty: Number(form.qty),
        reason_category: form.reason_category,
        action_taken: form.action_taken || undefined,
        notes: form.notes || undefined,
      };

      const { data } = await api.post('/waste-logs', payload);

      toast.success(`Catatan Waste ${data.waste_no} berhasil disimpan! Stok berkurang & kerugian tercatat.`);
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan catatan bahan terbuang.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWaste(log) {
    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin membatalkan catatan waste "${log.waste_no}" (${log.ingredient_name} - ${rupiah(log.loss_cost)})?\n\nPergerakan stok akan dibalikkan dan stok fisik akan dikembalikan!`
    );
    if (!confirmDelete) return;

    try {
      await api.delete(`/waste-logs/${log.id}`);
      toast.success(`Catatan waste ${log.waste_no} berhasil dibatalkan dan stok dikembalikan.`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membatalkan catatan waste.');
    }
  }

  // Filtered waste logs by search query
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return wasteLogs;
    const q = searchQuery.toLowerCase();
    return wasteLogs.filter(item => {
      return (
        item.waste_no?.toLowerCase().includes(q) ||
        item.ingredient_name?.toLowerCase().includes(q) ||
        item.reason_label?.toLowerCase().includes(q) ||
        item.notes?.toLowerCase().includes(q) ||
        item.reporter_name?.toLowerCase().includes(q)
      );
    });
  }, [wasteLogs, searchQuery]);

  // Top waste category name
  const topReason = analytics?.by_reason?.[0];

  return (
    <div className="fade-in">
      <PageHeader
        title="Bahan Terbuang & Rusak (Waste Log)"
        subtitle="Pantau dan kendalikan kebocoran profit F&B akibat basi, gosong, tumpah, atau retur. Otomatis potong stok dan hitung Loss Cost."
        action={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={fetchData}
              title="Segarkan data"
            >
              <RefreshCw size={14} style={{ marginRight: 6 }} /> Segarkan
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleOpenModal()}
              style={{ fontWeight: 700 }}
            >
              <Plus size={15} style={{ marginRight: 6 }} /> Catat Bahan Terbuang
            </button>
          </div>
        }
      />

      {/* Warning if Consolidated mode is active */}
      {isOwnerWebsite && (activeOutletId === 'ALL' || activeOutletId === 'all') && (
        <div style={{
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Store size={18} style={{ color: '#38bdf8' }} />
            <div>
              <strong style={{ color: '#ffffff', fontSize: 13 }}>Mode Semua Cabang (Konsolidasi) Aktif</strong>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Pencatatan bahan terbuang idealnya dilakukan per cabang agar stok bahan baku berkurang di gudang/outlet yang tepat.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Period & Filter Bar */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              <Calendar size={14} style={{ color: 'var(--accent-bright)' }} />
              <span>Periode:</span>
            </div>
            <input
              type="date"
              className="form-control"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ padding: '5px 10px', fontSize: 12, width: 140 }}
            />
            <span style={{ color: 'var(--text-muted)' }}>s/d</span>
            <input
              type="date"
              className="form-control"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ padding: '5px 10px', fontSize: 12, width: 140 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              <Filter size={14} style={{ color: 'var(--accent-bright)' }} />
              <span>Kategori Alasan:</span>
            </div>
            <select
              className="form-control"
              value={filterReason}
              onChange={e => setFilterReason(e.target.value)}
              style={{ padding: '5px 10px', fontSize: 12, minWidth: 160 }}
            >
              <option value="ALL">Semua Alasan</option>
              {WASTE_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Card 1: Total Loss Cost */}
        <div className="card" style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)',
          border: '1px solid rgba(244, 63, 94, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 11.5, color: '#fda4af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Kerugian (Loss Cost)
              </span>
              <h2 className="mono" style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', margin: '8px 0 4px' }}>
                {rupiah(analytics?.total_loss_cost || 0)}
              </h2>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Nilai modal bahan baku terbuang
              </span>
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(244, 63, 94, 0.2)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              color: '#fb7185',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <TrendingDown size={22} />
            </div>
          </div>
        </div>

        {/* Card 2: Total Incidents */}
        <div className="card" style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 11.5, color: '#fcd34d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Frekuensi Kejadian
              </span>
              <h2 className="mono" style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', margin: '8px 0 4px' }}>
                {analytics?.total_entries || 0} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>Insiden</span>
              </h2>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {num(analytics?.total_qty_pakai || 0)} total unit terbuang
              </span>
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#fbbf24',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <AlertTriangle size={22} />
            </div>
          </div>
        </div>

        {/* Card 3: Top Waste Driver */}
        <div className="card" style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 11.5, color: '#d8b4fe', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Penyebab Terbesar
              </span>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: '8px 0 4px', lineHeight: 1.3 }}>
                {topReason?.label || 'Belum Ada Data'}
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {topReason ? `${rupiah(topReason.loss_cost)} (${topReason.percentage}%)` : '-'}
              </span>
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(168, 85, 247, 0.2)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              color: '#c084fc',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Flame size={22} />
            </div>
          </div>
        </div>

        {/* Card 4: Top Wasted Ingredient */}
        <div className="card" style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 11.5, color: '#7dd3fc', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Bahan Paling Rugi
              </span>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: '8px 0 4px', lineHeight: 1.3 }}>
                {analytics?.top_ingredients?.[0]?.ingredient_name || 'Belum Ada Data'}
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {analytics?.top_ingredients?.[0] ? `${rupiah(analytics.top_ingredients[0].loss_cost)} (${num(analytics.top_ingredients[0].total_qty)} ${analytics.top_ingredients[0].unit})` : '-'}
              </span>
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(56, 189, 248, 0.2)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Package size={22} />
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown by Reason & Top Ingredients Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Left: Reason Category Breakdown */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, color: '#ffffff' }}>
            <Flame size={18} style={{ color: '#fb7185' }} />
            Distribusi Kerugian Berdasarkan Alasan
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(analytics?.by_reason || []).map(r => {
              const meta = getWasteCategoryMeta(r.category);
              const Icon = meta.icon;
              return (
                <div key={r.category} style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 10,
                  padding: '10px 14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: meta.color }}>
                        <Icon size={14} />
                      </span>
                      <strong style={{ fontSize: 12.5, color: '#ffffff' }}>{r.label}</strong>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({r.count}x)</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>
                        {rupiah(r.loss_cost)}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 6 }}>
                        ({r.percentage}%)
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${r.percentage}%`,
                      height: '100%',
                      background: meta.color,
                      borderRadius: 4,
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Top 5 Wasted Ingredients */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, color: '#ffffff' }}>
            <Package size={18} style={{ color: 'var(--accent-bright)' }} />
            Top 5 Bahan Paling Banyak Merugikan Modal
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Bahan</th>
                  <th className="right">Total Qty</th>
                  <th className="right">Kerugian (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {(!analytics?.top_ingredients || analytics.top_ingredients.length === 0) ? (
                  <tr>
                    <td colSpan={4} className="center text-muted" style={{ padding: 24 }}>
                      Belum ada data bahan terbuang.
                    </td>
                  </tr>
                ) : (
                  analytics.top_ingredients.map((ing, idx) => (
                    <tr key={ing.ingredient_id}>
                      <td className="mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        #{idx + 1}
                      </td>
                      <td style={{ fontWeight: 600, color: '#ffffff' }}>
                        {ing.ingredient_name}
                      </td>
                      <td className="mono right" style={{ fontSize: 12.5 }}>
                        {num(ing.total_qty)} {ing.unit}
                      </td>
                      <td className="mono right" style={{ color: '#fb7185', fontWeight: 700, fontSize: 13 }}>
                        {rupiah(ing.loss_cost)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Main Table: Waste Logs List */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, color: '#ffffff' }}>
            <Trash2 size={18} style={{ color: '#fb7185' }} />
            Riwayat Pencatatan Bahan Terbuang (Waste Logs)
            <span style={{
              fontSize: 11,
              background: 'rgba(244, 63, 94, 0.15)',
              color: '#fda4af',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              padding: '1px 8px',
              borderRadius: 10
            }}>
              {filteredLogs.length} Data
            </span>
          </div>

          {/* Search Bar */}
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Cari no. waste, bahan, koki..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 36, fontSize: 12, borderRadius: 8 }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>No. Waste</th>
                  <th>Tanggal</th>
                  <th>Outlet</th>
                  <th>Bahan Baku / Olahan</th>
                  <th className="right">Qty Terbuang</th>
                  <th>Kategori Alasan</th>
                  <th className="right">Loss Cost (Rp)</th>
                  <th>Pencatat & Catatan</th>
                  <th className="center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="center text-muted" style={{ padding: 36 }}>
                      <Trash2 size={32} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
                      Tidak ada catatan bahan terbuang yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => {
                    const meta = getWasteCategoryMeta(log.reason_category);
                    return (
                      <tr key={log.id}>
                        <td className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-bright)' }}>
                          {log.waste_no}
                        </td>
                        <td className="mono" style={{ fontSize: 12 }}>
                          {log.date}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {log.outlet_name || '-'}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#ffffff' }}>
                            {log.ingredient_name}
                          </div>
                          {log.ingredient?.category && (
                            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                              {log.ingredient.category}
                            </span>
                          )}
                        </td>
                        <td className="mono right" style={{ fontWeight: 700, fontSize: 13 }}>
                          {num(log.qty_pakai)} {log.unit_pakai}
                          {log.unit_type === 'BELI' && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              ({num(log.qty)} {log.ingredient?.unit_beli})
                            </div>
                          )}
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            background: meta.bg,
                            color: meta.color,
                            border: `1px solid ${meta.border}`
                          }}>
                            <span>{log.reason_label}</span>
                          </span>
                        </td>
                        <td className="mono right" style={{ fontWeight: 800, color: '#fb7185', fontSize: 13.5 }}>
                          {rupiah(log.loss_cost)}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                            {log.reporter_name}
                          </div>
                          {log.notes && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>
                              "{log.notes}"
                            </div>
                          )}
                          {log.action_taken && (
                            <div style={{ fontSize: 10.5, color: 'var(--accent-bright)', marginTop: 2 }}>
                              ↳ {log.action_taken}
                            </div>
                          )}
                        </td>
                        <td className="center">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDeleteWaste(log)}
                            style={{ padding: '4px 8px', color: 'var(--danger)' }}
                            title="Batalkan log waste dan kembalikan stok"
                          >
                            <Trash2 size={14} />
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

      {/* ========================================================
          MODAL: CATAT BAHAN TERBUANG (NEW WASTE LOG)
         ======================================================== */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Trash2 size={19} style={{ color: '#fb7185' }} />
                  Catat Bahan Terbuang / Rusak (Waste)
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  Stok bahan akan otomatis dipotong dan nominal kerugian (Loss Cost) dihitung instan.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitWaste} style={{ flex: 1, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Tanggal */}
                <div className="form-group">
                  <label className="form-label">Tanggal Kejadian</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    required
                  />
                </div>

                {/* Outlet Cabang */}
                <div className="form-group">
                  <label className="form-label">Outlet Cabang</label>
                  <select
                    className="form-control"
                    value={form.outlet_id}
                    onChange={e => setForm(p => ({ ...p, outlet_id: e.target.value }))}
                    required
                  >
                    {outlets.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pilih Bahan Baku / Olahan */}
              <div className="form-group">
                <label className="form-label">Pilih Bahan Baku / Olahan</label>
                <select
                  className="form-control"
                  value={form.ingredient_id}
                  onChange={e => setForm(p => ({ ...p, ingredient_id: e.target.value }))}
                  required
                  style={{ fontSize: 13 }}
                >
                  <option value="">-- Pilih Bahan --</option>
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.type === 'SEMI_FINISHED' ? 'Bahan Olahan' : 'Bahan Mentah'}) — Stok: {num(ing.current_stock ?? 0)} {ing.unit_pakai}
                    </option>
                  ))}
                </select>

                {selectedModalIng && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      Stok Fisik Tersedia: <strong>{num(selectedModalIng.current_stock ?? 0)} {selectedModalIng.unit_pakai}</strong>
                    </span>
                    <span>
                      HPP Satuan: <strong className="mono">{rupiah((selectedModalIng.harga || 0) / (selectedModalIng.konversi || 1))}/{selectedModalIng.unit_pakai}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Satuan & Kuantitas Terbuang */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Satuan Input</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, unit_type: 'PAKAI' }))}
                      className={`btn btn-sm ${form.unit_type === 'PAKAI' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, justifyContent: 'center', fontSize: 11.5 }}
                    >
                      Satuan Pakai ({selectedModalIng?.unit_pakai || 'pakai'})
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, unit_type: 'BELI' }))}
                      className={`btn btn-sm ${form.unit_type === 'BELI' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, justifyContent: 'center', fontSize: 11.5 }}
                    >
                      Satuan Beli ({selectedModalIng?.unit_beli || 'beli'})
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Jumlah Terbuang ({form.unit_type === 'BELI' ? selectedModalIng?.unit_beli : selectedModalIng?.unit_pakai})
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    className="form-control mono"
                    placeholder="Contoh: 500 atau 2.5"
                    value={form.qty}
                    onChange={e => setForm(p => ({ ...p, qty: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* LIVE LOSS COST CALCULATION BOX */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.16) 0%, rgba(225, 29, 72, 0.08) 100%)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fda4af', fontWeight: 700 }}>
                    Estimasi Kerugian Modal (Loss Cost)
                  </span>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Pemotongan Stok: <strong className="mono" style={{ color: '#ffffff' }}>-{num(calculatedLoss.qtyPakai)} {selectedModalIng?.unit_pakai || ''}</strong>
                  </div>
                </div>
                <div className="mono" style={{ fontSize: 20, fontWeight: 900, color: '#ffffff' }}>
                  {rupiah(calculatedLoss.lossCost)}
                </div>
              </div>

              {/* Kategori Alasan Terbuang */}
              <div className="form-group">
                <label className="form-label">Kategori Alasan Terbuang</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6 }}>
                  {WASTE_CATEGORIES.map(c => {
                    const isSelected = form.reason_category === c.value;
                    const Icon = c.icon;
                    return (
                      <div
                        key={c.value}
                        onClick={() => setForm(p => ({ ...p, reason_category: c.value }))}
                        style={{
                          padding: '7px 10px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          border: isSelected ? `1.5px solid ${c.color}` : '1px solid var(--border)',
                          background: isSelected ? c.bg : 'rgba(255,255,255,0.03)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11.5,
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ color: c.color }}>
                          <Icon size={14} />
                        </span>
                        <span>{c.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tindakan Korektif */}
              <div className="form-group">
                <label className="form-label">Tindakan Korektif (Action Taken)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Misal: Dibuang ke tempat sampah / Diklaim ke vendor / Teguran koki"
                  value={form.action_taken}
                  onChange={e => setForm(p => ({ ...p, action_taken: e.target.value }))}
                  style={{ fontSize: 12 }}
                />
              </div>

              {/* Kronologi / Catatan */}
              <div className="form-group">
                <label className="form-label">Kronologi / Catatan Detail Kejadian</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Misal: Chiller mati semalam sehingga 3 kg ayam berbau asam saat koki pagi membuka dapur."
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  style={{ fontSize: 12 }}
                />
              </div>

              {/* Modal Footer Actions */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 10, display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={saving || !form.qty || Number(form.qty) <= 0}
                  style={{ flex: 2, justifyContent: 'center', fontWeight: 800 }}
                >
                  {saving ? 'Memproses...' : (
                    <>
                      <Trash2 size={15} style={{ marginRight: 6 }} /> Catat Waste & Potong Stok
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
