import { useState, useEffect } from 'react';
import {
  Send, Plus, Eye, Printer, X, Check, Trash2,
  Calendar, Store, Truck, FileText, AlertCircle, RefreshCw, UserCheck
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { PageHeader, LoadingState, AuditInfo, MiniCard, num, formatDateTime } from '../components/ui';
import { printElement } from '../utils/print';

export default function TransferBahan() {
  const [transfers, setTransfers] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const todayStr = new Date().toISOString().slice(0, 10);
  const [formData, setFormData] = useState({
    date: todayStr,
    source_outlet_id: '',
    destination_outlet_id: '',
    driver_name: '',
    vehicle_no: '',
    notes: '',
    items: [
      { ingredient_id: '', qty: '', unit: '', notes: '' }
    ]
  });

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [trfRes, outRes, ingRes] = await Promise.all([
        api.get('/transfers'),
        api.get('/outlets'),
        api.get('/ingredients')
      ]);
      setTransfers(trfRes.data);
      setOutlets(outRes.data);
      setIngredients(ingRes.data);

      const mainOut = outRes.data.find(o => o.is_main) || outRes.data[0];
      const otherOut = outRes.data.find(o => o.id !== mainOut?.id);
      if (mainOut) {
        setFormData(p => ({
          ...p,
          source_outlet_id: mainOut.id,
          destination_outlet_id: otherOut ? otherOut.id : '',
        }));
      }
    } catch {
      toast.error('Gagal memuat data transfer bahan');
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    const mainOut = outlets.find(o => o.is_main) || outlets[0];
    const otherOut = outlets.find(o => o.id !== mainOut?.id);
    const firstIng = ingredients[0];
    const defaultUnit = firstIng?.unit_beli || firstIng?.unit_pakai || 'gram';

    setFormData({
      date: new Date().toISOString().slice(0, 10),
      source_outlet_id: mainOut ? String(mainOut.id) : '',
      destination_outlet_id: otherOut ? String(otherOut.id) : '',
      driver_name: '',
      vehicle_no: '',
      notes: '',
      items: [
        {
          ingredient_id: firstIng ? firstIng.id : '',
          input_qty: '',
          input_unit: defaultUnit,
          qty: '',
          unit: firstIng ? firstIng.unit_pakai : 'gram',
          notes: ''
        }
      ]
    });
    setCreateModalOpen(true);
  }

  function handleAddItem() {
    const firstIng = ingredients[0];
    const defaultUnit = firstIng?.unit_beli || firstIng?.unit_pakai || 'gram';
    setFormData(p => ({
      ...p,
      items: [
        ...p.items,
        {
          ingredient_id: firstIng ? firstIng.id : '',
          input_qty: '',
          input_unit: defaultUnit,
          qty: '',
          unit: firstIng ? firstIng.unit_pakai : 'gram',
          notes: ''
        }
      ]
    }));
  }

  function handleRemoveItem(index) {
    if (formData.items.length <= 1) {
      toast.error('Transfer harus memiliki minimal 1 bahan!');
      return;
    }
    setFormData(p => ({
      ...p,
      items: p.items.filter((_, i) => i !== index)
    }));
  }

  function handleItemChange(index, field, value) {
    setFormData(p => {
      const newItems = [...p.items];
      const current = { ...newItems[index] };

      if (field === 'ingredient_id') {
        const ingId = Number(value);
        const selected = ingredients.find(i => i.id === ingId);
        const newUnit = selected?.unit_beli || selected?.unit_pakai || 'gram';
        current.ingredient_id = ingId;
        current.input_unit = newUnit;
        current.unit = selected ? selected.unit_pakai : 'gram';
        
        const ub = (selected?.unit_beli || '').trim();
        const factor = Number(selected?.konversi) || 1;
        const isConvertible = selected && ub && selected.unit_pakai && ub.toLowerCase() !== selected.unit_pakai.toLowerCase() && factor > 1;
        const isBeli = isConvertible && newUnit.toLowerCase() === ub.toLowerCase();
        current.qty = isBeli ? (Number(current.input_qty || 0) * factor) : Number(current.input_qty || 0);
      } else if (field === 'input_qty') {
        current.input_qty = value;
        const selected = ingredients.find(i => i.id === Number(current.ingredient_id));
        const ub = (selected?.unit_beli || '').trim();
        const factor = Number(selected?.konversi) || 1;
        const isConvertible = selected && ub && selected.unit_pakai && ub.toLowerCase() !== selected.unit_pakai.toLowerCase() && factor > 1;
        const isBeli = isConvertible && current.input_unit && current.input_unit.toLowerCase() === ub.toLowerCase();
        current.qty = isBeli ? (Number(value || 0) * factor) : Number(value || 0);
      } else if (field === 'input_unit') {
        current.input_unit = value;
        const selected = ingredients.find(i => i.id === Number(current.ingredient_id));
        const ub = (selected?.unit_beli || '').trim();
        const factor = Number(selected?.konversi) || 1;
        const isConvertible = selected && ub && selected.unit_pakai && ub.toLowerCase() !== selected.unit_pakai.toLowerCase() && factor > 1;
        const isBeli = isConvertible && value && value.toLowerCase() === ub.toLowerCase();
        current.qty = isBeli ? (Number(current.input_qty || 0) * factor) : Number(current.input_qty || 0);
      } else {
        current[field] = value;
      }

      newItems[index] = current;
      return { ...p, items: newItems };
    });
  }

  async function handleCreateTransfer(e) {
    e.preventDefault();
    if (!formData.source_outlet_id || !formData.destination_outlet_id) {
      toast.error('Pilih outlet pengirim dan outlet penerima!');
      return;
    }
    if (Number(formData.source_outlet_id) === Number(formData.destination_outlet_id)) {
      toast.error('Outlet pengirim dan penerima tidak boleh sama!');
      return;
    }

    // Validate items
    for (const it of formData.items) {
      if (!it.ingredient_id) {
        toast.error('Semua baris bahan harus dipilih!');
        return;
      }
      const valQty = Number(it.input_qty ?? it.qty);
      if (!valQty || valQty <= 0) {
        toast.error('Jumlah transfer bahan harus lebih besar dari 0!');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        source_outlet_id: Number(formData.source_outlet_id),
        destination_outlet_id: Number(formData.destination_outlet_id),
        items: formData.items.map(it => {
          const ing = ingredients.find(i => i.id === Number(it.ingredient_id));
          const ub = (ing?.unit_beli || '').trim();
          const up = (ing?.unit_pakai || '').trim();
          const factor = Number(ing?.konversi) || 1;
          const isConvertible = ub && up && ub.toLowerCase() !== up.toLowerCase() && factor > 1;
          const isBeli = isConvertible && it.input_unit && it.input_unit.toLowerCase() === ub.toLowerCase();
          const inputQ = Number(it.input_qty ?? it.qty);
          const baseQ = isBeli ? inputQ * factor : inputQ;

          return {
            ingredient_id: Number(it.ingredient_id),
            input_qty: inputQ,
            input_unit: it.input_unit || up || 'gram',
            qty: baseQ,
            unit: up || it.unit || 'gram',
            notes: it.notes || null,
          };
        })
      };

      const { data } = await api.post('/transfers', payload);
      setTransfers(prev => [data, ...prev]);
      setCreateModalOpen(false);
      toast.success(`Transfer bahan ${data.transfer_no} berhasil dikirim!`);
      // Open detail modal immediately for user convenience (can print right away)
      setSelectedTransfer(data);
      setDetailModalOpen(true);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) {
        Object.values(errors).flat().forEach(m => toast.error(m));
      } else {
        toast.error(err.response?.data?.message || 'Gagal membuat transfer bahan');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelTransfer(transfer) {
    if (transfer.status === 'CANCELLED') return;
    if (!window.confirm(`Apakah Anda yakin ingin membatalkan dokumen transfer "${transfer.transfer_no}"? Mutasi stok akan otomatis dikembalikan.`)) {
      return;
    }

    try {
      const { data } = await api.post(`/transfers/${transfer.id}/cancel`);
      setTransfers(prev => prev.map(t => (t.id === transfer.id ? data.transfer : t)));
      if (selectedTransfer?.id === transfer.id) {
        setSelectedTransfer(data.transfer);
      }
      toast.success(data.message || 'Transfer berhasil dibatalkan');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membatalkan transfer');
    }
  }

  function printDeliveryOrder() {
    printElement('printable-surat-jalan', `Surat Jalan Transfer - ${selectedTransfer?.transfer_no || ''}`);
  }

  if (loading) return <LoadingState />;

  const completedCount = transfers.filter(t => t.status === 'COMPLETED').length;
  const totalItemsCount = transfers.reduce((acc, t) => acc + (t.total_items || t.items?.length || 0), 0);

  return (
    <div className="fade-in">
      <PageHeader
        title="Transfer Bahan Baku Antar Cabang"
        subtitle="Distribusi dan mutasi pengiriman bahan baku dari gudang pusat ke cabang outlet dengan bukti surat jalan."
        action={
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Send size={15} /> Buat Transfer Bahan
          </button>
        }
      />

      {/* Stats Cards */}
      <div className="grid-3 mb-6">
        <MiniCard
          label="Total Dokumen Transfer"
          value={`${transfers.length} Pengiriman`}
          color="var(--accent)"
        />
        <MiniCard
          label="Transfer Selesai / Terkirim"
          value={`${completedCount} Dokumen`}
          color="var(--ok)"
        />
        <MiniCard
          label="Total Macam Bahan Terdistribusi"
          value={`${totalItemsCount} Alokasi Bahan`}
          color="var(--accent-bright)"
        />
      </div>

      {/* Transfers List Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Riwayat Dokumen Transfer Bahan Baku</div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Menampilkan <strong>{transfers.length}</strong> riwayat transfer
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 145 }}>No. Surat Jalan</th>
                <th style={{ width: 100 }}>Tanggal</th>
                <th style={{ minWidth: 160 }}>Dari (Pengirim)</th>
                <th style={{ minWidth: 160 }}>Ke (Penerima)</th>
                <th style={{ minWidth: 200 }}>Rincian Bahan Baku</th>
                <th style={{ minWidth: 130 }}>Kurir / Supir</th>
                <th style={{ width: 95 }} className="center">Status</th>
                <th style={{ minWidth: 160 }}>Riwayat Audit</th>
                <th style={{ width: 120 }} className="center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                    Belum ada riwayat transfer bahan baku. Klik tombol "Buat Transfer Bahan" di atas.
                  </td>
                </tr>
              ) : (
                transfers.map(trf => {
                  const isCancelled = trf.status === 'CANCELLED';
                  return (
                    <tr key={trf.id} style={{ opacity: isCancelled ? 0.6 : 1 }}>
                      <td className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                        {trf.transfer_no}
                      </td>
                      <td className="mono" style={{ fontSize: 12.5 }}>
                        {trf.date}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          <Store size={13} color="var(--text-muted)" />
                          <span style={{ fontWeight: 500 }}>{trf.source_outlet?.name || 'Gudang Pusat'}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          <Store size={13} color="var(--accent-bright)" />
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {trf.destination_outlet?.name || 'Cabang Outlet'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>
                          <span style={{ fontWeight: 600, color: 'var(--accent-bright)' }}>
                            {trf.items?.length || trf.total_items} macam bahan:
                          </span>{' '}
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {trf.items?.map(it => {
                              const hasConv = it.input_unit && it.unit && it.input_unit !== it.unit && it.input_qty;
                              return hasConv
                                ? `${it.ingredient?.name || 'Bahan'} (${num(it.input_qty)} ${it.input_unit} ≈ ${num(it.qty)} ${it.unit})`
                                : `${it.ingredient?.name || 'Bahan'} (${num(it.input_qty || it.qty)} ${it.input_unit || it.unit})`;
                            }).join(', ') || '—'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>
                          {trf.driver_name ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Truck size={12} color="var(--text-muted)" />
                              <span>{trf.driver_name} {trf.vehicle_no && `(${trf.vehicle_no})`}</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Kurir Internal / —</span>
                          )}
                        </div>
                      </td>
                      <td className="center">
                        {isCancelled ? (
                          <span className="pill pill-danger" style={{ fontSize: 10.5 }}>BATAL</span>
                        ) : (
                          <span className="pill pill-ok" style={{ fontSize: 10.5 }}>SELESAI</span>
                        )}
                      </td>
                      <td>
                        <AuditInfo
                          createdAt={trf.created_at}
                          createdBy={trf.created_by_name}
                          updatedAt={trf.updated_at}
                          updatedBy={trf.updated_by_name}
                        />
                      </td>
                      <td className="center">
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setSelectedTransfer(trf);
                              setDetailModalOpen(true);
                            }}
                            title="Lihat & Cetak Surat Jalan"
                            style={{ padding: '4px 8px' }}
                          >
                            <Eye size={13} />
                          </button>
                          {!isCancelled && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleCancelTransfer(trf)}
                              title="Batalkan Dokumen Transfer"
                              style={{ padding: '4px 8px', color: 'var(--danger)' }}
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Buat Transfer Bahan */}
      {createModalOpen && (
        <div className="modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div
            className="modal-content card"
            style={{ maxWidth: 750, width: '100%', margin: '20px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Send size={18} color="var(--accent-bright)" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                  Form Transfer Bahan Baku ke Cabang
                </h3>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setCreateModalOpen(false)}
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer}>
              {/* Source & Destination */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">Dari (Outlet Pengirim) *</label>
                  <select
                    className="form-control"
                    value={formData.source_outlet_id || ''}
                    onChange={e => {
                      const newSource = e.target.value;
                      setFormData(p => {
                        let newDest = p.destination_outlet_id;
                        if (String(newDest) === String(newSource)) {
                          const alt = outlets.find(o => String(o.id) !== String(newSource));
                          newDest = alt ? String(alt.id) : '';
                        }
                        return { ...p, source_outlet_id: newSource, destination_outlet_id: newDest };
                      });
                    }}
                    required
                  >
                    <option value="" disabled>-- Pilih Pengirim --</option>
                    {outlets.map(o => (
                      <option
                        key={o.id}
                        value={o.id}
                        disabled={String(o.id) === String(formData.destination_outlet_id)}
                        style={{ background: '#11162d', color: String(o.id) === String(formData.destination_outlet_id) ? 'var(--text-muted)' : '#ffffff' }}
                      >
                        {o.name} {o.is_main ? '(Pusat)' : ''} {String(o.id) === String(formData.destination_outlet_id) ? '— [Dipilih sbg Penerima]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Ke (Cabang Penerima) *</label>
                  <select
                    className="form-control"
                    value={formData.destination_outlet_id || ''}
                    onChange={e => {
                      const newDest = e.target.value;
                      setFormData(p => {
                        let newSource = p.source_outlet_id;
                        if (String(newSource) === String(newDest)) {
                          const alt = outlets.find(o => String(o.id) !== String(newDest));
                          newSource = alt ? String(alt.id) : '';
                        }
                        return { ...p, source_outlet_id: newSource, destination_outlet_id: newDest };
                      });
                    }}
                    required
                  >
                    <option value="" disabled>-- Pilih Penerima --</option>
                    {outlets.map(o => (
                      <option
                        key={o.id}
                        value={o.id}
                        disabled={String(o.id) === String(formData.source_outlet_id)}
                        style={{ background: '#11162d', color: String(o.id) === String(formData.source_outlet_id) ? 'var(--text-muted)' : '#ffffff' }}
                      >
                        {o.name} {o.is_main ? '(Pusat)' : ''} {String(o.id) === String(formData.source_outlet_id) ? '— [Dipilih sbg Pengirim]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Logistics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Tanggal Pengiriman *</label>
                  <input
                    type="date"
                    className="form-control mono"
                    value={formData.date}
                    onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Supir / Kurir Pengantar</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Nama Supir / Kurir"
                    value={formData.driver_name}
                    onChange={e => setFormData(p => ({ ...p, driver_name: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">No. Kendaraan</label>
                  <input
                    type="text"
                    className="form-control mono"
                    placeholder="DD 1234 XX"
                    value={formData.vehicle_no}
                    onChange={e => setFormData(p => ({ ...p, vehicle_no: e.target.value }))}
                  />
                </div>
              </div>

              {/* Ingredients List */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 16
                }}
              >
                <div className="flex-between mb-3">
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Daftar Bahan Baku yang Ditransfer ({formData.items.length})
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11.5, padding: '3px 8px' }}
                    onClick={handleAddItem}
                  >
                    <Plus size={13} /> Tambah Bahan
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {formData.items.map((item, idx) => {
                    const selIng = ingredients.find(i => i.id === Number(item.ingredient_id));
                    const ub = (selIng?.unit_beli || '').trim();
                    const up = (selIng?.unit_pakai || '').trim();
                    const factor = Number(selIng?.konversi) || 1;
                    const isConvertible = Boolean(ub && up && ub.toLowerCase() !== up.toLowerCase() && factor > 1);
                    const isUsingUnitBeli = isConvertible && item.input_unit && item.input_unit.toLowerCase() === ub.toLowerCase();
                    const liveBaseQty = isUsingUnitBeli ? (Number(item.input_qty || 0) * factor) : Number(item.input_qty || item.qty || 0);

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 12px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border-soft)',
                          borderRadius: 8
                        }}
                      >
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1.1fr 1.3fr 1.4fr 36px',
                            gap: 8,
                            alignItems: 'center',
                          }}
                        >
                          {/* Ingredient Select */}
                          <select
                            className="form-control"
                            style={{ padding: '6px 8px', fontSize: 12.5 }}
                            value={item.ingredient_id}
                            onChange={e => handleItemChange(idx, 'ingredient_id', e.target.value)}
                            required
                          >
                            {ingredients.map(ing => (
                              <option key={ing.id} value={ing.id} style={{ background: '#11162d', color: '#ffffff' }}>
                                {ing.code} - {ing.name} ({ing.category})
                              </option>
                            ))}
                          </select>

                          {/* Qty Input */}
                          <input
                            type="number"
                            step="any"
                            className="form-control mono right"
                            style={{ padding: '6px 8px', fontSize: 12.5 }}
                            placeholder="Jumlah"
                            value={item.input_qty ?? item.qty}
                            onChange={e => handleItemChange(idx, 'input_qty', e.target.value)}
                            required
                          />

                          {/* Unit Selector or Non-Convertible Fixed Badge */}
                          {isConvertible ? (
                            <select
                              className="form-control"
                              style={{
                                padding: '6px 8px',
                                fontSize: 12,
                                fontWeight: 600,
                                background: 'var(--bg-card)',
                                borderColor: 'var(--accent)',
                                color: 'var(--accent-bright)'
                              }}
                              value={item.input_unit || ub}
                              onChange={e => handleItemChange(idx, 'input_unit', e.target.value)}
                            >
                              <option value={ub} style={{ background: '#11162d', color: '#ffffff' }}>
                                {ub} ({factor}x)
                              </option>
                              <option value={up} style={{ background: '#11162d', color: '#ffffff' }}>
                                {up} (Satuan Terkecil)
                              </option>
                            </select>
                          ) : (
                            <div
                              className="pill pill-muted mono"
                              style={{
                                fontSize: 11.5,
                                textAlign: 'center',
                                padding: '6px 8px',
                                border: '1px solid var(--border-soft)',
                                color: 'var(--text-secondary)'
                              }}
                              title="Satuan paten (tidak dapat dikonversi)"
                            >
                              {up || ub || 'pcs'}
                            </div>
                          )}

                          {/* Item Notes */}
                          <input
                            type="text"
                            className="form-control"
                            style={{ padding: '6px 8px', fontSize: 12 }}
                            placeholder="Catatan bahan"
                            value={item.notes}
                            onChange={e => handleItemChange(idx, 'notes', e.target.value)}
                          />

                          {/* Remove button */}
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            style={{ padding: 4, color: 'var(--danger)' }}
                            onClick={() => handleRemoveItem(idx)}
                            disabled={formData.items.length <= 1}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Live Conversion Subtext */}
                        {isConvertible && isUsingUnitBeli && Number(item.input_qty) > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              marginTop: 6,
                              padding: '4px 8px',
                              borderRadius: 4,
                              background: 'rgba(99, 102, 241, 0.12)',
                              border: '1px dashed var(--accent)',
                              fontSize: 11.5,
                              color: 'var(--accent-bright)',
                              width: 'fit-content'
                            }}
                          >
                            <span>⚡ Otomatis terkonversi ke satuan terkecil:</span>
                            <strong>{num(liveBaseQty)} {up}</strong>
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                              (1 {ub} = {num(factor)} {up})
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* General Note */}
              <div className="form-group mb-4">
                <label className="form-label">Keterangan / Alasan Transfer (Opsional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: Stok menipis di cabang / persiapan akhir pekan"
                  value={formData.notes}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                />
              </div>

              <div className="flex-between">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Mengirim...' : (
                    <>
                      <Check size={14} /> Kirim & Cetak Surat Jalan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail & Surat Jalan (Print-Friendly) */}
      {detailModalOpen && selectedTransfer && (
        <div className="modal-backdrop" onClick={() => setDetailModalOpen(false)}>
          <div
            className="modal-content card"
            style={{ maxWidth: 680, width: '100%', margin: '20px', maxHeight: '92vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Actions Header */}
            <div className="flex-between mb-4 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="var(--accent-bright)" />
                <span style={{ fontSize: 15, fontWeight: 700 }}>
                  Surat Jalan Transfer Bahan — {selectedTransfer.transfer_no}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={printDeliveryOrder}
                >
                  <Printer size={13} /> Cetak Surat Jalan
                </button>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => setDetailModalOpen(false)}
                  style={{ padding: 4 }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Printable Delivery Order Content */}
            <div
              id="printable-surat-jalan"
              style={{
                padding: '20px 24px',
                background: '#ffffff',
                color: '#1e293b',
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}
            >
              {/* Header Surat Jalan */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 14, marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#1e1b4b', letterSpacing: '-0.02em' }}>
                    MOVA POS — KITCHEN & INVENTORY
                  </div>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    Sistem Kontrol Gramasi & Distribusi Bahan Baku Antar Cabang
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#4f46e5' }}>
                    SURAT JALAN TRANSFER
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                    {selectedTransfer.transfer_no}
                  </div>
                </div>
              </div>

              {/* Meta Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 12.5, marginBottom: 16 }}>
                <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                    Pengirim (Outlet Asal)
                  </div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>
                    {selectedTransfer.source_outlet?.name || 'Gudang Pusat'}
                  </div>
                  <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>
                    PIC: {selectedTransfer.source_outlet?.pic_name || 'Kepala Gudang'} · Telp: {selectedTransfer.source_outlet?.phone || '—'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11.5, marginTop: 2 }}>
                    {selectedTransfer.source_outlet?.address || 'Makassar'}
                  </div>
                </div>

                <div style={{ padding: '10px 12px', background: '#eef2ff', borderRadius: 6, border: '1px solid #c7d2fe' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', marginBottom: 4 }}>
                    Penerima (Cabang Tujuan)
                  </div>
                  <div style={{ fontWeight: 700, color: '#1e1b4b', fontSize: 13.5 }}>
                    {selectedTransfer.destination_outlet?.name || 'Cabang Tujuan'}
                  </div>
                  <div style={{ color: '#334155', fontSize: 12, marginTop: 2 }}>
                    PIC: {selectedTransfer.destination_outlet?.pic_name || 'Store Manager'} · Telp: {selectedTransfer.destination_outlet?.phone || '—'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11.5, marginTop: 2 }}>
                    {selectedTransfer.destination_outlet?.address || 'Makassar'}
                  </div>
                </div>
              </div>

              {/* Delivery Logistics */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#334155', padding: '6px 12px', background: '#f1f5f9', borderRadius: 6, marginBottom: 14 }}>
                <div><strong>Tanggal Kirim:</strong> {selectedTransfer.date}</div>
                <div><strong>Supir / Kurir:</strong> {selectedTransfer.driver_name || 'Kurir Internal'}</div>
                <div><strong>No. Kendaraan:</strong> {selectedTransfer.vehicle_no || '—'}</div>
                <div><strong>Status:</strong> <span style={{ fontWeight: 700, color: selectedTransfer.status === 'CANCELLED' ? '#ef4444' : '#16a34a' }}>{selectedTransfer.status}</span></div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 20 }}>
                <thead>
                  <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 40 }}>No</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', width: 85 }}>Kode</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Nama Bahan Baku</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: 100 }}>Jumlah</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', width: 80 }}>Satuan</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: 130 }}>Konversi Stok</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTransfer.items?.map((it, idx) => {
                    const hasConv = it.input_unit && it.unit && it.input_unit !== it.unit;
                    return (
                      <tr key={it.id || idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600, color: '#4f46e5' }}>
                          {it.ingredient?.code || 'BB-XXX'}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>
                          {it.ingredient?.name || 'Bahan'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                          {num(it.input_qty || it.qty)}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#0f172a', fontWeight: 600 }}>
                          {it.input_unit || it.unit}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: hasConv ? '#4f46e5' : '#64748b', fontSize: 12 }}>
                          {hasConv ? `${num(it.qty)} ${it.unit}` : '— (Tetap)'}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#64748b', fontSize: 11.5 }}>
                          {it.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Notes */}
              {selectedTransfer.notes && (
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 20, padding: '6px 10px', background: '#f8fafc', borderRadius: 4, borderLeft: '3px solid #4f46e5' }}>
                  <strong>Catatan Khusus:</strong> {selectedTransfer.notes}
                </div>
              )}

              {/* Signatures */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 24, textAlign: 'center', fontSize: 12 }}>
                <div>
                  <div style={{ color: '#64748b', marginBottom: 45 }}>Diserahkan Oleh,</div>
                  <div style={{ fontWeight: 700, borderTop: '1px solid #94a3b8', paddingTop: 4, color: '#0f172a' }}>
                    ( {selectedTransfer.source_outlet?.pic_name || 'Petugas Gudang'} )
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Pengirim / Gudang Pusat</div>
                </div>

                <div>
                  <div style={{ color: '#64748b', marginBottom: 45 }}>Dibawa / Diantar Oleh,</div>
                  <div style={{ fontWeight: 700, borderTop: '1px solid #94a3b8', paddingTop: 4, color: '#0f172a' }}>
                    ( {selectedTransfer.driver_name || 'Kurir / Driver'} )
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Ekspedisi / Pengantar</div>
                </div>

                <div>
                  <div style={{ color: '#64748b', marginBottom: 45 }}>Diterima Oleh,</div>
                  <div style={{ fontWeight: 700, borderTop: '1px solid #94a3b8', paddingTop: 4, color: '#0f172a' }}>
                    ( {selectedTransfer.destination_outlet?.pic_name || 'Store Manager Cabang'} )
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Cabang Outlet Penerima</div>
                </div>
              </div>
            </div>

            {/* Print CSS styles */}
            <style>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                #printable-surat-jalan, #printable-surat-jalan * {
                  visibility: visible;
                }
                #printable-surat-jalan {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  box-shadow: none !important;
                }
              }
            `}</style>
          </div>
        </div>
      )}
    </div>
  );
}
