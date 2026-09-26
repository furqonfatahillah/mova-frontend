import{i as e}from"./rolldown-runtime-Dd_uD5pT.js";import{t}from"./vendor-swal-DE2fQM20.js";var n=e(t(),1).default.mixin({background:`#131836`,color:`#f8fafc`,backdrop:`rgba(5, 8, 22, 0.8)`,customClass:{popup:`mova-swal-popup`,title:`mova-swal-title`,htmlContainer:`mova-swal-html`,confirmButton:`mova-swal-btn mova-swal-btn-confirm`,cancelButton:`mova-swal-btn mova-swal-btn-cancel`,denyButton:`mova-swal-btn mova-swal-btn-danger`,actions:`mova-swal-actions`,icon:`mova-swal-icon`},buttonsStyling:!1,reverseButtons:!0,focusConfirm:!1});async function r({title:e=`Konfirmasi Tindakan`,text:t=``,html:r=null,icon:i=`warning`,confirmText:a=`Ya, Lanjutkan`,cancelText:o=`Batal`,isDanger:s=!1}={}){let c=r;return!c&&t&&t.includes(`
`)&&(c=t.split(`

`).map(e=>`<p style="margin: 0 0 10px 0; line-height: 1.5;">${e.replace(/\n/g,`<br/>`)}</p>`).join(``)),(await n.fire({title:e,text:c?void 0:t,html:c||void 0,icon:i,showCancelButton:!0,confirmButtonText:a,cancelButtonText:o,customClass:{popup:`mova-swal-popup`,title:`mova-swal-title`,htmlContainer:`mova-swal-html`,confirmButton:s?`mova-swal-btn mova-swal-btn-danger`:`mova-swal-btn mova-swal-btn-confirm`,cancelButton:`mova-swal-btn mova-swal-btn-cancel`,actions:`mova-swal-actions`,icon:`mova-swal-icon`}})).isConfirmed}async function i({title:e=`PERINGATAN KHUSUS OWNER BISNIS`,subtitle:t=``,targetName:r=``,bullets:i=[],confirmText:a=`Ya, Hapus Permanen`,cancelText:o=`Batal`}={}){let s=i&&i.length>0?`<div style="text-align: left; background: rgba(15, 20, 41, 0.7); border: 1px solid rgba(165, 180, 252, 0.15); border-radius: 10px; padding: 14px 16px; margin: 14px 0 16px 0;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #f59e0b; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
          <span>⚡</span> Dampak Otomatis Sistem:
        </div>
        <ol style="margin: 0; padding-left: 18px; color: #cbd5e1; font-size: 12.5px; line-height: 1.6;">
          ${i.map(e=>`<li style="margin-bottom: 4px;">${e}</li>`).join(``)}
        </ol>
      </div>`:``,c=`
    <div style="font-size: 13.5px; color: #e2e8f0; line-height: 1.5;">
      ${r?`<div style="margin-bottom: 10px; font-weight: 600; color: #ffffff;">${r}</div>`:``}
      ${t?`<p style="margin-bottom: 8px; color: #94a3b8;">${t}</p>`:``}
      ${s}
      <div style="font-size: 12px; color: #f43f5e; font-weight: 600; margin-top: 6px;">
        ⚠️ Tindakan ini akan membatalkan data dan mengkalkulasi ulang data historis secara permanen.
      </div>
    </div>
  `;return(await n.fire({title:`<div style="display: flex; align-items: center; justify-content: center; gap: 8px; color: #f59e0b; font-size: 16px; font-weight: 800; letter-spacing: 0.04em;">
      <span>🛡️</span> ${e}
    </div>`,html:c,icon:`warning`,showCancelButton:!0,confirmButtonText:a,cancelButtonText:o,customClass:{popup:`mova-swal-popup mova-swal-popup-danger`,title:`mova-swal-title`,htmlContainer:`mova-swal-html`,confirmButton:`mova-swal-btn mova-swal-btn-danger`,cancelButton:`mova-swal-btn mova-swal-btn-cancel`,actions:`mova-swal-actions`,icon:`mova-swal-icon`}})).isConfirmed}n.fire.bind(n);export{i as n,r as t};