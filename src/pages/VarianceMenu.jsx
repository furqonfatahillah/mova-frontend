import { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import { num, pct, rupiah, StatusPill, LoadingState, PeriodPicker, PageHeader, MiniCard } from '../components/ui';
import { FileSpreadsheet, Printer, Eye, X, Utensils, Layers, HelpCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import { exportVarianceMenuToExcel } from '../utils/exportReport';
import { printElement } from '../utils/print';
import ReportPreviewModal from '../components/ReportPreviewModal';

export default function VarianceMenu() {
  const [menuData, setMenuData] = useState([]);
  const [drill, setDrill] = useState(null);
  const [selectedDrillMenu, setSelectedDrillMenu] = useState(null);
  const [showDrillModal, setShowDrillModal] = useState(false);
  const [rankBy, setRankBy] = useState('value');
  const [loading, setLoading] = useState(true);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { activeOutletId, activeOutlet, currentBusiness, dateRange: period } = useOutlet();
  const currentUser = JSON.parse(localStorage.getItem('pos_user') || '{}');
  const businessName = currentBusiness?.name || currentUser?.business?.name || 'MOVA POS F&B Management';
  const outletName = (activeOutlet && activeOutletId !== 'ALL' && activeOutletId !== 'all') ? activeOutlet.name : 'Semua Cabang (Konsolidasi)';

  useEffect(() => { fetchData(); }, [period, activeOutletId]);

  async function fetchData() {
    setLoading(true);
    try {
      const targetOutlet = activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all' ? activeOutletId : undefined;
      const { data } = await api.get('/reports/variance/menus', {
        params: { from: period.from, to: period.to, outlet_id: targetOutlet }
      });
      setMenuData(Array.isArray(data) ? data : []);
    } catch { toast.error('Gagal memuat data'); }
    finally { setLoading(false); }
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      const fname = await exportVarianceMenuToExcel({
        menuData,
        period,
        outletName,
        businessName,
        userName: currentUser?.name || 'Administrator',
      });
      toast.success(`Laporan Variance Menu Excel berhasil diunduh: ${fname}`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengekspor laporan ke Excel');
    } finally {
      setExporting(false);
    }
  }

  function handlePrintPdf() {
    printElement(
      'printable-variance-menu-report',
      `Laporan Ranking Variance Menu - ${period.from} sd ${period.to}`,
      { orientation: 'portrait' }
    );
  }

  const handleCloseDrill = () => {
    setShowDrillModal(false);
    setSelectedDrillMenu(null);
    setDrill(null);
  };

  const sorted = useMemo(() => {
    return [...menuData].sort((a, b) => {
      if (rankBy === 'value') return Math.abs(b.variance_value) - Math.abs(a.variance_value);
      if (rankBy === 'pct')   return b.weighted_pct - a.weighted_pct;
      return b.qty_terjual - a.qty_terjual;
    });
  }, [menuData, rankBy]);

  const total = menuData.reduce((s, r) => s + (r.variance_value || 0), 0);
  const drillRow = selectedDrillMenu || (drill ? menuData.find(r => String(r.menu?.id ?? r.menu_id ?? r.id) === String(drill)) : null);

  const maxQty = Math.max(...menuData.map(r => r.qty_terjual), 1);
  const maxPct = Math.max(...menuData.map(r => r.weighted_pct || 0), 1);

  // Preview Modal Sheets & KPIs
  const previewKpis = useMemo(() => [
    { label: 'Total Nilai Variansi', value: total, format: 'rupiah', color: total > 0 ? '#ef4444' : '#10b981' },
    { label: 'Total Porsi Terjual', value: `${menuData.reduce((s, r) => s + (r.qty_terjual || 0), 0)} Porsi`, color: '#6366f1' },
    { label: 'Jumlah Menu Dianalisis', value: `${menuData.length} Menu`, color: '#0ea5e9' }
  ], [total, menuData]);

  const previewSheets = useMemo(() => {
    const rows = sorted.map(row => ({
      menu_name: row.menu?.name || '-',
      category: row.menu?.category || 'Menu',
      qty_terjual: Number(row.qty_terjual || 0),
      weighted_pct: Number(row.weighted_pct || 0),
      variance_value: Number(row.variance_value || 0),
      contribution: total !== 0 ? ((Math.abs(row.variance_value || 0) / Math.abs(total)) * 100) : 0
    }));

    return [
      {
        id: 'variance_menu_ranking',
        name: 'Ranking Variansi Menu',
        columns: [
          { key: 'menu_name', label: 'Nama Menu', align: 'left', width: 25 },
          { key: 'category', label: 'Kategori', align: 'left', width: 14 },
          { key: 'qty_terjual', label: 'Qty Terjual (Porsi)', align: 'right', format: 'number', width: 16 },
          { key: 'weighted_pct', label: 'Weighted Variance %', align: 'right', format: 'percent', width: 18 },
          { key: 'variance_value', label: 'Nilai Alokasi Variansi', align: 'right', format: 'rupiah', width: 18 },
          { key: 'contribution', label: 'Kontribusi %', align: 'right', format: 'percent', width: 14 }
        ],
        data: rows,
        totals: [
          { label: 'Total Qty Terjual', value: sorted.reduce((s, r) => s + (r.qty_terjual || 0), 0), format: 'number' },
          { label: 'Total Nilai Variansi Menu', value: total, format: 'rupiah' }
        ]
      }
    ];
  }, [sorted, total]);

  if (loading) return <LoadingState />;

  return (
    <div className="fade-in">
      <div className="flex-between mb-4 flex-wrap gap-3">
        <PageHeader title="Variance per Menu" subtitle="Identifikasi menu yang paling berkontribusi terhadap variansi & selisih bahan baku." />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderColor: 'rgba(99, 102, 241, 0.4)',
              color: 'var(--accent-bright)',
              background: 'rgba(99, 102, 241, 0.08)',
              fontWeight: 600
            }}
            onClick={() => setShowPreviewModal(true)}
            title="Pratinjau interaktif laporan audit variansi menu di layar"
          >
            <Eye size={15} /> Pratinjau Laporan
          </button>
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
            disabled={exporting}
            title="Unduh Ranking Variance Menu ke Excel (.xlsx)"
          >
            <FileSpreadsheet size={15} /> {exporting ? 'Mengekspor...' : 'Export Excel'}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderColor: 'rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.08)',
              fontWeight: 600,
            }}
            onClick={handlePrintPdf}
            title="Unduh / Cetak Dokumen PDF Resmi"
          >
            <Printer size={15} /> Export PDF / Cetak
          </button>
        </div>
      </div>

      {/* Rank buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['value','Ranking: Value (Rp)'],['pct','Ranking: % (weighted)'],['qty','Ranking: Qty Terjual']].map(([k, label]) => (
          <button key={k} className={`btn ${rankBy === k ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setRankBy(k)}>{label}</button>
        ))}
      </div>

      <div className="table-wrap" style={{ marginBottom: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Menu</th>
              <th className="right">Qty Terjual</th>
              <th className="right">Weighted %</th>
              <th className="right">Variance Value</th>
              <th className="right">Contribution</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const menuId = row.menu?.id ?? row.menu_id ?? row.id;
              const isSelected = String(drill) === String(menuId) || (selectedDrillMenu && String(selectedDrillMenu.menu?.id ?? selectedDrillMenu.menu_id ?? selectedDrillMenu.id) === String(menuId));
              return (
                <tr key={menuId} className={isSelected ? 'selected' : ''}>
                  <td style={{ fontWeight: 600 }}>{row.menu?.name}</td>
                  <td className="mono right">{row.qty_terjual}</td>
                  <td className="mono right">{pct(row.weighted_pct)}</td>
                  <td className="mono right" style={{ color: row.variance_value > 0 ? 'var(--danger)' : 'var(--ok)', fontWeight: 600 }}>
                    {rupiah(row.variance_value)}
                  </td>
                  <td className="mono right">
                    {total !== 0 ? `${((row.variance_value / total) * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 12,
                        fontWeight: 600,
                        background: isSelected ? 'var(--accent)' : 'rgba(99, 102, 241, 0.1)',
                        color: isSelected ? '#fff' : 'var(--accent-bright)',
                        borderColor: 'rgba(99, 102, 241, 0.3)'
                      }}
                      onClick={() => {
                        const targetId = row.menu?.id ?? row.menu_id ?? row.id;
                        setDrill(targetId);
                        setSelectedDrillMenu(row);
                        setShowDrillModal(true);
                      }}
                    >
                      <Eye size={13} /> Drill →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Drill-down Modal Detail */}
      {showDrillModal && drillRow && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: 16
          }}
          onClick={handleCloseDrill}
        >
          <div
            className="modal-card"
            style={{
              width: '100%',
              maxWidth: 960,
              maxHeight: '92vh',
              background: '#0f172a',
              border: '1px solid rgba(165, 180, 252, 0.3)',
              borderRadius: 14,
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
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
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Utensils size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>
                    {drillRow.menu?.name} — Breakdown Variansi Resep Bahan
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Periode {period.from} s/d {period.to} · Kategori: {drillRow.menu?.category || 'Menu'}
                  </div>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={handleCloseDrill}
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              {/* Mini Cards Summary */}
              <div className="grid-4 gap-3 mb-4">
                <MiniCard
                  label="Penjualan (Qty Terjual)"
                  value={`${drillRow.qty_terjual || 0} Porsi`}
                />
                <MiniCard
                  label="Weighted Variance %"
                  value={pct(drillRow.weighted_pct)}
                  color={drillRow.weighted_pct > 5 ? 'var(--danger)' : 'inherit'}
                />
                <MiniCard
                  label="Alokasi Nilai Variansi"
                  value={rupiah(drillRow.variance_value)}
                  color={drillRow.variance_value > 0 ? 'var(--danger)' : 'var(--ok)'}
                />
                <MiniCard
                  label="Kontribusi thd Total Variansi"
                  value={total !== 0 ? `${((drillRow.variance_value / total) * 100).toFixed(1)}%` : '—'}
                />
              </div>

              {/* Recipe Breakdown Table */}
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={16} /> Komposisi Bahan dalam Resep & Alokasi Selisih
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Bahan Baku</th>
                      <th className="right">Share Pemakaian</th>
                      <th className="right">Variance % Bahan</th>
                      <th className="right">Alokasi Nilai Selisih</th>
                      <th className="right">Status Bahan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillRow.items && drillRow.items.length > 0 ? (
                      [...drillRow.items].sort((a, b) => Math.abs(b.alloc_value) - Math.abs(a.alloc_value)).map((it, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{it.ingredient?.name}</td>
                          <td className="mono right">{((it.share || 0) * 100).toFixed(1)}%</td>
                          <td className="mono right">{it.variance_pct !== null ? pct(it.variance_pct) : '—'}</td>
                          <td className="mono right" style={{ color: it.alloc_value > 0 ? 'var(--danger)' : 'var(--ok)', fontWeight: 600 }}>
                            {rupiah(it.alloc_value)}
                          </td>
                          <td className="right"><StatusPill status={it.status} /></td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 18 }}>
                          Tidak ada bahan terkait resep menu ini pada data variansi periode terpilih.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(255,255,255,0.02)' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleCloseDrill}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Drill-down Card (Right below table) */}
      {drillRow && (
        <div className="card fade-in mb-4" style={{ border: '1px solid var(--accent-border)' }}>
          <div className="flex-between mb-2">
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{drillRow.menu?.name} — Breakdown per Bahan Baku</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Bahan dalam resep menu ini yang paling menyumbang variance ({drillRow.qty_terjual} porsi terjual).
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleCloseDrill}>Tutup Detail</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bahan</th>
                  <th className="right">Share Pemakaian</th>
                  <th className="right">Variance %</th>
                  <th className="right">Alokasi Value</th>
                  <th className="right">Status</th>
                </tr>
              </thead>
              <tbody>
                {drillRow.items && drillRow.items.length > 0 ? (
                  [...drillRow.items].sort((a, b) => Math.abs(b.alloc_value) - Math.abs(a.alloc_value)).map((it, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{it.ingredient?.name}</td>
                      <td className="mono right">{((it.share || 0) * 100).toFixed(0)}%</td>
                      <td className="mono right">{it.variance_pct !== null ? pct(it.variance_pct) : '—'}</td>
                      <td className="mono right" style={{ color: it.alloc_value > 0 ? 'var(--danger)' : 'var(--ok)', fontWeight: 600 }}>
                        {rupiah(it.alloc_value)}
                      </td>
                      <td className="right"><StatusPill status={it.status} /></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 14 }}>
                      Tidak ada detail komposisi bahan dalam periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Matrix chart */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Menu Matrix — Sales vs Variance %</div>
        <div className="matrix-chart">
          <div className="matrix-label-y">↑ variance %</div>
          <div className="matrix-label-x">qty terjual →</div>
          {menuData.map(row => {
            const x = 6 + (row.qty_terjual / maxQty) * 88;
            const y = 6 + ((row.weighted_pct || 0) / maxPct) * 82;
            const highPct = (row.weighted_pct || 0) / maxPct > 0.5;
            const highQty = row.qty_terjual / maxQty > 0.5;
            const color = highPct && highQty ? 'var(--danger)'
              : !highPct && highQty ? 'var(--ok)'
              : highPct ? 'var(--warn)' : 'var(--text-secondary)';
            return (
              <div key={row.menu?.id} className="matrix-dot" style={{ left: `${x}%`, bottom: `${y}%` }}>
                <div className="matrix-dot-inner" style={{ background: color, boxShadow: `0 0 8px ${color}` }} title={row.menu?.name} />
                <div className="matrix-dot-label">{row.menu?.name}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 11.5, color: 'var(--text-secondary)' }}>
          <span>● <span style={{ color: 'var(--danger)' }}>Merah</span> = tinggi/tinggi (prioritas audit)</span>
          <span>● <span style={{ color: 'var(--ok)' }}>Hijau</span> = rendah/tinggi (pertahankan)</span>
          <span>● <span style={{ color: 'var(--warn)' }}>Kuning</span> = tinggi/rendah (evaluasi recipe)</span>
        </div>
      </div>

      {/* Hidden Printable Container for PDF Export */}
      <div id="printable-variance-menu-report" style={{ display: 'none' }}>
        <div style={{ padding: 15, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", color: '#000000' }}>
          <div style={{ borderBottom: '2px solid #000000', paddingBottom: 10, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 900 }}>
              {businessName}
            </h2>
            <div style={{ fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
              LAPORAN AUDIT RANKING VARIANSI MENU
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              Periode: {period.from} s/d {period.to} | Cabang: {outletName} | Dicetak: {new Date().toLocaleString('id-ID')}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, margin: '8px 0' }}>
            <thead>
              <tr style={{ background: '#f4f4f4', borderBottom: '1px solid #000' }}>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'center' }}>No.</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'left' }}>Menu</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Qty Terjual</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Weighted %</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Variance Value</th>
                <th style={{ border: '1px solid #000', padding: '5px 6px', textAlign: 'right' }}>Kontribusi</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 'bold' }}>{row.menu?.name}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{row.qty_terjual}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{row.weighted_pct !== null ? `${row.weighted_pct}%` : '—'}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>{Number(row.variance_value || 0).toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right' }}>{total !== 0 ? `${((Math.abs(row.variance_value || 0) / Math.abs(total)) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 900, background: '#f4f4f4', borderTop: '2px solid #000' }}>
                <td colSpan={2} style={{ border: '1px solid #000', padding: '6px 8px' }}>Total Variance</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{sorted.reduce((s, r) => s + (r.qty_terjual || 0), 0)}</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px' }}></td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>{Number(total).toLocaleString('id-ID')}</td>
                <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Universal Report Preview Modal */}
      <ReportPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="Pratinjau Ranking Variansi Menu"
        reportTitle="LAPORAN AUDIT RANKING VARIANSI MENU"
        businessName={businessName}
        outletName={outletName}
        periodText={`${period.from} s/d ${period.to}`}
        kpis={previewKpis}
        sheets={previewSheets}
        onExportExcel={handleExportExcel}
        onPrint={handlePrintPdf}
        exporting={exporting}
      />
    </div>
  );
}
