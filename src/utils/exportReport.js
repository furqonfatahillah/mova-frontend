/**
 * Dynamic loader for SheetJS (xlsx) so the heavy library is ONLY loaded
 * when the user clicks the "Export Excel" button.
 */
async function getXLSX() {
  return await import('xlsx');
}

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
export async function exportDashboardToExcel({ data, varData = [], varMenuData = [], period, outletName = 'Semua Cabang', businessName = 'MOVA POS', userName = 'Administrator' }) {
  const XLSX = await getXLSX();
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
export async function exportVarianceBahanToExcel({ varData = [], period, outletName = 'Semua Cabang', businessName = 'MOVA POS', userName = 'Administrator' }) {
  const XLSX = await getXLSX();
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
export async function exportProfitabilityToExcel({ data = [], period, outletName = 'Semua Cabang', businessName = 'MOVA POS', userName = 'Administrator' }) {
  const XLSX = await getXLSX();
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
export async function exportVarianceMenuToExcel({ menuData = [], period, outletName = 'Semua Cabang', businessName = 'MOVA POS', userName = 'Administrator' }) {
  const XLSX = await getXLSX();
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

/**
 * 5. Export Buku Piutang (Accounts Receivable Ledger) to Excel
 */
export async function exportReceivablesToExcel({ items = [], stats = {}, outletName = 'Semua Cabang', businessName = 'MOVA POS', userName = 'Administrator' }) {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toLocaleString('id-ID');

  const rows = [
    ['BUKU KASBON CUSTOMER (HUTANG PELANGGAN)'],
    ['MOVA POS — Customer Credit Ledger & Bulk Payment Management'],
    [],
    ['Bisnis / Brand', businessName, '', 'Waktu Ekspor', dateStr],
    ['Cabang / Outlet', outletName, '', 'Dicetak Oleh', userName],
    ['Total Tagihan Kasbon', stats.total_receivables || 0, '', 'Sisa Kasbon Berjalan', stats.total_remaining || 0],
    ['Total Telah Dilunasi', stats.total_paid || 0, '', 'Kasbon Jatuh Tempo (Overdue)', stats.total_overdue || 0],
    [],
    [
      'No',
      'No Invoice Kasbon',
      'Tanggal Terbit',
      'Jatuh Tempo',
      'Nama Pelanggan',
      'No. Telepon / WA',
      'Cabang Outlet',
      'Total Kasbon (Rp)',
      'Sudah Dibayar (Rp)',
      'Sisa Kasbon (Rp)',
      'Progress (%)',
      'Status Pelunasan',
      'Keterangan / Rincian',
    ],
  ];

  items.forEach((r, idx) => {
    rows.push([
      idx + 1,
      r.receivable_no || '-',
      r.issue_date || '-',
      r.due_date || '-',
      r.customer_name || '-',
      r.customer_phone || '-',
      r.outlet_name || '-',
      r.total_amount || 0,
      r.paid_amount || 0,
      r.remaining_amount || 0,
      r.progress_pct ?? (r.total_amount > 0 ? Math.round((r.paid_amount / r.total_amount) * 100) : 0),
      r.status_label || r.status || '-',
      r.notes || '-',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Buku Piutang');

  const filename = `Buku_Piutang_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * Helper to format date range in Indonesian format (e.g. 01 September 2026 s/d 30 September 2026)
 */
function formatIndoPeriod(period) {
  if (!period) return '';
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
  return `${fmt(period.from)} s/d ${fmt(period.to)}`;
}

/**
 * 6. Export Laporan Penjualan per Produk to Excel
 */
export async function exportSalesByProductToExcel({ items = [], summary = {}, period, outletName = 'Semua Cabang', businessName = 'MOVA POS' }) {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();
  const periodStr = formatIndoPeriod(period);

  const rows = [
    [businessName],
    ['LAPORAN PENJUALAN PER PRODUK'],
    [`Per ${periodStr}`],
    [],
    [
      'No.',
      'Kode Produk',
      'Nama Produk / Sub Produk',
      'Qty Terjual',
      'Qty Refund',
      'Satuan',
      'Modal',
      'Harga',
      'Disc',
      'Total Nilai Terjual',
      'Total Nilai Refund',
    ],
  ];

  items.forEach((item, idx) => {
    rows.push([
      idx + 1,
      item.code || '-',
      item.name || '-',
      Number(item.qty_sold) || 0,
      Number(item.qty_refund) || 0,
      item.unit || 'Cup',
      Number(item.cost_price) || 0,
      Number(item.price) || 0,
      Number(item.discount_amount) || 0,
      Number(item.total_sales) || 0,
      Number(item.total_refund) || 0,
    ]);
  });

  // Total summary row
  rows.push([
    'Total',
    '',
    '',
    Number(summary.total_qty_sold) || 0,
    Number(summary.total_qty_refund) || 0,
    '',
    Number(summary.total_modal) || 0,
    '',
    Number(summary.total_discount) || 0,
    Number(summary.total_sales) || 0,
    Number(summary.total_refund) || 0,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Penjualan per Produk');

  const filename = `Laporan_Penjualan_Produk_${period.from}_sd_${period.to}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * 7. Export Laporan Penukaran Poin to Excel
 */
export async function exportPointRedemptionsToExcel({ items = [], summary = {}, period, outletName = 'Semua Cabang', businessName = 'MOVA POS' }) {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();
  const periodStr = formatIndoPeriod(period);

  const rows = [
    [businessName],
    ['LAPORAN PENUKARAN POIN'],
    [`Per ${periodStr}`],
    [],
    [],
    [],
    [
      'No',
      'Tanggal',
      'Tgl. Dibuat',
      'Dibuat Oleh',
      'Warehouse',
      'Customer',
      'Kasir',
      'No.Transaksi',
      'Penukaran',
      'Qty',
      'Nilai',
      'Poin',
    ],
  ];

  items.forEach((item, idx) => {
    rows.push([
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
  });

  rows.push([
    'Total',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    Number(summary.total_qty) || items.length,
    Number(summary.total_nilai) || 0,
    Number(summary.total_points) || 0,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Penukaran Poin');

  const filename = `Laporan_Penukaran_Poin_${period.from}_sd_${period.to}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * 8. Export Laporan Pembayaran Penjualan to Excel
 */
export async function exportSalesPaymentsToExcel({ items = [], summary = {}, period, outletName = 'Semua Cabang', businessName = 'MOVA POS' }) {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();
  const periodStr = formatIndoPeriod(period);

  const rows = [
    [businessName],
    ['LAPORAN PEMBAYARAN PENJUALAN'],
    [`Per ${periodStr}`],
    [],
    [
      'No.',
      'Tanggal',
      'Jam',
      'Tgl. Dibuat',
      'Dibuat Oleh',
      'Warehouse',
      'No.Penjualan',
      'No.Pembayaran',
      'Customer',
      'Jenis Bayar',
      'Disetor Ke',
      'Total Transaksi',
      'Bayar',
      'Piutang',
      'Kasir',
    ],
  ];

  items.forEach((item, idx) => {
    rows.push([
      idx + 1,
      item.date || '-',
      item.time || '-',
      item.created_at || '-',
      item.created_by || '-',
      item.warehouse || outletName,
      item.order_number || '-',
      item.payment_number || '',
      item.customer || '-',
      item.payment_method || '-',
      item.deposit_account || '-',
      Number(item.total_transaction) || 0,
      Number(item.paid_amount) || 0,
      Number(item.receivable_amount) || 0,
      item.cashier || item.created_by || '-',
    ]);
  });

  rows.push([
    'Total',
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
    Number(summary.total_transaction) || 0,
    Number(summary.total_paid) || 0,
    Number(summary.total_receivable) || 0,
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Pembayaran Penjualan');

  const filename = `Laporan_Pembayaran_Penjualan_${period.from}_sd_${period.to}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * 9. Export Laporan Transaksi Penjualan (Detail) to Excel
 */
export async function exportSalesTransactionsToExcel({ items = [], summary = {}, period, outletName = 'Semua Cabang', businessName = 'MOVA POS' }) {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();
  const periodStr = formatIndoPeriod(period);

  const rows = [
    [businessName],
    ['Laporan Transaksi Penjualan'],
    [`Per ${periodStr}`],
    [
      'No.',
      'Tgl',
      'Tgl. Dibuat',
      'Dibuat Oleh',
      'No.Ref',
      'Customer',
      'Promo',
      'Jenis Bayar',
      'Setor Ke',
      'Kode Produk',
      'Produk/Sub Produk',
      'Kategori Produk',
      'Sales Type',
      'HPP',
      'Harga Jual',
      '',
      '',
      '',
      '',
      'Disc Tambahan',
      'Disc Customer',
      'PPN',
      'Src.Charge',
      'Pengiriman',
      'Penjualan',
      'Piutang',
      'Profit',
      'Kasir',
      'Cetak Nota',
    ],
    [
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
      '(Per 1 Qty)',
      'QTY',
      'Satuan',
      'Harga',
      'Disc',
      'Subtotal',
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
    ],
  ];

  items.forEach((item, idx) => {
    rows.push([
      idx + 1,
      item.date || '-',
      item.created_at || '-',
      item.created_by || '-',
      item.order_number || '-',
      item.customer || 'Walk-in Customer',
      item.promo || '',
      item.payment_method || '-',
      item.deposit_account || '-',
      item.product_code || '-',
      item.product_name || '-',
      item.product_category || 'KOPI',
      item.sales_type || 'Dine-in',
      Number(item.hpp) || 0,
      Number(item.qty) || 0,
      item.unit || 'Cup',
      Number(item.price) || 0,
      Number(item.discount) || 0,
      Number(item.subtotal) || 0,
      Number(item.discount_extra) || 0,
      Number(item.discount_customer) || 0,
      Number(item.tax) || 0,
      Number(item.service_charge) || 0,
      Number(item.shipping) || 0,
      Number(item.total_sale) || 0,
      Number(item.receivable) || 0,
      Number(item.profit) || 0,
      item.cashier || item.created_by || '-',
      Number(item.receipt_printed) || 0,
    ]);
  });

  rows.push([
    'Total',
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
    Number(summary.total_qty) || 0,
    '',
    '',
    '',
    '',
    Number(summary.total_discount) || 0,
    0,
    0,
    0,
    0,
    Number(summary.total_sale) || 0,
    Number(summary.total_receivable) || 0,
    Number(summary.total_profit) || 0,
    '',
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Transaksi Penjualan');

  const filename = `Laporan_Transaksi_Penjualan_${period.from}_sd_${period.to}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * 10. Export Laporan Penjualan per Customer to Excel
 */
export async function exportSalesByCustomerToExcel({ items = [], summary = {}, period, outletName = 'Semua Cabang', businessName = 'MOVA POS' }) {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();
  const periodStr = formatIndoPeriod(period);

  const rows = [
    [businessName],
    ['LAPORAN DAFTAR PENJUALAN PER CUSTOMER'],
    [`Per ${periodStr}`],
    [],
    [
      'No.',
      'Tanggal',
      'Kode Customer',
      'Customer',
      'Group Customer',
      'No.Ref',
      'Produk',
      'Qty',
      'Satuan',
      'Harga Satuan',
      'Disc',
      'PPN',
      'Src.Charge',
      'Pengiriman',
      'Total',
      'Total Bayar',
      'Jenis Bayar',
      'Piutang',
      'Kasir',
    ],
  ];

  items.forEach((item, idx) => {
    rows.push([
      idx + 1,
      item.date || '-',
      item.customer_code || '-',
      item.customer_name || 'Walk-in Customer',
      item.customer_group || 'Reguler',
      item.order_number || '-',
      item.product_name || '-',
      Number(item.qty) || 0,
      item.unit || 'Cup',
      Number(item.price) || 0,
      Number(item.discount) || 0,
      Number(item.tax) || 0,
      Number(item.service_charge) || 0,
      Number(item.shipping) || 0,
      Number(item.total) || 0,
      Number(item.total_paid) || 0,
      item.payment_method || '-',
      Number(item.receivable) || 0,
      item.cashier || '-',
    ]);
  });

  rows.push([
    'Total Penjualan Semua Customer',
    '',
    '',
    '',
    '',
    '',
    '',
    Number(summary.total_qty) || 0,
    '',
    '',
    '',
    '',
    '',
    '',
    Number(summary.total_amount) || 0,
    Number(summary.total_paid) || 0,
    '',
    Number(summary.total_receivable) || 0,
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Penjualan per Customer');

  const filename = `Laporan_Penjualan_Customer_${period.from}_sd_${period.to}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * 11. Export Laporan Waktu Teramai to Excel
 */
export async function exportPeakHoursToExcel({ items = [], summary = {}, period, outletName = 'Semua Cabang', businessName = 'MOVA POS' }) {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();
  const periodStr = formatIndoPeriod(period);

  const rows = [
    [businessName],
    ['LAPORAN WAKTU TERAMAI'],
    [`Per ${periodStr}`],
    [],
    [
      'No.',
      'Waktu',
      'Total Penjualan (Rp)',
      'Rata-rata Penjualan (Rp)',
      'Penjualan (%)',
      'Transaksi',
      'Transaksi (%)',
      'Produk',
      'Produk (%)',
      'Tamu',
      'Tamu (%)',
    ],
  ];

  items.forEach((item, idx) => {
    rows.push([
      idx + 1,
      item.waktu || '',
      Number(item.total_penjualan) || 0,
      Number(item.avg_penjualan) || 0,
      Number(item.penjualan_pct) || 0,
      Number(item.transaksi) || 0,
      Number(item.transaksi_pct) || 0,
      Number(item.produk) || 0,
      Number(item.produk_pct) || 0,
      Number(item.tamu) || 0,
      Number(item.tamu_pct) || 0,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Waktu Teramai');

  const filename = `Laporan_Waktu_Teramai_${period.from}_sd_${period.to}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * 12. Export Laporan Piutang Customer to Excel
 */
export async function exportCustomerReceivablesToExcel({ items = [], summary = {}, period, outletName = 'Semua Cabang', businessName = 'MOVA POS' }) {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();
  const periodStr = formatIndoPeriod(period);

  const rows = [
    [businessName],
    ['LAPORAN PIUTANG CUSTOMER'],
    [`Per ${periodStr}`],
    [],
    [
      'No.',
      'Customer',
      'Tanggal',
      'Jam',
      'No.Penjualan',
      'Piutang',
      'Dibayar',
      'Sisa Piutang',
      'Usia Piutang',
      'Jatuh Tempo',
    ],
  ];

  items.forEach((item, idx) => {
    rows.push([
      idx + 1,
      item.customer || '-',
      item.tanggal || '-',
      item.jam || '-',
      item.no_penjualan || '-',
      Number(item.piutang) || 0,
      Number(item.dibayar) || 0,
      Number(item.sisa_piutang) || 0,
      item.usia_piutang || '0 Hari',
      item.jatuh_tempo || '-',
    ]);
  });

  // Total Piutang footer row
  rows.push([
    'Total Piutang',
    '',
    '',
    '',
    '',
    '',
    '',
    Number(summary.total_sisa_piutang) || 0,
    '',
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Piutang Customer');

  const filename = `Laporan_Piutang_Customer_${period.from}_sd_${period.to}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * 13. Export Laporan Promo to Excel
 */
export async function exportPromosToExcel({ items = [], summary = {}, period, outletName = 'Semua Cabang', businessName = 'MOVA POS' }) {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();
  const periodStr = formatIndoPeriod(period);

  const rows = [
    [businessName],
    ['LAPORAN PROMO'],
    [`Per ${periodStr}`],
    [],
    [
      'No.',
      'Tanggal',
      'Promo',
      'Jenis',
      'Jumlah Transaksi',
      'Nilai (Rp)',
    ],
  ];

  items.forEach((item, idx) => {
    rows.push([
      idx + 1,
      item.tanggal || '-',
      item.promo || '-',
      item.jenis || '-',
      Number(item.jumlah_transaksi) || 0,
      Number(item.nilai) || 0,
    ]);
  });

  rows.push([
    'Total Promo',
    '',
    '',
    '',
    Number(summary.total_promo) || 0,
    Number(summary.total_nilai) || 0,
  ]);

  rows.push([
    'Total Penjualan Promo',
    '',
    '',
    '',
    '',
    Number(summary.total_penjualan_promo) || 0,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Promo');

  const filename = `Laporan_Promo_${period.from}_sd_${period.to}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}


