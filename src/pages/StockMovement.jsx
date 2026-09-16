import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Filter, Store, TrendingUp, TrendingDown, Sparkles, Calculator, X } from 'lucide-react';
import api from '../api/client';
import { num, rupiah, fmtQtyVal, LoadingState, PageHeader, AuditInfo, PeriodPicker } from '../components/ui';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';

export const WASTE_REASONS = [
  { value: 'SPOILED',         label: 'Basi / Kedaluwarsa',        badgeColor: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)' },
  { value: 'BURNT_MISTAKE',   label: 'Gosong / Kesalahan Masak',  badgeColor: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)' },
  { value: 'SPILLED_DROPPED', label: 'Tumpah / Jatuh / Rusak',    badgeColor: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' },
  { value: 'QUALITY_REJECT',  label: 'Sortir Kualitas / Trimming',badgeColor: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
  { value: 'SUPPLIER_DEFECT', label: 'Cacat Penerimaan Suplier',  badgeColor: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' },
  { value: 'OTHER',           label: 'Lainnya',                   badgeColor: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' },
];

export function getWasteReason(val) {
  return WASTE_REASONS.find(r => r.value === val) || {
    value: val || 'OTHER',
    label: val || 'Lainnya',
    badgeColor: '#fb7185',
    bg: 'rgba(244, 63, 94, 0.15)'
  };
}

const MOVEMENT_TYPES = [
  { value: 'PURCHASE',       label: 'Pembelian (Moving Avg)', sign: '+', color: 'var(--ok)' },
  { value: 'WASTE',          label: 'Waste / Rusak',          sign: '-', color: 'var(--danger)' },
  { value: 'ADJUSTMENT_IN',  label: 'Adjustment (+)',          sign: '+', color: 'var(--accent)' },
  { value: 'ADJUSTMENT_OUT', label: 'Adjustment (-)',          sign: '-', color: 'var(--warn)' },
  { value: 'TRANSFER_IN',    label: 'Transfer Masuk',          sign: '+', color: 'var(--ok)' },
  { value: 'TRANSFER_OUT',   label: 'Transfer Keluar',         sign: '-', color: 'var(--warn)' },
  { value: 'PREP_USAGE',     label: 'Bahan Olahan Masak (Prep)', sign: '-', color: '#ec4899' },
  { value: 'PREP_OUTPUT',    label: 'Hasil Olahan (Batch Prep)',  sign: '+', color: '#a855f7' },
];

const OUT_TYPES = ['SALE_USAGE', 'WASTE', 'ADJUSTMENT_OUT', 'TRANSFER_OUT', 'PREP_USAGE'];

export default function StockMovement() {
  const [movements, setMovements] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterIng, setFilterIng] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { activeOutletId, activeOutlet, isOwnerWebsite, outlets } = useOutlet();

  const [filterOutlet, setFilterOutlet] = useState(() => {
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      return String(activeOutletId);
    }
    return 'ALL';
  });

  useEffect(() => {
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      setFilterOutlet(String(activeOutletId));
    }
  }, [activeOutletId]);

  const [form, setForm] = useState({
    ingredient_id: '',
    outlet_id: activeOutletId && activeOutletId !== 'ALL' ? activeOutletId : '1',
    type: 'PURCHASE',
    waste_reason: 'SPOILED',
    unit_type: 'BELI', // 'BELI' or 'PAKAI'
    unit_price: '',
    qty: '',
    date: new Date().toISOString().slice(0, 10),
    note: '',
  });
  const [saving, setSaving] = useState(false);

  const [period, setPeriod] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { from: firstDay, to: lastDay };
  });

  useEffect(() => { fetchAll(); }, [filterIng, filterType, filterOutlet, period]);

  async function fetchAll() {
    try {
      const params = {};
      if (filterIng !== 'ALL') params.ingredient_id = filterIng;
      if (filterType !== 'ALL') params.type = filterType;
      if (filterOutlet !== 'ALL' && filterOutlet !== 'all') params.outlet_id = filterOutlet;
      if (period.from) params.from = period.from;
      if (period.to) params.to = period.to;

      const [m, i] = await Promise.all([
        api.get('/movements', { params }),
        api.get('/ingredients', { params: { outlet_id: params.outlet_id } }),
      ]);
      setMovements(m.data);
      setIngredients(i.data);
      if (i.data.length && !form.ingredient_id) {
        setForm(f => ({
          ...f,
          ingredient_id: i.data[0].id,
          unit_price: i.data[0].harga || ''
        }));
      }
    } catch { toast.error('Gagal memuat data'); }
    finally { setLoading(false); }
  }

  const selectedIng = ingredients.find(i => String(i.id) === String(form.ingredient_id));
  const conversion = Number(selectedIng?.konversi) || 1;
  const isUnitBeli = form.unit_type === 'BELI';

  // Live simulation of Moving Average for PURCHASE
  const liveMovingAverage = useMemo(() => {
    if (!selectedIng || form.type !== 'PURCHASE') return null;
    const currentStock = Number(selectedIng.current_stock ?? selectedIng.stok_awal ?? 0);
    const effectiveStock = Math.max(currentStock, 0);
    const currentCostPerPakai = (Number(selectedIng.harga) || 0) / conversion;
    const currentHargaBeli = Number(selectedIng.harga) || 0;

    const inputQty = Number(form.qty) || 0;
    if (inputQty <= 0) {
      return {
        currentStock,
        effectiveStock,
        currentHargaBeli,
        incomingPriceBeli: form.unit_price ? Number(form.unit_price) : currentHargaBeli,
        newHargaBeli: null,
      };
    }

    const incomingQtyPakai = isUnitBeli ? inputQty * conversion : inputQty;
    const inputPrice = form.unit_price !== '' && form.unit_price !== undefined
      ? Number(form.unit_price)
      : (isUnitBeli ? currentHargaBeli : currentCostPerPakai);

    const incomingPricePakai = isUnitBeli ? (inputPrice / conversion) : inputPrice;
    const incomingPriceBeli = isUnitBeli ? inputPrice : (inputPrice * conversion);

    const totalBeliValue = (incomingQtyPakai / conversion) * incomingPriceBeli;

    let newCostPerPakai = incomingPricePakai;
    if (effectiveStock + incomingQtyPakai > 0) {
      const oldValue = effectiveStock * currentCostPerPakai;
      const newValue = incomingQtyPakai * incomingPricePakai;
      newCostPerPakai = (oldValue + newValue) / (effectiveStock + incomingQtyPakai);
    }
    const newHargaBeli = newCostPerPakai * conversion;
    const deltaHarga = newHargaBeli - currentHargaBeli;

    return {
      currentStock,
      effectiveStock,
      currentCostPerPakai,
      currentHargaBeli,
      incomingQtyPakai,
      incomingPriceBeli,
      totalBeliValue,
      newCostPerPakai,
      newHargaBeli,
      deltaHarga,
    };
  }, [selectedIng, form.type, form.qty, form.unit_price, form.unit_type, conversion, isUnitBeli]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.qty) { toast.error('Qty tidak boleh kosong'); return; }
    setSaving(true);
    try {
      const targetOutlet = form.outlet_id || (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? Number(activeOutletId) : 1);
      const payload = {
        date: form.date,
        ingredient_id: Number(form.ingredient_id),
        type: form.type,
        qty: Number(form.qty),
        unit_type: form.unit_type,
        unit_price: form.type === 'PURCHASE' && form.unit_price !== '' ? Number(form.unit_price) : null,
        note: form.note,
        outlet_id: targetOutlet,
        waste_reason: form.type === 'WASTE' ? form.waste_reason : null,
      };

      const { data } = await api.post('/movements', payload);
      setMovements(prev => [data, ...prev]);
      setForm(f => ({ ...f, qty: '', note: '' }));
      setIsModalOpen(false);
      toast.success(
        form.type === 'PURCHASE'
          ? `Pembelian berhasil! Harga rata-rata bergerak terupdate: ${rupiah(data.cost_after * conversion)}/${selectedIng?.unit_beli}`
          : form.type === 'WASTE' ? 'Catatan kerusakan bahan (waste) disimpan' : 'Pergerakan stok dicatat'
      );
      // Refresh ingredients to get updated harga and stock
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan');
    } finally { setSaving(false); }
  }

  function typeInfo(type) {
    const t = MOVEMENT_TYPES.find(x => x.value === type);
    const isOut = OUT_TYPES.includes(type);
    return {
      sign: isOut ? '-' : '+',
      color: isOut ? 'var(--danger)' : 'var(--ok)',
      label: t?.label || type,
    };
  }

  if (loading) return <LoadingState />;

  const wasteCount = movements.filter(m => m.type === 'WASTE').length;

  return (
    <div className="fade-in">
      <PageHeader
        title="Stock Movement & Waste Log"
        subtitle="Ledger seluruh mutasi stok bahan baku: pembelian, pemakaian penjualan (POS), pencatatan kerusakan/waste terpisah, transfer, dan adjustment."
        rightContent={
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
          >
            <Plus size={16} />
            Catat Pergerakan Manual
          </button>
        }
      />

      {/* Ledger Table (Full Width) */}
      <div className="card">
          <div className="flex-between mb-4 flex-wrap gap-2">
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Ledger Mutasi Stok</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {movements.length} transaksi termuat {wasteCount > 0 && `(termasuk ${wasteCount} log waste)`}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <PeriodPicker from={period.from} to={period.to} onChange={setPeriod} align="right" />

              <select
                className="form-control"
                style={{ width: 'auto', padding: '6px 10px', fontSize: 12, fontWeight: 600 }}
                value={filterOutlet}
                onChange={e => setFilterOutlet(e.target.value)}
              >
                <option value="ALL">🏢 Semua Gudang / Cabang</option>
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.is_main ? '🏢 ' : '📍 '} {o.name}
                  </option>
                ))}
              </select>

              <select className="form-control" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}
                value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="ALL">Semua Tipe</option>
                <option value="WASTE">⚠️ Hanya Waste</option>
                <option value="PURCHASE">➕ Pembelian (Moving Avg)</option>
                <option value="SALE_USAGE">🍽️ Pemakaian POS</option>
                <option value="TRANSFER_IN">Transfer Masuk</option>
                <option value="TRANSFER_OUT">Transfer Keluar</option>
              </select>

              <select className="form-control" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}
                value={filterIng} onChange={e => setFilterIng(e.target.value)}>
                <option value="ALL">Semua Bahan</option>
                {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Cabang</th>
                  <th>Bahan</th>
                  <th>Tipe / Alasan</th>
                  <th className="right">Qty</th>
                  <th className="right" style={{ minWidth: 150 }}>Harga Beli & Moving Avg</th>
                  <th style={{ minWidth: 160 }}>Petugas / Audit</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => {
                  const ti = typeInfo(m.type);
                  const isWaste = m.type === 'WASTE';
                  const isPurchase = m.type === 'PURCHASE';
                  const wr = isWaste ? getWasteReason(m.waste_reason) : null;
                  const conv = Number(m.ingredient?.konversi) || 1;

                  return (
                    <tr key={m.id} style={isWaste ? { background: 'rgba(244, 63, 94, 0.03)' } : {}}>
                      <td className="mono" style={{ fontSize: 12 }}>{m.date}</td>
                      <td>
                        <span style={{ fontSize: 11, color: '#c7d2fe', fontWeight: 600 }}>
                          {m.outlet?.name || (m.outlet_id ? `Outlet #${m.outlet_id}` : 'Semua Cabang')}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{m.ingredient?.name}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span className="mono" style={{
                            fontSize: 11,
                            padding: '2px 7px',
                            background: isWaste ? 'rgba(244,63,94,0.15)' : isPurchase ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                            color: isWaste ? '#fb7185' : isPurchase ? '#34d399' : 'inherit',
                            borderRadius: 4,
                            width: 'fit-content'
                          }}>
                            {m.type}
                          </span>
                          {wr && (
                            <span style={{ fontSize: 11, color: wr.badgeColor, fontWeight: 500 }}>
                              • {wr.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="mono right" style={{ color: ti.color, fontWeight: 600 }}>
                        {ti.sign}{fmtQtyVal(m.qty, m.ingredient?.unit_pakai, m.cost_after || (m.ingredient?.konversi > 0 ? (m.ingredient.harga / m.ingredient.konversi) : 0))}
                      </td>

                      {/* Harga Beli & Moving Average Column */}
                      <td className="right">
                        {isPurchase && m.unit_price ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            <span className="mono" style={{ fontWeight: 700, color: '#34d399', fontSize: 12 }}>
                              {rupiah(m.unit_price)}/{m.ingredient?.unit_beli || 'satuan'}
                            </span>
                            {m.cost_after && (
                              <span style={{ fontSize: 10.5, color: 'var(--accent-bright)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Sparkles size={10} /> Avg: {rupiah(m.cost_after * conv)}
                              </span>
                            )}
                            {m.total_price && (
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                Total: {rupiah(m.total_price)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                        )}
                      </td>

                      <td>
                        <AuditInfo
                          createdAt={m.created_at}
                          createdBy={m.created_by_name || m.user?.name}
                          updatedAt={m.updated_at}
                          updatedBy={m.updated_by_name}
                        />
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.note || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      {/* MODAL: CATAT PERGERAKAN MANUAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 540, width: '100%', padding: 24, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-bright)' }}>
                  <Plus size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Catat Pergerakan Manual</h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Input mutasi stok: pembelian, waste, adjustment, atau transfer.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="btn btn-ghost btn-icon btn-sm">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Bahan Baku</label>
                <select className="form-control" value={form.ingredient_id}
                  onChange={e => setForm(f => ({ ...f, ingredient_id: e.target.value }))}>
                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit_pakai})</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tipe Pergerakan</label>
                <select className="form-control" value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {MOVEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Waste Reason Dropdown */}
              {form.type === 'WASTE' && (
                <div className="form-group fade-in" style={{ background: 'rgba(244, 63, 94, 0.08)', padding: 12, borderRadius: 8, border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                  <label className="form-label" style={{ color: '#fb7185', fontWeight: 600 }}>
                    ⚠️ Alasan Kerusakan / Waste
                  </label>
                  <select className="form-control" value={form.waste_reason}
                    onChange={e => setForm(f => ({ ...f, waste_reason: e.target.value }))}>
                    {WASTE_REASONS.map(wr => (
                      <option key={wr.value} value={wr.value}>{wr.label}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Data ini dipisahkan di Cost Control agar tidak rancu dengan selisih tak terjelaskan.
                  </div>
                </div>
              )}

              {/* Qty & Unit Selection */}
              <div className="form-group">
                <label className="form-label">
                  Jumlah Qty {form.type === 'PURCHASE' ? 'Pembelian' : `(${selectedIng?.unit_pakai || 'satuan'})`}
                </label>
                {form.type === 'PURCHASE' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 8 }}>
                    <input
                      type="number"
                      className="form-control"
                      min="0.001"
                      step="any"
                      placeholder="0"
                      value={form.qty}
                      onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                    />
                    <select
                      className="form-control"
                      value={form.unit_type}
                      onChange={e => {
                        const newUnit = e.target.value;
                        setForm(f => ({
                          ...f,
                          unit_type: newUnit,
                          unit_price: selectedIng
                            ? (newUnit === 'BELI' ? selectedIng.harga : Number((selectedIng.harga / (selectedIng.konversi || 1)).toFixed(2)))
                            : f.unit_price
                        }));
                      }}
                    >
                      <option value="BELI">{selectedIng?.unit_beli || 'Satuan Beli'} ({selectedIng?.konversi || 1000}x)</option>
                      <option value="PAKAI">{selectedIng?.unit_pakai || 'Satuan Pakai'}</option>
                    </select>
                  </div>
                ) : (
                  <input
                    type="number"
                    className="form-control"
                    min="0.001"
                    step="any"
                    placeholder="0"
                    value={form.qty}
                    onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                  />
                )}
              </div>

              {/* PURCHASE ONLY: Purchase Price & Moving Average Simulation */}
              {form.type === 'PURCHASE' && (
                <div className="form-group fade-in" style={{
                  background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.3) 0%, rgba(16, 185, 129, 0.08) 100%)',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label className="form-label" style={{ color: '#34d399', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                      <Calculator size={14} /> Harga Beli Satuan Baru (Rp)
                    </label>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                      per {form.unit_type === 'BELI' ? selectedIng?.unit_beli : selectedIng?.unit_pakai}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="form-control mono"
                        style={{ fontSize: 13, fontWeight: 700, borderColor: 'rgba(16, 185, 129, 0.4)' }}
                        placeholder="Harga satuan beli..."
                        value={form.unit_price}
                        onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                      />
                    </div>

                    <div>
                      <div style={{
                        padding: '8px 10px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center'
                      }}>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Total Nilai Pembelian</div>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>
                          {liveMovingAverage?.totalBeliValue ? rupiah(liveMovingAverage.totalBeliValue) : 'Rp 0'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Live Moving Average Result Box */}
                  {liveMovingAverage?.newHargaBeli !== null && liveMovingAverage?.newHargaBeli !== undefined && (
                    <div style={{
                      marginTop: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(99, 102, 241, 0.1)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      fontSize: 11.5
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Harga Rata-Rata Saat Ini:</span>
                        <span className="mono" style={{ color: 'var(--text-muted)' }}>{rupiah(liveMovingAverage.currentHargaBeli)}/{selectedIng?.unit_beli}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 4, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                        <span style={{ fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Sparkles size={13} color="var(--accent-bright)" /> Estimasi Rata-Rata Baru:
                        </span>
                        <div style={{ textAlign: 'right' }}>
                          <span className="mono" style={{ fontWeight: 800, color: 'var(--accent-bright)', fontSize: 13 }}>
                            {rupiah(liveMovingAverage.newHargaBeli)}/{selectedIng?.unit_beli}
                          </span>
                          {liveMovingAverage.deltaHarga !== 0 && (
                            <span style={{
                              marginLeft: 6,
                              fontSize: 10,
                              fontWeight: 700,
                              color: liveMovingAverage.deltaHarga > 0 ? '#fb7185' : '#34d399'
                            }}>
                              ({liveMovingAverage.deltaHarga > 0 ? '+' : ''}{rupiah(liveMovingAverage.deltaHarga)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Tanggal Mutasi</label>
                <input type="date" className="form-control" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Catatan Tambahan</label>
                <input className="form-control" value={form.note} placeholder="Misal: Beli di pasar lokal, supplier restock, dll."
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" className={`btn ${form.type === 'WASTE' ? 'btn-danger' : 'btn-primary'}`} disabled={saving} style={{ fontWeight: 700 }}>
                  <Plus size={14} /> {saving ? 'Menyimpan...' : form.type === 'WASTE' ? 'Catat Waste' : form.type === 'PURCHASE' ? 'Simpan Pembelian & Update Moving Avg' : 'Simpan Mutasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
