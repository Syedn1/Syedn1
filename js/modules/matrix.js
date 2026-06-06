/**
 * Matrix Module – Crestron 4×4 HDMI Matrix Switcher
 * Outputs: Display 1, Display 2
 * Inputs:  1=Blu-ray  2=Laptop1  3=Laptop2  4=PC  5=Wireless1  6=Wireless2
 */
(function attachMatrixModule(S) {
  'use strict';

  function routeMatrix(output, input) {
    if (!S._state.systemOn) { S._toast('System is OFF'); return; }

    const prev = S._state.matrix[output];
    S._state.matrix[output] = input;

    // Update display preview label
    const label = document.getElementById(`disp${output}-input-label`);
    if (label) {
      label.textContent = input ? `INPUT: ${S.SOURCE_NAMES[input]}` : '— NO SIGNAL —';
    }

    // Update display source state
    if (S._state.displays[output]) {
      S._state.displays[output].source = input;
    }

    // Highlight active input button
    _refreshInputBtns(output, input);

    // Update matrix grid cells
    _refreshMatrixGrid(output, prev, input);

    // Emit serial command (simulated RS-232 to matrix)
    const cmd = `CL${output}I${input}!`;   // e.g. CL1I2!
    S._setS(`matrix_cmd`, cmd);
    S._setS('matrix_status', `OUT${output}→IN${input}`);

    // Audio Follow Video
    if (S._state.afvEnabled) {
      S._setA(`audio_follow_out${output}`, input);
    }

    S._toast(`Matrix: OUT ${output} → ${S.SOURCE_NAMES[input]}`);
  }

  function _refreshInputBtns(output, activeInput) {
    for (let i = 1; i <= 6; i++) {
      const btn = document.getElementById(`d${output}-src${i}`);
      if (btn) btn.classList.toggle('active', i === activeInput);
    }
  }

  function _refreshMatrixGrid(output, prev, curr) {
    if (prev) {
      const prevCell = document.getElementById(`mx-${output}-${prev}`);
      if (prevCell) prevCell.classList.remove('active');
    }
    if (curr) {
      const newCell = document.getElementById(`mx-${output}-${curr}`);
      if (newCell) newCell.classList.add('active');
    }
  }

  S.routeMatrix = routeMatrix;
})(SIMPL);
