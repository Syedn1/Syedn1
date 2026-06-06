/**
 * Display Module – NP Display 1 & 2 (RS-232 / IP control)
 * Simulates: Power, Input, Volume, Mute, Freeze commands
 */
(function attachDisplayModule(S) {
  'use strict';

  function toggleDisplay(dispNum, on) {
    S._state.displays[dispNum].on = on;
    S._setD(`disp${dispNum}_power`, on);

    const preview = document.getElementById(`disp${dispNum}-preview`);
    const label   = document.getElementById(`disp${dispNum}-input-label`);

    if (on) {
      const src = S._state.displays[dispNum].source;
      label.textContent = src ? `INPUT: ${S.SOURCE_NAMES[src]}` : 'INPUT: —';
      preview.classList.add('active');
      S._toast(`Display ${dispNum} powered ON`);
    } else {
      S._state.displays[dispNum].source = 0;
      label.textContent = '— NO SIGNAL —';
      preview.classList.remove('active');
      _clearInputBtns(dispNum);
      S._toast(`Display ${dispNum} powered OFF`);
    }
  }

  function displayCmd(dispNum, cmd) {
    if (!S._state.displays[dispNum].on) { S._toast(`Display ${dispNum} is OFF`); return; }
    const cmdMap = {
      vol_up:  'Volume +',
      vol_dn:  'Volume −',
      mute:    'Mute Toggle',
      freeze:  'Freeze',
    };
    S._setD(`disp${dispNum}_${cmd}`, true);
    setTimeout(() => S._setD(`disp${dispNum}_${cmd}`, false), 200);
    S._toast(`Display ${dispNum}: ${cmdMap[cmd]}`);
  }

  function _clearInputBtns(dispNum) {
    document.querySelectorAll(`[id^="d${dispNum}-src"]`)
      .forEach(b => b.classList.remove('active'));
  }

  S.toggleDisplay = toggleDisplay;
  S.displayCmd    = displayCmd;
})(SIMPL);
