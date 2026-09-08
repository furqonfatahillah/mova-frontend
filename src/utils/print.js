/**
 * MOVA POS - High-Fidelity Printing Utility
 * Opens an isolated iframe print context to guarantee clean, full-bleed,
 * unclipped prints without interference from SPA layout, modals, or dark theme.
 */
export function printElement(elementId, title = 'Dokumen MOVA POS', options = {}) {
  const el = document.getElementById(elementId);
  if (!el) {
    window.print();
    return;
  }

  const orientation = options.orientation || 'portrait';
  const pageSize = options.pageSize || (options.size || `A4 ${orientation}`);
  const margin = options.margin || (options.isThermal ? '2mm 2mm' : (orientation === 'landscape' ? '8mm 8mm' : '12mm 10mm'));
  const maxWidth = options.maxWidth || (options.isThermal ? '78mm' : '100%');

  // Create an isolated hidden iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'mova-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          @page {
            size: ${pageSize};
            margin: ${margin};
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
        <div style="width: 100%; max-width: ${maxWidth}; margin: 0 auto; background: #ffffff; color: #0f172a;">
          ${el.innerHTML}
        </div>
      </body>
    </html>
  `);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow.print();
    } catch (e) {
      console.error('Print iframe error:', e);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }
  }, 350);
}
