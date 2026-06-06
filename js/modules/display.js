/**
 * Display Module – Sony 98″ BRAVIA 98B253L (×2)
 * Protocol: RS-232 @ 9600 baud / IP (Bravia Professional Display API)
 * Serial format: <STX>POWR####<ETX>  (IRCC-IP commands)
 *
 * Crestron Digital Joins used:
 *   D1_POWER_ON=10  D1_POWER_OFF=11  D1_SRC1-6=12-17
 *   D2_POWER_ON=20  D2_POWER_OFF=21  D2_SRC1-6=22-27
 * Crestron Serial Joins:
 *   D1_SRC_LABEL=3   D2_SRC_LABEL=4
 * Crestron Analog Joins:
 *   D1_SRC_FB=10   D2_SRC_FB=11
 */
(function(S) {
  'use strict';

  const SOURCES = {
    1: { label:'ClickShare 1',  cmd:'HDMI 1'   },
    2: { label:'HDMI 1',        cmd:'HDMI 2'   },
    3: { label:'HDMI 2',        cmd:'HDMI 3'   },
    4: { label:'Laptop USB-C',  cmd:'HDMI 4'   },
    5: { label:'ClickShare 2',  cmd:'HDMI 5'   },
    6: { label:'IPTV',          cmd:'TV'        },
    7: { label:'HDMI 3',        cmd:'HDMI 6'   },
  };

  // Sony BRAVIA RS-232 power command builder
  function _sonyCmd(cmd) {
    return `\x02${cmd}\x03`;
  }

  function setDisplayOn(n) {
    S.state.displays[n].on = true;
    S.setD(n===1 ? S.DJ.D1_POWER_ON : S.DJ.D2_POWER_ON, true);
    S.setD(n===1 ? S.DJ.D1_POWER_OFF: S.DJ.D2_POWER_OFF, false);
    // Serial: BRAVIA IRCC-IP power-on
    S.setS(S.SJ.MATRIX_CMD, _sonyCmd(`POWR0001`));

    const badge = document.getElementById(`d${n}-badge`);
    const prev  = document.getElementById(`d${n}-preview`);
    if (badge) { badge.className='panel-badge badge-on'; badge.textContent='ON'; }
    if (prev && S.state.displays[n].src) prev.classList.add('has-signal');

    S.toast(`Display ${n}: Power ON`);
  }

  function setDisplayOff(n) {
    S.state.displays[n].on = false;
    S.setD(n===1 ? S.DJ.D1_POWER_ON : S.DJ.D2_POWER_ON, false);
    S.setD(n===1 ? S.DJ.D1_POWER_OFF: S.DJ.D2_POWER_OFF, true);
    S.setS(S.SJ.MATRIX_CMD, _sonyCmd(`POWR0000`));

    const badge = document.getElementById(`d${n}-badge`);
    const label = document.getElementById(`d${n}-signal-label`);
    const prev  = document.getElementById(`d${n}-preview`);
    if (badge) { badge.className='panel-badge badge-off'; badge.textContent='OFF'; }
    if (label) label.textContent='No Signal';
    if (prev)  prev.classList.remove('has-signal');

    // Clear active source buttons
    document.querySelectorAll(`#d${n}-sources .source-btn`)
      .forEach(b=>b.classList.remove('active'));

    S.toast(`Display ${n}: Power OFF`);
  }

  function setAllDisplays(on) {
    if (on) { setDisplayOn(1); setDisplayOn(2); }
    else    { setDisplayOff(1); setDisplayOff(2); }
  }

  function setSource(btn, dispNum) {
    if (!S.state.displays[dispNum].on) {
      S.toast(`Display ${dispNum} is off — power on first`);
      return;
    }

    const srcIndex = parseInt(btn.dataset.src, 10);
    const srcLabel = btn.dataset.label;
    S.state.displays[dispNum].src = srcIndex;

    // Digital join feedback
    const base = dispNum === 1 ? S.DJ.D1_SRC1 : S.DJ.D2_SRC1;
    for (let i=0; i<6; i++) S.setD(base+i, false);
    S.setD(base + (srcIndex-1), true);

    // Analog + serial feedback
    S.setA(dispNum===1 ? S.AJ.D1_SRC_FB : S.AJ.D2_SRC_FB, srcIndex*1000);
    S.setS(dispNum===1 ? S.SJ.D1_SRC_LABEL : S.SJ.D2_SRC_LABEL, srcLabel);

    // Sony BRAVIA input command (IRCC-IP / RS-232)
    const src = SOURCES[srcIndex];
    if (src) S.setS(S.SJ.MATRIX_CMD, _sonyCmd(`INPT0001${srcIndex.toString().padStart(4,'0')}`));

    // UI: highlight selected source
    const grid = document.getElementById(`d${dispNum}-sources`);
    if (grid) grid.querySelectorAll('.source-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');

    // Preview label
    const lbl = document.getElementById(`d${dispNum}-signal-label`);
    if (lbl) lbl.textContent = `▶ ${srcLabel}`;
    document.getElementById(`d${dispNum}-preview`).classList.add('has-signal');

    // Matrix mirror mode: route same source to both displays
    if (S.state.matrixMode === 'mirror' && dispNum === 1) {
      _mirrorToDisplay2(srcIndex);
    }

    S.toast(`Display ${dispNum}: ${srcLabel}`);
  }

  function _mirrorToDisplay2(srcIndex) {
    S.state.displays[2].src = srcIndex;
    const src = SOURCES[srcIndex];
    const lbl2 = document.getElementById('d2-signal-label');
    if (lbl2 && src) lbl2.textContent=`▶ ${src.label}`;
    document.querySelectorAll('#d2-sources .source-btn').forEach(b=>{
      b.classList.toggle('active', parseInt(b.dataset.src,10)===srcIndex);
    });
  }

  function setMatrixMode(mode) {
    S.state.matrixMode = mode;
    const join = { mirror:S.DJ.MATRIX_MIRROR, independent:S.DJ.MATRIX_INDEP, extend:S.DJ.MATRIX_EXTEND }[mode];
    if (join) {
      [S.DJ.MATRIX_MIRROR,S.DJ.MATRIX_INDEP,S.DJ.MATRIX_EXTEND].forEach(j=>S.setD(j,false));
      S.setD(join, true);
    }
    S.setS(S.SJ.MATRIX_CMD, `MXMD ${mode.toUpperCase()}`);
    S.toast(`Matrix: ${mode} mode`);
  }

  function liftControl(action) {
    S.setD(action==='deploy' ? S.DJ.LIFT_DEPLOY : S.DJ.LIFT_RETRACT, true);
    setTimeout(()=>S.setD(action==='deploy' ? S.DJ.LIFT_DEPLOY : S.DJ.LIFT_RETRACT, false), 500);
    S.setS(S.SJ.MATRIX_CMD, `LIFT_${action.toUpperCase()}`);
    S.toast(`AX-22MF Monitor: ${action==='deploy'?'Deploying ▼':'Retracting ▲'}`);
  }

  // Attach globals
  window.setDisplayOn    = setDisplayOn;
  window.setDisplayOff   = setDisplayOff;
  window.setAllDisplays  = setAllDisplays;
  window.setSource       = setSource;
  window.setMatrixMode   = setMatrixMode;
  window.liftControl     = liftControl;
  window.showPage        = S.showPage;
  window.systemPowerOff  = S.systemPowerOff;
  window.toast           = S.toast;
})(SIMPL);
