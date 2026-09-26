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
 * 1. Download Template Excel Master Bahan (Ingredients)
 * Features:
 * - Dropdown Data Validation for Tipe (RAW/SEMI_FINISHED)
 * - Dropdown Data Validation for Satuan Beli & Satuan Pakai
 * - Auto-Filter on header row
 * - Guide Reference Sheet for Units & Conversions
 */
export async function downloadIngredientTemplate() {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MOVA POS System';
  wb.created = new Date();

  // --- SHEET 1: Master Bahan ---
  const ws = wb.addWorksheet('Master Bahan', { views: [{ showGridLines: true }] });

  // Banner Title
  ws.mergeCells('A1:L1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'TEMPLATE IMPORT MASTER BAHAN (BESERTA SALDO AWAL KARTU STOK) — MOVA POS';
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getRow(1).height = 28;

  // Instructions
  ws.mergeCells('A2:L2');
  const noteCell = ws.getCell('A2');
  noteCell.value = 'Petunjuk: Kolom bertanda (*) wajib diisi. Saldo Awal (diisi angka fisik dalam Satuan Pakai) dan Harga Beli otomatis tersimpan dan masuk sebagai Saldo Awal di Kartu Stok & Laporan Persediaan setiap cabang (tidak perlu impor ulang di Kartu Stok).';
  noteCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  ws.getRow(2).height = 20;

  ws.addRow([]); // Row 3 empty spacer

  // Row 4: Headers
  const headerRow = ws.addRow([
    'Kode Bahan',
    'Nama Bahan*',
    'Cabang / Outlet (Opsional)',
    'Kategori',
    'Tipe Bahan (▼)*',
    'Satuan Beli (▼)*',
    'Satuan Pakai (▼)*',
    'Faktor Konversi*',
    'Harga Beli Per Satuan Beli (Rp)*',
    'Saldo Awal (Satuan Pakai)*',
    'Stok Minimal (Satuan Pakai)',
    'Catatan',
  ]);
  applyHeaderStyle(headerRow, 'FF1E293B');

  // Rows 5+: Sample Data
  const sampleData = [
    ['BHN-001', 'Tepung Terigu Segitiga', 'Cabang Utama (Pusat)', 'BAHAN_BAKU', 'RAW', 'kg', 'gram', 1000, 14000, 10000, 2000, 'Kemasan 1 kg (Saldo Awal 10.000 gram masuk ke Kartu Stok)'],
    ['BHN-002', 'Minyak Goreng Bimoli', 'Cabang Utama (Pusat)', 'BAHAN_BAKU', 'RAW', 'liter', 'ml', 1000, 20000, 20000, 5000, 'Kemasan 1 liter (Saldo Awal 20.000 ml masuk ke Kartu Stok)'],
    ['BHN-003', 'Kopi Arabika Gayo', 'Branch Panakkukang', 'KOPI', 'RAW', 'kg', 'gram', 1000, 120000, 5000, 1000, 'Roast Bean Medium (Saldo Awal 5.000 gram)'],
    ['BHN-004', 'Saus Keju Special (Olahan)', 'Cabang Utama (Pusat)', 'SAUS', 'SEMI_FINISHED', 'liter', 'ml', 1000, 45000, 2000, 1000, 'Buatan Dapur (Saldo Awal 2.000 ml)'],
  ];

  sampleData.forEach((r) => ws.addRow(r));

  // Enable Auto-Filter on Row 4
  ws.autoFilter = { from: 'A4', to: 'L4' };

  // Apply Dropdown List Validations from row 5 to 300
  const SATUAN_BELI_LIST = '"kg,gram,liter,ml,Slop,Pack,Roll,Dus,Botol,pcs,Kaleng,Sachet"';
  const SATUAN_PAKAI_LIST = '"gram,ml,pcs,lembar,buah,porsi,sdm,sdt,roll"';

  for (let r = 5; r <= 300; r++) {
    // Column E: Tipe Bahan (RAW / SEMI_FINISHED)
    ws.getCell(`E${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"RAW,SEMI_FINISHED"'],
      showErrorMessage: true,
      errorTitle: 'Tipe Bahan Harus Sesuai',
      error: 'Pilih tipe bahan: RAW (bahan mentah) atau SEMI_FINISHED (olahan/prep).',
    };

    // Column F: Satuan Beli
    ws.getCell(`F${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [SATUAN_BELI_LIST],
      showErrorMessage: true,
      errorTitle: 'Pilihan Satuan Beli',
      error: 'Pilih satuan beli standar dari menu dropdown.',
    };

    // Column G: Satuan Pakai
    ws.getCell(`G${r}`).dataValidation = {
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
  wsGuide.addRow(['PEDOMAN SATUAN STANDAR, KONVERSI & SALDO AWAL MOVA POS']);
  wsGuide.getRow(1).font = { size: 12, bold: true, color: { argb: 'FF1E293B' } };
  wsGuide.addRow(['Sheet ini sebagai referensi pasangan satuan beli, satuan pakai, dan saldo awal stok:']);
  wsGuide.addRow([]);

  const guideHeader = wsGuide.addRow(['Parameter / Kolom', 'Ketentuan Format', 'Penjelasan Teknis']);
  applyHeaderStyle(guideHeader, 'FF0F766E'); // Teal Dark

  const guideRows = [
    ['Cabang / Outlet (Opsional)', 'Nama Cabang (Contoh: "Cabang Utama", "Panakkukang")', 'Jika diisi nama cabang, saldo awal dialokasikan ke cabang tsb. Jika kosong, masuk ke cabang aktif / pusat.'],
    ['Saldo Awal (Satuan Pakai)', 'Angka riil stok fisik dalam SATUAN PAKAI (misal: 10000 gram)', 'Otomatis langsung tercatat sebagai Saldo Awal di Kartu Stok & Laporan Persediaan (tidak perlu dobel import).'],
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
 * 2. Download Template Excel Master Perlengkapan & Packaging
 * Features:
 * - Dropdown Data Validation for Satuan Beli & Satuan Pakai
 * - Auto-Filter on header row
 */
export async function downloadPerlengkapanTemplate() {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MOVA POS System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Master Perlengkapan', { views: [{ showGridLines: true }] });

  ws.mergeCells('A1:L1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'TEMPLATE IMPORT MASTER PERLENGKAPAN & PACKAGING (BESERTA SALDO AWAL KARTU STOK) — MOVA POS';
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:L2');
  const noteCell = ws.getCell('A2');
  noteCell.value = 'Petunjuk: Baris bertanda (*) wajib diisi. Saldo Awal (diisi angka fisik dalam Satuan Pakai) dan Harga Beli otomatis tersimpan dan masuk sebagai Saldo Awal di Kartu Stok & Laporan Persediaan setiap cabang (tidak perlu impor ulang di Kartu Stok).';
  noteCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  ws.getRow(2).height = 20;

  ws.addRow([]); // Row 3 empty spacer

  const headerRow = ws.addRow([
    'Kode Perlengkapan',
    'Nama Perlengkapan*',
    'Cabang / Outlet (Opsional)',
    'Kategori',
    'Satuan Beli (▼)*',
    'Satuan Pakai (▼)*',
    'Faktor Konversi*',
    'Harga Beli Per Satuan Beli (Rp)*',
    'Saldo Awal (Satuan Pakai)*',
    'Stok Minimal (Satuan Pakai)',
    'Batas Toleransi (%)',
    'Catatan / Spesifikasi',
  ]);
  applyHeaderStyle(headerRow, 'FF1E293B');

  const sampleData = [
    ['PLK-001', 'Cup Dingin 16oz Sablon Logo', 'Cabang Utama (Pusat)', 'Cup & Gelas', 'Slop', 'pcs', 50, 25000, 500, 100, 5, 'Sablon logo 2 sisi, 1 slop = 50 pcs (Saldo Awal 500 pcs)'],
    ['PLK-002', 'Sedotan Boba Steril (Wrap)', 'Cabang Utama (Pusat)', 'Sedotan / Pipet', 'Pack', 'pcs', 100, 15000, 1000, 200, 5, 'Sedotan steril bungkus plastik (Saldo Awal 1.000 pcs)'],
    ['PLK-003', 'Tissue Makan Meja (Lunch Paper)', 'Branch Panakkukang', 'Tissue', 'Pack', 'lembar', 250, 12500, 2500, 500, 5, '1 pack = 250 lembar tissue (Saldo Awal 2.500 lembar)'],
    ['PLK-004', 'Roll Plastik Sealer Cup Motif', 'Cabang Utama (Pusat)', 'Tutup Cup / Sealer', 'Roll', 'pcs', 1200, 75000, 2400, 300, 5, '1 roll estimasi 1.200 cup (Saldo Awal 2.400 pcs)'],
    ['PLK-005', 'Kantong Plastik Kresek T-Shirt 1 Cup', 'Cabang Utama (Pusat)', 'Kantong & Paperbag', 'Pack', 'pcs', 100, 8500, 500, 100, 5, 'Bahan ramah lingkungan bening (Saldo Awal 500 pcs)'],
  ];
  sampleData.forEach((r) => ws.addRow(r));

  ws.autoFilter = { from: 'A4', to: 'L4' };

  for (let r = 5; r <= 300; r++) {
    // Column E: Satuan Beli
    ws.getCell(`E${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"Slop,Pack,Roll,Dus,pcs,Lusin,Ikat,Botol,Kaleng"'],
      showErrorMessage: true,
      errorTitle: 'Pilihan Satuan Beli',
      error: 'Pilih satuan beli standar dari dropdown.',
    };

    // Column F: Satuan Pakai
    ws.getCell(`F${r}`).dataValidation = {
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
 * 3. Download Template Excel Master Menu & F&B
 * Features:
 * - Dropdown Data Validation for Tipe Item (RECIPE, DIRECT, SERVICE, BUNDLE)
 * - Dropdown Data Validation for Status (TERSEDIA, KOSONG)
 * - Auto-Filter on header row
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
 * 4. Download Template Excel Master Piutang (Kasbon Customer)
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
 * 5. Download Template Excel Master Gudang & Outlet
 * Features:
 * - Dropdown Data Validation for Tipe (CABANG, PUSAT, GUDANG)
 * - Dropdown Data Validation for Cabang Utama (YA, TIDAK)
 * - Auto-Filter on header row
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
 * 6. Saldo Awal Template:
 * Saldo Awal stok persediaan terintegrasi langsung di template Master Bahan & Perlengkapan
 * (otomatis langsung tercatat ke Kartu Stok & Laporan Persediaan).
 */
export async function downloadSaldoAwalTemplate() {
  return await downloadIngredientTemplate();
}


