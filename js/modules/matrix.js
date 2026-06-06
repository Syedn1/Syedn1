/**
 * Matrix Module – Crestron HD-MD-8×8-4K-E
 * Protocol: Ethernet / CIP (Crestron IP)
 * RS-232 fallback: CL{out}I{in}!
 *
 * Also handles: Crestron HD-MD-8×8 routing table signals
 * Digital Joins: MATRIX_MIRROR=30, MATRIX_INDEP=31, MATRIX_EXTEND=32
 * Serial Join:   MATRIX_CMD=1
 */
(function(S) {
  'use strict';

  // HD-MD-8×8 TCP command builder
  // Format used by Crestron IP driver:  route output X to input Y
  function _routeCmd(output, input) {
    return `ROUTE ${output} ${input}`;
  }

  function routeOutput(output, input) {
    S.setS(S.SJ.MATRIX_CMD, _routeCmd(output, input));
    // Also send RS-232 fallback
    S.setS(S.SJ.MATRIX_CMD, `CL${output}I${input}!`);
  }

  // Called when matrix mode select changes (from display.js)
  // This module exposes the routing table for cross-reference
  const routingTable = { 1: 0, 2: 0 };  // output → input

  function applyRoute(output, input) {
    routingTable[output] = input;
    routeOutput(output, input);
  }

  // Expose for use by display module mirror logic
  S._matrix = { applyRoute, routingTable };
})(SIMPL);
