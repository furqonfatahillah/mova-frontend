import { useState, useEffect } from 'react';
import api from '../api/client';
import { num, pct, rupiah, StatusPill, LoadingState, PeriodPicker, PageHeader, MiniCard } from '../components/ui';
import { getWasteReason } from './StockMovement';
import { AlertCircle, Trash2, HelpCircle, Layers, Eye, Store, FileSpreadsheet, Printer, X, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import { exportVarianceBahanToExcel } from '../utils/exportReport';
import { printElement } from '../utils/print';

export default function VarianceBahan() {
  const [varData, setVarData] = useState([]);
  const [drill, setDrill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('cost_control'); // 'standard' | 'cost_control'
  const [showReportModal, setShowReportModal] = useState(false);

  const { activeOutletId, activeOutlet, currentBusiness, dateRange: period } = useOutlet();
  const currentUser = JSON.parse(localStorage.getItem('pos_user') || '{}');
  const businessName = currentBusiness?.name || currentUser?.business?.name || 'MOVA POS F&B Management';
  const outletName = (activeOutlet && activeOutletId !== 'ALL' && activeOutletId !== 'all') ? activeOutlet.name : 'Semua Cabang (Konsolidasi)';

  useEffect(() => { fetchData(); }, [period, activeOutletId]);

  async function fetchData() {
    setLoading(true);
    try {
      const targetOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : undefined;
      const { data } = await api.get('/reports/variance/ingredients', {
        params: { from: period.from, to: period.to, outlet_id: targetOutlet }
      });
      setVarData(data);
    } catch { toast.error('Gagal memuat data'); }
    finally { setLoading(false); }
  }

  async function handleExportExcel() {
    try {
      const fname = await exportVarianceBahanToExcel({
        varData,
        period,
        outletName,
        businessName,
        userName: currentUser?.name || 'Administrator',
      });
      toast.success(`Laporan Audit Variansi Excel berhasil diunduh: ${fname}`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengekspor laporan ke Excel');
    }
  }

  function handlePrintPdf() {
    printElement(
      'printable-variance-bahan-report',
      `Laporan Audit Variansi Bahan - ${period.from} sd ${period.to}`,
      { orientation: 'landscape', margin: '8mm 8mm' }
    );
  }

  const drillData = drill ? varData.find(iv => iv.ingredient?.id === drill) : null;

  // Aggregate totals
  const totalWasteLoss = varData.reduce((acc, iv) => acc + (iv.waste_value || 0), 0);
  const totalUnaccountedLoss = varData.reduce((acc, iv) => acc + (iv.unaccounted_value > 0 ? iv.unaccounted_value : 0), 0);
  const totalGrossLoss = totalWasteLoss + totalUnaccountedLoss;

  if (loading) return <LoadingState />;

  return (
    <div className="fade-in">
      <div className="flex-between mb-4 flex-wrap gap-3">
        <PageHeader
          title="Variance per Bahan Baku"
          subtitle="Modul Cost Control: Pemisahan tegas antara Waste/Kerusakan bahan tercatat vs Selisih murni tak terjelaskan."
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 3 }}>
            <button
              className={`btn btn-sm ${viewMode === 'cost_control' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('cost_control')}
              style={{ fontSize: 12, padding: '5px 12px' }}
            >
              <Layers size={13} /> Pemisahan Waste
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'standard' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('standard')}
              style={{ fontSize: 12, padding: '5px 12px' }}
            >
              <Eye size={13} /> Mode Ringkas
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderColor: 'rgba(16, 185, 129, 0.4)',
                color: '#34d399',
                background: 'rgba(16, 185, 129, 0.08)',
                fontWeight: 600
              }}
              onClick={handleExportExcel}
              title="Unduh Audit Variansi Bahan ke format Excel (.xlsx)"
            >
              <FileSpreadsheet size={15} /> Export Excel
            </button>
            <button
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
              onClick={() => setShowReportModal(true)}
              title="Pratinjau laporan audit & unduh / cetak sebagai PDF (Landscape A4)"
            >
              <Printer size={15} /> Unduh PDF / Cetak
            </button>
          </div>
        </div>
      </div>

      {/* Cost Control Top Metric Strip */}
      <div className="grid-3 gap-3 mb-4">
        <div className="card" style={{ padding: '12px 16px', background: 'rgba(251, 146, 60, 0.08)', border: '1px solid rgba(251, 146, 60, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#fb923c', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trash2 size={14} /> Kerugian Waste Tercatat
            </span>
            <span className="mono" style={{ fontSize: 11, color: '#fed7aa', background: 'rgba(251, 146, 60, 0.2)', padding: '2px 6px', borderRadius: 4 }}>
              Terdata Dapur
            </span>
          </div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: '#fb923c', marginTop: 4 }}>
            {rupiah(totalWasteLoss)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            Limbah basi, gosong, rusak, dan sortir kualitas yang diakui staf.
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#fb7185', display: 'flex', alignItems: 'center', gap: 6 }}>
              <HelpCircle size={14} /> Selisih Tak Terjelaskan (Shrinkage)
            </span>
            <span className="mono" style={{ fontSize: 11, color: '#fecdd3', background: 'rgba(244, 63, 94, 0.2)', padding: '2px 6px', borderRadius: 4 }}>
              Perlu Investigasi
            </span>
          </div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: '#fb7185', marginTop: 4 }}>
            {rupiah(totalUnaccountedLoss)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            Selisih fisik opname di luar catatan waste (potensi over-portion / pencurian).
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#c084fc', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={14} /> Total Kerugian F&B
            </span>
            <span className="mono" style={{ fontSize: 11, color: '#e9d5ff', background: 'rgba(168, 85, 247, 0.2)', padding: '2px 6px', borderRadius: 4 }}>
              Waste + Selisih
            </span>
          </div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: '#c084fc', marginTop: 4 }}>
            {rupiah(totalGrossLoss)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            Total dampak finansial atas perbedaan stok fisik terhadap standar resep.
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="table-wrap" style={{ marginBottom: 16 }}>
        <table>
          <thead>
            {viewMode === 'cost_control' ? (
              <tr>
                <th>Bahan Baku</th>
                <th className="right">Teoritis (POS)</th>
                <th className="right">Aktual Fisik</th>
                <th className="right">Selisih Kotor</th>
                <th className="right" style={{ color: '#fb923c' }}>Waste Terdata</th>
                <th className="right" style={{ color: '#fb7185' }}>Selisih Murni</th>
                <th className="right">% Net</th>
                <th className="right" style={{ color: '#fb923c' }}>Nilai Waste</th>
                <th className="right" style={{ color: '#fb7185' }}>Nilai Selisih</th>
                <th className="right">Status</th>
                <th></th>
              </tr>
            ) : (
              <tr>
                <th>Bahan Baku</th>
                <th className="right">Teoritis</th>
                <th className="right">Aktual</th>
                <th className="right">Selisih</th>
                <th className="right">%</th>
                <th className="right">Value</th>
                <th className="right">Status</th>
                <th></th>
              </tr>
            )}
          </thead>
          <tbody>
            {varData.map(iv => {
              const isSelected = drill === iv.ingredient?.id;
              const hasWaste = (iv.waste_qty || 0) > 0;

              if (viewMode === 'cost_control') {
                return (
                  <tr key={iv.ingredient?.id} className={isSelected ? 'selected' : ''}>
                    <td style={{ fontWeight: 600 }}>
                      {iv.ingredient?.name}
                      {hasWaste && (
                        <span style={{ fontSize: 10.5, color: '#fb923c', marginLeft: 6, padding: '1px 6px', background: 'rgba(251, 146, 60, 0.15)', borderRadius: 4 }}>
                          Ada Waste
                        </span>
                      )}
                    </td>
                    <td className="mono right">{num(iv.pemakaian_teoritis)} {iv.ingredient?.unit_pakai}</td>
                    <td className="mono right">{iv.pemakaian_aktual !== null ? num(iv.pemakaian_aktual) : '—'}</td>
                    <td className="mono right" style={{ color: iv.variance_gross_qty > 0 ? 'var(--warn)' : 'inherit' }}>
                      {iv.variance_gross_qty !== null ? num(iv.variance_gross_qty) : '—'}
                    </td>
                    <td className="mono right" style={{ color: hasWaste ? '#fb923c' : 'var(--text-secondary)', fontWeight: hasWaste ? 600 : 400 }}>
                      {num(iv.waste_qty || 0)}
                    </td>
                    <td className="mono right" style={{ color: iv.unaccounted_qty > 0 ? 'var(--danger)' : 'var(--ok)', fontWeight: 600 }}>
                      {iv.unaccounted_qty !== null ? num(iv.unaccounted_qty) : '—'}
                    </td>
                    <td className="mono right">{iv.variance_pct !== null ? pct(iv.variance_pct) : '—'}</td>
                    <td className="mono right" style={{ color: hasWaste ? '#fb923c' : 'inherit' }}>
                      {iv.waste_value > 0 ? rupiah(iv.waste_value) : '—'}
                    </td>
                    <td className="mono right" style={{ color: iv.variance_value > 0 ? 'var(--danger)' : 'var(--ok)', fontWeight: 600 }}>
                      {iv.variance_value !== null ? rupiah(iv.variance_value) : '—'}
                    </td>
                    <td className="right"><StatusPill status={iv.status} /></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => setDrill(d => d === iv.ingredient?.id ? null : iv.ingredient?.id)}>
                        {isSelected ? 'Tutup' : 'Drill →'}
                      </button>
                    </td>
                  </tr>
                );
              }

              // Standard View
              return (
                <tr key={iv.ingredient?.id} className={isSelected ? 'selected' : ''}>
                  <td style={{ fontWeight: 500 }}>{iv.ingredient?.name}</td>
                  <td className="mono right">{num(iv.pemakaian_teoritis)} {iv.ingredient?.unit_pakai}</td>
                  <td className="mono right">{iv.pemakaian_aktual !== null ? num(iv.pemakaian_aktual) : '—'}</td>
                  <td className="mono right">{iv.variance_qty !== null ? num(iv.variance_qty) : '—'}</td>
                  <td className="mono right">{iv.variance_pct !== null ? pct(iv.variance_pct) : '—'}</td>
                  <td className="mono right" style={{ color: iv.variance_value > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                    {iv.variance_value !== null ? rupiah(iv.variance_value) : '—'}
                  </td>
                  <td className="right"><StatusPill status={iv.status} /></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDrill(d => d === iv.ingredient?.id ? null : iv.ingredient?.id)}>
                      {isSelected ? 'Tutup' : 'Drill →'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Drill-down Detail */}
      {drillData && (
        <div className="card fade-in" style={{ border: '1px solid var(--accent-border)' }}>
          <div className="flex-between mb-2">
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>
                {drillData.ingredient?.name} — Analisis Pemisahan Cost Control & Waste
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Periode {period.from} s/d {period.to} · Toleransi Standar: {drillData.ingredient?.tolerance}%
              </div>
            </div>
            <StatusPill status={drillData.status} />
          </div>

          {/* Mini Cards Grid */}
          <div className="grid-4 gap-3 my-4">
            <MiniCard
              label="Pemakaian Teoritis (Resep POS)"
              value={`${num(drillData.pemakaian_teoritis)} ${drillData.ingredient?.unit_pakai}`}
            />
            <MiniCard
              label="Pemakaian Aktual (Fisik)"
              value={drillData.pemakaian_aktual !== null ? `${num(drillData.pemakaian_aktual)} ${drillData.ingredient?.unit_pakai}` : '—'}
            />
            <MiniCard
              label="Kerugian Waste Tercatat"
              value={drillData.waste_value > 0 ? `${num(drillData.waste_qty)} ${drillData.ingredient?.unit_pakai} (${rupiah(drillData.waste_value)})` : 'Rp 0'}
              color="#fb923c"
            />
            <MiniCard
              label="Selisih Tak Terjelaskan (Shrinkage)"
              value={drillData.variance_value !== null ? `${num(drillData.unaccounted_qty)} ${drillData.ingredient?.unit_pakai} (${rupiah(drillData.variance_value)})` : '—'}
              color={drillData.variance_value > 0 ? 'var(--danger)' : 'var(--ok)'}
            />
          </div>

          {/* Waste vs Shrinkage Breakdown Explanation Bar */}
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 18,
            border: '1px solid var(--border-color)',
            fontSize: 12.5
          }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
              🔎 Evaluasi Cost Control:
            </div>
            {drillData.waste_value > 0 ? (
              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Dari selisih fisik kotor sebesar <strong>{num(drillData.variance_gross_qty)} {drillData.ingredient?.unit_pakai}</strong>,
                sebanyak <strong style={{ color: '#fb923c' }}>{num(drillData.waste_qty)} {drillData.ingredient?.unit_pakai} ({rupiah(drillData.waste_value)})</strong> merupakan kerusakan bahan resmi yang terdokumentasi (waste).
                Sisa selisih murni sebesar <strong style={{ color: drillData.variance_value > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                  {num(drillData.unaccounted_qty)} {drillData.ingredient?.unit_pakai} ({rupiah(drillData.variance_value)})
                </strong> adalah selisih tak terjelaskan yang memerlukan evaluasi tim koki / audit takaran porsi.
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)' }}>
                Tidak ada laporan kerusakan bahan (waste) tercatat untuk bahan ini pada periode berjalan. Seluruh selisih fisik murni berasal dari perbedaan takaran porsi atau kesalahan pencatatan.
              </div>
            )}
          </div>

          {/* Documented Waste Events Log */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, color: '#fb923c' }}>
              <Trash2 size={16} /> Riwayat Log Kejadian Kerusakan / Waste Tercatat
            </div>

            {drillData.waste_records && drillData.waste_records.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Alasan Kerusakan</th>
                      <th className="right">Qty Rusak</th>
                      <th className="right">Nilai Kerugian</th>
                      <th>Petugas Pelapor</th>
                      <th>Keterangan Dapur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillData.waste_records.map(wr => {
                      const reasonInfo = getWasteReason(wr.waste_reason);
                      return (
                        <tr key={wr.id}>
                          <td className="mono" style={{ fontSize: 12 }}>{wr.date}</td>
                          <td>
                            <span style={{
                              fontSize: 11,
                              color: reasonInfo.badgeColor,
                              background: reasonInfo.bg,
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontWeight: 600
                            }}>
                              {reasonInfo.label}
                            </span>
                          </td>
                          <td className="mono right" style={{ color: '#fb923c', fontWeight: 600 }}>
                            {num(wr.qty)} {drillData.ingredient?.unit_pakai}
                          </td>
                          <td className="mono right" style={{ color: '#fb923c' }}>
                            {rupiah(wr.value)}
                          </td>
                          <td style={{ fontSize: 12 }}>{wr.created_by_name}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{wr.note || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 0' }}>
                Tidak ada kejadian waste tercatat untuk bahan ini dalam periode {period.from} s/d {period.to}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL PRATINJAU DOKUMEN AUDIT VARIANSI BAHAN BAKU (PRINT / PDF)           */}
      {/* ========================================================================= */}
      {showReportModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 20, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16
          }}
        >
          <div
            className="modal-card"
            style={{
              width: '100%',
              maxWidth: 1120,
              maxHeight: '92vh',
              background: '#0d1226',
              border: '1px solid rgba(165, 180, 252, 0.25)',
              borderRadius: 14,
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Modal Top Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(79, 70, 229, 0.15)', color: 'var(--accent-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                    Pratinjau Dokumen Audit Variansi Bahan Baku (Landscape A4)
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Laporan audit lengkap pemisahan Waste resmi vs Shrinkage untuk Akuntan & Investor
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleExportExcel}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34d399' }}
                >
                  <FileSpreadsheet size={14} /> Export Excel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handlePrintPdf}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}
                >
                  <Printer size={14} /> Cetak / Simpan PDF
                </button>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => setShowReportModal(false)}
                  style={{ padding: 6, marginLeft: 4 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Document Paper Container */}
            <div style={{ overflowY: 'auto', padding: '24px 28px', background: '#0a0e20' }}>
              <div
                id="printable-variance-bahan-report"
                className="printable-document"
                style={{
                  padding: '28px 32px',
                  background: '#ffffff',
                  color: '#0f172a',
                  borderRadius: 10,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                  maxWidth: 1060,
                  margin: '0 auto'
                }}
              >
                {/* Header Kop */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5px solid #0f172a', paddingBottom: 14, marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#4f46e5' }} />
                      <span style={{ fontWeight: 800, fontSize: 17, color: '#1e1b4b', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                        {businessName}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginTop: 2 }}>
                      LAPORAN AUDIT VARIANSI PERSADAAN BAHAN BAKU (COST CONTROL AUDIT)
                    </div>
                    <div style={{ fontSize: 10.5, color: '#64748b' }}>
                      Pemisahan Tegas Kerugian Limbah (Waste) vs Selisih Tak Terjelaskan (Shrinkage)
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#047857', background: '#ecfdf5', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                      PSAK 14 Weighted Moving Average
                    </span>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      No: <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>AUD-VAR-{period.from.replace(/-/g, '')}-{period.to.replace(/-/g, '')}</strong>
                    </div>
                    <div style={{ fontSize: 10.5, color: '#64748b' }}>
                      Cetak: {new Date().toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                {/* Metadata Strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, marginBottom: 16, fontSize: 11 }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Cabang / Gudang:</span>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{outletName}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Periode Audit:</span>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{period.from} s/d {period.to}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Auditor PIC:</span>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{currentUser?.name || 'Administrator'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Metode Penilaian:</span>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>Rata-Rata Bergerak</div>
                  </div>
                </div>

                {/* Summary Strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16, textAlign: 'center' }}>
                  <div style={{ padding: '8px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: '#c2410c', textTransform: 'uppercase', fontWeight: 700 }}>Kerugian Waste Tercatat</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#ea580c', marginTop: 2 }}>{rupiah(totalWasteLoss)}</div>
                  </div>
                  <div style={{ padding: '8px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: '#be123c', textTransform: 'uppercase', fontWeight: 700 }}>Selisih Tak Terjelaskan</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#e11d48', marginTop: 2 }}>{rupiah(totalUnaccountedLoss)}</div>
                  </div>
                  <div style={{ padding: '8px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: '#4338ca', textTransform: 'uppercase', fontWeight: 700 }}>Total Kerugian F&B</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#4f46e5', marginTop: 2 }}>{rupiah(totalGrossLoss)}</div>
                  </div>
                  <div style={{ padding: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', fontWeight: 700 }}>Total Bahan Diaudit</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{varData.length} Bahan</div>
                  </div>
                </div>

                {/* Main Detailed Audit Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 18 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '1.5px solid #94a3b8' }}>
                      <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 700, color: '#1e293b' }}>Nama Bahan</th>
                      <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 700, color: '#1e293b' }}>Satuan</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: '#1e293b' }}>HPP Moving Avg</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: '#1e293b' }}>Stok Awal</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: '#1e293b' }}>Masuk</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: '#1e293b' }}>Teoritis POS</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: '#1e293b' }}>Waste Tercatat</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: '#1e293b' }}>Pemakaian Aktual</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: '#1e293b' }}>Selisih Unit</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: '#1e293b' }}>% Net</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: '#1e293b' }}>Nilai Selisih</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: '#1e293b' }}>Waste (Rp)</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: '#1e293b' }}>Shrinkage (Rp)</th>
                      <th style={{ textAlign: 'center', padding: '5px 6px', fontWeight: 700, color: '#1e293b' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {varData.map((iv, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '5px 6px', fontWeight: 600, color: '#0f172a' }}>{iv.ingredient?.name}</td>
                        <td style={{ padding: '5px 6px', color: '#64748b' }}>{iv.ingredient?.unit_pakai}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{rupiah(iv.ingredient?.harga || 0)}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{num(iv.stok_awal)}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{num(iv.total_masuk)}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{num(iv.pemakaian_teoritis)}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', color: '#ea580c' }}>{num(iv.waste_qty || 0)}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{num(iv.pemakaian_aktual)}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                          {iv.variance_qty > 0 ? `+${num(iv.variance_qty)}` : num(iv.variance_qty)}
                        </td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{pct(iv.variance_pct)}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: iv.variance_value > 0 ? '#dc2626' : '#059669' }}>
                          {rupiah(iv.variance_value)}
                        </td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', color: '#ea580c' }}>
                          {rupiah(iv.waste_value || 0)}
                        </td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', color: '#e11d48' }}>
                          {rupiah(iv.unaccounted_value || 0)}
                        </td>
                        <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: iv.status === 'NORMAL' ? '#ecfdf5' : iv.status === 'WASPADA' ? '#fffbeb' : '#fef2f2',
                            color: iv.status === 'NORMAL' ? '#047857' : iv.status === 'WASPADA' ? '#b45309' : '#b91c1c'
                          }}>
                            {iv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Signatures */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, textAlign: 'center', marginTop: 14, pageBreakInside: 'avoid' }}>
                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 6 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#0f172a' }}>Disiapkan Oleh:</div>
                    <div style={{ height: 42 }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{currentUser?.name || 'Petugas Gudang'}</div>
                    <div style={{ fontSize: 9.5, color: '#64748b' }}>Cost Control / Store Keeper</div>
                  </div>

                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 6 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#0f172a' }}>Diperiksa Oleh:</div>
                    <div style={{ height: 42 }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Akuntan / Finance</div>
                    <div style={{ fontSize: 9.5, color: '#64748b' }}>Store Manager / Internal Auditor</div>
                  </div>

                  <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 6 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#0f172a' }}>Disetujui Oleh:</div>
                    <div style={{ height: 42 }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Mitra Pemilik / Investor</div>
                    <div style={{ fontSize: 9.5, color: '#64748b' }}>Owner / Branch Representative</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
