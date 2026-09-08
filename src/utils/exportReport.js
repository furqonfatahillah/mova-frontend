import * as XLSX from 'xlsx';

/**
 * Helper to auto-fit column widths in SheetJS
 */
function fitColumns(rows) {
  const colWidths = [];
  rows.forEach(row => {
    (row || []).forEach((val, idx) => {
      const len = val !== null && val !== undefined ? String(val).length : 0;
      colWidths[idx] = Math.max(colWidths[idx] || 10, Math.min(len + 3, 50));
    });
  });
  return colWidths.map(w => ({ wch: w }));
}

/**
 * 1. Export Dashboard Cost Control & Analytics to Excel
 */
export function exportDashboardToExcel({ data, varData = [], varMenuData = [], period, outletName = 'Semua Cabang', businessName = 'MOVA POS', userName = 'Administrator' }) {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toLocaleString('id-ID');

  const {
    status_counts = {},
    total_variance_value = 0,
    total_variance_loss = 0,
    total_waste_value = 0,
    total_combined_loss = 0,
    top_waste = [],
  } = data || {};

  // ==========================================
  // SHEET 1: RINGKASAN EKSEKUTIF
  // ==========================================
  const summaryRows = [
    ['LAPORAN EKSEKUTIF COST CONTROL & ANALITIK VARIANSI PERSADAAN'],
    ['MOVA POS — Advanced F&B Cost Management System'],
    [],
    ['Bisnis / Brand', businessName],
    ['Gudang / Outlet', outletName],
    ['Periode Audit', `${period.from} s/d ${period.to}`],
    ['Waktu Export', dateStr],
    ['Dicetak Oleh', userName],
    ['Target Laporan', 'Finance / Akuntan, Mitra Pemilik Cabang & Investor'],
    [],
    ['=== INDIKATOR KUNCI COST CONTROL & RESEP ==='],
    ['Metrik Analisis', 'Jumlah / Nilai', 'Satuan', 'Keterangan Akuntansi'],
    ['Bahan Berstatus Normal', status_counts.NORMAL ?? 0, 'Item Bahan', 'Pemakaian dalam batas wajar resep'],
    ['Bahan Berstatus Waspada', status_counts.WASPADA ?? 0, 'Item Bahan', 'Perlu evaluasi porsi & takaran koki'],
    ['Bahan Berstatus Tidak Wajar', status_counts['TIDAK WAJAR'] ?? 0, 'Item Bahan', 'Wajib investigasi kehilangan/kebocoran'],
    ['Total Kerugian Waste Resmi', total_waste_value, 'Rupiah (IDR)', 'Limbah basi, gosong, sortir diakui dapur'],
    ['Total Selisih Tak Terjelaskan (Shrinkage)', total_variance_loss, 'Rupiah (IDR)', 'Anomali selisih fisik vs sistem'],
    ['Total Kerugian F&B Bersih', total_combined_loss, 'Rupiah (IDR)', 'Akumulasi kerugian waste + selisih murni'],
    [],
    ['Catatan Rekomendasi:', 'Lakukan audit berkala pada item berstatus TIDAK WAJAR dan perketat standar pencatatan waste harian.'],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = fitColumns(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Eksekutif');

  // ==========================================
  // SHEET 2: TOP SELISIH BAHAN BAKU
  // ==========================================
  const bahanRows = [
    ['DAFTAR BAHAN BAKU DENGAN ANOMALI / SELISIH TERTINGGI'],
    ['Cabang:', outletName, 'Periode:', `${period.from} s/d ${period.to}`],
    [],
    ['No', 'Kode Bahan', 'Nama Bahan Baku', 'Kategori', 'Satuan Pakai', '% Net Variance', 'Nilai Selisih (Rp)', 'Status Audit'],
  ];

  varData.forEach((iv, idx) => {
    bahanRows.push([
      idx + 1,
      iv.ingredient?.code || '-',
      iv.ingredient?.name || '-',
      iv.ingredient?.category || '-',
      iv.ingredient?.unit_pakai || '-',
      Number((iv.variance_pct || 0).toFixed(2)),
      Math.round(iv.variance_value || 0),
      iv.status || 'NORMAL',
    ]);
  });

  const wsBahan = XLSX.utils.aoa_to_sheet(bahanRows);
  wsBahan['!cols'] = fitColumns(bahanRows);
  XLSX.utils.book_append_sheet(wb, wsBahan, 'Top Selisih Bahan');

  // ==========================================
  // SHEET 3: TOP MENU VARIANCE
  // ==========================================
  const menuRows = [
    ['MENU PENYUMBANG VARIANSI TERTINGGI'],
    ['Cabang:', outletName, 'Periode:', `${period.from} s/d ${period.to}`],
    [],
    ['No', 'Nama Menu', 'Kategori', 'Qty Terjual (Porsi)', 'Weighted %', 'Nilai Variance (Rp)'],
  ];

  varMenuData.forEach((row, idx) => {
    menuRows.push([
      idx + 1,
      row.menu?.name || '-',
      row.menu?.category || '-',
      row.qty_terjual || 0,
      Number((row.weighted_pct || 0).toFixed(2)),
      Math.round(row.variance_value || 0),
    ]);
  });

  const wsMenu = XLSX.utils.aoa_to_sheet(menuRows);
  wsMenu['!cols'] = fitColumns(menuRows);
  XLSX.utils.book_append_sheet(wb, wsMenu, 'Top Menu Variance');

  // ==========================================
  // SHEET 4: LOG WASTE & LIMBAH BAHAN
  // ==========================================
  const wasteRows = [
    ['RINCIAN KERUSAKAN & LIMBAH BAHAN BAKU (DOCUMENTED WASTE)'],
    ['Cabang:', outletName, 'Periode:', `${period.from} s/d ${period.to}`],
    [],
    ['No', 'Kode Bahan', 'Nama Bahan Baku', 'Total Qty Rusak', 'Satuan', 'Nilai Kerugian (Rp)', 'Catatan Kejadian / Alasan'],
  ];

  top_waste.forEach((tw, idx) => {
    const reasons = (tw.waste_records || [])
      .map(r => `${r.waste_reason || 'Lainnya'}: ${r.qty}`)
      .join('; ');

    wasteRows.push([
      idx + 1,
      tw.ingredient?.code || '-',
      tw.ingredient?.name || '-',
      tw.waste_qty || tw.waste || 0,
      tw.ingredient?.unit_pakai || '-',
      Math.round(tw.waste_value || 0),
      reasons || 'Pencatatan limbah dapur',
    ]);
  });

  const wsWaste = XLSX.utils.aoa_to_sheet(wasteRows);
  wsWaste['!cols'] = fitColumns(wasteRows);
  XLSX.utils.book_append_sheet(wb, wsWaste, 'Limbah & Kerusakan');

  // Generate File Download
  const filename = `Laporan_Eksekutif_Cost_Control_${period.from}_sd_${period.to}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * 2. Export Detailed Ingredient Variance Audit to Excel
 */
export function exportVarianceBahanToExcel({ varData = [], period, outletName = 'Semua Cabang', businessName = 'MOVA POS', userName = 'Administrator' }) {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toLocaleString('id-ID');

  const rows = [
    ['LAPORAN AUDIT VARIANSI PERSADAAN BAHAN BAKU (COST CONTROL AUDIT)'],
    ['MOVA POS — Metode Penilaian PSAK 14 Weighted Moving Average'],
    [],
    ['Bisnis / Brand', businessName, '', 'Waktu Cetak', dateStr],
    ['Gudang / Cabang', outletName, '', 'Auditor PIC', userName],
    ['Periode Audit', `${period.from} s/d ${period.to}`, '', 'Standar', 'PSAK 14 Moving Average'],
    [],
    [
      'No',
      'Kode',
      'Nama Bahan Baku',
      'Kategori',
      'Satuan Beli',
      'Satuan Pakai',
      'Harga Pokok Rata-Rata (Rp)',
      'Stok Awal (Pakai)',
      'Masuk (Beli/Transfer)',
      'Pemakaian Teoritis POS',
      'Waste Resmi Tercatat',
      'Pemakaian Aktual',
      'Selisih Net (Pakai)',
      'Selisih %',
      'Nilai Total Selisih (Rp)',
      'Kerugian Waste (Rp)',
      'Selisih Tak Terjelaskan (Rp)',
      'Status Audit',
    ],
  ];

  let sumVarianceVal = 0;
  let sumWasteVal = 0;
  let sumUnaccountedVal = 0;

  varData.forEach((iv, idx) => {
    const vVal = Math.round(iv.variance_value || 0);
    const wVal = Math.round(iv.waste_value || 0);
    const uVal = Math.round(iv.unaccounted_value || 0);

    sumVarianceVal += vVal;
    sumWasteVal += wVal;
    sumUnaccountedVal += uVal;

    rows.push([
      idx + 1,
      iv.ingredient?.code || '-',
      iv.ingredient?.name || '-',
      iv.ingredient?.category || '-',
      iv.ingredient?.unit_beli || '-',
      iv.ingredient?.unit_pakai || '-',
      Math.round(iv.ingredient?.harga || 0),
      iv.stok_awal ?? '-',
      iv.total_masuk ?? '-',
      iv.pemakaian_teoritis ?? '-',
      iv.waste_qty ?? 0,
      iv.pemakaian_aktual ?? '-',
      iv.variance_qty ?? 0,
      Number((iv.variance_pct || 0).toFixed(2)),
      vVal,
      wVal,
      uVal,
      iv.status || 'NORMAL',
    ]);
  });

  // Summary Row
  rows.push([]);
  rows.push([
    'TOTAL AKUMULASI',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    sumVarianceVal,
    sumWasteVal,
    sumUnaccountedVal,
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Audit Variansi Bahan');

  const filename = `Laporan_Audit_Variansi_Bahan_${period.from}_sd_${period.to}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * 3. Export Menu Profitability & HPP to Excel
 */
export function exportProfitabilityToExcel({ data = [], period, outletName = 'Semua Cabang', businessName = 'MOVA POS', userName = 'Administrator' }) {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toLocaleString('id-ID');

  const rows = [
    ['LAPORAN ANALISIS PROFITABILITAS MENU & HPP DINAMIS'],
    ['MOVA POS — Evaluasi Margin & Moving Average Unit Economics'],
    [],
    ['Bisnis / Brand', businessName, '', 'Waktu Cetak', dateStr],
    ['Gudang / Cabang', outletName, '', 'Auditor PIC', userName],
    ['Periode Audit', `${period.from} s/d ${period.to}`, '', 'Basis HPP', 'Weighted Moving Average'],
    [],
    [
      'No',
      'Nama Menu',
      'Kategori',
      'Harga Jual (Rp)',
      'HPP Teoritis Moving Avg (Rp)',
      'Gross Margin (%)',
      'Variance Cost / Porsi (Rp)',
      'Adjusted HPP Aktual (Rp)',
      'Adjusted Margin (%)',
      'Penurunan Margin (pp)',
      'Status Evaluasi',
    ],
  ];

  data.forEach((r, idx) => {
    const marginDrop = Number((r.gross_margin - r.adjusted_margin).toFixed(1));
    const status = marginDrop > 5 ? 'KRITIS (Margin Anjlok)' : marginDrop > 2 ? 'PERHATIAN (Waspada)' : 'SEHAT (Normal)';

    rows.push([
      idx + 1,
      r.menu?.name || '-',
      r.menu?.category || '-',
      Math.round(r.menu?.price || 0),
      Math.round(r.hpp || 0),
      Number((r.gross_margin || 0).toFixed(1)),
      Math.round(r.variance_per_porsi || 0),
      Math.round(r.adjusted_hpp || 0),
      Number((r.adjusted_margin || 0).toFixed(1)),
      marginDrop,
      status,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Profitabilitas Menu');

  const filename = `Laporan_Profitabilitas_Menu_dan_HPP_${period.from}_sd_${period.to}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * 4. Export Menu Variance Ranking to Excel
 */
export function exportVarianceMenuToExcel({ menuData = [], period, outletName = 'Semua Cabang', businessName = 'MOVA POS', userName = 'Administrator' }) {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toLocaleString('id-ID');
  const total = menuData.reduce((s, r) => s + (r.variance_value || 0), 0);

  const rows = [
    ['LAPORAN RANKING VARIANCE PENYUMBANG MENU TERHADAP BAHAN BAKU'],
    ['MOVA POS — Weighted Variance Contribution Analysis'],
    [],
    ['Bisnis / Brand', businessName, '', 'Waktu Cetak', dateStr],
    ['Gudang / Cabang', outletName, '', 'Auditor PIC', userName],
    ['Periode Audit', `${period.from} s/d ${period.to}`, '', 'Total Variance', Math.round(total)],
    [],
    [
      'No',
      'Nama Menu',
      'Kategori',
      'Qty Terjual (Porsi)',
      'Weighted % Variance',
      'Nilai Variance (Rp)',
      'Kontribusi terhadap Total Variance (%)',
    ],
  ];

  menuData.forEach((row, idx) => {
    const contrib = total !== 0 ? Number(((row.variance_value / total) * 100).toFixed(1)) : 0;
    rows.push([
      idx + 1,
      row.menu?.name || '-',
      row.menu?.category || '-',
      row.qty_terjual || 0,
      Number((row.weighted_pct || 0).toFixed(2)),
      Math.round(row.variance_value || 0),
      contrib,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Ranking Menu Variance');

  const filename = `Laporan_Variance_Menu_${period.from}_sd_${period.to}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}
