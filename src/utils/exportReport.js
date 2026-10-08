/**
 * MOVA POS & ACCOUNTING — MASTER EXPORT & REPORTING ENGINE
 * 
 * Generates clean, publication-grade Microsoft Excel (.xlsx) reports
 * with ExcelJS, formatted currency, auto-filters, freeze panes,
 * zebra-striping, KPI summaries, and responsive column fitting.
 */

async function getExcelJS() {
  const mod = await import('exceljs');
  return mod.default || mod;
}

/**
 * Helper to download workbook buffer in browser
 */
async function saveWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Standard Design System & Typography Tokens for Corporate Excel Export
 */
const BORDERS = {
  thin: {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  },
  header: {
    top: { style: 'thin', color: { argb: 'FF475569' } },
    bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FF334155' } },
    right: { style: 'thin', color: { argb: 'FF334155' } },
  },
  section: {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  },
  total: {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  },
  kpiBox: {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  }
};

const NUM_FMTS = {
  currency: '_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)',
  currencySimple: '#,##0',
  currencyDecimal: '#,##0.00',
  number: '#,##0',
  numberDecimal: '#,##0.00',
  percent: '0.00%',
  percentSimple: '0.0%',
};

/**
 * Helper to format date range in Indonesian format
 */
export function formatIndoPeriod(period) {
  if (!period) return 'Semua Periode';
  if (typeof period === 'string') return period;
  if (period.from_formatted && period.to_formatted) {
    return `${period.from_formatted} s/d ${period.to_formatted}`;
  }
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const fmt = (dStr) => {
    if (!dStr) return '';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };
  if (period.from && period.to) {
    return `${fmt(period.from)} s/d ${fmt(period.to)}`;
  }
  if (period.from) return `Mulai ${fmt(period.from)}`;
  if (period.to) return `Sampai ${fmt(period.to)}`;
  return 'Semua Periode';
}

/**
 * Standard Header Builder for all Sheets
 */
function addReportHeader(ws, {
  businessName = 'MOVA POS',
  reportTitle = 'LAPORAN',
  periodText = '',
  outletName = 'Semua Cabang',
  userName = 'Administrator',
  colSpan = 8,
  titleColor = 'FF1E40AF', // Royal Blue
}) {
  const colLetter = String.fromCharCode(64 + Math.min(Math.max(colSpan, 5), 26));

  // Row 1: Brand Name
  ws.mergeCells(`A1:${colLetter}1`);
  const cellBrand = ws.getCell('A1');
  cellBrand.value = String(businessName || 'MOVA POS').toUpperCase();
  cellBrand.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF0F172A' } };
  cellBrand.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 24;

  // Row 2: Report Title
  ws.mergeCells(`A2:${colLetter}2`);
  const cellTitle = ws.getCell('A2');
  cellTitle.value = reportTitle;
  cellTitle.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: titleColor } };
  cellTitle.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(2).height = 20;

  // Row 3: Meta info
  ws.mergeCells(`A3:${colLetter}3`);
  const cellMeta = ws.getCell('A3');
  const nowStr = new Date().toLocaleString('id-ID');
  const metaParts = [];
  if (periodText) metaParts.push(`Periode: ${periodText}`);
  if (outletName) metaParts.push(`Cabang: ${outletName}`);
  metaParts.push(`Waktu Ekspor: ${nowStr}`);
  if (userName) metaParts.push(`Dicetak Oleh: ${userName}`);

  cellMeta.value = metaParts.join('   |   ');
  cellMeta.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF64748B' } };
  cellMeta.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(3).height = 18;

  // Row 4: Spacer
  ws.addRow([]);
  ws.getRow(4).height = 8;
}

/**
 * Standard Table Header Builder
 */
function addTableHeader(ws, headers = [], bgArgb = 'FF1E293B') {
  const row = ws.addRow(headers);
  row.height = 26;
  row.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgArgb },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = BORDERS.header;
  });
  return row;
}

/**
 * Auto-fit column widths with padding
 */
function autoFitColumns(ws, minWidth = 12, maxWidth = 55) {
  ws.columns.forEach((column) => {
    let maxLength = minWidth;
    column.eachCell({ includeEmpty: true }, (cell) => {
      // Ignore header rows 1, 2, 3
      if (cell.row <= 3) return;
      const val = cell.value;
      if (val !== null && val !== undefined) {
        const str = typeof val === 'object' && val.richText
          ? val.richText.map(t => t.text).join('')
          : String(val);
        if (str.length > maxLength && str.length <= maxWidth) {
          maxLength = str.length;
        }
      }
    });
    column.width = Math.min(Math.max(maxLength + 4, minWidth), maxWidth);
  });
}

/**
 * Apply cell styles helper
 */
function applyDataRowStyle(row, isEven = false, alignMap = {}, formatMap = {}) {
  row.height = 21;
  const bgColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = cell.font || { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgColor },
    };
    cell.border = BORDERS.thin;

    const align = alignMap[colNumber] || 'left';
    cell.alignment = {
      vertical: 'middle',
      horizontal: align,
      wrapText: align === 'left',
    };

    if (formatMap[colNumber]) {
      cell.numFmt = formatMap[colNumber];
    }
  });
}

/**
 * Apply total summary row style
 */
function applyTotalRowStyle(row, alignMap = {}, formatMap = {}) {
  row.height = 24;
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cell.border = BORDERS.total;

    const align = alignMap[colNumber] || (cell.value && typeof cell.value === 'number' ? 'right' : 'left');
    cell.alignment = { vertical: 'middle', horizontal: align };

    if (formatMap[colNumber]) {
      cell.numFmt = formatMap[colNumber];
    }
  });
}

// ============================================================================
// 1. DASHBOARD COST CONTROL & ANALYTICS
// ============================================================================
export async function exportDashboardToExcel({
  data,
  varData = [],
  varMenuData = [],
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
  userName = 'Administrator',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = businessName;
  wb.created = new Date();

  const periodStr = formatIndoPeriod(period);
  const {
    status_counts = {},
    total_variance_loss = 0,
    total_waste_value = 0,
    total_combined_loss = 0,
    top_waste = [],
  } = data || {};

  // SHEET 1: RINGKASAN EKSEKUTIF
  const ws1 = wb.addWorksheet('Ringkasan Eksekutif', { views: [{ showGridLines: true }] });
  addReportHeader(ws1, {
    businessName,
    reportTitle: 'RINGKASAN EKSEKUTIF COST CONTROL & ANALITIK VARIANSI',
    periodText: periodStr,
    outletName,
    userName,
    colSpan: 4,
    titleColor: 'FF0F766E', // Teal
  });

  addTableHeader(ws1, ['Indikator Metrik Cost Control', 'Jumlah / Nilai', 'Satuan', 'Keterangan Akuntansi / Audit'], 'FF0F766E');
  
  const metrics = [
    ['Bahan Baku Status Normal', status_counts.NORMAL ?? 0, 'Item Bahan', 'Pemakaian dalam batas wajar toleransi resep'],
    ['Bahan Baku Status Waspada', status_counts.WASPADA ?? 0, 'Item Bahan', 'Perlu evaluasi porsi takaran koki / bartender'],
    ['Bahan Baku Status Tidak Wajar', status_counts['TIDAK WAJAR'] ?? 0, 'Item Bahan', 'Wajib investigasi kebocoran / kehilangan fisik'],
    ['Total Kerugian Waste Resmi', Number(total_waste_value) || 0, 'Rupiah (IDR)', 'Limbah basi, gosong, expired diakui dapur'],
    ['Total Selisih Tak Terjelaskan (Shrinkage)', Number(total_variance_loss) || 0, 'Rupiah (IDR)', 'Anomali selisih fisik vs perhitungan sistem'],
    ['Total Kerugian F&B Bersih', Number(total_combined_loss) || 0, 'Rupiah (IDR)', 'Akumulasi kerugian waste + selisih murni'],
  ];

  metrics.forEach((m, idx) => {
    const row = ws1.addRow(m);
    const isCurrency = idx >= 3;
    applyDataRowStyle(row, idx % 2 === 1, { 1: 'left', 2: isCurrency ? 'right' : 'center', 3: 'center', 4: 'left' }, { 2: isCurrency ? NUM_FMTS.currency : NUM_FMTS.number });
  });
  autoFitColumns(ws1);

  // SHEET 2: TOP SELISIH BAHAN
  const ws2 = wb.addWorksheet('Top Selisih Bahan', { views: [{ showGridLines: true }] });
  addReportHeader(ws2, { businessName, reportTitle: 'DAFTAR BAHAN BAKU DENGAN SELISIH TERTINGGI', periodText: periodStr, outletName, userName, colSpan: 8, titleColor: 'FFDC2626' });
  addTableHeader(ws2, ['No', 'Kode Bahan', 'Nama Bahan Baku', 'Kategori', 'Satuan Pakai', '% Net Variance', 'Nilai Selisih (Rp)', 'Status Audit'], 'FF991B1B');
  
  varData.forEach((iv, idx) => {
    const row = ws2.addRow([
      idx + 1,
      iv.ingredient?.code || '-',
      iv.ingredient?.name || '-',
      iv.ingredient?.category || '-',
      iv.ingredient?.unit_pakai || '-',
      (Number(iv.variance_pct) || 0) / 100,
      Number(iv.variance_value) || 0,
      iv.status || 'NORMAL',
    ]);
    applyDataRowStyle(row, idx % 2 === 1, { 1: 'center', 2: 'center', 3: 'left', 4: 'left', 5: 'center', 6: 'right', 7: 'right', 8: 'center' }, { 6: NUM_FMTS.percent, 7: NUM_FMTS.currency });
  });
  autoFitColumns(ws2);

  // SHEET 3: TOP MENU VARIANCE
  const ws3 = wb.addWorksheet('Top Menu Variance', { views: [{ showGridLines: true }] });
  addReportHeader(ws3, { businessName, reportTitle: 'MENU PENYUMBANG VARIANSI TERTINGGI', periodText: periodStr, outletName, userName, colSpan: 6, titleColor: 'FFD97706' });
  addTableHeader(ws3, ['No', 'Nama Menu', 'Kategori', 'Qty Terjual (Porsi)', 'Weighted %', 'Nilai Variance (Rp)'], 'FFB45309');
  
  varMenuData.forEach((row, idx) => {
    const r = ws3.addRow([
      idx + 1,
      row.menu?.name || '-',
      row.menu?.category || '-',
      Number(row.qty_terjual) || 0,
      (Number(row.weighted_pct) || 0) / 100,
      Number(row.variance_value) || 0,
    ]);
    applyDataRowStyle(r, idx % 2 === 1, { 1: 'center', 2: 'left', 3: 'left', 4: 'right', 5: 'right', 6: 'right' }, { 4: NUM_FMTS.number, 5: NUM_FMTS.percent, 6: NUM_FMTS.currency });
  });
  autoFitColumns(ws3);

  // SHEET 4: LOG WASTE & LIMBAH
  const ws4 = wb.addWorksheet('Log Limbah & Waste', { views: [{ showGridLines: true }] });
  addReportHeader(ws4, { businessName, reportTitle: 'RINCIAN KERUSAKAN & LIMBAH BAHAN BAKU (DOCUMENTED WASTE)', periodText: periodStr, outletName, userName, colSpan: 7, titleColor: 'FF475569' });
  addTableHeader(ws4, ['No', 'Kode Bahan', 'Nama Bahan Baku', 'Total Qty Rusak', 'Satuan', 'Nilai Kerugian (Rp)', 'Alasan & Kejadian'], 'FF334155');
  
  top_waste.forEach((tw, idx) => {
    const reasons = (tw.waste_records || []).map(r => `${r.waste_reason || 'Lainnya'}: ${r.qty}`).join('; ') || 'Pencatatan limbah dapur';
    const r = ws4.addRow([
      idx + 1,
      tw.ingredient?.code || '-',
      tw.ingredient?.name || '-',
      Number(tw.waste_qty || tw.waste) || 0,
      tw.ingredient?.unit_pakai || '-',
      Number(tw.waste_value) || 0,
      reasons,
    ]);
    applyDataRowStyle(r, idx % 2 === 1, { 1: 'center', 2: 'center', 3: 'left', 4: 'right', 5: 'center', 6: 'right', 7: 'left' }, { 4: NUM_FMTS.numberDecimal, 6: NUM_FMTS.currency });
  });
  autoFitColumns(ws4);

  const filename = `Laporan_Eksekutif_Cost_Control_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 2. AUDIT VARIANSI BAHAN BAKU
// ============================================================================
export async function exportVarianceBahanToExcel({
  varData = [],
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
  userName = 'Administrator',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = businessName;
  const ws = wb.addWorksheet('Audit Variansi Bahan', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, {
    businessName,
    reportTitle: 'LAPORAN AUDIT VARIANSI BAHAN BAKU & REKONSILIASI RESEP',
    periodText: periodStr,
    outletName,
    userName,
    colSpan: 16,
    titleColor: 'FF991B1B',
  });

  addTableHeader(ws, [
    'No', 'Kode Bahan', 'Nama Bahan Baku', 'Kategori', 'Satuan Pakai',
    'Stok Awal', 'Masuk (Beli/Transfer)', 'Keluar Riil (Fisik)', 'Standar Resep POS',
    'Waste Tercatat', 'Sisa Buku Sistem', 'Fisik Opname Riil', 'Selisih Qty',
    '% Net Selisih', 'Nilai Selisih (Rp)', 'Status Audit'
  ], 'FF1E293B');

  let totalSelisihValue = 0;
  varData.forEach((iv, idx) => {
    const selisihRp = Number(iv.variance_value) || 0;
    totalSelisihValue += selisihRp;
    const row = ws.addRow([
      idx + 1,
      iv.ingredient?.code || '-',
      iv.ingredient?.name || '-',
      iv.ingredient?.category || '-',
      iv.ingredient?.unit_pakai || '-',
      Number(iv.stok_awal) || 0,
      Number(iv.total_in) || 0,
      Number(iv.total_out_riil) || 0,
      Number(iv.total_resep) || 0,
      Number(iv.total_waste) || 0,
      Number(iv.stok_akhir_sistem) || 0,
      Number(iv.stok_akhir_fisik) || 0,
      Number(iv.variance_qty) || 0,
      (Number(iv.variance_pct) || 0) / 100,
      selisihRp,
      iv.status || 'NORMAL',
    ]);

    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'center', 3: 'left', 4: 'left', 5: 'center',
      6: 'right', 7: 'right', 8: 'right', 9: 'right', 10: 'right',
      11: 'right', 12: 'right', 13: 'right', 14: 'right', 15: 'right', 16: 'center'
    }, {
      6: NUM_FMTS.numberDecimal, 7: NUM_FMTS.numberDecimal, 8: NUM_FMTS.numberDecimal,
      9: NUM_FMTS.numberDecimal, 10: NUM_FMTS.numberDecimal, 11: NUM_FMTS.numberDecimal,
      12: NUM_FMTS.numberDecimal, 13: NUM_FMTS.numberDecimal, 14: NUM_FMTS.percent,
      15: NUM_FMTS.currency
    });
  });

  const totalRow = ws.addRow([
    'TOTAL NILAI ANOMALI / SELISIH', '', '', '', '', '', '', '', '', '', '', '', '', '',
    totalSelisihValue, ''
  ]);
  ws.mergeCells(`A${totalRow.number}:N${totalRow.number}`);
  applyTotalRowStyle(totalRow, { 1: 'right', 15: 'right' }, { 15: NUM_FMTS.currency });

  autoFitColumns(ws);
  const filename = `Audit_Variansi_Bahan_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 3. PROFITABILITAS & MARGIN MENU
// ============================================================================
export async function exportProfitabilityToExcel({
  data = [],
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
  userName = 'Administrator',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Profitabilitas Menu', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN ANALISIS PROFITABILITAS & MARGIN MENU', periodText: periodStr, outletName, userName, colSpan: 12, titleColor: 'FF059669' });
  addTableHeader(ws, [
    'No', 'Nama Menu', 'Kategori', 'Harga Jual (Rp)', 'HPP Porsi (Rp)', 'Gross Profit (Rp)',
    'Gross Margin (%)', 'Qty Terjual', 'Total Omset (Rp)', 'Total HPP (Rp)', 'Total Laba Kotor (Rp)', 'Kontribusi (%)'
  ], 'FF065F46');

  let totOmset = 0, totHpp = 0, totProfit = 0, totQty = 0;
  data.forEach((p, idx) => {
    const rev = Number(p.total_revenue) || 0;
    const hpp = Number(p.total_hpp) || 0;
    const profit = Number(p.total_profit) || 0;
    const qty = Number(p.qty_sold) || 0;
    totOmset += rev; totHpp += hpp; totProfit += profit; totQty += qty;

    const row = ws.addRow([
      idx + 1,
      p.name || '-',
      p.category || '-',
      Number(p.price) || 0,
      Number(p.hpp) || 0,
      Number(p.profit_per_unit) || 0,
      (Number(p.margin_pct) || 0) / 100,
      qty,
      rev,
      hpp,
      profit,
      (Number(p.contribution_pct) || 0) / 100,
    ]);

    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'left', 3: 'left', 4: 'right', 5: 'right', 6: 'right',
      7: 'right', 8: 'right', 9: 'right', 10: 'right', 11: 'right', 12: 'right'
    }, {
      4: NUM_FMTS.currency, 5: NUM_FMTS.currency, 6: NUM_FMTS.currency,
      7: NUM_FMTS.percent, 8: NUM_FMTS.number, 9: NUM_FMTS.currency,
      10: NUM_FMTS.currency, 11: NUM_FMTS.currency, 12: NUM_FMTS.percent
    });
  });

  const totRow = ws.addRow(['TOTAL KESELURUHAN', '', '', '', '', '', totOmset > 0 ? (totProfit / totOmset) : 0, totQty, totOmset, totHpp, totProfit, 1.0]);
  ws.mergeCells(`A${totRow.number}:F${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 7: 'right', 8: 'right', 9: 'right', 10: 'right', 11: 'right', 12: 'right' }, {
    7: NUM_FMTS.percent, 8: NUM_FMTS.number, 9: NUM_FMTS.currency, 10: NUM_FMTS.currency, 11: NUM_FMTS.currency, 12: NUM_FMTS.percent
  });

  autoFitColumns(ws);
  const filename = `Profitabilitas_Menu_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 4. RANKING VARIANCE MENU
// ============================================================================
export async function exportVarianceMenuToExcel({
  menuData = [],
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
  userName = 'Administrator',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Variance Menu', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, { businessName, reportTitle: 'RANKING MENU PENYUMBANG VARIANSI TERTINGGI', periodText: periodStr, outletName, userName, colSpan: 6, titleColor: 'FFD97706' });
  addTableHeader(ws, ['No', 'Nama Menu', 'Kategori', 'Qty Terjual (Porsi)', 'Weighted Variance %', 'Estimasi Nilai Variance (Rp)'], 'FFB45309');

  let totalVarVal = 0, totalQty = 0;
  menuData.forEach((row, idx) => {
    const qty = Number(row.qty_terjual) || 0;
    const vVal = Number(row.variance_value) || 0;
    totalQty += qty; totalVarVal += vVal;

    const r = ws.addRow([
      idx + 1,
      row.menu?.name || '-',
      row.menu?.category || '-',
      qty,
      (Number(row.weighted_pct) || 0) / 100,
      vVal,
    ]);
    applyDataRowStyle(r, idx % 2 === 1, { 1: 'center', 2: 'left', 3: 'left', 4: 'right', 5: 'right', 6: 'right' }, { 4: NUM_FMTS.number, 5: NUM_FMTS.percent, 6: NUM_FMTS.currency });
  });

  const totRow = ws.addRow(['TOTAL KESELURUHAN', '', '', totalQty, '', totalVarVal]);
  ws.mergeCells(`A${totRow.number}:C${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 4: 'right', 6: 'right' }, { 4: NUM_FMTS.number, 6: NUM_FMTS.currency });

  autoFitColumns(ws);
  const filename = `Variance_Menu_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 5. PIUTANG USAHA & KASBON (RECEIVABLES)
// ============================================================================
export async function exportReceivablesToExcel({
  items = [],
  stats = {},
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
  userName = 'Administrator',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Piutang Usaha & Kasbon', { views: [{ showGridLines: true }] });

  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN DAFTAR PIUTANG USAHA, AR MERCHANT & KASBON', periodText: '', outletName, userName, colSpan: 16, titleColor: 'FF0D9488' });
  addTableHeader(ws, [
    'No', 'No. Piutang', 'No. Transaksi / Nota', 'Tipe Piutang', 'Channel / Mitra',
    'Nama Pelanggan / Debitur', 'Tgl Terbit', 'Jatuh Tempo', 'Total Tagihan (Rp)',
    'Terbayar (Rp)', 'Sisa Piutang (Rp)', 'MDR %', 'Biaya MDR (Rp)', 'Piutang Bersih (Rp)',
    'Status Bayar', 'Catatan'
  ], 'FF115E59');

  let totTagihan = 0, totBayar = 0, totSisa = 0, totNet = 0;
  items.forEach((item, idx) => {
    const t = Number(item.total_amount) || 0;
    const p = Number(item.paid_amount) || 0;
    const r = Number(item.remaining_amount) || 0;
    const net = Number(item.net_amount) || (t - (Number(item.mdr_fee) || 0));
    totTagihan += t; totBayar += p; totSisa += r; totNet += net;

    const row = ws.addRow([
      idx + 1,
      item.receivable_no || `AR-${item.id}`,
      item.order_number || '-',
      item.ar_type || 'KASBON_POS',
      item.merchant_channel || '-',
      item.customer_name || item.customer?.name || '-',
      item.issue_date || '-',
      item.due_date || '-',
      t,
      p,
      r,
      (Number(item.mdr_rate) || 0) / 100,
      Number(item.mdr_fee) || 0,
      net,
      item.status || 'UNPAID',
      item.notes || '-',
    ]);

    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'center', 3: 'center', 4: 'center', 5: 'center',
      6: 'left', 7: 'center', 8: 'center', 9: 'right', 10: 'right',
      11: 'right', 12: 'right', 13: 'right', 14: 'right', 15: 'center', 16: 'left'
    }, {
      9: NUM_FMTS.currency, 10: NUM_FMTS.currency, 11: NUM_FMTS.currency,
      12: NUM_FMTS.percent, 13: NUM_FMTS.currency, 14: NUM_FMTS.currency
    });
  });

  const totRow = ws.addRow(['TOTAL KESELURUHAN PIUTANG', '', '', '', '', '', '', '', totTagihan, totBayar, totSisa, '', '', totNet, '', '']);
  ws.mergeCells(`A${totRow.number}:H${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 9: 'right', 10: 'right', 11: 'right', 14: 'right' }, {
    9: NUM_FMTS.currency, 10: NUM_FMTS.currency, 11: NUM_FMTS.currency, 14: NUM_FMTS.currency
  });

  autoFitColumns(ws);
  const filename = `Laporan_Piutang_Usaha_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 6. RIWAYAT PEMBAYARAN PIUTANG (RECEIVABLE PAYMENTS)
// ============================================================================
export async function exportReceivablePaymentsToExcel({
  items = [],
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
  userName = 'Administrator',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Riwayat Pelunasan Piutang', { views: [{ showGridLines: true }] });

  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN RIWAYAT PELUNASAN PIUTANG & KASBON', periodText: '', outletName, userName, colSpan: 10, titleColor: 'FF0D9488' });
  addTableHeader(ws, ['No', 'No. Bukti Bayar', 'No. Piutang', 'Pelanggan / Debitur', 'Tanggal Bayar', 'Metode Bayar', 'No. Referensi', 'Jumlah Bayar (Rp)', 'Diterima Oleh', 'Catatan'], 'FF115E59');

  let totBayar = 0;
  items.forEach((p, idx) => {
    const amt = Number(p.amount) || 0;
    totBayar += amt;
    const row = ws.addRow([
      idx + 1,
      p.payment_no || `PAY-${p.id}`,
      p.receivable?.receivable_no || p.receivable_id || '-',
      p.receivable?.customer_name || '-',
      p.payment_date || '-',
      p.payment_method || 'CASH',
      p.reference_no || '-',
      amt,
      p.receiver?.name || p.receiver_name || '-',
      p.notes || '-',
    ]);
    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'center', 3: 'center', 4: 'left', 5: 'center',
      6: 'center', 7: 'center', 8: 'right', 9: 'left', 10: 'left'
    }, { 8: NUM_FMTS.currency });
  });

  const totRow = ws.addRow(['TOTAL PELUNASAN DITERIMA', '', '', '', '', '', '', totBayar, '', '']);
  ws.mergeCells(`A${totRow.number}:G${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 8: 'right' }, { 8: NUM_FMTS.currency });

  autoFitColumns(ws);
  const filename = `Riwayat_Pelunasan_Piutang_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 7. PENJUALAN PER PRODUK
// ============================================================================
export async function exportSalesByProductToExcel({
  items = [],
  summary = {},
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Penjualan per Produk', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN PENJUALAN PER PRODUK & MENU', periodText: periodStr, outletName, colSpan: 11, titleColor: 'FF1E40AF' });
  addTableHeader(ws, ['No', 'Kode Menu', 'Nama Produk / Menu', 'Qty Terjual', 'Qty Refund', 'Satuan', 'HPP Modal (Rp)', 'Harga Jual (Rp)', 'Diskon (Rp)', 'Total Penjualan Kotor (Rp)', 'Total Refund (Rp)'], 'FF1E3A8A');

  items.forEach((item, idx) => {
    const row = ws.addRow([
      idx + 1,
      item.code || '-',
      item.name || '-',
      Number(item.qty_sold) || 0,
      Number(item.qty_refund) || 0,
      item.unit || 'Porsi',
      Number(item.cost_price) || 0,
      Number(item.price) || 0,
      Number(item.discount_amount) || 0,
      Number(item.total_sales) || 0,
      Number(item.total_refund) || 0,
    ]);
    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'center', 3: 'left', 4: 'right', 5: 'right',
      6: 'center', 7: 'right', 8: 'right', 9: 'right', 10: 'right', 11: 'right'
    }, {
      4: NUM_FMTS.number, 5: NUM_FMTS.number, 7: NUM_FMTS.currency,
      8: NUM_FMTS.currency, 9: NUM_FMTS.currency, 10: NUM_FMTS.currency, 11: NUM_FMTS.currency
    });
  });

  const totRow = ws.addRow([
    'TOTAL PENJUALAN', '', '',
    Number(summary.total_qty_sold) || 0,
    Number(summary.total_qty_refund) || 0,
    '',
    Number(summary.total_modal) || 0,
    '',
    Number(summary.total_discount) || 0,
    Number(summary.total_sales) || 0,
    Number(summary.total_refund) || 0,
  ]);
  ws.mergeCells(`A${totRow.number}:C${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 4: 'right', 5: 'right', 7: 'right', 9: 'right', 10: 'right', 11: 'right' }, {
    4: NUM_FMTS.number, 5: NUM_FMTS.number, 7: NUM_FMTS.currency, 9: NUM_FMTS.currency, 10: NUM_FMTS.currency, 11: NUM_FMTS.currency
  });

  autoFitColumns(ws);
  const filename = `Laporan_Penjualan_Produk_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 8. PENUKARAN POIN MEMBER
// ============================================================================
export async function exportPointRedemptionsToExcel({
  items = [],
  summary = {},
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Penukaran Poin', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN PENUKARAN POIN & REWARD MEMBER', periodText: periodStr, outletName, colSpan: 12, titleColor: 'FF7C3AED' });
  addTableHeader(ws, ['No', 'Tanggal', 'Tgl Dibuat', 'Dibuat Oleh', 'Cabang / Outlet', 'Nama Member', 'Kasir', 'No. Transaksi', 'Penukaran / Reward', 'Qty', 'Nilai Diskon (Rp)', 'Poin Digunakan'], 'FF6D28D9');

  items.forEach((item, idx) => {
    const row = ws.addRow([
      idx + 1,
      item.date || '-',
      item.created_at || '-',
      item.created_by || '-',
      item.warehouse || outletName,
      item.customer || '-',
      item.cashier || item.created_by || '-',
      item.order_number || '-',
      item.penukaran || '-',
      Number(item.qty) || 1,
      Number(item.nilai) || 0,
      Number(item.points_used) || 0,
    ]);
    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'center', 3: 'center', 4: 'left', 5: 'left',
      6: 'left', 7: 'left', 8: 'center', 9: 'left', 10: 'right', 11: 'right', 12: 'right'
    }, { 10: NUM_FMTS.number, 11: NUM_FMTS.currency, 12: NUM_FMTS.number });
  });

  const totRow = ws.addRow(['TOTAL PENUKARAN', '', '', '', '', '', '', '', '', Number(summary.total_qty) || items.length, Number(summary.total_nilai) || 0, Number(summary.total_points) || 0]);
  ws.mergeCells(`A${totRow.number}:I${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 10: 'right', 11: 'right', 12: 'right' }, { 10: NUM_FMTS.number, 11: NUM_FMTS.currency, 12: NUM_FMTS.number });

  autoFitColumns(ws);
  const filename = `Laporan_Penukaran_Poin_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 9. REKAP METODE PEMBAYARAN (SALES PAYMENTS)
// ============================================================================
export async function exportSalesPaymentsToExcel({
  items = [],
  summary = {},
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Metode Pembayaran', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN REKAP PENJUALAN PER METODE PEMBAYARAN', periodText: periodStr, outletName, colSpan: 6, titleColor: 'FF0284C7' });
  addTableHeader(ws, ['No', 'Metode Pembayaran', 'Kategori Saluran', 'Jumlah Transaksi', 'Total Penerimaan (Rp)', 'Kontribusi (%)'], 'FF0369A1');

  items.forEach((item, idx) => {
    const row = ws.addRow([
      idx + 1,
      item.method || '-',
      item.category || item.channel || 'Tunai / Non-Tunai',
      Number(item.count) || 0,
      Number(item.total) || 0,
      (Number(item.percentage) || 0) / 100,
    ]);
    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'left', 3: 'center', 4: 'right', 5: 'right', 6: 'right'
    }, { 4: NUM_FMTS.number, 5: NUM_FMTS.currency, 6: NUM_FMTS.percent });
  });

  const totRow = ws.addRow([
    'TOTAL PENERIMAAN', '', '',
    Number(summary.total_transactions || summary.total_count) || 0,
    Number(summary.total_amount || summary.total_sales) || 0,
    1.0,
  ]);
  ws.mergeCells(`A${totRow.number}:C${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 4: 'right', 5: 'right', 6: 'right' }, { 4: NUM_FMTS.number, 5: NUM_FMTS.currency, 6: NUM_FMTS.percent });

  autoFitColumns(ws);
  const filename = `Laporan_Metode_Pembayaran_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 10. DAFTAR TRANSAKSI PENJUALAN (SALES TRANSACTIONS)
// ============================================================================
export async function exportSalesTransactionsToExcel({
  items = [],
  summary = {},
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Daftar Transaksi', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN DETAIL TRANSAKSI PENJUALAN KASIR', periodText: periodStr, outletName, colSpan: 16, titleColor: 'FF1E40AF' });
  addTableHeader(ws, [
    'No', 'No. Nota / TRX', 'Tanggal', 'Jam', 'Tipe Order', 'Meja', 'Pelanggan',
    'Kasir', 'Shift', 'Metode Bayar', 'Subtotal (Rp)', 'Diskon (Rp)', 'Total Bayar (Rp)',
    'Uang Diterima (Rp)', 'Kembalian (Rp)', 'Status'
  ], 'FF1E293B');

  let totSubtotal = 0, totDisc = 0, totNet = 0;
  items.forEach((t, idx) => {
    const sub = Number(t.subtotal || t.total_price) || 0;
    const disc = Number(t.discount_amount) || 0;
    const net = Number(t.total_price) || 0;
    totSubtotal += sub; totDisc += disc; totNet += net;

    const row = ws.addRow([
      idx + 1,
      t.order_number || `TRX-${t.id}`,
      t.date || '-',
      t.time || (t.created_at ? t.created_at.slice(11, 16) : '-'),
      t.order_type || 'DINE_IN',
      t.table_number || '-',
      t.customer_name || 'Pelanggan Umum',
      t.user?.name || t.cashier_name || 'Kasir',
      t.shift?.shift_name || (t.shift_id ? `Shift ${t.shift_id}` : 'Reguler'),
      t.payment_method || 'CASH',
      sub,
      disc,
      net,
      Number(t.amount_paid) || 0,
      Number(t.change_amount) || 0,
      t.status || 'PAID',
    ]);

    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'center', 3: 'center', 4: 'center', 5: 'center', 6: 'center',
      7: 'left', 8: 'left', 9: 'center', 10: 'center', 11: 'right', 12: 'right',
      13: 'right', 14: 'right', 15: 'right', 16: 'center'
    }, {
      11: NUM_FMTS.currency, 12: NUM_FMTS.currency, 13: NUM_FMTS.currency,
      14: NUM_FMTS.currency, 15: NUM_FMTS.currency
    });
  });

  const totRow = ws.addRow(['TOTAL KESELURUHAN', '', '', '', '', '', '', '', '', '', totSubtotal, totDisc, totNet, '', '', '']);
  ws.mergeCells(`A${totRow.number}:J${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 11: 'right', 12: 'right', 13: 'right' }, {
    11: NUM_FMTS.currency, 12: NUM_FMTS.currency, 13: NUM_FMTS.currency
  });

  autoFitColumns(ws);
  const filename = `Laporan_Transaksi_Penjualan_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 11. PENJUALAN PER PELANGGAN (SALES BY CUSTOMER)
// ============================================================================
export async function exportSalesByCustomerToExcel({
  items = [],
  summary = {},
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Penjualan per Pelanggan', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN ANALISIS PENJUALAN PER PELANGGAN', periodText: periodStr, outletName, colSpan: 9, titleColor: 'FF047857' });
  addTableHeader(ws, ['No', 'Nama Pelanggan', 'No. Telepon', 'Kategori Member', 'Total Kunjungan', 'Total Belanja (Rp)', 'Rata-rata / Kunjungan (Rp)', 'Total Poin', 'Kunjungan Terakhir'], 'FF065F46');

  let totSpend = 0, totVisits = 0;
  items.forEach((c, idx) => {
    const spend = Number(c.total_spent || c.total_sales) || 0;
    const visits = Number(c.total_visits || c.visits) || 0;
    totSpend += spend; totVisits += visits;

    const row = ws.addRow([
      idx + 1,
      c.name || 'Pelanggan Umum',
      c.phone || '-',
      c.tier || c.category || 'REGULAR',
      visits,
      spend,
      visits > 0 ? Math.round(spend / visits) : spend,
      Number(c.points) || 0,
      c.last_visit || '-',
    ]);
    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'left', 3: 'center', 4: 'center', 5: 'right',
      6: 'right', 7: 'right', 8: 'right', 9: 'center'
    }, { 5: NUM_FMTS.number, 6: NUM_FMTS.currency, 7: NUM_FMTS.currency, 8: NUM_FMTS.number });
  });

  const totRow = ws.addRow(['TOTAL KESELURUHAN', '', '', '', totVisits, totSpend, totVisits > 0 ? Math.round(totSpend / totVisits) : 0, '', '']);
  ws.mergeCells(`A${totRow.number}:D${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 5: 'right', 6: 'right', 7: 'right' }, { 5: NUM_FMTS.number, 6: NUM_FMTS.currency, 7: NUM_FMTS.currency });

  autoFitColumns(ws);
  const filename = `Laporan_Pelanggan_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 12. ANALISIS JAM RAMAI (PEAK HOURS)
// ============================================================================
export async function exportPeakHoursToExcel({
  items = [],
  summary = {},
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Jam Ramai', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN ANALISIS JAM RAMAI (PEAK HOURS)', periodText: periodStr, outletName, colSpan: 6, titleColor: 'FFE11D48' });
  addTableHeader(ws, ['No', 'Rentang Jam Operasional', 'Jumlah Transaksi', 'Total Qty Terjual', 'Total Omset Penjualan (Rp)', 'Kontribusi (%)'], 'FFBE123C');

  let totTrx = 0, totQty = 0, totOmset = 0;
  items.forEach((h, idx) => {
    const trx = Number(h.transaction_count || h.count) || 0;
    const qty = Number(h.qty_sold || h.qty) || 0;
    const omset = Number(h.total_sales || h.total) || 0;
    totTrx += trx; totQty += qty; totOmset += omset;

    const row = ws.addRow([
      idx + 1,
      h.hour_range || `${h.hour}:00 - ${h.hour}:59`,
      trx,
      qty,
      omset,
      (Number(h.percentage) || 0) / 100,
    ]);
    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'center', 3: 'right', 4: 'right', 5: 'right', 6: 'right'
    }, { 3: NUM_FMTS.number, 4: NUM_FMTS.number, 5: NUM_FMTS.currency, 6: NUM_FMTS.percent });
  });

  const totRow = ws.addRow(['TOTAL KESELURUHAN', '', totTrx, totQty, totOmset, 1.0]);
  ws.mergeCells(`A${totRow.number}:B${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 3: 'right', 4: 'right', 5: 'right', 6: 'right' }, { 3: NUM_FMTS.number, 4: NUM_FMTS.number, 5: NUM_FMTS.currency, 6: NUM_FMTS.percent });

  autoFitColumns(ws);
  const filename = `Laporan_Jam_Ramai_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 13. PIUTANG PELANGGAN (CUSTOMER RECEIVABLES / KASBON)
// ============================================================================
export async function exportCustomerReceivablesToExcel({
  items = [],
  summary = {},
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Piutang Pelanggan', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN DAFTAR PIUTANG PELANGGAN & KASBON KASIR', periodText: periodStr, outletName, colSpan: 12, titleColor: 'FF0D9488' });
  addTableHeader(ws, ['No', 'No. Piutang', 'No. Nota', 'Nama Pelanggan', 'No. Telepon', 'Tanggal Nota', 'Jatuh Tempo', 'Total Kasbon (Rp)', 'Terbayar / DP (Rp)', 'Sisa Piutang (Rp)', 'Status Bayar', 'Catatan'], 'FF115E59');

  let totTagihan = 0, totBayar = 0, totSisa = 0;
  items.forEach((item, idx) => {
    const t = Number(item.total_amount) || 0;
    const p = Number(item.paid_amount) || 0;
    const r = Number(item.remaining_amount) || 0;
    totTagihan += t; totBayar += p; totSisa += r;

    const row = ws.addRow([
      idx + 1,
      item.receivable_no || `AR-${item.id}`,
      item.order_number || '-',
      item.customer_name || '-',
      item.customer_phone || '-',
      item.issue_date || '-',
      item.due_date || '-',
      t,
      p,
      r,
      item.status || 'UNPAID',
      item.notes || '-',
    ]);
    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'center', 3: 'center', 4: 'left', 5: 'center',
      6: 'center', 7: 'center', 8: 'right', 9: 'right', 10: 'right', 11: 'center', 12: 'left'
    }, { 8: NUM_FMTS.currency, 9: NUM_FMTS.currency, 10: NUM_FMTS.currency });
  });

  const totRow = ws.addRow(['TOTAL KESELURUHAN PIUTANG', '', '', '', '', '', '', totTagihan, totBayar, totSisa, '', '']);
  ws.mergeCells(`A${totRow.number}:G${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 8: 'right', 9: 'right', 10: 'right' }, { 8: NUM_FMTS.currency, 9: NUM_FMTS.currency, 10: NUM_FMTS.currency });

  autoFitColumns(ws);
  const filename = `Laporan_Piutang_Pelanggan_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 14. KINERJA PROMO & DISKON
// ============================================================================
export async function exportPromosToExcel({
  items = [],
  summary = {},
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Kinerja Promo', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN EVALUASI EFEKTIVITAS PROMO & DISKON', periodText: periodStr, outletName, colSpan: 7, titleColor: 'FFD97706' });
  addTableHeader(ws, ['No', 'Nama Promo / Voucher', 'Kode Promo', 'Tipe Diskon', 'Besaran Diskon', 'Frekuensi Pemakaian', 'Total Diskon Diberikan (Rp)'], 'FFB45309');

  let totCount = 0, totDisc = 0;
  items.forEach((p, idx) => {
    const c = Number(p.used_count || p.count) || 0;
    const d = Number(p.total_discount || p.discount_amount) || 0;
    totCount += c; totDisc += d;

    const row = ws.addRow([
      idx + 1,
      p.name || '-',
      p.code || '-',
      p.type || 'PERCENTAGE',
      p.type === 'PERCENTAGE' ? `${p.value || p.rate || 0}%` : (Number(p.value || p.rate) || 0),
      c,
      d,
    ]);
    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'left', 3: 'center', 4: 'center', 5: 'right', 6: 'right', 7: 'right'
    }, { 6: NUM_FMTS.number, 7: NUM_FMTS.currency });
  });

  const totRow = ws.addRow(['TOTAL KESELURUHAN', '', '', '', '', totCount, totDisc]);
  ws.mergeCells(`A${totRow.number}:E${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 6: 'right', 7: 'right' }, { 6: NUM_FMTS.number, 7: NUM_FMTS.currency });

  autoFitColumns(ws);
  const filename = `Laporan_Promo_Diskon_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 15. HUTANG SUPPLIER (SUPPLIER PAYABLES)
// ============================================================================
export async function exportSupplierPayablesToExcel({
  rows = [],
  items = [],
  period = {},
  outletName = 'Semua Cabang',
  businessName = 'URBAE CAFFEINE',
  summary = {},
}) {
  const dataList = items.length > 0 ? items : rows;
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Hutang Supplier', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN DAFTAR HUTANG SUPPLIER & VENDOR (AP)', periodText: periodStr, outletName, colSpan: 11, titleColor: 'FF4338CA' });
  addTableHeader(ws, ['No', 'Supplier / Tanggal', 'Tgl Dibuat', 'Dibuat Oleh', 'No. Pembelian', 'No. Bukti Bayar', 'Jatuh Tempo', 'Hutang Awal (Rp)', 'Dibayar (Rp)', 'Sisa Hutang (Rp)', 'Total Hutang (Rp)'], 'FF3730A3');

  let totHutang = 0, totDibayar = 0, totSisa = 0;
  dataList.forEach((r, idx) => {
    const h = Number(r.hutang) || 0;
    const d = Number(r.dibayar) || 0;
    const s = Number(r.sisa_hutang) || 0;
    totHutang += h; totDibayar += d; totSisa += s;

    const row = ws.addRow([
      idx + 1,
      r.supplier_tanggal || (r.supplier_name ? `${r.supplier_name} - ${r.tgl_dibuat_fmt || r.tgl_dibuat || ''}` : '-'),
      r.tgl_dibuat_fmt || r.tgl_dibuat || '-',
      r.dibuat_oleh || 'Admin',
      r.no_pembelian || '-',
      r.no_bayar || '-',
      r.jatuh_tempo_fmt || r.jatuh_tempo || '-',
      h,
      d,
      s,
      Number(r.total_hutang) || h,
    ]);

    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'left', 3: 'center', 4: 'left', 5: 'center',
      6: 'center', 7: 'center', 8: 'right', 9: 'right', 10: 'right', 11: 'right'
    }, { 8: NUM_FMTS.currency, 9: NUM_FMTS.currency, 10: NUM_FMTS.currency, 11: NUM_FMTS.currency });
  });

  const totRow = ws.addRow(['TOTAL UTANG USAHA', '', '', '', '', '', '', totHutang, Number(summary.total_dibayar) || totDibayar, Number(summary.total_sisa_hutang) || totSisa, Number(summary.total_hutang) || totHutang]);
  ws.mergeCells(`A${totRow.number}:G${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 8: 'right', 9: 'right', 10: 'right', 11: 'right' }, { 8: NUM_FMTS.currency, 9: NUM_FMTS.currency, 10: NUM_FMTS.currency, 11: NUM_FMTS.currency });

  autoFitColumns(ws);
  const filename = `Laporan_Hutang_Supplier_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

export function printSupplierPayablesReport({
  rows = [],
  period = {},
  outletName = 'Semua Cabang',
  summary = {},
}) {
  const periodText = formatIndoPeriod(period);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up browser diblokir. Harap izinkan pop-up untuk mencetak laporan.');
    return;
  }

  const numFmt = (val) =>
    Number(val || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const tableRowsHtml = rows
    .map(
      (r, idx) => `
    <tr>
      <td style="text-align:center;">${idx + 1}</td>
      <td>${r.supplier_tanggal || r.supplier_name || '-'}</td>
      <td style="text-align:center;">${r.tgl_dibuat_fmt || r.tgl_dibuat || '-'}</td>
      <td>${r.dibuat_oleh || 'Admin'}</td>
      <td style="text-align:center;">${r.no_pembelian || '-'}</td>
      <td style="text-align:center;">${r.no_bayar || '-'}</td>
      <td style="text-align:center;">${r.jatuh_tempo_fmt || r.jatuh_tempo || '-'}</td>
      <td style="text-align:right;">Rp ${numFmt(r.hutang)}</td>
      <td style="text-align:right;">Rp ${numFmt(r.dibayar)}</td>
      <td style="text-align:right; font-weight:bold; color:#dc2626;">Rp ${numFmt(r.sisa_hutang)}</td>
      <td style="text-align:right;">Rp ${numFmt(r.total_hutang)}</td>
    </tr>
  `
    )
    .join('');

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>LAPORAN HUTANG SUPPLIER</title>
    <style>
      @page { size: landscape; margin: 10mm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 15px; }
      .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
      .title { font-size: 16px; font-weight: bold; color: #1e293b; }
      .subtitle { font-size: 11px; font-style: italic; margin-top: 4px; color: #64748b; }
      .meta { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; margin-top: 5px; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; }
      th { background-color: #1e293b; color: #ffffff; font-weight: bold; text-align: center; }
      .footer-total { font-weight: bold; background-color: #f1f5f9; }
      @media print { th { background-color: #1e293b !important; color: #ffffff !important; -webkit-print-color-adjust: exact; } }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="title">LAPORAN HUTANG SUPPLIER & VENDOR (AP)</div>
      <div class="subtitle">${periodText}</div>
    </div>
    <div class="meta">
      <div><strong>Cabang:</strong> ${outletName}</div>
      <div><strong>Dicetak Pada:</strong> ${new Date().toLocaleString('id-ID')}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 35px;">No.</th>
          <th>Supplier/Tanggal</th>
          <th style="width: 85px;">Tgl. Dibuat</th>
          <th style="width: 90px;">Dibuat Oleh</th>
          <th style="width: 110px;">No.Pembelian</th>
          <th style="width: 120px;">No.Bayar</th>
          <th style="width: 85px;">Jatuh Tempo</th>
          <th style="width: 95px;">Hutang</th>
          <th style="width: 95px;">Dibayar</th>
          <th style="width: 95px;">Sisa Hutang</th>
          <th style="width: 95px;">Total Hutang</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml || '<tr><td colspan="11" style="text-align:center; padding:15px;">Tidak ada data hutang untuk periode ini</td></tr>'}
      </tbody>
      <tfoot>
        <tr class="footer-total">
          <td colspan="7" style="text-align: right; padding-right: 12px; font-weight:bold;">Total Utang</td>
          <td style="text-align: right;">Rp ${numFmt(summary.total_hutang || 0)}</td>
          <td style="text-align: right;">Rp ${numFmt(summary.total_dibayar || 0)}</td>
          <td style="text-align: right; color:#dc2626;">Rp ${numFmt(summary.total_sisa_hutang || 0)}</td>
          <td style="text-align: right;">Rp ${numFmt(summary.total_hutang || 0)}</td>
        </tr>
      </tfoot>
    </table>
    <script>window.onload = function() { window.print(); };</script>
  </body>
  </html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

// ============================================================================
// 16. LAPORAN POSISI KEUANGAN / NERACA (BALANCE SHEET)
// ============================================================================
export async function exportBalanceSheetToExcel({
  data = {},
  period = {},
  businessName = 'MOVA POS',
  outletName = 'Semua Cabang',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Laporan Neraca', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN POSISI KEUANGAN (NERACA SALDO AKUNTANSI)', periodText: periodStr, outletName, colSpan: 6, titleColor: 'FF0F766E' });
  addTableHeader(ws, ['Kode Akun', 'Pos / Nama Akun Neraca', 'Saldo Awal (Rp)', 'Debit Periode (Rp)', 'Kredit Periode (Rp)', 'Saldo Akhir (Rp)'], 'FF065F46');

  const sections = [
    { title: '1. AKTIVA / ASET', items: data.assets || [], total: data.total_assets || 0, bg: 'FFECFDF5' },
    { title: '2. KEWAJIBAN / HUTANG', items: data.liabilities || [], total: data.total_liabilities || 0, bg: 'FFFEF3C7' },
    { title: '3. EKUITAS / MODAL', items: data.equity || [], total: data.total_equity || 0, bg: 'FFEFF6FF' },
  ];

  sections.forEach((sec) => {
    // Section header
    const sRow = ws.addRow([`--- ${sec.title} ---`, '', '', '', '', '']);
    ws.mergeCells(`A${sRow.number}:F${sRow.number}`);
    sRow.height = 24;
    sRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sec.bg } };
      cell.border = BORDERS.section;
    });

    sec.items.forEach((acc, idx) => {
      const row = ws.addRow([
        acc.code || '-',
        acc.name || '-',
        Number(acc.saldo_awal) || 0,
        Number(acc.debit) || 0,
        Number(acc.credit) || 0,
        Number(acc.balance || acc.saldo_akhir || acc.amount) || 0,
      ]);
      applyDataRowStyle(row, idx % 2 === 1, { 1: 'center', 2: 'left', 3: 'right', 4: 'right', 5: 'right', 6: 'right' }, {
        3: NUM_FMTS.currency, 4: NUM_FMTS.currency, 5: NUM_FMTS.currency, 6: NUM_FMTS.currency
      });
    });

    const totSec = ws.addRow([`TOTAL ${sec.title}`, '', '', '', '', Number(sec.total) || 0]);
    ws.mergeCells(`A${totSec.number}:E${totSec.number}`);
    applyTotalRowStyle(totSec, { 1: 'right', 6: 'right' }, { 6: NUM_FMTS.currency });
    ws.addRow([]); // Blank spacer
  });

  // Grand Summary of Balance Sheet
  const totKewajibanEkuitas = (Number(data.total_liabilities) || 0) + (Number(data.total_equity) || 0);
  const diff = (Number(data.total_assets) || 0) - totKewajibanEkuitas;

  const finRow1 = ws.addRow(['TOTAL AKTIVA / ASET', '', '', '', '', Number(data.total_assets) || 0]);
  ws.mergeCells(`A${finRow1.number}:E${finRow1.number}`);
  applyTotalRowStyle(finRow1, { 1: 'right', 6: 'right' }, { 6: NUM_FMTS.currency });

  const finRow2 = ws.addRow(['TOTAL KEWAJIBAN & EKUITAS', '', '', '', '', totKewajibanEkuitas]);
  ws.mergeCells(`A${finRow2.number}:E${finRow2.number}`);
  applyTotalRowStyle(finRow2, { 1: 'right', 6: 'right' }, { 6: NUM_FMTS.currency });

  const finRow3 = ws.addRow([`STATUS KESEIMBANGAN: ${Math.abs(diff) < 0.01 ? 'SEIMBANG (Rp 0)' : 'SELISIH BALANCE'}`, '', '', '', '', diff]);
  ws.mergeCells(`A${finRow3.number}:E${finRow3.number}`);
  applyTotalRowStyle(finRow3, { 1: 'right', 6: 'right' }, { 6: NUM_FMTS.currency });

  autoFitColumns(ws);
  const filename = `Laporan_Neraca_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

export function printBalanceSheetReport({
  data = {},
  period = {},
  businessName = 'MOVA POS',
  outletName = 'Semua Cabang',
}) {
  const periodText = formatIndoPeriod(period);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const fmt = (n) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);

  const renderSection = (title, items = [], total = 0, color = '#0f766e') => `
    <tr style="background:#f1f5f9; font-weight:bold;">
      <td colspan="3" style="padding:8px 10px; color:${color}; font-size:12px;">${title}</td>
    </tr>
    ${items.map(acc => `
      <tr>
        <td style="padding:6px 10px; font-family:monospace; width:100px;">${acc.code || '-'}</td>
        <td style="padding:6px 10px;">${acc.name || '-'}</td>
        <td style="padding:6px 10px; text-align:right; font-family:monospace; width:150px;">${fmt(acc.balance || acc.amount || acc.saldo_akhir)}</td>
      </tr>
    `).join('')}
    <tr style="background:#f8fafc; font-weight:bold; border-top:1px solid #cbd5e1; border-bottom:2px solid #0f172a;">
      <td colspan="2" style="padding:6px 10px; text-align:right;">TOTAL ${title}</td>
      <td style="padding:6px 10px; text-align:right; font-family:monospace;">${fmt(total)}</td>
    </tr>
  `;

  const totKewajibanEkuitas = (Number(data.total_liabilities) || 0) + (Number(data.total_equity) || 0);
  const diff = (Number(data.total_assets) || 0) - totKewajibanEkuitas;

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Laporan Neraca - ${businessName}</title>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #1e293b; font-size: 11.5px; }
      .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
      .header h1 { margin: 0; font-size: 16px; color: #0f172a; }
      .header p { margin: 3px 0 0; color: #64748b; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th { background: #0f172a; color: #ffffff; padding: 8px 10px; text-align: left; }
      td { border-bottom: 1px solid #e2e8f0; }
      @media print { body { margin: 10mm; } }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>${businessName}</h1>
      <p><strong>LAPORAN POSISI KEUANGAN (NERACA)</strong></p>
      <p>${periodText} | Outlet: ${outletName}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>KODE AKUN</th>
          <th>POS NERACA / AKUN COA</th>
          <th style="text-align:right;">SALDO AKHIR</th>
        </tr>
      </thead>
      <tbody>
        ${renderSection('1. AKTIVA / ASET', data.assets, data.total_assets, '#047857')}
        ${renderSection('2. KEWAJIBAN / HUTANG', data.liabilities, data.total_liabilities, '#b45309')}
        ${renderSection('3. EKUITAS / MODAL', data.equity, data.total_equity, '#1d4ed8')}
      </tbody>
      <tfoot>
        <tr style="background:#e2e8f0; font-weight:bold; font-size:12px;">
          <td colspan="2" style="padding:8px 10px; text-align:right;">TOTAL AKTIVA / ASET</td>
          <td style="padding:8px 10px; text-align:right; font-family:monospace;">${fmt(data.total_assets)}</td>
        </tr>
        <tr style="background:#e2e8f0; font-weight:bold; font-size:12px;">
          <td colspan="2" style="padding:8px 10px; text-align:right;">TOTAL KEWAJIBAN & EKUITAS</td>
          <td style="padding:8px 10px; text-align:right; font-family:monospace;">${fmt(totKewajibanEkuitas)}</td>
        </tr>
        <tr style="background:${Math.abs(diff) < 0.01 ? '#dcfce7' : '#fee2e2'}; font-weight:bold;">
          <td colspan="2" style="padding:6px 10px; text-align:right;">STATUS KESEIMBANGAN</td>
          <td style="padding:6px 10px; text-align:right; font-family:monospace;">${Math.abs(diff) < 0.01 ? 'SEIMBANG (Rp 0)' : 'SELISIH: ' + fmt(diff)}</td>
        </tr>
      </tfoot>
    </table>
    <script>window.onload = function() { window.print(); };</script>
  </body>
  </html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

// ============================================================================
// 17. RINCIAN AUDIT AKUN NERACA (BALANCE SHEET DETAIL)
// ============================================================================
export async function exportBalanceSheetDetailToExcel({
  detailData,
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
}) {
  if (!detailData) return;
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const sheetName = (detailData.account_name || 'Rincian').substring(0, 31).replace(/[\\/*?:[\]]/g, '_');
  const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, {
    businessName,
    reportTitle: `RINCIAN AUDIT AKUN NERACA: [${detailData.account_code || ''}] ${detailData.account_name || ''}`,
    periodText: periodStr,
    outletName,
    colSpan: (detailData.columns?.length || 4) + 1,
    titleColor: 'FF0F766E',
  });

  // Key Information Box
  const infoRows = [
    ['Kategori / Pos Akun', detailData.category_label || detailData.account_type || '-'],
    ['Total Nilai Akun', Number(detailData.amount) || 0],
    ['Rumus / Dasar Perhitungan', detailData.formula || '-'],
    ['Penjelasan Sumber Data', detailData.explanation || '-'],
  ];

  infoRows.forEach((info, idx) => {
    const row = ws.addRow(info);
    row.height = 20;
    row.getCell(1).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF334155' } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    row.getCell(1).border = BORDERS.thin;
    row.getCell(2).font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF0F172A' } };
    row.getCell(2).border = BORDERS.thin;
    if (idx === 1) row.getCell(2).numFmt = NUM_FMTS.currency;
  });

  ws.addRow([]); // Spacer

  if (detailData.columns && detailData.columns.length > 0 && detailData.items && detailData.items.length > 0) {
    const headers = ['No', ...detailData.columns.map(c => c.label)];
    addTableHeader(ws, headers, 'FF1E293B');

    detailData.items.forEach((item, idx) => {
      const rowValues = [idx + 1];
      detailData.columns.forEach(col => {
        const val = item[col.key];
        rowValues.push(val !== undefined && val !== null ? val : '-');
      });
      const row = ws.addRow(rowValues);
      applyDataRowStyle(row, idx % 2 === 1);
    });
  }

  autoFitColumns(ws);
  const safeCode = (detailData.account_code || 'Detail').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Rincian_Neraca_${safeCode}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 18. JURNAL UMUM & BUKU BESAR (GENERAL LEDGER)
// ============================================================================
export async function exportJournalLedgerToExcel({
  data,
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
}) {
  if (!data) return;
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Buku Besar Ringkasan', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, {
    businessName,
    reportTitle: 'JURNAL UMUM & BUKU BESAR (GENERAL LEDGER SUMMARY)',
    periodText: periodStr,
    outletName,
    colSpan: 9,
    titleColor: 'FF1E40AF',
  });

  // KPI Summary Card Block
  const kpiRow1 = ws.addRow(['Total Debit Periode', Number(data.summary?.total_debit) || 0, '', 'Total Kredit Periode', Number(data.summary?.total_credit) || 0]);
  const kpiRow2 = ws.addRow(['Status Keseimbangan', data.summary?.is_balanced ? 'SEIMBANG (Rp 0)' : 'SELISIH BALANCE', '', 'Selisih Nilai (Diff)', Number(data.summary?.difference) || 0]);
  
  [kpiRow1, kpiRow2].forEach(row => {
    row.height = 21;
    row.getCell(1).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF334155' } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    row.getCell(1).border = BORDERS.thin;
    row.getCell(2).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    row.getCell(2).border = BORDERS.thin;
    row.getCell(4).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF334155' } };
    row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    row.getCell(4).border = BORDERS.thin;
    row.getCell(5).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    row.getCell(5).border = BORDERS.thin;
  });
  kpiRow1.getCell(2).numFmt = NUM_FMTS.currency;
  kpiRow1.getCell(5).numFmt = NUM_FMTS.currency;
  kpiRow2.getCell(5).numFmt = NUM_FMTS.currency;

  ws.addRow([]); // Spacer

  addTableHeader(ws, ['No', 'Kode Akun', 'Nama Akun COA', 'Kategori', 'Saldo Normal', 'Debit Periode (Rp)', 'Kredit Periode (Rp)', 'Saldo Akhir (Rp)', 'Jml Mutasi'], 'FF1E293B');

  let counter = 1;
  (data.groups || []).forEach(group => {
    const gRow = ws.addRow([`--- ${group.label.toUpperCase()} ---`, '', '', '', '', '', '', '', '']);
    ws.mergeCells(`A${gRow.number}:I${gRow.number}`);
    gRow.height = 24;
    gRow.eachCell(cell => {
      cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = BORDERS.section;
    });

    let gDebit = 0, gCredit = 0;
    (group.accounts || []).forEach(acc => {
      const d = Number(acc.period_debit) || 0;
      const c = Number(acc.period_credit) || 0;
      gDebit += d; gCredit += c;

      const row = ws.addRow([
        counter++,
        acc.code || '-',
        acc.name || '-',
        acc.category || acc.type || '-',
        acc.normal_balance || 'DEBIT',
        d,
        c,
        Number(acc.saldo_akhir) || 0,
        Number(acc.tx_count) || 0,
      ]);

      applyDataRowStyle(row, counter % 2 === 1, {
        1: 'center', 2: 'center', 3: 'left', 4: 'left', 5: 'center',
        6: 'right', 7: 'right', 8: 'right', 9: 'center'
      }, {
        6: NUM_FMTS.currency, 7: NUM_FMTS.currency, 8: NUM_FMTS.currency, 9: NUM_FMTS.number
      });
    });

    const subRow = ws.addRow([`SUBTOTAL ${group.label.toUpperCase()}`, '', '', '', '', gDebit, gCredit, '', '']);
    ws.mergeCells(`A${subRow.number}:E${subRow.number}`);
    applyTotalRowStyle(subRow, { 1: 'right', 6: 'right', 7: 'right' }, { 6: NUM_FMTS.currency, 7: NUM_FMTS.currency });
    ws.addRow([]); // Spacer
  });

  const grandRow = ws.addRow([
    'TOTAL KESELURUHAN MUTASI BUKU BESAR', '', '', '', '',
    Number(data.summary?.total_debit) || 0,
    Number(data.summary?.total_credit) || 0,
    '', ''
  ]);
  ws.mergeCells(`A${grandRow.number}:E${grandRow.number}`);
  applyTotalRowStyle(grandRow, { 1: 'right', 6: 'right', 7: 'right' }, { 6: NUM_FMTS.currency, 7: NUM_FMTS.currency });

  autoFitColumns(ws);
  const filename = `Buku_Besar_Jurnal_${period?.from || 'start'}_sd_${period?.to || 'end'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 19. MUTASI AKUN BUKU BESAR SPESIFIK (ACCOUNT TRANSACTIONS)
// ============================================================================
export async function exportAccountTransactionsToExcel({
  account,
  summary,
  items = [],
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const sheetName = (account?.name || 'Mutasi Akun').substring(0, 31).replace(/[\\/*?:[\]]/g, '_');
  const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, {
    businessName,
    reportTitle: `BUKU BESAR MUTASI AKUN: [${account?.code || ''}] ${account?.name || ''}`,
    periodText: periodStr,
    outletName,
    colSpan: 10,
    titleColor: 'FF1E40AF',
  });

  // KPI Summary Card Block
  const kpiRow1 = ws.addRow(['Saldo Normal', account?.normal_balance || 'DEBIT', '', 'Saldo Awal Periode', Number(summary?.saldo_awal) || 0]);
  const kpiRow2 = ws.addRow(['Total Debit Periode', Number(summary?.total_debit) || 0, '', 'Total Kredit Periode', Number(summary?.total_credit) || 0]);
  const kpiRow3 = ws.addRow(['Saldo Akhir Periode', Number(summary?.saldo_akhir) || 0, '', 'Total Rekaman Mutasi', items.length]);

  [kpiRow1, kpiRow2, kpiRow3].forEach(row => {
    row.height = 21;
    row.getCell(1).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF334155' } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    row.getCell(1).border = BORDERS.thin;
    row.getCell(2).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    row.getCell(2).border = BORDERS.thin;
    row.getCell(4).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF334155' } };
    row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    row.getCell(4).border = BORDERS.thin;
    row.getCell(5).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    row.getCell(5).border = BORDERS.thin;
  });
  kpiRow1.getCell(5).numFmt = NUM_FMTS.currency;
  kpiRow2.getCell(2).numFmt = NUM_FMTS.currency;
  kpiRow2.getCell(5).numFmt = NUM_FMTS.currency;
  kpiRow3.getCell(2).numFmt = NUM_FMTS.currency;

  ws.addRow([]); // Spacer

  addTableHeader(ws, ['No', 'Tanggal', 'No. Bukti Jurnal', 'Tipe Jurnal', 'Cabang / Outlet', 'Keterangan / Memo Transaksi', 'Debit (Rp)', 'Kredit (Rp)', 'Saldo Berjalan (Rp)', 'Petugas / Pembuat'], 'FF1E293B');

  // Row 1: Saldo Awal
  const initRow = ws.addRow(['-', period?.from || '-', 'SALDO AWAL', 'OPENING', outletName, 'Saldo Awal Periode Buku', 0, 0, Number(summary?.saldo_awal) || 0, 'Sistem Akuntansi']);
  applyDataRowStyle(initRow, true, {
    1: 'center', 2: 'center', 3: 'center', 4: 'center', 5: 'left',
    6: 'left', 7: 'right', 8: 'right', 9: 'right', 10: 'left'
  }, { 7: NUM_FMTS.currency, 8: NUM_FMTS.currency, 9: NUM_FMTS.currency });

  items.forEach((item, idx) => {
    const row = ws.addRow([
      idx + 1,
      item.date || '-',
      item.entry_no || '-',
      item.entry_type || '-',
      item.outlet_name || outletName,
      item.description || '-',
      Number(item.debit) || 0,
      Number(item.credit) || 0,
      Number(item.running_balance) || 0,
      item.creator_name || 'Kasir / Sistem',
    ]);
    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'center', 3: 'center', 4: 'center', 5: 'left',
      6: 'left', 7: 'right', 8: 'right', 9: 'right', 10: 'left'
    }, { 7: NUM_FMTS.currency, 8: NUM_FMTS.currency, 9: NUM_FMTS.currency });
  });

  const totRow = ws.addRow([
    'TOTAL MUTASI & SALDO AKHIR', '', '', '', '', '',
    Number(summary?.total_debit) || 0,
    Number(summary?.total_credit) || 0,
    Number(summary?.saldo_akhir) || 0,
    ''
  ]);
  ws.mergeCells(`A${totRow.number}:F${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 7: 'right', 8: 'right', 9: 'right' }, {
    7: NUM_FMTS.currency, 8: NUM_FMTS.currency, 9: NUM_FMTS.currency
  });

  autoFitColumns(ws);
  const safeCode = (account?.code || 'COA').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Mutasi_Akun_${safeCode}_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

export function printJournalLedgerReport({
  data,
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
}) {
  if (!data) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const fmt = (n) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);

  let rowsHtml = '';
  (data.groups || []).forEach((g) => {
    rowsHtml += `
      <tr style="background:#f1f5f9; font-weight:bold;">
        <td colspan="6" style="padding:8px 10px; color:${g.color || '#1e293b'}; font-size:12px;">${g.label.toUpperCase()}</td>
      </tr>
    `;
    (g.accounts || []).forEach((acc) => {
      rowsHtml += `
        <tr>
          <td style="padding:6px 10px; font-family:monospace; width:100px;">${acc.code}</td>
          <td style="padding:6px 10px; font-weight:600;">${acc.name}</td>
          <td style="padding:6px 10px; text-align:center; font-size:11px; width:90px;">${acc.normal_balance}</td>
          <td style="padding:6px 10px; text-align:right; font-family:monospace; width:130px;">${fmt(acc.period_debit)}</td>
          <td style="padding:6px 10px; text-align:right; font-family:monospace; width:130px;">${fmt(acc.period_credit)}</td>
          <td style="padding:6px 10px; text-align:right; font-family:monospace; font-weight:bold; width:140px;">${fmt(acc.saldo_akhir)}</td>
        </tr>
      `;
    });
  });

  const periodText = formatIndoPeriod(period);
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Laporan Jurnal Umum & Buku Besar - ${businessName}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #1e293b; font-size: 11.5px; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
          .header h1 { margin: 0; font-size: 16px; color: #0f172a; }
          .header p { margin: 3px 0 0; color: #64748b; font-size: 11px; }
          .summary-box { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #0f172a; color: #ffffff; padding: 8px 10px; font-size: 11px; text-align: left; }
          td { border-bottom: 1px solid #e2e8f0; font-size: 11px; }
          @media print { body { margin: 10mm; } th { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${businessName}</h1>
          <p><strong>JURNAL UMUM & BUKU BESAR (GENERAL LEDGER)</strong></p>
          <p>${periodText} | Outlet: ${outletName}</p>
        </div>
        <div class="summary-box">
          <div><strong>Total Debit:</strong> ${fmt(data.summary?.total_debit)}</div>
          <div><strong>Total Kredit:</strong> ${fmt(data.summary?.total_credit)}</div>
          <div><strong>Status:</strong> ${data.summary?.is_balanced ? 'SEIMBANG (Rp 0)' : 'SELISIH: ' + fmt(data.summary?.difference)}</div>
          <div><strong>Total Akun:</strong> ${data.summary?.total_accounts || 0}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>KODE AKUN</th>
              <th>NAMA AKUN COA</th>
              <th style="text-align:center;">SALDO NORMAL</th>
              <th style="text-align:right;">DEBIT PERIODE</th>
              <th style="text-align:right;">KREDIT PERIODE</th>
              <th style="text-align:right;">SALDO AKHIR</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr style="background:#e2e8f0; font-weight:bold;">
              <td colspan="3" style="padding:8px 10px; text-align:right;">TOTAL MUTASI PERIODE</td>
              <td style="padding:8px 10px; text-align:right; font-family:monospace;">${fmt(data.summary?.total_debit)}</td>
              <td style="padding:8px 10px; text-align:right; font-family:monospace;">${fmt(data.summary?.total_credit)}</td>
              <td style="padding:8px 10px; text-align:right; font-family:monospace;">-</td>
            </tr>
          </tfoot>
        </table>
        <script>window.onload = function() { window.print(); };</script>
      </body>
    </html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

// ============================================================================
// 20. LAPORAN PEMBELIAN & RESTOCK (PURCHASE REPORTS)
// ============================================================================
export async function exportPurchaseTransactionsToExcel({
  businessName = 'URBAE CAFFEINE',
  period = '',
  items = [],
  summary = {},
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Transaksi Pembelian', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN DAFTAR TRANSAKSI PEMBELIAN & RESTOCK', periodText: periodStr, colSpan: 12, titleColor: 'FF3730A3' });
  addTableHeader(ws, ['No', 'No. Pembelian', 'Tanggal', 'Supplier / Vendor', 'Gudang / Outlet', 'Status Pembelian', 'Status Bayar', 'Metode Bayar', 'Jatuh Tempo', 'Total Pembelian (Rp)', 'Terbayar (Rp)', 'Sisa Hutang (Rp)'], 'FF312E81');

  let totBeli = 0, totBayar = 0, totSisa = 0;
  items.forEach((p, idx) => {
    const b = Number(p.total_amount || p.total) || 0;
    const d = Number(p.paid_amount || p.paid) || 0;
    const s = Number(p.remaining_amount || p.remaining) || (b - d);
    totBeli += b; totBayar += d; totSisa += s;

    const row = ws.addRow([
      idx + 1,
      p.purchase_no || p.invoice_no || `PO-${p.id}`,
      p.date || p.purchase_date || '-',
      p.supplier?.name || p.supplier_name || '-',
      p.outlet?.name || p.warehouse || 'Gudang Utama',
      p.status || 'COMPLETED',
      p.payment_status || (s <= 0 ? 'PAID' : (d > 0 ? 'PARTIAL' : 'UNPAID')),
      p.payment_method || 'TRANSFER',
      p.due_date || '-',
      b,
      d,
      s,
    ]);
    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'center', 3: 'center', 4: 'left', 5: 'left',
      6: 'center', 7: 'center', 8: 'center', 9: 'center', 10: 'right', 11: 'right', 12: 'right'
    }, { 10: NUM_FMTS.currency, 11: NUM_FMTS.currency, 12: NUM_FMTS.currency });
  });

  const totRow = ws.addRow(['TOTAL KESELURUHAN PEMBELIAN', '', '', '', '', '', '', '', '', totBeli, totBayar, totSisa]);
  ws.mergeCells(`A${totRow.number}:I${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 10: 'right', 11: 'right', 12: 'right' }, { 10: NUM_FMTS.currency, 11: NUM_FMTS.currency, 12: NUM_FMTS.currency });

  autoFitColumns(ws);
  const filename = `Laporan_Pembelian_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

export async function exportPurchasesByProductToExcel({
  businessName = 'URBAE CAFFEINE',
  period = '',
  items = [],
  summary = {},
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Pembelian per Produk', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN PEMBELIAN PER BAHAN BAKU / PRODUK', periodText: periodStr, colSpan: 8, titleColor: 'FF3730A3' });
  addTableHeader(ws, ['No', 'Kode Bahan', 'Nama Bahan Baku', 'Kategori', 'Satuan Beli', 'Total Qty Dibeli', 'Rata-rata Harga Beli (Rp)', 'Total Biaya Pembelian (Rp)'], 'FF312E81');

  let totCost = 0;
  items.forEach((p, idx) => {
    const cost = Number(p.total_cost || p.total) || 0;
    totCost += cost;
    const row = ws.addRow([
      idx + 1,
      p.code || p.ingredient?.code || '-',
      p.name || p.ingredient?.name || '-',
      p.category || p.ingredient?.category || '-',
      p.unit || p.ingredient?.unit_beli || 'kg',
      Number(p.qty_purchased || p.qty) || 0,
      Number(p.avg_price || p.price) || 0,
      cost,
    ]);
    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'center', 3: 'left', 4: 'left', 5: 'center', 6: 'right', 7: 'right', 8: 'right'
    }, { 6: NUM_FMTS.numberDecimal, 7: NUM_FMTS.currency, 8: NUM_FMTS.currency });
  });

  const totRow = ws.addRow(['TOTAL BIAYA PEMBELIAN', '', '', '', '', '', '', totCost]);
  ws.mergeCells(`A${totRow.number}:G${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 8: 'right' }, { 8: NUM_FMTS.currency });

  autoFitColumns(ws);
  const filename = `Laporan_Pembelian_Bahan_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

export async function exportPurchasesBySupplierToExcel({
  businessName = 'URBAE CAFFEINE',
  period = '',
  items = [],
  summary = {},
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Pembelian per Supplier', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN REKAP PEMBELIAN PER SUPPLIER / VENDOR', periodText: periodStr, colSpan: 7, titleColor: 'FF3730A3' });
  addTableHeader(ws, ['No', 'Nama Supplier / Vendor', 'No. Telepon / Kontak', 'Jumlah Transaksi', 'Total Pembelian (Rp)', 'Total Terbayar (Rp)', 'Sisa Hutang (Rp)'], 'FF312E81');

  let totBeli = 0, totBayar = 0, totSisa = 0;
  items.forEach((s, idx) => {
    const b = Number(s.total_purchases || s.total) || 0;
    const p = Number(s.total_paid || s.paid) || 0;
    const r = Number(s.total_remaining || s.remaining) || (b - p);
    totBeli += b; totBayar += p; totSisa += r;

    const row = ws.addRow([
      idx + 1,
      s.name || s.supplier_name || '-',
      s.phone || s.contact || '-',
      Number(s.transactions_count || s.count) || 0,
      b,
      p,
      r,
    ]);
    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'left', 3: 'center', 4: 'right', 5: 'right', 6: 'right', 7: 'right'
    }, { 4: NUM_FMTS.number, 5: NUM_FMTS.currency, 6: NUM_FMTS.currency, 7: NUM_FMTS.currency });
  });

  const totRow = ws.addRow(['TOTAL KESELURUHAN', '', '', '', totBeli, totBayar, totSisa]);
  ws.mergeCells(`A${totRow.number}:D${totRow.number}`);
  applyTotalRowStyle(totRow, { 1: 'right', 5: 'right', 6: 'right', 7: 'right' }, { 5: NUM_FMTS.currency, 6: NUM_FMTS.currency, 7: NUM_FMTS.currency });

  autoFitColumns(ws);
  const filename = `Laporan_Pembelian_Supplier_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

export async function exportPurchaseShipmentsToExcel({
  businessName = 'URBAE CAFFEINE',
  period = '',
  items = [],
  summary = {},
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Status Pengiriman', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, { businessName, reportTitle: 'LAPORAN STATUS PENGIRIMAN & PENERIMAAN PEMBELIAN', periodText: periodStr, colSpan: 8, titleColor: 'FF3730A3' });
  addTableHeader(ws, ['No', 'No. Pembelian', 'Supplier', 'Tanggal Pesan', 'Tanggal Terima / Estimasi', 'Status Pengiriman', 'Diterima Oleh', 'Catatan'], 'FF312E81');

  items.forEach((p, idx) => {
    const row = ws.addRow([
      idx + 1,
      p.purchase_no || `PO-${p.id}`,
      p.supplier?.name || p.supplier_name || '-',
      p.date || '-',
      p.received_date || p.estimated_date || '-',
      p.shipping_status || p.status || 'RECEIVED',
      p.receiver_name || p.received_by_user?.name || 'Staff Gudang',
      p.notes || '-',
    ]);
    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'center', 3: 'left', 4: 'center', 5: 'center', 6: 'center', 7: 'left', 8: 'left'
    });
  });

  autoFitColumns(ws);
  const filename = `Status_Pengiriman_Pembelian_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 21. RIWAYAT PERUBAHAN HPP & KOMPOSISI RESEP (MASTER MENU)
// ============================================================================
export async function exportHppHistoryToExcel({
  selected,
  hppHistoryData,
  businessName = 'MOVA POS',
  outletName = 'Semua Cabang',
}) {
  if (!selected || !hppHistoryData) return;
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();

  // Sheet 1: Riwayat Perubahan HPP
  const ws1 = wb.addWorksheet('Riwayat Perubahan HPP', { views: [{ showGridLines: true }] });
  addReportHeader(ws1, {
    businessName,
    reportTitle: `LAPORAN RIWAYAT PERUBAHAN HPP: [${selected.code || ''}] ${selected.name || ''}`,
    periodText: 'Historical Audit Trail (Moving Average)',
    outletName,
    colSpan: 13,
    titleColor: 'FF2563EB',
  });

  // KPI Header Card
  const kpiRow1 = ws1.addRow(['Harga Jual', Number(selected.price) || 0, '', 'HPP Terkini (Avg)', Number(hppHistoryData.current_hpp) || 0, '', 'Gross Margin Saat Ini', `${hppHistoryData.current_margin_pct || 0}%`]);
  kpiRow1.height = 22;
  kpiRow1.getCell(1).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF334155' } };
  kpiRow1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  kpiRow1.getCell(1).border = BORDERS.thin;
  kpiRow1.getCell(2).numFmt = NUM_FMTS.currency;
  kpiRow1.getCell(4).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF334155' } };
  kpiRow1.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  kpiRow1.getCell(4).border = BORDERS.thin;
  kpiRow1.getCell(5).numFmt = NUM_FMTS.currency;
  kpiRow1.getCell(7).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF334155' } };
  kpiRow1.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  kpiRow1.getCell(7).border = BORDERS.thin;

  ws1.addRow([]); // Spacer

  addTableHeader(ws1, [
    'No', 'Tanggal', 'Cabang', 'Pemicu Perubahan', 'HPP Sebelum (Rp)', 'HPP Sesudah (Rp)',
    'Selisih HPP (Rp)', 'Perubahan %', 'Margin Sebelum', 'Margin Sesudah', 'Bahan Pemicu', 'Catatan / Alasan', 'Petugas'
  ], 'FF1E293B');

  (hppHistoryData.history || []).forEach((h, idx) => {
    const row = ws1.addRow([
      idx + 1,
      h.date || '-',
      h.outlet?.name || 'Semua Cabang',
      h.trigger_type || '-',
      Number(h.hpp_before) || 0,
      Number(h.hpp_after) || 0,
      Number(h.diff) || 0,
      `${h.percentage_change || 0}%`,
      `${h.margin_before_pct || 0}%`,
      `${h.margin_after_pct || 0}%`,
      h.ingredient_name || h.ingredient?.name || '-',
      h.notes || '-',
      h.user?.name || '-',
    ]);
    applyDataRowStyle(row, idx % 2 === 1, {
      1: 'center', 2: 'center', 3: 'left', 4: 'center', 5: 'right', 6: 'right',
      7: 'right', 8: 'right', 9: 'right', 10: 'right', 11: 'left', 12: 'left', 13: 'left'
    }, { 5: NUM_FMTS.currency, 6: NUM_FMTS.currency, 7: NUM_FMTS.currency });
  });
  autoFitColumns(ws1);

  // Sheet 2: Komposisi Bahan Pembentuk HPP (1 Porsi)
  if (hppHistoryData.ingredients_breakdown?.length > 0) {
    const ws2 = wb.addWorksheet('Komposisi Resep 1 Porsi', { views: [{ showGridLines: true }] });
    addReportHeader(ws2, {
      businessName,
      reportTitle: `KOMPOSISI BAHAN PEMBENTUK HPP: [${selected.code || ''}] ${selected.name || ''}`,
      periodText: `Total HPP 1 Porsi: Rp ${Number(hppHistoryData.current_hpp || 0).toLocaleString('id-ID')}`,
      outletName,
      colSpan: 8,
      titleColor: 'FF059669',
    });

    addTableHeader(ws2, ['No', 'Nama Bahan Baku / Olahan', 'Tipe Komponen', 'Takaran 1 Porsi', 'Satuan', 'Harga Satuan Avg (Rp)', 'Subtotal Biaya (Rp)', 'Kontribusi HPP (%)'], 'FF065F46');

    let totCompCost = 0;
    hppHistoryData.ingredients_breakdown.forEach((b, idx) => {
      const sub = Number(b.subtotal) || 0;
      totCompCost += sub;
      const row = ws2.addRow([
        idx + 1,
        b.name || '-',
        b.type || 'RAW',
        Number(b.qty) || 0,
        b.unit || 'g',
        Number(b.cost_per_unit) || 0,
        sub,
        (Number(b.contribution_pct) || 0) / 100,
      ]);
      applyDataRowStyle(row, idx % 2 === 1, {
        1: 'center', 2: 'left', 3: 'center', 4: 'right', 5: 'center', 6: 'right', 7: 'right', 8: 'right'
      }, { 4: NUM_FMTS.numberDecimal, 6: NUM_FMTS.currency, 7: NUM_FMTS.currency, 8: NUM_FMTS.percent });
    });

    const totRow = ws2.addRow(['TOTAL BIAYA HPP PER PORSI', '', '', '', '', '', totCompCost, 1.0]);
    ws2.mergeCells(`A${totRow.number}:F${totRow.number}`);
    applyTotalRowStyle(totRow, { 1: 'right', 7: 'right', 8: 'right' }, { 7: NUM_FMTS.currency, 8: NUM_FMTS.percent });
    autoFitColumns(ws2);
  }

  const safeCode = (selected.code || 'MENU').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Riwayat_HPP_${safeCode}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 22. LAPORAN ARUS KAS NYATA (CASH FLOW STATEMENT)
// ============================================================================
export async function exportCashFlowToExcel({
  statementData,
  period,
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
  userName = 'Administrator',
}) {
  if (!statementData) return;
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Laporan Arus Kas', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, {
    businessName,
    reportTitle: 'LAPORAN ARUS KAS NYATA (CASH FLOW STATEMENT)',
    periodText: periodStr,
    outletName,
    userName,
    colSpan: 5,
    titleColor: 'FF0284C7',
  });

  addTableHeader(ws, ['Kode / Pos', 'Deskripsi Aliran Arus Kas Fisik', 'Arus Masuk (Rp)', 'Arus Keluar (Rp)', 'Arus Kas Bersih (Rp)'], 'FF0369A1');

  const { operating = {}, investing = {}, financing = {}, summary = {} } = statementData;

  const renderSection = (title, inflows = [], outflows = [], netVal = 0, bg = 'FFEFF6FF') => {
    const sRow = ws.addRow([`--- ${title} ---`, '', '', '', '']);
    ws.mergeCells(`A${sRow.number}:E${sRow.number}`);
    sRow.height = 24;
    sRow.eachCell(cell => {
      cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = BORDERS.section;
    });

    inflows.forEach((item, idx) => {
      const row = ws.addRow(['INFLOW', item.label || item.name || '-', Number(item.amount || item.value) || 0, 0, Number(item.amount || item.value) || 0]);
      applyDataRowStyle(row, idx % 2 === 1, { 1: 'center', 2: 'left', 3: 'right', 4: 'right', 5: 'right' }, { 3: NUM_FMTS.currency, 4: NUM_FMTS.currency, 5: NUM_FMTS.currency });
    });

    outflows.forEach((item, idx) => {
      const amt = Number(item.amount || item.value) || 0;
      const row = ws.addRow(['OUTFLOW', item.label || item.name || '-', 0, amt, -amt]);
      applyDataRowStyle(row, (inflows.length + idx) % 2 === 1, { 1: 'center', 2: 'left', 3: 'right', 4: 'right', 5: 'right' }, { 3: NUM_FMTS.currency, 4: NUM_FMTS.currency, 5: NUM_FMTS.currency });
    });

    const totRow = ws.addRow([`ARUS KAS BERSIH ${title}`, '', '', '', Number(netVal) || 0]);
    ws.mergeCells(`A${totRow.number}:D${totRow.number}`);
    applyTotalRowStyle(totRow, { 1: 'right', 5: 'right' }, { 5: NUM_FMTS.currency });
    ws.addRow([]); // Spacer
  };

  const opInflows = Object.entries(operating.inflows || {}).map(([k, v]) => ({ label: k, amount: v }));
  const opOutflows = Object.entries(operating.outflows || {}).map(([k, v]) => ({ label: k, amount: v }));
  renderSection('1. ARUS KAS OPERASIONAL (OPERATING CASH FLOW / OCF)', opInflows, opOutflows, operating.net || summary.net_operating_cash_flow || 0, 'FFECFDF5');

  const invInflows = (investing.breakdown || []).filter(b => b.type === 'INFLOW');
  const invOutflows = (investing.breakdown || []).filter(b => b.type !== 'INFLOW');
  renderSection('2. ARUS KAS INVESTASI / BELANJA MODAL (CAPEX)', invInflows, invOutflows, investing.net || summary.net_investing_cash_flow || 0, 'FFFEF3C7');

  const finInflows = (financing.breakdown || []).filter(b => b.type === 'INFLOW');
  const finOutflows = (financing.breakdown || []).filter(b => b.type !== 'INFLOW');
  renderSection('3. ARUS KAS PENDANAAN & MODAL (FINANCING CASH FLOW)', finInflows, finOutflows, financing.net || summary.net_financing_cash_flow || 0, 'FFEFF6FF');

  const netCashFlow = Number(summary.net_cash_flow) || 0;
  const netRow = ws.addRow(['TOTAL PERUBAHAN BERSIH KAS & SETARA KAS', '', '', '', netCashFlow]);
  ws.mergeCells(`A${netRow.number}:D${netRow.number}`);
  applyTotalRowStyle(netRow, { 1: 'right', 5: 'right' }, { 5: NUM_FMTS.currency });

  autoFitColumns(ws);
  const filename = `Laporan_Arus_Kas_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}

// ============================================================================
// 23. LAPORAN LABA RUGI (PROFIT & LOSS / INCOME STATEMENT)
// ============================================================================
export async function exportProfitLossToExcel({
  reportData = {},
  period = {},
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
  userName = 'Administrator',
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Laporan Laba Rugi', { views: [{ showGridLines: true }] });

  const periodStr = formatIndoPeriod(period);
  addReportHeader(ws, {
    businessName,
    reportTitle: 'LAPORAN LABA RUGI KOMPREHENSIF (PROFIT & LOSS STATEMENT)',
    periodText: periodStr,
    outletName,
    userName,
    colSpan: 4,
    titleColor: 'FF059669',
  });

  addTableHeader(ws, ['Kode Akun / Pos', 'Rincian Komponen Pendapatan & Biaya', 'Nominal (Rp)', '% Kontribusi Omset'], 'FF065F46');

  const rev = Number(reportData.total_revenue || reportData.revenue || 0);
  const hpp = Number(reportData.total_cogs || reportData.total_hpp || reportData.cogs || 0);
  const grossProfit = Number(reportData.gross_profit || (rev - hpp));
  const opex = Number(reportData.total_opex || reportData.total_expense || 0);
  const netProfit = Number(reportData.net_profit || (grossProfit - opex));

  const addPLSection = (title, items = [], totalVal = 0, bg = 'FFF8FAFC') => {
    const sRow = ws.addRow([`--- ${title} ---`, '', '', '']);
    ws.mergeCells(`A${sRow.number}:D${sRow.number}`);
    sRow.height = 24;
    sRow.eachCell(cell => {
      cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = BORDERS.section;
    });

    items.forEach((item, idx) => {
      const amt = Number(item.amount || item.value || item.total) || 0;
      const row = ws.addRow([
        item.code || '-',
        item.name || item.label || '-',
        amt,
        rev > 0 ? (amt / rev) : 0,
      ]);
      applyDataRowStyle(row, idx % 2 === 1, { 1: 'center', 2: 'left', 3: 'right', 4: 'right' }, { 3: NUM_FMTS.currency, 4: NUM_FMTS.percent });
    });

    const totRow = ws.addRow([`TOTAL ${title}`, '', Number(totalVal) || 0, rev > 0 ? (Number(totalVal) / rev) : 0]);
    ws.mergeCells(`A${totRow.number}:B${totRow.number}`);
    applyTotalRowStyle(totRow, { 1: 'right', 3: 'right', 4: 'right' }, { 3: NUM_FMTS.currency, 4: NUM_FMTS.percent });
    ws.addRow([]); // Spacer
  };

  addPLSection('1. PENDAPATAN USAHA (REVENUE)', reportData.revenue_items || [{ label: 'Penjualan F&B Bersih POS', amount: rev }], rev, 'FFECFDF5');
  addPLSection('2. HARGA POKOK PENJUALAN (HPP RIIL)', reportData.cogs_items || [{ label: 'Pemakaian Bahan Baku & Resep', amount: hpp }], hpp, 'FFFEF3C7');

  const gpRow = ws.addRow(['LABA KOTOR (GROSS PROFIT)', '', grossProfit, rev > 0 ? (grossProfit / rev) : 0]);
  ws.mergeCells(`A${gpRow.number}:B${gpRow.number}`);
  applyTotalRowStyle(gpRow, { 1: 'right', 3: 'right', 4: 'right' }, { 3: NUM_FMTS.currency, 4: NUM_FMTS.percent });
  ws.addRow([]); // Spacer

  addPLSection('3. BEBAN OPERASIONAL (OPEX)', reportData.opex_items || [{ label: 'Biaya Operasional Dapur & Outlet', amount: opex }], opex, 'FFFEE2E2');

  const npRow = ws.addRow(['LABA BERSIH OPERASIONAL (NET PROFIT)', '', netProfit, rev > 0 ? (netProfit / rev) : 0]);
  ws.mergeCells(`A${npRow.number}:B${npRow.number}`);
  applyTotalRowStyle(npRow, { 1: 'right', 3: 'right', 4: 'right' }, { 3: NUM_FMTS.currency, 4: NUM_FMTS.percent });

  autoFitColumns(ws);
  const filename = `Laporan_Laba_Rugi_${period?.from || 'all'}_sd_${period?.to || 'all'}.xlsx`;
  await saveWorkbook(wb, filename);
  return filename;
}
