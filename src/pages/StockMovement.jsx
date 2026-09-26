import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Filter, Store, TrendingUp, TrendingDown, Sparkles, Calculator, X, ShoppingBag, CheckCircle2, Clock } from 'lucide-react';
import api from '../api/client';
import { num, rupiah, fmtQtyVal, LoadingState, PageHeader, AuditInfo, PeriodPicker } from '../components/ui';
import { getTodayStr, getMonthStartStr, getMonthEndStr } from '../utils/date';
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

export default function StockMovement({ defaultFilterType }) {
  const [searchParams] = useSearchParams();
  const initialType = defaultFilterType || searchParams.get('type') || 'ALL';
  const [movements, setMovements] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterIng, setFilterIng] = useState('ALL');
  const [filterType, setFilterType] = useState(initialType);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    activeOutletId,
    activeOutlet,
    isOwnerBisnis,
    isPlatformAdmin,
    canSwitchOutlet,
    outlets,
    currentUser,
    userOutletName,
    dateRange: period,
  } = useOutlet();

  const filterOutlet = useMemo(() => {
    if (!canSwitchOutlet) {
      return String(currentUser?.outlet_id || activeOutletId || 'ALL');
    }
    if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
      return String(activeOutletId);
    }
    return 'ALL';
  }, [canSwitchOutlet, currentUser?.outlet_id, activeOutletId]);

  const [supplierList, setSupplierList] = useState([]);
  const [form, setForm] = useState({
    ingredient_id: '',
    outlet_id: activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : '1',
    type: 'PURCHASE',
    payment_type: 'CASH',
    supplier_name: '',
    purchase_no: '',
    due_date: '',
    initial_paid: '',
    payment_method: 'CASH',
    waste_reason: 'SPOILED',
    unit_type: 'BELI', // 'BELI' or 'PAKAI'
    unit_price: '',
    total_price: '',
    qty: '',
    date: getTodayStr(),
    note: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
    fetchSuppliers();
  }, [filterIng, filterType, filterOutlet, period]);

  async function fetchSuppliers() {
    try {
      const { data } = await api.get('/payables/suppliers');
      setSupplierList(data || []);
    } catch {}
  }

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

  // Smart two-way calculation for Qty, Total Price, and Unit Price (auto-divide)
  function handleQtyChange(val) {
    const q = val;
    setForm(prev => {
      const numQ = parseFloat(q) || 0;
      let newUnitPrice = prev.unit_price;
      let newTotalPrice = prev.total_price;

      if (numQ > 0) {
        if (prev.total_price !== '' && !isNaN(Number(prev.total_price))) {
          // If total_price was entered, automatically divide by qty to calculate unit_price
          newUnitPrice = Number((parseFloat(prev.total_price) / numQ).toFixed(2));
        } else if (prev.unit_price !== '' && !isNaN(Number(prev.unit_price))) {
          // If unit_price was entered, multiply by qty to calculate total_price
          newTotalPrice = Math.round(numQ * parseFloat(prev.unit_price));
        }
      }

      return {
        ...prev,
        qty: q,
        unit_price: newUnitPrice,
        total_price: newTotalPrice,
      };
    });
  }

  function handleTotalPriceChange(val) {
    const tot = val;
    setForm(prev => {
      const numTot = parseFloat(tot) || 0;
      const numQ = parseFloat(prev.qty) || 0;
      let newUnitPrice = prev.unit_price;

      if (numQ > 0 && tot !== '') {
        // Automatically divide total by qty
        newUnitPrice = Number((numTot / numQ).toFixed(2));
      } else if (tot === '') {
        newUnitPrice = '';
      }

      return {
        ...prev,
        total_price: tot,
        unit_price: newUnitPrice,
      };
    });
  }

  function handleUnitPriceChange(val) {
    const up = val;
    setForm(prev => {
      const numUp = parseFloat(up) || 0;
      const numQ = parseFloat(prev.qty) || 0;
      let newTotalPrice = prev.total_price;

      if (numQ > 0 && up !== '') {
        newTotalPrice = Math.round(numQ * numUp);
      } else if (up === '') {
        newTotalPrice = '';
      }

      return {
        ...prev,
        unit_price: up,
        total_price: newTotalPrice,
      };
    });
  }

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

    const totalBeliValue = form.total_price !== '' && !isNaN(Number(form.total_price))
      ? Number(form.total_price)
      : (incomingQtyPakai / conversion) * incomingPriceBeli;

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
  }, [selectedIng, form.type, form.qty, form.unit_price, form.total_price, form.unit_type, conversion, isUnitBeli]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.qty) { toast.error('Qty tidak boleh kosong'); return; }
    if (form.type === 'PURCHASE' && form.payment_type === 'HUTANG' && !form.supplier_name?.trim()) {
      toast.error('Harap masukkan nama supplier untuk transaksi hutang/tempo');
      return;
    }
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
        total_price: form.type === 'PURCHASE' && form.total_price !== '' ? Number(form.total_price) : null,
        payment_type: form.type === 'PURCHASE' ? (form.payment_type || 'CASH') : undefined,
        supplier_name: (form.type === 'PURCHASE' && form.payment_type === 'HUTANG') ? form.supplier_name : undefined,
        purchase_no: (form.type === 'PURCHASE' && form.purchase_no) ? form.purchase_no : undefined,
        due_date: (form.type === 'PURCHASE' && form.payment_type === 'HUTANG') ? (form.due_date || undefined) : undefined,
        initial_paid: (form.type === 'PURCHASE' && form.payment_type === 'HUTANG' && form.initial_paid !== '') ? Number(form.initial_paid) : undefined,
        payment_method: (form.type === 'PURCHASE' && form.payment_type === 'HUTANG') ? (form.payment_method || 'CASH') : undefined,
        note: form.note,
        outlet_id: targetOutlet,
        waste_reason: form.type === 'WASTE' ? form.waste_reason : null,
      };

      const { data } = await api.post('/movements', payload);
      setMovements(prev => [data, ...prev]);
      setForm(f => ({
        ...f,
        qty: '',
        total_price: '',
        note: '',
        payment_type: 'CASH',
        supplier_name: '',
        purchase_no: '',
        due_date: '',
        initial_paid: '',
      }));
      setIsModalOpen(false);
      toast.success(
        form.type === 'PURCHASE'
          ? (form.payment_type === 'HUTANG'
              ? `Pembelian tempo berhasil dicatat & masuk ke Buku Hutang Supplier!`
              : `Pembelian berhasil! Harga rata-rata bergerak terupdate: ${rupiah(data.cost_after * conversion)}/${selectedIng?.unit_beli}`)
          : form.type === 'WASTE' ? 'Catatan kerusakan bahan (waste) disimpan' : 'Pergerakan stok dicatat'
      );
      // Refresh ingredients to get updated harga and stock
      fetchAll();
      fetchSuppliers();
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
        title={filterType === 'PURCHASE' ? "Laporan Pembelian Bahan & Barang" : "Stock Movement & Waste Log"}
        subtitle={filterType === 'PURCHASE' ? "Ledger & rekapitulasi riwayat pembelian stok bahan baku, update moving average, supplier, dan metode pembayaran." : "Ledger seluruh mutasi stok bahan baku: pembelian, pemakaian penjualan (POS), pencatatan kerusakan/waste terpisah, transfer, dan adjustment."}
        rightContent={
          <button
            onClick={() => {
              if (filterType === 'PURCHASE') {
                setForm(f => ({ ...f, type: 'PURCHASE' }));
              }
              setIsModalOpen(true);
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
          >
            <Plus size={16} />
            {filterType === 'PURCHASE' ? 'Catat Pembelian Baru' : 'Catat Pergerakan Manual'}
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
              <select className="form-control" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}
                value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="ALL">Semua Tipe</option>
                <option value="WASTE">Hanya Waste</option>
                <option value="PURCHASE">Pembelian (Moving Avg)</option>
                <option value="SALE_USAGE">Pemakaian POS</option>
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
                    Alasan Kerusakan / Waste
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
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Jumlah Qty {form.type === 'PURCHASE' ? 'Pembelian' : `(${selectedIng?.unit_pakai || 'satuan'})`}
                </label>
                {form.type === 'PURCHASE' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8 }}>
                    <input
                      type="number"
                      className="form-control mono"
                      min="0.001"
                      step="any"
                      placeholder="Contoh: 5"
                      value={form.qty}
                      onChange={e => handleQtyChange(e.target.value)}
                      required
                    />
                    <select
                      className="form-control"
                      value={form.unit_type}
                      onChange={e => {
                        const newUnit = e.target.value;
                        setForm(f => {
                          const basePrice = selectedIng
                            ? (newUnit === 'BELI' ? selectedIng.harga : Number((selectedIng.harga / (selectedIng.konversi || 1)).toFixed(2)))
                            : f.unit_price;
                          const numQ = parseFloat(f.qty) || 0;
                          return {
                            ...f,
                            unit_type: newUnit,
                            unit_price: basePrice,
                            total_price: numQ > 0 && basePrice ? Math.round(numQ * basePrice) : f.total_price,
                          };
                        });
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

              {/* PURCHASE ONLY: Total Price & Unit Price (Langsung Dibagi) */}
              {form.type === 'PURCHASE' && (
                <div className="form-group fade-in" style={{
                  background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.4) 0%, rgba(16, 185, 129, 0.1) 100%)',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  marginBottom: 16
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {/* Input 1: TOTAL HARGA NOTA (LANGSUNG DARI STRUK / BON BELANJA) */}
                    <div>
                      <label className="form-label" style={{ color: '#34d399', fontWeight: 800, fontSize: 12.5, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                        Total Harga Nota (Rp)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="form-control mono"
                        style={{ fontSize: 14, fontWeight: 800, borderColor: 'rgba(16, 185, 129, 0.5)', background: 'rgba(0,0,0,0.25)', color: '#34d399' }}
                        placeholder="Total di bon (misal: 150000)"
                        value={form.total_price}
                        onChange={e => handleTotalPriceChange(e.target.value)}
                      />
                      <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 3, display: 'block' }}>
                        Ketik total belanja di bon/nota kasir.
                      </span>
                    </div>

                    {/* Input 2: HARGA SATUAN (OTOMATIS DIBAGI DARI TOTAL ÷ QTY) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label className="form-label" style={{ color: '#60a5fa', fontWeight: 800, fontSize: 12.5, margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Calculator size={14} /> Harga Satuan (Rp)
                        </label>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          per {form.unit_type === 'BELI' ? selectedIng?.unit_beli : selectedIng?.unit_pakai}
                        </span>
                      </div>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="form-control mono"
                        style={{ fontSize: 14, fontWeight: 800, borderColor: 'rgba(96, 165, 250, 0.5)', background: 'rgba(0,0,0,0.25)', color: '#60a5fa' }}
                        placeholder="Hasil bagi otomatis..."
                        value={form.unit_price}
                        onChange={e => handleUnitPriceChange(e.target.value)}
                      />
                      <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 3, display: 'block' }}>
                        Otomatis terhitung: Total ÷ Qty.
                      </span>
                    </div>
                  </div>

                  {/* Visual calculation formula banner */}
                  {Number(form.qty) > 0 && (Number(form.total_price) > 0 || Number(form.unit_price) > 0) && (
                    <div style={{
                      marginTop: 12,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.35)',
                      border: '1px dashed rgba(52, 211, 153, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      flexWrap: 'wrap',
                      gap: 6
                    }}>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        💡 Hasil Bagi: <strong style={{ color: '#34d399' }}>{rupiah(form.total_price || (Number(form.qty) * Number(form.unit_price)))}</strong> ÷ <strong style={{ color: '#ffffff' }}>{form.qty} {form.unit_type === 'BELI' ? selectedIng?.unit_beli : selectedIng?.unit_pakai}</strong> =
                      </div>
                      <div className="mono" style={{ fontWeight: 800, color: '#60a5fa', fontSize: 13 }}>
                        {rupiah(form.unit_price || (Number(form.total_price) / Number(form.qty)))} / {form.unit_type === 'BELI' ? selectedIng?.unit_beli : selectedIng?.unit_pakai}
                      </div>
                    </div>
                  )}

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

                  {/* Pilihan Metode Bayar: LUNAS vs HUTANG */}
                  <div style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 10,
                    background: form.payment_type === 'HUTANG' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.06)',
                    border: `1px solid ${form.payment_type === 'HUTANG' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.3)'}`
                  }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: form.payment_type === 'HUTANG' ? '#f87171' : '#34d399', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <ShoppingBag size={14} /> Tipe Pembayaran Pembelian:
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setForm(f => ({ ...f, payment_type: 'CASH' }))}
                        style={{
                          padding: '6px 8px',
                          fontSize: 11.5,
                          fontWeight: 700,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          background: form.payment_type !== 'HUTANG' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                          border: form.payment_type !== 'HUTANG' ? '1.5px solid #10b981' : '1px solid var(--border)',
                          color: form.payment_type !== 'HUTANG' ? '#34d399' : 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        <CheckCircle2 size={13} />
                        <span>Lunas Tunai</span>
                      </button>

                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          const defaultDue = new Date();
                          defaultDue.setDate(defaultDue.getDate() + 30);
                          const dueStr = defaultDue.toISOString().slice(0, 10);
                          setForm(f => ({ ...f, payment_type: 'HUTANG', due_date: f.due_date || dueStr }));
                        }}
                        style={{
                          padding: '6px 8px',
                          fontSize: 11.5,
                          fontWeight: 700,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          background: form.payment_type === 'HUTANG' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.03)',
                          border: form.payment_type === 'HUTANG' ? '1.5px solid #ef4444' : '1px solid var(--border)',
                          color: form.payment_type === 'HUTANG' ? '#f87171' : 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        <Clock size={13} />
                        <span>Hutang Supplier (Tempo)</span>
                      </button>
                    </div>

                    {form.payment_type === 'HUTANG' && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(239,68,68,0.3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <label className="form-label" style={{ fontSize: 11, color: '#fca5a5' }}>Nama Supplier *</label>
                            <input
                              type="text"
                              list="mvt-supplier-options"
                              className="form-control"
                              style={{ fontSize: 12 }}
                              placeholder="Pilih/ketik..."
                              value={form.supplier_name || ''}
                              onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
                              required={form.payment_type === 'HUTANG'}
                            />
                            <datalist id="mvt-supplier-options">
                              {supplierList.map((s, idx) => (
                                <option key={idx} value={s.name} />
                              ))}
                            </datalist>
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>No. Faktur / Bon</label>
                            <input
                              type="text"
                              className="form-control mono"
                              style={{ fontSize: 12 }}
                              placeholder="INV-..."
                              value={form.purchase_no || ''}
                              onChange={e => setForm(f => ({ ...f, purchase_no: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <label className="form-label" style={{ fontSize: 11, color: '#fca5a5' }}>Jatuh Tempo *</label>
                            <input
                              type="date"
                              className="form-control mono"
                              style={{ fontSize: 12 }}
                              value={form.due_date || ''}
                              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                              required={form.payment_type === 'HUTANG'}
                            />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>DP (Uang Muka)</label>
                            <input
                              type="number"
                              min="0"
                              className="form-control mono"
                              style={{ fontSize: 12 }}
                              placeholder="Rp 0"
                              value={form.initial_paid || ''}
                              onChange={e => setForm(f => ({ ...f, initial_paid: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
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
