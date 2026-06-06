/**
 * Crestron CH5 UI — Main Application Controller
 * Target: TS-770 (1280×800) and iPad via WebXPanel
 */

import { subscribe, unsubscribe, publishBoolean, publishNumber, pctToAnalog } from './signals.js';
import { initLighting }  from './pages/lighting.js';
import { initClimate }   from './pages/climate.js';
import { initAV }        from './pages/av.js';
import { initShades }    from './pages/shades.js';

/* ─────────────────────────────────────────
   Router
───────────────────────────────────────── */
const PAGES = ['home', 'lighting', 'climate', 'av', 'shades'];
let _currentPage = 'home';
let _prevPage    = null;

function nav(pageId) {
  if (!PAGES.includes(pageId) || pageId === _currentPage) return;

  const fromEl = document.getElementById(`page-${_currentPage}`);
  const toEl   = document.getElementById(`page-${pageId}`);
  const fromNav = document.getElementById(`nav-${_currentPage}`);
  const toNav   = document.getElementById(`nav-${pageId}`);

  if (fromEl) {
    fromEl.classList.remove('active');
    fromEl.classList.add('exit-left');
    setTimeout(() => fromEl.classList.remove('exit-left'), 400);
  }
  if (fromNav) fromNav.classList.remove('active');

  if (toEl)   toEl.classList.add('active');
  if (toNav)  toNav.classList.add('active');

  _prevPage    = _currentPage;
  _currentPage = pageId;
}

/* ─────────────────────────────────────────
   Status Bar — Clock
───────────────────────────────────────── */
function updateClock() {
  const now   = new Date();
  const timeEl = document.getElementById('status-time');
  const dateEl = document.getElementById('status-date');

  const h  = now.getHours();
  const m  = String(now.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  if (timeEl) timeEl.textContent = `${h12}:${m} ${ap}`;

  const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (dateEl) {
    dateEl.textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
  }

  // Update greeting
  const greetEl = document.getElementById('page-home')?.querySelector('.page-title');
  if (greetEl) {
    if      (h < 12) greetEl.textContent = 'Good Morning';
    else if (h < 17) greetEl.textContent = 'Good Afternoon';
    else             greetEl.textContent = 'Good Evening';
  }
}

/* ─────────────────────────────────────────
   Connection Overlay
───────────────────────────────────────── */
function showConnecting() {
  const overlay = document.getElementById('connection-overlay');
  if (overlay) overlay.classList.remove('hidden');
}

function hideConnecting() {
  const overlay = document.getElementById('connection-overlay');
  if (overlay) overlay.classList.add('hidden');
}

/* ─────────────────────────────────────────
   Toast Notifications
───────────────────────────────────────── */
function toast(message, color = 'var(--color-accent)') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <div class="toast__dot" style="background:${color}"></div>
    <div class="toast__message">${message}</div>
  `;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('exiting');
    setTimeout(() => el.remove(), 250);
  }, 2800);
}

/* ─────────────────────────────────────────
   Home Page — signal subscriptions
───────────────────────────────────────── */
const _homeSubs = [];

function initHome() {
  // Status bar temperature from climate feedback
  _homeSubs.push(
    subscribe('n', 'current_temp_fb', val => {
      const el = document.getElementById('status-temp');
      if (el) el.textContent = `${val}°`;
      const card = document.getElementById('home-climate-display');
      if (card) card.textContent = `${val}°F`;
    })
  );

  _homeSubs.push(
    subscribe('n', 'humidity_fb', val => {
      const el = document.getElementById('status-humidity');
      if (el) el.textContent = `${val}%`;
    })
  );

  // A/V source name on home card
  _homeSubs.push(
    subscribe('s', 'source_name_fb', val => {
      const el = document.getElementById('home-av-source');
      if (el) el.textContent = val || '—';
    })
  );

  // A/V power
  _homeSubs.push(
    subscribe('b', 'av_power_fb', val => {
      const el = document.getElementById('home-av-source');
      if (el && !val) el.textContent = 'Off';
    })
  );

  // Light count (derive from zone feedbacks)
  let _zoneOn = [false, false, false, false];
  [1,2,3,4].forEach((z, i) => {
    _homeSubs.push(
      subscribe('b', `zone${z}_on_fb`, val => {
        _zoneOn[i] = val;
        const count = _zoneOn.filter(Boolean).length;
        const el = document.getElementById('home-lights-count');
        if (el) el.textContent = count === 0 ? 'All off' : `${count} on`;
      })
    );
  });

  // Shade status (simple — show closed/open based on shade1)
  _homeSubs.push(
    subscribe('n', 'shade1_position_fb', val => {
      const el = document.getElementById('home-shades-status');
      if (el) el.textContent = val === 0 ? 'Closed' : val === 100 ? 'Open' : `${val}% open`;
    })
  );

  // Quick scene buttons
  document.querySelectorAll('[data-signal]').forEach(el => {
    if (el.closest('#page-home') && el.id.startsWith('qs-')) {
      el.addEventListener('pointerdown', () => {
        publishBoolean(el.dataset.signal, true);
        publishBoolean(el.dataset.signal, false);
        toast(`Scene activated`);
      });
    }
  });

  // Quick action buttons in home page
  ['btn-all-lights-off','btn-all-shades-close','btn-av-off','btn-goodnight'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('pointerdown', () => {
      const sig = btn.dataset.signal;
      if (sig) {
        publishBoolean(sig, true);
        publishBoolean(sig, false);
      }
      const labels = {
        'btn-all-lights-off':   'Lights Off',
        'btn-all-shades-close': 'Closing Shades',
        'btn-av-off':           'A/V Off',
        'btn-goodnight':        'Good Night',
      };
      toast(labels[id] || 'Done');
    });
  });

  // Connection status indicator
  subscribe('b', 'online_fb', val => {
    const ind = document.getElementById('status-indicator');
    if (ind) ind.classList.toggle('offline', !val);
  });
}

/* ─────────────────────────────────────────
   WebXPanel Initialization (iPad)
───────────────────────────────────────── */
function initWebXPanel() {
  if (typeof window.WebXPanel === 'undefined') return;

  const config = {
    host:       '192.168.1.100',
    ipId:       '0x03',
    roomId:     'main',
    authToken:  '',
    portNumber: 49200,
  };

  try {
    const wxp = window.WebXPanel.getWebXPanel(!window.WebXPanel.isActive);
    wxp.initialize(config);

    wxp.websocketStatus.subscribe(status => {
      if (status.isConnected) {
        hideConnecting();
        const ind = document.getElementById('status-indicator');
        if (ind) ind.classList.remove('offline');
      } else {
        const ind = document.getElementById('status-indicator');
        if (ind) ind.classList.add('offline');
      }
    });

    wxp.connect();
  } catch (e) {
    console.warn('WebXPanel init failed:', e);
  }
}

/* ─────────────────────────────────────────
   Volume quick-set (called from inline HTML)
───────────────────────────────────────── */
function setVolume(pct) {
  publishNumber('volume_level', pctToAnalog(pct));
  // Update slider display immediately
  const slider = document.getElementById('vol-slider');
  if (slider) {
    slider.value = pct;
    slider.dispatchEvent(new Event('input'));
  }
}

/* ─────────────────────────────────────────
   Bootstrap
───────────────────────────────────────── */
function bootstrap() {
  // Expose globals required by inline HTML event handlers
  window.CrestronApp = { nav, toast, setVolume };

  // Show connecting state briefly (real panel connects immediately)
  const isRealPanel = typeof window.CrComLib !== 'undefined';
  if (isRealPanel) {
    showConnecting();
  } else {
    // Browser preview: hide overlay after short delay
    setTimeout(hideConnecting, 600);
  }

  updateClock();
  setInterval(updateClock, 10_000);

  initHome();
  initLighting();
  initClimate();
  initAV();
  initShades();

  initWebXPanel();
}

document.addEventListener('DOMContentLoaded', bootstrap);
