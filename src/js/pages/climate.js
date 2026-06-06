import { subscribe, publishBoolean, publishNumber } from '../signals.js';

const HVAC_MODES = [
  { id: 'mode-cool', signal: 'hvac_mode_cool', fb: 'hvac_mode_cool_fb', cls: 'cool' },
  { id: 'mode-heat', signal: 'hvac_mode_heat', fb: 'hvac_mode_heat_fb', cls: 'heat' },
  { id: 'mode-auto', signal: 'hvac_mode_auto', fb: 'hvac_mode_auto_fb', cls: 'auto' },
  { id: 'mode-off',  signal: 'hvac_mode_off',  fb: 'hvac_mode_off_fb',  cls: ''     },
];

const FAN_SPEEDS = [
  { id: 'fan-auto', signal: 'fan_speed_auto', fb: 'fan_speed_auto_fb' },
  { id: 'fan-low',  signal: 'fan_speed_low',  fb: 'fan_speed_low_fb'  },
  { id: 'fan-med',  signal: 'fan_speed_med',  fb: 'fan_speed_med_fb'  },
  { id: 'fan-high', signal: 'fan_speed_high', fb: 'fan_speed_high_fb' },
];

let _coolSp = 68;
let _heatSp = 65;

function updateChipColor(mode) {
  const chip = document.getElementById('climate-mode-chip');
  if (!chip) return;
  chip.className = 'chip';
  const map = { cool: 'chip--blue', heat: 'chip--red', auto: 'chip--accent', off: 'chip--muted' };
  const labels = { cool: 'Cooling', heat: 'Heating', auto: 'Auto', off: 'Off' };
  chip.classList.add(map[mode] || 'chip--muted');
  chip.textContent = labels[mode] || mode;
}

export function initClimate() {
  // ── Current temperature ──
  subscribe('n', 'current_temp_fb', val => {
    const el = document.getElementById('current-temp');
    if (el) el.textContent = val;
  });

  // ── Humidity ──
  subscribe('n', 'humidity_fb', val => {
    const el = document.getElementById('humidity-display');
    if (el) el.textContent = val;
  });

  // ── HVAC status text ──
  subscribe('s', 'hvac_status_fb', val => {
    const el  = document.getElementById('hvac-status-text');
    const sub = document.getElementById('climate-status-text');
    if (el)  el.textContent  = val;
    if (sub) sub.textContent = val;
  });

  // ── Cool setpoint feedback ──
  subscribe('n', 'setpoint_cool_fb', val => {
    _coolSp = val;
    const el = document.getElementById('setpoint-cool-val');
    if (el) el.textContent = `${val}°`;
  });

  // ── Heat setpoint feedback ──
  subscribe('n', 'setpoint_heat_fb', val => {
    _heatSp = val;
    const el = document.getElementById('setpoint-heat-val');
    if (el) el.textContent = `${val}°`;
  });

  // ── HVAC mode buttons ──
  HVAC_MODES.forEach(({ id, signal, fb, cls }) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.addEventListener('pointerdown', () => {
      publishBoolean(signal, true);
      publishBoolean(signal, false);
    });

    subscribe('b', fb, val => {
      btn.classList.toggle('is-active', val);
      if (val && cls) updateChipColor(cls || 'off');
      if (val && id === 'mode-off') updateChipColor('off');
    });
  });

  // ── Fan speed buttons ──
  FAN_SPEEDS.forEach(({ id, signal, fb }) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.addEventListener('pointerdown', () => {
      publishBoolean(signal, true);
      publishBoolean(signal, false);
    });

    subscribe('b', fb, val => {
      btn.classList.toggle('is-active', val);
    });
  });

  // ── Setpoint up/down ──
  const coolUp   = document.getElementById('cool-sp-up');
  const coolDown = document.getElementById('cool-sp-down');
  const heatUp   = document.getElementById('heat-sp-up');
  const heatDown = document.getElementById('heat-sp-down');

  coolUp?.addEventListener('pointerdown', () => {
    _coolSp = Math.min(85, _coolSp + 1);
    publishNumber('setpoint_cool', _coolSp);
    const el = document.getElementById('setpoint-cool-val');
    if (el) el.textContent = `${_coolSp}°`;
  });

  coolDown?.addEventListener('pointerdown', () => {
    _coolSp = Math.max(60, _coolSp - 1);
    publishNumber('setpoint_cool', _coolSp);
    const el = document.getElementById('setpoint-cool-val');
    if (el) el.textContent = `${_coolSp}°`;
  });

  heatUp?.addEventListener('pointerdown', () => {
    _heatSp = Math.min(80, _heatSp + 1);
    publishNumber('setpoint_heat', _heatSp);
    const el = document.getElementById('setpoint-heat-val');
    if (el) el.textContent = `${_heatSp}°`;
  });

  heatDown?.addEventListener('pointerdown', () => {
    _heatSp = Math.max(55, _heatSp - 1);
    publishNumber('setpoint_heat', _heatSp);
    const el = document.getElementById('setpoint-heat-val');
    if (el) el.textContent = `${_heatSp}°`;
  });
}
