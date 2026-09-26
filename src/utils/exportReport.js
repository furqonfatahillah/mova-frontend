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

/**
 * 12. Export Laporan Hutang Supplier to Excel (Layout EXACTLY matching user's uploaded template)
 * Columns: No. | Supplier/Tanggal | Tgl. Dibuat | Dibuat Oleh | No.Pembelian | No.Bayar | Jatuh Tempo | Hutang | Dibayar | Sisa Hutang | Total Hutang
 */
export async function exportSupplierPayablesToExcel({
  rows = [],
  period = {},
  outletName = 'Semua Cabang',
  businessName = 'MOVA POS',
  summary = {},
}) {
  const ExcelJSMod = await import('exceljs');
  const ExcelJS = ExcelJSMod.default || ExcelJSMod;
  const wb = new ExcelJS.Workbook();
  wb.creator = businessName;
  wb.created = new Date();

  const ws = wb.addWorksheet('Laporan Hutang Supplier', {
    views: [{ showGridLines: true }],
  });

  // Row 2: Title centered across columns
  ws.getCell('B2').value = 'LAPORAN HUTANG SUPPLIER';
  ws.getCell('B2').font = { name: 'Arial', size: 14, bold: true };
  ws.getCell('B2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells('B2:K2');

  const periodText = period.from_formatted && period.to_formatted
    ? `Per ${period.from_formatted} s/d ${period.to_formatted}`
    : (period.from && period.to ? `Per ${period.from} s/d ${period.to}` : 'Semua Periode');

  // Row 3: Period subtitle in italics
  ws.getCell('B3').value = periodText;
  ws.getCell('B3').font = { name: 'Arial', size: 11, italic: true };
  ws.getCell('B3').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells('B3:K3');

  // Row 5: Table Header matching user's screenshot
  const headerRow = ws.getRow(5);
  headerRow.values = [
    'No.',
    'Supplier/Tanggal',
    'Tgl. Dibuat',
    'Dibuat Oleh',
    'No.Pembelian',
    'No.Bayar',
    'Jatuh Tempo',
    'Hutang',
    'Dibayar',
    'Sisa Hutang',
    'Total Hutang',
  ];
  headerRow.height = 24;

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });

  let currentRowIdx = 6;
  rows.forEach((r, idx) => {
    const row = ws.getRow(currentRowIdx++);
    row.values = [
      idx + 1,
      r.supplier_tanggal || (r.supplier_name ? `${r.supplier_name} - ${r.tgl_dibuat_fmt || r.tgl_dibuat}` : '-'),
      r.tgl_dibuat_fmt || r.tgl_dibuat || '-',
      r.dibuat_oleh || 'Admin',
      r.no_pembelian || '-',
      r.no_bayar || '-',
      r.jatuh_tempo_fmt || r.jatuh_tempo || '-',
      Number(r.hutang) || 0,
      Number(r.dibayar) || 0,
      Number(r.sisa_hutang) || 0,
      Number(r.total_hutang) || 0,
    ];
    row.height = 20;

    row.eachCell((cell, colNumber) => {
      cell.border = thinBorder;
      cell.font = { name: 'Arial', size: 10 };
      if (colNumber === 1) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([3, 5, 6, 7].includes(colNumber)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colNumber >= 8) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00';
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  // Footer Total Row (Row currentRowIdx):
  // Exactly matching the screenshot:
  // "Total Utang" label spanning / in cell H, followed by Dibayar (cell I), Sisa Hutang (cell J), Total Hutang (cell K)
  const footerRow = ws.getRow(currentRowIdx);
  footerRow.height = 22;

  for (let c = 1; c <= 11; c++) {
    footerRow.getCell(c).border = thinBorder;
    footerRow.getCell(c).font = { name: 'Arial', size: 10, bold: true };
  }

  // Merge A to H with "Total Utang"
  ws.mergeCells(`A${currentRowIdx}:H${currentRowIdx}`);
  const totalUtangLabelCell = ws.getCell(`A${currentRowIdx}`);
  totalUtangLabelCell.value = 'Total Utang';
  totalUtangLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totalUtangLabelCell.font = { name: 'Arial', size: 10, bold: true };

  const cellDibayar = footerRow.getCell(9);
  cellDibayar.value = Number(summary.total_dibayar ?? 0);
  cellDibayar.alignment = { horizontal: 'right', vertical: 'middle' };
  cellDibayar.numFmt = '#,##0.00';
  cellDibayar.font = { name: 'Arial', size: 10, bold: true };

  const cellSisa = footerRow.getCell(10);
  cellSisa.value = Number(summary.total_sisa_hutang ?? 0);
  cellSisa.alignment = { horizontal: 'right', vertical: 'middle' };
  cellSisa.numFmt = '#,##0.00';
  cellSisa.font = { name: 'Arial', size: 10, bold: true };

  const cellTotal = footerRow.getCell(11);
  cellTotal.value = Number(summary.total_hutang ?? 0);
  cellTotal.alignment = { horizontal: 'right', vertical: 'middle' };
  cellTotal.numFmt = '#,##0.00';
  cellTotal.font = { name: 'Arial', size: 10, bold: true };

  // Set column widths for readability
  ws.getColumn(1).width = 6;   // No.
  ws.getColumn(2).width = 32;  // Supplier/Tanggal
  ws.getColumn(3).width = 14;  // Tgl. Dibuat
  ws.getColumn(4).width = 16;  // Dibuat Oleh
  ws.getColumn(5).width = 20;  // No.Pembelian
  ws.getColumn(6).width = 24;  // No.Bayar
  ws.getColumn(7).width = 14;  // Jatuh Tempo
  ws.getColumn(8).width = 16;  // Hutang
  ws.getColumn(9).width = 16;  // Dibayar
  ws.getColumn(10).width = 16; // Sisa Hutang
  ws.getColumn(11).width = 16; // Total Hutang

  const filename = `Laporan_Hutang_Supplier_${period.from || 'all'}_sd_${period.to || 'all'}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
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

  return filename;
}

/**
 * 13. Print / PDF Export for Laporan Hutang Supplier
 */
export function printSupplierPayablesReport({
  rows = [],
  period = {},
  outletName = 'Semua Cabang',
  summary = {},
}) {
  const periodText = period.from_formatted && period.to_formatted
    ? `Per ${period.from_formatted} s/d ${period.to_formatted}`
    : (period.from && period.to ? `Per ${period.from} s/d ${period.to}` : 'Semua Periode');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up browser diblokir. Harap izinkan pop-up untuk mencetak laporan.');
    return;
  }

  const numFmt = (val) =>
    Number(val || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
      <td style="text-align:right;">${numFmt(r.hutang)}</td>
      <td style="text-align:right;">${numFmt(r.dibayar)}</td>
      <td style="text-align:right;">${numFmt(r.sisa_hutang)}</td>
      <td style="text-align:right;">${numFmt(r.total_hutang)}</td>
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
      @page { size: landscape; margin: 12mm; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 10px; }
      .header { text-align: center; margin-bottom: 20px; }
      .title { font-size: 16px; font-weight: bold; letter-spacing: 0.5px; }
      .subtitle { font-size: 12px; font-style: italic; margin-top: 4px; color: #333; }
      .meta { display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 5px; }
      th, td { border: 1px solid #222; padding: 6px 8px; }
      th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
      .footer-total { font-weight: bold; background-color: #f9fafb; }
      @media print {
        th { background-color: #eee !important; -webkit-print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="title">LAPORAN HUTANG SUPPLIER</div>
      <div class="subtitle">${periodText}</div>
    </div>
    <div class="meta">
      <div><strong>Outlet/Cabang:</strong> ${outletName}</div>
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
          <td colspan="8" style="text-align: right; padding-right: 12px;">Total Utang</td>
          <td style="text-align: right;">${numFmt(summary.total_dibayar)}</td>
          <td style="text-align: right;">${numFmt(summary.total_sisa_hutang)}</td>
          <td style="text-align: right;">${numFmt(summary.total_hutang)}</td>
        </tr>
      </tfoot>
    </table>
    <script>
      window.onload = function() {
        window.print();
      };
    </script>
  </body>
  </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}


