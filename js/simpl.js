/**
 * AMO Boardroom – SIMPL Windows Control Engine
 *
 * Emulates a Crestron SIMPL Windows program:
 *   - Digital / Analog / Serial signal buses
 *   - Module instantiation (Display, Matrix, Camera, Audio)
 *   - Join-based touch-panel signal routing
 *   - Room-mode macro logic
 */

'use strict';

const SIMPL = (() => {

  // ──────────────────────────────────────────────────────────────
  //  Signal Buses  (Digital / Analog / Serial)
  // ──────────────────────────────────────────────────────────────
  const DIGITAL = {};   // bool  keyed by signal name
  const ANALOG  = {};   // 0-65535 keyed by signal name
  const SERIAL  = {};   // string  keyed by signal name

  function setD(sig, val) { DIGITAL[sig] = !!val;  _notifyD(sig); }
  function setA(sig, val) { ANALOG[sig]  = +val;   _notifyA(sig); }
  function setS(sig, val) { SERIAL[sig]  = String(val); _notifyS(sig); }
  function getD(sig) { return !!DIGITAL[sig]; }
  function getA(sig) { return ANALOG[sig] || 0; }
  function getS(sig) { return SERIAL[sig]  || ''; }

  // Lightweight pub/sub for signal feedback
  const _dSubs = {}, _aSubs = {}, _sSubs = {};
  function onD(sig, fn) { (_dSubs[sig] = _dSubs[sig] || []).push(fn); }
  function onA(sig, fn) { (_aSubs[sig] = _aSubs[sig] || []).push(fn); }
  function onS(sig, fn) { (_sSubs[sig] = _sSubs[sig] || []).push(fn); }
  function _notifyD(sig) { (_dSubs[sig] || []).forEach(fn => fn(DIGITAL[sig])); }
  function _notifyA(sig) { (_aSubs[sig] || []).forEach(fn => fn(ANALOG[sig])); }
  function _notifyS(sig) { (_sSubs[sig] || []).forEach(fn => fn(SERIAL[sig])); }

  // ──────────────────────────────────────────────────────────────
  //  System State
  // ──────────────────────────────────────────────────────────────
  const state = {
    systemOn:      false,
    roomMode:      'standby',
    currentPage:   'home',
    activeCamera:  1,
    afvEnabled:    true,
    confInCall:    false,
    confCam:       false,
    confMic:       false,
    confShare:     false,
    confRecord:    false,
    confActiveCamera: 1,
    ptzMoving:     false,
    mutes: { master: true, ceiling: false, conf: false, hdmi: false },
    volumes: { master: 0, ceiling: 0, conf: 50, hdmi: 0 },
    displays: {
      1: { on: false, source: 0 },
      2: { on: false, source: 0 }
    },
    doorDisplays: {
      1: { on: false, msg: 'AMO BOARDROOM' },
      2: { on: false, msg: 'AMO BOARDROOM' }
    },
    matrix: {           // matrix[output][input] = routed?
      1: 0,             // output 1 (Display 1) → input index
      2: 0              // output 2 (Display 2) → input index
    }
  };

  const SOURCE_NAMES = ['—', 'Blu-ray', 'Laptop 1', 'Laptop 2', 'PC', 'Wireless 1', 'Wireless 2'];

  // ──────────────────────────────────────────────────────────────
  //  Init
  // ──────────────────────────────────────────────────────────────
  function init() {
    _startClock();
    _updateStatusDot('standby');
    _updateFooterMode('Standby');
    _buildToastContainer();
    _bindSignalFeedback();
    showPage('home');
  }

  // ──────────────────────────────────────────────────────────────
  //  Clock
  // ──────────────────────────────────────────────────────────────
  function _startClock() {
    const el = document.getElementById('clock');
    function tick() {
      const now = new Date();
      el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    tick();
    setInterval(tick, 1000);
  }

  // ──────────────────────────────────────────────────────────────
  //  Toast
  // ──────────────────────────────────────────────────────────────
  function _buildToastContainer() {
    const tc = document.createElement('div');
    tc.id = 'toast-container';
    document.body.appendChild(tc);
  }

  function toast(msg, durationMs = 2200) {
    const tc = document.getElementById('toast-container');
    const t  = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    tc.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, durationMs);
    setTimeout(() => t.remove(), durationMs + 350);
  }

  // ──────────────────────────────────────────────────────────────
  //  Navigation
  // ──────────────────────────────────────────────────────────────
  function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
    document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
    state.currentPage = pageId;
  }

  // ──────────────────────────────────────────────────────────────
  //  System Power
  // ──────────────────────────────────────────────────────────────
  function toggleSystemPower() {
    state.systemOn = !state.systemOn;
    setD('system_power', state.systemOn);
    const btn = document.getElementById('btn-power');

    if (state.systemOn) {
      btn.classList.add('on');
      _updateStatusDot('online');
      _updateFooterMode('System ON');
      document.getElementById('sys-power-label').textContent = 'ON';
      document.getElementById('sys-power-label').classList.add('active');
      toast('System powered ON');
      // auto-raise volumes from silence
      setA('vol_master', 70);
      setVolume('master', 70);
    } else {
      btn.classList.remove('on');
      // Power-off macro: turn off all displays, mute, cameras to home
      _powerOffMacro();
    }
  }

  function _powerOffMacro() {
    state.roomMode = 'standby';
    _updateStatusDot('standby');
    _updateFooterMode('Standby');
    document.getElementById('sys-power-label').textContent = 'STANDBY';
    document.getElementById('sys-power-label').classList.remove('active');
    toggleDisplay(1, false);
    toggleDisplay(2, false);
    setVolume('master', 0);
    toast('System powered OFF — all devices off');
    [1,2].forEach(d => {
      const tog = document.getElementById(`disp${d}-toggle`);
      if (tog) tog.checked = false;
    });
    _clearModeBtns();
    _updateFooterMode('Standby');
  }

  // ──────────────────────────────────────────────────────────────
  //  Room Modes (SIMPL macros)
  // ──────────────────────────────────────────────────────────────
  const MODES = {
    presentation: { name: 'Presentation',  src: [2, 2], displays: [true, true],  vol: 70 },
    videoconf:    { name: 'Video Conf',     src: [5, 5], displays: [true, true],  vol: 75 },
    bluray:       { name: 'Blu-ray',        src: [1, 1], displays: [true, true],  vol: 80 },
    wireless:     { name: 'Wireless Pres',  src: [5, 6], displays: [true, true],  vol: 70 },
  };

  function setRoomMode(mode) {
    if (!state.systemOn) { toast('Power ON the system first'); return; }
    const m = MODES[mode];
    if (!m) return;
    state.roomMode = mode;

    // Route matrix
    routeMatrix(1, m.src[0]);
    routeMatrix(2, m.src[1]);

    // Turn on displays
    if (m.displays[0]) { toggleDisplay(1, true); document.getElementById('disp1-toggle').checked = true; }
    if (m.displays[1]) { toggleDisplay(2, true); document.getElementById('disp2-toggle').checked = true; }

    // Volume
    setVolume('master', m.vol);

    // UI feedback
    _clearModeBtns();
    document.getElementById(`mode-${mode}`).classList.add('active');
    _updateFooterMode(`Mode: ${m.name}`);
    toast(`Room mode: ${m.name}`);
    setD(`mode_${mode}`, true);
  }

  function _clearModeBtns() {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  }

  // ──────────────────────────────────────────────────────────────
  //  Status Helpers
  // ──────────────────────────────────────────────────────────────
  function _updateStatusDot(cls) {
    const dot = document.getElementById('system-status');
    dot.className = `status-dot ${cls}`;
    dot.title = cls.charAt(0).toUpperCase() + cls.slice(1);
  }

  function _updateFooterMode(txt) {
    document.getElementById('footer-mode').textContent = txt;
  }

  // ──────────────────────────────────────────────────────────────
  //  Signal Feedback Bindings
  // ──────────────────────────────────────────────────────────────
  function _bindSignalFeedback() {
    onD('disp1_power', v => {
      document.getElementById('disp1-status').textContent = v ? 'ON' : 'OFF';
      document.getElementById('disp1-status').classList.toggle('active', v);
      document.getElementById('disp1-preview').classList.toggle('active', v);
    });
    onD('disp2_power', v => {
      document.getElementById('disp2-status').textContent = v ? 'ON' : 'OFF';
      document.getElementById('disp2-status').classList.toggle('active', v);
      document.getElementById('disp2-preview').classList.toggle('active', v);
    });
    onS('matrix_status', v => {
      document.getElementById('matrix-status').textContent = v;
    });
    onD('cam_active', v => {
      document.getElementById('cam-status').textContent = v ? 'ACTIVE' : 'STANDBY';
    });
    onA('vol_master', v => {
      document.getElementById('audio-status').textContent = v > 0 ? `${v}%` : 'MUTED';
    });
  }

  return {
    init, showPage, toggleSystemPower, setRoomMode,
    // exposed below via module files
    toggleDisplay: null, displayCmd: null,
    routeMatrix: null,
    selectCamera: null, ptzMove: null, ptzStop: null, ptzZoom: null,
    recallPreset: null, savePreset: null,
    setVolume: null, adjustVolume: null, toggleMute: null, setAFV: null,
    confJoin: null, confLeave: null, confToggle: null, confSelectCamera: null,
    toggleDoorDisplay: null, setDoorMsg: null,
    // internal helpers shared with modules
    _state: state, _toast: toast, _setD: setD, _setA: setA, _setS: setS,
    _getD: getD, _getA: getA, _getS: getS,
    _updateStatusDot, _updateFooterMode,
    SOURCE_NAMES,
  };
})();
