/**
 * Utility for generating & downloading Excel Template (.xlsx) files
 * with built-in Excel Dropdown Validation (Data Validation Lists)
 * and Auto-Filter to guarantee 100% data consistency with MOVA POS.
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
 * Apply professional styling for header row
 */
function applyHeaderStyle(row, bgColor = 'FF1E293B') {
  row.height = 26;
  row.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgColor },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };
  });
}

/**
 * Auto-fit column widths
 */
function autoFitColumns(ws) {
  ws.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const val = cell.value;
      if (val !== null && val !== undefined) {
        const str = String(val);
        if (str.length > maxLength && str.length < 50) {
          maxLength = str.length;
        }
      }
    });
    column.width = Math.min(Math.max(maxLength + 4, 14), 45);
  });
}

/**
 * Extract active outlets and prepare dropdown formula
 */
function prepareOutletData(outlets = []) {
  const activeOutlets = Array.isArray(outlets) && outlets.length > 0
    ? outlets.filter((o) => o.active !== false && o.active !== 0)
    : [];

  const mainOutlet = activeOutlets.find((o) => o.is_main) || activeOutlets[0] || { name: 'Outlet Pusat (Gudang Utama)' };
  const secondOutlet = activeOutlets.find((o) => !o.is_main) || activeOutlets[1] || mainOutlet;
  const outletNames = activeOutlets.length > 0
    ? activeOutlets.map((o) => String(o.name || '').replace(/,/g, ' ').trim()).filter(Boolean)
    : ['Outlet Pusat (Gudang Utama)', 'Outlet Cabang'];

  const outletListFormula = `"${outletNames.join(',')}"`;

  return { activeOutlets, mainOutlet, secondOutlet, outletNames, outletListFormula };
}

/**
 * Add DAFTAR_CABANG reference worksheet to workbook
 */
function addDaftarCabangSheet(wb, activeOutlets = [], businessName = '') {
  const wsOutlets = wb.addWorksheet('DAFTAR_CABANG', { views: [{ showGridLines: true }] });

  wsOutlets.mergeCells('A1:E1');
  const oTitle = wsOutlets.getCell('A1');
  oTitle.value = `DAFTAR MASTER CABANG RESMI — ${businessName || 'MOVA POS'}`;
  oTitle.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF1E293B' } };
  oTitle.alignment = { vertical: 'middle', horizontal: 'left' };
  oTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  wsOutlets.getRow(1).height = 26;

  wsOutlets.mergeCells('A2:E2');
  const oDesc = wsOutlets.getCell('A2');
  oDesc.value = 'Daftar cabang ini terhubung dengan Master Cabang usaha Anda. Anda dapat memilih nama cabang langsung dari dropdown (▼) di kolom Cabang.';
  oDesc.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  wsOutlets.getRow(2).height = 20;

  wsOutlets.addRow([]); // Row 3 spacer

  const oHeader = wsOutlets.addRow(['Kode Cabang', 'Nama Cabang (Master)', 'Tipe Cabang', 'Alamat Cabang', 'Status']);
  applyHeaderStyle(oHeader, 'FF047857'); // Emerald Dark

  if (activeOutlets.length > 0) {
    activeOutlets.forEach((o) => {
      wsOutlets.addRow([
        o.code || `OUT-${o.id}`,
        o.name,
        o.is_main ? 'PUSAT / HOLDING' : 'CABANG OPERASIONAL',
        o.address || '-',
        o.active !== false && o.active !== 0 ? 'AKTIF' : 'NON-AKTIF',
      ]);
    });
  } else {
    wsOutlets.addRow(['OUT-001', 'Outlet Pusat (Gudang Utama)', 'PUSAT / HOLDING', 'Alamat Utama', 'AKTIF']);
  }
  autoFitColumns(wsOutlets);
}

/**
 * 1. Download Template Excel Master Bahan & Saldo Awal (Ingredients Master & Valuation)
 * Features:
 * - Master materials definition & opening valuation (Harga Beli & Saldo Awal Rp)
 * - Dropdown Data Validation for Tipe (RAW/SEMI_FINISHED)
 * - Dropdown Data Validation for Satuan Beli & Satuan Pakai
 * - Auto-Filter on header row
 * - Reference Sheet for Satuan & Konversi
 */
export async function downloadIngredientTemplate(outlets = [], businessName = '') {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MOVA POS System';
  wb.created = new Date();
  wb.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];

  // --- SHEET 1: Master Bahan & Saldo Awal ---
  const ws = wb.addWorksheet('Master Bahan & Saldo Awal', { views: [{ showGridLines: true }] });

  // Banner Title (Row 1)
  ws.mergeCells('A1:L1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `TEMPLATE IMPORT MASTER BAHAN & SALDO AWAL (TERPUSAT) — ${businessName || 'MOVA POS'}`;
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getRow(1).height = 28;

  // Instructions (Row 2)
  ws.mergeCells('A2:L2');
  const noteCell = ws.getCell('A2');
  noteCell.value = 'Petunjuk: Kolom bertanda (*) wajib diisi. Digunakan untuk mendaftarkan Master Bahan dan Saldo Awal Nilai/HPP terpusat. Untuk alokasi stok fisik per cabang/gudang, gunakan Template "Stock Awal per Gudang".';
  noteCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  ws.getRow(2).height = 20;

  ws.addRow([]); // Row 3 empty spacer

  // Row 4: Headers
  const headerRow = ws.addRow([
    'Kode Bahan',
    'Nama Bahan*',
    'Kategori',
    'Tipe Bahan (▼)*',
    'Satuan Beli (▼)*',
    'Satuan Pakai (▼)*',
    'Faktor Konversi*',
    'Harga Beli Per Satuan Beli (Rp)*',
    'Saldo Awal Nilai Persediaan (Rp)*',
    'Stok Minimal (Satuan Pakai)',
    'Batas Toleransi (%)',
    'Catatan / Spesifikasi',
  ]);
  applyHeaderStyle(headerRow, 'FF1E293B');

  // Rows 5+: Sample Data
  const sampleData = [
    ['BHN-001', 'Tepung Terigu Segitiga', 'BAHAN_BAKU', 'RAW', 'kg', 'gram', 1000, 14000, 140000, 2000, 5, 'Kemasan 1 kg (Master bahan terpusat & Saldo Awal Nilai Buku Rp 140.000)'],
    ['BHN-002', 'Minyak Goreng Bimoli', 'BAHAN_BAKU', 'RAW', 'liter', 'ml', 1000, 20000, 400000, 5000, 5, 'Kemasan 1 liter (Master bahan terpusat & Saldo Awal Nilai Buku Rp 400.000)'],
    ['BHN-003', 'Kopi Arabika Gayo', 'KOPI', 'RAW', 'kg', 'gram', 1000, 120000, 600000, 1000, 5, 'Roast Bean Medium (Master bahan terpusat & Saldo Awal Nilai Buku Rp 600.000)'],
    ['BHN-004', 'Saus Keju Special (Olahan)', 'SAUS', 'SEMI_FINISHED', 'liter', 'ml', 1000, 45000, 90000, 1000, 5, 'Buatan Dapur (Bahan Olahan & Saldo Awal Nilai Buku Rp 90.000)'],
  ];
  sampleData.forEach((r) => ws.addRow(r));

  // Enable Auto-Filter on Row 4
  ws.autoFilter = { from: 'A4', to: 'L4' };

  // Dropdown list options
  const SATUAN_BELI_LIST = '"kg,gram,liter,ml,Slop,Pack,Roll,Dus,Botol,pcs,Kaleng,Sachet"';
  const SATUAN_PAKAI_LIST = '"gram,ml,pcs,lembar,buah,porsi,sdm,sdt,roll"';

  for (let r = 5; r <= 300; r++) {
    // Column D: Tipe Bahan (RAW / SEMI_FINISHED)
    ws.getCell(`D${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"RAW,SEMI_FINISHED"'],
      showErrorMessage: true,
      errorTitle: 'Tipe Bahan Harus Sesuai',
      error: 'Pilih tipe bahan: RAW (bahan mentah) atau SEMI_FINISHED (olahan/prep).',
    };

    // Column E: Satuan Beli
    ws.getCell(`E${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [SATUAN_BELI_LIST],
      showErrorMessage: true,
      errorTitle: 'Pilihan Satuan Beli',
      error: 'Pilih satuan beli standar dari menu dropdown.',
    };

    // Column F: Satuan Pakai
    ws.getCell(`F${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [SATUAN_PAKAI_LIST],
      showErrorMessage: true,
      errorTitle: 'Pilihan Satuan Pakai',
      error: 'Pilih satuan pakai standar dari menu dropdown.',
    };
  }

  autoFitColumns(ws);

  // --- SHEET 2: Panduan Satuan & Konversi ---
  const wsGuide = wb.addWorksheet('PANDUAN_SATUAN_DAN_KONVERSI', { views: [{ showGridLines: true }] });
  wsGuide.addRow(['PEDOMAN MASTER BAHAN, KONVERSI & SALDO AWAL PERSIAAN']);
  wsGuide.getRow(1).font = { size: 12, bold: true, color: { argb: 'FF1E293B' } };
  wsGuide.addRow(['Sheet ini sebagai referensi pasangan satuan beli, satuan pakai, dan saldo awal nilai persediaan:']);
  wsGuide.addRow([]);

  const guideHeader = wsGuide.addRow(['Parameter / Kolom', 'Ketentuan Format', 'Penjelasan Teknis']);
  applyHeaderStyle(guideHeader, 'FF0F766E');

  const guideRows = [
    ['Master Terpusat', 'Berlaku otomatis di semua cabang', 'Setiap bahan yang di-import otomatis terdaftar dan bisa digunakan di seluruh cabang usaha Anda.'],
    ['Saldo Awal Nilai Persediaan (Rp)*', 'Nominal rupiah nilai buku akuntansi (misal: Rp 140.000)', 'Nilai uang persediaan awal master/holding yang tercatat pada neraca keuangan dan HPP awal.'],
    ['Batas Toleransi (%)', 'Persentase toleransi selisih stok (default: 5%)', 'Batas wajar selisih antara stok teoritis dan fisik saat Stock Opname sebelum diberi status peringatan selisih.'],
    ['Satuan Beli: kg', 'Satuan Pakai: gram', '1 kg = 1.000 gram (Standar tepung, gula, daging, kopi roast bean)'],
    ['Satuan Beli: liter', 'Satuan Pakai: ml', '1 liter = 1.000 ml (Standar susu, sirup, minyak, saus)'],
    ['Satuan Beli: Slop', 'Satuan Pakai: pcs', '1 Slop = 50 pcs (Standar cup plastik 16oz / 22oz)'],
    ['Satuan Beli: Pack', 'Satuan Pakai: pcs', '1 Pack = 100 pcs (Standar sedotan boba, kantong kresek)'],
    ['Satuan Beli: Pack', 'Satuan Pakai: lembar', '1 Pack = 200 lembar (Standar tissue lunch paper)'],
    ['Satuan Beli: Roll', 'Satuan Pakai: pcs', '1 Roll = 1.200 pcs (Standar sealer cup motif)'],
    ['Satuan Beli: Botol', 'Satuan Pakai: ml', '1 Botol sirup 750 ml'],
    ['Satuan Beli: Kaleng', 'Satuan Pakai: gram', '1 Kaleng susu kental manis 380 gram'],
    ['Satuan Beli: Dus / Karton', 'Satuan Pakai: pcs / Pack', '1 Dus isi 24 pcs / pack'],
  ];
  guideRows.forEach((r) => wsGuide.addRow(r));
  autoFitColumns(wsGuide);

  await saveWorkbook(wb, `Template_Import_Master_Bahan_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * 2. Download Template Excel Master Perlengkapan & Packaging (Master Terpusat)
 */
export async function downloadPerlengkapanTemplate(outlets = [], businessName = '') {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MOVA POS System';
  wb.created = new Date();
  wb.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];

  const ws = wb.addWorksheet('Master Perlengkapan & Saldo Awal', { views: [{ showGridLines: true }] });

  ws.mergeCells('A1:K1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `TEMPLATE IMPORT MASTER PERLENGKAPAN & PACKAGING (TERPUSAT) — ${businessName || 'MOVA POS'}`;
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:K2');
  const noteCell = ws.getCell('A2');
  noteCell.value = 'Petunjuk: Baris bertanda (*) wajib diisi. Digunakan untuk mendaftarkan Master Perlengkapan/Packaging dan Saldo Awal Nilai secara terpusat.';
  noteCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  ws.getRow(2).height = 20;

  ws.addRow([]); // Row 3 empty spacer

  const headerRow = ws.addRow([
    'Kode Perlengkapan',
    'Nama Perlengkapan*',
    'Kategori',
    'Satuan Beli (▼)*',
    'Satuan Pakai (▼)*',
    'Faktor Konversi*',
    'Harga Beli Per Satuan Beli (Rp)*',
    'Saldo Awal Nilai Persediaan (Rp)*',
    'Stok Minimal (Satuan Pakai)',
    'Batas Toleransi (%)',
    'Catatan / Spesifikasi',
  ]);
  applyHeaderStyle(headerRow, 'FF1E293B');

  const sampleData = [
    ['PLK-001', 'Cup Dingin 16oz Sablon Logo', 'Cup & Gelas', 'Slop', 'pcs', 50, 25000, 250000, 100, 5, 'Sablon logo 2 sisi, 1 slop = 50 pcs (Saldo Awal Rp 250.000)'],
    ['PLK-002', 'Sedotan Boba Steril (Wrap)', 'Sedotan / Pipet', 'Pack', 'pcs', 100, 15000, 150000, 200, 5, 'Sedotan steril bungkus plastik (Saldo Awal Rp 150.000)'],
    ['PLK-003', 'Tissue Makan Meja (Lunch Paper)', 'Tissue', 'Pack', 'lembar', 250, 12500, 125000, 500, 5, '1 pack = 250 lembar tissue (Saldo Awal Rp 125.000)'],
    ['PLK-004', 'Roll Plastik Sealer Cup Motif', 'Tutup Cup / Sealer', 'Roll', 'pcs', 1200, 75000, 150000, 300, 5, '1 roll estimasi 1.200 cup (Saldo Awal Rp 150.000)'],
    ['PLK-005', 'Kantong Plastik Kresek T-Shirt 1 Cup', 'Kantong & Paperbag', 'Pack', 'pcs', 100, 8500, 42500, 100, 5, 'Bahan ramah lingkungan bening (Saldo Awal Rp 42.500)'],
  ];
  sampleData.forEach((r) => ws.addRow(r));

  ws.autoFilter = { from: 'A4', to: 'K4' };

  for (let r = 5; r <= 300; r++) {
    // Column D: Satuan Beli
    ws.getCell(`D${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"Slop,Pack,Roll,Dus,pcs,Lusin,Ikat,Botol,Kaleng"'],
      showErrorMessage: true,
      errorTitle: 'Pilihan Satuan Beli',
      error: 'Pilih satuan beli standar dari dropdown.',
    };

    // Column E: Satuan Pakai
    ws.getCell(`E${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"pcs,lembar,buah,roll,gram,ml"'],
      showErrorMessage: true,
      errorTitle: 'Pilihan Satuan Pakai',
      error: 'Pilih satuan pakai standar dari dropdown.',
    };
  }

  autoFitColumns(ws);

  await saveWorkbook(wb, `Template_Import_Master_Perlengkapan_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * 3. Download Template Excel Stock Awal Fisik Per Gudang / Cabang (Multi-Warehouse Physical Inventory)
 * Features:
 * - Dropdown Data Validation for Cabang / Gudang based on Owner's Master Cabang
 * - Dropdown Data Validation for Tipe Satuan (PAKAI / BELI)
 * - Dropdown Data Validation for Satuan
 * - Reference Sheet for Master Cabang & Warehouse Setup Guide
 * - Directly allocates physical opening stocks per warehouse/branch into Kartu Stok
 */
export async function downloadStockAwalGudangTemplate(outlets = [], businessName = '') {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MOVA POS System';
  wb.created = new Date();
  wb.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];

  const { activeOutlets, mainOutlet, secondOutlet, outletListFormula } = prepareOutletData(outlets);

  // --- SHEET 1: Stock Awal Gudang ---
  const ws = wb.addWorksheet('Stock Awal Gudang', { views: [{ showGridLines: true }] });

  ws.mergeCells('A1:K1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `TEMPLATE IMPORT STOCK AWAL FISIK PER GUDANG / CABANG — ${businessName || 'MOVA POS'}`;
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:K2');
  const noteCell = ws.getCell('A2');
  noteCell.value = 'Petunjuk: Kolom bertanda (*) wajib diisi. Pilih Cabang / Gudang dari menu dropdown (▼) untuk mengalokasikan stok fisik awal langsung ke kartu stok cabang tersebut.';
  noteCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  ws.getRow(2).height = 20;

  ws.addRow([]); // Row 3 empty spacer

  const headerRow = ws.addRow([
    'Nama Cabang / Gudang (▼)*',
    'Kode Bahan / Perlengkapan',
    'Nama Bahan / Item Persediaan*',
    'Kategori (Opsional)',
    'Tipe Satuan Input (▼)*',
    'Satuan (▼)*',
    'Kuantitas Stock Awal Fisik*',
    'Harga / Nilai Modal Satuan (Rp)',
    'Stok Minimal Gudang',
    'Tanggal Efektif (YYYY-MM-DD)',
    'Catatan / Keterangan',
  ]);
  applyHeaderStyle(headerRow, 'FF0369A1'); // Ocean Blue Dark

  const sampleData = [
    [mainOutlet.name, 'BHN-001', 'Tepung Terigu Segitiga', 'BAHAN_BAKU', 'PAKAI', 'gram', 15000, 14, 2000, '2026-09-28', 'Stok fisik awal di Gudang Utama (Pusat)'],
    [secondOutlet.name, 'BHN-001', 'Tepung Terigu Segitiga', 'BAHAN_BAKU', 'PAKAI', 'gram', 5000, 14, 1000, '2026-09-28', 'Alokasi stok fisik awal di Cabang Operasional'],
    [mainOutlet.name, 'BHN-002', 'Minyak Goreng Bimoli', 'BAHAN_BAKU', 'PAKAI', 'ml', 20000, 20, 5000, '2026-09-28', 'Stok awal 20 liter (20.000 ml) di Gudang Utama'],
    [secondOutlet.name, 'BHN-002', 'Minyak Goreng Bimoli', 'BAHAN_BAKU', 'PAKAI', 'ml', 8000, 20, 2000, '2026-09-28', 'Stok awal 8 liter (8.000 ml) di Cabang'],
    [mainOutlet.name, 'PLK-001', 'Cup Dingin 16oz Sablon Logo', 'Perlengkapan', 'PAKAI', 'pcs', 1000, 500, 200, '2026-09-28', 'Stok awal cup di Gudang Utama (1.000 pcs)'],
    [secondOutlet.name, 'PLK-001', 'Cup Dingin 16oz Sablon Logo', 'Perlengkapan', 'PAKAI', 'pcs', 300, 500, 100, '2026-09-28', 'Stok awal cup di Cabang (300 pcs)'],
  ];
  sampleData.forEach((r) => ws.addRow(r));

  ws.autoFilter = { from: 'A4', to: 'K4' };

  const ALL_UNITS_LIST = '"gram,ml,pcs,lembar,kg,liter,slop,pack,roll,botol,cup,dus,can,sachet,porsi,sdm,sdt"';

  for (let r = 5; r <= 500; r++) {
    // Column A: Cabang / Gudang Dropdown
    ws.getCell(`A${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [outletListFormula],
      showErrorMessage: true,
      errorTitle: 'Pilih Cabang / Gudang Resmi',
      error: 'Pilih nama cabang/gudang dari daftar master cabang usaha Anda.',
    };

    // Column E: Tipe Satuan Input (PAKAI / BELI)
    ws.getCell(`E${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"PAKAI,BELI"'],
      showErrorMessage: true,
      errorTitle: 'Pilihan Tipe Satuan',
      error: 'Pilih PAKAI (misal gram/ml/pcs) atau BELI (misal kg/liter/slop).',
    };

    // Column F: Satuan
    ws.getCell(`F${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [ALL_UNITS_LIST],
      showErrorMessage: true,
      errorTitle: 'Pilihan Satuan',
      error: 'Pilih satuan standar dari menu dropdown.',
    };
  }

  autoFitColumns(ws);

  // --- SHEET 2: DAFTAR_CABANG ---
  addDaftarCabangSheet(wb, activeOutlets, businessName);

  // --- SHEET 3: Panduan Stock Awal Gudang ---
  const wsGuide = wb.addWorksheet('PANDUAN_STOCK_AWAL', { views: [{ showGridLines: true }] });
  wsGuide.addRow(['PEDOMAN IMPORT STOCK AWAL FISIK PER GUDANG / CABANG']);
  wsGuide.getRow(1).font = { size: 12, bold: true, color: { argb: 'FF1E293B' } };
  wsGuide.addRow(['Petunjuk teknis pengisian alokasi stok fisik per cabang / gudang persediaan:']);
  wsGuide.addRow([]);

  const guideHeader = wsGuide.addRow(['Kolom / Parameter', 'Ketentuan Format', 'Penjelasan Teknis']);
  applyHeaderStyle(guideHeader, 'FF0369A1');

  const guideRows = [
    ['Nama Cabang / Gudang (▼)*', 'Wajib dipilih dari dropdown nama cabang', 'Menentukan ke gudang/outlet mana stok fisik awal akan dialokasikan. Pastikan nama cabang persis sama dengan Master Cabang.'],
    ['Kuantitas Stock Awal Fisik*', 'Kuantitas riil hasil hitung fisik di gudang', 'Jumlah stok fisik aktual saat mulai menggunakan sistem. Langsung tercatat sebagai Saldo Awal pada Kartu Stok cabang tersebut.'],
    ['Tipe Satuan Input (▼)*', 'Pilihan: PAKAI atau BELI', 'Jika memilih PAKAI (contoh gram), kuantitas diinput dalam gram. Jika memilih BELI (contoh kg), sistem akan otomatis mengonversikannya ke satuan pakai sesuai faktor konversi master bahan.'],
    ['Harga / Modal Satuan (Rp)', 'Nilai modal per unit satuan (Opsional)', 'Jika diisi, menjadi HPP awal khusus gudang ini. Jika dikosongkan, otomatis mengambil harga beli standar dari Master Bahan.'],
    ['Stok Minimal Gudang', 'Batas aman persediaan par level (Opsional)', 'Batas minimum persediaan di gudang tersebut sebelum sistem mengeluarkan peringatan stok menipis / low stock.'],
  ];
  guideRows.forEach((r) => wsGuide.addRow(r));
  autoFitColumns(wsGuide);

  await saveWorkbook(wb, `Template_Import_Stock_Awal_Gudang_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * 4. Download Template Excel Master Menu & F&B
 */
export async function downloadMenuTemplate() {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MOVA POS System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Master Menu', { views: [{ showGridLines: true }] });

  ws.mergeCells('A1:I1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'TEMPLATE IMPORT MASTER MENU & F&B — MOVA POS';
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:I2');
  const noteCell = ws.getCell('A2');
  noteCell.value = 'Petunjuk: Kolom bertanda (*) wajib diisi. Gunakan dropdown pada kolom Tipe Item (RECIPE/DIRECT/SERVICE/BUNDLE) & Status.';
  noteCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  ws.getRow(2).height = 20;

  ws.addRow([]); // Row 3 empty spacer

  const headerRow = ws.addRow([
    'Kode Menu',
    'Barcode',
    'Nama Menu*',
    'Kategori*',
    'Tipe Item (▼)*',
    'Harga Jual (Rp)*',
    'HPP / Modal (Rp)',
    'Deskripsi',
    'Status (▼)',
  ]);
  applyHeaderStyle(headerRow, 'FF4338CA'); // Indigo Dark

  const sampleData = [
    ['MNU-001', '8991001001', 'Kopi Aren Spesial', 'Minuman', 'RECIPE', 20000, 8000, 'Espresso kopi arabika dengan gula aren murni', 'TERSEDIA'],
    ['MNU-002', '8991001002', 'Air Mineral 600ml', 'Minuman Kemasan', 'DIRECT', 5000, 2500, 'Air mineral botol 600ml', 'TERSEDIA'],
    ['MNU-003', '', 'Sewa Ruangan VVIP / Jam', 'Jasa / Layanan', 'SERVICE', 150000, 0, 'Sewa tempat meeting per jam', 'TERSEDIA'],
    ['MNU-004', '', 'Paket Hemat Nongkrong', 'Paket Combo', 'BUNDLE', 45000, 20000, 'Combo Kopi Aren + Dimsum 4 pcs', 'TERSEDIA'],
  ];
  sampleData.forEach((r) => ws.addRow(r));

  ws.autoFilter = { from: 'A4', to: 'I4' };

  for (let r = 5; r <= 300; r++) {
    ws.getCell(`E${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"RECIPE,DIRECT,SERVICE,BUNDLE"'],
      showErrorMessage: true,
      errorTitle: 'Tipe Item Menu',
      error: 'Pilih: RECIPE (resep dapur), DIRECT (jual langsung tanpa olah), SERVICE (jasa), atau BUNDLE (paket combo).',
    };

    ws.getCell(`I${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"TERSEDIA,KOSONG"'],
      showErrorMessage: true,
      errorTitle: 'Status Ketersediaan',
      error: 'Pilih status ketersediaan: TERSEDIA atau KOSONG.',
    };
  }

  autoFitColumns(ws);

  await saveWorkbook(wb, `Template_Import_Master_Menu_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * 5. Download Template Excel Master Piutang (Kasbon Customer)
 */
export async function downloadReceivableTemplate() {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MOVA POS System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Master Piutang Kasbon', { views: [{ showGridLines: true }] });

  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'TEMPLATE IMPORT KASBON CUSTOMER (PIUTANG) — MOVA POS';
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:H2');
  const noteCell = ws.getCell('A2');
  noteCell.value = 'Petunjuk: Baris bertanda (*) wajib diisi. Format tanggal wajib: YYYY-MM-DD (Contoh: 2026-09-30).';
  noteCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  ws.getRow(2).height = 20;

  ws.addRow([]); // Row 3 empty spacer

  const headerRow = ws.addRow([
    'Nama Pelanggan / Debitur*',
    'Nomor HP',
    'Alamat Pelanggan',
    'Total Tagihan Kasbon (Rp)*',
    'Nominal DP / Uang Muka (Rp)',
    'Tanggal Terbit (YYYY-MM-DD)*',
    'Tanggal Jatuh Tempo (YYYY-MM-DD)*',
    'Catatan / Keterangan Kasbon',
  ]);
  applyHeaderStyle(headerRow, 'FFB45309'); // Amber Dark

  const sampleData = [
    ['Bpk H. Paksi', '081299887766', 'Jl. Sudirman No. 45 Makassar', 250000, 50000, '2026-09-24', '2026-10-01', 'Kasbon catering rapat 10 porsi'],
    ['Ibu Ratna', '085211223344', 'Komp. Galesong Indah B3/12', 150000, 0, '2026-09-24', '2026-10-08', 'Full kasbon pesanan makanan kantor'],
  ];
  sampleData.forEach((r) => ws.addRow(r));

  ws.autoFilter = { from: 'A4', to: 'H4' };
  autoFitColumns(ws);

  await saveWorkbook(wb, `Template_Import_Master_Piutang_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * 6. Download Template Excel Master Gudang & Outlet
 */
export async function downloadOutletTemplate() {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MOVA POS System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Master Outlet Gudang', { views: [{ showGridLines: true }] });

  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'TEMPLATE IMPORT MASTER GUDANG & OUTLET CABANG — MOVA POS';
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:G2');
  const noteCell = ws.getCell('A2');
  noteCell.value = 'Petunjuk: Baris bertanda (*) wajib diisi. Gunakan dropdown pada kolom Tipe & Cabang Utama.';
  noteCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  ws.getRow(2).height = 20;

  ws.addRow([]); // Row 3 empty spacer

  const headerRow = ws.addRow([
    'Kode Outlet / Gudang',
    'Nama Outlet / Cabang*',
    'Tipe (▼)*',
    'Nama PIC / Manager',
    'Nomor Telepon',
    'Alamat Lengkap',
    'Cabang Utama (▼)',
  ]);
  applyHeaderStyle(headerRow, 'FF047857'); // Emerald Dark

  const sampleData = [
    ['OUT-001', 'Maroa - Cabang Utama (Pusat)', 'PUSAT', 'Bpk Furqon', '081234567890', 'Jl. AP Pettarani No. 88 Makassar', 'YA'],
    ['OUT-002', 'Maroa - Branch Panakkukang', 'CABANG', 'Ibu Maya', '081298765432', 'Mall Panakkukang Lt 2', 'TIDAK'],
    ['GDG-001', 'Gudang Logistik Pusat', 'GUDANG', 'Bpk Herman', '085244332211', 'Kawasan Industri Makassar Blok B-12', 'TIDAK'],
  ];
  sampleData.forEach((r) => ws.addRow(r));

  ws.autoFilter = { from: 'A4', to: 'G4' };

  for (let r = 5; r <= 300; r++) {
    ws.getCell(`C${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"CABANG,PUSAT,GUDANG"'],
      showErrorMessage: true,
      errorTitle: 'Pilihan Tipe Outlet',
      error: 'Pilih: CABANG, PUSAT, atau GUDANG.',
    };

    ws.getCell(`G${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"YA,TIDAK"'],
      showErrorMessage: true,
      errorTitle: 'Cabang Utama',
      error: 'Pilih: YA atau TIDAK.',
    };
  }

  autoFitColumns(ws);

  await saveWorkbook(wb, `Template_Import_Master_Outlet_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * 7. Alias for Saldo Awal Template
 */
export async function downloadSaldoAwalTemplate(outlets = [], businessName = '') {
  return await downloadIngredientTemplate(outlets, businessName);
}



