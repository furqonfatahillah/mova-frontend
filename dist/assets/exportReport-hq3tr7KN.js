const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/vendor-xlsx-LK-29t-I.js","assets/rolldown-runtime-kjsH4l9N.js","assets/vendor-exceljs-BPsxf_ah.js"])))=>i.map(i=>d[i]);
import{i as O}from"./rolldown-runtime-kjsH4l9N.js";import{d as $}from"./vendor-router-DzrPuXXN.js";async function f(){return await $(()=>import("./vendor-xlsx-LK-29t-I.js").then(u=>u.t),__vite__mapDeps([0,1]))}function A(u){const e=[];return u.forEach(s=>{(s||[]).forEach((d,c)=>{const l=d!=null?String(d).length:0;e[c]=Math.max(e[c]||10,Math.min(l+3,50))})}),e.map(s=>({wch:s}))}async function v({data:u,varData:e=[],varMenuData:s=[],period:d,outletName:c="Semua Cabang",businessName:l="MOVA POS",userName:o="Administrator"}){const r=await f(),i=r.utils.book_new(),t=new Date().toLocaleString("id-ID"),{status_counts:n={},total_variance_value:a=0,total_variance_loss:m=0,total_waste_value:g=0,total_combined_loss:P=0,top_waste:S=[]}=u||{},p=[["LAPORAN EKSEKUTIF COST CONTROL & ANALITIK VARIANSI PERSADAAN"],["MOVA POS — Advanced F&B Cost Management System"],[],["Bisnis / Brand",l],["Gudang / Outlet",c],["Periode Audit",`${d.from} s/d ${d.to}`],["Waktu Export",t],["Dicetak Oleh",o],["Target Laporan","Finance / Akuntan, Mitra Pemilik Cabang & Investor"],[],["=== INDIKATOR KUNCI COST CONTROL & RESEP ==="],["Metrik Analisis","Jumlah / Nilai","Satuan","Keterangan Akuntansi"],["Bahan Berstatus Normal",n.NORMAL??0,"Item Bahan","Pemakaian dalam batas wajar resep"],["Bahan Berstatus Waspada",n.WASPADA??0,"Item Bahan","Perlu evaluasi porsi & takaran koki"],["Bahan Berstatus Tidak Wajar",n["TIDAK WAJAR"]??0,"Item Bahan","Wajib investigasi kehilangan/kebocoran"],["Total Kerugian Waste Resmi",g,"Rupiah (IDR)","Limbah basi, gosong, sortir diakui dapur"],["Total Selisih Tak Terjelaskan (Shrinkage)",m,"Rupiah (IDR)","Anomali selisih fisik vs sistem"],["Total Kerugian F&B Bersih",P,"Rupiah (IDR)","Akumulasi kerugian waste + selisih murni"],[],["Catatan Rekomendasi:","Lakukan audit berkala pada item berstatus TIDAK WAJAR dan perketat standar pencatatan waste harian."]],w=r.utils.aoa_to_sheet(p);w["!cols"]=A(p),r.utils.book_append_sheet(i,w,"Ringkasan Eksekutif");const k=[["DAFTAR BAHAN BAKU DENGAN ANOMALI / SELISIH TERTINGGI"],["Cabang:",c,"Periode:",`${d.from} s/d ${d.to}`],[],["No","Kode Bahan","Nama Bahan Baku","Kategori","Satuan Pakai","% Net Variance","Nilai Selisih (Rp)","Status Audit"]];e.forEach((b,R)=>{k.push([R+1,b.ingredient?.code||"-",b.ingredient?.name||"-",b.ingredient?.category||"-",b.ingredient?.unit_pakai||"-",Number((b.variance_pct||0).toFixed(2)),Math.round(b.variance_value||0),b.status||"NORMAL"])});const E=r.utils.aoa_to_sheet(k);E["!cols"]=A(k),r.utils.book_append_sheet(i,E,"Top Selisih Bahan");const C=[["MENU PENYUMBANG VARIANSI TERTINGGI"],["Cabang:",c,"Periode:",`${d.from} s/d ${d.to}`],[],["No","Nama Menu","Kategori","Qty Terjual (Porsi)","Weighted %","Nilai Variance (Rp)"]];s.forEach((b,R)=>{C.push([R+1,b.menu?.name||"-",b.menu?.category||"-",b.qty_terjual||0,Number((b.weighted_pct||0).toFixed(2)),Math.round(b.variance_value||0)])});const x=r.utils.aoa_to_sheet(C);x["!cols"]=A(C),r.utils.book_append_sheet(i,x,"Top Menu Variance");const h=[["RINCIAN KERUSAKAN & LIMBAH BAHAN BAKU (DOCUMENTED WASTE)"],["Cabang:",c,"Periode:",`${d.from} s/d ${d.to}`],[],["No","Kode Bahan","Nama Bahan Baku","Total Qty Rusak","Satuan","Nilai Kerugian (Rp)","Catatan Kejadian / Alasan"]];S.forEach((b,R)=>{const T=(b.waste_records||[]).map(L=>`${L.waste_reason||"Lainnya"}: ${L.qty}`).join("; ");h.push([R+1,b.ingredient?.code||"-",b.ingredient?.name||"-",b.waste_qty||b.waste||0,b.ingredient?.unit_pakai||"-",Math.round(b.waste_value||0),T||"Pencatatan limbah dapur"])});const N=r.utils.aoa_to_sheet(h);N["!cols"]=A(h),r.utils.book_append_sheet(i,N,"Limbah & Kerusakan");const _=`Laporan_Eksekutif_Cost_Control_${d.from}_sd_${d.to}.xlsx`;return r.writeFile(i,_),_}async function B({varData:u=[],period:e,outletName:s="Semua Cabang",businessName:d="MOVA POS",userName:c="Administrator"}){const l=await f(),o=l.utils.book_new(),r=[["LAPORAN AUDIT VARIANSI PERSADAAN BAHAN BAKU (COST CONTROL AUDIT)"],["MOVA POS — Metode Penilaian PSAK 14 Weighted Moving Average"],[],["Bisnis / Brand",d,"","Waktu Cetak",new Date().toLocaleString("id-ID")],["Gudang / Cabang",s,"","Auditor PIC",c],["Periode Audit",`${e.from} s/d ${e.to}`,"","Standar","PSAK 14 Moving Average"],[],["No","Kode","Nama Bahan Baku","Kategori","Satuan Beli","Satuan Pakai","Harga Pokok Rata-Rata (Rp)","Stok Awal (Pakai)","Masuk (Beli/Transfer)","Pemakaian Teoritis POS","Waste Resmi Tercatat","Pemakaian Aktual","Selisih Net (Pakai)","Selisih %","Nilai Total Selisih (Rp)","Kerugian Waste (Rp)","Selisih Tak Terjelaskan (Rp)","Status Audit"]];let i=0,t=0,n=0;u.forEach((g,P)=>{const S=Math.round(g.variance_value||0),p=Math.round(g.waste_value||0),w=Math.round(g.unaccounted_value||0);i+=S,t+=p,n+=w,r.push([P+1,g.ingredient?.code||"-",g.ingredient?.name||"-",g.ingredient?.category||"-",g.ingredient?.unit_beli||"-",g.ingredient?.unit_pakai||"-",Math.round(g.ingredient?.harga||0),g.stok_awal??"-",g.total_masuk??"-",g.pemakaian_teoritis??"-",g.waste_qty??0,g.pemakaian_aktual??"-",g.variance_qty??0,Number((g.variance_pct||0).toFixed(2)),S,p,w,g.status||"NORMAL"])}),r.push([]),r.push(["TOTAL AKUMULASI","","","","","","","","","","","","","",i,t,n,""]);const a=l.utils.aoa_to_sheet(r);a["!cols"]=A(r),l.utils.book_append_sheet(o,a,"Audit Variansi Bahan");const m=`Laporan_Audit_Variansi_Bahan_${e.from}_sd_${e.to}.xlsx`;return l.writeFile(o,m),m}async function I({data:u=[],period:e,outletName:s="Semua Cabang",businessName:d="MOVA POS",userName:c="Administrator"}){const l=await f(),o=l.utils.book_new(),r=[["LAPORAN ANALISIS PROFITABILITAS MENU & HPP DINAMIS"],["MOVA POS — Evaluasi Margin & Moving Average Unit Economics"],[],["Bisnis / Brand",d,"","Waktu Cetak",new Date().toLocaleString("id-ID")],["Gudang / Cabang",s,"","Auditor PIC",c],["Periode Audit",`${e.from} s/d ${e.to}`,"","Basis HPP","Weighted Moving Average"],[],["No","Nama Menu","Kategori","Harga Jual (Rp)","HPP Teoritis Moving Avg (Rp)","Gross Margin (%)","Variance Cost / Porsi (Rp)","Adjusted HPP Aktual (Rp)","Adjusted Margin (%)","Penurunan Margin (pp)","Status Evaluasi"]];u.forEach((n,a)=>{const m=Number((n.gross_margin-n.adjusted_margin).toFixed(1)),g=m>5?"KRITIS (Margin Anjlok)":m>2?"PERHATIAN (Waspada)":"SEHAT (Normal)";r.push([a+1,n.menu?.name||"-",n.menu?.category||"-",Math.round(n.menu?.price||0),Math.round(n.hpp||0),Number((n.gross_margin||0).toFixed(1)),Math.round(n.variance_per_porsi||0),Math.round(n.adjusted_hpp||0),Number((n.adjusted_margin||0).toFixed(1)),m,g])});const i=l.utils.aoa_to_sheet(r);i["!cols"]=A(r),l.utils.book_append_sheet(o,i,"Profitabilitas Menu");const t=`Laporan_Profitabilitas_Menu_dan_HPP_${e.from}_sd_${e.to}.xlsx`;return l.writeFile(o,t),t}async function F({menuData:u=[],period:e,outletName:s="Semua Cabang",businessName:d="MOVA POS",userName:c="Administrator"}){const l=await f(),o=l.utils.book_new(),r=new Date().toLocaleString("id-ID"),i=u.reduce((m,g)=>m+(g.variance_value||0),0),t=[["LAPORAN RANKING VARIANCE PENYUMBANG MENU TERHADAP BAHAN BAKU"],["MOVA POS — Weighted Variance Contribution Analysis"],[],["Bisnis / Brand",d,"","Waktu Cetak",r],["Gudang / Cabang",s,"","Auditor PIC",c],["Periode Audit",`${e.from} s/d ${e.to}`,"","Total Variance",Math.round(i)],[],["No","Nama Menu","Kategori","Qty Terjual (Porsi)","Weighted % Variance","Nilai Variance (Rp)","Kontribusi terhadap Total Variance (%)"]];u.forEach((m,g)=>{const P=i!==0?Number((m.variance_value/i*100).toFixed(1)):0;t.push([g+1,m.menu?.name||"-",m.menu?.category||"-",m.qty_terjual||0,Number((m.weighted_pct||0).toFixed(2)),Math.round(m.variance_value||0),P])});const n=l.utils.aoa_to_sheet(t);n["!cols"]=A(t),l.utils.book_append_sheet(o,n,"Ranking Menu Variance");const a=`Laporan_Variance_Menu_${e.from}_sd_${e.to}.xlsx`;return l.writeFile(o,a),a}async function U({items:u=[],stats:e={},outletName:s="Semua Cabang",businessName:d="MOVA POS",userName:c="Administrator"}){const l=await f(),o=l.utils.book_new(),r=[["BUKU PIUTANG USAHA (AR CUSTOMER & AR MERCHANT)"],["MOVA POS — Customer Credit Ledger & Merchant Settlement (QRIS & E-Commerce)"],[],["Bisnis / Brand",d,"","Waktu Ekspor",new Date().toLocaleString("id-ID")],["Cabang / Outlet",s,"","Dicetak Oleh",c],["Total Tagihan Piutang",e.total_receivables||0,"","Sisa Piutang Berjalan",e.total_remaining||0],["Total Telah Dilunasi/Cair",e.total_paid||0,"","Piutang Overdue",e.total_overdue||0],["AR Merchant QRIS (Unsettled)",e.ar_qris_unsettled||0,"","AR E-Commerce (Unsettled)",e.ar_ecommerce_unsettled||0],[],["No","No Invoice / Ref","Kategori Piutang","Debitur / Merchant Channel","Tanggal Terbit","Jatuh Tempo","Cabang Outlet","Gross Amount (Rp)","Potongan MDR/Fee (Rp)","Net Amount (Rp)","Sudah Dibayar / Cair (Rp)","Sisa Piutang (Rp)","Status Settlement","Rekening Bank Settlement","Keterangan / Rincian"]];u.forEach((n,a)=>{let m="Kasbon Pelanggan";n.ar_type==="MERCHANT_QRIS"?m="AR Merchant QRIS":n.ar_type==="MERCHANT_ECOMMERCE"&&(m=`AR E-Commerce (${n.merchant_channel||"Online"})`);const g=n.ar_type&&n.ar_type!=="CUSTOMER"?`${n.merchant_channel||"MERCHANT"} - ${n.customer_name||""}`:n.customer_name||"-";r.push([a+1,n.receivable_no||n.order_number||"-",m,g,n.issue_date||"-",n.due_date||"-",n.outlet?.name||n.outlet_name||"-",Number(n.total_amount)||0,Number(n.mdr_fee)||0,Number(n.net_amount||n.total_amount)||0,Number(n.paid_amount)||0,Number(n.remaining_amount)||0,n.settlement_status?`${n.settlement_status} (${n.status||"-"})`:n.status_label||n.status||"-",n.settlement_bank||"-",n.notes||"-"])});const i=l.utils.aoa_to_sheet(r);i["!cols"]=A(r),l.utils.book_append_sheet(o,i,"Buku Piutang");const t=`Buku_Piutang_Usaha_${new Date().toISOString().slice(0,10)}.xlsx`;return l.writeFile(o,t),t}function y(u){if(!u)return"";const e=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"],s=d=>{if(!d)return"";const c=new Date(d);return isNaN(c.getTime())?d:`${String(c.getDate()).padStart(2,"0")} ${e[c.getMonth()]} ${c.getFullYear()}`};return`${s(u.from)} s/d ${s(u.to)}`}async function j({items:u=[],summary:e={},period:s,outletName:d="Semua Cabang",businessName:c="MOVA POS"}){const l=await f(),o=l.utils.book_new(),r=y(s),i=[[c],["LAPORAN PENJUALAN PER PRODUK"],[`Per ${r}`],[],["No.","Kode Produk","Nama Produk / Sub Produk","Qty Terjual","Qty Refund","Satuan","Modal","Harga","Disc","Total Nilai Terjual","Total Nilai Refund"]];u.forEach((a,m)=>{i.push([m+1,a.code||"-",a.name||"-",Number(a.qty_sold)||0,Number(a.qty_refund)||0,a.unit||"Cup",Number(a.cost_price)||0,Number(a.price)||0,Number(a.discount_amount)||0,Number(a.total_sales)||0,Number(a.total_refund)||0])}),i.push(["Total","","",Number(e.total_qty_sold)||0,Number(e.total_qty_refund)||0,"",Number(e.total_modal)||0,"",Number(e.total_discount)||0,Number(e.total_sales)||0,Number(e.total_refund)||0]);const t=l.utils.aoa_to_sheet(i);t["!cols"]=A(i),l.utils.book_append_sheet(o,t,"Penjualan per Produk");const n=`Laporan_Penjualan_Produk_${s.from}_sd_${s.to}.xlsx`;return l.writeFile(o,n),n}async function K({items:u=[],summary:e={},period:s,outletName:d="Semua Cabang",businessName:c="MOVA POS"}){const l=await f(),o=l.utils.book_new(),r=y(s),i=[[c],["LAPORAN PENUKARAN POIN"],[`Per ${r}`],[],[],[],["No","Tanggal","Tgl. Dibuat","Dibuat Oleh","Warehouse","Customer","Kasir","No.Transaksi","Penukaran","Qty","Nilai","Poin"]];u.forEach((a,m)=>{i.push([m+1,a.date||"-",a.created_at||"-",a.created_by||"-",a.warehouse||d,a.customer||"-",a.cashier||a.created_by||"-",a.order_number||"-",a.penukaran||"-",Number(a.qty)||1,Number(a.nilai)||0,Number(a.points_used)||0])}),i.push(["Total","","","","","","","","",Number(e.total_qty)||u.length,Number(e.total_nilai)||0,Number(e.total_points)||0]);const t=l.utils.aoa_to_sheet(i);t["!cols"]=A(i),l.utils.book_append_sheet(o,t,"Penukaran Poin");const n=`Laporan_Penukaran_Poin_${s.from}_sd_${s.to}.xlsx`;return l.writeFile(o,n),n}async function z({items:u=[],summary:e={},period:s,outletName:d="Semua Cabang",businessName:c="MOVA POS"}){const l=await f(),o=l.utils.book_new(),r=y(s),i=[[c],["LAPORAN PEMBAYARAN PENJUALAN"],[`Per ${r}`],[],["No.","Tanggal","Jam","Tgl. Dibuat","Dibuat Oleh","Warehouse","No.Penjualan","No.Pembayaran","Customer","Jenis Bayar","Disetor Ke","Total Transaksi","Bayar","Piutang","Kasir"]];u.forEach((a,m)=>{i.push([m+1,a.date||"-",a.time||"-",a.created_at||"-",a.created_by||"-",a.warehouse||d,a.order_number||"-",a.payment_number||"",a.customer||"-",a.payment_method||"-",a.deposit_account||"-",Number(a.total_transaction)||0,Number(a.paid_amount)||0,Number(a.receivable_amount)||0,a.cashier||a.created_by||"-"])}),i.push(["Total","","","","","","","","","","",Number(e.total_transaction)||0,Number(e.total_paid)||0,Number(e.total_receivable)||0,""]);const t=l.utils.aoa_to_sheet(i);t["!cols"]=A(i),l.utils.book_append_sheet(o,t,"Pembayaran Penjualan");const n=`Laporan_Pembayaran_Penjualan_${s.from}_sd_${s.to}.xlsx`;return l.writeFile(o,n),n}async function H({items:u=[],summary:e={},period:s,outletName:d="Semua Cabang",businessName:c="MOVA POS"}){const l=await f(),o=l.utils.book_new(),r=y(s),i=[[c],["Laporan Transaksi Penjualan"],[`Per ${r}`],["No.","Tgl","Tgl. Dibuat","Dibuat Oleh","No.Ref","Customer","Promo","Jenis Bayar","Setor Ke","Kode Produk","Produk/Sub Produk","Kategori Produk","Sales Type","HPP","Harga Jual","","","","","Disc Tambahan","Disc Customer","PPN","Src.Charge","Pengiriman","Penjualan","Piutang","Profit","Kasir","Cetak Nota"],["","","","","","","","","","","","","","(Per 1 Qty)","QTY","Satuan","Harga","Disc","Subtotal","","","","","","","","","",""]];u.forEach((a,m)=>{i.push([m+1,a.date||"-",a.created_at||"-",a.created_by||"-",a.order_number||"-",a.customer||"Walk-in Customer",a.promo||"",a.payment_method||"-",a.deposit_account||"-",a.product_code||"-",a.product_name||"-",a.product_category||"KOPI",a.sales_type||"Dine-in",Number(a.hpp)||0,Number(a.qty)||0,a.unit||"Cup",Number(a.price)||0,Number(a.discount)||0,Number(a.subtotal)||0,Number(a.discount_extra)||0,Number(a.discount_customer)||0,Number(a.tax)||0,Number(a.service_charge)||0,Number(a.shipping)||0,Number(a.total_sale)||0,Number(a.receivable)||0,Number(a.profit)||0,a.cashier||a.created_by||"-",Number(a.receipt_printed)||0])}),i.push(["Total","","","","","","","","","","","","","",Number(e.total_qty)||0,"","","","",Number(e.total_discount)||0,0,0,0,0,Number(e.total_sale)||0,Number(e.total_receivable)||0,Number(e.total_profit)||0,"",""]);const t=l.utils.aoa_to_sheet(i);t["!cols"]=A(i),l.utils.book_append_sheet(o,t,"Transaksi Penjualan");const n=`Laporan_Transaksi_Penjualan_${s.from}_sd_${s.to}.xlsx`;return l.writeFile(o,n),n}async function V({items:u=[],summary:e={},period:s,outletName:d="Semua Cabang",businessName:c="MOVA POS"}){const l=await f(),o=l.utils.book_new(),r=y(s),i=[[c],["LAPORAN DAFTAR PENJUALAN PER CUSTOMER"],[`Per ${r}`],[],["No.","Tanggal","Kode Customer","Customer","Group Customer","No.Ref","Produk","Qty","Satuan","Harga Satuan","Disc","PPN","Src.Charge","Pengiriman","Total","Total Bayar","Jenis Bayar","Piutang","Kasir"]];u.forEach((a,m)=>{i.push([m+1,a.date||"-",a.customer_code||"-",a.customer_name||"Walk-in Customer",a.customer_group||"Reguler",a.order_number||"-",a.product_name||"-",Number(a.qty)||0,a.unit||"Cup",Number(a.price)||0,Number(a.discount)||0,Number(a.tax)||0,Number(a.service_charge)||0,Number(a.shipping)||0,Number(a.total)||0,Number(a.total_paid)||0,a.payment_method||"-",Number(a.receivable)||0,a.cashier||"-"])}),i.push(["Total Penjualan Semua Customer","","","","","","",Number(e.total_qty)||0,"","","","","","",Number(e.total_amount)||0,Number(e.total_paid)||0,"",Number(e.total_receivable)||0,""]);const t=l.utils.aoa_to_sheet(i);t["!cols"]=A(i),l.utils.book_append_sheet(o,t,"Penjualan per Customer");const n=`Laporan_Penjualan_Customer_${s.from}_sd_${s.to}.xlsx`;return l.writeFile(o,n),n}async function W({items:u=[],summary:e={},period:s,outletName:d="Semua Cabang",businessName:c="MOVA POS"}){const l=await f(),o=l.utils.book_new(),r=y(s),i=[[c],["LAPORAN WAKTU TERAMAI"],[`Per ${r}`],[],["No.","Waktu","Total Penjualan (Rp)","Rata-rata Penjualan (Rp)","Penjualan (%)","Transaksi","Transaksi (%)","Produk","Produk (%)","Tamu","Tamu (%)"]];u.forEach((a,m)=>{i.push([m+1,a.waktu||"",Number(a.total_penjualan)||0,Number(a.avg_penjualan)||0,Number(a.penjualan_pct)||0,Number(a.transaksi)||0,Number(a.transaksi_pct)||0,Number(a.produk)||0,Number(a.produk_pct)||0,Number(a.tamu)||0,Number(a.tamu_pct)||0])});const t=l.utils.aoa_to_sheet(i);t["!cols"]=A(i),l.utils.book_append_sheet(o,t,"Waktu Teramai");const n=`Laporan_Waktu_Teramai_${s.from}_sd_${s.to}.xlsx`;return l.writeFile(o,n),n}async function J({items:u=[],summary:e={},period:s,outletName:d="Semua Cabang",businessName:c="MOVA POS"}){const l=await f(),o=l.utils.book_new(),r=y(s),i=[[c],["LAPORAN BUKU PIUTANG USAHA (AR CUSTOMER & AR MERCHANT)"],[`Per ${r}`],[],["No.","Kategori AR","Debitur / Merchant Channel","Tanggal","Jam","No.Penjualan / Order","Gross Piutang (Rp)","Potongan MDR/Komisi (Rp)","Net Piutang (Rp)","Dibayar / Dicairkan (Rp)","Sisa Piutang (Rp)","Status Settlement","Usia Piutang","Jatuh Tempo"]];u.forEach((a,m)=>{let g="Kasbon Pelanggan";a.ar_type==="MERCHANT_QRIS"?g="AR Merchant QRIS":a.ar_type==="MERCHANT_ECOMMERCE"&&(g=`AR E-Commerce (${a.merchant_channel||"Online"})`),i.push([m+1,g,a.customer||a.merchant_channel||"-",a.tanggal||"-",a.jam||"-",a.no_penjualan||"-",Number(a.piutang)||0,Number(a.mdr_fee)||0,Number(a.net_amount||a.piutang)||0,Number(a.dibayar)||0,Number(a.sisa_piutang)||0,a.settlement_status||(a.sisa_piutang<=0?"LUNAS":"BELUM LUNAS"),a.usia_piutang||"0 Hari",a.jatuh_tempo||"-"])}),i.push(["Total Piutang","","","","","",Number(e.total_gross_piutang||e.total_piutang)||0,Number(e.total_mdr_fee)||0,Number(e.total_net_piutang)||0,Number(e.total_dibayar)||0,Number(e.total_sisa_piutang)||0,"","",""]);const t=l.utils.aoa_to_sheet(i);t["!cols"]=A(i),l.utils.book_append_sheet(o,t,"Buku Piutang");const n=`Laporan_Buku_Piutang_${s.from}_sd_${s.to}.xlsx`;return l.writeFile(o,n),n}async function X({items:u=[],summary:e={},period:s,outletName:d="Semua Cabang",businessName:c="MOVA POS"}){const l=await f(),o=l.utils.book_new(),r=y(s),i=[[c],["LAPORAN PROMO"],[`Per ${r}`],[],["No.","Tanggal","Promo","Jenis","Jumlah Transaksi","Nilai (Rp)"]];u.forEach((a,m)=>{i.push([m+1,a.tanggal||"-",a.promo||"-",a.jenis||"-",Number(a.jumlah_transaksi)||0,Number(a.nilai)||0])}),i.push(["Total Promo","","","",Number(e.total_promo)||0,Number(e.total_nilai)||0]),i.push(["Total Penjualan Promo","","","","",Number(e.total_penjualan_promo)||0]);const t=l.utils.aoa_to_sheet(i);t["!cols"]=A(i),l.utils.book_append_sheet(o,t,"Laporan Promo");const n=`Laporan_Promo_${s.from}_sd_${s.to}.xlsx`;return l.writeFile(o,n),n}async function q({rows:u=[],items:e=[],period:s={},outletName:d="Semua Cabang",businessName:c="URBAE CAFFEINE",summary:l={}}){const o=e.length>0?e:u,r=await $(()=>import("./vendor-exceljs-BPsxf_ah.js").then(_=>O(_.t(),1)),__vite__mapDeps([2,1])),i=new(r.default||r).Workbook;i.creator=c,i.created=new Date;const t=i.addWorksheet("Laporan Hutang Supplier",{views:[{showGridLines:!0}]});t.getCell("B2").value="LAPORAN HUTANG SUPPLIER",t.getCell("B2").font={name:"Arial",size:14,bold:!0},t.getCell("B2").alignment={horizontal:"center",vertical:"middle"},t.mergeCells("B2:K2");const n=typeof s=="string"?s:s.from_formatted&&s.to_formatted?`Per ${s.from_formatted} s/d ${s.to_formatted}`:s.from&&s.to?`Per ${s.from} s/d ${s.to}`:"Semua Periode";t.getCell("B3").value=n,t.getCell("B3").font={name:"Arial",size:11,italic:!0},t.getCell("B3").alignment={horizontal:"center",vertical:"middle"},t.mergeCells("B3:K3");const a=t.getRow(5);a.values=["No.","Supplier/Tanggal","Tgl. Dibuat","Dibuat Oleh","No.Pembelian","No.Bayar","Jatuh Tempo","Hutang","Dibayar","Sisa Hutang","Total Hutang"],a.height=24;const m={top:{style:"thin",color:{argb:"FF000000"}},left:{style:"thin",color:{argb:"FF000000"}},bottom:{style:"thin",color:{argb:"FF000000"}},right:{style:"thin",color:{argb:"FF000000"}}};a.eachCell(_=>{_.font={name:"Arial",size:10,bold:!0},_.alignment={horizontal:"center",vertical:"middle"},_.border=m});let g=6;o.forEach((_,b)=>{const R=t.getRow(g++);R.values=[b+1,_.supplier_tanggal||(_.supplier_name?`${_.supplier_name} - ${_.tgl_dibuat_fmt||_.tgl_dibuat}`:"-"),_.tgl_dibuat_fmt||_.tgl_dibuat||"-",_.dibuat_oleh||"Admin",_.no_pembelian||"-",_.no_bayar||"-",_.jatuh_tempo_fmt||_.jatuh_tempo||"-",Number(_.hutang)||0,Number(_.dibayar)||0,Number(_.sisa_hutang)||0,Number(_.total_hutang)||0],R.height=20,R.eachCell((T,L)=>{T.border=m,T.font={name:"Arial",size:10},L===1?T.alignment={horizontal:"center",vertical:"middle"}:[3,5,6,7].includes(L)?T.alignment={horizontal:"center",vertical:"middle"}:L>=8?(T.alignment={horizontal:"right",vertical:"middle"},T.numFmt="#,##0.00"):T.alignment={horizontal:"left",vertical:"middle"}})});const P=t.getRow(g);P.height=22;for(let _=1;_<=11;_++)P.getCell(_).border=m,P.getCell(_).font={name:"Arial",size:10,bold:!0};t.mergeCells(`A${g}:H${g}`);const S=t.getCell(`A${g}`);S.value="Total Utang",S.alignment={horizontal:"right",vertical:"middle"},S.font={name:"Arial",size:10,bold:!0};const p=P.getCell(9);p.value=Number(l.total_dibayar??0),p.alignment={horizontal:"right",vertical:"middle"},p.numFmt="#,##0.00",p.font={name:"Arial",size:10,bold:!0};const w=P.getCell(10);w.value=Number(l.total_sisa_hutang??0),w.alignment={horizontal:"right",vertical:"middle"},w.numFmt="#,##0.00",w.font={name:"Arial",size:10,bold:!0};const k=P.getCell(11);k.value=Number(l.total_hutang??0),k.alignment={horizontal:"right",vertical:"middle"},k.numFmt="#,##0.00",k.font={name:"Arial",size:10,bold:!0},t.getColumn(1).width=6,t.getColumn(2).width=32,t.getColumn(3).width=14,t.getColumn(4).width=16,t.getColumn(5).width=20,t.getColumn(6).width=24,t.getColumn(7).width=14,t.getColumn(8).width=16,t.getColumn(9).width=16,t.getColumn(10).width=16,t.getColumn(11).width=16;const E=`Laporan_Hutang_Supplier_${s.from||"all"}_sd_${s.to||"all"}.xlsx`,C=await i.xlsx.writeBuffer(),x=new Blob([C],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),h=window.URL.createObjectURL(x),N=document.createElement("a");return N.href=h,N.download=E,document.body.appendChild(N),N.click(),document.body.removeChild(N),window.URL.revokeObjectURL(h),E}function G({rows:u=[],period:e={},outletName:s="Semua Cabang",summary:d={}}){const c=e.from_formatted&&e.to_formatted?`Per ${e.from_formatted} s/d ${e.to_formatted}`:e.from&&e.to?`Per ${e.from} s/d ${e.to}`:"Semua Periode",l=window.open("","_blank");if(!l){alert("Pop-up browser diblokir. Harap izinkan pop-up untuk mencetak laporan.");return}const o=t=>Number(t||0).toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2}),r=u.map((t,n)=>`
    <tr>
      <td style="text-align:center;">${n+1}</td>
      <td>${t.supplier_tanggal||t.supplier_name||"-"}</td>
      <td style="text-align:center;">${t.tgl_dibuat_fmt||t.tgl_dibuat||"-"}</td>
      <td>${t.dibuat_oleh||"Admin"}</td>
      <td style="text-align:center;">${t.no_pembelian||"-"}</td>
      <td style="text-align:center;">${t.no_bayar||"-"}</td>
      <td style="text-align:center;">${t.jatuh_tempo_fmt||t.jatuh_tempo||"-"}</td>
      <td style="text-align:right;">${o(t.hutang)}</td>
      <td style="text-align:right;">${o(t.dibayar)}</td>
      <td style="text-align:right;">${o(t.sisa_hutang)}</td>
      <td style="text-align:right;">${o(t.total_hutang)}</td>
    </tr>
  `).join(""),i=`
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
      <div class="subtitle">${c}</div>
    </div>
    <div class="meta">
      <div><strong>Outlet/Cabang:</strong> ${s}</div>
      <div><strong>Dicetak Pada:</strong> ${new Date().toLocaleString("id-ID")}</div>
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
        ${r||'<tr><td colspan="11" style="text-align:center; padding:15px;">Tidak ada data hutang untuk periode ini</td></tr>'}
      </tbody>
      <tfoot>
        <tr class="footer-total">
          <td colspan="8" style="text-align: right; padding-right: 12px;">Total Utang</td>
          <td style="text-align: right;">${o(d.total_dibayar)}</td>
          <td style="text-align: right;">${o(d.total_sisa_hutang)}</td>
          <td style="text-align: right;">${o(d.total_hutang)}</td>
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
  `;l.document.open(),l.document.write(i),l.document.close()}async function Q({data:u={},period:e={},businessName:s="MOVA POS",outletName:d="Semua Cabang"}){const c=await $(()=>import("./vendor-exceljs-BPsxf_ah.js").then(h=>O(h.t(),1)),__vite__mapDeps([2,1])),l=new(c.default||c).Workbook;l.creator=s,l.created=new Date;const o=l.addWorksheet("Laporan Neraca",{views:[{showGridLines:!0}]}),r=e.from_formatted&&e.to_formatted?`Per ${e.from_formatted} s/d ${e.to_formatted}`:e.from&&e.to?`Per ${e.from} s/d ${e.to}`:"Semua Periode";o.mergeCells("B1:D1");const i=o.getCell("B1");i.value="LAPORAN NERACA",i.font={name:"Arial",size:13,bold:!0},i.alignment={horizontal:"center",vertical:"middle"},o.getRow(1).height=22,o.mergeCells("B2:E2");const t=o.getCell("B2");t.value=r,t.font={name:"Arial",size:10,italic:!0},t.alignment={horizontal:"left",vertical:"middle"},o.getRow(2).height=18;let n=3;const a=h=>{const N=o.getRow(n++);N.getCell(2).value=h,N.getCell(2).font={name:"Arial",size:10,bold:!0},N.height=18},m=(h,N,_)=>{const b=o.getRow(n++);b.getCell(2).value=h||"",b.getCell(2).font={name:"Arial",size:10},b.getCell(2).alignment={horizontal:"left",vertical:"middle"},b.getCell(3).value=N||"",b.getCell(3).font={name:"Arial",size:10},b.getCell(3).alignment={horizontal:"left",vertical:"middle"},b.getCell(4).value=Number(_)||0,b.getCell(4).font={name:"Arial",size:10},b.getCell(4).alignment={horizontal:"right",vertical:"middle"},b.getCell(4).numFmt="#,##0",b.height=18},g=(h,N)=>{const _=o.getRow(n++);_.getCell(2).value=h,_.getCell(2).font={name:"Arial",size:10,bold:!0},o.mergeCells(`B${n-1}:C${n-1}`),_.getCell(4).value=Number(N)||0,_.getCell(4).font={name:"Arial",size:10,bold:!0},_.getCell(4).alignment={horizontal:"right",vertical:"middle"},_.getCell(4).numFmt="#,##0",_.height=18};a("Aset Lancar"),(u.current_assets?.accounts||[]).forEach(h=>{m(h.code,h.name,h.amount)}),g("Jumlah Aset Lancar",u.current_assets?.subtotal??0),a("Aset Tetap");const P=u.fixed_assets?.accounts||[];P.length>0?P.forEach(h=>{m(h.code,h.name,h.amount)}):m("","Depresiasi & Amortisasi",0),g("Jumlah Aset Tetap",u.fixed_assets?.subtotal??0),a("Liabilitas");const S=u.liabilities?.accounts||[];S.length>0&&S.some(h=>h.amount!==0)&&S.forEach(h=>{m(h.code,h.name,h.amount)}),g("Jumlah Hutang",u.liabilities?.subtotal??0),a("Modal"),(u.equity?.accounts||[]).forEach(h=>{m(h.code,h.name,h.amount)}),g("Jumlah Modal",u.equity?.subtotal??0),n++;const p=o.getRow(n);p.height=22,p.getCell(2).value="Jumlah Aset",p.getCell(2).font={name:"Arial",size:11,bold:!0},o.mergeCells(`B${n}:C${n}`),p.getCell(4).value=Number(u.total_assets?.amount??0),p.getCell(4).font={name:"Arial",size:11,bold:!0},p.getCell(4).alignment={horizontal:"right",vertical:"middle"},p.getCell(4).numFmt="#,##0",p.getCell(6).value="Jumlah Kewajiban dan Modal",p.getCell(6).font={name:"Arial",size:11,bold:!0},p.getCell(6).alignment={horizontal:"right",vertical:"middle"},p.getCell(7).value=Number(u.total_liabilities_and_equity?.amount??0),p.getCell(7).font={name:"Arial",size:11,bold:!0},p.getCell(7).alignment={horizontal:"right",vertical:"middle"},p.getCell(7).numFmt="#,##0",o.getColumn(1).width=4,o.getColumn(2).width=14,o.getColumn(3).width=32,o.getColumn(4).width=18,o.getColumn(5).width=6,o.getColumn(6).width=30,o.getColumn(7).width=18;const w=`Laporan_Neraca_${e.from||"all"}_sd_${e.to||"all"}.xlsx`,k=await l.xlsx.writeBuffer(),E=new Blob([k],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),C=window.URL.createObjectURL(E),x=document.createElement("a");return x.href=C,x.download=w,document.body.appendChild(x),x.click(),document.body.removeChild(x),window.URL.revokeObjectURL(C),w}function Y({data:u={},period:e={},businessName:s="MOVA POS",outletName:d="Semua Cabang"}){const c=e.from_formatted&&e.to_formatted?`Per ${e.from_formatted} s/d ${e.to_formatted}`:e.from&&e.to?`Per ${e.from} s/d ${e.to}`:"Semua Periode",l=window.open("","_blank");if(!l){alert("Pop-up browser diblokir. Harap izinkan pop-up untuk mencetak laporan.");return}const o=t=>Number(t||0).toLocaleString("id-ID",{minimumFractionDigits:0,maximumFractionDigits:0}),r=(t=[])=>t.map(n=>`
      <tr>
        <td style="width: 120px; padding: 4px 8px; color: #475569;">${n.code||""}</td>
        <td style="padding: 4px 8px;">${n.name||""}</td>
        <td style="text-align: right; padding: 4px 8px; font-variant-numeric: tabular-nums;">${o(n.amount)}</td>
      </tr>
    `).join(""),i=`
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
      <div class="subtitle">${c}</div>
    </div>
    <div class="meta">
      <div><strong>Bisnis:</strong> ${s} | <strong>Cabang:</strong> ${d}</div>
      <div><strong>Dicetak:</strong> ${new Date().toLocaleString("id-ID")}</div>
    </div>

    <!-- ASET LANCAR -->
    <table>
      <thead>
        <tr>
          <th colspan="3" class="section-title" style="text-align: left;">Aset Lancar</th>
        </tr>
      </thead>
      <tbody>
        ${r(u.current_assets?.accounts)}
      </tbody>
      <tfoot>
        <tr class="subtotal-row">
          <td colspan="2">Jumlah Aset Lancar</td>
          <td style="text-align: right;">${o(u.current_assets?.subtotal)}</td>
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
        ${u.fixed_assets?.accounts?.length?r(u.fixed_assets?.accounts):'<tr><td style="color:#64748b;">-</td><td>Depresiasi & Amortisasi</td><td style="text-align:right;">0</td></tr>'}
      </tbody>
      <tfoot>
        <tr class="subtotal-row">
          <td colspan="2">Jumlah Aset Tetap</td>
          <td style="text-align: right;">${o(u.fixed_assets?.subtotal)}</td>
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
        ${u.liabilities?.accounts?.length?r(u.liabilities?.accounts):""}
      </tbody>
      <tfoot>
        <tr class="subtotal-row">
          <td colspan="2">Jumlah Hutang</td>
          <td style="text-align: right;">${o(u.liabilities?.subtotal)}</td>
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
        ${r(u.equity?.accounts)}
      </tbody>
      <tfoot>
        <tr class="subtotal-row">
          <td colspan="2">Jumlah Modal</td>
          <td style="text-align: right;">${o(u.equity?.subtotal)}</td>
        </tr>
      </tfoot>
    </table>

    <!-- GRAND TOTAL -->
    <div class="grand-total-box">
      <div>Jumlah Aset: <span style="margin-left: 20px;">Rp ${o(u.total_assets?.amount)}</span></div>
      <div>Jumlah Kewajiban dan Modal: <span style="margin-left: 20px;">Rp ${o(u.total_liabilities_and_equity?.amount)}</span></div>
    </div>

    <script>
      window.onload = function() {
        window.print();
      };
    <\/script>
  </body>
  </html>
  `;l.document.open(),l.document.write(i),l.document.close()}async function Z({businessName:u="URBAE CAFFEINE",period:e="",items:s=[],summary:d={}}){const c=await f(),l=c.utils.book_new(),o=t=>(t||0).toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2}),r=[[u],["Laporan Transaksi Pembelian"],[e||"Per Periode Terpilih"],[],["No.","Tgl","Tgl.Dibuat","Dibuat Oleh","No.Ref","Warehouse","Supplier","Status Terima","Kode Produk","Produk","Harga Beli","","","","","","","Disc Tambahan","PPN","Pengiriman","Pembelian","Dibayar","Utang"],["","","","","","","","","","","QTY","Satuan","QTY Terkecil","Satuan Terkecil","Harga","Disc","Subtotal","","","","","",""]];s.forEach((t,n)=>{r.push([t.no||n+1,t.tgl||"",t.tgl_dibuat||"",t.dibuat_oleh||"",t.no_ref||"",t.warehouse||"",t.supplier||"",t.status_terima||"Diterima",t.kode_produk||"",t.produk||"",t.qty??0,t.satuan||"",t.qty_terkecil??0,t.satuan_terkecil||"",o(t.harga),o(t.disc||0),o(t.subtotal||t.pembelian),o(t.disc_tambahan||0),o(t.ppn||0),o(t.pengiriman||0),o(t.pembelian),o(t.dibayar),o(t.utang)])}),r.push(["Total","","","","","","","","","","","","","","","","",o(d.total_disc_tambahan||0),o(d.total_ppn||0),o(d.total_pengiriman||0),o(d.total_pembelian||0),o(d.total_dibayar||0),o(d.total_utang||0)]);const i=c.utils.aoa_to_sheet(r);i["!cols"]=A(r),c.utils.book_append_sheet(l,i,"Transaksi Pembelian"),c.writeFile(l,`Laporan_Transaksi_Pembelian_${new Date().toISOString().slice(0,10)}.xlsx`)}async function tt({businessName:u="URBAE CAFFEINE",period:e="",items:s=[],summary:d={}}){const c=await f(),l=c.utils.book_new(),o=t=>(t||0).toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2}),r=[[u],["LAPORAN PEMBELIAN PER PRODUK"],[e||"Per Periode Terpilih"],[],["No.","Kode Produk","Nama Produk","Qty Beli","Qty Refund","Satuan","Harga","Disc","Total Nilai Beli","Total Nilai Refund"]];s.forEach((t,n)=>{r.push([t.no||n+1,t.kode_produk||"",t.nama_produk||"",t.qty_beli??0,t.qty_refund??0,t.satuan||"",o(t.harga),o(t.disc||0),o(t.total_nilai_beli),o(t.total_nilai_refund||0)])}),r.push(["Total","","","","","","","",o(d.total_nilai_beli||0),o(d.total_nilai_refund||0)]);const i=c.utils.aoa_to_sheet(r);i["!cols"]=A(r),c.utils.book_append_sheet(l,i,"Pembelian per Produk"),c.writeFile(l,`Laporan_Pembelian_Per_Produk_${new Date().toISOString().slice(0,10)}.xlsx`)}async function at({businessName:u="URBAE CAFFEINE",period:e="",items:s=[],summary:d={}}){const c=await f(),l=c.utils.book_new(),o=t=>(t||0).toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2}),r=[[u],["LAPORAN DAFTAR PEMBELIAN PER SUPPLIER"],[e||"Per Periode Terpilih"],[],["No.","Supplier/Kode Produk","Tgl.Dibuat","Dibuat Oleh","No.Ref","Pembelian","Disc","Pajak","Pengiriman","Total"]];s.forEach((t,n)=>{r.push([t.no||n+1,t.supplier||t.supplier_kode_produk||"",t.tgl_dibuat||"",t.dibuat_oleh||"",t.no_ref||"",o(t.pembelian),o(t.disc||0),o(t.pajak||0),o(t.pengiriman||0),o(t.total)])}),r.push(["Total Pembelian Dari","","","","","","",o(d.total_pembelian||0),"",""]);const i=c.utils.aoa_to_sheet(r);i["!cols"]=A(r),c.utils.book_append_sheet(l,i,"Pembelian per Supplier"),c.writeFile(l,`Laporan_Pembelian_Per_Supplier_${new Date().toISOString().slice(0,10)}.xlsx`)}async function et({businessName:u="URBAE CAFFEINE",period:e="",items:s=[],summary:d={}}){const c=await f(),l=c.utils.book_new(),o=t=>(t||0).toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2}),r=[[u],["LAPORAN PENGIRIMAN PEMBELIAN"],[e||"Per Periode Terpilih"],[],["No.","Supplier/Tanggal","Tgl. Dibuat","Dibuat Oleh","No.Ref","Kode Produk","Nama Produk","Qty","Satuan","Jumlah"]];s.forEach((t,n)=>{r.push([t.no||n+1,t.supplier_tanggal||t.supplier_name||"",t.tgl_dibuat||"",t.dibuat_oleh||"",t.no_ref||"",t.kode_produk||"",t.nama_produk||"",t.qty??0,t.satuan||"",o(t.jumlah)])});const i=c.utils.aoa_to_sheet(r);i["!cols"]=A(r),c.utils.book_append_sheet(l,i,"Pengiriman Pembelian"),c.writeFile(l,`Laporan_Pengiriman_Pembelian_${new Date().toISOString().slice(0,10)}.xlsx`)}export{q as _,K as a,Y as b,et as c,at as d,U as f,H as g,z as h,W as i,Z as l,j as m,J as n,I as o,V as p,v as r,X as s,Q as t,tt as u,B as v,G as x,F as y};
