const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/vendor-xlsx-LK-29t-I.js","assets/rolldown-runtime-kjsH4l9N.js","assets/vendor-exceljs-BPsxf_ah.js"])))=>i.map(i=>d[i]);
import{i as O}from"./rolldown-runtime-kjsH4l9N.js";import{d as $}from"./vendor-router-CW5hKwT5.js";async function P(){return await $(()=>import("./vendor-xlsx-LK-29t-I.js").then(r=>r.t),__vite__mapDeps([0,1]))}function f(r){const a=[];return r.forEach(d=>{(d||[]).forEach((g,c)=>{const e=g!=null?String(g).length:0;a[c]=Math.max(a[c]||10,Math.min(e+3,50))})}),a.map(d=>({wch:d}))}async function B({data:r,varData:a=[],varMenuData:d=[],period:g,outletName:c="Semua Cabang",businessName:e="MOVA POS",userName:n="Administrator"}){const l=await P(),s=l.utils.book_new(),i=new Date().toLocaleString("id-ID"),{status_counts:o={},total_variance_value:t=0,total_variance_loss:m=0,total_waste_value:h=0,total_combined_loss:N=0,top_waste:w=[]}=r||{},_=[["LAPORAN EKSEKUTIF COST CONTROL & ANALITIK VARIANSI PERSADAAN"],["MOVA POS — Advanced F&B Cost Management System"],[],["Bisnis / Brand",e],["Gudang / Outlet",c],["Periode Audit",`${g.from} s/d ${g.to}`],["Waktu Export",i],["Dicetak Oleh",n],["Target Laporan","Finance / Akuntan, Mitra Pemilik Cabang & Investor"],[],["=== INDIKATOR KUNCI COST CONTROL & RESEP ==="],["Metrik Analisis","Jumlah / Nilai","Satuan","Keterangan Akuntansi"],["Bahan Berstatus Normal",o.NORMAL??0,"Item Bahan","Pemakaian dalam batas wajar resep"],["Bahan Berstatus Waspada",o.WASPADA??0,"Item Bahan","Perlu evaluasi porsi & takaran koki"],["Bahan Berstatus Tidak Wajar",o["TIDAK WAJAR"]??0,"Item Bahan","Wajib investigasi kehilangan/kebocoran"],["Total Kerugian Waste Resmi",h,"Rupiah (IDR)","Limbah basi, gosong, sortir diakui dapur"],["Total Selisih Tak Terjelaskan (Shrinkage)",m,"Rupiah (IDR)","Anomali selisih fisik vs sistem"],["Total Kerugian F&B Bersih",N,"Rupiah (IDR)","Akumulasi kerugian waste + selisih murni"],[],["Catatan Rekomendasi:","Lakukan audit berkala pada item berstatus TIDAK WAJAR dan perketat standar pencatatan waste harian."]],S=l.utils.aoa_to_sheet(_);S["!cols"]=f(_),l.utils.book_append_sheet(s,S,"Ringkasan Eksekutif");const y=[["DAFTAR BAHAN BAKU DENGAN ANOMALI / SELISIH TERTINGGI"],["Cabang:",c,"Periode:",`${g.from} s/d ${g.to}`],[],["No","Kode Bahan","Nama Bahan Baku","Kategori","Satuan Pakai","% Net Variance","Nilai Selisih (Rp)","Status Audit"]];a.forEach((b,C)=>{y.push([C+1,b.ingredient?.code||"-",b.ingredient?.name||"-",b.ingredient?.category||"-",b.ingredient?.unit_pakai||"-",Number((b.variance_pct||0).toFixed(2)),Math.round(b.variance_value||0),b.status||"NORMAL"])});const R=l.utils.aoa_to_sheet(y);R["!cols"]=f(y),l.utils.book_append_sheet(s,R,"Top Selisih Bahan");const k=[["MENU PENYUMBANG VARIANSI TERTINGGI"],["Cabang:",c,"Periode:",`${g.from} s/d ${g.to}`],[],["No","Nama Menu","Kategori","Qty Terjual (Porsi)","Weighted %","Nilai Variance (Rp)"]];d.forEach((b,C)=>{k.push([C+1,b.menu?.name||"-",b.menu?.category||"-",b.qty_terjual||0,Number((b.weighted_pct||0).toFixed(2)),Math.round(b.variance_value||0)])});const A=l.utils.aoa_to_sheet(k);A["!cols"]=f(k),l.utils.book_append_sheet(s,A,"Top Menu Variance");const u=[["RINCIAN KERUSAKAN & LIMBAH BAHAN BAKU (DOCUMENTED WASTE)"],["Cabang:",c,"Periode:",`${g.from} s/d ${g.to}`],[],["No","Kode Bahan","Nama Bahan Baku","Total Qty Rusak","Satuan","Nilai Kerugian (Rp)","Catatan Kejadian / Alasan"]];w.forEach((b,C)=>{const L=(b.waste_records||[]).map(v=>`${v.waste_reason||"Lainnya"}: ${v.qty}`).join("; ");u.push([C+1,b.ingredient?.code||"-",b.ingredient?.name||"-",b.waste_qty||b.waste||0,b.ingredient?.unit_pakai||"-",Math.round(b.waste_value||0),L||"Pencatatan limbah dapur"])});const x=l.utils.aoa_to_sheet(u);x["!cols"]=f(u),l.utils.book_append_sheet(s,x,"Limbah & Kerusakan");const p=`Laporan_Eksekutif_Cost_Control_${g.from}_sd_${g.to}.xlsx`;return l.writeFile(s,p),p}async function D({varData:r=[],period:a,outletName:d="Semua Cabang",businessName:g="MOVA POS",userName:c="Administrator"}){const e=await P(),n=e.utils.book_new(),l=[["LAPORAN AUDIT VARIANSI PERSADAAN BAHAN BAKU (COST CONTROL AUDIT)"],["MOVA POS — Metode Penilaian PSAK 14 Weighted Moving Average"],[],["Bisnis / Brand",g,"","Waktu Cetak",new Date().toLocaleString("id-ID")],["Gudang / Cabang",d,"","Auditor PIC",c],["Periode Audit",`${a.from} s/d ${a.to}`,"","Standar","PSAK 14 Moving Average"],[],["No","Kode","Nama Bahan Baku","Kategori","Satuan Beli","Satuan Pakai","Harga Pokok Rata-Rata (Rp)","Stok Awal (Pakai)","Masuk (Beli/Transfer)","Pemakaian Teoritis POS","Waste Resmi Tercatat","Pemakaian Aktual","Selisih Net (Pakai)","Selisih %","Nilai Total Selisih (Rp)","Kerugian Waste (Rp)","Selisih Tak Terjelaskan (Rp)","Status Audit"]];let s=0,i=0,o=0;r.forEach((h,N)=>{const w=Math.round(h.variance_value||0),_=Math.round(h.waste_value||0),S=Math.round(h.unaccounted_value||0);s+=w,i+=_,o+=S,l.push([N+1,h.ingredient?.code||"-",h.ingredient?.name||"-",h.ingredient?.category||"-",h.ingredient?.unit_beli||"-",h.ingredient?.unit_pakai||"-",Math.round(h.ingredient?.harga||0),h.stok_awal??"-",h.total_masuk??"-",h.pemakaian_teoritis??"-",h.waste_qty??0,h.pemakaian_aktual??"-",h.variance_qty??0,Number((h.variance_pct||0).toFixed(2)),w,_,S,h.status||"NORMAL"])}),l.push([]),l.push(["TOTAL AKUMULASI","","","","","","","","","","","","","",s,i,o,""]);const t=e.utils.aoa_to_sheet(l);t["!cols"]=f(l),e.utils.book_append_sheet(n,t,"Audit Variansi Bahan");const m=`Laporan_Audit_Variansi_Bahan_${a.from}_sd_${a.to}.xlsx`;return e.writeFile(n,m),m}async function I({data:r=[],period:a,outletName:d="Semua Cabang",businessName:g="MOVA POS",userName:c="Administrator"}){const e=await P(),n=e.utils.book_new(),l=[["LAPORAN ANALISIS PROFITABILITAS MENU & HPP DINAMIS"],["MOVA POS — Evaluasi Margin & Moving Average Unit Economics"],[],["Bisnis / Brand",g,"","Waktu Cetak",new Date().toLocaleString("id-ID")],["Gudang / Cabang",d,"","Auditor PIC",c],["Periode Audit",`${a.from} s/d ${a.to}`,"","Basis HPP","Weighted Moving Average"],[],["No","Nama Menu","Kategori","Harga Jual (Rp)","HPP Teoritis Moving Avg (Rp)","Gross Margin (%)","Variance Cost / Porsi (Rp)","Adjusted HPP Aktual (Rp)","Adjusted Margin (%)","Penurunan Margin (pp)","Status Evaluasi"]];r.forEach((o,t)=>{const m=Number((o.gross_margin-o.adjusted_margin).toFixed(1)),h=m>5?"KRITIS (Margin Anjlok)":m>2?"PERHATIAN (Waspada)":"SEHAT (Normal)";l.push([t+1,o.menu?.name||"-",o.menu?.category||"-",Math.round(o.menu?.price||0),Math.round(o.hpp||0),Number((o.gross_margin||0).toFixed(1)),Math.round(o.variance_per_porsi||0),Math.round(o.adjusted_hpp||0),Number((o.adjusted_margin||0).toFixed(1)),m,h])});const s=e.utils.aoa_to_sheet(l);s["!cols"]=f(l),e.utils.book_append_sheet(n,s,"Profitabilitas Menu");const i=`Laporan_Profitabilitas_Menu_dan_HPP_${a.from}_sd_${a.to}.xlsx`;return e.writeFile(n,i),i}async function j({menuData:r=[],period:a,outletName:d="Semua Cabang",businessName:g="MOVA POS",userName:c="Administrator"}){const e=await P(),n=e.utils.book_new(),l=new Date().toLocaleString("id-ID"),s=r.reduce((m,h)=>m+(h.variance_value||0),0),i=[["LAPORAN RANKING VARIANCE PENYUMBANG MENU TERHADAP BAHAN BAKU"],["MOVA POS — Weighted Variance Contribution Analysis"],[],["Bisnis / Brand",g,"","Waktu Cetak",l],["Gudang / Cabang",d,"","Auditor PIC",c],["Periode Audit",`${a.from} s/d ${a.to}`,"","Total Variance",Math.round(s)],[],["No","Nama Menu","Kategori","Qty Terjual (Porsi)","Weighted % Variance","Nilai Variance (Rp)","Kontribusi terhadap Total Variance (%)"]];r.forEach((m,h)=>{const N=s!==0?Number((m.variance_value/s*100).toFixed(1)):0;i.push([h+1,m.menu?.name||"-",m.menu?.category||"-",m.qty_terjual||0,Number((m.weighted_pct||0).toFixed(2)),Math.round(m.variance_value||0),N])});const o=e.utils.aoa_to_sheet(i);o["!cols"]=f(i),e.utils.book_append_sheet(n,o,"Ranking Menu Variance");const t=`Laporan_Variance_Menu_${a.from}_sd_${a.to}.xlsx`;return e.writeFile(n,t),t}async function K({items:r=[],stats:a={},outletName:d="Semua Cabang",businessName:g="MOVA POS",userName:c="Administrator"}){const e=await P(),n=e.utils.book_new(),l=[["BUKU KASBON CUSTOMER (HUTANG PELANGGAN)"],["MOVA POS — Customer Credit Ledger & Bulk Payment Management"],[],["Bisnis / Brand",g,"","Waktu Ekspor",new Date().toLocaleString("id-ID")],["Cabang / Outlet",d,"","Dicetak Oleh",c],["Total Tagihan Kasbon",a.total_receivables||0,"","Sisa Kasbon Berjalan",a.total_remaining||0],["Total Telah Dilunasi",a.total_paid||0,"","Kasbon Jatuh Tempo (Overdue)",a.total_overdue||0],[],["No","No Invoice Kasbon","Tanggal Terbit","Jatuh Tempo","Nama Pelanggan","No. Telepon / WA","Cabang Outlet","Total Kasbon (Rp)","Sudah Dibayar (Rp)","Sisa Kasbon (Rp)","Progress (%)","Status Pelunasan","Keterangan / Rincian"]];r.forEach((o,t)=>{l.push([t+1,o.receivable_no||"-",o.issue_date||"-",o.due_date||"-",o.customer_name||"-",o.customer_phone||"-",o.outlet_name||"-",o.total_amount||0,o.paid_amount||0,o.remaining_amount||0,o.progress_pct??(o.total_amount>0?Math.round(o.paid_amount/o.total_amount*100):0),o.status_label||o.status||"-",o.notes||"-"])});const s=e.utils.aoa_to_sheet(l);s["!cols"]=f(l),e.utils.book_append_sheet(n,s,"Buku Piutang");const i=`Buku_Piutang_${new Date().toISOString().slice(0,10)}.xlsx`;return e.writeFile(n,i),i}function T(r){if(!r)return"";const a=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"],d=g=>{if(!g)return"";const c=new Date(g);return isNaN(c.getTime())?g:`${String(c.getDate()).padStart(2,"0")} ${a[c.getMonth()]} ${c.getFullYear()}`};return`${d(r.from)} s/d ${d(r.to)}`}async function z({items:r=[],summary:a={},period:d,outletName:g="Semua Cabang",businessName:c="MOVA POS"}){const e=await P(),n=e.utils.book_new(),l=T(d),s=[[c],["LAPORAN PENJUALAN PER PRODUK"],[`Per ${l}`],[],["No.","Kode Produk","Nama Produk / Sub Produk","Qty Terjual","Qty Refund","Satuan","Modal","Harga","Disc","Total Nilai Terjual","Total Nilai Refund"]];r.forEach((t,m)=>{s.push([m+1,t.code||"-",t.name||"-",Number(t.qty_sold)||0,Number(t.qty_refund)||0,t.unit||"Cup",Number(t.cost_price)||0,Number(t.price)||0,Number(t.discount_amount)||0,Number(t.total_sales)||0,Number(t.total_refund)||0])}),s.push(["Total","","",Number(a.total_qty_sold)||0,Number(a.total_qty_refund)||0,"",Number(a.total_modal)||0,"",Number(a.total_discount)||0,Number(a.total_sales)||0,Number(a.total_refund)||0]);const i=e.utils.aoa_to_sheet(s);i["!cols"]=f(s),e.utils.book_append_sheet(n,i,"Penjualan per Produk");const o=`Laporan_Penjualan_Produk_${d.from}_sd_${d.to}.xlsx`;return e.writeFile(n,o),o}async function F({items:r=[],summary:a={},period:d,outletName:g="Semua Cabang",businessName:c="MOVA POS"}){const e=await P(),n=e.utils.book_new(),l=T(d),s=[[c],["LAPORAN PENUKARAN POIN"],[`Per ${l}`],[],[],[],["No","Tanggal","Tgl. Dibuat","Dibuat Oleh","Warehouse","Customer","Kasir","No.Transaksi","Penukaran","Qty","Nilai","Poin"]];r.forEach((t,m)=>{s.push([m+1,t.date||"-",t.created_at||"-",t.created_by||"-",t.warehouse||g,t.customer||"-",t.cashier||t.created_by||"-",t.order_number||"-",t.penukaran||"-",Number(t.qty)||1,Number(t.nilai)||0,Number(t.points_used)||0])}),s.push(["Total","","","","","","","","",Number(a.total_qty)||r.length,Number(a.total_nilai)||0,Number(a.total_points)||0]);const i=e.utils.aoa_to_sheet(s);i["!cols"]=f(s),e.utils.book_append_sheet(n,i,"Penukaran Poin");const o=`Laporan_Penukaran_Poin_${d.from}_sd_${d.to}.xlsx`;return e.writeFile(n,o),o}async function U({items:r=[],summary:a={},period:d,outletName:g="Semua Cabang",businessName:c="MOVA POS"}){const e=await P(),n=e.utils.book_new(),l=T(d),s=[[c],["LAPORAN PEMBAYARAN PENJUALAN"],[`Per ${l}`],[],["No.","Tanggal","Jam","Tgl. Dibuat","Dibuat Oleh","Warehouse","No.Penjualan","No.Pembayaran","Customer","Jenis Bayar","Disetor Ke","Total Transaksi","Bayar","Piutang","Kasir"]];r.forEach((t,m)=>{s.push([m+1,t.date||"-",t.time||"-",t.created_at||"-",t.created_by||"-",t.warehouse||g,t.order_number||"-",t.payment_number||"",t.customer||"-",t.payment_method||"-",t.deposit_account||"-",Number(t.total_transaction)||0,Number(t.paid_amount)||0,Number(t.receivable_amount)||0,t.cashier||t.created_by||"-"])}),s.push(["Total","","","","","","","","","","",Number(a.total_transaction)||0,Number(a.total_paid)||0,Number(a.total_receivable)||0,""]);const i=e.utils.aoa_to_sheet(s);i["!cols"]=f(s),e.utils.book_append_sheet(n,i,"Pembayaran Penjualan");const o=`Laporan_Pembayaran_Penjualan_${d.from}_sd_${d.to}.xlsx`;return e.writeFile(n,o),o}async function V({items:r=[],summary:a={},period:d,outletName:g="Semua Cabang",businessName:c="MOVA POS"}){const e=await P(),n=e.utils.book_new(),l=T(d),s=[[c],["Laporan Transaksi Penjualan"],[`Per ${l}`],["No.","Tgl","Tgl. Dibuat","Dibuat Oleh","No.Ref","Customer","Promo","Jenis Bayar","Setor Ke","Kode Produk","Produk/Sub Produk","Kategori Produk","Sales Type","HPP","Harga Jual","","","","","Disc Tambahan","Disc Customer","PPN","Src.Charge","Pengiriman","Penjualan","Piutang","Profit","Kasir","Cetak Nota"],["","","","","","","","","","","","","","(Per 1 Qty)","QTY","Satuan","Harga","Disc","Subtotal","","","","","","","","","",""]];r.forEach((t,m)=>{s.push([m+1,t.date||"-",t.created_at||"-",t.created_by||"-",t.order_number||"-",t.customer||"Walk-in Customer",t.promo||"",t.payment_method||"-",t.deposit_account||"-",t.product_code||"-",t.product_name||"-",t.product_category||"KOPI",t.sales_type||"Dine-in",Number(t.hpp)||0,Number(t.qty)||0,t.unit||"Cup",Number(t.price)||0,Number(t.discount)||0,Number(t.subtotal)||0,Number(t.discount_extra)||0,Number(t.discount_customer)||0,Number(t.tax)||0,Number(t.service_charge)||0,Number(t.shipping)||0,Number(t.total_sale)||0,Number(t.receivable)||0,Number(t.profit)||0,t.cashier||t.created_by||"-",Number(t.receipt_printed)||0])}),s.push(["Total","","","","","","","","","","","","","",Number(a.total_qty)||0,"","","","",Number(a.total_discount)||0,0,0,0,0,Number(a.total_sale)||0,Number(a.total_receivable)||0,Number(a.total_profit)||0,"",""]);const i=e.utils.aoa_to_sheet(s);i["!cols"]=f(s),e.utils.book_append_sheet(n,i,"Transaksi Penjualan");const o=`Laporan_Transaksi_Penjualan_${d.from}_sd_${d.to}.xlsx`;return e.writeFile(n,o),o}async function H({items:r=[],summary:a={},period:d,outletName:g="Semua Cabang",businessName:c="MOVA POS"}){const e=await P(),n=e.utils.book_new(),l=T(d),s=[[c],["LAPORAN DAFTAR PENJUALAN PER CUSTOMER"],[`Per ${l}`],[],["No.","Tanggal","Kode Customer","Customer","Group Customer","No.Ref","Produk","Qty","Satuan","Harga Satuan","Disc","PPN","Src.Charge","Pengiriman","Total","Total Bayar","Jenis Bayar","Piutang","Kasir"]];r.forEach((t,m)=>{s.push([m+1,t.date||"-",t.customer_code||"-",t.customer_name||"Walk-in Customer",t.customer_group||"Reguler",t.order_number||"-",t.product_name||"-",Number(t.qty)||0,t.unit||"Cup",Number(t.price)||0,Number(t.discount)||0,Number(t.tax)||0,Number(t.service_charge)||0,Number(t.shipping)||0,Number(t.total)||0,Number(t.total_paid)||0,t.payment_method||"-",Number(t.receivable)||0,t.cashier||"-"])}),s.push(["Total Penjualan Semua Customer","","","","","","",Number(a.total_qty)||0,"","","","","","",Number(a.total_amount)||0,Number(a.total_paid)||0,"",Number(a.total_receivable)||0,""]);const i=e.utils.aoa_to_sheet(s);i["!cols"]=f(s),e.utils.book_append_sheet(n,i,"Penjualan per Customer");const o=`Laporan_Penjualan_Customer_${d.from}_sd_${d.to}.xlsx`;return e.writeFile(n,o),o}async function W({items:r=[],summary:a={},period:d,outletName:g="Semua Cabang",businessName:c="MOVA POS"}){const e=await P(),n=e.utils.book_new(),l=T(d),s=[[c],["LAPORAN WAKTU TERAMAI"],[`Per ${l}`],[],["No.","Waktu","Total Penjualan (Rp)","Rata-rata Penjualan (Rp)","Penjualan (%)","Transaksi","Transaksi (%)","Produk","Produk (%)","Tamu","Tamu (%)"]];r.forEach((t,m)=>{s.push([m+1,t.waktu||"",Number(t.total_penjualan)||0,Number(t.avg_penjualan)||0,Number(t.penjualan_pct)||0,Number(t.transaksi)||0,Number(t.transaksi_pct)||0,Number(t.produk)||0,Number(t.produk_pct)||0,Number(t.tamu)||0,Number(t.tamu_pct)||0])});const i=e.utils.aoa_to_sheet(s);i["!cols"]=f(s),e.utils.book_append_sheet(n,i,"Waktu Teramai");const o=`Laporan_Waktu_Teramai_${d.from}_sd_${d.to}.xlsx`;return e.writeFile(n,o),o}async function J({items:r=[],summary:a={},period:d,outletName:g="Semua Cabang",businessName:c="MOVA POS"}){const e=await P(),n=e.utils.book_new(),l=T(d),s=[[c],["LAPORAN PIUTANG CUSTOMER"],[`Per ${l}`],[],["No.","Customer","Tanggal","Jam","No.Penjualan","Piutang","Dibayar","Sisa Piutang","Usia Piutang","Jatuh Tempo"]];r.forEach((t,m)=>{s.push([m+1,t.customer||"-",t.tanggal||"-",t.jam||"-",t.no_penjualan||"-",Number(t.piutang)||0,Number(t.dibayar)||0,Number(t.sisa_piutang)||0,t.usia_piutang||"0 Hari",t.jatuh_tempo||"-"])}),s.push(["Total Piutang","","","","","","",Number(a.total_sisa_piutang)||0,"",""]);const i=e.utils.aoa_to_sheet(s);i["!cols"]=f(s),e.utils.book_append_sheet(n,i,"Piutang Customer");const o=`Laporan_Piutang_Customer_${d.from}_sd_${d.to}.xlsx`;return e.writeFile(n,o),o}async function X({items:r=[],summary:a={},period:d,outletName:g="Semua Cabang",businessName:c="MOVA POS"}){const e=await P(),n=e.utils.book_new(),l=T(d),s=[[c],["LAPORAN PROMO"],[`Per ${l}`],[],["No.","Tanggal","Promo","Jenis","Jumlah Transaksi","Nilai (Rp)"]];r.forEach((t,m)=>{s.push([m+1,t.tanggal||"-",t.promo||"-",t.jenis||"-",Number(t.jumlah_transaksi)||0,Number(t.nilai)||0])}),s.push(["Total Promo","","","",Number(a.total_promo)||0,Number(a.total_nilai)||0]),s.push(["Total Penjualan Promo","","","","",Number(a.total_penjualan_promo)||0]);const i=e.utils.aoa_to_sheet(s);i["!cols"]=f(s),e.utils.book_append_sheet(n,i,"Laporan Promo");const o=`Laporan_Promo_${d.from}_sd_${d.to}.xlsx`;return e.writeFile(n,o),o}async function G({rows:r=[],period:a={},outletName:d="Semua Cabang",businessName:g="MOVA POS",summary:c={}}){const e=await $(()=>import("./vendor-exceljs-BPsxf_ah.js").then(u=>O(u.t(),1)),__vite__mapDeps([2,1])),n=new(e.default||e).Workbook;n.creator=g,n.created=new Date;const l=n.addWorksheet("Laporan Hutang Supplier",{views:[{showGridLines:!0}]});l.getCell("B2").value="LAPORAN HUTANG SUPPLIER",l.getCell("B2").font={name:"Arial",size:14,bold:!0},l.getCell("B2").alignment={horizontal:"center",vertical:"middle"},l.mergeCells("B2:K2");const s=a.from_formatted&&a.to_formatted?`Per ${a.from_formatted} s/d ${a.to_formatted}`:a.from&&a.to?`Per ${a.from} s/d ${a.to}`:"Semua Periode";l.getCell("B3").value=s,l.getCell("B3").font={name:"Arial",size:11,italic:!0},l.getCell("B3").alignment={horizontal:"center",vertical:"middle"},l.mergeCells("B3:K3");const i=l.getRow(5);i.values=["No.","Supplier/Tanggal","Tgl. Dibuat","Dibuat Oleh","No.Pembelian","No.Bayar","Jatuh Tempo","Hutang","Dibayar","Sisa Hutang","Total Hutang"],i.height=24;const o={top:{style:"thin",color:{argb:"FF000000"}},left:{style:"thin",color:{argb:"FF000000"}},bottom:{style:"thin",color:{argb:"FF000000"}},right:{style:"thin",color:{argb:"FF000000"}}};i.eachCell(u=>{u.font={name:"Arial",size:10,bold:!0},u.alignment={horizontal:"center",vertical:"middle"},u.border=o});let t=6;r.forEach((u,x)=>{const p=l.getRow(t++);p.values=[x+1,u.supplier_tanggal||(u.supplier_name?`${u.supplier_name} - ${u.tgl_dibuat_fmt||u.tgl_dibuat}`:"-"),u.tgl_dibuat_fmt||u.tgl_dibuat||"-",u.dibuat_oleh||"Admin",u.no_pembelian||"-",u.no_bayar||"-",u.jatuh_tempo_fmt||u.jatuh_tempo||"-",Number(u.hutang)||0,Number(u.dibayar)||0,Number(u.sisa_hutang)||0,Number(u.total_hutang)||0],p.height=20,p.eachCell((b,C)=>{b.border=o,b.font={name:"Arial",size:10},C===1?b.alignment={horizontal:"center",vertical:"middle"}:[3,5,6,7].includes(C)?b.alignment={horizontal:"center",vertical:"middle"}:C>=8?(b.alignment={horizontal:"right",vertical:"middle"},b.numFmt="#,##0.00"):b.alignment={horizontal:"left",vertical:"middle"}})});const m=l.getRow(t);m.height=22;for(let u=1;u<=11;u++)m.getCell(u).border=o,m.getCell(u).font={name:"Arial",size:10,bold:!0};l.mergeCells(`A${t}:H${t}`);const h=l.getCell(`A${t}`);h.value="Total Utang",h.alignment={horizontal:"right",vertical:"middle"},h.font={name:"Arial",size:10,bold:!0};const N=m.getCell(9);N.value=Number(c.total_dibayar??0),N.alignment={horizontal:"right",vertical:"middle"},N.numFmt="#,##0.00",N.font={name:"Arial",size:10,bold:!0};const w=m.getCell(10);w.value=Number(c.total_sisa_hutang??0),w.alignment={horizontal:"right",vertical:"middle"},w.numFmt="#,##0.00",w.font={name:"Arial",size:10,bold:!0};const _=m.getCell(11);_.value=Number(c.total_hutang??0),_.alignment={horizontal:"right",vertical:"middle"},_.numFmt="#,##0.00",_.font={name:"Arial",size:10,bold:!0},l.getColumn(1).width=6,l.getColumn(2).width=32,l.getColumn(3).width=14,l.getColumn(4).width=16,l.getColumn(5).width=20,l.getColumn(6).width=24,l.getColumn(7).width=14,l.getColumn(8).width=16,l.getColumn(9).width=16,l.getColumn(10).width=16,l.getColumn(11).width=16;const S=`Laporan_Hutang_Supplier_${a.from||"all"}_sd_${a.to||"all"}.xlsx`,y=await n.xlsx.writeBuffer(),R=new Blob([y],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),k=window.URL.createObjectURL(R),A=document.createElement("a");return A.href=k,A.download=S,document.body.appendChild(A),A.click(),document.body.removeChild(A),window.URL.revokeObjectURL(k),S}function q({rows:r=[],period:a={},outletName:d="Semua Cabang",summary:g={}}){const c=a.from_formatted&&a.to_formatted?`Per ${a.from_formatted} s/d ${a.to_formatted}`:a.from&&a.to?`Per ${a.from} s/d ${a.to}`:"Semua Periode",e=window.open("","_blank");if(!e){alert("Pop-up browser diblokir. Harap izinkan pop-up untuk mencetak laporan.");return}const n=i=>Number(i||0).toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2}),l=r.map((i,o)=>`
    <tr>
      <td style="text-align:center;">${o+1}</td>
      <td>${i.supplier_tanggal||i.supplier_name||"-"}</td>
      <td style="text-align:center;">${i.tgl_dibuat_fmt||i.tgl_dibuat||"-"}</td>
      <td>${i.dibuat_oleh||"Admin"}</td>
      <td style="text-align:center;">${i.no_pembelian||"-"}</td>
      <td style="text-align:center;">${i.no_bayar||"-"}</td>
      <td style="text-align:center;">${i.jatuh_tempo_fmt||i.jatuh_tempo||"-"}</td>
      <td style="text-align:right;">${n(i.hutang)}</td>
      <td style="text-align:right;">${n(i.dibayar)}</td>
      <td style="text-align:right;">${n(i.sisa_hutang)}</td>
      <td style="text-align:right;">${n(i.total_hutang)}</td>
    </tr>
  `).join(""),s=`
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
      <div><strong>Outlet/Cabang:</strong> ${d}</div>
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
        ${l||'<tr><td colspan="11" style="text-align:center; padding:15px;">Tidak ada data hutang untuk periode ini</td></tr>'}
      </tbody>
      <tfoot>
        <tr class="footer-total">
          <td colspan="8" style="text-align: right; padding-right: 12px;">Total Utang</td>
          <td style="text-align: right;">${n(g.total_dibayar)}</td>
          <td style="text-align: right;">${n(g.total_sisa_hutang)}</td>
          <td style="text-align: right;">${n(g.total_hutang)}</td>
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
  `;e.document.open(),e.document.write(s),e.document.close()}async function Q({data:r={},period:a={},businessName:d="MOVA POS",outletName:g="Semua Cabang"}){const c=await $(()=>import("./vendor-exceljs-BPsxf_ah.js").then(u=>O(u.t(),1)),__vite__mapDeps([2,1])),e=new(c.default||c).Workbook;e.creator=d,e.created=new Date;const n=e.addWorksheet("Laporan Neraca",{views:[{showGridLines:!0}]}),l=a.from_formatted&&a.to_formatted?`Per ${a.from_formatted} s/d ${a.to_formatted}`:a.from&&a.to?`Per ${a.from} s/d ${a.to}`:"Semua Periode";n.mergeCells("B1:D1");const s=n.getCell("B1");s.value="LAPORAN NERACA",s.font={name:"Arial",size:13,bold:!0},s.alignment={horizontal:"center",vertical:"middle"},n.getRow(1).height=22,n.mergeCells("B2:E2");const i=n.getCell("B2");i.value=l,i.font={name:"Arial",size:10,italic:!0},i.alignment={horizontal:"left",vertical:"middle"},n.getRow(2).height=18;let o=3;const t=u=>{const x=n.getRow(o++);x.getCell(2).value=u,x.getCell(2).font={name:"Arial",size:10,bold:!0},x.height=18},m=(u,x,p)=>{const b=n.getRow(o++);b.getCell(2).value=u||"",b.getCell(2).font={name:"Arial",size:10},b.getCell(2).alignment={horizontal:"left",vertical:"middle"},b.getCell(3).value=x||"",b.getCell(3).font={name:"Arial",size:10},b.getCell(3).alignment={horizontal:"left",vertical:"middle"},b.getCell(4).value=Number(p)||0,b.getCell(4).font={name:"Arial",size:10},b.getCell(4).alignment={horizontal:"right",vertical:"middle"},b.getCell(4).numFmt="#,##0",b.height=18},h=(u,x)=>{const p=n.getRow(o++);p.getCell(2).value=u,p.getCell(2).font={name:"Arial",size:10,bold:!0},n.mergeCells(`B${o-1}:C${o-1}`),p.getCell(4).value=Number(x)||0,p.getCell(4).font={name:"Arial",size:10,bold:!0},p.getCell(4).alignment={horizontal:"right",vertical:"middle"},p.getCell(4).numFmt="#,##0",p.height=18};t("Aset Lancar"),(r.current_assets?.accounts||[]).forEach(u=>{m(u.code,u.name,u.amount)}),h("Jumlah Aset Lancar",r.current_assets?.subtotal??0),t("Aset Tetap");const N=r.fixed_assets?.accounts||[];N.length>0?N.forEach(u=>{m(u.code,u.name,u.amount)}):m("","Depresiasi & Amortisasi",0),h("Jumlah Aset Tetap",r.fixed_assets?.subtotal??0),t("Liabilitas");const w=r.liabilities?.accounts||[];w.length>0&&w.some(u=>u.amount!==0)&&w.forEach(u=>{m(u.code,u.name,u.amount)}),h("Jumlah Hutang",r.liabilities?.subtotal??0),t("Modal"),(r.equity?.accounts||[]).forEach(u=>{m(u.code,u.name,u.amount)}),h("Jumlah Modal",r.equity?.subtotal??0),o++;const _=n.getRow(o);_.height=22,_.getCell(2).value="Jumlah Aset",_.getCell(2).font={name:"Arial",size:11,bold:!0},n.mergeCells(`B${o}:C${o}`),_.getCell(4).value=Number(r.total_assets?.amount??0),_.getCell(4).font={name:"Arial",size:11,bold:!0},_.getCell(4).alignment={horizontal:"right",vertical:"middle"},_.getCell(4).numFmt="#,##0",_.getCell(6).value="Jumlah Kewajiban dan Modal",_.getCell(6).font={name:"Arial",size:11,bold:!0},_.getCell(6).alignment={horizontal:"right",vertical:"middle"},_.getCell(7).value=Number(r.total_liabilities_and_equity?.amount??0),_.getCell(7).font={name:"Arial",size:11,bold:!0},_.getCell(7).alignment={horizontal:"right",vertical:"middle"},_.getCell(7).numFmt="#,##0",n.getColumn(1).width=4,n.getColumn(2).width=14,n.getColumn(3).width=32,n.getColumn(4).width=18,n.getColumn(5).width=6,n.getColumn(6).width=30,n.getColumn(7).width=18;const S=`Laporan_Neraca_${a.from||"all"}_sd_${a.to||"all"}.xlsx`,y=await e.xlsx.writeBuffer(),R=new Blob([y],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),k=window.URL.createObjectURL(R),A=document.createElement("a");return A.href=k,A.download=S,document.body.appendChild(A),A.click(),document.body.removeChild(A),window.URL.revokeObjectURL(k),S}function Y({data:r={},period:a={},businessName:d="MOVA POS",outletName:g="Semua Cabang"}){const c=a.from_formatted&&a.to_formatted?`Per ${a.from_formatted} s/d ${a.to_formatted}`:a.from&&a.to?`Per ${a.from} s/d ${a.to}`:"Semua Periode",e=window.open("","_blank");if(!e){alert("Pop-up browser diblokir. Harap izinkan pop-up untuk mencetak laporan.");return}const n=i=>Number(i||0).toLocaleString("id-ID",{minimumFractionDigits:0,maximumFractionDigits:0}),l=(i=[])=>i.map(o=>`
      <tr>
        <td style="width: 120px; padding: 4px 8px; color: #475569;">${o.code||""}</td>
        <td style="padding: 4px 8px;">${o.name||""}</td>
        <td style="text-align: right; padding: 4px 8px; font-variant-numeric: tabular-nums;">${n(o.amount)}</td>
      </tr>
    `).join(""),s=`
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
      <div><strong>Bisnis:</strong> ${d} | <strong>Cabang:</strong> ${g}</div>
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
        ${l(r.current_assets?.accounts)}
      </tbody>
      <tfoot>
        <tr class="subtotal-row">
          <td colspan="2">Jumlah Aset Lancar</td>
          <td style="text-align: right;">${n(r.current_assets?.subtotal)}</td>
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
        ${r.fixed_assets?.accounts?.length?l(r.fixed_assets?.accounts):'<tr><td style="color:#64748b;">-</td><td>Depresiasi & Amortisasi</td><td style="text-align:right;">0</td></tr>'}
      </tbody>
      <tfoot>
        <tr class="subtotal-row">
          <td colspan="2">Jumlah Aset Tetap</td>
          <td style="text-align: right;">${n(r.fixed_assets?.subtotal)}</td>
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
        ${r.liabilities?.accounts?.length?l(r.liabilities?.accounts):""}
      </tbody>
      <tfoot>
        <tr class="subtotal-row">
          <td colspan="2">Jumlah Hutang</td>
          <td style="text-align: right;">${n(r.liabilities?.subtotal)}</td>
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
        ${l(r.equity?.accounts)}
      </tbody>
      <tfoot>
        <tr class="subtotal-row">
          <td colspan="2">Jumlah Modal</td>
          <td style="text-align: right;">${n(r.equity?.subtotal)}</td>
        </tr>
      </tfoot>
    </table>

    <!-- GRAND TOTAL -->
    <div class="grand-total-box">
      <div>Jumlah Aset: <span style="margin-left: 20px;">Rp ${n(r.total_assets?.amount)}</span></div>
      <div>Jumlah Kewajiban dan Modal: <span style="margin-left: 20px;">Rp ${n(r.total_liabilities_and_equity?.amount)}</span></div>
    </div>

    <script>
      window.onload = function() {
        window.print();
      };
    <\/script>
  </body>
  </html>
  `;e.document.open(),e.document.write(s),e.document.close()}export{q as _,F as a,K as c,U as d,V as f,Y as g,j as h,W as i,H as l,D as m,J as n,I as o,G as p,B as r,X as s,Q as t,z as u};
