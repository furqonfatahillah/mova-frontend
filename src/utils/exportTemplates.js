/**
 * Utility for generating & downloading Excel Template (.xlsx) files
 * for importing Master Data: Ingredients, Menus, Receivables (Kasbon), and Outlets.
 */

async function getXLSX() {
  return await import('xlsx');
}

/**
 * Auto-fit column widths helper
 */
function fitColumns(rows) {
  const colWidths = [];
  rows.forEach(row => {
    (row || []).forEach((val, idx) => {
      const len = val !== null && val !== undefined ? String(val).length : 0;
      colWidths[idx] = Math.max(colWidths[idx] || 12, Math.min(len + 4, 60));
    });
  });
  return colWidths.map(w => ({ wch: w }));
}

/**
 * Download Template Excel Master Bahan (Ingredients)
 */
export async function downloadIngredientTemplate() {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();

  const rows = [
    ['TEMPLATE IMPORT MASTER BAHAN (INGREDIENTS) — MOVA POS'],
    ['Petunjuk: Baris bertanda (*) wajib diisi. Jangan mengubah nama kolom pada baris header (Baris 5).'],
    [],
    ['=== PETUNJUK TIPE & KATEGORI ==='],
    ['Kode Bahan', 'Nama Bahan*', 'Kategori', 'Tipe Bahan (RAW/SEMI_FINISHED)*', 'Satuan Beli*', 'Satuan Pakai*', 'Faktor Konversi*', 'Harga Beli Per Satuan Beli (Rp)*', 'Stok Minimal', 'Stok Awal', 'Catatan'],
    ['BHN-001', 'Tepung Terigu Segitiga', 'BAHAN_BAKU', 'RAW', 'kg', 'gram', 1000, 14000, 2, 10, 'Kemasan 1 kg'],
    ['BHN-002', 'Minyak Goreng Bimoli', 'BAHAN_BAKU', 'RAW', 'liter', 'ml', 1000, 20000, 5, 20, 'Kemasan 1 liter'],
    ['BHN-003', 'Kopi Arabika Gayo', 'KOPI', 'RAW', 'kg', 'gram', 1000, 120000, 1, 5, 'Roast Bean Medium'],
    ['BHN-004', 'Saus Keju Special (Olahan)', 'SAUS', 'SEMI_FINISHED', 'liter', 'ml', 1000, 45000, 1, 2, 'Buatan Dapur'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Master Bahan');

  XLSX.writeFile(wb, `Template_Import_Master_Bahan_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Download Template Excel Master Menu
 */
export async function downloadMenuTemplate() {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();

  const rows = [
    ['TEMPLATE IMPORT MASTER MENU & F&B — MOVA POS'],
    ['Petunjuk: Baris bertanda (*) wajib diisi. Tipe item yang valid: RECIPE, DIRECT, SERVICE, BUNDLE.'],
    [],
    ['=== DAFTAR KOLOM ==='],
    ['Kode Menu', 'Barcode', 'Nama Menu*', 'Kategori*', 'Tipe Item (RECIPE/DIRECT/SERVICE/BUNDLE)*', 'Harga Jual (Rp)*', 'HPP / Modal (Rp)', 'Deskripsi', 'Status (TERSEDIA/KOSONG)'],
    ['MNU-001', '8991001001', 'Kopi Aren Spesial', 'Minuman', 'RECIPE', 20000, 8000, 'Espresso kopi arabika dengan gula aren murni', 'TERSEDIA'],
    ['MNU-002', '8991001002', 'Air Mineral 600ml', 'Minuman Kemasan', 'DIRECT', 5000, 2500, 'Air mineral botol 600ml', 'TERSEDIA'],
    ['MNU-003', '', 'Sewa Ruangan VVIP / Jam', 'Jasa / Layanan', 'SERVICE', 150000, 0, 'Sewa tempat meeting per jam', 'TERSEDIA'],
    ['MNU-004', '', 'Paket Hemat Nongkrong', 'Paket Combo', 'BUNDLE', 45000, 20000, 'Combo Kopi Aren + Dimsum 4 pcs', 'TERSEDIA'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Master Menu');

  XLSX.writeFile(wb, `Template_Import_Master_Menu_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Download Template Excel Master Piutang (Kasbon Customer)
 */
export async function downloadReceivableTemplate() {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();

  const rows = [
    ['TEMPLATE IMPORT KASBON CUSTOMER (PIUTANG) — MOVA POS'],
    ['Petunjuk: Baris bertanda (*) wajib diisi. Format tanggal: YYYY-MM-DD (Contoh: 2026-09-30).'],
    [],
    ['=== DAFTAR KOLOM ==='],
    ['Nama Pelanggan / Debitur*', 'Nomor HP', 'Alamat Pelanggan', 'Total Tagihan Kasbon (Rp)*', 'Nominal DP / Uang Muka (Rp)', 'Tanggal Terbit (YYYY-MM-DD)*', 'Tanggal Jatuh Tempo (YYYY-MM-DD)*', 'Catatan / Keterangan Kasbon'],
    ['Bpk H. Paksi', '081299887766', 'Jl. Sudirman No. 45 Makassar', 250000, 50000, '2026-09-24', '2026-10-01', 'Kasbon catering rapat 10 porsi'],
    ['Ibu Ratna', '085211223344', 'Komp. Galesong Indah B3/12', 150000, 0, '2026-09-24', '2026-10-08', 'Full kasbon pesanan makanan kantor'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Master Piutang Kasbon');

  XLSX.writeFile(wb, `Template_Import_Master_Piutang_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Download Template Excel Master Gudang & Outlet
 */
export async function downloadOutletTemplate() {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();

  const rows = [
    ['TEMPLATE IMPORT MASTER GUDANG & OUTLET CABANG — MOVA POS'],
    ['Petunjuk: Baris bertanda (*) wajib diisi. Tipe outlet valid: CABANG, PUSAT, GUDANG.'],
    [],
    ['=== DAFTAR KOLOM ==='],
    ['Kode Outlet / Gudang', 'Nama Outlet / Cabang*', 'Tipe (CABANG/PUSAT/GUDANG)*', 'Nama PIC / Manager', 'Nomor Telepon', 'Alamat Lengkap', 'Cabang Utama (YA/TIDAK)'],
    ['OUT-001', 'Maroa - Cabang Utama (Pusat)', 'PUSAT', 'Bpk Furqon', '081234567890', 'Jl. AP Pettarani No. 88 Makassar', 'YA'],
    ['OUT-002', 'Maroa - Branch Panakkukang', 'CABANG', 'Ibu Maya', '081298765432', 'Mall Panakkukang Lt 2', 'TIDAK'],
    ['GDG-001', 'Gudang Logistik Pusat', 'GUDANG', 'Bpk Herman', '085244332211', 'Kawasan Industri Makassar Blok B-12', 'TIDAK'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = fitColumns(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Master Outlet Gudang');

  XLSX.writeFile(wb, `Template_Import_Master_Outlet_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
