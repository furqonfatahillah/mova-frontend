function e(e,t=`Dokumen MOVA POS`,n={}){let r=document.getElementById(e);if(!r){window.print();return}let i=n.orientation||`portrait`,a=n.pageSize||n.size||`A4 ${i}`,o=n.margin||(n.isThermal?`2mm 2mm`:i===`landscape`?`8mm 8mm`:`12mm 10mm`),s=n.maxWidth||(n.isThermal?`78mm`:`100%`),c=document.createElement(`iframe`);c.id=`mova-print-frame`,c.style.position=`fixed`,c.style.right=`0`,c.style.bottom=`0`,c.style.width=`0`,c.style.height=`0`,c.style.border=`0`,c.style.zIndex=`-9999`,document.body.appendChild(c);let l=c.contentWindow.document;l.open(),l.write(`
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>${t}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          @page {
            size: ${a};
            margin: ${o};
          }
          *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body {
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
            background: #ffffff !important;
            color: #0f172a !important;
            padding: 0;
            margin: 0;
            font-size: 11.5px;
            line-height: 1.4;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          tr {
            page-break-inside: avoid;
          }
          .mono {
            font-family: 'JetBrains Mono', monospace;
          }
          .no-print {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div style="width: 100%; max-width: ${s}; margin: 0 auto; background: #ffffff; color: #0f172a;">
          ${r.innerHTML}
        </div>
      </body>
    </html>
  `),l.close(),c.contentWindow.focus(),setTimeout(()=>{try{c.contentWindow.print()}catch(e){console.error(`Print iframe error:`,e),window.print()}finally{setTimeout(()=>{document.body.contains(c)&&document.body.removeChild(c)},1500)}},350)}export{e as t};