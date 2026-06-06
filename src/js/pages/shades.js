import { subscribe, publishBoolean, publishNumber, pctToAnalog } from '../signals.js';

const SHADE_ZONES = [
  { id: 1, name: 'Living Room',    open: 'shade1_open', close: 'shade1_close', stop: 'shade1_stop', pos: 'shade1_position', posFb: 'shade1_position_fb' },
  { id: 2, name: 'Master Bedroom', open: 'shade2_open', close: 'shade2_close', stop: 'shade2_stop', pos: 'shade2_position', posFb: 'shade2_position_fb' },
  { id: 3, name: 'Kitchen',        open: 'shade3_open', close: 'shade3_close', stop: 'shade3_stop', pos: 'shade3_position', posFb: 'shade3_position_fb' },
  { id: 4, name: 'Home Office',    open: 'shade4_open', close: 'shade4_close', stop: 'shade4_stop', pos: 'shade4_position', posFb: 'shade4_position_fb' },
];

const PRESET_SIGS = [
  { signal: 'shades_preset_open',     label: 'Opening All Shades'  },
  { signal: 'shades_preset_privacy',  label: 'Privacy Mode'        },
  { signal: 'shades_preset_blackout', label: 'Blackout Mode'       },
  { signal: 'shades_preset_close',    label: 'Closing All Shades'  },
];

function posLabel(pct) {
  if (pct === 0)   return 'Closed (0%)';
  if (pct === 100) return 'Open (100%)';
  return `${pct}% open`;
}

export function initShades() {
  // ── Preset buttons (use querySelectorAll on shades page) ──
  const page = document.getElementById('page-shades');
  if (!page) return;

  PRESET_SIGS.forEach(({ signal, label }) => {
    page.querySelectorAll(`[data-signal="${signal}"]`).forEach(btn => {
      btn.addEventListener('pointerdown', () => {
        publishBoolean(signal, true);
        publishBoolean(signal, false);
        window.CrestronApp?.toast(label, 'var(--color-blue)');
      });
    });
  });

  // ── Per-zone controls ──
  SHADE_ZONES.forEach(({ id, open, close, stop, pos, posFb }) => {
    const openBtns = page.querySelectorAll(`[data-signal="${open}"]`);
    const closeBtns = page.querySelectorAll(`[data-signal="${close}"]`);
    const stopBtns  = page.querySelectorAll(`[data-signal="${stop}"]`);
    const slider    = document.getElementById(`shade${id}-slider`);
    const fill      = document.getElementById(`shade${id}-fill`);
    const posLabel_ = document.getElementById(`shade${id}-pos-label`);

    // Open / Close / Stop press
    openBtns.forEach(btn => btn.addEventListener('pointerdown', () => {
      publishBoolean(open, true);
      publishBoolean(open, false);
    }));

    closeBtns.forEach(btn => btn.addEventListener('pointerdown', () => {
      publishBoolean(close, true);
      publishBoolean(close, false);
    }));

    stopBtns.forEach(btn => btn.addEventListener('pointerdown', () => {
      publishBoolean(stop, true);
      publishBoolean(stop, false);
    }));

    // Position slider
    slider?.addEventListener('input', () => {
      const pct = parseInt(slider.value);
      if (fill)     fill.style.width = `${pct}%`;
      if (posLabel_) posLabel_.textContent = posLabel(pct);
    });

    slider?.addEventListener('change', () => {
      publishNumber(pos, pctToAnalog(parseInt(slider.value)));
    });

    // Position feedback
    subscribe('n', posFb, val => {
      const pct = Math.round(val);
      if (slider)   slider.value = pct;
      if (fill)     fill.style.width = `${pct}%`;
      if (posLabel_) posLabel_.textContent = posLabel(pct);
    });
  });
}
