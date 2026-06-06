/**
 * Camera Module – AVPTZ Camera 1 (VISCA/IP) & NKU Camera 2 (VISCA/IP)
 * Handles: PTZ movement, zoom, preset recall/save, camera switching
 */
(function attachCameraModule(S) {
  'use strict';

  // Simulated camera positions (pan, tilt, zoom 0-100)
  const cameras = {
    1: { pan: 50, tilt: 50, zoom: 30, name: 'AVPTZ – Camera 1' },
    2: { pan: 50, tilt: 50, zoom: 30, name: 'NKU – Camera 2' },
  };

  const presets = {
    1: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
    2: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
  };
  const PRESET_LABELS = { 1:'Wide Shot', 2:'Chairman', 3:'Presenter', 4:'Table Left', 5:'Table Right', 6:'Screen View' };

  let moveInterval = null;
  const SPEED = 4;   // degrees per tick

  function selectCamera(camNum) {
    S._state.activeCamera = camNum;
    S._setD(`cam${camNum}_selected`, true);
    S._setD('cam_active', true);

    document.querySelectorAll('.cam-sel-btn').forEach((b, i) =>
      b.classList.toggle('active', i + 1 === camNum)
    );
    const lbl = document.getElementById('cam-label');
    if (lbl) lbl.textContent = cameras[camNum].name;
    _updateViewport(camNum);
    S._toast(`Camera ${camNum} selected`);
  }

  function ptzMove(dir, speed) {
    const cam = cameras[S._state.activeCamera];
    const ind = document.getElementById('cam-ptz-ind');
    clearInterval(moveInterval);

    const dirs = { up:'tilt+', down:'tilt-', left:'pan-', right:'pan+' };
    S._setD(`ptz_${dirs[dir]}`, true);

    moveInterval = setInterval(() => {
      if (dir === 'up')    cam.tilt = Math.min(100, cam.tilt + SPEED);
      if (dir === 'down')  cam.tilt = Math.max(0,   cam.tilt - SPEED);
      if (dir === 'left')  cam.pan  = Math.max(0,   cam.pan  - SPEED);
      if (dir === 'right') cam.pan  = Math.min(100, cam.pan  + SPEED);
      if (ind) ind.textContent = `P:${cam.pan}° T:${cam.tilt}°`;
    }, 80);
  }

  function ptzStop() {
    clearInterval(moveInterval);
    ['tilt+', 'tilt-', 'pan-', 'pan+', 'zoom+', 'zoom-'].forEach(d =>
      S._setD(`ptz_${d}`, false)
    );
    const cam = cameras[S._state.activeCamera];
    const ind = document.getElementById('cam-ptz-ind');
    if (ind) ind.textContent = 'PTZ READY';
    S._setA('ptz_pan',  cam.pan);
    S._setA('ptz_tilt', cam.tilt);
    S._setA('ptz_zoom', cam.zoom);
  }

  function ptzZoom(dir) {
    const cam = cameras[S._state.activeCamera];
    clearInterval(moveInterval);
    S._setD(`ptz_zoom${dir === 'in' ? '+' : '-'}`, true);

    moveInterval = setInterval(() => {
      if (dir === 'in')  cam.zoom = Math.min(100, cam.zoom + SPEED);
      if (dir === 'out') cam.zoom = Math.max(0,   cam.zoom - SPEED);
      const ind = document.getElementById('cam-ptz-ind');
      if (ind) ind.textContent = `ZOOM: ${cam.zoom}%`;
    }, 80);
  }

  function recallPreset(num) {
    const camNum = S._state.activeCamera;
    const saved  = presets[camNum][num];

    if (saved) {
      cameras[camNum].pan  = saved.pan;
      cameras[camNum].tilt = saved.tilt;
      cameras[camNum].zoom = saved.zoom;
    }
    // Build VISCA preset recall command byte sequence (simulated)
    const visca = `FF 01 04 3F 02 ${num.toString(16).padStart(2,'0')} FF`;
    S._setS(`ptz_preset_cmd`, visca);
    S._setD(`ptz_preset_${num}`, true);
    setTimeout(() => S._setD(`ptz_preset_${num}`, false), 300);

    document.querySelectorAll('.preset-btn')
      .forEach((b, i) => b.classList.toggle('active', i + 1 === num));
    setTimeout(() =>
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'))
    , 600);

    S._toast(`Preset ${num}: ${PRESET_LABELS[num]}`);
  }

  function savePreset() {
    const sel    = document.getElementById('preset-save-sel');
    const num    = parseInt(sel.value, 10);
    const camNum = S._state.activeCamera;
    const cam    = cameras[camNum];

    presets[camNum][num] = { pan: cam.pan, tilt: cam.tilt, zoom: cam.zoom };

    const visca = `FF 01 04 3F 01 ${num.toString(16).padStart(2,'0')} FF`;
    S._setS('ptz_preset_save_cmd', visca);
    S._toast(`Saved preset ${num}: ${PRESET_LABELS[num]} (Cam ${camNum})`);
  }

  function _updateViewport(camNum) {
    const vp = document.getElementById('cam-viewport');
    if (!vp) return;
    vp.style.border = camNum === 1
      ? '1px solid #1f6feb'
      : '1px solid #238636';
  }

  // Conference camera selection
  function confSelectCamera(num) {
    S._state.confActiveCamera = num;
    document.querySelectorAll('.cam-conf-btn').forEach((b, i) =>
      b.classList.toggle('active', i + 1 === num)
    );
    selectCamera(num);
    S._toast(`Teams camera: Cam ${num}`);
  }

  S.selectCamera    = selectCamera;
  S.ptzMove         = ptzMove;
  S.ptzStop         = ptzStop;
  S.ptzZoom         = ptzZoom;
  S.recallPreset    = recallPreset;
  S.savePreset      = savePreset;
  S.confSelectCamera = confSelectCamera;
})(SIMPL);
