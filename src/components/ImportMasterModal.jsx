import { useState, useRef, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet, Upload, X, CheckCircle2, AlertCircle,
  Download, RefreshCw, AlertOctagon, Check, ArrowRight, ArrowLeft,
  Table, Store, Layers, Package, Boxes, Scale, Utensils,
  FlaskConical, CreditCard, ChevronRight, HelpCircle, Info, Sparkles,
  ListOrdered, LayoutGrid
} from 'lucide-react';
import api from '../api/client';
import { rupiah, num, LoadingState } from './ui';
import { useOutlet } from '../context/OutletContext';
import {
  downloadIngredientTemplate,
  downloadPerlengkapanTemplate,
  downloadStockAwalBahanTemplate,
  downloadStockAwalPerlengkapanTemplate,
  downloadStockAwalGudangTemplate,
  downloadMenuTemplate,
  downloadRecipeTemplate,
  downloadReceivableTemplate,
  downloadOutletTemplate,
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

  return { symbol: clean, original, isFixed: false, isNew: true };
}

export function parseDecimal(val, fallback = 0) {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const str = String(val).trim().replace(',', '.').replace(/[^0-9.-]/g, '');
  const n = parseFloat(str);
  return isNaN(n) ? fallback : n;
}

export function parseExcelDate(val) {
  if (val === null || val === undefined || val === '') {
    return new Date().toISOString().slice(0, 10);
  }
  // If Date object
  if (val instanceof Date && !isNaN(val.getTime())) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  // If Excel serial number (numeric, e.g. 45564 or "45564")
  const numVal = Number(val);
  if (!isNaN(numVal) && numVal > 20000 && numVal < 80000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + numVal * 86400000);
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  const s = String(val).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, '-');
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }
  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdy && Number(mdy[1]) <= 12 && Number(mdy[2]) > 12) {
    const month = mdy[1].padStart(2, '0');
    const day = mdy[2].padStart(2, '0');
    const year = mdy[3];
    return `${year}-${month}-${day}`;
  }
  // Standard parse
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().slice(0, 10);
}

export const IMPORT_STEPS = [
  {
    stepNumber: 1,
    id: 'OUTLET',
    name: 'Outlet & Gudang',
    category: 'Fondasi Lokasi',
    icon: Store,
    badge: 'Langkah 1 (Wajib Pertama)',
    description: 'Daftarkan seluruh cabang, outlet kasir, atau gudang penyimpanan fisik bisnis Anda.',
    whyNeeded: 'Fondasi utama alur sistem. Seluruh alokasi saldo stok gudang dan transaksi kasir memerlukan cabang yang terdaftar.',
    dependencyNote: 'Langkah pertama & fondasi awal (Tidak memerlukan data sebelumnya).',
    subItems: [
      { key: 'OUTLET', label: 'Master Outlet & Gudang Cabang', badge: 'Fondasi Lokasi', icon: Store }
    ]
  },
  {
    stepNumber: 2,
    id: 'ITEMS',
    name: 'Bahan & Kemasan',
    category: 'Katalog Terpusat',
    icon: Layers,
    badge: 'Langkah 2 (Katalog Item)',
    description: 'Daftarkan katalog bahan baku mentah, bahan setengah jadi (olahan), serta perlengkapan & packaging terpusat.',
    whyNeeded: 'Menjadi standar katalog item terpusat dengan satuan beli, satuan pakai, dan faktor konversi yang berlaku di semua cabang.',
    dependencyNote: 'Katalog terpusat mandiri. Menjadi prasyarat mutlak untuk Saldo Awal Gudang (Langkah 3) dan Resep BOM (Langkah 5).',
    subItems: [
      { key: 'INGREDIENT', label: 'Master Bahan Baku', badge: 'Mentah & Olahan', icon: Layers },
      { key: 'PERLENGKAPAN', label: 'Master Perlengkapan & Packaging', badge: 'Kemasan / Cup / Dus', icon: Package }
    ]
  },
  {
    stepNumber: 3,
    id: 'INITIAL_STOCK',
    name: 'Saldo Awal Gudang',
    category: 'Inisialisasi Stok',
    icon: Boxes,
    badge: 'Langkah 3 (Stok per Cabang)',
    description: 'Alokasikan kuantitas stok fisik awal persediaan dan harga modal per masing-masing cabang / gudang langsung ke Kartu Stok.',
    whyNeeded: 'Mengisi persediaan riil awal di setiap cabang agar stok sistem sinkron dengan stok fisik di gudang/outlet.',
    dependencyNote: 'Memerlukan Outlet & Gudang (Langkah 1) dan Master Bahan/Kemasan (Langkah 2) agar alokasi stok ke cabang valid.',
    subItems: [
      { key: 'STOCK_AWAL_BAHAN', label: 'Saldo Awal Bahan Baku per Cabang', badge: 'Kartu Stok Bahan', icon: Scale },
      { key: 'STOCK_AWAL_PERLENGKAPAN', label: 'Saldo Awal Perlengkapan per Cabang', badge: 'Kartu Stok Kemasan', icon: Boxes }
    ]
  },
  {
    stepNumber: 4,
    id: 'MENU',
    name: 'Master Menu POS',
    category: 'Katalog Kasir',
    icon: Utensils,
    badge: 'Langkah 4 (Produk Penjualan)',
    description: 'Daftarkan seluruh menu makanan, minuman, dan produk retail yang dijual di kasir POS beserta harga jualnya.',
    whyNeeded: 'Katalog produk kasir yang akan ditransaksikan dan dihubungkan ke resep bahan baku di Langkah 5.',
    dependencyNote: 'Katalog mandiri. Menjadi prasyarat untuk Resep & Gramasi BOM (Langkah 5).',
    subItems: [
      { key: 'MENU', label: 'Master Menu & F&B (Kasir POS)', badge: 'Produk Kasir', icon: Utensils }
    ]
  },
  {
    stepNumber: 5,
    id: 'RECIPE',
    name: 'Resep & BOM',
    category: 'HPP & Komposisi',
    icon: FlaskConical,
    badge: 'Langkah 5 (Komposisi & HPP)',
    description: 'Hubungkan setiap menu makanan/minuman dengan bahan baku & kemasannya (Bill of Materials) beserta gramasi takaran & susut.',
    whyNeeded: 'Kunci otomatisasi: Menghitung HPP modal riil secara otomatis dan memotong stok bahan baku secara otomatis setiap kasir menjual menu.',
    dependencyNote: 'Memerlukan Master Bahan (Langkah 2) dan Master Menu (Langkah 4) agar menu dan bahan pada resep otomatis terhubung.',
    subItems: [
      { key: 'RECIPE', label: 'Resep & Gramasi Menu (BOM)', badge: 'Kalkulasi HPP Otomatis', icon: FlaskConical }
    ]
  },
  {
    stepNumber: 6,
    id: 'RECEIVABLE',
    name: 'Kasbon & Piutang',
    category: 'Migrasi Keuangan',
    icon: CreditCard,
    badge: 'Langkah 6 (Buku Piutang)',
    description: 'Import saldo piutang / kasbon berjalan pelanggan lama untuk pencatatan buku piutang saat migrasi ke sistem MOVA POS.',
    whyNeeded: 'Membawa riwayat tagihan piutang pelanggan berjalan agar pelunasan di masa mendatang tetap tercatat rapi.',
    dependencyNote: 'Opsional. Dapat diimport kapan saja untuk melanjutkan riwayat kasbon pelanggan lama.',
    subItems: [
      { key: 'RECEIVABLE', label: 'Master Piutang / Kasbon Customer', badge: 'Buku Piutang', icon: CreditCard }
    ]
  }
];

export function getStepIndexForMasterKey(key) {
  const idx = IMPORT_STEPS.findIndex(s => s.subItems.some(sub => sub.key === key));
  return idx >= 0 ? idx : 0;
}

/**
 * Reusable Excel Import Modal Component for MOVA POS Master Data
 */
export default function ImportMasterModal({
  isOpen,
  onClose,
  targetMaster = 'INGREDIENT', // 'INGREDIENT' | 'PERLENGKAPAN' | 'STOCK_AWAL_BAHAN' | 'STOCK_AWAL_PERLENGKAPAN' | 'STOCK_AWAL_GUDANG' | 'MENU' | 'RECIPE' | 'RECEIVABLE' | 'OUTLET'
  onSuccess,
}) {
  const { outlets = [], currentBusiness, currentUser } = useOutlet();
  const [viewMode, setViewMode] = useState('STEPPER'); // 'STEPPER' | 'QUICK'
  const [modalOutlets, setModalOutlets] = useState([]);
  const [modalIngredients, setModalIngredients] = useState([]);
  const [modalMenus, setModalMenus] = useState([]);
  const [selectedOutletFilter, setSelectedOutletFilter] = useState('ALL');
  const [selectedMaster, setSelectedMaster] = useState(targetMaster);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [loadingFile, setLoadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [previewFilter, setPreviewFilter] = useState('ALL');
  const fileInputRef = useRef(null);

  // Sync selectedMaster when targetMaster or isOpen changes
  useEffect(() => {
    if (targetMaster) {
      setSelectedMaster(targetMaster);
      setFile(null);
      setFileName('');
      setParsedRows([]);
      setImportResult(null);
    }
  }, [targetMaster, isOpen]);

  // Current Step Calculation
  const currentStepIndex = useMemo(() => getStepIndexForMasterKey(selectedMaster), [selectedMaster]);
  const activeStep = IMPORT_STEPS[currentStepIndex] || IMPORT_STEPS[0];

  function handleSelectStep(stepIdx) {
    const target = IMPORT_STEPS[stepIdx];
    if (!target) return;
    const defaultSubKey = target.subItems[0]?.key || 'INGREDIENT';
    setSelectedMaster(defaultSubKey);
    setFile(null);
    setFileName('');
    setParsedRows([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = null;
  }

  function handleSelectSubItem(masterKey) {
    setSelectedMaster(masterKey);
    setFile(null);
    setFileName('');
    setParsedRows([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = null;
  }

  function handleNextStep() {
    if (currentStepIndex < IMPORT_STEPS.length - 1) {
      handleSelectStep(currentStepIndex + 1);
    }
  }

  function handlePrevStep() {
    if (currentStepIndex > 0) {
      handleSelectStep(currentStepIndex - 1);
    }
  }

  // Fetch or sync outlets, master ingredients, and master menus
  useEffect(() => {
    if (isOpen) {
      if (outlets && outlets.length > 0) {
        setModalOutlets(outlets);
      } else {
        api.get('/outlets')
          .then(res => setModalOutlets(Array.isArray(res.data) ? res.data : (res.data?.data || [])))
          .catch(() => { });
      }

      api.get('/ingredients')
        .then(res => setModalIngredients(Array.isArray(res.data) ? res.data : (res.data?.data || [])))
        .catch(() => { });

      api.get('/menus')
        .then(res => setModalMenus(Array.isArray(res.data) ? res.data : (res.data?.data || [])))
        .catch(() => { });
    }
  }, [outlets, isOpen]);

  const currentMasterType = selectedMaster || targetMaster;
  const businessName = currentBusiness?.name || currentUser?.business?.name || '';
  const outletNamesList = modalOutlets.map(o => o.name).join(', ');

  const MASTER_CONFIG = {
    INGREDIENT: {
      title: 'Master Bahan Baku (Terpusat)',
      downloadFn: downloadIngredientTemplate,
      endpoint: '/ingredients/bulk-import',
      columns: ['Kode Bahan', 'Nama Bahan*', 'Kategori', 'Tipe Bahan*', 'Satuan Beli*', 'Satuan Pakai*', 'Faktor Konversi*', 'Stok Minimal (Satuan Pakai)', 'Batas Toleransi (%)', 'Catatan'],
      sampleHint: 'Master bahan baku terpusat berlaku di semua cabang. Stok Minimal hanya batas peringatan menipis (bukan stok awal). Input saldo awal fisik dilakukan via template "Saldo Awal Bahan per Gudang".',
    },
    PERLENGKAPAN: {
      title: 'Master Perlengkapan & Packaging (Terpusat)',
      downloadFn: downloadPerlengkapanTemplate,
      endpoint: '/perlengkapans/bulk-import',
      columns: ['Kode Perlengkapan', 'Nama Perlengkapan*', 'Kategori', 'Satuan Beli*', 'Satuan Pakai*', 'Faktor Konversi*', 'Stok Minimal (Satuan Pakai)', 'Batas Toleransi (%)', 'Catatan'],
      sampleHint: 'Master perlengkapan & kemasan terpusat. Stok Minimal hanya batas peringatan menipis. Input saldo awal fisik dilakukan via template "Saldo Awal Perlengkapan per Gudang".',
    },
    STOCK_AWAL_BAHAN: {
      title: 'Saldo Awal Bahan Baku per Gudang / Cabang',
      downloadFn: downloadStockAwalBahanTemplate,
      endpoint: '/stock-card/bulk-import-initial',
      columns: ['Cabang / Gudang*', 'Kode Bahan', 'Nama Bahan Baku*', 'Kategori', 'Tipe Satuan*', 'Satuan*', 'Saldo Awal Fisik*', 'Harga/Modal Satuan', 'Stok Minimal', 'Tanggal Efektif'],
      sampleHint: 'Alokasikan saldo awal fisik BAHAN BAKU spesifik per cabang atau gudang (Gudang Utama, Cabang A, Cabang B). Langsung tercatat di Kartu Stok masing-masing cabang.',
    },
    STOCK_AWAL_PERLENGKAPAN: {
      title: 'Saldo Awal Perlengkapan & Packaging per Gudang / Cabang',
      downloadFn: downloadStockAwalPerlengkapanTemplate,
      endpoint: '/stock-card/bulk-import-initial',
      columns: ['Cabang / Gudang*', 'Kode Perlengkapan', 'Nama Perlengkapan*', 'Kategori', 'Tipe Satuan*', 'Satuan*', 'Saldo Awal Fisik*', 'Harga/Modal Satuan', 'Stok Minimal', 'Tanggal Efektif'],
      sampleHint: 'Alokasikan saldo awal fisik PERLENGKAPAN & PACKAGING spesifik per cabang atau gudang. Langsung tercatat di Kartu Stok masing-masing cabang.',
    },
    STOCK_AWAL_GUDANG: {
      title: 'Saldo Awal Bahan Baku per Gudang / Cabang',
      downloadFn: downloadStockAwalBahanTemplate,
      endpoint: '/stock-card/bulk-import-initial',
      columns: ['Cabang / Gudang*', 'Kode Bahan', 'Nama Bahan Baku*', 'Kategori', 'Tipe Satuan*', 'Satuan*', 'Saldo Awal Fisik*', 'Harga/Modal Satuan', 'Stok Minimal', 'Tanggal Efektif'],
      sampleHint: 'Alokasikan saldo awal fisik spesifik per cabang atau gudang. Langsung tercatat di Kartu Stok masing-masing cabang.',
    },
    MENU: {
      title: 'Master Menu & F&B',
      downloadFn: downloadMenuTemplate,
      endpoint: '/menus/bulk-import',
      columns: ['Kode Menu', 'Barcode', 'Nama Menu*', 'Kategori*', 'Tipe Item*', 'Harga Jual*', 'HPP (Modal)', 'Deskripsi'],
      sampleHint: 'Contoh: Kopi Aren, Kategori: Minuman, Tipe: RECIPE, Harga Jual: 20000, HPP: 8000',
    },
    RECIPE: {
      title: 'Resep & Gramasi Menu (BOM)',
      downloadFn: downloadRecipeTemplate,
      endpoint: '/menus/bulk-import-recipes',
      columns: ['Nama Menu*', 'Nama Bahan / Kemasan*', 'Gramasi / Qty*', 'Satuan Pakai*', 'Standar Susut (%)', 'Catatan Resep'],
      sampleHint: 'Format Bill of Materials (BOM) per-menu. 1 Menu dapat memiliki banyak baris bahan/kemasan. HPP dihitung otomatis.',
    },
    RECEIVABLE: {
      title: 'Master Piutang (Kasbon Customer)',
      downloadFn: downloadReceivableTemplate,
      endpoint: '/receivables/bulk-import',
      columns: ['Nama Pelanggan*', 'Total Tagihan*', 'Uang Muka (DP)', 'Tgl Terbit*', 'Tgl Jatuh Tempo*'],
      sampleHint: 'Contoh: Bpk H. Paksi, Total Tagihan: 250000, DP: 50000, Terbit: 2026-09-24',
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

  // Handle template download with Owner's Master Cabang, Master Menu & Master Bahan
  async function handleDownloadTemplate() {
    try {
      const effectiveOutlets = modalOutlets.length > 0 ? modalOutlets : outlets;
      if (currentMasterType === 'RECIPE') {
        await activeConfig.downloadFn(modalMenus, modalIngredients, businessName);
      } else {
        await activeConfig.downloadFn(effectiveOutlets, businessName);
      }
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
        return cleanK.startsWith(cleanP) || cleanK.includes(cleanP) || cleanP.startsWith(cleanK);
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
        'stock awal', 'stok awal', 'stock_awal', 'stok_awal', 'stock awal satuan pakai', 'stok awal satuan pakai',
        'saldo awal', 'saldo awal fisik', 'saldo awal satuan pakai', 'stock awal fisik', 'stok awal fisik',
        'nama bahan / item', 'kode bahan / item',
        'harga beli', 'harga jual', 'stok minimal', 'pic manager', 'tipe outlet',
        'faktor konversi', 'konversi',
        'nama bahan / perlengkapan / kemasan', 'nama bahan / perlengkapan', 'nama menu / produk', 'gramasi', 'gramasi / qty', 'gramasi / kuantitas (qty)', 'standar susut', 'standar susut / waste', 'catatan / petunjuk resep'
      ];

      let headerRowIndex = 0;
      let maxMatches = 0;

      // Smart header row finder: score rows by how many cells match known header keywords
      for (let i = 0; i < Math.min(sheetRows.length, 25); i++) {
        const rawCells = sheetRows[i] || [];
        const nonBlankCells = rawCells.filter(c => String(c !== null && c !== undefined ? c : '').trim() !== '');

        // Skip banner or note rows that have fewer than 2 distinct columns
        if (nonBlankCells.length < 2) continue;

        const firstCell = String(nonBlankCells[0]).toLowerCase().trim();
        // Skip obvious banner or instruction rows
        if (
          firstCell.startsWith('template') ||
          firstCell.startsWith('petunjuk') ||
          firstCell.startsWith('pemberitahuan') ||
          firstCell.startsWith('pedoman') ||
          firstCell.includes('===') ||
          firstCell.includes('mova pos')
        ) {
          continue;
        }

        // Count how many cells in this row match known header keywords
        let matchCount = 0;
        for (const cell of nonBlankCells) {
          const clean = String(cell).toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const kw of HEADER_KEYWORDS) {
            const cleanKw = kw.replace(/[^a-z0-9]/g, '');
            if (clean === cleanKw || clean.includes(cleanKw) || cleanKw.includes(clean)) {
              matchCount++;
              break;
            }
          }
        }

        if (matchCount > maxMatches) {
          maxMatches = matchCount;
          headerRowIndex = i;
        }
      }

      // Fallback: If no keywords matched, pick first row with >= 2 columns that isn't banner/instructions
      if (maxMatches === 0) {
        for (let i = 0; i < Math.min(sheetRows.length, 10); i++) {
          const nonBlankCells = (sheetRows[i] || []).filter(c => String(c || '').trim() !== '');
          if (nonBlankCells.length >= 2) {
            const firstCell = String(nonBlankCells[0]).toLowerCase().trim();
            if (!firstCell.startsWith('template') && !firstCell.startsWith('petunjuk') && !firstCell.includes('===')) {
              headerRowIndex = i;
              break;
            }
          }
        }
      }

      const rawJson = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex, defval: '' });

      // Filter out header title rows, banner rows, instruction rows, or empty rows
      const dataRows = rawJson.filter(row => {
        const values = Object.values(row).map(v => String(v !== null && v !== undefined ? v : '').trim());
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
          ['kode bahan', 'nama bahan', 'nama bahan*', 'kode perlengkapan', 'nama perlengkapan', 'kode menu', 'nama menu', 'nama pelanggan', 'kode outlet', 'nama outlet', 'kode menu (otomatis)', 'kode bahan (otomatis)'].includes(firstVal) ||
          ['nama bahan', 'nama bahan*', 'nama perlengkapan', 'nama menu', 'nama pelanggan', 'nama outlet', 'nama menu / produk (▼)*', 'nama menu / produk', 'nama bahan / perlengkapan (▼)*'].includes(secondVal)
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
          let code = getVal(row, ['kodebahan', 'kode', 'code', 'sku', 'itemcode', 'barcode']);
          let name = getVal(row, ['namabahan', 'nama', 'namabarang', 'itemname', 'bahan', 'item']);

          // Fallback if user's file has column 0 as Code and column 1 as Name
          if (!code && keys[0] && keys[0].toLowerCase().includes('kode')) {
            code = String(row[keys[0]] || '').trim();
          }
          if (!name && keys[1] && keys[1].toLowerCase().includes('nama')) {
            name = String(row[keys[1]] || '').trim();
          }
          if (!name) {
            const nameKey = keys.find(k => {
              const cl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return cl.includes('nama') || cl.includes('bahan') || cl.includes('barang');
            });
            if (nameKey) name = String(row[nameKey] || '').trim();
          }

          const category = getVal(row, ['kategori', 'category', 'kelompok']) || 'BAHAN_BAKU';
          const typeRaw = getVal(row, ['tipebahan', 'tipe', 'type', 'jenis']);
          const type = (typeRaw && typeRaw.toUpperCase().includes('SEMI')) ? 'SEMI_FINISHED' : 'RAW';
          const rawUnitBeli = getVal(row, ['satuanbeli', 'unitbeli', 'satuanmasuk']);
          const rawUnitPakai = getVal(row, ['satuanpakai', 'unitpakai', 'satuankeluar']);
          const uBeli = normalizeUnitClient(rawUnitBeli, 'kg');
          const uPakai = normalizeUnitClient(rawUnitPakai, 'gram');

          let konversi = parseDecimal(getVal(row, ['faktorkonversi', 'konversi', 'isipack', 'isi']), 0);
          if (konversi <= 0 || (konversi === 1 && uBeli.symbol !== uPakai.symbol)) {
            if (uBeli.symbol === 'kg' && uPakai.symbol === 'gram') konversi = 1000;
            else if (uBeli.symbol === 'liter' && uPakai.symbol === 'ml') konversi = 1000;
            else if (uBeli.symbol === 'slop' && uPakai.symbol === 'pcs') konversi = 50;
            else if (uBeli.symbol === 'pack' && (uPakai.symbol === 'pcs' || uPakai.symbol === 'lembar')) konversi = uPakai.symbol === 'lembar' ? 200 : 100;
            else if (konversi <= 0) konversi = 1;
          }

          // Stok minimal murni sebagai batas par-level warning (bukan stok awal)
          const minStock = parseDecimal(getVal(row, ['stokminimalsatuanpakai', 'stokminimal', 'minstok', 'minimumstok', 'minstock', 'stokmin', 'stockmin']), 0);
          const tolerance = parseDecimal(getVal(row, ['batastoleransi', 'toleransi', 'tolerance']), 5);
          const notes = getVal(row, ['catatan', 'spesifikasi', 'keterangan']);

          if (!name) errors.push('Nama bahan wajib diisi.');
          if (konversi <= 0) errors.push('Faktor konversi harus lebih dari 0.');

          mappedData = {
            code,
            name,
            category,
            type,
            unit_beli: uBeli.symbol,
            unit_pakai: uPakai.symbol,
            konversi,
            harga: 0,
            minstok: minStock,
            stok_min: minStock,
            initial_stock: 0,
            stok_awal: 0,
            stock_awal: 0,
            initial_balance: 0,
            saldo_awal_nominal: 0,
            saldo_awal: 0,
            tolerance,
            notes: notes || 'Master Bahan Terpusat',
            _uBeli: uBeli,
            _uPakai: uPakai,
          };

        } else if (currentMasterType === 'PERLENGKAPAN') {
          let code = getVal(row, ['kodeperlengkapan', 'kode', 'code', 'sku', 'itemcode']);
          let name = getVal(row, ['namaperlengkapan', 'namabarang', 'nama', 'itemname', 'perlengkapan', 'kemasan']);

          if (!code && keys[0] && keys[0].toLowerCase().includes('kode')) {
            code = String(row[keys[0]] || '').trim();
          }
          if (!name && keys[1] && keys[1].toLowerCase().includes('nama')) {
            name = String(row[keys[1]] || '').trim();
          }
          if (!name) {
            const nameKey = keys.find(k => {
              const cl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return cl.includes('nama') || cl.includes('perlengkapan') || cl.includes('barang') || cl.includes('kemasan');
            });
            if (nameKey) name = String(row[nameKey] || '').trim();
          }

          const category = getVal(row, ['kategori', 'category']) || 'Perlengkapan';
          const rawUnitBeli = getVal(row, ['satuanbeli', 'unitbeli']);
          const rawUnitPakai = getVal(row, ['satuanpakai', 'unitpakai']);
          const uBeli = normalizeUnitClient(rawUnitBeli, 'Slop');
          const uPakai = normalizeUnitClient(rawUnitPakai, 'pcs');

          let konversi = parseDecimal(getVal(row, ['faktorkonversi', 'konversi']), 0);
          if (konversi <= 0 || (konversi === 1 && uBeli.symbol !== uPakai.symbol)) {
            if (uBeli.symbol === 'slop' && uPakai.symbol === 'pcs') konversi = 50;
            else if (uBeli.symbol === 'pack' && (uPakai.symbol === 'pcs' || uPakai.symbol === 'lembar')) konversi = uPakai.symbol === 'lembar' ? 200 : 100;
            else if (uBeli.symbol === 'kg' && uPakai.symbol === 'gram') konversi = 1000;
            else if (konversi <= 0) konversi = 1;
          }

          // Stok minimal murni sebagai batas par-level warning (bukan stok awal)
          const minStock = parseDecimal(getVal(row, ['stokminimalsatuanpakai', 'stokminimal', 'minstok', 'minimumstok', 'minstock', 'stokmin', 'stockmin']), 0);
          const tolerance = parseDecimal(getVal(row, ['batastoleransi', 'toleransi', 'tolerance']), 5);
          const notes = getVal(row, ['catatan', 'spesifikasi', 'keterangan']);

          if (!name) errors.push('Nama perlengkapan wajib diisi.');
          if (konversi <= 0) errors.push('Faktor konversi harus lebih dari 0.');

          mappedData = {
            code,
            name,
            category,
            type: 'RAW',
            unit_beli: uBeli.symbol,
            unit_pakai: uPakai.symbol,
            konversi,
            harga: 0,
            minstok: minStock,
            stok_min: minStock,
            initial_stock: 0,
            stok_awal: 0,
            stock_awal: 0,
            initial_balance: 0,
            saldo_awal_nominal: 0,
            saldo_awal: 0,
            tolerance,
            notes: notes || 'Master Perlengkapan Terpusat',
            _uBeli: uBeli,
            _uPakai: uPakai,
          };

        } else if (
          currentMasterType === 'STOCK_AWAL_BAHAN' ||
          currentMasterType === 'STOCK_AWAL_PERLENGKAPAN' ||
          currentMasterType === 'STOCK_AWAL_GUDANG'
        ) {
          let outletName = getVal(row, ['namacabanggudang', 'namacabang', 'cabanggudang', 'cabang', 'namaoutlet', 'outlet', 'gudang', 'namagudang']);
          let code = getVal(row, ['kodebahanperlengkapan', 'kodebahan', 'kodeitem', 'kodeperlengkapan', 'kode', 'code', 'sku']);
          let name = getVal(row, ['namabahanitempersediaan', 'namabahan', 'namaperlengkapan', 'namaitem', 'namabarang', 'namabahankemasan', 'nama', 'bahan', 'item']);

          if (!code && keys[1] && keys[1].toLowerCase().includes('kode')) {
            code = String(row[keys[1]] || '').trim();
          }
          if (!name && keys[2] && keys[2].toLowerCase().includes('nama')) {
            name = String(row[keys[2]] || '').trim();
          }
          if (!name) {
            const nameKey = keys.find(k => {
              const cl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return cl.includes('nama') || cl.includes('bahan') || cl.includes('barang') || cl.includes('item') || cl.includes('perlengkapan');
            });
            if (nameKey) name = String(row[nameKey] || '').trim();
          }

          const defaultCategory = currentMasterType === 'STOCK_AWAL_PERLENGKAPAN' ? 'Perlengkapan' : 'BAHAN_BAKU';
          const category = getVal(row, ['kategoriopsional', 'kategori', 'category']) || defaultCategory;
          const unitTypeRaw = getVal(row, ['tipesatuaninput', 'tipesatuan', 'unittype', 'tipe']).toUpperCase();
          const unitType = unitTypeRaw.includes('BELI') ? 'BELI' : 'PAKAI';
          const rawUnit = getVal(row, ['satuan', 'unit', 'satuaninput']);
          const defaultFallbackUnit = currentMasterType === 'STOCK_AWAL_PERLENGKAPAN' ? (unitType === 'BELI' ? 'Slop' : 'pcs') : (unitType === 'BELI' ? 'kg' : 'gram');
          const uUnit = normalizeUnitClient(rawUnit, defaultFallbackUnit);

          const initialStock = parseDecimal(getVal(row, [
            'kuantitassaldoawalfisik', 'kuantitasstockawalfisik', 'kuantitasstokawalfisik', 'saldoawalfisik', 'stockawalfisik', 'stokawalfisik',
            'stockawal', 'stokawal', 'stock_awal', 'stok_awal', 'qty', 'kuantitas', 'jumlahstok', 'jumlah'
          ]), 0);

          const harga = parseDecimal(getVal(row, [
            'harganilaimodalsatuanrp', 'harganilaimodalsatuan', 'harganilaimodal', 'hargasatuan', 'hargamodal', 'harga', 'hargabeli', 'modal', 'cost'
          ]), 0);

          const minStock = parseDecimal(getVal(row, [
            'stokminimalgudang', 'stokminimal', 'stokmin', 'minstok', 'minimumstok', 'minstock'
          ]), 0);

          const rawEffectiveDate = getVal(row, ['tanggalefektif', 'tanggalefektifyyyymmdd', 'tanggal', 'date', 'tgl', 'efektif']);
          const effectiveDate = parseExcelDate(rawEffectiveDate);
          const notes = getVal(row, ['catatanketerangan', 'catatan', 'keterangan']);

          if (!name) errors.push('Nama item wajib diisi.');
          if (initialStock <= 0) errors.push('Kuantitas saldo awal fisik harus lebih dari 0.');
          if (harga < 0) errors.push('Harga/modal tidak boleh negatif.');

          mappedData = {
            outlet_name: outletName,
            code,
            name,
            category,
            unit_type: unitType,
            unit: uUnit.symbol,
            initial_stock: initialStock,
            stok_awal: initialStock,
            qty: initialStock,
            harga,
            unit_price: harga,
            stok_min: minStock,
            date: effectiveDate,
            notes: notes || `Saldo awal fisik per gudang: ${outletName || 'Gudang Utama'}`,
            _uRaw: uUnit,
          };

        } else if (currentMasterType === 'MENU') {
          let code = getVal(row, ['kodemenu', 'kode', 'code', 'sku']);
          let name = getVal(row, ['namamenu', 'nama', 'itemname', 'menu']);
          const barcode = getVal(row, ['barcode']);

          if (!code && keys[0] && keys[0].toLowerCase().includes('kode')) {
            code = String(row[keys[0]] || '').trim();
          }
          if (!name) {
            const nameKey = keys.find(k => {
              const cl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return cl.includes('nama') || cl.includes('menu');
            });
            if (nameKey) name = String(row[nameKey] || '').trim();
          }
          const category = getVal(row, ['kategori', 'category']) || 'Umum';
          const typeRaw = getVal(row, ['tipeitem', 'tipe', 'type']).toUpperCase();
          const itemType = ['RECIPE', 'DIRECT', 'SERVICE', 'BUNDLE'].includes(typeRaw) ? typeRaw : 'RECIPE';
          const price = parseDecimal(getVal(row, ['hargajualrp', 'hargajual', 'harga', 'price']), 0);
          const costPrice = parseDecimal(getVal(row, ['hppmodalrp', 'hpp', 'modal', 'cost', 'hppmodal']), 0);
          const description = getVal(row, ['deskripsi', 'keterangan']);
          const statusRaw = getVal(row, ['status']);
          const isKosong = statusRaw && statusRaw.toUpperCase().includes('KOSONG');

          if (!name) errors.push('Nama menu wajib diisi.');
          if (price <= 0) errors.push('Harga jual harus lebih dari 0.');

          mappedData = { code, barcode, name, category, item_type: itemType, price, cost_price: costPrice, description, is_available: !isKosong };

        } else if (currentMasterType === 'RECIPE') {
          let menuCode = getVal(row, ['kodemenuotomatis', 'kodemenuopsional', 'kodemenu', 'kodemenualias', 'kode', 'code', 'sku', 'kodemenupos', 'kodemenuresep']);
          let menuName = getVal(row, ['namamenuproduk', 'namamenu', 'menu', 'nama', 'namaproduk', 'produk', 'namamenupos', 'namamenuresep', 'menuproduk']);
          let ingCode = getVal(row, ['kodebahanotomatis', 'kodebahanopsional', 'kodebahan', 'kodeperlengkapan', 'kodeitem', 'kode', 'code', 'skubahan']);
          let ingName = getVal(row, ['namabahanperlengkapan', 'namabahanperlengkapankemasan', 'namabahankemasan', 'namabahan', 'bahan', 'namaperlengkapan', 'perlengkapan', 'kemasan', 'namakemasan', 'itemname', 'item', 'namabarang', 'namabahanbaku']);

          // Fallback by column position if header key matching missed
          if (!menuCode && keys[0] && keys[0].toLowerCase().includes('kode')) {
            menuCode = String(row[keys[0]] || '').trim();
          }
          if (!menuName && keys[1] && (keys[1].toLowerCase().includes('menu') || keys[1].toLowerCase().includes('produk') || keys[1].toLowerCase().includes('nama'))) {
            menuName = String(row[keys[1]] || '').trim();
          }
          if (!ingCode && keys[2] && keys[2].toLowerCase().includes('kode')) {
            ingCode = String(row[keys[2]] || '').trim();
          }
          if (!ingName && keys[3] && (keys[3].toLowerCase().includes('bahan') || keys[3].toLowerCase().includes('kemasan') || keys[3].toLowerCase().includes('perlengkapan') || keys[3].toLowerCase().includes('nama'))) {
            ingName = String(row[keys[3]] || '').trim();
          }

          const rawQtyStr = getVal(row, ['gramasiqty', 'gramasi', 'gramasikuantitasqty', 'kuantitas', 'qty', 'jumlah', 'porsi', 'takaran', 'gramasitakaran', 'quantity', 'takaranresep', 'gramasiresep', 'gramasiqtytakaran']);
          const qty = parseDecimal(rawQtyStr || (keys[4] ? row[keys[4]] : 0), 0);
          const rawUnit = getVal(row, ['satuanpakaiotomatis', 'satuanpakai', 'satuan', 'unit', 'unitpakai', 'satuanresep']) || (keys[5] ? String(row[keys[5]] || '').trim() : '');
          const uUnit = normalizeUnitClient(rawUnit, 'gram');
          const wasteStd = parseDecimal(getVal(row, ['standarsusutwaste', 'standarsusut', 'susut', 'waste', 'toleransisusut', 'persensusut', 'susutpersen', 'wastepersen']) || (keys[6] ? row[keys[6]] : 0), 0);
          const notes = getVal(row, ['catatanpetunjukresep', 'catatanresep', 'catatan', 'keterangan', 'petunjuk', 'notes', 'instruksi']) || (keys[7] ? String(row[keys[7]] || '').trim() : '');

          // If menu and ingredient are both completely blank (empty placeholder from template), flag to skip
          if (!menuName && !menuCode && !ingName && !ingCode && qty <= 0) {
            return {
              rowNumber: idx + headerRowIndex + 2,
              original: row,
              data: { name: '', _isEmptyPlaceholder: true },
              isValid: false,
              errors: ['Baris kosong template'],
            };
          }

          // Otomatis mencocokkan & menarik data dari Master Menu jika sudah terdaftar
          const matchedMenu = modalMenus.find(m =>
            (menuCode && m.code && String(m.code).trim().toLowerCase() === String(menuCode).trim().toLowerCase()) ||
            (menuName && m.name && String(m.name).trim().toLowerCase() === String(menuName).trim().toLowerCase())
          );
          if (matchedMenu) {
            if (!menuCode && matchedMenu.code) menuCode = matchedMenu.code;
            if (!menuName && matchedMenu.name) menuName = matchedMenu.name;
          }

          // Otomatis mencocokkan & menarik Kode serta mengunci Satuan Pakai resmi dari Master Bahan
          const matchedIng = modalIngredients.find(i =>
            (ingCode && i.code && String(i.code).trim().toLowerCase() === String(ingCode).trim().toLowerCase()) ||
            (ingName && i.name && String(i.name).trim().toLowerCase() === String(ingName).trim().toLowerCase())
          );
          if (matchedIng) {
            if (!ingCode && matchedIng.code) ingCode = matchedIng.code;
            if (!ingName && matchedIng.name) ingName = matchedIng.name;
          }
          const finalUnit = matchedIng?.unit_pakai || uUnit.symbol || 'gram';

          if (!menuName && !menuCode) errors.push('Nama atau Kode Menu wajib diisi.');
          if (!ingName && !ingCode) errors.push('Nama atau Kode Bahan/Kemasan wajib diisi.');
          if (qty <= 0) errors.push('Gramasi / Qty harus lebih dari 0.');

          const displayName = (menuName || menuCode) && (ingName || ingCode)
            ? `${menuName || menuCode} ➔ ${ingName || ingCode} (${qty} ${finalUnit})`
            : '';

          mappedData = {
            menu_code: menuCode,
            menu_name: menuName,
            ingredient_code: ingCode,
            ingredient_name: ingName,
            qty,
            unit: finalUnit,
            waste_std: wasteStd,
            notes,
            name: displayName,
            _uRaw: uUnit,
          };

        } else if (currentMasterType === 'RECEIVABLE') {
          let customerName = getVal(row, ['namapelanggan', 'namadebitur', 'nama', 'customer', 'pelanggan']);
          if (!customerName) {
            const nameKey = keys.find(k => {
              const cl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return cl.includes('nama') || cl.includes('pelanggan') || cl.includes('debitur');
            });
            if (nameKey) customerName = String(row[nameKey] || '').trim();
          }
          const phone = getVal(row, ['nomorhp', 'phone', 'telepon', 'hp']);
          const address = getVal(row, ['alamatpelanggan', 'alamat', 'address']);
          const totalAmount = parseDecimal(getVal(row, ['totaltagihankasbonrp', 'totaltagihan', 'total', 'nominal', 'tagihan']), 0);
          const initialPaid = parseDecimal(getVal(row, ['nominaldpuangmuka', 'nominaldp', 'uangmuka', 'dp']), 0);
          const issueDate = getVal(row, ['tanggalterbityyyymmdd', 'tanggalterbit', 'terbit', 'issuedate']) || new Date().toISOString().slice(0, 10);
          const dueDate = getVal(row, ['tanggaljatuhtempoyyyymmdd', 'tanggaljatuhtempo', 'tanggaljatuh', 'jatuhtempo', 'duedate']) || new Date().toISOString().slice(0, 10);
          const notes = getVal(row, ['catatan', 'keterangan']);

          if (!customerName) errors.push('Nama pelanggan wajib diisi.');
          if (totalAmount <= 0) errors.push('Total tagihan kasbon harus lebih dari 0.');

          mappedData = { customer_name: customerName, customer_phone: phone, customer_address: address, total_amount: totalAmount, initial_paid: initialPaid, issue_date: issueDate, due_date: dueDate, notes };

        } else if (currentMasterType === 'OUTLET') {
          let name = getVal(row, ['namaoutletcabang', 'namaoutlet', 'namacabang', 'nama', 'outlet']);
          let code = getVal(row, ['kodeoutletgudang', 'kodeoutlet', 'kode', 'code']);
          if (!name) {
            const nameKey = keys.find(k => {
              const cl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return cl.includes('nama') || cl.includes('outlet') || cl.includes('cabang');
            });
            if (nameKey) name = String(row[nameKey] || '').trim();
          }
          const typeRaw = getVal(row, ['tipe', 'type', 'tipeoutlet']).toUpperCase();
          const type = ['CABANG', 'PUSAT', 'GUDANG'].includes(typeRaw) ? typeRaw : 'CABANG';
          const picName = getVal(row, ['namapicmanager', 'namapic', 'pic', 'manager']);
          const phone = getVal(row, ['nomortelepon', 'telepon', 'phone', 'hp']);
          const address = getVal(row, ['alamatlengkap', 'alamat', 'address']);
          const mainFlag = getVal(row, ['cabangutama', 'is_main', 'main']);
          const isMain = mainFlag && mainFlag.toUpperCase().includes('YA');

          if (!name) errors.push('Nama outlet wajib diisi.');

          mappedData = { code, name, type, pic_name: picName, phone, address, is_main: isMain };
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
        if (d._isEmptyPlaceholder) return false;
        const name = (d.name || d.customer_name || d.menu_name || '').trim();
        const lower = name.toLowerCase();
        if (
          !name ||
          name.startsWith('===') ||
          lower.includes('template import') ||
          lower.includes('petunjuk') ||
          lower.includes('data bahan') ||
          lower.includes('daftar perlengkapan') ||
          lower.includes('daftar menu') ||
          lower.includes('daftar resep') ||
          lower.includes('tagihan piutang') ||
          lower.includes('daftar outlet') ||
          lower.includes('saldo awal stok') ||
          ['kode menu (otomatis)', 'nama menu / produk (▼)*', 'kode bahan (otomatis)', 'nama bahan / perlengkapan (▼)*', 'gramasi / qty*', 'satuan pakai (otomatis / ▼)*', 'standar susut / waste (%)', 'catatan / petunjuk resep', 'kode bahan', 'nama bahan', 'nama bahan*', 'kode perlengkapan', 'nama perlengkapan', 'kode menu', 'nama menu', 'nama pelanggan', 'kode bahan / item', 'nama bahan / item', 'nama bahan / item*', 'nama menu / produk', 'nama menu / produk*'].includes(lower)
        ) {
          return false;
        }
        return true;
      });

      setParsedRows(parsed);
      const valid = parsed.filter(r => r.isValid).length;
      if (parsed.length === 0) {
        toast.error('Tidak ada baris data valid yang terdeteksi dari file Excel. Pastikan file tidak kosong dan kolom sesuai.');
      } else {
        toast.success(`Berhasil membaca ${parsed.length} baris data (${valid} baris valid siap di-import)!`);
      }
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

      // Refetch master lists so subsequent steps get fresh data immediately
      api.get('/outlets').then(r => setModalOutlets(Array.isArray(r.data) ? r.data : (r.data?.data || []))).catch(() => { });
      api.get('/ingredients').then(r => setModalIngredients(Array.isArray(r.data) ? r.data : (r.data?.data || []))).catch(() => { });
      api.get('/menus').then(r => setModalMenus(Array.isArray(r.data) ? r.data : (r.data?.data || []))).catch(() => { });

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
    let statusMatch = true;
    if (previewFilter === 'ATTENTION') {
      statusMatch = !r.isValid || r.data._uBeli?.isFixed || r.data._uPakai?.isFixed || r.data._uBeli?.isNew || r.data._uPakai?.isNew;
    } else if (previewFilter === 'VALID') {
      statusMatch = r.isValid && !r.data._uBeli?.isFixed && !r.data._uPakai?.isFixed && !r.data._uBeli?.isNew && !r.data._uPakai?.isNew;
    }
    if (!statusMatch) return false;

    if (selectedOutletFilter === 'ALL' || !selectedOutletFilter) return true;
    const rowOutlet = (r.data?.outlet_name || '').trim().toLowerCase();
    if (!rowOutlet) return true; // Master terpusat otomatis tampil untuk semua cabang
    const filterOutlet = selectedOutletFilter.trim().toLowerCase();
    return rowOutlet.includes(filterOutlet) || filterOutlet.includes(rowOutlet);
  });

  const hasOutlets = modalOutlets.length > 0;
  const hasIngredients = modalIngredients.length > 0;
  const hasMenus = modalMenus.length > 0;

  // Realtime dependency checks for the active step
  const dependencyChecks = useMemo(() => {
    if (activeStep.id === 'INITIAL_STOCK') {
      return [
        { name: 'Outlet & Gudang', ready: hasOutlets, count: modalOutlets.length, unit: 'Cabang', targetStepIdx: 0 },
        { name: 'Master Bahan / Kemasan', ready: hasIngredients, count: modalIngredients.length, unit: 'Item Master', targetStepIdx: 1 },
      ];
    }
    if (activeStep.id === 'RECIPE') {
      return [
        { name: 'Master Menu POS', ready: hasMenus, count: modalMenus.length, unit: 'Menu', targetStepIdx: 3 },
        { name: 'Master Bahan Baku', ready: hasIngredients, count: modalIngredients.length, unit: 'Bahan Baku', targetStepIdx: 1 },
      ];
    }
    return [];
  }, [activeStep.id, hasOutlets, hasIngredients, hasMenus, modalOutlets.length, modalIngredients.length, modalMenus.length]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop fade-in" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(4, 7, 18, 0.88)', backdropFilter: 'blur(14px)',
      zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div className="card modal-content" style={{
        maxWidth: '880px', width: '100%', maxHeight: '92vh', overflowY: 'auto',
        padding: '24px', borderRadius: '20px', background: '#11162d', border: '1px solid var(--border-strong)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <FileSpreadsheet size={22} color="var(--primary)" />
              Import Data Master Excel & Template Hub
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Panduan impor data bertahap untuk menjamin keterkaitan data (Outlet ➔ Bahan ➔ Stok ➔ Menu ➔ Resep/HPP) berjalan akurat.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* View Mode Switcher */}
            <div style={{
              display: 'inline-flex',
              padding: '3px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '10px',
              border: '1px solid var(--border)'
            }}>
              <button
                type="button"
                onClick={() => setViewMode('STEPPER')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '7px',
                  border: 'none',
                  background: viewMode === 'STEPPER' ? 'var(--primary)' : 'transparent',
                  color: '#ffffff',
                  fontSize: '11.5px',
                  fontWeight: viewMode === 'STEPPER' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.2s ease'
                }}
              >
                <ListOrdered size={13} />
                Step-by-Step
              </button>
              <button
                type="button"
                onClick={() => setViewMode('QUICK')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '7px',
                  border: 'none',
                  background: viewMode === 'QUICK' ? 'var(--primary)' : 'transparent',
                  color: '#ffffff',
                  fontSize: '11.5px',
                  fontWeight: viewMode === 'QUICK' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.2s ease'
                }}
              >
                <LayoutGrid size={13} />
                Mode Cepat
              </button>
            </div>

            <button className="btn btn-ghost btn-icon" onClick={onClose} title="Tutup Modal">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* STEPPER TIMELINE BAR (When viewMode === 'STEPPER') */}
        {viewMode === 'STEPPER' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))',
            gap: '8px',
            marginBottom: '16px',
            background: 'rgba(0, 0, 0, 0.25)',
            padding: '10px',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.07)'
          }}>
            {IMPORT_STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = currentStepIndex === idx;
              const isPast = currentStepIndex > idx;

              return (
                <div
                  key={step.id}
                  onClick={() => handleSelectStep(idx)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    padding: '10px 6px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--primary)' : (isPast ? 'rgba(34, 197, 94, 0.35)' : 'rgba(255, 255, 255, 0.06)'),
                    background: isActive
                      ? 'linear-gradient(180deg, rgba(124, 58, 237, 0.28) 0%, rgba(79, 70, 229, 0.18) 100%)'
                      : (isPast ? 'rgba(34, 197, 94, 0.06)' : 'rgba(255, 255, 255, 0.02)'),
                    boxShadow: isActive ? '0 4px 15px rgba(124, 58, 237, 0.3)' : 'none',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  title={`Klik untuk membuka Step ${step.stepNumber}: ${step.name}`}
                >
                  {/* Step Number Badge */}
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? 'var(--primary)' : (isPast ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.08)'),
                    color: isActive ? '#ffffff' : (isPast ? '#4ade80' : 'var(--text-secondary)'),
                    fontWeight: 800,
                    fontSize: '11.5px',
                    marginBottom: '5px'
                  }}>
                    {isPast ? <Check size={14} /> : step.stepNumber}
                  </div>

                  <div style={{
                    fontSize: '11.5px',
                    fontWeight: isActive ? 800 : 600,
                    color: isActive ? '#ffffff' : (isPast ? '#e2e8f0' : 'var(--text-secondary)'),
                    lineHeight: '1.2'
                  }}>
                    {step.name}
                  </div>

                  <div style={{
                    fontSize: '9.5px',
                    color: isActive ? 'var(--accent-bright)' : (isPast ? '#4ade80' : 'var(--text-muted)'),
                    marginTop: '3px',
                    fontWeight: 600
                  }}>
                    {step.category}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* QUICK MODE TAB PILLS (When viewMode === 'QUICK') */}
        {viewMode === 'QUICK' && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {[
              { key: 'OUTLET', label: '1. Outlet & Cabang' },
              { key: 'INGREDIENT', label: '2. Bahan Baku' },
              { key: 'PERLENGKAPAN', label: '2. Perlengkapan' },
              { key: 'STOCK_AWAL_BAHAN', label: '3. Saldo Awal Bahan' },
              { key: 'STOCK_AWAL_PERLENGKAPAN', label: '3. Saldo Awal Perlengkapan' },
              { key: 'MENU', label: '4. Master Menu' },
              { key: 'RECIPE', label: '5. Resep & BOM' },
              { key: 'RECEIVABLE', label: '6. Kasbon / Piutang' },
            ].map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setSelectedMaster(m.key);
                  setFile(null);
                  setFileName('');
                  setParsedRows([]);
                  setImportResult(null);
                  if (fileInputRef.current) fileInputRef.current.value = null;
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: selectedMaster === m.key ? 'var(--primary)' : 'var(--border)',
                  background: selectedMaster === m.key ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: selectedMaster === m.key ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* STEP GUIDANCE & DATA DEPENDENCY CARD */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(17, 24, 39, 0.85) 100%)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '14px',
          padding: '14px 18px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{
                  background: 'var(--primary)',
                  color: '#ffffff',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  letterSpacing: '0.3px'
                }}>
                  TAHAP {activeStep.stepNumber} DARI 6
                </span>
                <span style={{ fontSize: '14.5px', fontWeight: 800, color: '#ffffff' }}>
                  {activeStep.name}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {activeStep.description}
              </div>
            </div>

            {/* Realtime Master Counts Badge */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', padding: '3px 8px', fontSize: '10.5px' }}>
                🏢 Cabang: <strong style={{ color: modalOutlets.length > 0 ? '#4ade80' : '#f59e0b' }}>{modalOutlets.length}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', padding: '3px 8px', fontSize: '10.5px' }}>
                🥬 Bahan: <strong style={{ color: modalIngredients.length > 0 ? '#4ade80' : '#f59e0b' }}>{modalIngredients.length}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', padding: '3px 8px', fontSize: '10.5px' }}>
                🍽️ Menu: <strong style={{ color: modalMenus.length > 0 ? '#4ade80' : '#f59e0b' }}>{modalMenus.length}</strong>
              </div>
            </div>
          </div>

          {/* Dependency Info & Prerequisite Badges */}
          <div style={{
            marginTop: '10px',
            padding: '8px 12px',
            borderRadius: '9px',
            background: dependencyChecks.some(d => !d.ready) ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.08)',
            border: `1px solid ${dependencyChecks.some(d => !d.ready) ? 'rgba(245, 158, 11, 0.35)' : 'rgba(59, 130, 246, 0.25)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
          }}>
            <div style={{ fontSize: '11.5px', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <Info size={14} style={{ color: dependencyChecks.some(d => !d.ready) ? '#fbbf24' : '#60a5fa', flexShrink: 0 }} />
              <span>{activeStep.dependencyNote}</span>
            </div>

            {/* Dependency Prerequisite Clickable Badges */}
            {dependencyChecks.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Status Prasyarat:</span>
                {dependencyChecks.map((dep, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectStep(dep.targetStepIdx)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid',
                      background: dep.ready ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      borderColor: dep.ready ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
                      color: dep.ready ? '#4ade80' : '#f87171'
                    }}
                    title={dep.ready ? 'Prasyarat siap' : `Klik untuk berpindah ke Step ${dep.targetStepIdx + 1}`}
                  >
                    {dep.ready ? <Check size={11} /> : <AlertCircle size={11} />}
                    {dep.name}: {dep.ready ? `${dep.count} ${dep.unit} ✓` : 'Belum Ada (Klik untuk Import) ➔'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SUB-ITEM SEGMENTED CONTROL (If step has multiple master categories) */}
        {activeStep.subItems.length > 1 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {activeStep.subItems.map(sub => {
              const SubIcon = sub.icon;
              const isSelected = selectedMaster === sub.key;
              return (
                <button
                  key={sub.key}
                  type="button"
                  onClick={() => handleSelectSubItem(sub.key)}
                  style={{
                    flex: 1,
                    minWidth: '220px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)',
                    background: isSelected ? 'var(--primary)' : 'rgba(255, 255, 255, 0.04)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 4px 12px rgba(124, 58, 237, 0.35)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {SubIcon && <SubIcon size={16} />}
                    <span style={{ fontSize: '12.5px', fontWeight: isSelected ? 800 : 600 }}>{sub.label}</span>
                  </div>
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    color: '#ffffff',
                    fontWeight: 700
                  }}>
                    {sub.badge}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Template Download Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(79, 70, 229, 0.22) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '18px',
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
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed var(--border-strong)',
            borderRadius: '14px',
            padding: '22px 16px',
            textAlign: 'center',
            background: 'rgba(0, 0, 0, 0.2)',
            marginBottom: '18px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <Upload size={30} style={{ color: 'var(--primary)', margin: '0 auto 8px' }} />
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#ffffff' }}>
            {fileName ? `File Terpilih: ${fileName}` : `Unggah File Excel untuk ${activeConfig.title}`}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Format didukung: .xlsx, .xls, .csv (Maksimal 5.000 baris per sekali import)
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            onClick={(e) => { e.stopPropagation(); e.target.value = null; }}
            style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}
          />
        </div>

        {/* Loading File Indicator */}
        {loadingFile && <LoadingState message="Membaca & Memvalidasi File Excel..." />}

        {/* Import Result Success Banner with Next Step Option */}
        {importResult && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={24} color="var(--ok)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '14px', color: '#ffffff' }}>
                  {importResult.message}
                </div>
                <div style={{ fontSize: '12px', color: '#4ade80', marginTop: '2px' }}>
                  Data {activeConfig.title} telah tersimpan dan siap digunakan untuk tahapan berikutnya.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {currentStepIndex < IMPORT_STEPS.length - 1 ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleNextStep}
                  style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  Lanjut ke Step {currentStepIndex + 2}: {IMPORT_STEPS[currentStepIndex + 1]?.name} <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={onClose}
                  style={{ fontWeight: 800 }}
                >
                  Selesai Semua Tahapan ✓
                </button>
              )}
            </div>
          </div>
        )}

        {/* Live Parsed Preview Table */}
        {!importResult && parsedRows.length > 0 && (
          <div style={{ marginBottom: '18px' }}>
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
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
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

              {/* Master Cabang Filter Dropdown (Hanya tampil jika ada file khusus cabang) */}
              {modalOutlets.length > 0 && parsedRows.some(r => !!r.data?.outlet_name) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Store size={14} style={{ color: 'var(--accent-bright)' }} />
                  <select
                    className="form-control"
                    value={selectedOutletFilter}
                    onChange={(e) => setSelectedOutletFilter(e.target.value)}
                    style={{
                      fontSize: 11.5,
                      padding: '4px 10px',
                      height: 'auto',
                      width: 'auto',
                      minWidth: 160,
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderColor: selectedOutletFilter !== 'ALL' ? 'var(--primary)' : 'var(--border)',
                      color: selectedOutletFilter !== 'ALL' ? 'var(--accent-bright)' : '#ffffff'
                    }}
                    title="Filter pratinjau data berdasarkan Master Cabang"
                  >
                    <option value="ALL">🏢 Semua Cabang ({parsedRows.length})</option>
                    {modalOutlets.map((o) => {
                      const count = parsedRows.filter((r) => {
                        const oName = (r.data?.outlet_name || '').toLowerCase();
                        return oName && (oName.includes(o.name.toLowerCase()) || o.name.toLowerCase().includes(oName));
                      }).length;
                      return (
                        <option key={o.id} value={o.name}>
                          {o.is_main ? '🏢 ' : '📍 '} {o.name} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
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
                            <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              🏢 Terpusat (Semua Cabang)
                            </span>
                            <span>
                              {row.data.type} · Kategori: <strong>{row.data.category}</strong> · Satuan: <strong>{row.data.unit_beli} / {row.data.unit_pakai}</strong> (1 {row.data.unit_beli} = {row.data.konversi} {row.data.unit_pakai}) · Stok Min (Par Level): <strong style={{ color: '#fbbf24' }}>{num(row.data.minstok)} {row.data.unit_pakai}</strong> · Toleransi: <strong>{row.data.tolerance ?? 5}%</strong>
                            </span>
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
                            <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              🏢 Terpusat (Semua Cabang)
                            </span>
                            <span>
                              Kategori: <strong>{row.data.category}</strong> · Satuan: <strong>{row.data.unit_beli} / {row.data.unit_pakai}</strong> (1 {row.data.unit_beli} = {row.data.konversi} {row.data.unit_pakai}) · Stok Min (Par Level): <strong style={{ color: '#fbbf24' }}>{num(row.data.minstok)} {row.data.unit_pakai}</strong> · Toleransi: <strong>{row.data.tolerance ?? 5}%</strong>
                            </span>
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
                        {(currentMasterType === 'STOCK_AWAL_BAHAN' || currentMasterType === 'STOCK_AWAL_PERLENGKAPAN' || currentMasterType === 'STOCK_AWAL_GUDANG') && (
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span style={{ background: 'rgba(14, 165, 233, 0.2)', color: '#38bdf8', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              📍 {row.data.outlet_name || 'Gudang Utama'}
                            </span>
                            <span>
                              Saldo Awal Fisik: <strong style={{ color: 'var(--accent-bright)' }}>{num(row.data.initial_stock)} {row.data.unit}</strong> ({row.data.unit_type === 'BELI' ? 'Satuan Beli' : 'Satuan Pakai'})
                              {row.data.harga > 0 ? ` · Modal: ${rupiah(row.data.harga)}` : ''}
                              {row.data.stok_min > 0 ? ` · Min: ${num(row.data.stok_min)}` : ''}
                              {row.data.date ? ` · Tgl: ${row.data.date}` : ''}
                            </span>
                            {row.data._uRaw?.isFixed && (
                              <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }} title="Typo/singkatan otomatis diperbaiki ke format standar">
                                ✓ Auto-Fix ({row.data._uRaw.original})
                              </span>
                            )}
                          </div>
                        )}
                        {currentMasterType === 'MENU' && `${row.data.category} · ${row.data.item_type} · ${rupiah(row.data.price)}`}
                        {currentMasterType === 'RECIPE' && (
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px' }}>
                            <span style={{ background: 'rgba(124, 58, 237, 0.2)', color: '#c084fc', fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              🍽 {row.data.menu_name || row.data.menu_code}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>➔</span>
                            <span style={{ fontWeight: 700, color: '#ffffff' }}>
                              {row.data.ingredient_name || row.data.ingredient_code}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>·</span>
                            <span className="mono" style={{ color: 'var(--accent-bright)', fontWeight: 700 }}>
                              {num(row.data.qty)} {row.data.unit}
                            </span>
                            {row.data.waste_std > 0 && (
                              <span style={{ color: '#f59e0b', fontSize: '10px' }}>
                                (Susut {row.data.waste_std}%)
                              </span>
                            )}
                            {row.data.notes && (
                              <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontStyle: 'italic' }}>
                                • {row.data.notes}
                              </span>
                            )}
                            {row.data._uRaw?.isFixed && (
                              <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }} title="Typo/singkatan otomatis diperbaiki ke format standar">
                                ✓ Auto-Fix ({row.data._uRaw.original})
                              </span>
                            )}
                          </div>
                        )}
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

        {/* WIZARD ACTIONS & FOOTER CONTROLS */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            {viewMode === 'STEPPER' && currentStepIndex > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handlePrevStep}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
              >
                <ArrowLeft size={14} /> Step Sebelumnya ({IMPORT_STEPS[currentStepIndex - 1]?.name})
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {viewMode === 'STEPPER' && currentStepIndex < IMPORT_STEPS.length - 1 && !importResult && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleNextStep}
                style={{ color: 'var(--text-secondary)', fontSize: '12px' }}
              >
                Lewati Langkah Ini ➔
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Tutup
            </button>
            {!importResult && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSubmitImport}
                disabled={submitting || validCount === 0}
                style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {submitting ? 'Meng-import Data...' : `Simpan & Import (${validCount} Item Valid)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
