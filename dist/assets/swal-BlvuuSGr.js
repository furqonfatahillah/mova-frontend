const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/vendor-swal-O8JAHeIm.js","assets/rolldown-runtime-kjsH4l9N.js"])))=>i.map(i=>d[i]);
import{i as f}from"./rolldown-runtime-kjsH4l9N.js";import{d as w}from"./vendor-router-CW5hKwT5.js";var c=null;async function p(){if(!c){const{default:o}=await w(async()=>{const{default:a}=await import("./vendor-swal-O8JAHeIm.js").then(t=>f(t.t(),1));return{default:a}},__vite__mapDeps([0,1]));c=o.mixin({background:"#131836",color:"#f8fafc",backdrop:"rgba(5, 8, 22, 0.8)",customClass:{popup:"mova-swal-popup",title:"mova-swal-title",htmlContainer:"mova-swal-html",confirmButton:"mova-swal-btn mova-swal-btn-confirm",cancelButton:"mova-swal-btn mova-swal-btn-cancel",denyButton:"mova-swal-btn mova-swal-btn-danger",actions:"mova-swal-actions",icon:"mova-swal-icon"},buttonsStyling:!1,reverseButtons:!0,focusConfirm:!1})}return c}async function d({title:o="Konfirmasi Tindakan",text:a="",html:t=null,icon:i="warning",confirmText:l="Ya, Lanjutkan",cancelText:e="Batal",isDanger:s=!1}={}){const m=await p();let n=t;return!n&&a&&a.includes(`
`)&&(n=a.split(`

`).map(r=>`<p style="margin: 0 0 10px 0; line-height: 1.5;">${r.replace(/\n/g,"<br/>")}</p>`).join("")),(await m.fire({title:o,text:n?void 0:a,html:n||void 0,icon:i,showCancelButton:!0,confirmButtonText:l,cancelButtonText:e,customClass:{popup:"mova-swal-popup",title:"mova-swal-title",htmlContainer:"mova-swal-html",confirmButton:s?"mova-swal-btn mova-swal-btn-danger":"mova-swal-btn mova-swal-btn-confirm",cancelButton:"mova-swal-btn mova-swal-btn-cancel",actions:"mova-swal-actions",icon:"mova-swal-icon"}})).isConfirmed}async function g({title:o="PERINGATAN KHUSUS OWNER BISNIS",subtitle:a="",targetName:t="",bullets:i=[],confirmText:l="Ya, Hapus Permanen",cancelText:e="Batal"}={}){const s=await p(),m=i&&i.length>0?`<div style="text-align: left; background: rgba(15, 20, 41, 0.7); border: 1px solid rgba(165, 180, 252, 0.15); border-radius: 10px; padding: 14px 16px; margin: 14px 0 16px 0;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #f59e0b; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
          <span>⚡</span> Dampak Otomatis Sistem:
        </div>
        <ol style="margin: 0; padding-left: 18px; color: #cbd5e1; font-size: 12.5px; line-height: 1.6;">
          ${i.map(r=>`<li style="margin-bottom: 4px;">${r}</li>`).join("")}
        </ol>
      </div>`:"",n=`
    <div style="font-size: 13.5px; color: #e2e8f0; line-height: 1.5;">
      ${t?`<div style="margin-bottom: 10px; font-weight: 600; color: #ffffff;">${t}</div>`:""}
      ${a?`<p style="margin-bottom: 8px; color: #94a3b8;">${a}</p>`:""}
      ${m}
      <div style="font-size: 12px; color: #f43f5e; font-weight: 600; margin-top: 6px;">
        ⚠️ Tindakan ini akan membatalkan data dan mengkalkulasi ulang data historis secara permanen.
      </div>
    </div>
  `;return(await s.fire({title:`<div style="display: flex; align-items: center; justify-content: center; gap: 8px; color: #f59e0b; font-size: 16px; font-weight: 800; letter-spacing: 0.04em;">
      <span>🛡️</span> ${o}
    </div>`,html:n,icon:"warning",showCancelButton:!0,confirmButtonText:l,cancelButtonText:e,customClass:{popup:"mova-swal-popup mova-swal-popup-danger",title:"mova-swal-title",htmlContainer:"mova-swal-html",confirmButton:"mova-swal-btn mova-swal-btn-danger",cancelButton:"mova-swal-btn mova-swal-btn-cancel",actions:"mova-swal-actions",icon:"mova-swal-icon"}})).isConfirmed}export{g as n,d as t};
