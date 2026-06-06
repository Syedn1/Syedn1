/**
 * ASMO Boardroom – SIMPL Windows Control Engine
 *
 * Crestron CP4N · IP-ID 03 (TS-1070 Touch Panel)
 *
 * Signal bus mirrors Crestron SIMPL Windows:
 *   Digital  – boolean press/feedback signals (Joins 1–100)
 *   Analog   – 16-bit level signals 0–65535  (Joins 1–50)
 *   Serial   – string feedback signals        (Joins 1–20)
 *
 * Join map is defined in simpl_program.json and used here
 * to route UI actions to the correct device module.
 */

'use strict';

const SIMPL = (() => {

  /* ── Signal Buses ─────────────────────────────────────── */
  const D = {};  // digital  (bool)
  const A = {};  // analog   (0-65535)
  const S = {};  // serial   (string)

  const _dSubs = {}, _aSubs = {}, _sSubs = {};

  function setD(j, v) { D[j] = !!v; (_dSubs[j]||[]).forEach(f=>f(D[j])); }
  function setA(j, v) { A[j] = Math.max(0, Math.min(65535, Math.round(+v))); (_aSubs[j]||[]).forEach(f=>f(A[j])); }
  function setS(j, v) { S[j] = String(v); (_sSubs[j]||[]).forEach(f=>f(S[j])); }
  function getD(j) { return !!D[j]; }
  function getA(j) { return A[j] || 0; }
  function getS(j) { return S[j] || ''; }
  function onD(j, f) { (_dSubs[j]=_dSubs[j]||[]).push(f); }
  function onA(j, f) { (_aSubs[j]=_aSubs[j]||[]).push(f); }
  function onS(j, f) { (_sSubs[j]=_sSubs[j]||[]).push(f); }

  /* ── Digital Join Map (D-Joins) ───────────────────────── */
  const DJ = {
    // System
    SYSTEM_POWER:       1,
    // Display 1
    D1_POWER_ON:        10, D1_POWER_OFF:    11,
    D1_SRC1: 12, D1_SRC2: 13, D1_SRC3: 14,
    D1_SRC4: 15, D1_SRC5: 16, D1_SRC6: 17,
    // Display 2
    D2_POWER_ON:        20, D2_POWER_OFF:    21,
    D2_SRC1: 22, D2_SRC2: 23, D2_SRC3: 24,
    D2_SRC4: 25, D2_SRC5: 26, D2_SRC6: 27,
    // Matrix
    MATRIX_MIRROR:      30, MATRIX_INDEP:    31, MATRIX_EXTEND: 32,
    LIFT_DEPLOY:        33, LIFT_RETRACT:    34,
    // Camera
    CAM1_SELECT:        40, CAM2_SELECT:     41,
    CAM_AUTO_TRACK:     42,
    CAM_PAN_L:          43, CAM_PAN_R:       44,
    CAM_TILT_U:         45, CAM_TILT_D:      46,
    CAM_ZOOM_IN:        47, CAM_ZOOM_OUT:    48,
    CAM_FOCUS_FAR:      49, CAM_FOCUS_NEAR:  50,
    CAM_PRESET_1:       51, CAM_PRESET_2:    52,
    CAM_PRESET_3:       53, CAM_PRESET_4:    54,
    CAM_PRESET_SAVE:    55,
    // Audio
    MIC1_MUTE:          60, MIC2_MUTE:       61,
    ZONE1_ENABLE:       62, ZONE2_ENABLE:    63,
    ALL_MUTE:           64,
    NET_MUTE_BTN:       65,
    DSP_ENABLE:         66, ANIUSB_ENABLE:   67,
    AUDIO_PRE_MEETING:  68, AUDIO_PRE_PRES:  69,
    AUDIO_PRE_VCALL:    70, AUDIO_PRE_MUTE:  71,
    // Teams / VC
    VC_JOIN:            80, VC_LEAVE:        81,
    VC_MIC:             82, VC_CAM:          83,
    VC_SHARE:           84, VC_CHAT:         85,
    VC_PEOPLE:          86,
    VC_SHARE_CS1:       87, VC_SHARE_HDMI1:  88,
    VC_SHARE_HDMI2:     89, VC_SHARE_DELEG:  90,
    VC_LAYOUT_GAL:      91, VC_LAYOUT_SPK:   92,
    VC_LAYOUT_CP:       93, VC_LAYOUT_FS:    94,
  };

  /* ── Analog Join Map (A-Joins) ────────────────────────── */
  const AJ = {
    MASTER_VOL: 1,
    MIC1_GAIN:  2,
    MIC2_GAIN:  3,
    ZONE1_VOL:  4,
    ZONE2_VOL:  5,
    CAM_SPEED:  6,
    CAM_PAN_FB: 7,
    CAM_TILT_FB:8,
    CAM_ZOOM_FB:9,
    D1_SRC_FB:  10,
    D2_SRC_FB:  11,
  };

  /* ── Serial Join Map (S-Joins) ────────────────────────── */
  const SJ = {
    MATRIX_CMD:     1,
    PTZ_VISCA_CMD:  2,
    D1_SRC_LABEL:   3,
    D2_SRC_LABEL:   4,
    CAM_PRESET_CMD: 5,
    DSP_CMD:        6,
    STATUS_FB:      7,
  };

  /* ── State ────────────────────────────────────────────── */
  const state = {
    systemOn:     true,
    activeCam:    1,
    camTrack:     false,
    camSpeed:     5,
    camPos:       { 1: { p:50,t:50,z:30 }, 2: { p:50,t:50,z:30 } },
    camPresets:   { 1: {}, 2: {} },
    displays:     { 1: { on:true,  src:1 }, 2: { on:true,  src:7 } },
    matrixMode:   'mirror',
    mics:         { 1: { muted:false, gain:75 }, 2: { muted:false, gain:68 } },
    zones:        { 1: true, 2: true },
    masterVol:    70,
    allMuted:     false,
    netMute:      true,
    dsp:          true,
    aniusb:       true,
    audioPreset:  'meeting',
    vc: {
      inCall:  true,
      mic:     false,
      cam:     true,
      share:   false,
      chat:    false,
      people:  false,
      shareSource: 'clickshare1',
      layout:  'gallery',
    },
    ptzInterval: null,
  };

  /* ── Init ─────────────────────────────────────────────── */
  function init() {
    _clock();
    _meetingDate();
    _buildMeters();
    _animateMeters();
    _callTimer();
    // pre-set initial digital signal states
    setD(DJ.D1_POWER_ON,  state.displays[1].on);
    setD(DJ.D2_POWER_ON,  state.displays[2].on);
    setD(DJ.MIC1_MUTE,    state.mics[1].muted);
    setD(DJ.MIC2_MUTE,    state.mics[2].muted);
    setD(DJ.ZONE1_ENABLE, state.zones[1]);
    setD(DJ.ZONE2_ENABLE, state.zones[2]);
    setD(DJ.DSP_ENABLE,   state.dsp);
    setD(DJ.ANIUSB_ENABLE,state.aniusb);
    setD(DJ.NET_MUTE_BTN, state.netMute);
    setD(DJ.VC_CAM,       state.vc.cam);
    setA(AJ.MASTER_VOL,   Math.round(state.masterVol*655.35));
    setA(AJ.MIC1_GAIN,    Math.round(state.mics[1].gain*655.35));
    setA(AJ.MIC2_GAIN,    Math.round(state.mics[2].gain*655.35));
    setA(AJ.CAM_SPEED,    state.camSpeed * 7281);
    _updateVolSliderBg('master-vol-slider', state.masterVol);
  }

  /* ── Clock ────────────────────────────────────────────── */
  function _clock() {
    const el = document.getElementById('clock');
    const tick = () => {
      const n = new Date();
      el.textContent = n.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    };
    tick(); setInterval(tick, 1000);
  }

  function _meetingDate() {
    const el = document.getElementById('meeting-date');
    if (el) {
      const n = new Date();
      el.textContent = n.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long',year:'numeric'})
        + ' · 10:00 AM – 11:00 AM';
    }
  }

  /* ── Call Timer ───────────────────────────────────────── */
  let _callSecs = 0, _callInterval = null;
  function _callTimer() {
    _callInterval = setInterval(() => {
      _callSecs++;
      const h = String(Math.floor(_callSecs/3600)).padStart(2,'0');
      const m = String(Math.floor((_callSecs%3600)/60)).padStart(2,'0');
      const s = String(_callSecs%60).padStart(2,'0');
      const el = document.getElementById('meeting-timer');
      if (el) el.textContent = `${h}:${m}:${s}`;
    },1000);
  }

  /* ── Level Meters ─────────────────────────────────────── */
  function _buildMeters() {
    ['meter-1','meter-2'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      for (let i=0;i<20;i++) {
        const b = document.createElement('div');
        b.className='level-bar'; b.style.height='4px'; el.appendChild(b);
      }
    });
  }

  function _animateMeters() {
    setInterval(() => {
      ['meter-1','meter-2'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const bars  = el.querySelectorAll('.level-bar');
        const level = Math.floor(Math.random()*14)+3;
        bars.forEach((bar,i) => {
          const h = i < level ? Math.round(Math.random()*14+4) : 4;
          bar.style.height = h+'px';
          bar.className = 'level-bar'+(i<level?(i>16?' peak':i>12?' warn':' active'):'');
        });
      });
    },120);
  }

  /* ── Navigation ───────────────────────────────────────── */
  function showPage(name) {
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.getElementById('page-'+name).classList.add('active');
    document.getElementById('nav-'+name).classList.add('active');
  }

  /* ── Toast ────────────────────────────────────────────── */
  function toast(msg, ms=2400) {
    const tc = document.getElementById('toast-container');
    const t  = document.createElement('div');
    t.className='toast'; t.textContent=msg; tc.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; },ms);
    setTimeout(()=>t.remove(), ms+350);
  }

  /* ── System Power Off ─────────────────────────────────── */
  function systemPowerOff() {
    document.getElementById('powerModal').classList.remove('show');
    state.systemOn = false;
    setD(DJ.SYSTEM_POWER, false);
    setDisplayOff(1);
    setDisplayOff(2);
    updateMasterVol(0);
    clearInterval(_callInterval);
    _callSecs=0;
    const p=document.getElementById('status-pill');
    p.className='status-pill offline';
    document.getElementById('status-text').textContent='System Offline';
    toast('System powered off – all devices shutting down');
  }

  /* ── Vol helper ───────────────────────────────────────── */
  function _updateVolSliderBg(id, pct) {
    const el=document.getElementById(id);
    if (!el) return;
    el.style.background=`linear-gradient(to right, var(--accent) ${pct}%, var(--surface3) ${pct}%)`;
  }

  return {
    init, showPage, toast, systemPowerOff,
    state, DJ, AJ, SJ,
    setD, setA, setS, getD, getA, getS, onD, onA, onS,
    _updateVolSliderBg,
    _callTimer: () => { clearInterval(_callInterval); _callSecs=0; _callTimer(); },
    _stopTimer: () => { clearInterval(_callInterval); _callSecs=0;
      const el=document.getElementById('meeting-timer');
      if(el) el.textContent='00:00:00'; },
  };
})();
