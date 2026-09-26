const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/vendor-excel-BTnRVny0.js","assets/rolldown-runtime-Dd_uD5pT.js","assets/exceljs.min-DgbhWywh.js"])))=>i.map(i=>d[i]);
import{i as e}from"./rolldown-runtime-Dd_uD5pT.js";import{d as t}from"./vendor-router-B6dCaZ96.js";async function n(){return await t(()=>import(`./vendor-excel-BTnRVny0.js`).then(e=>e.t),__vite__mapDeps([0,1]))}function r(e){let t=[];return e.forEach(e=>{(e||[]).forEach((e,n)=>{let r=e==null?0:String(e).length;t[n]=Math.max(t[n]||10,Math.min(r+3,50))})}),t.map(e=>({wch:e}))}async function i({data:e,varData:t=[],varMenuData:i=[],period:a,outletName:o=`Semua Cabang`,businessName:s=`MOVA POS`,userName:c=`Administrator`}){let l=await n(),u=l.utils.book_new(),d=new Date().toLocaleString(`id-ID`),{status_counts:f={},total_variance_value:p=0,total_variance_loss:m=0,total_waste_value:h=0,total_combined_loss:g=0,top_waste:_=[]}=e||{},v=[[`LAPORAN EKSEKUTIF COST CONTROL & ANALITIK VARIANSI PERSADAAN`],[`MOVA POS — Advanced F&B Cost Management System`],[],[`Bisnis / Brand`,s],[`Gudang / Outlet`,o],[`Periode Audit`,`${a.from} s/d ${a.to}`],[`Waktu Export`,d],[`Dicetak Oleh`,c],[`Target Laporan`,`Finance / Akuntan, Mitra Pemilik Cabang & Investor`],[],[`=== INDIKATOR KUNCI COST CONTROL & RESEP ===`],[`Metrik Analisis`,`Jumlah / Nilai`,`Satuan`,`Keterangan Akuntansi`],[`Bahan Berstatus Normal`,f.NORMAL??0,`Item Bahan`,`Pemakaian dalam batas wajar resep`],[`Bahan Berstatus Waspada`,f.WASPADA??0,`Item Bahan`,`Perlu evaluasi porsi & takaran koki`],[`Bahan Berstatus Tidak Wajar`,f[`TIDAK WAJAR`]??0,`Item Bahan`,`Wajib investigasi kehilangan/kebocoran`],[`Total Kerugian Waste Resmi`,h,`Rupiah (IDR)`,`Limbah basi, gosong, sortir diakui dapur`],[`Total Selisih Tak Terjelaskan (Shrinkage)`,m,`Rupiah (IDR)`,`Anomali selisih fisik vs sistem`],[`Total Kerugian F&B Bersih`,g,`Rupiah (IDR)`,`Akumulasi kerugian waste + selisih murni`],[],[`Catatan Rekomendasi:`,`Lakukan audit berkala pada item berstatus TIDAK WAJAR dan perketat standar pencatatan waste harian.`]],y=l.utils.aoa_to_sheet(v);y[`!cols`]=r(v),l.utils.book_append_sheet(u,y,`Ringkasan Eksekutif`);let b=[[`DAFTAR BAHAN BAKU DENGAN ANOMALI / SELISIH TERTINGGI`],[`Cabang:`,o,`Periode:`,`${a.from} s/d ${a.to}`],[],[`No`,`Kode Bahan`,`Nama Bahan Baku`,`Kategori`,`Satuan Pakai`,`% Net Variance`,`Nilai Selisih (Rp)`,`Status Audit`]];t.forEach((e,t)=>{b.push([t+1,e.ingredient?.code||`-`,e.ingredient?.name||`-`,e.ingredient?.category||`-`,e.ingredient?.unit_pakai||`-`,Number((e.variance_pct||0).toFixed(2)),Math.round(e.variance_value||0),e.status||`NORMAL`])});let x=l.utils.aoa_to_sheet(b);x[`!cols`]=r(b),l.utils.book_append_sheet(u,x,`Top Selisih Bahan`);let S=[[`MENU PENYUMBANG VARIANSI TERTINGGI`],[`Cabang:`,o,`Periode:`,`${a.from} s/d ${a.to}`],[],[`No`,`Nama Menu`,`Kategori`,`Qty Terjual (Porsi)`,`Weighted %`,`Nilai Variance (Rp)`]];i.forEach((e,t)=>{S.push([t+1,e.menu?.name||`-`,e.menu?.category||`-`,e.qty_terjual||0,Number((e.weighted_pct||0).toFixed(2)),Math.round(e.variance_value||0)])});let C=l.utils.aoa_to_sheet(S);C[`!cols`]=r(S),l.utils.book_append_sheet(u,C,`Top Menu Variance`);let w=[[`RINCIAN KERUSAKAN & LIMBAH BAHAN BAKU (DOCUMENTED WASTE)`],[`Cabang:`,o,`Periode:`,`${a.from} s/d ${a.to}`],[],[`No`,`Kode Bahan`,`Nama Bahan Baku`,`Total Qty Rusak`,`Satuan`,`Nilai Kerugian (Rp)`,`Catatan Kejadian / Alasan`]];_.forEach((e,t)=>{let n=(e.waste_records||[]).map(e=>`${e.waste_reason||`Lainnya`}: ${e.qty}`).join(`; `);w.push([t+1,e.ingredient?.code||`-`,e.ingredient?.name||`-`,e.waste_qty||e.waste||0,e.ingredient?.unit_pakai||`-`,Math.round(e.waste_value||0),n||`Pencatatan limbah dapur`])});let T=l.utils.aoa_to_sheet(w);T[`!cols`]=r(w),l.utils.book_append_sheet(u,T,`Limbah & Kerusakan`);let E=`Laporan_Eksekutif_Cost_Control_${a.from}_sd_${a.to}.xlsx`;return l.writeFile(u,E),E}async function a({varData:e=[],period:t,outletName:i=`Semua Cabang`,businessName:a=`MOVA POS`,userName:o=`Administrator`}){let s=await n(),c=s.utils.book_new(),l=[[`LAPORAN AUDIT VARIANSI PERSADAAN BAHAN BAKU (COST CONTROL AUDIT)`],[`MOVA POS — Metode Penilaian PSAK 14 Weighted Moving Average`],[],[`Bisnis / Brand`,a,``,`Waktu Cetak`,new Date().toLocaleString(`id-ID`)],[`Gudang / Cabang`,i,``,`Auditor PIC`,o],[`Periode Audit`,`${t.from} s/d ${t.to}`,``,`Standar`,`PSAK 14 Moving Average`],[],[`No`,`Kode`,`Nama Bahan Baku`,`Kategori`,`Satuan Beli`,`Satuan Pakai`,`Harga Pokok Rata-Rata (Rp)`,`Stok Awal (Pakai)`,`Masuk (Beli/Transfer)`,`Pemakaian Teoritis POS`,`Waste Resmi Tercatat`,`Pemakaian Aktual`,`Selisih Net (Pakai)`,`Selisih %`,`Nilai Total Selisih (Rp)`,`Kerugian Waste (Rp)`,`Selisih Tak Terjelaskan (Rp)`,`Status Audit`]],u=0,d=0,f=0;e.forEach((e,t)=>{let n=Math.round(e.variance_value||0),r=Math.round(e.waste_value||0),i=Math.round(e.unaccounted_value||0);u+=n,d+=r,f+=i,l.push([t+1,e.ingredient?.code||`-`,e.ingredient?.name||`-`,e.ingredient?.category||`-`,e.ingredient?.unit_beli||`-`,e.ingredient?.unit_pakai||`-`,Math.round(e.ingredient?.harga||0),e.stok_awal??`-`,e.total_masuk??`-`,e.pemakaian_teoritis??`-`,e.waste_qty??0,e.pemakaian_aktual??`-`,e.variance_qty??0,Number((e.variance_pct||0).toFixed(2)),n,r,i,e.status||`NORMAL`])}),l.push([]),l.push([`TOTAL AKUMULASI`,``,``,``,``,``,``,``,``,``,``,``,``,``,u,d,f,``]);let p=s.utils.aoa_to_sheet(l);p[`!cols`]=r(l),s.utils.book_append_sheet(c,p,`Audit Variansi Bahan`);let m=`Laporan_Audit_Variansi_Bahan_${t.from}_sd_${t.to}.xlsx`;return s.writeFile(c,m),m}async function o({data:e=[],period:t,outletName:i=`Semua Cabang`,businessName:a=`MOVA POS`,userName:o=`Administrator`}){let s=await n(),c=s.utils.book_new(),l=[[`LAPORAN ANALISIS PROFITABILITAS MENU & HPP DINAMIS`],[`MOVA POS — Evaluasi Margin & Moving Average Unit Economics`],[],[`Bisnis / Brand`,a,``,`Waktu Cetak`,new Date().toLocaleString(`id-ID`)],[`Gudang / Cabang`,i,``,`Auditor PIC`,o],[`Periode Audit`,`${t.from} s/d ${t.to}`,``,`Basis HPP`,`Weighted Moving Average`],[],[`No`,`Nama Menu`,`Kategori`,`Harga Jual (Rp)`,`HPP Teoritis Moving Avg (Rp)`,`Gross Margin (%)`,`Variance Cost / Porsi (Rp)`,`Adjusted HPP Aktual (Rp)`,`Adjusted Margin (%)`,`Penurunan Margin (pp)`,`Status Evaluasi`]];e.forEach((e,t)=>{let n=Number((e.gross_margin-e.adjusted_margin).toFixed(1)),r=n>5?`KRITIS (Margin Anjlok)`:n>2?`PERHATIAN (Waspada)`:`SEHAT (Normal)`;l.push([t+1,e.menu?.name||`-`,e.menu?.category||`-`,Math.round(e.menu?.price||0),Math.round(e.hpp||0),Number((e.gross_margin||0).toFixed(1)),Math.round(e.variance_per_porsi||0),Math.round(e.adjusted_hpp||0),Number((e.adjusted_margin||0).toFixed(1)),n,r])});let u=s.utils.aoa_to_sheet(l);u[`!cols`]=r(l),s.utils.book_append_sheet(c,u,`Profitabilitas Menu`);let d=`Laporan_Profitabilitas_Menu_dan_HPP_${t.from}_sd_${t.to}.xlsx`;return s.writeFile(c,d),d}async function s({menuData:e=[],period:t,outletName:i=`Semua Cabang`,businessName:a=`MOVA POS`,userName:o=`Administrator`}){let s=await n(),c=s.utils.book_new(),l=new Date().toLocaleString(`id-ID`),u=e.reduce((e,t)=>e+(t.variance_value||0),0),d=[[`LAPORAN RANKING VARIANCE PENYUMBANG MENU TERHADAP BAHAN BAKU`],[`MOVA POS — Weighted Variance Contribution Analysis`],[],[`Bisnis / Brand`,a,``,`Waktu Cetak`,l],[`Gudang / Cabang`,i,``,`Auditor PIC`,o],[`Periode Audit`,`${t.from} s/d ${t.to}`,``,`Total Variance`,Math.round(u)],[],[`No`,`Nama Menu`,`Kategori`,`Qty Terjual (Porsi)`,`Weighted % Variance`,`Nilai Variance (Rp)`,`Kontribusi terhadap Total Variance (%)`]];e.forEach((e,t)=>{let n=u===0?0:Number((e.variance_value/u*100).toFixed(1));d.push([t+1,e.menu?.name||`-`,e.menu?.category||`-`,e.qty_terjual||0,Number((e.weighted_pct||0).toFixed(2)),Math.round(e.variance_value||0),n])});let f=s.utils.aoa_to_sheet(d);f[`!cols`]=r(d),s.utils.book_append_sheet(c,f,`Ranking Menu Variance`);let p=`Laporan_Variance_Menu_${t.from}_sd_${t.to}.xlsx`;return s.writeFile(c,p),p}async function c({items:e=[],stats:t={},outletName:i=`Semua Cabang`,businessName:a=`MOVA POS`,userName:o=`Administrator`}){let s=await n(),c=s.utils.book_new(),l=[[`BUKU KASBON CUSTOMER (HUTANG PELANGGAN)`],[`MOVA POS — Customer Credit Ledger & Bulk Payment Management`],[],[`Bisnis / Brand`,a,``,`Waktu Ekspor`,new Date().toLocaleString(`id-ID`)],[`Cabang / Outlet`,i,``,`Dicetak Oleh`,o],[`Total Tagihan Kasbon`,t.total_receivables||0,``,`Sisa Kasbon Berjalan`,t.total_remaining||0],[`Total Telah Dilunasi`,t.total_paid||0,``,`Kasbon Jatuh Tempo (Overdue)`,t.total_overdue||0],[],[`No`,`No Invoice Kasbon`,`Tanggal Terbit`,`Jatuh Tempo`,`Nama Pelanggan`,`No. Telepon / WA`,`Cabang Outlet`,`Total Kasbon (Rp)`,`Sudah Dibayar (Rp)`,`Sisa Kasbon (Rp)`,`Progress (%)`,`Status Pelunasan`,`Keterangan / Rincian`]];e.forEach((e,t)=>{l.push([t+1,e.receivable_no||`-`,e.issue_date||`-`,e.due_date||`-`,e.customer_name||`-`,e.customer_phone||`-`,e.outlet_name||`-`,e.total_amount||0,e.paid_amount||0,e.remaining_amount||0,e.progress_pct??(e.total_amount>0?Math.round(e.paid_amount/e.total_amount*100):0),e.status_label||e.status||`-`,e.notes||`-`])});let u=s.utils.aoa_to_sheet(l);u[`!cols`]=r(l),s.utils.book_append_sheet(c,u,`Buku Piutang`);let d=`Buku_Piutang_${new Date().toISOString().slice(0,10)}.xlsx`;return s.writeFile(c,d),d}function l(e){if(!e)return``;let t=[`Januari`,`Februari`,`Maret`,`April`,`Mei`,`Juni`,`Juli`,`Agustus`,`September`,`Oktober`,`November`,`Desember`],n=e=>{if(!e)return``;let n=new Date(e);return isNaN(n.getTime())?e:`${String(n.getDate()).padStart(2,`0`)} ${t[n.getMonth()]} ${n.getFullYear()}`};return`${n(e.from)} s/d ${n(e.to)}`}async function u({items:e=[],summary:t={},period:i,outletName:a=`Semua Cabang`,businessName:o=`MOVA POS`}){let s=await n(),c=s.utils.book_new(),u=l(i),d=[[o],[`LAPORAN PENJUALAN PER PRODUK`],[`Per ${u}`],[],[`No.`,`Kode Produk`,`Nama Produk / Sub Produk`,`Qty Terjual`,`Qty Refund`,`Satuan`,`Modal`,`Harga`,`Disc`,`Total Nilai Terjual`,`Total Nilai Refund`]];e.forEach((e,t)=>{d.push([t+1,e.code||`-`,e.name||`-`,Number(e.qty_sold)||0,Number(e.qty_refund)||0,e.unit||`Cup`,Number(e.cost_price)||0,Number(e.price)||0,Number(e.discount_amount)||0,Number(e.total_sales)||0,Number(e.total_refund)||0])}),d.push([`Total`,``,``,Number(t.total_qty_sold)||0,Number(t.total_qty_refund)||0,``,Number(t.total_modal)||0,``,Number(t.total_discount)||0,Number(t.total_sales)||0,Number(t.total_refund)||0]);let f=s.utils.aoa_to_sheet(d);f[`!cols`]=r(d),s.utils.book_append_sheet(c,f,`Penjualan per Produk`);let p=`Laporan_Penjualan_Produk_${i.from}_sd_${i.to}.xlsx`;return s.writeFile(c,p),p}async function d({items:e=[],summary:t={},period:i,outletName:a=`Semua Cabang`,businessName:o=`MOVA POS`}){let s=await n(),c=s.utils.book_new(),u=l(i),d=[[o],[`LAPORAN PENUKARAN POIN`],[`Per ${u}`],[],[],[],[`No`,`Tanggal`,`Tgl. Dibuat`,`Dibuat Oleh`,`Warehouse`,`Customer`,`Kasir`,`No.Transaksi`,`Penukaran`,`Qty`,`Nilai`,`Poin`]];e.forEach((e,t)=>{d.push([t+1,e.date||`-`,e.created_at||`-`,e.created_by||`-`,e.warehouse||a,e.customer||`-`,e.cashier||e.created_by||`-`,e.order_number||`-`,e.penukaran||`-`,Number(e.qty)||1,Number(e.nilai)||0,Number(e.points_used)||0])}),d.push([`Total`,``,``,``,``,``,``,``,``,Number(t.total_qty)||e.length,Number(t.total_nilai)||0,Number(t.total_points)||0]);let f=s.utils.aoa_to_sheet(d);f[`!cols`]=r(d),s.utils.book_append_sheet(c,f,`Penukaran Poin`);let p=`Laporan_Penukaran_Poin_${i.from}_sd_${i.to}.xlsx`;return s.writeFile(c,p),p}async function f({items:e=[],summary:t={},period:i,outletName:a=`Semua Cabang`,businessName:o=`MOVA POS`}){let s=await n(),c=s.utils.book_new(),u=l(i),d=[[o],[`LAPORAN PEMBAYARAN PENJUALAN`],[`Per ${u}`],[],[`No.`,`Tanggal`,`Jam`,`Tgl. Dibuat`,`Dibuat Oleh`,`Warehouse`,`No.Penjualan`,`No.Pembayaran`,`Customer`,`Jenis Bayar`,`Disetor Ke`,`Total Transaksi`,`Bayar`,`Piutang`,`Kasir`]];e.forEach((e,t)=>{d.push([t+1,e.date||`-`,e.time||`-`,e.created_at||`-`,e.created_by||`-`,e.warehouse||a,e.order_number||`-`,e.payment_number||``,e.customer||`-`,e.payment_method||`-`,e.deposit_account||`-`,Number(e.total_transaction)||0,Number(e.paid_amount)||0,Number(e.receivable_amount)||0,e.cashier||e.created_by||`-`])}),d.push([`Total`,``,``,``,``,``,``,``,``,``,``,Number(t.total_transaction)||0,Number(t.total_paid)||0,Number(t.total_receivable)||0,``]);let f=s.utils.aoa_to_sheet(d);f[`!cols`]=r(d),s.utils.book_append_sheet(c,f,`Pembayaran Penjualan`);let p=`Laporan_Pembayaran_Penjualan_${i.from}_sd_${i.to}.xlsx`;return s.writeFile(c,p),p}async function p({items:e=[],summary:t={},period:i,outletName:a=`Semua Cabang`,businessName:o=`MOVA POS`}){let s=await n(),c=s.utils.book_new(),u=l(i),d=[[o],[`Laporan Transaksi Penjualan`],[`Per ${u}`],`No.,Tgl,Tgl. Dibuat,Dibuat Oleh,No.Ref,Customer,Promo,Jenis Bayar,Setor Ke,Kode Produk,Produk/Sub Produk,Kategori Produk,Sales Type,HPP,Harga Jual,,,,,Disc Tambahan,Disc Customer,PPN,Src.Charge,Pengiriman,Penjualan,Piutang,Profit,Kasir,Cetak Nota`.split(`,`),`.............(Per 1 Qty).QTY.Satuan.Harga.Disc.Subtotal..........`.split(`.`)];e.forEach((e,t)=>{d.push([t+1,e.date||`-`,e.created_at||`-`,e.created_by||`-`,e.order_number||`-`,e.customer||`Walk-in Customer`,e.promo||``,e.payment_method||`-`,e.deposit_account||`-`,e.product_code||`-`,e.product_name||`-`,e.product_category||`KOPI`,e.sales_type||`Dine-in`,Number(e.hpp)||0,Number(e.qty)||0,e.unit||`Cup`,Number(e.price)||0,Number(e.discount)||0,Number(e.subtotal)||0,Number(e.discount_extra)||0,Number(e.discount_customer)||0,Number(e.tax)||0,Number(e.service_charge)||0,Number(e.shipping)||0,Number(e.total_sale)||0,Number(e.receivable)||0,Number(e.profit)||0,e.cashier||e.created_by||`-`,Number(e.receipt_printed)||0])}),d.push([`Total`,``,``,``,``,``,``,``,``,``,``,``,``,``,Number(t.total_qty)||0,``,``,``,``,Number(t.total_discount)||0,0,0,0,0,Number(t.total_sale)||0,Number(t.total_receivable)||0,Number(t.total_profit)||0,``,``]);let f=s.utils.aoa_to_sheet(d);f[`!cols`]=r(d),s.utils.book_append_sheet(c,f,`Transaksi Penjualan`);let p=`Laporan_Transaksi_Penjualan_${i.from}_sd_${i.to}.xlsx`;return s.writeFile(c,p),p}async function m({items:e=[],summary:t={},period:i,outletName:a=`Semua Cabang`,businessName:o=`MOVA POS`}){let s=await n(),c=s.utils.book_new(),u=l(i),d=[[o],[`LAPORAN DAFTAR PENJUALAN PER CUSTOMER`],[`Per ${u}`],[],[`No.`,`Tanggal`,`Kode Customer`,`Customer`,`Group Customer`,`No.Ref`,`Produk`,`Qty`,`Satuan`,`Harga Satuan`,`Disc`,`PPN`,`Src.Charge`,`Pengiriman`,`Total`,`Total Bayar`,`Jenis Bayar`,`Piutang`,`Kasir`]];e.forEach((e,t)=>{d.push([t+1,e.date||`-`,e.customer_code||`-`,e.customer_name||`Walk-in Customer`,e.customer_group||`Reguler`,e.order_number||`-`,e.product_name||`-`,Number(e.qty)||0,e.unit||`Cup`,Number(e.price)||0,Number(e.discount)||0,Number(e.tax)||0,Number(e.service_charge)||0,Number(e.shipping)||0,Number(e.total)||0,Number(e.total_paid)||0,e.payment_method||`-`,Number(e.receivable)||0,e.cashier||`-`])}),d.push([`Total Penjualan Semua Customer`,``,``,``,``,``,``,Number(t.total_qty)||0,``,``,``,``,``,``,Number(t.total_amount)||0,Number(t.total_paid)||0,``,Number(t.total_receivable)||0,``]);let f=s.utils.aoa_to_sheet(d);f[`!cols`]=r(d),s.utils.book_append_sheet(c,f,`Penjualan per Customer`);let p=`Laporan_Penjualan_Customer_${i.from}_sd_${i.to}.xlsx`;return s.writeFile(c,p),p}async function h({items:e=[],summary:t={},period:i,outletName:a=`Semua Cabang`,businessName:o=`MOVA POS`}){let s=await n(),c=s.utils.book_new(),u=l(i),d=[[o],[`LAPORAN WAKTU TERAMAI`],[`Per ${u}`],[],[`No.`,`Waktu`,`Total Penjualan (Rp)`,`Rata-rata Penjualan (Rp)`,`Penjualan (%)`,`Transaksi`,`Transaksi (%)`,`Produk`,`Produk (%)`,`Tamu`,`Tamu (%)`]];e.forEach((e,t)=>{d.push([t+1,e.waktu||``,Number(e.total_penjualan)||0,Number(e.avg_penjualan)||0,Number(e.penjualan_pct)||0,Number(e.transaksi)||0,Number(e.transaksi_pct)||0,Number(e.produk)||0,Number(e.produk_pct)||0,Number(e.tamu)||0,Number(e.tamu_pct)||0])});let f=s.utils.aoa_to_sheet(d);f[`!cols`]=r(d),s.utils.book_append_sheet(c,f,`Waktu Teramai`);let p=`Laporan_Waktu_Teramai_${i.from}_sd_${i.to}.xlsx`;return s.writeFile(c,p),p}async function g({items:e=[],summary:t={},period:i,outletName:a=`Semua Cabang`,businessName:o=`MOVA POS`}){let s=await n(),c=s.utils.book_new(),u=l(i),d=[[o],[`LAPORAN PIUTANG CUSTOMER`],[`Per ${u}`],[],[`No.`,`Customer`,`Tanggal`,`Jam`,`No.Penjualan`,`Piutang`,`Dibayar`,`Sisa Piutang`,`Usia Piutang`,`Jatuh Tempo`]];e.forEach((e,t)=>{d.push([t+1,e.customer||`-`,e.tanggal||`-`,e.jam||`-`,e.no_penjualan||`-`,Number(e.piutang)||0,Number(e.dibayar)||0,Number(e.sisa_piutang)||0,e.usia_piutang||`0 Hari`,e.jatuh_tempo||`-`])}),d.push([`Total Piutang`,``,``,``,``,``,``,Number(t.total_sisa_piutang)||0,``,``]);let f=s.utils.aoa_to_sheet(d);f[`!cols`]=r(d),s.utils.book_append_sheet(c,f,`Piutang Customer`);let p=`Laporan_Piutang_Customer_${i.from}_sd_${i.to}.xlsx`;return s.writeFile(c,p),p}async function _({items:e=[],summary:t={},period:i,outletName:a=`Semua Cabang`,businessName:o=`MOVA POS`}){let s=await n(),c=s.utils.book_new(),u=l(i),d=[[o],[`LAPORAN PROMO`],[`Per ${u}`],[],[`No.`,`Tanggal`,`Promo`,`Jenis`,`Jumlah Transaksi`,`Nilai (Rp)`]];e.forEach((e,t)=>{d.push([t+1,e.tanggal||`-`,e.promo||`-`,e.jenis||`-`,Number(e.jumlah_transaksi)||0,Number(e.nilai)||0])}),d.push([`Total Promo`,``,``,``,Number(t.total_promo)||0,Number(t.total_nilai)||0]),d.push([`Total Penjualan Promo`,``,``,``,``,Number(t.total_penjualan_promo)||0]);let f=s.utils.aoa_to_sheet(d);f[`!cols`]=r(d),s.utils.book_append_sheet(c,f,`Laporan Promo`);let p=`Laporan_Promo_${i.from}_sd_${i.to}.xlsx`;return s.writeFile(c,p),p}async function v({rows:n=[],period:r={},outletName:i=`Semua Cabang`,businessName:a=`MOVA POS`,summary:o={}}){let s=await t(()=>import(`./exceljs.min-DgbhWywh.js`).then(t=>e(t.default,1)),__vite__mapDeps([2,1])),c=new(s.default||s).Workbook;c.creator=a,c.created=new Date;let l=c.addWorksheet(`Laporan Hutang Supplier`,{views:[{showGridLines:!0}]});l.getCell(`B2`).value=`LAPORAN HUTANG SUPPLIER`,l.getCell(`B2`).font={name:`Arial`,size:14,bold:!0},l.getCell(`B2`).alignment={horizontal:`center`,vertical:`middle`},l.mergeCells(`B2:K2`);let u=r.from_formatted&&r.to_formatted?`Per ${r.from_formatted} s/d ${r.to_formatted}`:r.from&&r.to?`Per ${r.from} s/d ${r.to}`:`Semua Periode`;l.getCell(`B3`).value=u,l.getCell(`B3`).font={name:`Arial`,size:11,italic:!0},l.getCell(`B3`).alignment={horizontal:`center`,vertical:`middle`},l.mergeCells(`B3:K3`);let d=l.getRow(5);d.values=[`No.`,`Supplier/Tanggal`,`Tgl. Dibuat`,`Dibuat Oleh`,`No.Pembelian`,`No.Bayar`,`Jatuh Tempo`,`Hutang`,`Dibayar`,`Sisa Hutang`,`Total Hutang`],d.height=24;let f={top:{style:`thin`,color:{argb:`FF000000`}},left:{style:`thin`,color:{argb:`FF000000`}},bottom:{style:`thin`,color:{argb:`FF000000`}},right:{style:`thin`,color:{argb:`FF000000`}}};d.eachCell(e=>{e.font={name:`Arial`,size:10,bold:!0},e.alignment={horizontal:`center`,vertical:`middle`},e.border=f});let p=6;n.forEach((e,t)=>{let n=l.getRow(p++);n.values=[t+1,e.supplier_tanggal||(e.supplier_name?`${e.supplier_name} - ${e.tgl_dibuat_fmt||e.tgl_dibuat}`:`-`),e.tgl_dibuat_fmt||e.tgl_dibuat||`-`,e.dibuat_oleh||`Admin`,e.no_pembelian||`-`,e.no_bayar||`-`,e.jatuh_tempo_fmt||e.jatuh_tempo||`-`,Number(e.hutang)||0,Number(e.dibayar)||0,Number(e.sisa_hutang)||0,Number(e.total_hutang)||0],n.height=20,n.eachCell((e,t)=>{e.border=f,e.font={name:`Arial`,size:10},t===1||[3,5,6,7].includes(t)?e.alignment={horizontal:`center`,vertical:`middle`}:t>=8?(e.alignment={horizontal:`right`,vertical:`middle`},e.numFmt=`#,##0.00`):e.alignment={horizontal:`left`,vertical:`middle`}})});let m=l.getRow(p);m.height=22;for(let e=1;e<=11;e++)m.getCell(e).border=f,m.getCell(e).font={name:`Arial`,size:10,bold:!0};l.mergeCells(`A${p}:H${p}`);let h=l.getCell(`A${p}`);h.value=`Total Utang`,h.alignment={horizontal:`right`,vertical:`middle`},h.font={name:`Arial`,size:10,bold:!0};let g=m.getCell(9);g.value=Number(o.total_dibayar??0),g.alignment={horizontal:`right`,vertical:`middle`},g.numFmt=`#,##0.00`,g.font={name:`Arial`,size:10,bold:!0};let _=m.getCell(10);_.value=Number(o.total_sisa_hutang??0),_.alignment={horizontal:`right`,vertical:`middle`},_.numFmt=`#,##0.00`,_.font={name:`Arial`,size:10,bold:!0};let v=m.getCell(11);v.value=Number(o.total_hutang??0),v.alignment={horizontal:`right`,vertical:`middle`},v.numFmt=`#,##0.00`,v.font={name:`Arial`,size:10,bold:!0},l.getColumn(1).width=6,l.getColumn(2).width=32,l.getColumn(3).width=14,l.getColumn(4).width=16,l.getColumn(5).width=20,l.getColumn(6).width=24,l.getColumn(7).width=14,l.getColumn(8).width=16,l.getColumn(9).width=16,l.getColumn(10).width=16,l.getColumn(11).width=16;let y=`Laporan_Hutang_Supplier_${r.from||`all`}_sd_${r.to||`all`}.xlsx`,b=await c.xlsx.writeBuffer(),x=new Blob([b],{type:`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`}),S=window.URL.createObjectURL(x),C=document.createElement(`a`);return C.href=S,C.download=y,document.body.appendChild(C),C.click(),document.body.removeChild(C),window.URL.revokeObjectURL(S),y}function y({rows:e=[],period:t={},outletName:n=`Semua Cabang`,summary:r={}}){let i=t.from_formatted&&t.to_formatted?`Per ${t.from_formatted} s/d ${t.to_formatted}`:t.from&&t.to?`Per ${t.from} s/d ${t.to}`:`Semua Periode`,a=window.open(``,`_blank`);if(!a){alert(`Pop-up browser diblokir. Harap izinkan pop-up untuk mencetak laporan.`);return}let o=e=>Number(e||0).toLocaleString(`id-ID`,{minimumFractionDigits:2,maximumFractionDigits:2}),s=e.map((e,t)=>`
    <tr>
      <td style="text-align:center;">${t+1}</td>
      <td>${e.supplier_tanggal||e.supplier_name||`-`}</td>
      <td style="text-align:center;">${e.tgl_dibuat_fmt||e.tgl_dibuat||`-`}</td>
      <td>${e.dibuat_oleh||`Admin`}</td>
      <td style="text-align:center;">${e.no_pembelian||`-`}</td>
      <td style="text-align:center;">${e.no_bayar||`-`}</td>
      <td style="text-align:center;">${e.jatuh_tempo_fmt||e.jatuh_tempo||`-`}</td>
      <td style="text-align:right;">${o(e.hutang)}</td>
      <td style="text-align:right;">${o(e.dibayar)}</td>
      <td style="text-align:right;">${o(e.sisa_hutang)}</td>
      <td style="text-align:right;">${o(e.total_hutang)}</td>
    </tr>
  `).join(``),c=`
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
      <div class="subtitle">${i}</div>
    </div>
    <div class="meta">
      <div><strong>Outlet/Cabang:</strong> ${n}</div>
      <div><strong>Dicetak Pada:</strong> ${new Date().toLocaleString(`id-ID`)}</div>
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
        ${s||`<tr><td colspan="11" style="text-align:center; padding:15px;">Tidak ada data hutang untuk periode ini</td></tr>`}
      </tbody>
      <tfoot>
        <tr class="footer-total">
          <td colspan="8" style="text-align: right; padding-right: 12px;">Total Utang</td>
          <td style="text-align: right;">${o(r.total_dibayar)}</td>
          <td style="text-align: right;">${o(r.total_sisa_hutang)}</td>
          <td style="text-align: right;">${o(r.total_hutang)}</td>
        </tr>
      </tfoot>
    </table>
    <script>
      window.onload = function() {
        window.print();
      };
    <\/script>
  </body>
  </html>
  `;a.document.open(),a.document.write(c),a.document.close()}async function b({data:n={},period:r={},businessName:i=`MOVA POS`,outletName:a=`Semua Cabang`}){let o=await t(()=>import(`./exceljs.min-DgbhWywh.js`).then(t=>e(t.default,1)),__vite__mapDeps([2,1])),s=new(o.default||o).Workbook;s.creator=i,s.created=new Date;let c=s.addWorksheet(`Laporan Neraca`,{views:[{showGridLines:!0}]}),l=r.from_formatted&&r.to_formatted?`Per ${r.from_formatted} s/d ${r.to_formatted}`:r.from&&r.to?`Per ${r.from} s/d ${r.to}`:`Semua Periode`;c.mergeCells(`B1:D1`);let u=c.getCell(`B1`);u.value=`LAPORAN NERACA`,u.font={name:`Arial`,size:13,bold:!0},u.alignment={horizontal:`center`,vertical:`middle`},c.getRow(1).height=22,c.mergeCells(`B2:E2`);let d=c.getCell(`B2`);d.value=l,d.font={name:`Arial`,size:10,italic:!0},d.alignment={horizontal:`left`,vertical:`middle`},c.getRow(2).height=18;let f=3,p=e=>{let t=c.getRow(f++);t.getCell(2).value=e,t.getCell(2).font={name:`Arial`,size:10,bold:!0},t.height=18},m=(e,t,n)=>{let r=c.getRow(f++);r.getCell(2).value=e||``,r.getCell(2).font={name:`Arial`,size:10},r.getCell(2).alignment={horizontal:`left`,vertical:`middle`},r.getCell(3).value=t||``,r.getCell(3).font={name:`Arial`,size:10},r.getCell(3).alignment={horizontal:`left`,vertical:`middle`},r.getCell(4).value=Number(n)||0,r.getCell(4).font={name:`Arial`,size:10},r.getCell(4).alignment={horizontal:`right`,vertical:`middle`},r.getCell(4).numFmt=`#,##0`,r.height=18},h=(e,t)=>{let n=c.getRow(f++);n.getCell(2).value=e,n.getCell(2).font={name:`Arial`,size:10,bold:!0},c.mergeCells(`B${f-1}:C${f-1}`),n.getCell(4).value=Number(t)||0,n.getCell(4).font={name:`Arial`,size:10,bold:!0},n.getCell(4).alignment={horizontal:`right`,vertical:`middle`},n.getCell(4).numFmt=`#,##0`,n.height=18};p(`Aset Lancar`),(n.current_assets?.accounts||[]).forEach(e=>{m(e.code,e.name,e.amount)}),h(`Jumlah Aset Lancar`,n.current_assets?.subtotal??0),p(`Aset Tetap`);let g=n.fixed_assets?.accounts||[];g.length>0?g.forEach(e=>{m(e.code,e.name,e.amount)}):m(``,`Depresiasi & Amortisasi`,0),h(`Jumlah Aset Tetap`,n.fixed_assets?.subtotal??0),p(`Liabilitas`);let _=n.liabilities?.accounts||[];_.length>0&&_.some(e=>e.amount!==0)&&_.forEach(e=>{m(e.code,e.name,e.amount)}),h(`Jumlah Hutang`,n.liabilities?.subtotal??0),p(`Modal`),(n.equity?.accounts||[]).forEach(e=>{m(e.code,e.name,e.amount)}),h(`Jumlah Modal`,n.equity?.subtotal??0),f++;let v=c.getRow(f);v.height=22,v.getCell(2).value=`Jumlah Aset`,v.getCell(2).font={name:`Arial`,size:11,bold:!0},c.mergeCells(`B${f}:C${f}`),v.getCell(4).value=Number(n.total_assets?.amount??0),v.getCell(4).font={name:`Arial`,size:11,bold:!0},v.getCell(4).alignment={horizontal:`right`,vertical:`middle`},v.getCell(4).numFmt=`#,##0`,v.getCell(6).value=`Jumlah Kewajiban dan Modal`,v.getCell(6).font={name:`Arial`,size:11,bold:!0},v.getCell(6).alignment={horizontal:`right`,vertical:`middle`},v.getCell(7).value=Number(n.total_liabilities_and_equity?.amount??0),v.getCell(7).font={name:`Arial`,size:11,bold:!0},v.getCell(7).alignment={horizontal:`right`,vertical:`middle`},v.getCell(7).numFmt=`#,##0`,c.getColumn(1).width=4,c.getColumn(2).width=14,c.getColumn(3).width=32,c.getColumn(4).width=18,c.getColumn(5).width=6,c.getColumn(6).width=30,c.getColumn(7).width=18;let y=`Laporan_Neraca_${r.from||`all`}_sd_${r.to||`all`}.xlsx`,b=await s.xlsx.writeBuffer(),x=new Blob([b],{type:`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`}),S=window.URL.createObjectURL(x),C=document.createElement(`a`);return C.href=S,C.download=y,document.body.appendChild(C),C.click(),document.body.removeChild(C),window.URL.revokeObjectURL(S),y}function x({data:e={},period:t={},businessName:n=`MOVA POS`,outletName:r=`Semua Cabang`}){let i=t.from_formatted&&t.to_formatted?`Per ${t.from_formatted} s/d ${t.to_formatted}`:t.from&&t.to?`Per ${t.from} s/d ${t.to}`:`Semua Periode`,a=window.open(``,`_blank`);if(!a){alert(`Pop-up browser diblokir. Harap izinkan pop-up untuk mencetak laporan.`);return}let o=e=>Number(e||0).toLocaleString(`id-ID`,{minimumFractionDigits:0,maximumFractionDigits:0}),s=(e=[])=>e.map(e=>`
      <tr>
        <td style="width: 120px; padding: 4px 8px; color: #475569;">${e.code||``}</td>
        <td style="padding: 4px 8px;">${e.name||``}</td>
        <td style="text-align: right; padding: 4px 8px; font-variant-numeric: tabular-nums;">${o(e.amount)}</td>
      </tr>
    `).join(``),c=`
  <!DOCTYPE html>
  <html>
  <head>
    <title>LAPORAN NERACA</title>
    <style>
      @page { size: portrait; margin: 15mm; }
      body { font-family: Arial, sans-serif; font-size: 11.5px; color: #111; margin: 0; padding: 15px; }
      .header { text-align: center; margin-bottom: 25px; }
      .title { font-size: 16px; font-weight: bold; letter-spacing: 0.5px; }
      .subtitle { font-size: 12px; font-style: italic; margin-top: 4px; color: #333; }
      .meta { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
      .section-title { font-size: 12px; font-weight: bold; padding: 8px 8px 4px 8px; }
      .subtotal-row { font-weight: bold; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; background-color: #f8fafc; }
      .subtotal-row td { padding: 6px 8px; }
      .grand-total-box { margin-top: 25px; display: flex; justify-content: space-between; border-top: 2px solid #111; padding-top: 10px; font-weight: bold; font-size: 13px; }
      @media print {
        body { padding: 0; }
        .subtotal-row { background-color: #eee !important; -webkit-print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="title">LAPORAN NERACA</div>
      <div class="subtitle">${i}</div>
    </div>
    <div class="meta">
      <div><strong>Bisnis:</strong> ${n} | <strong>Cabang:</strong> ${r}</div>
      <div><strong>Dicetak:</strong> ${new Date().toLocaleString(`id-ID`)}</div>
    </div>

    <!-- ASET LANCAR -->
    <table>
      <thead>
        <tr>
          <th colspan="3" class="section-title" style="text-align: left;">Aset Lancar</th>
        </tr>
      </thead>
      <tbody>
        ${s(e.current_assets?.accounts)}
      </tbody>
      <tfoot>
        <tr class="subtotal-row">
          <td colspan="2">Jumlah Aset Lancar</td>
          <td style="text-align: right;">${o(e.current_assets?.subtotal)}</td>
        </tr>
      </tfoot>
    </table>

    <!-- ASET TETAP -->
    <table>
      <thead>
        <tr>
          <th colspan="3" class="section-title" style="text-align: left;">Aset Tetap</th>
        </tr>
      </thead>
      <tbody>
        ${e.fixed_assets?.accounts?.length?s(e.fixed_assets?.accounts):`<tr><td style="color:#64748b;">-</td><td>Depresiasi & Amortisasi</td><td style="text-align:right;">0</td></tr>`}
      </tbody>
      <tfoot>
        <tr class="subtotal-row">
          <td colspan="2">Jumlah Aset Tetap</td>
          <td style="text-align: right;">${o(e.fixed_assets?.subtotal)}</td>
        </tr>
      </tfoot>
    </table>

    <!-- LIABILITAS -->
    <table>
      <thead>
        <tr>
          <th colspan="3" class="section-title" style="text-align: left;">Liabilitas</th>
        </tr>
      </thead>
      <tbody>
        ${e.liabilities?.accounts?.length?s(e.liabilities?.accounts):``}
      </tbody>
      <tfoot>
        <tr class="subtotal-row">
          <td colspan="2">Jumlah Hutang</td>
          <td style="text-align: right;">${o(e.liabilities?.subtotal)}</td>
        </tr>
      </tfoot>
    </table>

    <!-- MODAL -->
    <table>
      <thead>
        <tr>
          <th colspan="3" class="section-title" style="text-align: left;">Modal</th>
        </tr>
      </thead>
      <tbody>
        ${s(e.equity?.accounts)}
      </tbody>
      <tfoot>
        <tr class="subtotal-row">
          <td colspan="2">Jumlah Modal</td>
          <td style="text-align: right;">${o(e.equity?.subtotal)}</td>
        </tr>
      </tfoot>
    </table>

    <!-- GRAND TOTAL -->
    <div class="grand-total-box">
      <div>Jumlah Aset: <span style="margin-left: 20px;">Rp ${o(e.total_assets?.amount)}</span></div>
      <div>Jumlah Kewajiban dan Modal: <span style="margin-left: 20px;">Rp ${o(e.total_liabilities_and_equity?.amount)}</span></div>
    </div>

    <script>
      window.onload = function() {
        window.print();
      };
    <\/script>
  </body>
  </html>
  `;a.document.open(),a.document.write(c),a.document.close()}export{y as _,d as a,c,f as d,p as f,x as g,s as h,h as i,m as l,a as m,g as n,o,v as p,i as r,_ as s,b as t,u};