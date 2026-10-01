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
/**
 * 1. Download Template Excel Master Bahan (Bahan Baku & Olahan Terpusat)
 * Features:
 * - Master materials definition (Tanpa harga beli & tanpa saldo awal nilai, murni definisi master bahan)
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

  // --- SHEET 1: Master Bahan ---
  const ws = wb.addWorksheet('Master Bahan', { views: [{ showGridLines: true }] });

  // Banner Title (Row 1)
  ws.mergeCells('A1:J1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `TEMPLATE IMPORT MASTER BAHAN BAKU (TERPUSAT) — ${businessName || 'MOVA POS'}`;
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getRow(1).height = 28;

  // Instructions (Row 2)
  ws.mergeCells('A2:J2');
  const noteCell = ws.getCell('A2');
  noteCell.value = 'Petunjuk: Kolom bertanda (*) wajib diisi. Digunakan untuk mendaftarkan Master Bahan Baku. Stok Minimal hanya sebagai batas peringatan stok menipis (bukan stok awal). Untuk input saldo awal fisik, gunakan template "Saldo Awal Bahan per Gudang".';
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
    'Stok Minimal (Satuan Pakai)',
    'Batas Toleransi (%)',
    'Catatan / Spesifikasi',
  ]);
  applyHeaderStyle(headerRow, 'FF1E293B');

  // Rows 5+: Sample Data
  const sampleData = [
    ['BHN-001', 'Tepung Terigu Segitiga', 'BAHAN_BAKU', 'RAW', 'kg', 'gram', 1000, 2000, 5, 'Kemasan 1 kg (Standar adonan / dapur)'],
    ['BHN-002', 'Minyak Goreng Bimoli', 'BAHAN_BAKU', 'RAW', 'liter', 'ml', 1000, 5000, 5, 'Kemasan 1 liter'],
    ['BHN-003', 'Kopi Arabika Gayo', 'KOPI', 'RAW', 'kg', 'gram', 1000, 1000, 5, 'Roast Bean Medium'],
    ['BHN-004', 'Saus Keju Special (Olahan)', 'SAUS', 'SEMI_FINISHED', 'liter', 'ml', 1000, 1000, 5, 'Buatan Dapur (Bahan Setengah Jadi)'],
  ];
  sampleData.forEach((r) => ws.addRow(r));

  // Enable Auto-Filter on Row 4
  ws.autoFilter = { from: 'A4', to: 'J4' };

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
  wsGuide.addRow(['PEDOMAN MASTER BAHAN & KONVERSI']);
  wsGuide.getRow(1).font = { size: 12, bold: true, color: { argb: 'FF1E293B' } };
  wsGuide.addRow(['Sheet ini sebagai referensi pasangan satuan beli, satuan pakai, dan faktor konversi:']);
  wsGuide.addRow([]);

  const guideHeader = wsGuide.addRow(['Parameter / Kolom', 'Ketentuan Format', 'Penjelasan Teknis']);
  applyHeaderStyle(guideHeader, 'FF0F766E');

  const guideRows = [
    ['Master Terpusat', 'Berlaku otomatis di semua cabang', 'Setiap bahan yang di-import otomatis terdaftar dan bisa digunakan di seluruh cabang usaha Anda.'],
    ['Stok Minimal (Satuan Pakai)', 'Peringatan batas par level (misal: 2000 gram)', 'Hanya sebagai batas peringatan stok menipis / low stock. BUKAN stok awal!'],
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

  const ws = wb.addWorksheet('Master Perlengkapan', { views: [{ showGridLines: true }] });

  ws.mergeCells('A1:I1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `TEMPLATE IMPORT MASTER PERLENGKAPAN & PACKAGING (TERPUSAT) — ${businessName || 'MOVA POS'}`;
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:I2');
  const noteCell = ws.getCell('A2');
  noteCell.value = 'Petunjuk: Baris bertanda (*) wajib diisi. Digunakan untuk mendaftarkan Master Perlengkapan/Packaging. Stok Minimal hanya sebagai batas peringatan stok menipis (bukan stok awal). Untuk input saldo awal fisik, gunakan template "Saldo Awal Perlengkapan per Gudang".';
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
    'Stok Minimal (Satuan Pakai)',
    'Batas Toleransi (%)',
    'Catatan / Spesifikasi',
  ]);
  applyHeaderStyle(headerRow, 'FF1E293B');

  const sampleData = [
    ['PLK-001', 'Cup Dingin 16oz Sablon Logo', 'Cup & Gelas', 'Slop', 'pcs', 50, 100, 5, 'Sablon logo 2 sisi, 1 slop = 50 pcs'],
    ['PLK-002', 'Sedotan Boba Steril (Wrap)', 'Sedotan / Pipet', 'Pack', 'pcs', 100, 200, 5, 'Sedotan steril bungkus plastik'],
    ['PLK-003', 'Tissue Makan Meja (Lunch Paper)', 'Tissue', 'Pack', 'lembar', 250, 500, 5, '1 pack = 250 lembar tissue'],
    ['PLK-004', 'Roll Plastik Sealer Cup Motif', 'Tutup Cup / Sealer', 'Roll', 'pcs', 1200, 300, 5, '1 roll estimasi 1.200 cup'],
    ['PLK-005', 'Kantong Plastik Kresek T-Shirt 1 Cup', 'Kantong & Paperbag', 'Pack', 'pcs', 100, 100, 5, 'Bahan ramah lingkungan bening'],
  ];
  sampleData.forEach((r) => ws.addRow(r));

  ws.autoFilter = { from: 'A4', to: 'I4' };

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
 * 3.A Download Template Excel Saldo Awal Bahan Baku per Gudang / Cabang
 */
export async function downloadStockAwalBahanTemplate(outlets = [], businessName = '') {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MOVA POS System';
  wb.created = new Date();
  wb.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];

  const { activeOutlets, mainOutlet, secondOutlet, outletListFormula } = prepareOutletData(outlets);

  // --- SHEET 1: Saldo Awal Bahan ---
  const ws = wb.addWorksheet('Saldo Awal Bahan', { views: [{ showGridLines: true }] });

  ws.mergeCells('A1:K1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `TEMPLATE IMPORT SALDO AWAL BAHAN BAKU PER GUDANG / CABANG — ${businessName || 'MOVA POS'}`;
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:K2');
  const noteCell = ws.getCell('A2');
  noteCell.value = 'Petunjuk: Kolom bertanda (*) wajib diisi. Digunakan untuk mengalokasikan saldo awal stok fisik BAHAN BAKU ke kartu stok cabang/gudang terpilih.';
  noteCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  ws.getRow(2).height = 20;

  ws.addRow([]); // Row 3 empty spacer

  const headerRow = ws.addRow([
    'Nama Cabang / Gudang (▼)*',
    'Kode Bahan',
    'Nama Bahan Baku*',
    'Kategori (Opsional)',
    'Tipe Satuan Input (▼)*',
    'Satuan (▼)*',
    'Kuantitas Saldo Awal Fisik*',
    'Harga / Nilai Modal Satuan (Rp)',
    'Stok Minimal Gudang',
    'Tanggal Efektif (YYYY-MM-DD)',
    'Catatan / Keterangan',
  ]);
  applyHeaderStyle(headerRow, 'FF0369A1'); // Ocean Blue Dark

  const sampleData = [
    [mainOutlet.name, 'BHN-001', 'Tepung Terigu Segitiga', 'BAHAN_BAKU', 'PAKAI', 'gram', 15000, 14, 2000, '2026-09-28', 'Stok fisik awal tepung di Gudang Utama (15 kg)'],
    [secondOutlet.name, 'BHN-001', 'Tepung Terigu Segitiga', 'BAHAN_BAKU', 'PAKAI', 'gram', 5000, 14, 1000, '2026-09-28', 'Stok fisik awal tepung di Cabang (5 kg)'],
    [mainOutlet.name, 'BHN-002', 'Minyak Goreng Bimoli', 'BAHAN_BAKU', 'PAKAI', 'ml', 20000, 20, 5000, '2026-09-28', 'Stok awal minyak di Gudang Utama (20 liter)'],
    [secondOutlet.name, 'BHN-002', 'Minyak Goreng Bimoli', 'BAHAN_BAKU', 'PAKAI', 'ml', 8000, 20, 2000, '2026-09-28', 'Stok awal minyak di Cabang (8 liter)'],
    [mainOutlet.name, 'BHN-003', 'Kopi Arabika Gayo', 'KOPI', 'PAKAI', 'gram', 5000, 120, 1000, '2026-09-28', 'Stok awal roast bean di Gudang Utama (5 kg)'],
  ];
  sampleData.forEach((r) => ws.addRow(r));

  ws.autoFilter = { from: 'A4', to: 'K4' };

  const ALL_UNITS_LIST = '"gram,ml,kg,liter,pcs,slop,pack,roll,botol,dus,can,sachet,porsi,sdm,sdt"';

  for (let r = 5; r <= 500; r++) {
    ws.getCell(`A${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [outletListFormula],
      showErrorMessage: true,
      errorTitle: 'Pilih Cabang / Gudang Resmi',
      error: 'Pilih nama cabang/gudang dari daftar master cabang usaha Anda.',
    };

    ws.getCell(`E${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"PAKAI,BELI"'],
      showErrorMessage: true,
      errorTitle: 'Pilihan Tipe Satuan',
      error: 'Pilih PAKAI (misal gram/ml) atau BELI (misal kg/liter).',
    };

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

  await saveWorkbook(wb, `Template_Import_Saldo_Awal_Bahan_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * 3.B Download Template Excel Saldo Awal Perlengkapan & Packaging per Gudang / Cabang
 */
export async function downloadStockAwalPerlengkapanTemplate(outlets = [], businessName = '') {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MOVA POS System';
  wb.created = new Date();
  wb.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];

  const { activeOutlets, mainOutlet, secondOutlet, outletListFormula } = prepareOutletData(outlets);

  // --- SHEET 1: Saldo Awal Perlengkapan ---
  const ws = wb.addWorksheet('Saldo Awal Perlengkapan', { views: [{ showGridLines: true }] });

  ws.mergeCells('A1:K1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `TEMPLATE IMPORT SALDO AWAL PERLENGKAPAN & PACKAGING PER GUDANG / CABANG — ${businessName || 'MOVA POS'}`;
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:K2');
  const noteCell = ws.getCell('A2');
  noteCell.value = 'Petunjuk: Kolom bertanda (*) wajib diisi. Digunakan untuk mengalokasikan saldo awal stok fisik PERLENGKAPAN/PACKAGING ke kartu stok cabang/gudang terpilih.';
  noteCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  ws.getRow(2).height = 20;

  ws.addRow([]); // Row 3 empty spacer

  const headerRow = ws.addRow([
    'Nama Cabang / Gudang (▼)*',
    'Kode Perlengkapan',
    'Nama Perlengkapan / Kemasan*',
    'Kategori (Opsional)',
    'Tipe Satuan Input (▼)*',
    'Satuan (▼)*',
    'Kuantitas Saldo Awal Fisik*',
    'Harga / Nilai Modal Satuan (Rp)',
    'Stok Minimal Gudang',
    'Tanggal Efektif (YYYY-MM-DD)',
    'Catatan / Keterangan',
  ]);
  applyHeaderStyle(headerRow, 'FF047857'); // Emerald Dark

  const sampleData = [
    [mainOutlet.name, 'PLK-001', 'Cup Dingin 16oz Sablon Logo', 'Cup & Gelas', 'PAKAI', 'pcs', 1000, 500, 200, '2026-09-28', 'Stok fisik awal cup di Gudang Utama (1.000 pcs)'],
    [secondOutlet.name, 'PLK-001', 'Cup Dingin 16oz Sablon Logo', 'Cup & Gelas', 'PAKAI', 'pcs', 300, 500, 100, '2026-09-28', 'Stok fisik awal cup di Cabang (300 pcs)'],
    [mainOutlet.name, 'PLK-002', 'Sedotan Boba Steril (Wrap)', 'Sedotan / Pipet', 'PAKAI', 'pcs', 500, 150, 100, '2026-09-28', 'Stok awal sedotan di Gudang Utama (500 pcs)'],
    [secondOutlet.name, 'PLK-002', 'Sedotan Boba Steril (Wrap)', 'Sedotan / Pipet', 'PAKAI', 'pcs', 200, 150, 50, '2026-09-28', 'Stok awal sedotan di Cabang (200 pcs)'],
    [mainOutlet.name, 'PLK-003', 'Tissue Makan Meja (Lunch Paper)', 'Tissue', 'PAKAI', 'lembar', 2500, 50, 500, '2026-09-28', 'Stok awal tissue di Gudang Utama (10 pack = 2.500 lembar)'],
  ];
  sampleData.forEach((r) => ws.addRow(r));

  ws.autoFilter = { from: 'A4', to: 'K4' };

  const ALL_UNITS_LIST = '"pcs,lembar,slop,pack,roll,dus,ikat,botol,kaleng,gram,ml"';

  for (let r = 5; r <= 500; r++) {
    ws.getCell(`A${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [outletListFormula],
      showErrorMessage: true,
      errorTitle: 'Pilih Cabang / Gudang Resmi',
      error: 'Pilih nama cabang/gudang dari daftar master cabang usaha Anda.',
    };

    ws.getCell(`E${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"PAKAI,BELI"'],
      showErrorMessage: true,
      errorTitle: 'Pilihan Tipe Satuan',
      error: 'Pilih PAKAI (misal pcs/lembar) atau BELI (misal slop/pack/roll).',
    };

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

  await saveWorkbook(wb, `Template_Import_Saldo_Awal_Perlengkapan_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Backward compatibility alias for stock awal template
 */
export const downloadStockAwalGudangTemplate = downloadStockAwalBahanTemplate;

/**
 * 4. Download Template Excel Master Menu & F&B
 */
export async function downloadMenuTemplate() {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MOVA POS System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Master Menu', { views: [{ showGridLines: true }] });

  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'TEMPLATE IMPORT MASTER MENU & F&B — MOVA POS';
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:H2');
  const noteCell = ws.getCell('A2');
  noteCell.value = 'Petunjuk: Kolom bertanda (*) wajib diisi. Gunakan dropdown pada kolom Tipe Item (RECIPE/DIRECT/SERVICE/BUNDLE). Status menu otomatis aktif/tersedia.';
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
  ]);
  applyHeaderStyle(headerRow, 'FF4338CA'); // Indigo Dark

  const sampleData = [
    ['MNU-001', '8991001001', 'Kopi Aren Spesial', 'Minuman', 'RECIPE', 20000, 8000, 'Espresso kopi arabika dengan gula aren murni'],
    ['MNU-002', '8991001002', 'Air Mineral 600ml', 'Minuman Kemasan', 'DIRECT', 5000, 2500, 'Air mineral botol 600ml'],
    ['MNU-003', '', 'Sewa Ruangan VVIP / Jam', 'Jasa / Layanan', 'SERVICE', 150000, 0, 'Sewa tempat meeting per jam'],
    ['MNU-004', '', 'Paket Hemat Nongkrong', 'Paket Combo', 'BUNDLE', 45000, 20000, 'Combo Kopi Aren + Dimsum 4 pcs'],
  ];
  sampleData.forEach((r) => ws.addRow(r));

  ws.autoFilter = { from: 'A4', to: 'H4' };

  for (let r = 5; r <= 300; r++) {
    ws.getCell(`E${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"RECIPE,DIRECT,SERVICE,BUNDLE"'],
      showErrorMessage: true,
      errorTitle: 'Tipe Item Menu',
      error: 'Pilih: RECIPE (resep dapur), DIRECT (jual langsung tanpa olah), SERVICE (jasa), atau BUNDLE (paket combo).',
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
 * 7. Download Template Excel Resep & Gramasi Menu (Bill of Materials / BOM)
 * Menampilkan Dropdown Filter Nama Menu & Nama Bahan, serta formula lookup otomatis untuk Kode Menu, Kode Bahan, dan Satuan Pakai.
 */
export async function downloadRecipeTemplate(menusOrIngredients = [], maybeIngredients = [], maybeBusinessName = '') {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MOVA POS System';
  wb.created = new Date();

  // Normalize arguments
  let menusList = [];
  let ingredientsList = [];
  let businessName = '';

  if (typeof maybeBusinessName === 'string' && maybeBusinessName.length > 0) {
    menusList = Array.isArray(menusOrIngredients) ? menusOrIngredients : [];
    ingredientsList = Array.isArray(maybeIngredients) ? maybeIngredients : [];
    businessName = maybeBusinessName;
  } else if (typeof maybeIngredients === 'string') {
    ingredientsList = Array.isArray(menusOrIngredients) ? menusOrIngredients : [];
    businessName = maybeIngredients;
  } else {
    menusList = Array.isArray(menusOrIngredients) ? menusOrIngredients : [];
    ingredientsList = Array.isArray(maybeIngredients) ? maybeIngredients : [];
    businessName = typeof maybeBusinessName === 'string' ? maybeBusinessName : '';
  }

  // Active master menus
  const activeMenus = Array.isArray(menusList) && menusList.length > 0
    ? menusList.filter((m) => m.active !== false && m.active !== 0)
    : [];

  const defaultMenus = [
    { code: 'MNU-001', name: 'Es Kopi Susu Gula Aren', category: 'Minuman', item_type: 'RECIPE', price: 20000 },
    { code: 'MNU-002', name: 'Matcha Latte Ice', category: 'Minuman', item_type: 'RECIPE', price: 22000 },
    { code: 'MNU-003', name: 'Nasi Goreng Spesial', category: 'Makanan', item_type: 'RECIPE', price: 28000 },
    { code: 'MNU-004', name: 'Roti Bakar Coklat Keju', category: 'Snack', item_type: 'RECIPE', price: 18000 },
  ];
  const sourceMenus = activeMenus.length > 0 ? activeMenus : defaultMenus;

  // Active master ingredients
  const activeIngredients = Array.isArray(ingredientsList) && ingredientsList.length > 0
    ? ingredientsList.filter((i) => i.active !== false && i.active !== 0)
    : [];

  const defaultIngredients = [
    { code: 'BHN-001', name: 'Espresso Roasted Bean Arabica', category: 'KOPI', type: 'RAW', unit_pakai: 'gram', unit_beli: 'kg', konversi: 1000, harga: 120000 },
    { code: 'BHN-002', name: 'Fresh Milk Diamond', category: 'SUSU', type: 'RAW', unit_pakai: 'ml', unit_beli: 'liter', konversi: 1000, harga: 20000 },
    { code: 'BHN-003', name: 'Gula Aren Cair Organik', category: 'SIRUP', type: 'RAW', unit_pakai: 'ml', unit_beli: 'liter', konversi: 1000, harga: 25000 },
    { code: 'BHN-004', name: 'Matcha Powder Pure Uji', category: 'BUBUK', type: 'RAW', unit_pakai: 'gram', unit_beli: 'kg', konversi: 1000, harga: 350000 },
    { code: 'BHN-005', name: 'Simple Syrup Cair', category: 'SIRUP', type: 'RAW', unit_pakai: 'ml', unit_beli: 'liter', konversi: 1000, harga: 15000 },
    { code: 'BHN-006', name: 'Beras Pulen Masak (Nasi Putih)', category: 'BAHAN_BAKU', type: 'RAW', unit_pakai: 'gram', unit_beli: 'kg', konversi: 1000, harga: 14000 },
    { code: 'BHN-007', name: 'Telur Ayam Negeri', category: 'BAHAN_BAKU', type: 'RAW', unit_pakai: 'butir', unit_beli: 'kg', konversi: 16, harga: 28000 },
    { code: 'BHN-008', name: 'Daging Ayam Fillet Potong', category: 'DAGING', type: 'RAW', unit_pakai: 'gram', unit_beli: 'kg', konversi: 1000, harga: 48000 },
    { code: 'BHN-009', name: 'Minyak Goreng Sawit', category: 'MINYAK', type: 'RAW', unit_pakai: 'ml', unit_beli: 'liter', konversi: 1000, harga: 18000 },
    { code: 'PLK-001', name: 'Cup Plastik Dingin 16oz', category: 'Cup & Gelas', type: 'RAW', unit_pakai: 'pcs', unit_beli: 'slop', konversi: 50, harga: 25000 },
    { code: 'PLK-002', name: 'Sedotan Steril Higienis', category: 'Sedotan / Pipet', type: 'RAW', unit_pakai: 'pcs', unit_beli: 'pack', konversi: 100, harga: 15000 },
    { code: 'PLK-003', name: 'Kotak Makan / Paper Lunchbox', category: 'Kotak & Dus', type: 'RAW', unit_pakai: 'pcs', unit_beli: 'pack', konversi: 50, harga: 35000 },
  ];
  const sourceIngredients = activeIngredients.length > 0 ? activeIngredients : defaultIngredients;

  // Validation dropdown formula for Menu
  const menuNamesClean = sourceMenus.map((m) => String(m.name || '').replace(/,/g, ' ').trim()).filter(Boolean);
  const menuListInline = `"${menuNamesClean.slice(0, 30).join(',')}"`;
  const menuValidationFormula = menuListInline.length < 240 ? menuListInline : 'DAFTAR_MASTER_MENU!$B$5:$B$500';

  // Validation dropdown formula for Ingredient
  const ingNamesClean = sourceIngredients.map((i) => String(i.name || '').replace(/,/g, ' ').trim()).filter(Boolean);
  const ingListInline = `"${ingNamesClean.slice(0, 30).join(',')}"`;
  const ingValidationFormula = ingListInline.length < 240 ? ingListInline : 'DAFTAR_MASTER_BAHAN!$B$5:$B$500';

  // --- SHEET 1: Resep & Gramasi Menu ---
  const ws = wb.addWorksheet('Resep & Gramasi Menu', { views: [{ showGridLines: true }] });

  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `TEMPLATE IMPORT RESEP & GRAMASI PER-MENU (BOM) — ${businessName ? businessName.toUpperCase() : 'MOVA POS'}`;
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:H2');
  const noteCell = ws.getCell('A2');
  noteCell.value = 'Petunjuk: Pilih Nama Menu & Nama Bahan dari menu dropdown (▼). Kode Menu, Kode Bahan, dan Satuan Pakai akan OTOMATIS terisi dari Master Data. Anda hanya perlu mengisi Gramasi (Qty) & Catatan.';
  noteCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  ws.getRow(2).height = 20;

  ws.addRow([]); // Row 3 empty spacer

  const headerRow = ws.addRow([
    'Kode Menu (Otomatis)',
    'Nama Menu / Produk (▼)*',
    'Kode Bahan (Otomatis)',
    'Nama Bahan / Perlengkapan (▼)*',
    'Gramasi / Qty*',
    'Satuan Pakai (Otomatis / ▼)*',
    'Standar Susut / Waste (%)',
    'Catatan / Petunjuk Resep',
  ]);
  applyHeaderStyle(headerRow, 'FF7C3AED'); // Violet Purple

  const sampleItems = [
    // Menu 1: Es Kopi Susu Gula Aren
    { menuName: 'Es Kopi Susu Gula Aren', ingName: 'Espresso Roasted Bean Arabica', qty: 18, waste: 0, notes: 'Double shot espresso 36ml' },
    { menuName: 'Es Kopi Susu Gula Aren', ingName: 'Fresh Milk Diamond', qty: 120, waste: 0, notes: 'Susu segar dingin' },
    { menuName: 'Es Kopi Susu Gula Aren', ingName: 'Gula Aren Cair Organik', qty: 25, waste: 0, notes: 'Otomatis terkunci ke satuan ml' },
    { menuName: 'Es Kopi Susu Gula Aren', ingName: 'Cup Plastik Dingin 16oz', qty: 1, waste: 0, notes: 'Kemasan take-away' },
    { menuName: 'Es Kopi Susu Gula Aren', ingName: 'Sedotan Steril Higienis', qty: 1, waste: 0, notes: 'Sedotan steril' },

    // Menu 2: Matcha Latte Ice
    { menuName: 'Matcha Latte Ice', ingName: 'Matcha Powder Pure Uji', qty: 10, waste: 0, notes: 'Bubuk matcha murni di-whisk' },
    { menuName: 'Matcha Latte Ice', ingName: 'Fresh Milk Diamond', qty: 150, waste: 0, notes: 'Susu segar dingin' },
    { menuName: 'Matcha Latte Ice', ingName: 'Simple Syrup Cair', qty: 20, waste: 0, notes: 'Gula tebu cair' },
    { menuName: 'Matcha Latte Ice', ingName: 'Cup Plastik Dingin 16oz', qty: 1, waste: 0, notes: 'Kemasan take-away' },

    // Menu 3: Nasi Goreng Spesial
    { menuName: 'Nasi Goreng Spesial', ingName: 'Beras Pulen Masak (Nasi Putih)', qty: 180, waste: 2, notes: 'Nasi matang porsi standar' },
    { menuName: 'Nasi Goreng Spesial', ingName: 'Telur Ayam Negeri', qty: 1, waste: 0, notes: 'Diceplok / orak arik' },
    { menuName: 'Nasi Goreng Spesial', ingName: 'Daging Ayam Fillet Potong', qty: 40, waste: 5, notes: 'Susut matang 5%' },
    { menuName: 'Nasi Goreng Spesial', ingName: 'Minyak Goreng Sawit', qty: 15, waste: 0, notes: 'Minyak tumis bumbu' },
    { menuName: 'Nasi Goreng Spesial', ingName: 'Kotak Makan / Paper Lunchbox', qty: 1, waste: 0, notes: 'Box kemasan saji' },
  ];

  // Insert sample rows (Row 5 to Row 18)
  sampleItems.forEach((it, idx) => {
    const rowNum = 5 + idx;
    const row = ws.addRow([
      '', // A: Kode Menu (will be set via formula)
      it.menuName, // B: Nama Menu
      '', // C: Kode Bahan (will be set via formula)
      it.ingName, // D: Nama Bahan
      it.qty, // E: Qty
      '', // F: Satuan (will be set via formula)
      it.waste, // G: Waste
      it.notes, // H: Notes
    ]);

    // Lookup matching menu & ingredient codes for formula result preview
    const matchedMenu = sourceMenus.find((m) => m.name === it.menuName);
    const matchedIng = sourceIngredients.find((i) => i.name === it.ingName);

    row.getCell(1).value = {
      formula: `IF(B${rowNum}="","",IFERROR(INDEX(DAFTAR_MASTER_MENU!$A$5:$A$500,MATCH(B${rowNum},DAFTAR_MASTER_MENU!$B$5:$B$500,0)),""))`,
      result: matchedMenu?.code || 'MNU-001',
    };
    row.getCell(3).value = {
      formula: `IF(D${rowNum}="","",IFERROR(INDEX(DAFTAR_MASTER_BAHAN!$A$5:$A$500,MATCH(D${rowNum},DAFTAR_MASTER_BAHAN!$B$5:$B$500,0)),""))`,
      result: matchedIng?.code || 'BHN-001',
    };
    row.getCell(6).value = {
      formula: `IF(D${rowNum}="","",IFERROR(INDEX(DAFTAR_MASTER_BAHAN!$E$5:$E$500,MATCH(D${rowNum},DAFTAR_MASTER_BAHAN!$B$5:$B$500,0)),"gram"))`,
      result: matchedIng?.unit_pakai || 'gram',
    };
  });

  // Set autoFilter on table header
  ws.autoFilter = { from: 'A4', to: 'H4' };

  const RECIPE_UNITS_LIST = '"gram,ml,shot,pcs,lembar,buah,butir,porsi,sdm,sdt,cup,pack,slop,roll,botol,sachet,can,dus"';

  // Apply dropdown data validation across sample rows and subsequent rows
  for (let r = 5; r <= 100; r++) {
    // Column B: Nama Menu Dropdown Filter
    ws.getCell(`B${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [menuValidationFormula],
      showErrorMessage: true,
      errorTitle: 'Pilih Menu Resmi',
      error: 'Pilih nama menu dari menu dropdown atau ketik nama menu baru.',
    };

    // Column D: Nama Bahan Dropdown Filter
    ws.getCell(`D${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [ingValidationFormula],
      showErrorMessage: true,
      errorTitle: 'Pilih Bahan / Kemasan Resmi',
      error: 'Pilih nama bahan/kemasan dari dropdown atau ketik nama bahan baru.',
    };

    // Column F: Satuan Pakai Dropdown
    ws.getCell(`F${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [RECIPE_UNITS_LIST],
      showErrorMessage: true,
      errorTitle: 'Pilihan Satuan Pakai Resep',
      error: 'Pilih satuan pakai standar: gram, ml, shot, pcs, lembar, buah, butir, porsi, sdm, sdt, cup, dsb.',
    };
  }

  autoFitColumns(ws);

  // --- SHEET 2: DAFTAR_MASTER_MENU (Reference Sheet) ---
  const wsMenus = wb.addWorksheet('DAFTAR_MASTER_MENU', { views: [{ showGridLines: true }] });
  wsMenus.mergeCells('A1:E1');
  const menuTitle = wsMenus.getCell('A1');
  menuTitle.value = `DAFTAR MASTER MENU & PRODUK RESMI — ${businessName || 'MOVA POS'}`;
  menuTitle.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF1E293B' } };
  menuTitle.alignment = { vertical: 'middle', horizontal: 'left' };
  menuTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  wsMenus.getRow(1).height = 26;

  wsMenus.mergeCells('A2:E2');
  const menuDesc = wsMenus.getCell('A2');
  menuDesc.value = 'Daftar menu ini terhubung otomatis dengan pilihan dropdown Nama Menu di sheet Resep. Kode menu akan otomatis terisi.';
  menuDesc.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  wsMenus.getRow(2).height = 20;

  wsMenus.addRow([]); // Row 3 spacer

  const menuHeader = wsMenus.addRow(['Kode Menu', 'Nama Menu (Master)', 'Kategori', 'Tipe Menu', 'Harga Jual (Rp)']);
  applyHeaderStyle(menuHeader, 'FF4338CA'); // Indigo Dark

  sourceMenus.forEach((m) => {
    wsMenus.addRow([
      m.code || `MNU-${m.id}`,
      m.name,
      m.category || 'Umum',
      m.item_type || 'RECIPE',
      Number(m.price || 0),
    ]);
  });
  autoFitColumns(wsMenus);

  // --- SHEET 3: DAFTAR_MASTER_BAHAN (Reference Sheet) ---
  const wsIngs = wb.addWorksheet('DAFTAR_MASTER_BAHAN', { views: [{ showGridLines: true }] });
  wsIngs.mergeCells('A1:F1');
  const ingTitle = wsIngs.getCell('A1');
  ingTitle.value = `DAFTAR MASTER BAHAN & KUNCIAN SATUAN RESEP — ${businessName || 'MOVA POS'}`;
  ingTitle.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF1E293B' } };
  ingTitle.alignment = { vertical: 'middle', horizontal: 'left' };
  ingTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  wsIngs.getRow(1).height = 26;

  wsIngs.mergeCells('A2:F2');
  const ingDesc = wsIngs.getCell('A2');
  ingDesc.value = 'Berikut adalah kuncian Satuan Pakai resmi dari Master Bahan. Saat menginput resep, sistem otomatis mengunci gramasi ke satuan ini.';
  ingDesc.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  wsIngs.getRow(2).height = 20;

  wsIngs.addRow([]); // Row 3 spacer

  const ingHeader = wsIngs.addRow(['Kode Bahan', 'Nama Bahan / Kemasan (Master)', 'Kategori', 'Tipe Bahan', 'Kuncian Satuan Pakai (Resep)*', 'Estimasi Modal/Harga Satuan']);
  applyHeaderStyle(ingHeader, 'FF047857'); // Emerald Dark

  sourceIngredients.forEach((ing) => {
    const konv = Math.max(Number(ing.konversi || 1), 1);
    const unitCost = Number(ing.harga || 0) / konv;
    wsIngs.addRow([
      ing.code || `BHN-${ing.id}`,
      ing.name,
      ing.category || 'BAHAN_BAKU',
      ing.type === 'SEMI_FINISHED' ? 'Bahan Olahan' : 'Bahan Mentah',
      ing.unit_pakai || 'gram',
      Math.round(unitCost),
    ]);
  });
  autoFitColumns(wsIngs);

  // --- SHEET 4: PANDUAN_RESEP_DAN_BOM ---
  const wsGuide = wb.addWorksheet('PANDUAN_RESEP_DAN_BOM', { views: [{ showGridLines: true }] });
  wsGuide.addRow(['PEDOMAN IMPORT RESEP & GRAMASI PER-MENU (BILL OF MATERIALS / BOM)']);
  wsGuide.getRow(1).font = { size: 12, bold: true, color: { argb: 'FF1E293B' } };
  wsGuide.addRow(['Petunjuk teknis pengisian resep, gramasi, kemasan, dan kuncian satuan otomatis:']);
  wsGuide.addRow([]);

  const guideHeader = wsGuide.addRow(['Kolom / Parameter', 'Ketentuan Format', 'Penjelasan & Kuncian Otomatis']);
  applyHeaderStyle(guideHeader, 'FF7C3AED');

  const guideRows = [
    ['Nama Menu (▼)*', 'Pilih dari dropdown menu master', 'Pilih nama menu dari menu dropdown. Kode Menu akan otomatis terisi melalui formula. Jika 1 menu memakai 4 bahan, ulangi Nama Menu yang sama di 4 baris.'],
    ['Nama Bahan (▼)*', 'Pilih dari dropdown master bahan/kemasan', 'Pilih nama bahan atau kemasan dari menu dropdown. Kode Bahan & Satuan Pakai akan otomatis terisi dari Master Bahan.'],
    ['Kode Menu & Kode Bahan', 'Otomatis terisi dari formula', 'Kolom ini otomatis mengambil kode resmi dari Sheet DAFTAR_MASTER_MENU & DAFTAR_MASTER_BAHAN.'],
    ['Gramasi / Qty*', 'Angka kuantitas bahan per 1 porsi menu', 'Jumlah pemakaian bahan per porsi. Contoh: 18 (artinya 18 gram), 25 (artinya 25 ml), 1 (artinya 1 pcs cup).'],
    ['Satuan Pakai (Otomatis)*', 'Otomatis terkunci dari Master Bahan', 'Satuan gramasi otomatis terhubung dengan Master Bahan (misal: Gula Aren = ml, Kopi = gram, Cup = pcs).'],
    ['Standar Susut / Waste (%)', 'Persentase susut wajar saat pengolahan (0 - 100%)', 'Jika ada penyusutan bahan saat persiapan/memasak (misal 5%), sistem otomatis memperhitungkan tambahan biaya HPP.'],
    ['Kalkulasi HPP Otomatis', 'Dihitung realtime oleh sistem', 'Setelah resep di-import, MOVA POS otomatis mengalkulasi total HPP per menu & mencatat histori versi resep.'],
  ];
  guideRows.forEach((r) => wsGuide.addRow(r));
  autoFitColumns(wsGuide);

  await saveWorkbook(wb, `Template_Import_Resep_dan_Gramasi_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * 8. Alias for Saldo Awal Template
 */
export async function downloadSaldoAwalTemplate(outlets = [], businessName = '') {
  return await downloadIngredientTemplate(outlets, businessName);
}



