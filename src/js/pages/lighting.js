import { subscribe, publishBoolean, publishNumber, pctToAnalog } from '../signals.js';

const ZONES = [
  { id: 1, onSignal: 'zone1_on', levelSignal: 'zone1_level', nameSignal: 'zone1_name_fb' },
  { id: 2, onSignal: 'zone2_on', levelSignal: 'zone2_level', nameSignal: 'zone2_name_fb' },
  { id: 3, onSignal: 'zone3_on', levelSignal: 'zone3_level', nameSignal: 'zone3_name_fb' },
  { id: 4, onSignal: 'zone4_on', levelSignal: 'zone4_level', nameSignal: 'zone4_name_fb' },
];

const SCENES = [
  { id: 'scene-morning', signal: 'preset_morning', fb: 'preset_morning_fb' },
  { id: 'scene-day',     signal: 'preset_day',     fb: 'preset_day_fb'     },
  { id: 'scene-evening', signal: 'preset_evening', fb: 'preset_evening_fb' },
  { id: 'scene-night',   signal: 'preset_night',   fb: 'preset_night_fb'   },
  { id: 'scene-movie',   signal: 'preset_movie',   fb: 'preset_movie_fb'   },
  { id: 'scene-dinner',  signal: 'preset_dinner',  fb: 'preset_dinner_fb'  },
];

/* Track "active zone count" for subtitle */
const _zoneOn = [false, false, false, false];

function updateSubtitle() {
  const count = _zoneOn.filter(Boolean).length;
  const sub = document.querySelector('#page-lighting .page-subtitle');
  if (sub) sub.textContent = count === 0 ? 'All zones off' : `${count} zone${count > 1 ? 's' : ''} active`;
}

function setSliderFill(zoneId, pct) {
  const fill = document.getElementById(`zone${zoneId}-fill`);
  if (fill) fill.style.width = `${pct}%`;
}

export function initLighting() {
  // ── All On / All Off buttons ──
  const btnAllOn  = document.getElementById('btn-lights-all-on');
  const btnAllOff = document.getElementById('btn-lights-all-off');

  btnAllOn?.addEventListener('pointerdown', () => {
    publishBoolean('lights_master_on', true);
    publishBoolean('lights_master_on', false);
    window.CrestronApp?.toast('All lights on', 'var(--color-accent)');
  });

  btnAllOff?.addEventListener('pointerdown', () => {
    publishBoolean('lights_master_off', true);
    publishBoolean('lights_master_off', false);
    window.CrestronApp?.toast('All lights off', 'var(--color-text-secondary)');
  });

  // ── Scene buttons ──
  SCENES.forEach(({ id, signal, fb }) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('pointerdown', () => {
      publishBoolean(signal, true);
      publishBoolean(signal, false);
    });

    subscribe('b', fb, val => {
      el.classList.toggle('is-active', val);
    });
  });

  // ── Zone controls ──
  ZONES.forEach(({ id, onSignal, levelSignal, nameSignal }) => {
    const row     = document.getElementById(`zone-row-${id}`);
    const toggle  = document.getElementById(`zone${id}-toggle`);
    const slider  = document.getElementById(`zone${id}-slider`);
    const valueEl = document.getElementById(`zone${id}-value`);
    const nameEl  = document.getElementById(`zone${id}-name`);

    // Zone name feedback
    subscribe('s', nameSignal, val => {
      if (nameEl && val) nameEl.textContent = val;
    });

    // Toggle on/off feedback
    subscribe('b', onSignal + '_fb', val => {
      toggle?.classList.toggle('is-on', val);
      row?.classList.toggle('is-on', val);
      _zoneOn[id - 1] = val;
      updateSubtitle();

      if (!val && slider) {
        slider.value = 0;
        setSliderFill(id, 0);
        if (valueEl) valueEl.textContent = 'Off';
      }
    });

    // Level feedback
    subscribe('n', levelSignal + '_fb', val => {
      const pct = Math.round(val);
      if (slider) slider.value = pct;
      setSliderFill(id, pct);
      if (valueEl) valueEl.textContent = pct === 0 ? 'Off' : `${pct}%`;
    });

    // Toggle click
    toggle?.addEventListener('pointerdown', e => {
      e.preventDefault();
      const isOn = toggle.classList.contains('is-on');
      publishBoolean(onSignal, !isOn);
      if (isOn) {
        publishBoolean(onSignal, false);
      } else {
        publishBoolean(onSignal, true);
        // Restore to last non-zero level or 100%
        const lastLevel = parseInt(slider?.value || '100');
        publishNumber(levelSignal, pctToAnalog(lastLevel > 0 ? lastLevel : 100));
      }
    });

    // Slider input
    slider?.addEventListener('input', () => {
      const pct = parseInt(slider.value);
      setSliderFill(id, pct);
      if (valueEl) valueEl.textContent = pct === 0 ? 'Off' : `${pct}%`;
    });

    slider?.addEventListener('change', () => {
      const pct = parseInt(slider.value);
      publishNumber(levelSignal, pctToAnalog(pct));
      if (pct === 0) {
        publishBoolean(onSignal, false);
      } else if (!toggle?.classList.contains('is-on')) {
        publishBoolean(onSignal, true);
      }
    });
  });
}
