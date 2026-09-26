import { useState } from 'react';
import {
  FileSpreadsheet, Upload, X, CheckCircle2, AlertCircle,
  Download, RefreshCw, AlertOctagon, Check, ArrowRight, Table
} from 'lucide-react';
import api from '../api/client';
import { rupiah, num, LoadingState } from './ui';
import {
  downloadIngredientTemplate,
  downloadPerlengkapanTemplate,
  downloadMenuTemplate,
  downloadReceivableTemplate,
  downloadOutletTemplate,
  downloadSaldoAwalTemplate
} from '../utils/exportTemplates';
import toast from 'react-hot-toast';

async function getXLSX() {
  return await import('xlsx');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

const UNIT_ALIAS_MAP = {
  kg: 'kg', kgg: 'kg', kilo: 'kg', kilogram: 'kg', kilograms: 'kg', kgs: 'kg',
  gram: 'gram', gr: 'gram', g: 'gram', gramm: 'gram', grm: 'gram', grams: 'gram',
  liter: 'liter', ltr: 'liter', lt: 'liter', liters: 'liter', l: 'liter',
  ml: 'ml', mll: 'ml', mililiter: 'ml', milliliter: 'ml', cc: 'ml',
  pcs: 'pcs', pc: 'pcs', pcss: 'pcs', piece: 'pcs', pieces: 'pcs', buah: 'pcs', biji: 'pcs', butir: 'pcs', btr: 'pcs',
  lembar: 'lembar', lbr: 'lembar', sheet: 'lembar', sheets: 'lembar',
  slop: 'slop', slp: 'slop', slopp: 'slop',
  pack: 'pack', pck: 'pack', pak: 'pack', paket: 'pack', pax: 'pack',
  roll: 'roll', rol: 'roll', gulung: 'roll',
  botol: 'botol', btl: 'botol', bottle: 'botol',
  cup: 'cup', gelas: 'cup', cangkir: 'cup',
  dus: 'dus', karton: 'dus', kardus: 'dus', ctn: 'dus', box: 'dus',
  can: 'can', kaleng: 'can', klg: 'can',
  sachet: 'sachet', sct: 'sachet', bungkus: 'sachet', bks: 'sachet',
  porsi: 'porsi', portion: 'porsi', prs: 'porsi',
  sdm: 'sdm', sdt: 'sdt',
};

const STANDARD_UNITS = ['kg', 'gram', 'liter', 'ml', 'pcs', 'lembar', 'slop', 'pack', 'roll', 'botol', 'cup', 'dus', 'can', 'sachet', 'porsi', 'sdm', 'sdt'];

export function normalizeUnitClient(raw, fallback = 'pcs') {
  const original = String(raw || '').trim();
  if (!original) return { symbol: fallback, original: '', isFixed: false, isNew: false };
  const clean = original.toLowerCase().replace(/[^a-z0-9_\-\s]/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return { symbol: fallback, original, isFixed: false, isNew: false };

  if (UNIT_ALIAS_MAP[clean]) {
    const symbol = UNIT_ALIAS_MAP[clean];
    return { symbol, original, isFixed: clean !== symbol, isNew: false };
  }

  // Fuzzy check Levenshtein distance <= 1 for close typos
  for (const sym of STANDARD_UNITS) {
    if (levenshtein(clean, sym) <= 1) {
      return { symbol: sym, original, isFixed: true, isNew: false };
    }
  }

  // New custom unit
  return { symbol: clean, original, isFixed: false, isNew: true };
}

/**
 * Reusable Excel Import Modal Component for MOVA POS Master Data
 */
export default function ImportMasterModal({
  isOpen,
  onClose,
  targetMaster = 'INGREDIENT', // 'INGREDIENT' | 'PERLENGKAPAN' | 'MENU' | 'RECEIVABLE' | 'OUTLET'
  onSuccess,
}) {
  const [selectedMaster, setSelectedMaster] = useState(targetMaster);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [loadingFile, setLoadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [previewFilter, setPreviewFilter] = useState('ALL');

  if (!isOpen) return null;

  const currentMasterType = selectedMaster || targetMaster;

  const MASTER_CONFIG = {
    INGREDIENT: {
      title: 'Master Bahan (Ingredients)',
      downloadFn: downloadIngredientTemplate,
      endpoint: '/ingredients/bulk-import',
      columns: ['Nama Bahan*', 'Tipe*', 'Satuan Beli*', 'Satuan Pakai*', 'Konversi*', 'Harga Beli*'],
      sampleHint: 'Contoh: Tepung Terigu, Satuan Beli: kg, Satuan Pakai: gram, Konversi: 1000, Harga: 14000',
    },
    PERLENGKAPAN: {
      title: 'Master Perlengkapan & Packaging',
      downloadFn: downloadPerlengkapanTemplate,
      endpoint: '/perlengkapans/bulk-import',
      columns: ['Nama Perlengkapan*', 'Kategori', 'Satuan Beli*', 'Satuan Pakai*', 'Konversi*', 'Harga Beli*'],
      sampleHint: 'Contoh: Cup Dingin 16oz Sablon, Satuan Beli: Slop, Satuan Pakai: pcs, Konversi: 50, Harga: 25000',
    },
    MENU: {
      title: 'Master Menu & F&B',
      downloadFn: downloadMenuTemplate,
      endpoint: '/menus/bulk-import',
      columns: ['Nama Menu*', 'Kategori*', 'Tipe Item*', 'Harga Jual*', 'HPP (Modal)'],
      sampleHint: 'Contoh: Kopi Aren, Kategori: Minuman, Tipe: RECIPE, Harga Jual: 20000, HPP: 8000',
    },
    RECEIVABLE: {
      title: 'Master Piutang (Kasbon Customer)',
      downloadFn: downloadReceivableTemplate,
      endpoint: '/receivables/bulk-import',
      columns: ['Nama Pelanggan*', 'Total Tagihan*', 'Uang Muka (DP)', 'Tgl Terbit*', 'Tgl Jatuh Tempo*'],
      sampleHint: 'Contoh: Bpk H. Paksi, Total Tagihan: 250000, DP: 50000, Terbit: 2026-09-24',
    },
    SALDO_AWAL: {
      title: 'Saldo Awal Stok (Transisi Aplikasi & Kartu Stok)',
      downloadFn: downloadSaldoAwalTemplate,
      endpoint: '/stock-card/bulk-import-initial',
      columns: ['Kode Item', 'Nama Bahan/Item*', 'Outlet/Cabang*', 'Saldo Awal Fisik*', 'Satuan*', 'Tipe Satuan*', 'Harga Modal*'],
      sampleHint: 'Contoh: Biji Kopi Arabika, Outlet: Cabang Utama, Saldo Awal: 25 kg (BELI), Harga: 180000, Tgl: 2026-09-01',
    },
    OUTLET: {
      title: 'Master Gudang & Outlet Cabang',
      downloadFn: downloadOutletTemplate,
      endpoint: '/outlets/bulk-import',
      columns: ['Nama Outlet*', 'Tipe (CABANG/PUSAT/GUDANG)*', 'PIC Manager', 'Nomor Telepon'],
      sampleHint: 'Contoh: Maroa Branch Panakkukang, Tipe: CABANG, PIC: Ibu Maya, Phone: 081298765432',
    },
  };

  const activeConfig = MASTER_CONFIG[currentMasterType] || MASTER_CONFIG.INGREDIENT;

  // Handle template download
  async function handleDownloadTemplate() {
    try {
      await activeConfig.downloadFn();
      toast.success(`Template Excel ${activeConfig.title} berhasil terunduh!`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunduh template Excel.');
    }
  }

  // Helper to normalize object keys (trim spaces & lowercase)
  function getVal(row, possibleKeys) {
    if (!row) return '';
    const keys = Object.keys(row);

    // 1. Try exact match first (ignoring banner/title/empty keys)
    for (const p of possibleKeys) {
      const cleanP = p.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchKey = keys.find(k => {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanK.startsWith('template') || cleanK.startsWith('empty') || cleanK.startsWith('petunjuk') || cleanK.includes('movapos')) return false;
        return cleanK === cleanP;
      });
      if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null && String(row[matchKey]).trim() !== '') {
        return String(row[matchKey]).trim();
      }
    }

    // 2. Try startsWith or includes match (strictly avoiding banner/title/empty keys)
    for (const p of possibleKeys) {
      const cleanP = p.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchKey = keys.find(k => {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanK.startsWith('template') || cleanK.startsWith('empty') || cleanK.startsWith('petunjuk') || cleanK.includes('movapos')) return false;
        return cleanK.startsWith(cleanP) || cleanK.includes(cleanP);
      });
      if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null && String(row[matchKey]).trim() !== '') {
        return String(row[matchKey]).trim();
      }
    }

    return '';
  }

  // Parse Excel File on client side
  async function handleFileUpload(e) {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setLoadingFile(true);
    setFile(uploadedFile);
    setFileName(uploadedFile.name);
    setParsedRows([]);
    setImportResult(null);

    try {
      const XLSX = await getXLSX();
      const buffer = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      // Convert sheet to 2D array to dynamically find the exact table header row
      const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      
      const HEADER_KEYWORDS = [
        'nama bahan', 'nama perlengkapan', 'nama menu', 'nama pelanggan', 'nama debitur', 'nama outlet',
        'kode bahan', 'kode perlengkapan', 'kode menu', 'kode outlet',
        'satuan beli', 'satuan pakai', 'tipe bahan', 'tipe item', 'total tagihan',
        'saldo awal', 'saldo awal fisik', 'nama bahan / item', 'kode bahan / item'
      ];

      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(sheetRows.length, 25); i++) {
        const rowVals = (sheetRows[i] || []).map(c => String(c).toLowerCase().trim());
        const hasHeader = rowVals.some(v => HEADER_KEYWORDS.some(kw => v.includes(kw)));
        if (hasHeader) {
          headerRowIndex = i;
          break;
        }
      }

      const rawJson = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex, defval: '' });

      // Filter out header title rows, banner rows, instruction rows, or empty rows
      const dataRows = rawJson.filter(row => {
        const values = Object.values(row).map(v => String(v).trim());
        const strValues = values.join(' ').toLowerCase();

        if (
          strValues.includes('===') ||
          strValues.includes('template import') ||
          strValues.includes('petunjuk:') ||
          strValues.includes('daftar bahan') ||
          strValues.includes('data bahan')
        ) {
          return false;
        }

        // Check if row literally repeats header names
        const firstVal = (values[0] || '').toLowerCase();
        const secondVal = (values[1] || '').toLowerCase();
        if (
          ['kode bahan', 'nama bahan', 'nama bahan*', 'kode perlengkapan', 'nama perlengkapan', 'kode menu', 'nama menu'].includes(firstVal) ||
          ['nama bahan', 'nama bahan*', 'nama perlengkapan', 'nama menu'].includes(secondVal)
        ) {
          return false;
        }

        return values.some(v => v !== '');
      });

      // Parse & Validate depending on master type
      const parsed = dataRows.map((row, idx) => {
        const errors = [];
        let mappedData = {};
        const keys = Object.keys(row);

        if (currentMasterType === 'INGREDIENT') {
          let code = getVal(row, ['kodebahan', 'kode', 'code', 'sku', 'itemcode']);
          let name = getVal(row, ['namabahan', 'nama', 'namabarang', 'itemname']);

          // Fallback if user's file has column 0 as Code and column 1 as Name
          if (!code && keys[0] && keys[0].toLowerCase().includes('kode')) {
            code = String(row[keys[0]] || '').trim();
          }
          if (!name && keys[1] && keys[1].toLowerCase().includes('nama')) {
            name = String(row[keys[1]] || '').trim();
          }

          const category = getVal(row, ['kategori', 'category']) || 'BAHAN_BAKU';
          const typeRaw = getVal(row, ['tipebahan', 'tipe', 'type']);
          const type = (typeRaw && typeRaw.toUpperCase().includes('SEMI')) ? 'SEMI_FINISHED' : 'RAW';
          const rawUnitBeli = getVal(row, ['satuanbeli', 'unitbeli']);
          const rawUnitPakai = getVal(row, ['satuanpakai', 'unitpakai']);
          const uBeli = normalizeUnitClient(rawUnitBeli, 'kg');
          const uPakai = normalizeUnitClient(rawUnitPakai, 'gram');

          let konversi = parseFloat(getVal(row, ['konversi', 'faktorkonversi'])) || 0;
          if (konversi <= 0 || (konversi === 1 && uBeli.symbol !== uPakai.symbol)) {
            if (uBeli.symbol === 'kg' && uPakai.symbol === 'gram') konversi = 1000;
            else if (uBeli.symbol === 'liter' && uPakai.symbol === 'ml') konversi = 1000;
            else if (uBeli.symbol === 'slop' && uPakai.symbol === 'pcs') konversi = 50;
            else if (uBeli.symbol === 'pack' && (uPakai.symbol === 'pcs' || uPakai.symbol === 'lembar')) konversi = uPakai.symbol === 'lembar' ? 200 : 100;
            else if (konversi <= 0) konversi = 1;
          }

          const harga = parseFloat(getVal(row, ['hargabeli', 'harga', 'hargasatuan'])) || 0;
          const minStock = parseFloat(getVal(row, ['stokminimal', 'minstok'])) || 0;
          const initialStock = parseFloat(getVal(row, ['stokawal', 'stok'])) || 0;
          const notes = getVal(row, ['catatan', 'keterangan']);

          if (!name) errors.push('Nama bahan wajib diisi.');
          if (harga < 0) errors.push('Harga beli tidak boleh negatif.');

          mappedData = {
            code,
            name,
            category,
            type,
            unit_beli: uBeli.symbol,
            unit_pakai: uPakai.symbol,
            konversi,
            harga,
            minstok: minStock,
            initial_stock: initialStock,
            notes,
            _uBeli: uBeli,
            _uPakai: uPakai,
          };

        } else if (currentMasterType === 'PERLENGKAPAN') {
          let code = getVal(row, ['kodeperlengkapan', 'kode', 'code', 'sku', 'itemcode']);
          let name = getVal(row, ['namaperlengkapan', 'namabarang', 'nama', 'itemname']);

          if (!code && keys[0] && keys[0].toLowerCase().includes('kode')) {
            code = String(row[keys[0]] || '').trim();
          }
          if (!name && keys[1] && keys[1].toLowerCase().includes('nama')) {
            name = String(row[keys[1]] || '').trim();
          }

          const category = getVal(row, ['kategori', 'category']) || 'Perlengkapan';
          const rawUnitBeli = getVal(row, ['satuanbeli', 'unitbeli']);
          const rawUnitPakai = getVal(row, ['satuanpakai', 'unitpakai']);
          const uBeli = normalizeUnitClient(rawUnitBeli, 'Slop');
          const uPakai = normalizeUnitClient(rawUnitPakai, 'pcs');

          let konversi = parseFloat(getVal(row, ['konversi', 'faktorkonversi'])) || 0;
          if (konversi <= 0 || (konversi === 1 && uBeli.symbol !== uPakai.symbol)) {
            if (uBeli.symbol === 'slop' && uPakai.symbol === 'pcs') konversi = 50;
            else if (uBeli.symbol === 'pack' && (uPakai.symbol === 'pcs' || uPakai.symbol === 'lembar')) konversi = uPakai.symbol === 'lembar' ? 200 : 100;
            else if (uBeli.symbol === 'kg' && uPakai.symbol === 'gram') konversi = 1000;
            else if (konversi <= 0) konversi = 1;
          }

          const harga = parseFloat(getVal(row, ['hargabeli', 'harga', 'hargasatuan'])) || 0;
          const minStock = parseFloat(getVal(row, ['stokminimal', 'minstok'])) || 0;
          const initialStock = parseFloat(getVal(row, ['stokawal', 'stok'])) || 0;
          const tolerance = parseFloat(getVal(row, ['batastoleransi', 'toleransi', 'tolerance'])) || 5;
          const notes = getVal(row, ['catatan', 'spesifikasi', 'keterangan']);

          if (!name) errors.push('Nama perlengkapan wajib diisi.');
          if (harga < 0) errors.push('Harga beli tidak boleh negatif.');
          if (konversi <= 0) errors.push('Faktor konversi harus lebih dari 0.');

          mappedData = {
            code,
            name,
            category,
            type: 'RAW',
            unit_beli: uBeli.symbol,
            unit_pakai: uPakai.symbol,
            konversi,
            harga,
            minstok: minStock,
            initial_stock: initialStock,
            tolerance,
            notes: notes || 'Imported Perlengkapan from Excel',
            _uBeli: uBeli,
            _uPakai: uPakai,
          };

        } else if (currentMasterType === 'MENU') {
          let code = getVal(row, ['kodemenu', 'kode', 'code', 'sku']);
          let name = getVal(row, ['namamenu', 'nama', 'itemname']);
          const barcode = getVal(row, ['barcode']);

          if (!code && keys[0] && keys[0].toLowerCase().includes('kode')) {
            code = String(row[keys[0]] || '').trim();
          }
          if (!name && (keys[1]?.toLowerCase().includes('nama') || keys[2]?.toLowerCase().includes('nama'))) {
            name = String(row[keys.find(k => k.toLowerCase().includes('nama'))] || '').trim();
          }
          const category = getVal(row, ['kategori', 'category']) || 'Umum';
          const typeRaw = getVal(row, ['tipeitem', 'tipe', 'type']).toUpperCase();
          const itemType = ['RECIPE', 'DIRECT', 'SERVICE', 'BUNDLE'].includes(typeRaw) ? typeRaw : 'RECIPE';
          const price = parseFloat(getVal(row, ['hargajual', 'harga', 'price'])) || 0;
          const costPrice = parseFloat(getVal(row, ['hpp', 'modal', 'cost'])) || 0;
          const description = getVal(row, ['deskripsi', 'keterangan']);
          const statusRaw = getVal(row, ['status']);
          const isKosong = statusRaw && statusRaw.toUpperCase().includes('KOSONG');

          if (!name) errors.push('Nama menu wajib diisi.');
          if (price <= 0) errors.push('Harga jual harus lebih dari 0.');

          mappedData = { code, barcode, name, category, item_type: itemType, price, cost_price: costPrice, description, is_available: !isKosong };

        } else if (currentMasterType === 'RECEIVABLE') {
          const customerName = getVal(row, ['namapelanggan', 'namadebitur', 'nama', 'customer']);
          const phone = getVal(row, ['nomorhp', 'phone', 'telepon', 'hp']);
          const address = getVal(row, ['alamat', 'address']);
          const totalAmount = parseFloat(getVal(row, ['totaltagihan', 'total', 'nominal'])) || 0;
          const initialPaid = parseFloat(getVal(row, ['nominaldp', 'uangmuka', 'dp'])) || 0;
          const issueDate = getVal(row, ['tanggalterbit', 'terbit', 'issuedate']) || new Date().toISOString().slice(0, 10);
          const dueDate = getVal(row, ['tanggaljatuh', 'jatuhtempo', 'duedate']) || new Date().toISOString().slice(0, 10);
          const notes = getVal(row, ['catatan', 'keterangan']);

          if (!customerName) errors.push('Nama pelanggan wajib diisi.');
          if (totalAmount <= 0) errors.push('Total tagihan kasbon harus lebih dari 0.');

          mappedData = { customer_name: customerName, customer_phone: phone, customer_address: address, total_amount: totalAmount, initial_paid: initialPaid, issue_date: issueDate, due_date: dueDate, notes };

        } else if (currentMasterType === 'OUTLET') {
          const name = getVal(row, ['namaoutlet', 'namacabang', 'nama', 'outlet']);
          const code = getVal(row, ['kodeoutlet', 'kode', 'code']);
          const typeRaw = getVal(row, ['tipe', 'type']).toUpperCase();
          const type = ['CABANG', 'PUSAT', 'GUDANG'].includes(typeRaw) ? typeRaw : 'CABANG';
          const picName = getVal(row, ['namapic', 'pic', 'manager']);
          const phone = getVal(row, ['telepon', 'phone', 'hp']);
          const address = getVal(row, ['alamat', 'address']);
          const mainFlag = getVal(row, ['cabangutama', 'is_main', 'main']);
          const isMain = mainFlag && mainFlag.toUpperCase().includes('YA');

          if (!name) errors.push('Nama outlet wajib diisi.');

          mappedData = { code, name, type, pic_name: picName, phone, address, is_main: isMain };
        } else if (currentMasterType === 'SALDO_AWAL') {
          let code = getVal(row, ['kodebahanitem', 'kodebahan', 'kodeitem', 'kode', 'code', 'sku']);
          let name = getVal(row, ['namabahanitem', 'namabahan', 'namaitem', 'namabarang', 'nama', 'itemname']);

          if (!code && keys[0] && keys[0].toLowerCase().includes('kode')) {
            code = String(row[keys[0]] || '').trim();
          }
          if (!name && keys[1] && keys[1].toLowerCase().includes('nama')) {
            name = String(row[keys[1]] || '').trim();
          }

          const outletName = getVal(row, ['namaoutletcabang', 'namaoutlet', 'outlet', 'cabang', 'namacabang', 'gudang']) || '';
          const initialStock = parseFloat(getVal(row, ['saldoawalfisik', 'saldoawal', 'stokawal', 'stok', 'qty'])) || 0;
          const rawUnit = getVal(row, ['satuan', 'unit']);
          const uNorm = normalizeUnitClient(rawUnit, 'pcs');
          const unitTypeRaw = getVal(row, ['tipesatuan', 'tipesatuanbeli', 'tipe', 'unittype']);
          const unitType = (unitTypeRaw && unitTypeRaw.toUpperCase().includes('BELI')) ? 'BELI' : 'PAKAI';
          const harga = parseFloat(getVal(row, ['hargamodalbeli', 'hargamodal', 'hargabeli', 'harga', 'price'])) || 0;
          const minStock = parseFloat(getVal(row, ['stokminimalparlevel', 'stokminimal', 'minstok'])) || 0;
          const date = getVal(row, ['tanggalcutoff', 'tanggal', 'date']) || '2026-09-01';
          const notes = getVal(row, ['catatanketerangan', 'catatan', 'keterangan']);

          if (!name) errors.push('Nama bahan/item wajib diisi.');
          if (initialStock < 0) errors.push('Saldo awal tidak boleh bernilai negatif.');
          if (harga < 0) errors.push('Harga modal tidak boleh bernilai negatif.');

          mappedData = {
            code,
            name,
            outlet_name: outletName,
            initial_stock: initialStock,
            unit: uNorm.symbol,
            unit_type: unitType,
            harga,
            stok_min: minStock,
            date,
            notes,
            _uBeli: uNorm,
          };
        }

        return {
          rowNumber: idx + headerRowIndex + 2,
          original: row,
          data: mappedData,
          isValid: errors.length === 0,
          errors,
        };
      }).filter(item => {
        const d = item.data;
        const name = (d.name || d.customer_name || '').trim();
        const lower = name.toLowerCase();
        if (
          !name ||
          name.startsWith('===') ||
          lower.includes('template import') ||
          lower.includes('petunjuk') ||
          lower.includes('data bahan') ||
          lower.includes('daftar perlengkapan') ||
          lower.includes('daftar menu') ||
          lower.includes('tagihan piutang') ||
          lower.includes('daftar outlet') ||
          lower.includes('saldo awal stok') ||
          ['kode bahan', 'nama bahan', 'nama bahan*', 'kode perlengkapan', 'nama perlengkapan', 'kode menu', 'nama menu', 'nama pelanggan', 'kode bahan / item', 'nama bahan / item', 'nama bahan / item*'].includes(lower)
        ) {
          return false;
        }
        return true;
      });

      setParsedRows(parsed);
      toast.success(`Berhasil membaca ${parsed.length} baris data dari file Excel!`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal membaca file Excel. Pastikan format file sesuai (.xlsx / .csv)');
    } finally {
      setLoadingFile(false);
    }
  }

  // Submit parsed valid rows to backend
  async function handleSubmitImport() {
    const validItems = parsedRows.filter(r => r.isValid).map(r => r.data);
    if (validItems.length === 0) {
      toast.error('Tidak ada baris data valid yang siap di-import.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(activeConfig.endpoint, { items: validItems });
      const importedCount = res.data?.imported_count || res.data?.count || validItems.length;

      setImportResult({
        success: true,
        message: res.data?.message || `Berhasil meng-import ${importedCount} data ${activeConfig.title}!`,
        count: importedCount,
      });

      toast.success(`Import berhasil! ${importedCount} data tersimpan.`);
      onSuccess?.();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Gagal meng-import data ke database.');
    } finally {
      setSubmitting(false);
    }
  }

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;
  const attentionCount = parsedRows.filter(r => !r.isValid || r.data._uBeli?.isFixed || r.data._uPakai?.isFixed || r.data._uBeli?.isNew || r.data._uPakai?.isNew).length;
  const cleanValidCount = Math.max(0, validCount - attentionCount);

  const displayedRows = parsedRows.filter(r => {
    if (previewFilter === 'ATTENTION') {
      return !r.isValid || r.data._uBeli?.isFixed || r.data._uPakai?.isFixed || r.data._uBeli?.isNew || r.data._uPakai?.isNew;
    }
    if (previewFilter === 'VALID') {
      return r.isValid && !r.data._uBeli?.isFixed && !r.data._uPakai?.isFixed && !r.data._uBeli?.isNew && !r.data._uPakai?.isNew;
    }
    return true;
  });

  return (
    <div className="modal-backdrop fade-in" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(4, 7, 18, 0.85)', backdropFilter: 'blur(12px)',
      zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div className="card modal-content" style={{
        maxWidth: '780px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
        padding: '24px', borderRadius: '18px', background: '#11162d', border: '1px solid var(--border-strong)'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <FileSpreadsheet size={22} color="var(--primary)" />
              Import Data Master Excel & Template Hub
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Unggah file Excel (.xlsx / .csv) untuk meng-import data secara instan
            </span>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Master Type Selector Pills */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
          {[
            { key: 'INGREDIENT', label: 'Master Bahan' },
            { key: 'PERLENGKAPAN', label: 'Master Perlengkapan' },
            { key: 'SALDO_AWAL', label: 'Saldo Awal (Kartu Stok)' },
            { key: 'MENU', label: 'Master Menu' },
            { key: 'RECEIVABLE', label: 'Kasbon / Piutang' },
            { key: 'OUTLET', label: 'Outlet & Gudang' },
          ].map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setSelectedMaster(m.key);
                setFile(null);
                setParsedRows([]);
                setImportResult(null);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: selectedMaster === m.key ? 'var(--primary)' : 'var(--border)',
                background: selectedMaster === m.key ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: selectedMaster === m.key ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Template Download Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(79, 70, 229, 0.22) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={16} color="var(--accent-bright)" /> Download Template Format Excel ({activeConfig.title})
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {activeConfig.sampleHint}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleDownloadTemplate}
            style={{ fontWeight: 800, color: '#ffffff', borderColor: 'rgba(255,255,255,0.3)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} /> Download Template .xlsx
          </button>
        </div>

        {/* File Upload Dropzone */}
        <div style={{
          border: '2px dashed var(--border-strong)',
          borderRadius: '14px',
          padding: '24px 16px',
          textAlign: 'center',
          background: 'rgba(0, 0, 0, 0.2)',
          marginBottom: '20px',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}>
          <Upload size={32} style={{ color: 'var(--primary)', margin: '0 auto 8px' }} />
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
            {fileName ? `File Terpilih: ${fileName}` : 'Pilih atau Drag & Drop File Excel (.xlsx / .csv)'}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Format didukung: .xlsx, .xls, .csv (Maksimal 5.000 baris per sekali import)
          </div>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}
          />
        </div>

        {/* Loading File Indicator */}
        {loadingFile && <LoadingState message="Membaca & Memvalidasi File Excel..." />}

        {/* Import Result Success Banner */}
        {importResult && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <CheckCircle2 size={22} color="var(--ok)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#ffffff' }}>
                {importResult.message}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ok)', marginTop: '2px' }}>
                Data master telah terbarui dan siap digunakan di sistem MOVA POS.
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              style={{ fontWeight: 700 }}
            >
              Selesai
            </button>
          </div>
        )}

        {/* Live Parsed Preview Table */}
        {!importResult && parsedRows.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Table size={16} color="var(--primary)" />
                Pratinjau Data Parsed ({parsedRows.length} Baris)
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '11.5px' }}>
                <span className="pill pill-ok" style={{ fontWeight: 700 }}>
                  ✓ {validCount} Valid
                </span>
                {invalidCount > 0 && (
                  <span className="pill pill-danger" style={{ fontWeight: 700 }}>
                    ⚠ {invalidCount} Error
                  </span>
                )}
              </div>
            </div>

            {/* Interactive Preview Filter Tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm ${previewFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPreviewFilter('ALL')}
                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px' }}
              >
                Semua Baris ({parsedRows.length})
              </button>
              {attentionCount > 0 && (
                <button
                  type="button"
                  className={`btn btn-sm ${previewFilter === 'ATTENTION' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPreviewFilter('ATTENTION')}
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    color: previewFilter === 'ATTENTION' ? '#fff' : '#f59e0b',
                    borderColor: 'rgba(245, 158, 11, 0.5)',
                    background: previewFilter === 'ATTENTION' ? undefined : 'rgba(245, 158, 11, 0.08)'
                  }}
                >
                  ⚡ Perlu Perhatian / Auto-Fix ({attentionCount})
                </button>
              )}
              <button
                type="button"
                className={`btn btn-sm ${previewFilter === 'VALID' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPreviewFilter('VALID')}
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  color: previewFilter === 'VALID' ? '#fff' : '#4ade80'
                }}
              >
                ✓ Standar Bersih ({cleanValidCount})
              </button>
            </div>

            <div style={{ maxHeight: '220px', overflowY: 'auto', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 12px', width: '45px' }}>#</th>
                    <th style={{ padding: '8px 12px', width: '105px' }}>Kode</th>
                    <th style={{ padding: '8px 12px' }}>Nama Item</th>
                    <th style={{ padding: '8px 12px' }}>Detail Data</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status Validasi</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: row.isValid ? undefined : 'rgba(239, 68, 68, 0.08)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{row.rowNumber}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {row.data.code ? (
                          <span className="mono" style={{ color: 'var(--accent-bright)', fontWeight: 700, fontSize: '11.5px' }}>
                            {row.data.code}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>
                            (Auto)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#ffffff' }}>
                        {row.data.name || row.data.customer_name || '—'}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                        {currentMasterType === 'INGREDIENT' && (
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>{row.data.type} · Satuan: <strong>{row.data.unit_beli} / {row.data.unit_pakai}</strong> (1 {row.data.unit_beli} = {row.data.konversi} {row.data.unit_pakai}) · {rupiah(row.data.harga)}</span>
                            {(row.data._uBeli?.isFixed || row.data._uPakai?.isFixed) && (
                              <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }} title="Typo/singkatan otomatis diperbaiki ke format standar">
                                ✓ Auto-Fix ({row.data._uBeli?.isFixed ? row.data._uBeli.original : ''}{row.data._uPakai?.isFixed ? ` / ${row.data._uPakai.original}` : ''})
                              </span>
                            )}
                            {(row.data._uBeli?.isNew || row.data._uPakai?.isNew) && (
                              <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }} title="Satuan baru otomatis didaftarkan ke Master Satuan">
                                ✨ Satuan Baru
                              </span>
                            )}
                          </div>
                        )}
                        {currentMasterType === 'PERLENGKAPAN' && (
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>{row.data.category} · Satuan: <strong>{row.data.unit_beli} / {row.data.unit_pakai}</strong> (1 {row.data.unit_beli} = {row.data.konversi} {row.data.unit_pakai}) · {rupiah(row.data.harga)}</span>
                            {(row.data._uBeli?.isFixed || row.data._uPakai?.isFixed) && (
                              <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }} title="Typo/singkatan otomatis diperbaiki ke format standar">
                                ✓ Auto-Fix ({row.data._uBeli?.isFixed ? row.data._uBeli.original : ''}{row.data._uPakai?.isFixed ? ` / ${row.data._uPakai.original}` : ''})
                              </span>
                            )}
                            {(row.data._uBeli?.isNew || row.data._uPakai?.isNew) && (
                              <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }} title="Satuan baru otomatis didaftarkan ke Master Satuan">
                                ✨ Satuan Baru
                              </span>
                            )}
                          </div>
                        )}
                        {currentMasterType === 'SALDO_AWAL' && (
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>
                              Cabang: <strong>{row.data.outlet_name || '(Pusat / Sesuai User)'}</strong> · Saldo Awal: <strong style={{ color: 'var(--accent-bright)' }}>{num(row.data.initial_stock)} {row.data.unit} ({row.data.unit_type})</strong> · Modal: {rupiah(row.data.harga)} · Cut-off: {row.data.date}
                            </span>
                            {row.data._uBeli?.isFixed && (
                              <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }} title="Typo/singkatan otomatis diperbaiki ke format standar">
                                ✓ Auto-Fix ({row.data._uBeli.original})
                              </span>
                            )}
                            {row.data._uBeli?.isNew && (
                              <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                ✨ Satuan Baru
                              </span>
                            )}
                          </div>
                        )}
                        {currentMasterType === 'MENU' && `${row.data.category} · ${row.data.item_type} · ${rupiah(row.data.price)}`}
                        {currentMasterType === 'RECEIVABLE' && `Total: ${rupiah(row.data.total_amount)} · DP: ${rupiah(row.data.initial_paid)}`}
                        {currentMasterType === 'OUTLET' && `${row.data.type} · PIC: ${row.data.pic_name || '—'} · ${row.data.phone || ''}`}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {row.isValid ? (
                          <span style={{ color: 'var(--ok)', fontWeight: 700, fontSize: '11px' }}>✓ Siap Import</span>
                        ) : (
                          <span style={{ color: '#f87171', fontWeight: 700, fontSize: '11px' }} title={row.errors.join(', ')}>
                            ⚠ {row.errors[0]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Batal
          </button>
          {!importResult && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmitImport}
              disabled={submitting || validCount === 0}
              style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {submitting ? 'Meng-import...' : `Simpan & Import (${validCount} Item Valid)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
