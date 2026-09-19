import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ============================================================================
// GLOBAL NUMBER INPUT UX ENHANCEMENT:
// 1. Auto-select text on focus so typing immediately replaces initial values (e.g. 0 -> 1 instead of 01)
// 2. Automatically strip unwanted leading zeros (e.g. '01' -> '1', '05' -> '5') while preserving decimals ('0.5')
// ============================================================================
if (typeof window !== 'undefined') {
  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (
      target &&
      target.tagName === 'INPUT' &&
      (target.type === 'number' || target.inputMode === 'numeric' || target.classList?.contains('mono'))
    ) {
      setTimeout(() => {
        try {
          if (document.activeElement === target) {
            target.select();
          }
        } catch (_) {}
      }, 30);
    }
  });

  document.addEventListener('input', (e) => {
    const target = e.target;
    if (target && target.tagName === 'INPUT' && target.type === 'number') {
      const val = target.value;
      if (val && val.length > 1) {
        if (val.startsWith('0') && val[1] !== '.') {
          const cleaned = val.replace(/^0+(?=\d)/, '');
          if (cleaned !== val) {
            target.value = cleaned;
          }
        } else if (val.startsWith('-0') && val[2] !== '.') {
          const cleaned = val.replace(/^-0+(?=\d)/, '-');
          if (cleaned !== val) {
            target.value = cleaned;
          }
        }
      }
    }
  }, true);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

