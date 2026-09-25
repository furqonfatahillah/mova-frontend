import { useState, useEffect } from 'react';
import api from '../api/client';
import { pct, rupiah, StatusPill, LoadingState, PeriodPicker, PageHeader } from '../components/ui';
import { FileSpreadsheet, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOutlet } from '../context/OutletContext';
import { exportVarianceMenuToExcel } from '../utils/exportReport';
import { printElement } from '../utils/print';

export default function VarianceMenu() {
  const [menuData, setMenuData] = useState([]);
  const [drill, setDrill] = useState(null);
  const [rankBy, setRankBy] = useState('value');
  const [loading, setLoading] = useState(true);

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
      setMenuData(data);
    } catch { toast.error('Gagal memuat data'); }
    finally { setLoading(false); }
  }

  async function handleExportExcel() {
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
    }
  }

  function handlePrintPdf() {
    printElement(
      'printable-variance-menu-report',
      `Laporan Ranking Variance Menu - ${period.from} sd ${period.to}`,
      { orientation: 'portrait' }
    );
  }

  const sorted = [...menuData].sort((a, b) => {
    if (rankBy === 'value') return Math.abs(b.variance_value) - Math.abs(a.variance_value);
    if (rankBy === 'pct')   return b.weighted_pct - a.weighted_pct;
    return b.qty_terjual - a.qty_terjual;
  });

  const total = menuData.reduce((s, r) => s + (r.variance_value || 0), 0);
  const drillRow = drill ? menuData.find(r => r.menu?.id === drill) : null;

  const maxQty = Math.max(...menuData.map(r => r.qty_terjual), 1);
  const maxPct = Math.max(...menuData.map(r => r.weighted_pct || 0), 1);

  if (loading) return <LoadingState />;

  return (
    <div className="fade-in">
      <div className="flex-between mb-4 flex-wrap gap-3">
        <PageHeader title="Variance per Menu" subtitle="Menu mana yang paling besar menyebabkan variance bahan baku." />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
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
            title="Unduh Ranking Variance Menu ke Excel (.xlsx)"
          >
            <FileSpreadsheet size={15} /> Export Excel
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
            {sorted.map(row => (
              <tr key={row.menu?.id} className={drill === row.menu?.id ? 'selected' : ''}>
                <td style={{ fontWeight: 500 }}>{row.menu?.name}</td>
                <td className="mono right">{row.qty_terjual}</td>
                <td className="mono right">{pct(row.weighted_pct)}</td>
                <td className="mono right" style={{ color: row.variance_value > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                  {rupiah(row.variance_value)}
                </td>
                <td className="mono right">
                  {total !== 0 ? `${((row.variance_value / total) * 100).toFixed(0)}%` : '—'}
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => setDrill(d => d === row.menu?.id ? null : row.menu?.id)}>
                    {drill === row.menu?.id ? 'Tutup' : 'Drill →'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

      {/* Drill-down */}
      {drillRow && (
        <div className="card fade-in">
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{drillRow.menu?.name} — Breakdown per Bahan</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>Bahan dalam resep ini yang paling menyumbang variance.</div>
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
                {(drillRow.items || []).sort((a, b) => Math.abs(b.alloc_value) - Math.abs(a.alloc_value)).map((it, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{it.ingredient?.name}</td>
                    <td className="mono right">{((it.share || 0) * 100).toFixed(0)}%</td>
                    <td className="mono right">{it.variance_pct !== null ? pct(it.variance_pct) : '—'}</td>
                    <td className="mono right" style={{ color: it.alloc_value > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                      {rupiah(it.alloc_value)}
                    </td>
                    <td className="right"><StatusPill status={it.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
    </div>
  );
}
