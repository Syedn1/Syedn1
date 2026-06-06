/**
 * Audio Module – Shure MXA920 + Shure Compute DSP + SHURE MXNGW-C + Shure ANIUSB
 * Protocol: Shure Control API over Ethernet (TCP port 2202)
 *           Command format:  < SET DEVICE_ID PROPERTY value >
 *
 * Digital Joins: MIC1_MUTE=60, MIC2_MUTE=61,
 *   ZONE1_ENABLE=62, ZONE2_ENABLE=63, ALL_MUTE=64,
 *   NET_MUTE_BTN=65, DSP_ENABLE=66, ANIUSB_ENABLE=67,
 *   AUDIO_PRE_MEETING=68..AUDIO_PRE_MUTE=71
 * Analog Joins: MASTER_VOL=1, MIC1_GAIN=2, MIC2_GAIN=3,
 *   ZONE1_VOL=4, ZONE2_VOL=5
 * Serial Join: DSP_CMD=6
 */
(function(S) {
  'use strict';

  const st = S.state;

  // Shure Control API command builder
  function _shureCmd(deviceId, property, value) {
    const cmd = `< SET ${deviceId} ${property} ${value} >`;
    S.setS(S.SJ.DSP_CMD, cmd);
    console.log(`[SIMPL SHURE] ${cmd}`);
    return cmd;
  }

  /* ── Microphone Control ──────────────────────────────── */
  function toggleMic(num) {
    const mic = st.mics[num];
    mic.muted = !mic.muted;
    S.setD(num===1 ? S.DJ.MIC1_MUTE : S.DJ.MIC2_MUTE, mic.muted);

    // Shure MXA920 mute via Control API
    _shureCmd(`MXA920_ZONE${num}`, 'AUDIO_MUTE', mic.muted ? 'ON' : 'OFF');

    const btn = document.getElementById(`mic${num}-btn`);
    if (btn) {
      if (mic.muted) {
        btn.className='mute-btn muted'; btn.textContent='🔴 Muted';
      } else {
        btn.className='mute-btn active-mic'; btn.textContent='🟢 Live';
      }
    }
    S.toast(`MXA920 Zone ${String.fromCharCode(64+num)}: ${mic.muted?'Muted':'Live'}`);
  }

  function updateMicGain(num, input) {
    const val = parseInt(input.value,10);
    st.mics[num].gain = val;
    S.setA(num===1?S.AJ.MIC1_GAIN:S.AJ.MIC2_GAIN, Math.round(val*655.35));
    const display = document.getElementById(`mic${num}-gain-val`);
    if (display) display.textContent=val;
    _updateSliderBg(input, val);
    _shureCmd(`MXA920_ZONE${num}`, 'PREAMP_GAIN', val);
  }

  /* ── Speaker Zones ──────────────────────────────────── */
  function toggleZone(num) {
    st.zones[num] = !st.zones[num];
    S.setD(num===1?S.DJ.ZONE1_ENABLE:S.DJ.ZONE2_ENABLE, st.zones[num]);
    _shureCmd(`MXNGW_ZONE${num}`, 'SPEAKER_ENABLE', st.zones[num]?'ON':'OFF');

    const tog = document.getElementById(`zone${num}-toggle`);
    if (tog) tog.classList.toggle('off', !st.zones[num]);
    S.toast(`Speaker Zone ${num}: ${st.zones[num]?'ON':'OFF'}`);
  }

  /* ── Master Volume ──────────────────────────────────── */
  function updateMasterVol(val) {
    val = Math.max(0, Math.min(100, parseInt(val,10)));
    st.masterVol = val;
    S.setA(S.AJ.MASTER_VOL, Math.round(val*655.35));
    const num = document.getElementById('master-vol-num');
    const slider = document.getElementById('master-vol-slider');
    if (num) num.textContent = val;
    if (slider) { slider.value=val; _updateSliderBgV(slider,val); }
    _shureCmd('COMPUTE_DSP', 'MASTER_FADER', val);
  }

  /* ── All Mute ───────────────────────────────────────── */
  function toggleAllMute() {
    st.allMuted = !st.allMuted;
    S.setD(S.DJ.ALL_MUTE, st.allMuted);
    _shureCmd('COMPUTE_DSP', 'MUTE_ALL', st.allMuted?'ON':'OFF');

    const btn = document.getElementById('all-mute-btn');
    if (btn) {
      if (st.allMuted) {
        btn.textContent='✅ Unmute All'; btn.classList.add('muted');
      } else {
        btn.textContent='🔇 MUTE ALL'; btn.classList.remove('muted');
      }
    }
    S.toast(st.allMuted?'All audio muted':'All audio unmuted');
  }

  /* ── Network Mute Button (IMXA-NMB) ────────────────── */
  function toggleNetworkMute() {
    st.netMute=!st.netMute;
    S.setD(S.DJ.NET_MUTE_BTN, st.netMute);
    _shureCmd('IMXA_NMB', 'BUTTON_ENABLE', st.netMute?'ON':'OFF');
    const sw=document.getElementById('mute-btn-switch');
    if(sw) sw.classList.toggle('off',!st.netMute);
    S.toast(`Network Mute Button: ${st.netMute?'Active':'Disabled'}`);
  }

  /* ── Audio Presets ──────────────────────────────────── */
  const AUDIO_PRESETS = {
    meeting:      { mic1:75, mic2:68, master:70, zone1:true, zone2:true },
    presentation: { mic1:60, mic2:80, master:80, zone1:true, zone2:true },
    videocall:    { mic1:80, mic2:80, master:75, zone1:true, zone2:false },
    mute:         { mic1:0,  mic2:0,  master:0,  zone1:false, zone2:false },
  };

  function selectAudioPreset(btn) {
    const name = btn.dataset.preset;
    const pre  = AUDIO_PRESETS[name];
    if (!pre) return;

    st.audioPreset = name;
    document.querySelectorAll('#audio-presets .preset-audio-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');

    // Apply preset values
    updateMasterVol(pre.master);
    const s1=document.getElementById('mic1-gain');
    const s2=document.getElementById('mic2-gain');
    if(s1){ s1.value=pre.mic1; updateMicGain(1,s1); }
    if(s2){ s2.value=pre.mic2; updateMicGain(2,s2); }

    if(st.zones[1]!==pre.zone1) toggleZone(1);
    if(st.zones[2]!==pre.zone2) toggleZone(2);

    const presetJoin = { meeting:S.DJ.AUDIO_PRE_MEETING, presentation:S.DJ.AUDIO_PRE_PRES,
                         videocall:S.DJ.AUDIO_PRE_VCALL, mute:S.DJ.AUDIO_PRE_MUTE }[name];
    [S.DJ.AUDIO_PRE_MEETING,S.DJ.AUDIO_PRE_PRES,S.DJ.AUDIO_PRE_VCALL,S.DJ.AUDIO_PRE_MUTE]
      .forEach(j=>S.setD(j,false));
    if(presetJoin) S.setD(presetJoin,true);

    _shureCmd('COMPUTE_DSP','LOAD_PRESET',name.toUpperCase());
    S.toast(`Audio preset: ${btn.textContent.trim()}`);
  }

  /* ── Video Conference Controls ──────────────────────── */
  let _callActive = true;

  function joinTeamsMeeting() {
    st.vc.inCall = true;
    S.setD(S.DJ.VC_JOIN, true);
    setTimeout(()=>S.setD(S.DJ.VC_JOIN,false),300);
    S._callTimer();
    S.toast('Joining Teams meeting…');
  }

  function toggleCall(btn) {
    _callActive=!_callActive;
    if (!_callActive) {
      btn.className='start-call-btn'; btn.id='call-toggle';
      btn.innerHTML='📞 Join Call';
      S.setD(S.DJ.VC_LEAVE,true);
      setTimeout(()=>S.setD(S.DJ.VC_LEAVE,false),300);
      S._stopTimer();
      st.vc.inCall=false;
    } else {
      btn.className='end-call-btn'; btn.innerHTML='📞 End Call';
      S.setD(S.DJ.VC_JOIN,true);
      setTimeout(()=>S.setD(S.DJ.VC_JOIN,false),300);
      S._callTimer();
      st.vc.inCall=true;
    }
  }

  function toggleVcCtrl(btn, type) {
    const joinMap = { mic:S.DJ.VC_MIC, cam:S.DJ.VC_CAM, share:S.DJ.VC_SHARE,
                      chat:S.DJ.VC_CHAT, people:S.DJ.VC_PEOPLE };
    const stKey   = type;
    st.vc[stKey] = !st.vc[stKey];
    S.setD(joinMap[type], st.vc[stKey]);

    btn.classList.toggle('active', st.vc[stKey] && type!=='mic');
    btn.classList.toggle('muted-state', !st.vc[stKey] || type==='mic');

    const label = btn.querySelector('div:last-child');
    if (type==='mic')   label.textContent = st.vc.mic   ? 'Mic On'  : 'Mic Off';
    if (type==='cam')   label.textContent = st.vc.cam   ? 'Cam On'  : 'Cam Off';
    if (type==='share') label.textContent = st.vc.share ? 'Sharing' : 'Share';
    if (type==='chat')  label.textContent = st.vc.chat  ? 'Chat On' : 'Chat';
    if (type==='people')label.textContent = st.vc.people? 'People'  : 'People (4)';

    // Mic mute → also mute Shure DSP
    if(type==='mic') {
      _shureCmd('MXA920_ZONE1','AUDIO_MUTE', st.vc.mic?'OFF':'ON');
    }
  }

  function selectShare(btn) {
    document.querySelectorAll('.share-source-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const src=btn.dataset.src;
    st.vc.shareSource=src;

    const joinMap = { clickshare1:S.DJ.VC_SHARE_CS1, hdmi1:S.DJ.VC_SHARE_HDMI1,
                      hdmi2:S.DJ.VC_SHARE_HDMI2, delegate:S.DJ.VC_SHARE_DELEG };
    Object.values(joinMap).forEach(j=>S.setD(j,false));
    if(joinMap[src]) S.setD(joinMap[src],true);

    S.setS(S.SJ.MATRIX_CMD,`TEAMS_CONTENT_SRC ${src.toUpperCase()}`);
    S.toast(`Content share: ${btn.textContent.trim()}`);
  }

  function selectLayout(btn) {
    document.querySelectorAll('#layout-btns .layout-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const layout=btn.dataset.layout;
    st.vc.layout=layout;
    const joinMap={gallery:S.DJ.VC_LAYOUT_GAL,speaker:S.DJ.VC_LAYOUT_SPK,
                   content_people:S.DJ.VC_LAYOUT_CP,fullscreen:S.DJ.VC_LAYOUT_FS};
    Object.values(joinMap).forEach(j=>S.setD(j,false));
    if(joinMap[layout]) S.setD(joinMap[layout],true);
    S.toast(`Layout: ${btn.textContent.trim()}`);
  }

  /* ── Slider helpers ─────────────────────────────────── */
  function _updateSliderBg(el,val) {
    el.style.background=`linear-gradient(to right,var(--accent) ${val}%,var(--surface3) ${val}%)`;
  }
  function _updateSliderBgV(el,val) {
    el.style.background=`linear-gradient(to top,var(--accent) ${val}%,var(--surface3) ${val}%)`;
  }

  // Attach globals
  window.toggleMic         = toggleMic;
  window.updateMicGain     = updateMicGain;
  window.toggleZone        = toggleZone;
  window.updateMasterVol   = updateMasterVol;
  window.toggleAllMute     = toggleAllMute;
  window.toggleNetworkMute = toggleNetworkMute;
  window.selectAudioPreset = selectAudioPreset;
  window.joinTeamsMeeting  = joinTeamsMeeting;
  window.toggleCall        = toggleCall;
  window.toggleVcCtrl      = toggleVcCtrl;
  window.selectShare       = selectShare;
  window.selectLayout      = selectLayout;
})(SIMPL);
