const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/vendor-xlsx-LK-29t-I.js","assets/rolldown-runtime-kjsH4l9N.js","assets/vendor-exceljs-BPsxf_ah.js"])))=>i.map(i=>d[i]);
import{i as O}from"./rolldown-runtime-kjsH4l9N.js";import{d as $}from"./vendor-router-CW5hKwT5.js";async function P(){return await $(()=>import("./vendor-xlsx-LK-29t-I.js").then(u=>u.t),__vite__mapDeps([0,1]))}function f(u){const o=[];return u.forEach(s=>{(s||[]).forEach((d,c)=>{const n=d!=null?String(d).length:0;o[c]=Math.max(o[c]||10,Math.min(n+3,50))})}),o.map(s=>({wch:s}))}async function B({data:u,varData:o=[],varMenuData:s=[],period:d,outletName:c="Semua Cabang",businessName:n="MOVA POS",userName:e="Administrator"}){const r=await P(),i=r.utils.book_new(),t=new Date().toLocaleString("id-ID"),{status_counts:l={},total_variance_value:a=0,total_variance_loss:m=0,total_waste_value:_=0,total_combined_loss:N=0,top_waste:x=[]}=u||{},p=[["LAPORAN EKSEKUTIF COST CONTROL & ANALITIK VARIANSI PERSADAAN"],["MOVA POS — Advanced F&B Cost Management System"],[],["Bisnis / Brand",n],["Gudang / Outlet",c],["Periode Audit",`${d.from} s/d ${d.to}`],["Waktu Export",t],["Dicetak Oleh",e],["Target Laporan","Finance / Akuntan, Mitra Pemilik Cabang & Investor"],[],["=== INDIKATOR KUNCI COST CONTROL & RESEP ==="],["Metrik Analisis","Jumlah / Nilai","Satuan","Keterangan Akuntansi"],["Bahan Berstatus Normal",l.NORMAL??0,"Item Bahan","Pemakaian dalam batas wajar resep"],["Bahan Berstatus Waspada",l.WASPADA??0,"Item Bahan","Perlu evaluasi porsi & takaran koki"],["Bahan Berstatus Tidak Wajar",l["TIDAK WAJAR"]??0,"Item Bahan","Wajib investigasi kehilangan/kebocoran"],["Total Kerugian Waste Resmi",_,"Rupiah (IDR)","Limbah basi, gosong, sortir diakui dapur"],["Total Selisih Tak Terjelaskan (Shrinkage)",m,"Rupiah (IDR)","Anomali selisih fisik vs sistem"],["Total Kerugian F&B Bersih",N,"Rupiah (IDR)","Akumulasi kerugian waste + selisih murni"],[],["Catatan Rekomendasi:","Lakukan audit berkala pada item berstatus TIDAK WAJAR dan perketat standar pencatatan waste harian."]],w=r.utils.aoa_to_sheet(p);w["!cols"]=f(p),r.utils.book_append_sheet(i,w,"Ringkasan Eksekutif");const k=[["DAFTAR BAHAN BAKU DENGAN ANOMALI / SELISIH TERTINGGI"],["Cabang:",c,"Periode:",`${d.from} s/d ${d.to}`],[],["No","Kode Bahan","Nama Bahan Baku","Kategori","Satuan Pakai","% Net Variance","Nilai Selisih (Rp)","Status Audit"]];o.forEach((b,T)=>{k.push([T+1,b.ingredient?.code||"-",b.ingredient?.name||"-",b.ingredient?.category||"-",b.ingredient?.unit_pakai||"-",Number((b.variance_pct||0).toFixed(2)),Math.round(b.variance_value||0),b.status||"NORMAL"])});const E=r.utils.aoa_to_sheet(k);E["!cols"]=f(k),r.utils.book_append_sheet(i,E,"Top Selisih Bahan");const C=[["MENU PENYUMBANG VARIANSI TERTINGGI"],["Cabang:",c,"Periode:",`${d.from} s/d ${d.to}`],[],["No","Nama Menu","Kategori","Qty Terjual (Porsi)","Weighted %","Nilai Variance (Rp)"]];s.forEach((b,T)=>{C.push([T+1,b.menu?.name||"-",b.menu?.category||"-",b.qty_terjual||0,Number((b.weighted_pct||0).toFixed(2)),Math.round(b.variance_value||0)])});const S=r.utils.aoa_to_sheet(C);S["!cols"]=f(C),r.utils.book_append_sheet(i,S,"Top Menu Variance");const h=[["RINCIAN KERUSAKAN & LIMBAH BAHAN BAKU (DOCUMENTED WASTE)"],["Cabang:",c,"Periode:",`${d.from} s/d ${d.to}`],[],["No","Kode Bahan","Nama Bahan Baku","Total Qty Rusak","Satuan","Nilai Kerugian (Rp)","Catatan Kejadian / Alasan"]];x.forEach((b,T)=>{const y=(b.waste_records||[]).map(L=>`${L.waste_reason||"Lainnya"}: ${L.qty}`).join("; ");h.push([T+1,b.ingredient?.code||"-",b.ingredient?.name||"-",b.waste_qty||b.waste||0,b.ingredient?.unit_pakai||"-",Math.round(b.waste_value||0),y||"Pencatatan limbah dapur"])});const A=r.utils.aoa_to_sheet(h);A["!cols"]=f(h),r.utils.book_append_sheet(i,A,"Limbah & Kerusakan");const g=`Laporan_Eksekutif_Cost_Control_${d.from}_sd_${d.to}.xlsx`;return r.writeFile(i,g),g}async function M({varData:u=[],period:o,outletName:s="Semua Cabang",businessName:d="MOVA POS",userName:c="Administrator"}){const n=await P(),e=n.utils.book_new(),r=[["LAPORAN AUDIT VARIANSI PERSADAAN BAHAN BAKU (COST CONTROL AUDIT)"],["MOVA POS — Metode Penilaian PSAK 14 Weighted Moving Average"],[],["Bisnis / Brand",d,"","Waktu Cetak",new Date().toLocaleString("id-ID")],["Gudang / Cabang",s,"","Auditor PIC",c],["Periode Audit",`${o.from} s/d ${o.to}`,"","Standar","PSAK 14 Moving Average"],[],["No","Kode","Nama Bahan Baku","Kategori","Satuan Beli","Satuan Pakai","Harga Pokok Rata-Rata (Rp)","Stok Awal (Pakai)","Masuk (Beli/Transfer)","Pemakaian Teoritis POS","Waste Resmi Tercatat","Pemakaian Aktual","Selisih Net (Pakai)","Selisih %","Nilai Total Selisih (Rp)","Kerugian Waste (Rp)","Selisih Tak Terjelaskan (Rp)","Status Audit"]];let i=0,t=0,l=0;u.forEach((_,N)=>{const x=Math.round(_.variance_value||0),p=Math.round(_.waste_value||0),w=Math.round(_.unaccounted_value||0);i+=x,t+=p,l+=w,r.push([N+1,_.ingredient?.code||"-",_.ingredient?.name||"-",_.ingredient?.category||"-",_.ingredient?.unit_beli||"-",_.ingredient?.unit_pakai||"-",Math.round(_.ingredient?.harga||0),_.stok_awal??"-",_.total_masuk??"-",_.pemakaian_teoritis??"-",_.waste_qty??0,_.pemakaian_aktual??"-",_.variance_qty??0,Number((_.variance_pct||0).toFixed(2)),x,p,w,_.status||"NORMAL"])}),r.push([]),r.push(["TOTAL AKUMULASI","","","","","","","","","","","","","",i,t,l,""]);const a=n.utils.aoa_to_sheet(r);a["!cols"]=f(r),n.utils.book_append_sheet(e,a,"Audit Variansi Bahan");const m=`Laporan_Audit_Variansi_Bahan_${o.from}_sd_${o.to}.xlsx`;return n.writeFile(e,m),m}async function I({data:u=[],period:o,outletName:s="Semua Cabang",businessName:d="MOVA POS",userName:c="Administrator"}){const n=await P(),e=n.utils.book_new(),r=[["LAPORAN ANALISIS PROFITABILITAS MENU & HPP DINAMIS"],["MOVA POS — Evaluasi Margin & Moving Average Unit Economics"],[],["Bisnis / Brand",d,"","Waktu Cetak",new Date().toLocaleString("id-ID")],["Gudang / Cabang",s,"","Auditor PIC",c],["Periode Audit",`${o.from} s/d ${o.to}`,"","Basis HPP","Weighted Moving Average"],[],["No","Nama Menu","Kategori","Harga Jual (Rp)","HPP Teoritis Moving Avg (Rp)","Gross Margin (%)","Variance Cost / Porsi (Rp)","Adjusted HPP Aktual (Rp)","Adjusted Margin (%)","Penurunan Margin (pp)","Status Evaluasi"]];u.forEach((l,a)=>{const m=Number((l.gross_margin-l.adjusted_margin).toFixed(1)),_=m>5?"KRITIS (Margin Anjlok)":m>2?"PERHATIAN (Waspada)":"SEHAT (Normal)";r.push([a+1,l.menu?.name||"-",l.menu?.category||"-",Math.round(l.menu?.price||0),Math.round(l.hpp||0),Number((l.gross_margin||0).toFixed(1)),Math.round(l.variance_per_porsi||0),Math.round(l.adjusted_hpp||0),Number((l.adjusted_margin||0).toFixed(1)),m,_])});const i=n.utils.aoa_to_sheet(r);i["!cols"]=f(r),n.utils.book_append_sheet(e,i,"Profitabilitas Menu");const t=`Laporan_Profitabilitas_Menu_dan_HPP_${o.from}_sd_${o.to}.xlsx`;return n.writeFile(e,t),t}async function F({menuData:u=[],period:o,outletName:s="Semua Cabang",businessName:d="MOVA POS",userName:c="Administrator"}){const n=await P(),e=n.utils.book_new(),r=new Date().toLocaleString("id-ID"),i=u.reduce((m,_)=>m+(_.variance_value||0),0),t=[["LAPORAN RANKING VARIANCE PENYUMBANG MENU TERHADAP BAHAN BAKU"],["MOVA POS — Weighted Variance Contribution Analysis"],[],["Bisnis / Brand",d,"","Waktu Cetak",r],["Gudang / Cabang",s,"","Auditor PIC",c],["Periode Audit",`${o.from} s/d ${o.to}`,"","Total Variance",Math.round(i)],[],["No","Nama Menu","Kategori","Qty Terjual (Porsi)","Weighted % Variance","Nilai Variance (Rp)","Kontribusi terhadap Total Variance (%)"]];u.forEach((m,_)=>{const N=i!==0?Number((m.variance_value/i*100).toFixed(1)):0;t.push([_+1,m.menu?.name||"-",m.menu?.category||"-",m.qty_terjual||0,Number((m.weighted_pct||0).toFixed(2)),Math.round(m.variance_value||0),N])});const l=n.utils.aoa_to_sheet(t);l["!cols"]=f(t),n.utils.book_append_sheet(e,l,"Ranking Menu Variance");const a=`Laporan_Variance_Menu_${o.from}_sd_${o.to}.xlsx`;return n.writeFile(e,a),a}async function j({items:u=[],stats:o={},outletName:s="Semua Cabang",businessName:d="MOVA POS",userName:c="Administrator"}){const n=await P(),e=n.utils.book_new(),r=[["BUKU KASBON CUSTOMER (HUTANG PELANGGAN)"],["MOVA POS — Customer Credit Ledger & Bulk Payment Management"],[],["Bisnis / Brand",d,"","Waktu Ekspor",new Date().toLocaleString("id-ID")],["Cabang / Outlet",s,"","Dicetak Oleh",c],["Total Tagihan Kasbon",o.total_receivables||0,"","Sisa Kasbon Berjalan",o.total_remaining||0],["Total Telah Dilunasi",o.total_paid||0,"","Kasbon Jatuh Tempo (Overdue)",o.total_overdue||0],[],["No","No Invoice Kasbon","Tanggal Terbit","Jatuh Tempo","Nama Pelanggan","No. Telepon / WA","Cabang Outlet","Total Kasbon (Rp)","Sudah Dibayar (Rp)","Sisa Kasbon (Rp)","Progress (%)","Status Pelunasan","Keterangan / Rincian"]];u.forEach((l,a)=>{r.push([a+1,l.receivable_no||"-",l.issue_date||"-",l.due_date||"-",l.customer_name||"-",l.customer_phone||"-",l.outlet_name||"-",l.total_amount||0,l.paid_amount||0,l.remaining_amount||0,l.progress_pct??(l.total_amount>0?Math.round(l.paid_amount/l.total_amount*100):0),l.status_label||l.status||"-",l.notes||"-"])});const i=n.utils.aoa_to_sheet(r);i["!cols"]=f(r),n.utils.book_append_sheet(e,i,"Buku Piutang");const t=`Buku_Piutang_${new Date().toISOString().slice(0,10)}.xlsx`;return n.writeFile(e,t),t}function R(u){if(!u)return"";const o=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"],s=d=>{if(!d)return"";const c=new Date(d);return isNaN(c.getTime())?d:`${String(c.getDate()).padStart(2,"0")} ${o[c.getMonth()]} ${c.getFullYear()}`};return`${s(u.from)} s/d ${s(u.to)}`}async function K({items:u=[],summary:o={},period:s,outletName:d="Semua Cabang",businessName:c="MOVA POS"}){const n=await P(),e=n.utils.book_new(),r=R(s),i=[[c],["LAPORAN PENJUALAN PER PRODUK"],[`Per ${r}`],[],["No.","Kode Produk","Nama Produk / Sub Produk","Qty Terjual","Qty Refund","Satuan","Modal","Harga","Disc","Total Nilai Terjual","Total Nilai Refund"]];u.forEach((a,m)=>{i.push([m+1,a.code||"-",a.name||"-",Number(a.qty_sold)||0,Number(a.qty_refund)||0,a.unit||"Cup",Number(a.cost_price)||0,Number(a.price)||0,Number(a.discount_amount)||0,Number(a.total_sales)||0,Number(a.total_refund)||0])}),i.push(["Total","","",Number(o.total_qty_sold)||0,Number(o.total_qty_refund)||0,"",Number(o.total_modal)||0,"",Number(o.total_discount)||0,Number(o.total_sales)||0,Number(o.total_refund)||0]);const t=n.utils.aoa_to_sheet(i);t["!cols"]=f(i),n.utils.book_append_sheet(e,t,"Penjualan per Produk");const l=`Laporan_Penjualan_Produk_${s.from}_sd_${s.to}.xlsx`;return n.writeFile(e,l),l}async function U({items:u=[],summary:o={},period:s,outletName:d="Semua Cabang",businessName:c="MOVA POS"}){const n=await P(),e=n.utils.book_new(),r=R(s),i=[[c],["LAPORAN PENUKARAN POIN"],[`Per ${r}`],[],[],[],["No","Tanggal","Tgl. Dibuat","Dibuat Oleh","Warehouse","Customer","Kasir","No.Transaksi","Penukaran","Qty","Nilai","Poin"]];u.forEach((a,m)=>{i.push([m+1,a.date||"-",a.created_at||"-",a.created_by||"-",a.warehouse||d,a.customer||"-",a.cashier||a.created_by||"-",a.order_number||"-",a.penukaran||"-",Number(a.qty)||1,Number(a.nilai)||0,Number(a.points_used)||0])}),i.push(["Total","","","","","","","","",Number(o.total_qty)||u.length,Number(o.total_nilai)||0,Number(o.total_points)||0]);const t=n.utils.aoa_to_sheet(i);t["!cols"]=f(i),n.utils.book_append_sheet(e,t,"Penukaran Poin");const l=`Laporan_Penukaran_Poin_${s.from}_sd_${s.to}.xlsx`;return n.writeFile(e,l),l}async function z({items:u=[],summary:o={},period:s,outletName:d="Semua Cabang",businessName:c="MOVA POS"}){const n=await P(),e=n.utils.book_new(),r=R(s),i=[[c],["LAPORAN PEMBAYARAN PENJUALAN"],[`Per ${r}`],[],["No.","Tanggal","Jam","Tgl. Dibuat","Dibuat Oleh","Warehouse","No.Penjualan","No.Pembayaran","Customer","Jenis Bayar","Disetor Ke","Total Transaksi","Bayar","Piutang","Kasir"]];u.forEach((a,m)=>{i.push([m+1,a.date||"-",a.time||"-",a.created_at||"-",a.created_by||"-",a.warehouse||d,a.order_number||"-",a.payment_number||"",a.customer||"-",a.payment_method||"-",a.deposit_account||"-",Number(a.total_transaction)||0,Number(a.paid_amount)||0,Number(a.receivable_amount)||0,a.cashier||a.created_by||"-"])}),i.push(["Total","","","","","","","","","","",Number(o.total_transaction)||0,Number(o.total_paid)||0,Number(o.total_receivable)||0,""]);const t=n.utils.aoa_to_sheet(i);t["!cols"]=f(i),n.utils.book_append_sheet(e,t,"Pembayaran Penjualan");const l=`Laporan_Pembayaran_Penjualan_${s.from}_sd_${s.to}.xlsx`;return n.writeFile(e,l),l}async function V({items:u=[],summary:o={},period:s,outletName:d="Semua Cabang",businessName:c="MOVA POS"}){const n=await P(),e=n.utils.book_new(),r=R(s),i=[[c],["Laporan Transaksi Penjualan"],[`Per ${r}`],["No.","Tgl","Tgl. Dibuat","Dibuat Oleh","No.Ref","Customer","Promo","Jenis Bayar","Setor Ke","Kode Produk","Produk/Sub Produk","Kategori Produk","Sales Type","HPP","Harga Jual","","","","","Disc Tambahan","Disc Customer","PPN","Src.Charge","Pengiriman","Penjualan","Piutang","Profit","Kasir","Cetak Nota"],["","","","","","","","","","","","","","(Per 1 Qty)","QTY","Satuan","Harga","Disc","Subtotal","","","","","","","","","",""]];u.forEach((a,m)=>{i.push([m+1,a.date||"-",a.created_at||"-",a.created_by||"-",a.order_number||"-",a.customer||"Walk-in Customer",a.promo||"",a.payment_method||"-",a.deposit_account||"-",a.product_code||"-",a.product_name||"-",a.product_category||"KOPI",a.sales_type||"Dine-in",Number(a.hpp)||0,Number(a.qty)||0,a.unit||"Cup",Number(a.price)||0,Number(a.discount)||0,Number(a.subtotal)||0,Number(a.discount_extra)||0,Number(a.discount_customer)||0,Number(a.tax)||0,Number(a.service_charge)||0,Number(a.shipping)||0,Number(a.total_sale)||0,Number(a.receivable)||0,Number(a.profit)||0,a.cashier||a.created_by||"-",Number(a.receipt_printed)||0])}),i.push(["Total","","","","","","","","","","","","","",Number(o.total_qty)||0,"","","","",Number(o.total_discount)||0,0,0,0,0,Number(o.total_sale)||0,Number(o.total_receivable)||0,Number(o.total_profit)||0,"",""]);const t=n.utils.aoa_to_sheet(i);t["!cols"]=f(i),n.utils.book_append_sheet(e,t,"Transaksi Penjualan");const l=`Laporan_Transaksi_Penjualan_${s.from}_sd_${s.to}.xlsx`;return n.writeFile(e,l),l}async function H({items:u=[],summary:o={},period:s,outletName:d="Semua Cabang",businessName:c="MOVA POS"}){const n=await P(),e=n.utils.book_new(),r=R(s),i=[[c],["LAPORAN DAFTAR PENJUALAN PER CUSTOMER"],[`Per ${r}`],[],["No.","Tanggal","Kode Customer","Customer","Group Customer","No.Ref","Produk","Qty","Satuan","Harga Satuan","Disc","PPN","Src.Charge","Pengiriman","Total","Total Bayar","Jenis Bayar","Piutang","Kasir"]];u.forEach((a,m)=>{i.push([m+1,a.date||"-",a.customer_code||"-",a.customer_name||"Walk-in Customer",a.customer_group||"Reguler",a.order_number||"-",a.product_name||"-",Number(a.qty)||0,a.unit||"Cup",Number(a.price)||0,Number(a.discount)||0,Number(a.tax)||0,Number(a.service_charge)||0,Number(a.shipping)||0,Number(a.total)||0,Number(a.total_paid)||0,a.payment_method||"-",Number(a.receivable)||0,a.cashier||"-"])}),i.push(["Total Penjualan Semua Customer","","","","","","",Number(o.total_qty)||0,"","","","","","",Number(o.total_amount)||0,Number(o.total_paid)||0,"",Number(o.total_receivable)||0,""]);const t=n.utils.aoa_to_sheet(i);t["!cols"]=f(i),n.utils.book_append_sheet(e,t,"Penjualan per Customer");const l=`Laporan_Penjualan_Customer_${s.from}_sd_${s.to}.xlsx`;return n.writeFile(e,l),l}async function W({items:u=[],summary:o={},period:s,outletName:d="Semua Cabang",businessName:c="MOVA POS"}){const n=await P(),e=n.utils.book_new(),r=R(s),i=[[c],["LAPORAN WAKTU TERAMAI"],[`Per ${r}`],[],["No.","Waktu","Total Penjualan (Rp)","Rata-rata Penjualan (Rp)","Penjualan (%)","Transaksi","Transaksi (%)","Produk","Produk (%)","Tamu","Tamu (%)"]];u.forEach((a,m)=>{i.push([m+1,a.waktu||"",Number(a.total_penjualan)||0,Number(a.avg_penjualan)||0,Number(a.penjualan_pct)||0,Number(a.transaksi)||0,Number(a.transaksi_pct)||0,Number(a.produk)||0,Number(a.produk_pct)||0,Number(a.tamu)||0,Number(a.tamu_pct)||0])});const t=n.utils.aoa_to_sheet(i);t["!cols"]=f(i),n.utils.book_append_sheet(e,t,"Waktu Teramai");const l=`Laporan_Waktu_Teramai_${s.from}_sd_${s.to}.xlsx`;return n.writeFile(e,l),l}async function J({items:u=[],summary:o={},period:s,outletName:d="Semua Cabang",businessName:c="MOVA POS"}){const n=await P(),e=n.utils.book_new(),r=R(s),i=[[c],["LAPORAN PIUTANG CUSTOMER"],[`Per ${r}`],[],["No.","Customer","Tanggal","Jam","No.Penjualan","Piutang","Dibayar","Sisa Piutang","Usia Piutang","Jatuh Tempo"]];u.forEach((a,m)=>{i.push([m+1,a.customer||"-",a.tanggal||"-",a.jam||"-",a.no_penjualan||"-",Number(a.piutang)||0,Number(a.dibayar)||0,Number(a.sisa_piutang)||0,a.usia_piutang||"0 Hari",a.jatuh_tempo||"-"])}),i.push(["Total Piutang","","","","","","",Number(o.total_sisa_piutang)||0,"",""]);const t=n.utils.aoa_to_sheet(i);t["!cols"]=f(i),n.utils.book_append_sheet(e,t,"Piutang Customer");const l=`Laporan_Piutang_Customer_${s.from}_sd_${s.to}.xlsx`;return n.writeFile(e,l),l}async function X({items:u=[],summary:o={},period:s,outletName:d="Semua Cabang",businessName:c="MOVA POS"}){const n=await P(),e=n.utils.book_new(),r=R(s),i=[[c],["LAPORAN PROMO"],[`Per ${r}`],[],["No.","Tanggal","Promo","Jenis","Jumlah Transaksi","Nilai (Rp)"]];u.forEach((a,m)=>{i.push([m+1,a.tanggal||"-",a.promo||"-",a.jenis||"-",Number(a.jumlah_transaksi)||0,Number(a.nilai)||0])}),i.push(["Total Promo","","","",Number(o.total_promo)||0,Number(o.total_nilai)||0]),i.push(["Total Penjualan Promo","","","","",Number(o.total_penjualan_promo)||0]);const t=n.utils.aoa_to_sheet(i);t["!cols"]=f(i),n.utils.book_append_sheet(e,t,"Laporan Promo");const l=`Laporan_Promo_${s.from}_sd_${s.to}.xlsx`;return n.writeFile(e,l),l}async function q({rows:u=[],items:o=[],period:s={},outletName:d="Semua Cabang",businessName:c="URBAE CAFFEINE",summary:n={}}){const e=o.length>0?o:u,r=await $(()=>import("./vendor-exceljs-BPsxf_ah.js").then(g=>O(g.t(),1)),__vite__mapDeps([2,1])),i=new(r.default||r).Workbook;i.creator=c,i.created=new Date;const t=i.addWorksheet("Laporan Hutang Supplier",{views:[{showGridLines:!0}]});t.getCell("B2").value="LAPORAN HUTANG SUPPLIER",t.getCell("B2").font={name:"Arial",size:14,bold:!0},t.getCell("B2").alignment={horizontal:"center",vertical:"middle"},t.mergeCells("B2:K2");const l=typeof s=="string"?s:s.from_formatted&&s.to_formatted?`Per ${s.from_formatted} s/d ${s.to_formatted}`:s.from&&s.to?`Per ${s.from} s/d ${s.to}`:"Semua Periode";t.getCell("B3").value=l,t.getCell("B3").font={name:"Arial",size:11,italic:!0},t.getCell("B3").alignment={horizontal:"center",vertical:"middle"},t.mergeCells("B3:K3");const a=t.getRow(5);a.values=["No.","Supplier/Tanggal","Tgl. Dibuat","Dibuat Oleh","No.Pembelian","No.Bayar","Jatuh Tempo","Hutang","Dibayar","Sisa Hutang","Total Hutang"],a.height=24;const m={top:{style:"thin",color:{argb:"FF000000"}},left:{style:"thin",color:{argb:"FF000000"}},bottom:{style:"thin",color:{argb:"FF000000"}},right:{style:"thin",color:{argb:"FF000000"}}};a.eachCell(g=>{g.font={name:"Arial",size:10,bold:!0},g.alignment={horizontal:"center",vertical:"middle"},g.border=m});let _=6;e.forEach((g,b)=>{const T=t.getRow(_++);T.values=[b+1,g.supplier_tanggal||(g.supplier_name?`${g.supplier_name} - ${g.tgl_dibuat_fmt||g.tgl_dibuat}`:"-"),g.tgl_dibuat_fmt||g.tgl_dibuat||"-",g.dibuat_oleh||"Admin",g.no_pembelian||"-",g.no_bayar||"-",g.jatuh_tempo_fmt||g.jatuh_tempo||"-",Number(g.hutang)||0,Number(g.dibayar)||0,Number(g.sisa_hutang)||0,Number(g.total_hutang)||0],T.height=20,T.eachCell((y,L)=>{y.border=m,y.font={name:"Arial",size:10},L===1?y.alignment={horizontal:"center",vertical:"middle"}:[3,5,6,7].includes(L)?y.alignment={horizontal:"center",vertical:"middle"}:L>=8?(y.alignment={horizontal:"right",vertical:"middle"},y.numFmt="#,##0.00"):y.alignment={horizontal:"left",vertical:"middle"}})});const N=t.getRow(_);N.height=22;for(let g=1;g<=11;g++)N.getCell(g).border=m,N.getCell(g).font={name:"Arial",size:10,bold:!0};t.mergeCells(`A${_}:H${_}`);const x=t.getCell(`A${_}`);x.value="Total Utang",x.alignment={horizontal:"right",vertical:"middle"},x.font={name:"Arial",size:10,bold:!0};const p=N.getCell(9);p.value=Number(n.total_dibayar??0),p.alignment={horizontal:"right",vertical:"middle"},p.numFmt="#,##0.00",p.font={name:"Arial",size:10,bold:!0};const w=N.getCell(10);w.value=Number(n.total_sisa_hutang??0),w.alignment={horizontal:"right",vertical:"middle"},w.numFmt="#,##0.00",w.font={name:"Arial",size:10,bold:!0};const k=N.getCell(11);k.value=Number(n.total_hutang??0),k.alignment={horizontal:"right",vertical:"middle"},k.numFmt="#,##0.00",k.font={name:"Arial",size:10,bold:!0},t.getColumn(1).width=6,t.getColumn(2).width=32,t.getColumn(3).width=14,t.getColumn(4).width=16,t.getColumn(5).width=20,t.getColumn(6).width=24,t.getColumn(7).width=14,t.getColumn(8).width=16,t.getColumn(9).width=16,t.getColumn(10).width=16,t.getColumn(11).width=16;const E=`Laporan_Hutang_Supplier_${s.from||"all"}_sd_${s.to||"all"}.xlsx`,C=await i.xlsx.writeBuffer(),S=new Blob([C],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),h=window.URL.createObjectURL(S),A=document.createElement("a");return A.href=h,A.download=E,document.body.appendChild(A),A.click(),document.body.removeChild(A),window.URL.revokeObjectURL(h),E}function G({rows:u=[],period:o={},outletName:s="Semua Cabang",summary:d={}}){const c=o.from_formatted&&o.to_formatted?`Per ${o.from_formatted} s/d ${o.to_formatted}`:o.from&&o.to?`Per ${o.from} s/d ${o.to}`:"Semua Periode",n=window.open("","_blank");if(!n){alert("Pop-up browser diblokir. Harap izinkan pop-up untuk mencetak laporan.");return}const e=t=>Number(t||0).toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2}),r=u.map((t,l)=>`
    <tr>
      <td style="text-align:center;">${l+1}</td>
      <td>${t.supplier_tanggal||t.supplier_name||"-"}</td>
      <td style="text-align:center;">${t.tgl_dibuat_fmt||t.tgl_dibuat||"-"}</td>
      <td>${t.dibuat_oleh||"Admin"}</td>
      <td style="text-align:center;">${t.no_pembelian||"-"}</td>
      <td style="text-align:center;">${t.no_bayar||"-"}</td>
      <td style="text-align:center;">${t.jatuh_tempo_fmt||t.jatuh_tempo||"-"}</td>
      <td style="text-align:right;">${e(t.hutang)}</td>
      <td style="text-align:right;">${e(t.dibayar)}</td>
      <td style="text-align:right;">${e(t.sisa_hutang)}</td>
      <td style="text-align:right;">${e(t.total_hutang)}</td>
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
          <td style="text-align: right;">${e(d.total_dibayar)}</td>
          <td style="text-align: right;">${e(d.total_sisa_hutang)}</td>
          <td style="text-align: right;">${e(d.total_hutang)}</td>
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
  `;n.document.open(),n.document.write(i),n.document.close()}async function Q({data:u={},period:o={},businessName:s="MOVA POS",outletName:d="Semua Cabang"}){const c=await $(()=>import("./vendor-exceljs-BPsxf_ah.js").then(h=>O(h.t(),1)),__vite__mapDeps([2,1])),n=new(c.default||c).Workbook;n.creator=s,n.created=new Date;const e=n.addWorksheet("Laporan Neraca",{views:[{showGridLines:!0}]}),r=o.from_formatted&&o.to_formatted?`Per ${o.from_formatted} s/d ${o.to_formatted}`:o.from&&o.to?`Per ${o.from} s/d ${o.to}`:"Semua Periode";e.mergeCells("B1:D1");const i=e.getCell("B1");i.value="LAPORAN NERACA",i.font={name:"Arial",size:13,bold:!0},i.alignment={horizontal:"center",vertical:"middle"},e.getRow(1).height=22,e.mergeCells("B2:E2");const t=e.getCell("B2");t.value=r,t.font={name:"Arial",size:10,italic:!0},t.alignment={horizontal:"left",vertical:"middle"},e.getRow(2).height=18;let l=3;const a=h=>{const A=e.getRow(l++);A.getCell(2).value=h,A.getCell(2).font={name:"Arial",size:10,bold:!0},A.height=18},m=(h,A,g)=>{const b=e.getRow(l++);b.getCell(2).value=h||"",b.getCell(2).font={name:"Arial",size:10},b.getCell(2).alignment={horizontal:"left",vertical:"middle"},b.getCell(3).value=A||"",b.getCell(3).font={name:"Arial",size:10},b.getCell(3).alignment={horizontal:"left",vertical:"middle"},b.getCell(4).value=Number(g)||0,b.getCell(4).font={name:"Arial",size:10},b.getCell(4).alignment={horizontal:"right",vertical:"middle"},b.getCell(4).numFmt="#,##0",b.height=18},_=(h,A)=>{const g=e.getRow(l++);g.getCell(2).value=h,g.getCell(2).font={name:"Arial",size:10,bold:!0},e.mergeCells(`B${l-1}:C${l-1}`),g.getCell(4).value=Number(A)||0,g.getCell(4).font={name:"Arial",size:10,bold:!0},g.getCell(4).alignment={horizontal:"right",vertical:"middle"},g.getCell(4).numFmt="#,##0",g.height=18};a("Aset Lancar"),(u.current_assets?.accounts||[]).forEach(h=>{m(h.code,h.name,h.amount)}),_("Jumlah Aset Lancar",u.current_assets?.subtotal??0),a("Aset Tetap");const N=u.fixed_assets?.accounts||[];N.length>0?N.forEach(h=>{m(h.code,h.name,h.amount)}):m("","Depresiasi & Amortisasi",0),_("Jumlah Aset Tetap",u.fixed_assets?.subtotal??0),a("Liabilitas");const x=u.liabilities?.accounts||[];x.length>0&&x.some(h=>h.amount!==0)&&x.forEach(h=>{m(h.code,h.name,h.amount)}),_("Jumlah Hutang",u.liabilities?.subtotal??0),a("Modal"),(u.equity?.accounts||[]).forEach(h=>{m(h.code,h.name,h.amount)}),_("Jumlah Modal",u.equity?.subtotal??0),l++;const p=e.getRow(l);p.height=22,p.getCell(2).value="Jumlah Aset",p.getCell(2).font={name:"Arial",size:11,bold:!0},e.mergeCells(`B${l}:C${l}`),p.getCell(4).value=Number(u.total_assets?.amount??0),p.getCell(4).font={name:"Arial",size:11,bold:!0},p.getCell(4).alignment={horizontal:"right",vertical:"middle"},p.getCell(4).numFmt="#,##0",p.getCell(6).value="Jumlah Kewajiban dan Modal",p.getCell(6).font={name:"Arial",size:11,bold:!0},p.getCell(6).alignment={horizontal:"right",vertical:"middle"},p.getCell(7).value=Number(u.total_liabilities_and_equity?.amount??0),p.getCell(7).font={name:"Arial",size:11,bold:!0},p.getCell(7).alignment={horizontal:"right",vertical:"middle"},p.getCell(7).numFmt="#,##0",e.getColumn(1).width=4,e.getColumn(2).width=14,e.getColumn(3).width=32,e.getColumn(4).width=18,e.getColumn(5).width=6,e.getColumn(6).width=30,e.getColumn(7).width=18;const w=`Laporan_Neraca_${o.from||"all"}_sd_${o.to||"all"}.xlsx`,k=await n.xlsx.writeBuffer(),E=new Blob([k],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),C=window.URL.createObjectURL(E),S=document.createElement("a");return S.href=C,S.download=w,document.body.appendChild(S),S.click(),document.body.removeChild(S),window.URL.revokeObjectURL(C),w}function Y({data:u={},period:o={},businessName:s="MOVA POS",outletName:d="Semua Cabang"}){const c=o.from_formatted&&o.to_formatted?`Per ${o.from_formatted} s/d ${o.to_formatted}`:o.from&&o.to?`Per ${o.from} s/d ${o.to}`:"Semua Periode",n=window.open("","_blank");if(!n){alert("Pop-up browser diblokir. Harap izinkan pop-up untuk mencetak laporan.");return}const e=t=>Number(t||0).toLocaleString("id-ID",{minimumFractionDigits:0,maximumFractionDigits:0}),r=(t=[])=>t.map(l=>`
      <tr>
        <td style="width: 120px; padding: 4px 8px; color: #475569;">${l.code||""}</td>
        <td style="padding: 4px 8px;">${l.name||""}</td>
        <td style="text-align: right; padding: 4px 8px; font-variant-numeric: tabular-nums;">${e(l.amount)}</td>
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
          <td style="text-align: right;">${e(u.current_assets?.subtotal)}</td>
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
          <td style="text-align: right;">${e(u.fixed_assets?.subtotal)}</td>
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
          <td style="text-align: right;">${e(u.liabilities?.subtotal)}</td>
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
          <td style="text-align: right;">${e(u.equity?.subtotal)}</td>
        </tr>
      </tfoot>
    </table>

    <!-- GRAND TOTAL -->
    <div class="grand-total-box">
      <div>Jumlah Aset: <span style="margin-left: 20px;">Rp ${e(u.total_assets?.amount)}</span></div>
      <div>Jumlah Kewajiban dan Modal: <span style="margin-left: 20px;">Rp ${e(u.total_liabilities_and_equity?.amount)}</span></div>
    </div>

    <script>
      window.onload = function() {
        window.print();
      };
    <\/script>
  </body>
  </html>
  `;n.document.open(),n.document.write(i),n.document.close()}async function Z({businessName:u="URBAE CAFFEINE",period:o="",items:s=[],summary:d={}}){const c=await P(),n=c.utils.book_new(),e=t=>(t||0).toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2}),r=[[u],["Laporan Transaksi Pembelian"],[o||"Per Periode Terpilih"],[],["No.","Tgl","Tgl.Dibuat","Dibuat Oleh","No.Ref","Warehouse","Supplier","Status Terima","Kode Produk","Produk","Harga Beli","","","","","","","Disc Tambahan","PPN","Pengiriman","Pembelian","Dibayar","Utang"],["","","","","","","","","","","QTY","Satuan","QTY Terkecil","Satuan Terkecil","Harga","Disc","Subtotal","","","","","",""]];s.forEach((t,l)=>{r.push([t.no||l+1,t.tgl||"",t.tgl_dibuat||"",t.dibuat_oleh||"",t.no_ref||"",t.warehouse||"",t.supplier||"",t.status_terima||"Diterima",t.kode_produk||"",t.produk||"",t.qty??0,t.satuan||"",t.qty_terkecil??0,t.satuan_terkecil||"",e(t.harga),e(t.disc||0),e(t.subtotal||t.pembelian),e(t.disc_tambahan||0),e(t.ppn||0),e(t.pengiriman||0),e(t.pembelian),e(t.dibayar),e(t.utang)])}),r.push(["Total","","","","","","","","","","","","","","","","",e(d.total_disc_tambahan||0),e(d.total_ppn||0),e(d.total_pengiriman||0),e(d.total_pembelian||0),e(d.total_dibayar||0),e(d.total_utang||0)]);const i=c.utils.aoa_to_sheet(r);i["!cols"]=f(r),c.utils.book_append_sheet(n,i,"Transaksi Pembelian"),c.writeFile(n,`Laporan_Transaksi_Pembelian_${new Date().toISOString().slice(0,10)}.xlsx`)}async function tt({businessName:u="URBAE CAFFEINE",period:o="",items:s=[],summary:d={}}){const c=await P(),n=c.utils.book_new(),e=t=>(t||0).toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2}),r=[[u],["LAPORAN PEMBELIAN PER PRODUK"],[o||"Per Periode Terpilih"],[],["No.","Kode Produk","Nama Produk","Qty Beli","Qty Refund","Satuan","Harga","Disc","Total Nilai Beli","Total Nilai Refund"]];s.forEach((t,l)=>{r.push([t.no||l+1,t.kode_produk||"",t.nama_produk||"",t.qty_beli??0,t.qty_refund??0,t.satuan||"",e(t.harga),e(t.disc||0),e(t.total_nilai_beli),e(t.total_nilai_refund||0)])}),r.push(["Total","","","","","","","",e(d.total_nilai_beli||0),e(d.total_nilai_refund||0)]);const i=c.utils.aoa_to_sheet(r);i["!cols"]=f(r),c.utils.book_append_sheet(n,i,"Pembelian per Produk"),c.writeFile(n,`Laporan_Pembelian_Per_Produk_${new Date().toISOString().slice(0,10)}.xlsx`)}async function at({businessName:u="URBAE CAFFEINE",period:o="",items:s=[],summary:d={}}){const c=await P(),n=c.utils.book_new(),e=t=>(t||0).toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2}),r=[[u],["LAPORAN DAFTAR PEMBELIAN PER SUPPLIER"],[o||"Per Periode Terpilih"],[],["No.","Supplier/Kode Produk","Tgl.Dibuat","Dibuat Oleh","No.Ref","Pembelian","Disc","Pajak","Pengiriman","Total"]];s.forEach((t,l)=>{r.push([t.no||l+1,t.supplier||t.supplier_kode_produk||"",t.tgl_dibuat||"",t.dibuat_oleh||"",t.no_ref||"",e(t.pembelian),e(t.disc||0),e(t.pajak||0),e(t.pengiriman||0),e(t.total)])}),r.push(["Total Pembelian Dari","","","","","","",e(d.total_pembelian||0),"",""]);const i=c.utils.aoa_to_sheet(r);i["!cols"]=f(r),c.utils.book_append_sheet(n,i,"Pembelian per Supplier"),c.writeFile(n,`Laporan_Pembelian_Per_Supplier_${new Date().toISOString().slice(0,10)}.xlsx`)}async function et({businessName:u="URBAE CAFFEINE",period:o="",items:s=[],summary:d={}}){const c=await P(),n=c.utils.book_new(),e=t=>(t||0).toLocaleString("id-ID",{minimumFractionDigits:2,maximumFractionDigits:2}),r=[[u],["LAPORAN PENGIRIMAN PEMBELIAN"],[o||"Per Periode Terpilih"],[],["No.","Supplier/Tanggal","Tgl. Dibuat","Dibuat Oleh","No.Ref","Kode Produk","Nama Produk","Qty","Satuan","Jumlah"]];s.forEach((t,l)=>{r.push([t.no||l+1,t.supplier_tanggal||t.supplier_name||"",t.tgl_dibuat||"",t.dibuat_oleh||"",t.no_ref||"",t.kode_produk||"",t.nama_produk||"",t.qty??0,t.satuan||"",e(t.jumlah)])});const i=c.utils.aoa_to_sheet(r);i["!cols"]=f(r),c.utils.book_append_sheet(n,i,"Pengiriman Pembelian"),c.writeFile(n,`Laporan_Pengiriman_Pembelian_${new Date().toISOString().slice(0,10)}.xlsx`)}export{q as _,U as a,Y as b,et as c,at as d,j as f,V as g,z as h,W as i,Z as l,K as m,J as n,I as o,H as p,B as r,X as s,Q as t,tt as u,M as v,G as x,F as y};
