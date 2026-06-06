/**
 * Audio Module – Crestron DSP / Shure Ceiling Speakers
 * Zones: master, ceiling, conf (Shure mic), hdmi
 * Also handles: Conference call (Teams), Door displays
 */
(function attachAudioModule(S) {
  'use strict';

  // ── Volume Control ──────────────────────────────────────────
  function setVolume(zone, val) {
    val = Math.max(0, Math.min(100, Math.round(+val)));
    S._state.volumes[zone] = val;

    const slider  = document.getElementById(`vol-${zone}`);
    const display = document.getElementById(`vol-${zone}-val`);
    if (slider)  slider.value      = val;
    if (display) display.textContent = `${val}%`;

    // Analog signal 0–65535 (scaled from 0–100%)
    S._setA(`vol_${zone}`, Math.round(val * 655.35));

    // Auto-unmute if raising from 0
    if (val > 0 && S._state.mutes[zone]) {
      S._state.mutes[zone] = false;
      _refreshMuteBtn(zone);
    }
    if (zone === 'master') {
      S._setA('vol_master_pct', val);
      document.getElementById('audio-status').textContent = val > 0 ? `${val}%` : 'MUTED';
    }
  }

  function adjustVolume(zone, delta) {
    setVolume(zone, S._state.volumes[zone] + delta);
  }

  // ── Mute Control ───────────────────────────────────────────
  function toggleMute(zone) {
    S._state.mutes[zone] = !S._state.mutes[zone];
    S._setD(`mute_${zone}`, S._state.mutes[zone]);
    _refreshMuteBtn(zone);
    S._toast(`${zone.charAt(0).toUpperCase() + zone.slice(1)}: ${S._state.mutes[zone] ? 'Muted' : 'Unmuted'}`);
    if (zone === 'master') {
      document.getElementById('audio-status').textContent =
        S._state.mutes[zone] ? 'MUTED' : `${S._state.volumes.master}%`;
    }
  }

  function _refreshMuteBtn(zone) {
    const btn = document.getElementById(`mute-${zone}`);
    if (btn) btn.classList.toggle('active', S._state.mutes[zone]);
  }

  // ── Audio Follow Video ─────────────────────────────────────
  function setAFV(enabled) {
    S._state.afvEnabled = enabled;
    S._setD('afv_enable', enabled);
    document.getElementById('afv-on').classList.toggle('active',  enabled);
    document.getElementById('afv-off').classList.toggle('active', !enabled);
    S._toast(`Audio Follow Video: ${enabled ? 'ON' : 'OFF'}`);
  }

  // ── Conference (Microsoft Teams) ───────────────────────────
  function confJoin() {
    if (!S._state.systemOn) { S._toast('System is OFF'); return; }
    S._state.confInCall = true;
    S._state.confCam    = true;
    S._state.confMic    = true;
    S._setD('conf_in_call', true);
    S._setD('conf_cam_on',  true);
    S._setD('conf_mic_on',  true);

    const dot   = document.getElementById('conf-state-dot');
    const label = document.getElementById('conf-state-label');
    if (dot)   { dot.classList.add('active'); }
    if (label) { label.textContent = 'Call in progress'; }

    document.getElementById('btn-join-call').disabled  = true;
    document.getElementById('btn-leave-call').disabled = false;

    _refreshConfTile('cam',    true);
    _refreshConfTile('mic',    true);
    _refreshConfTile('share',  false);
    _refreshConfTile('record', false);

    setVolume('conf', 75);
    S._toast('Teams call joined');
  }

  function confLeave() {
    S._state.confInCall  = false;
    S._state.confCam     = false;
    S._state.confMic     = false;
    S._state.confShare   = false;
    S._state.confRecord  = false;
    S._setD('conf_in_call', false);

    const dot   = document.getElementById('conf-state-dot');
    const label = document.getElementById('conf-state-label');
    if (dot)   { dot.classList.remove('active'); }
    if (label) { label.textContent = 'Not in a call'; }

    document.getElementById('btn-join-call').disabled  = false;
    document.getElementById('btn-leave-call').disabled = true;

    ['cam','mic','share','record'].forEach(t => _refreshConfTile(t, false));
    S._toast('Teams call ended');
  }

  function confToggle(tile) {
    if (!S._state.confInCall) { S._toast('Not in a call'); return; }
    const key    = `conf${tile.charAt(0).toUpperCase() + tile.slice(1)}`;
    S._state[key] = !S._state[key];
    S._setD(`conf_${tile}`, S._state[key]);
    _refreshConfTile(tile, S._state[key]);
    S._toast(`${tile.charAt(0).toUpperCase() + tile.slice(1)}: ${S._state[key] ? 'ON' : 'OFF'}`);
  }

  function _refreshConfTile(tile, active) {
    const btn = document.getElementById(`toggle-${tile}`);
    if (!btn) return;
    btn.textContent = active ? 'ON' : 'OFF';
    btn.className   = `tile-toggle ${active ? 'on' : 'off'}`;
  }

  // ── Door Displays ──────────────────────────────────────────
  function toggleDoorDisplay(num, on) {
    S._state.doorDisplays[num].on = on;
    S._setD(`door${num}_power`, on);
    const panel = document.getElementById(`door${num}-panel`);
    if (panel) {
      panel.style.borderColor = on ? 'var(--success)' : 'var(--border)';
    }
    S._toast(`Door Display ${num}: ${on ? 'ON' : 'OFF'}`);
  }

  function setDoorMsg(num, msg) {
    S._state.doorDisplays[num].msg = msg;
    S._setS(`door${num}_msg`, msg);
    const el = document.getElementById(`door${num}-msg`);
    if (el) el.textContent = msg;
    S._toast(`Door ${num}: "${msg}"`);
  }

  // Attach to SIMPL namespace
  S.setVolume        = setVolume;
  S.adjustVolume     = adjustVolume;
  S.toggleMute       = toggleMute;
  S.setAFV           = setAFV;
  S.confJoin         = confJoin;
  S.confLeave        = confLeave;
  S.confToggle       = confToggle;
  S.toggleDoorDisplay = toggleDoorDisplay;
  S.setDoorMsg       = setDoorMsg;
})(SIMPL);
