/**
 * Camera Module – AVER CAM570 PTZ (×2)
 * Protocol: VISCA over IP (UDP port 52381) + HTTP REST API
 *
 * VISCA commands built as hex strings (logged to console/S-join)
 * Auto-tracking via AVER AI HTTP API
 *
 * Digital Joins: CAM1_SELECT=40, CAM2_SELECT=41,
 *   CAM_AUTO_TRACK=42, CAM_PAN_L=43..ZOOM_OUT=48,
 *   CAM_FOCUS_FAR=49, CAM_FOCUS_NEAR=50,
 *   CAM_PRESET_1=51..PRESET_4=54, CAM_PRESET_SAVE=55
 * Analog Joins: CAM_SPEED=6, CAM_PAN_FB=7, CAM_TILT_FB=8, CAM_ZOOM_FB=9
 * Serial Join:  PTZ_VISCA_CMD=2, CAM_PRESET_CMD=5
 */
(function(S) {
  'use strict';

  const st = S.state;

  // VISCA command builder helpers (simplified)
  const VISCA = {
    header:      '81 01',
    panTiltStop: '81 01 06 01 VV WW 03 03 FF',
    panLeft:     '81 01 06 01 VV WW 01 03 FF',
    panRight:    '81 01 06 01 VV WW 02 03 FF',
    tiltUp:      '81 01 06 01 VV WW 03 01 FF',
    tiltDown:    '81 01 06 01 VV WW 03 02 FF',
    zoomIn:      '81 01 04 07 2V FF',
    zoomOut:     '81 01 04 07 3V FF',
    zoomStop:    '81 01 04 07 00 FF',
    focusFar:    '81 01 04 08 2V FF',
    focusNear:   '81 01 04 08 3V FF',
    focusStop:   '81 01 04 08 00 FF',
    presetRecall:'81 01 04 3F 02 PP FF',
    presetSave:  '81 01 04 3F 01 PP FF',
    trackOn:     'HTTP POST /api/v1/camera/tracking { "enabled": true }',
    trackOff:    'HTTP POST /api/v1/camera/tracking { "enabled": false }',
  };

  function _visca(template, speed, preset) {
    const v = (speed||st.camSpeed).toString(16).toUpperCase();
    const w = v;
    const p = preset !== undefined ? preset.toString(16).toUpperCase().padStart(2,'0') : '00';
    return template.replace(/VV/g,v).replace(/WW/g,w).replace('PP',p).replace(/\bV\b/g,v);
  }

  function _sendVisca(cmd) {
    S.setS(S.SJ.PTZ_VISCA_CMD, cmd);
    console.log(`[SIMPL VISCA CAM${st.activeCam}] ${cmd}`);
  }

  function _updatePtzStatus() {
    const pos = st.camPos[st.activeCam];
    const el  = document.getElementById('cam-ptz-status');
    if (el) el.textContent=`P:${pos.p} T:${pos.t} Z:${pos.z}`;
    S.setA(S.AJ.CAM_PAN_FB,  Math.round(pos.p*655.35));
    S.setA(S.AJ.CAM_TILT_FB, Math.round(pos.t*655.35));
    S.setA(S.AJ.CAM_ZOOM_FB, Math.round(pos.z*655.35));
  }

  // ── Camera Selection ────────────────────────────────────
  function selectCam(num, btn) {
    st.activeCam = num;
    S.setD(S.DJ.CAM1_SELECT, num===1);
    S.setD(S.DJ.CAM2_SELECT, num===2);

    document.querySelectorAll('.cam-tab').forEach(b=>b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const badge = document.getElementById('cam-name-badge');
    if (badge) badge.textContent=`Camera ${num} · ${num===1?'Left Wall':'Right Wall'}`;

    const vcLbl = document.getElementById('vc-cam-label');
    if (vcLbl) vcLbl.textContent=`Camera ${num} Feed — AVER CAM570`;
    const vcBadge = document.getElementById('vc-cam-badge');
    if (vcBadge) vcBadge.textContent=`AVER CAM570 Cam${num} · Active`;

    _updatePtzStatus();
    S.toast(`Camera ${num} selected`);
  }

  // ── PTZ Movement ────────────────────────────────────────
  const STEP = 3;

  function ptzStart(dir) {
    S.setD({ up:S.DJ.CAM_TILT_U, down:S.DJ.CAM_TILT_D, left:S.DJ.CAM_PAN_L, right:S.DJ.CAM_PAN_R }[dir], true);
    const cmdMap = { up:'tiltUp', down:'tiltDown', left:'panLeft', right:'panRight' };
    _sendVisca(_visca(VISCA[cmdMap[dir]]));

    clearInterval(st.ptzInterval);
    st.ptzInterval = setInterval(() => {
      const pos = st.camPos[st.activeCam];
      if (dir==='up')    pos.t=Math.min(100,pos.t+STEP);
      if (dir==='down')  pos.t=Math.max(0,  pos.t-STEP);
      if (dir==='left')  pos.p=Math.max(0,  pos.p-STEP);
      if (dir==='right') pos.p=Math.min(100,pos.p+STEP);
      _updatePtzStatus();
    },80);
  }

  function ptzStop() {
    clearInterval(st.ptzInterval);
    [S.DJ.CAM_TILT_U,S.DJ.CAM_TILT_D,S.DJ.CAM_PAN_L,S.DJ.CAM_PAN_R,
     S.DJ.CAM_ZOOM_IN,S.DJ.CAM_ZOOM_OUT,S.DJ.CAM_FOCUS_FAR,S.DJ.CAM_FOCUS_NEAR]
      .forEach(j=>S.setD(j,false));
    _sendVisca(_visca(VISCA.panTiltStop));
    _sendVisca(_visca(VISCA.zoomStop));
  }

  function ptzZoomStart(dir) {
    S.setD(dir==='in'?S.DJ.CAM_ZOOM_IN:S.DJ.CAM_ZOOM_OUT, true);
    _sendVisca(_visca(dir==='in'?VISCA.zoomIn:VISCA.zoomOut));
    clearInterval(st.ptzInterval);
    st.ptzInterval = setInterval(()=>{
      const pos=st.camPos[st.activeCam];
      if(dir==='in')  pos.z=Math.min(100,pos.z+STEP);
      if(dir==='out') pos.z=Math.max(0,  pos.z-STEP);
      _updatePtzStatus();
    },80);
  }

  function ptzFocusStart(dir) {
    S.setD(dir==='far'?S.DJ.CAM_FOCUS_FAR:S.DJ.CAM_FOCUS_NEAR, true);
    _sendVisca(_visca(dir==='far'?VISCA.focusFar:VISCA.focusNear));
    clearInterval(st.ptzInterval);
    st.ptzInterval = setInterval(()=>{ /* focus tracking */ },80);
  }

  // ── Presets ─────────────────────────────────────────────
  function recallPreset(btn) {
    const num = parseInt(btn.dataset.preset,10);
    if (!num) return;

    const saved = st.camPresets[st.activeCam][num];
    if (saved) {
      st.camPos[st.activeCam] = { ...saved };
      _updatePtzStatus();
    }

    S.setD(S.DJ['CAM_PRESET_'+num], true);
    setTimeout(()=>S.setD(S.DJ['CAM_PRESET_'+num], false), 300);
    S.setS(S.SJ.CAM_PRESET_CMD, _visca(VISCA.presetRecall, null, num));
    _sendVisca(_visca(VISCA.presetRecall, null, num));

    document.querySelectorAll('#cam-presets .preset-btn[data-preset]')
      .forEach(b=>b.classList.toggle('active', parseInt(b.dataset.preset,10)===num));

    S.toast(`Preset ${num} recalled`);
  }

  function saveCurrentPreset() {
    const pos = { ...st.camPos[st.activeCam] };
    // Save to next empty slot
    const slots = st.camPresets[st.activeCam];
    for (let i=1;i<=4;i++) {
      if (!slots[i]) { slots[i]=pos; S.toast(`Position saved to Preset ${i}`); return; }
    }
    slots[1]=pos;  // overwrite slot 1 if all full
    S.setD(S.DJ.CAM_PRESET_SAVE, true);
    setTimeout(()=>S.setD(S.DJ.CAM_PRESET_SAVE,false), 300);
    S.toast('Preset 1 overwritten with current position');
  }

  // ── Auto Tracking ────────────────────────────────────────
  function toggleTracking() {
    st.camTrack=!st.camTrack;
    S.setD(S.DJ.CAM_AUTO_TRACK, st.camTrack);
    const sw=document.getElementById('tracking-switch');
    if(sw) sw.classList.toggle('off', !st.camTrack);
    _sendVisca(st.camTrack ? VISCA.trackOn : VISCA.trackOff);
    S.toast(`Auto Track: ${st.camTrack?'ON':'OFF'}`);
  }

  // ── Speed ────────────────────────────────────────────────
  function setPtzSpeed(btn) {
    const speed=parseInt(btn.dataset.speed,10);
    st.camSpeed=speed;
    S.setA(S.AJ.CAM_SPEED, speed*7281);
    document.querySelectorAll('#speed-btns .preset-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    S.toast(`PTZ speed: ${btn.textContent.trim()}`);
  }

  // ── Camera output routing ─────────────────────────────────
  function setCamOutput(val) {
    S.setS(S.SJ.MATRIX_CMD, `CAM_OUT ${val}`);
    S.toast(`Camera routing: ${document.getElementById('cam-output-sel').options[document.getElementById('cam-output-sel').selectedIndex].text}`);
  }

  // Attach globals
  window.selectCam         = selectCam;
  window.ptzStart          = ptzStart;
  window.ptzStop           = ptzStop;
  window.ptzZoomStart      = ptzZoomStart;
  window.ptzFocusStart     = ptzFocusStart;
  window.recallPreset      = recallPreset;
  window.saveCurrentPreset = saveCurrentPreset;
  window.toggleTracking    = toggleTracking;
  window.setPtzSpeed       = setPtzSpeed;
  window.setCamOutput      = setCamOutput;
})(SIMPL);
