// Lazy-load SweetAlert2 — only downloaded when first dialog is triggered (~40KB saved from initial load)
let _swalDark = null;

async function getSwal() {
  if (!_swalDark) {
    const { default: Swal } = await import('sweetalert2');
    _swalDark = Swal.mixin({
      background: '#131836',
      color: '#f8fafc',
      backdrop: 'rgba(5, 8, 22, 0.8)',
      customClass: {
        popup: 'mova-swal-popup',
        title: 'mova-swal-title',
        htmlContainer: 'mova-swal-html',
        confirmButton: 'mova-swal-btn mova-swal-btn-confirm',
        cancelButton: 'mova-swal-btn mova-swal-btn-cancel',
        denyButton: 'mova-swal-btn mova-swal-btn-danger',
        actions: 'mova-swal-actions',
        icon: 'mova-swal-icon',
      },
      buttonsStyling: false,
      reverseButtons: true,
      focusConfirm: false,
    });
  }
  return _swalDark;
}

/**
 * General Confirmation Dialog
 * @param {Object} options
 * @param {string} options.title - Dialog title
 * @param {string} options.text - Dialog body text (plain text)
 * @param {string} [options.html] - Dialog HTML content (optional, overrides text)
 * @param {'warning'|'error'|'success'|'info'|'question'} [options.icon='warning']
 * @param {string} [options.confirmText='Ya, Lanjutkan']
 * @param {string} [options.cancelText='Batal']
 * @param {boolean} [options.isDanger=false] - If true, confirm button gets danger/rose styling
 * @returns {Promise<boolean>}
 */
export async function confirmDialog({
  title = 'Konfirmasi Tindakan',
  text = '',
  html = null,
  icon = 'warning',
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  isDanger = false,
} = {}) {
  const swalDark = await getSwal();

  // If text contains newlines, format it into clean HTML paragraphs
  let formattedHtml = html;
  if (!formattedHtml && text && text.includes('\n')) {
    formattedHtml = text
      .split('\n\n')
      .map(p => `<p style="margin: 0 0 10px 0; line-height: 1.5;">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');
  }

  const result = await swalDark.fire({
    title,
    text: formattedHtml ? undefined : text,
    html: formattedHtml || undefined,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    customClass: {
      popup: 'mova-swal-popup',
      title: 'mova-swal-title',
      htmlContainer: 'mova-swal-html',
      confirmButton: isDanger ? 'mova-swal-btn mova-swal-btn-danger' : 'mova-swal-btn mova-swal-btn-confirm',
      cancelButton: 'mova-swal-btn mova-swal-btn-cancel',
      actions: 'mova-swal-actions',
      icon: 'mova-swal-icon',
    },
  });

  return result.isConfirmed;
}

/**
 * Specialized Owner Bisnis Rollback / High-Risk Confirmation Dialog
 * @param {Object} options
 * @param {string} options.title - e.g. "Hapus permanen transaksi mutasi terakhir?"
 * @param {string} options.targetName - e.g. 'MVT-59 (2026-09-26)'
 * @param {string[]} options.bullets - System automation steps / impacts
 * @param {string} [options.confirmText='Ya, Hapus & Rollback']
 * @param {string} [options.cancelText='Batal']
 * @returns {Promise<boolean>}
 */
export async function ownerConfirmDialog({
  title = 'PERINGATAN KHUSUS OWNER BISNIS',
  subtitle = '',
  targetName = '',
  bullets = [],
  confirmText = 'Ya, Hapus Permanen',
  cancelText = 'Batal',
} = {}) {
  const swalDark = await getSwal();

  const bulletsHtml = bullets && bullets.length > 0
    ? `<div style="text-align: left; background: rgba(15, 20, 41, 0.7); border: 1px solid rgba(165, 180, 252, 0.15); border-radius: 10px; padding: 14px 16px; margin: 14px 0 16px 0;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #f59e0b; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
          <span>⚡</span> Dampak Otomatis Sistem:
        </div>
        <ol style="margin: 0; padding-left: 18px; color: #cbd5e1; font-size: 12.5px; line-height: 1.6;">
          ${bullets.map(b => `<li style="margin-bottom: 4px;">${b}</li>`).join('')}
        </ol>
      </div>`
    : '';

  const htmlContent = `
    <div style="font-size: 13.5px; color: #e2e8f0; line-height: 1.5;">
      ${targetName ? `<div style="margin-bottom: 10px; font-weight: 600; color: #ffffff;">${targetName}</div>` : ''}
      ${subtitle ? `<p style="margin-bottom: 8px; color: #94a3b8;">${subtitle}</p>` : ''}
      ${bulletsHtml}
      <div style="font-size: 12px; color: #f43f5e; font-weight: 600; margin-top: 6px;">
        ⚠️ Tindakan ini akan membatalkan data dan mengkalkulasi ulang data historis secara permanen.
      </div>
    </div>
  `;

  const result = await swalDark.fire({
    title: `<div style="display: flex; align-items: center; justify-content: center; gap: 8px; color: #f59e0b; font-size: 16px; font-weight: 800; letter-spacing: 0.04em;">
      <span>🛡️</span> ${title}
    </div>`,
    html: htmlContent,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    customClass: {
      popup: 'mova-swal-popup mova-swal-popup-danger',
      title: 'mova-swal-title',
      htmlContainer: 'mova-swal-html',
      confirmButton: 'mova-swal-btn mova-swal-btn-danger',
      cancelButton: 'mova-swal-btn mova-swal-btn-cancel',
      actions: 'mova-swal-actions',
      icon: 'mova-swal-icon',
    },
  });

  return result.isConfirmed;
}

/**
 * Success Alert Dialog
 */
export async function alertSuccess({ title = 'Berhasil!', text = '', html = null, timer = 2500 } = {}) {
  const swalDark = await getSwal();
  return swalDark.fire({
    title,
    text: html ? undefined : text,
    html: html || undefined,
    icon: 'success',
    timer,
    timerProgressBar: true,
    showConfirmButton: false,
  });
}

/**
 * Error Alert Dialog
 */
export async function alertError({ title = 'Terjadi Kesalahan', text = '', html = null } = {}) {
  const swalDark = await getSwal();
  return swalDark.fire({
    title,
    text: html ? undefined : text,
    html: html || undefined,
    icon: 'error',
    confirmButtonText: 'Tutup',
    customClass: {
      popup: 'mova-swal-popup',
      title: 'mova-swal-title',
      htmlContainer: 'mova-swal-html',
      confirmButton: 'mova-swal-btn mova-swal-btn-confirm',
      actions: 'mova-swal-actions',
      icon: 'mova-swal-icon',
    },
  });
}

export default {
  fire: async (...args) => { const s = await getSwal(); return s.fire(...args); },
  confirm: confirmDialog,
  ownerConfirm: ownerConfirmDialog,
  success: alertSuccess,
  error: alertError,
};
