import { subscribe, publishBoolean, publishNumber, pctToAnalog } from '../signals.js';

const SOURCES = [
  { id: 'src-appletv', signal: 'source_appletv', fb: 'source_appletv_fb', label: 'Apple TV' },
  { id: 'src-tv',      signal: 'source_tv',      fb: 'source_tv_fb',      label: 'TV'       },
  { id: 'src-cable',   signal: 'source_cable',   fb: 'source_cable_fb',   label: 'Cable'    },
  { id: 'src-bluray',  signal: 'source_bluray',  fb: 'source_bluray_fb',  label: 'Blu-ray'  },
  { id: 'src-radio',   signal: 'source_radio',   fb: 'source_radio_fb',   label: 'Radio'    },
  { id: 'src-aux',     signal: 'source_aux',     fb: 'source_aux_fb',     label: 'Aux'      },
];

let _isPlaying = true;
let _isMuted   = false;
let _avOn      = true;

export function initAV() {
  // ── Power button ──
  const powerBtn = document.getElementById('av-power-btn');
  powerBtn?.addEventListener('pointerdown', () => {
    _avOn = !_avOn;
    publishBoolean(_avOn ? 'av_power_on' : 'av_power_off', true);
    publishBoolean(_avOn ? 'av_power_on' : 'av_power_off', false);
    powerBtn.classList.toggle('is-on', _avOn);
    powerBtn.classList.toggle('is-off', !_avOn);
    window.CrestronApp?.toast(_avOn ? 'A/V System On' : 'A/V System Off');
  });

  subscribe('b', 'av_power_fb', val => {
    _avOn = val;
    powerBtn?.classList.toggle('is-on', val);
    powerBtn?.classList.toggle('is-off', !val);
  });

  // ── Sources ──
  SOURCES.forEach(({ id, signal, fb, label }) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('pointerdown', () => {
      publishBoolean(signal, true);
      publishBoolean(signal, false);
      window.CrestronApp?.toast(`Source: ${label}`, 'var(--color-blue)');
    });

    subscribe('b', fb, val => {
      el.classList.toggle('is-active', val);
      if (val) {
        const sub = document.getElementById('av-status-sub');
        if (sub) sub.textContent = `${label} — Living Room`;
      }
    });
  });

  // ── Now Playing ──
  subscribe('s', 'now_playing_fb', val => {
    const titleEl  = document.getElementById('np-title');
    const sourceEl = document.getElementById('np-source');
    if (!val) return;

    const parts = val.split(' — ');
    if (titleEl) titleEl.textContent = parts[0] || val;
    if (sourceEl) sourceEl.textContent = parts.slice(1).join(' — ') || '';
  });

  subscribe('s', 'source_name_fb', val => {
    const el = document.getElementById('np-source');
    if (el && val) {
      const current = el.textContent;
      const track   = current.split(' — ')[0];
      el.textContent = `${track} — ${val}`;
    }
  });

  // ── Transport ──
  const playBtn  = document.getElementById('btn-play');
  const playIcon = document.getElementById('play-icon');

  playBtn?.addEventListener('pointerdown', () => {
    _isPlaying = !_isPlaying;
    publishBoolean(_isPlaying ? 'transport_play' : 'transport_pause', true);
    publishBoolean(_isPlaying ? 'transport_play' : 'transport_pause', false);
    if (playIcon) {
      playIcon.innerHTML = _isPlaying
        ? '<use href="#icon-pause"/>'
        : '<use href="#icon-play"/>';
    }
  });

  subscribe('b', 'transport_playing_fb', val => {
    _isPlaying = val;
    if (playIcon) {
      playIcon.innerHTML = val
        ? '<use href="#icon-pause"/>'
        : '<use href="#icon-play"/>';
    }
  });

  document.getElementById('btn-prev')?.addEventListener('pointerdown', () => {
    publishBoolean('transport_prev', true);
    publishBoolean('transport_prev', false);
  });

  document.getElementById('btn-next')?.addEventListener('pointerdown', () => {
    publishBoolean('transport_next', true);
    publishBoolean('transport_next', false);
  });

  // ── Volume ──
  const volSlider = document.getElementById('vol-slider');
  const volFill   = document.getElementById('vol-fill');
  const volDisp   = document.getElementById('vol-display');

  function updateVolUI(pct) {
    if (volSlider) volSlider.value = pct;
    if (volFill)   volFill.style.width = `${pct}%`;
    if (volDisp)   volDisp.textContent = pct;
  }

  subscribe('n', 'volume_level_fb', val => updateVolUI(val));

  volSlider?.addEventListener('input', () => {
    const pct = parseInt(volSlider.value);
    if (volFill)  volFill.style.width = `${pct}%`;
    if (volDisp)  volDisp.textContent = pct;
  });

  volSlider?.addEventListener('change', () => {
    publishNumber('volume_level', pctToAnalog(parseInt(volSlider.value)));
  });

  // Vol up/down buttons (discrete)
  document.getElementById('btn-vol-up')?.addEventListener('pointerdown', () => {
    publishBoolean('vol_up', true);
    publishBoolean('vol_up', false);
    const cur = parseInt(volSlider?.value || '50');
    const next = Math.min(100, cur + 5);
    updateVolUI(next);
    publishNumber('volume_level', pctToAnalog(next));
  });

  document.getElementById('btn-vol-down')?.addEventListener('pointerdown', () => {
    publishBoolean('vol_down', true);
    publishBoolean('vol_down', false);
    const cur = parseInt(volSlider?.value || '50');
    const next = Math.max(0, cur - 5);
    updateVolUI(next);
    publishNumber('volume_level', pctToAnalog(next));
  });

  // ── Mute ──
  const muteBtn  = document.getElementById('btn-mute');
  const muteIcon = document.getElementById('mute-icon');

  muteBtn?.addEventListener('pointerdown', () => {
    _isMuted = !_isMuted;
    publishBoolean('vol_mute', _isMuted);
    if (muteIcon) {
      muteIcon.innerHTML = _isMuted
        ? '<use href="#icon-volume-off"/>'
        : '<use href="#icon-volume"/>';
    }
    muteBtn.style.color = _isMuted ? 'var(--color-red)' : '';
  });

  subscribe('b', 'vol_mute_fb', val => {
    _isMuted = val;
    if (muteIcon) {
      muteIcon.innerHTML = val
        ? '<use href="#icon-volume-off"/>'
        : '<use href="#icon-volume"/>';
    }
    if (muteBtn) muteBtn.style.color = val ? 'var(--color-red)' : '';
  });
}
