/**
 * MOVA POS - High-Fidelity Monochrome & Ink-Saver Printing Utility
 * Opens an isolated iframe print context to guarantee clean, full-bleed,
 * 100% black & white / monochrome prints without background color waste,
 * clipped margins, or dark theme interference.
 */
export function printElement(elementId, title = 'Dokumen MOVA POS', options = {}) {
  const el = document.getElementById(elementId);
  if (!el) {
    window.print();
    return;
  }

  const isThermal = Boolean(options.isThermal);
  const orientation = options.orientation || 'portrait';
  const pageSize = options.pageSize || (isThermal ? '80mm auto' : (options.size || `A4 ${orientation}`));
  const margin = options.margin || (isThermal ? '2mm 2mm' : (orientation === 'landscape' ? '8mm 8mm' : '10mm 10mm'));
  const maxWidth = options.maxWidth || (isThermal ? '76mm' : '100%');

  // Create an isolated hidden iframe to prevent styling bleed-through
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
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page {
            size: ${pageSize};
            margin: ${margin};
          }
          
          /* RESET & INK SAVER FOR ALL ELEMENTS */
          *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }

          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
            font-size: ${isThermal ? '10px' : '11px'};
            line-height: ${isThermal ? '1.3' : '1.45'};
            -webkit-font-smoothing: antialiased;
            width: 100%;
          }

          /* FORCE BLACK & WHITE / MONOCHROME CONTRAST */
          body, body * {
            color: #000000 !important;
            border-color: #000000 !important;
          }

          /* ELIMINATE HEAVY COLORED/DARK BACKGROUNDS TO SAVE INK */
          div, section, article, header, footer, tr, th, td, span, p, h1, h2, h3, h4, h5, h6 {
            background-color: transparent !important;
            background-image: none !important;
          }

          /* EXECUTIVE TABLES (BLACK & WHITE HIGH-CONTRAST) */
          table {
            width: 100%;
            border-collapse: collapse !important;
            border: 1px solid #000000 !important;
            margin: 8px 0;
          }

          th {
            background-color: #f4f4f4 !important;
            color: #000000 !important;
            font-weight: 800 !important;
            font-size: 10px !important;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            border: 1px solid #000000 !important;
            padding: 6px 8px !important;
          }

          td {
            border: 1px solid #444444 !important;
            padding: 5px 8px !important;
            font-size: 10.5px;
            color: #000000 !important;
          }

          tr {
            page-break-inside: avoid;
          }

          /* STATUS BADGES & TAGS: MINIMALIST OUTLINE INK-SAVER */
          .badge, .tag, [class*="badge"], [class*="status"], [class*="chip"] {
            background: transparent !important;
            color: #000000 !important;
            border: 1px solid #000000 !important;
            border-radius: 4px !important;
            padding: 1px 6px !important;
            font-weight: 700 !important;
            font-size: 9.5px !important;
            text-transform: uppercase;
            display: inline-block;
          }

          /* MONOSPACE TABULAR FIGURES */
          .mono, [class*="mono"], code, pre {
            font-family: 'JetBrains Mono', 'Courier New', Courier, monospace !important;
            font-variant-numeric: tabular-nums;
          }

          .text-right, .right {
            text-align: right !important;
          }

          .text-center, .center {
            text-align: center !important;
          }

          .text-left, .left {
            text-align: left !important;
          }

          .font-bold, strong, b {
            font-weight: 800 !important;
          }

          /* DIVIDERS */
          hr, .divider, [class*="divider"] {
            border: 0 !important;
            border-top: 1px solid #000000 !important;
            margin: 8px 0;
          }

          /* THERMAL POS RECEIPT & CHIT STYLING (58mm / 80mm) */
          ${isThermal ? `
            body {
              font-family: 'JetBrains Mono', 'Courier New', monospace !important;
              font-size: 10.5px !important;
              line-height: 1.35 !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            table, td, th {
              border: none !important;
              border-collapse: collapse !important;
              padding: 2px 0 !important;
            }
            .thermal-receipt-preview {
              background: #ffffff !important;
              color: #000000 !important;
              padding: 0 !important;
              margin: 0 auto !important;
              width: 100% !important;
              max-width: ${maxWidth} !important;
            }
            div[style*="dashed"], .dashed-line {
              border-bottom: 1px dashed #000000 !important;
            }
            div[style*="solid"], .solid-line {
              border-bottom: 1px solid #000000 !important;
            }
          ` : `
            /* A4 / LETTER FORMAL REPORT STYLING */
            .printable-document {
              padding: 12px !important;
              background: #ffffff !important;
              color: #000000 !important;
            }
            .doc-header {
              border-bottom: 2px solid #000000 !important;
              padding-bottom: 8px !important;
              margin-bottom: 14px !important;
            }
            .doc-title {
              font-size: 16px !important;
              font-weight: 900 !important;
              text-transform: uppercase !important;
              letter-spacing: 0.04em !important;
              color: #000000 !important;
            }
            .signature-area {
              margin-top: 36px !important;
              page-break-inside: avoid;
            }
            .signature-line {
              border-top: 1px solid #000000 !important;
              margin-top: 48px !important;
              padding-top: 4px !important;
              text-align: center !important;
              font-weight: 700 !important;
            }
          `}

          /* IMAGES / LOGOS IN MONOCHROME HIGH-CONTRAST */
          img, svg {
            filter: grayscale(100%) contrast(160%) !important;
          }

          /* HIDE NON-PRINTABLE ELEMENTS */
          .no-print, button, .btn, nav, .sidebar, .mobile-topbar, .modal-header button, input, select {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div style="width: 100%; max-width: ${maxWidth}; margin: 0 auto; background: #ffffff; color: #000000;">
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
