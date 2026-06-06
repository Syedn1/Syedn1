/**
 * CH5 Crestron Connector
 * ──────────────────────────────────────────────────────────────────────────
 * This file bridges the ASMO Boardroom HTML touch panel to a real
 * Crestron PRO3 / RMC4 processor using the Crestron CH5 library (CrComLib).
 *
 * HOW IT WORKS:
 *   1. Load Crestron's CH5 library (cr-com-lib.js) on the touch panel
 *   2. CH5 establishes a WebSocket connection to the processor
 *   3. Every button press → publishEvent() sends a signal to processor
 *   4. Feedback from processor → subscribeState() updates the UI
 *
 * HOW TO DEPLOY ON TOUCH PANEL:
 *   Option A – Crestron TS-1070 (built-in browser):
 *     1. Install Crestron Toolbox
 *     2. Tools → File Manager → upload all files to /user/
 *     3. Set browser start URL to: http://localhost/user/index.html
 *     4. The TS-1070 browser has CrComLib built-in
 *
 *   Option B – Crestron CH5 project (ch5-cli):
 *     1. npm install -g @crestron/ch5-utilities-cli
 *     2. ch5-cli package --input ./  --output ./asmo_boardroom.ch5z
 *     3. Upload .ch5z to panel using Crestron Toolbox
 *
 * PROCESSOR SETUP (SIMPL Windows):
 *   1. Add "Crestron Websocket Server" symbol (for CH5 panels)
 *   2. Set IPID for touch panel (e.g. 03)
 *   3. Wire Digital/Analog/Serial signals to joins below
 *
 * JOIN NUMBERS (match ASMO_Boardroom_Main.usp):
 *   Digital 10  = Display1_Power_On    etc. (see signal map in .usp)
 *   Analog  1   = Master_Volume
 *   Serial  7   = Status_Feedback
 * ──────────────────────────────────────────────────────────────────────────
 */

'use strict';

/**
 * CrComLib is loaded by the TS-1070 browser automatically.
 * In simulation mode (standard browser), we use the SIMPL mock engine.
 */
const CH5 = (() => {

  const IS_CRESTRON = (typeof CrComLib !== 'undefined');

  // ── JOIN SIGNAL NAMES ──────────────────────────────────────────────────
  // In CH5, signals can be referenced by join number string or signal name.
  // We use the join numbers from simpl_program.json.
  const JOINS = {
    // System
    SYSTEM_POWER:      'b1',
    // Display 1
    D1_PWR_ON:         'b10',  D1_PWR_OFF:   'b11',
    D1_SRC1: 'b12', D1_SRC2: 'b13', D1_SRC3: 'b14',
    D1_SRC4: 'b15', D1_SRC5: 'b16', D1_SRC6: 'b17',
    // Display 2
    D2_PWR_ON:         'b20',  D2_PWR_OFF:   'b21',
    D2_SRC1: 'b22', D2_SRC2: 'b23', D2_SRC3: 'b24',
    D2_SRC4: 'b25', D2_SRC5: 'b26', D2_SRC6: 'b27',
    // Matrix
    MATRIX_MIRROR:     'b30',  MATRIX_INDEP: 'b31',  MATRIX_EXTEND: 'b32',
    LIFT_DEPLOY:       'b33',  LIFT_RETRACT: 'b34',
    // Camera
    CAM1_SEL:          'b40',  CAM2_SEL:     'b41',
    CAM_TRACK:         'b42',
    CAM_PAN_L:         'b43',  CAM_PAN_R:    'b44',
    CAM_TILT_U:        'b45',  CAM_TILT_D:   'b46',
    CAM_ZOOM_IN:       'b47',  CAM_ZOOM_OUT: 'b48',
    CAM_FOCUS_FAR:     'b49',  CAM_FOCUS_NEAR:'b50',
    CAM_P1:            'b51',  CAM_P2:       'b52',
    CAM_P3:            'b53',  CAM_P4:       'b54',
    CAM_SAVE:          'b55',
    // Audio
    MIC1_MUTE:         'b60',  MIC2_MUTE:    'b61',
    ZONE1:             'b62',  ZONE2:        'b63',
    ALL_MUTE:          'b64',  NET_MUTE:     'b65',
    DSP:               'b66',  ANIUSB:       'b67',
    AUDIO_MEETING:     'b68',  AUDIO_PRES:   'b69',
    AUDIO_VCALL:       'b70',  AUDIO_MUTE:   'b71',
    // VC
    VC_JOIN:           'b80',  VC_LEAVE:     'b81',
    VC_MIC:            'b82',  VC_CAM:       'b83',
    VC_SHARE:          'b84',  VC_CHAT:      'b85',
    VC_PEOPLE:         'b86',
    VC_CS1:            'b87',  VC_HDMI1:     'b88',
    VC_HDMI2:          'b89',  VC_DELEG:     'b90',
    VC_GAL:            'b91',  VC_SPK:       'b92',
    VC_CP:             'b93',  VC_FS:        'b94',
    // Analog (prefix 'n')
    MASTER_VOL:        'n1',
    MIC1_GAIN:         'n2',   MIC2_GAIN:    'n3',
    ZONE1_VOL:         'n4',   ZONE2_VOL:    'n5',
    CAM_SPEED:         'n6',
    // Serial feedback (prefix 's')
    STATUS_FB:         's7',
  };

  // Subscription IDs (for cleanup)
  const _subs = {};

  // ── PUBLISH (panel → processor) ───────────────────────────────────────
  function pressJoin(join) {
    if (IS_CRESTRON) {
      CrComLib.publishEvent('boolean', join, true);
    } else {
      // Simulation: fire the SIMPL mock
      console.log(`[CH5 TX] PRESS  ${join}`);
    }
  }

  function releaseJoin(join) {
    if (IS_CRESTRON) {
      CrComLib.publishEvent('boolean', join, false);
    } else {
      console.log(`[CH5 TX] RELEASE ${join}`);
    }
  }

  function setAnalog(join, value) {
    if (IS_CRESTRON) {
      CrComLib.publishEvent('numeric', join, value);
    } else {
      console.log(`[CH5 TX] ANALOG  ${join} = ${value}`);
    }
  }

  // ── SUBSCRIBE (processor → panel) ─────────────────────────────────────
  function onBoolean(join, callback) {
    if (IS_CRESTRON) {
      const id = CrComLib.subscribeState('boolean', join, callback);
      _subs[join] = id;
    }
    // In simulation the SIMPL mock engine drives feedback directly
  }

  function onNumeric(join, callback) {
    if (IS_CRESTRON) {
      const id = CrComLib.subscribeState('numeric', join, callback);
      _subs[join] = id;
    }
  }

  function onString(join, callback) {
    if (IS_CRESTRON) {
      const id = CrComLib.subscribeState('string', join, callback);
      _subs[join] = id;
    }
  }

  // ── WIRE ALL FEEDBACK SIGNALS ──────────────────────────────────────────
  function wireProcessorFeedback() {
    if (!IS_CRESTRON) return;

    // Display 1 feedback
    onBoolean(JOINS.D1_PWR_ON, v => {
      const badge=document.getElementById('d1-badge');
      if(badge){ badge.className=v?'panel-badge badge-on':'panel-badge badge-off';
                 badge.textContent=v?'ON':'OFF'; }
    });

    // Display 2 feedback
    onBoolean(JOINS.D2_PWR_ON, v => {
      const badge=document.getElementById('d2-badge');
      if(badge){ badge.className=v?'panel-badge badge-on':'panel-badge badge-off';
                 badge.textContent=v?'ON':'OFF'; }
    });

    // Camera feedback
    onBoolean(JOINS.CAM1_SEL, v => {
      if(v) document.querySelectorAll('.cam-tab').forEach((b,i)=>b.classList.toggle('active',i===0));
    });
    onBoolean(JOINS.CAM2_SEL, v => {
      if(v) document.querySelectorAll('.cam-tab').forEach((b,i)=>b.classList.toggle('active',i===1));
    });
    onBoolean(JOINS.CAM_TRACK, v => {
      const sw=document.getElementById('tracking-switch');
      if(sw) sw.classList.toggle('off',!v);
    });

    // Mic feedback
    onBoolean(JOINS.MIC1_MUTE, v => {
      const btn=document.getElementById('mic1-btn');
      if(btn){ btn.className=v?'mute-btn muted':'mute-btn active-mic';
               btn.textContent=v?'🔴 Muted':'🟢 Live'; }
    });
    onBoolean(JOINS.MIC2_MUTE, v => {
      const btn=document.getElementById('mic2-btn');
      if(btn){ btn.className=v?'mute-btn muted':'mute-btn active-mic';
               btn.textContent=v?'🔴 Muted':'🟢 Live'; }
    });

    // Zone feedback
    onBoolean(JOINS.ZONE1, v => {
      const t=document.getElementById('zone1-toggle');
      if(t) t.classList.toggle('off',!v);
    });
    onBoolean(JOINS.ZONE2, v => {
      const t=document.getElementById('zone2-toggle');
      if(t) t.classList.toggle('off',!v);
    });

    // All mute feedback
    onBoolean(JOINS.ALL_MUTE, v => {
      const btn=document.getElementById('all-mute-btn');
      if(btn){ btn.textContent=v?'✅ Unmute All':'🔇 MUTE ALL';
               btn.classList.toggle('muted',v); }
    });

    // VC feedback
    onBoolean(JOINS.VC_MIC, v => {
      const btn=document.getElementById('vc-mic-btn');
      if(btn){ btn.classList.toggle('muted-state',!v);
               btn.querySelector('div:last-child').textContent=v?'Mic On':'Mic Off'; }
    });
    onBoolean(JOINS.VC_CAM, v => {
      const btn=document.getElementById('vc-cam-btn');
      if(btn){ btn.classList.toggle('active',v);
               btn.querySelector('div:last-child').textContent=v?'Cam On':'Cam Off'; }
    });

    // Master volume feedback
    onNumeric(JOINS.MASTER_VOL, v => {
      const pct = Math.round(v/655.35);
      const el=document.getElementById('master-vol-num');
      const sl=document.getElementById('master-vol-slider');
      if(el) el.textContent=pct;
      if(sl){ sl.value=pct;
              sl.style.background=`linear-gradient(to top,var(--accent) ${pct}%,var(--surface3) ${pct}%)`; }
    });

    // Status text feedback
    onString(JOINS.STATUS_FB, v => {
      if(v) SIMPL.toast(v);
    });
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────
  return { JOINS, pressJoin, releaseJoin, setAnalog, onBoolean, onNumeric, onString, wireProcessorFeedback, IS_CRESTRON };
})();

// ── OVERRIDE SIMPL FUNCTIONS TO USE CH5 WHEN ON PROCESSOR ─────────────────
// When running on a real TS-1070, publishEvent replaces the mock setD/setA.
// The feedback direction (processor→panel) is handled by wireProcessorFeedback().

(function patchSimplForCH5() {
  if (!CH5.IS_CRESTRON) {
    console.info('[CH5] Simulation mode – using SIMPL mock engine (no real processor)');
    return;
  }

  console.info('[CH5] Crestron processor detected – patching signal bus');

  // Patch SIMPL.setD to also publishEvent to processor
  const origSetD = SIMPL.setD;
  SIMPL.setD = function(join, val) {
    origSetD(join, val);
    // Map join number to CH5 join string
    const joinStr = 'b' + join;
    if (val) {
      CrComLib.publishEvent('boolean', joinStr, true);
      // Auto-release pulsed signals after 200ms
      setTimeout(() => CrComLib.publishEvent('boolean', joinStr, false), 200);
    }
  };

  // Patch SIMPL.setA to publishEvent numeric
  const origSetA = SIMPL.setA;
  SIMPL.setA = function(join, val) {
    origSetA(join, val);
    CrComLib.publishEvent('numeric', 'n' + join, val);
  };

  // Wire processor feedback to panel UI
  CH5.wireProcessorFeedback();
})();
