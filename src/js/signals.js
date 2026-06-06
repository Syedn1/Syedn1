/**
 * CrComLib bridge — wraps the Crestron Communication Library.
 * When the panel library is absent (browser preview), a lightweight
 * mock is substituted so the UI still demonstrates its behavior.
 */

const isCrComAvailable = () =>
  typeof window.CrComLib !== 'undefined' && window.CrComLib !== null;

/* ─────────────────────────────────────────
   Internal subscription registry
───────────────────────────────────────── */
const _subscriptions = new Map(); // signalName → [{ id, callback }]
let _subIdCounter = 1;

/* ─────────────────────────────────────────
   Mock state for browser preview
───────────────────────────────────────── */
const _mockState = {
  // Lighting
  lights_master_on_fb: false,
  zone1_on_fb: true, zone2_on_fb: true, zone3_on_fb: true, zone4_on_fb: false,
  zone1_level_fb: 75,  zone2_level_fb: 60,
  zone3_level_fb: 40,  zone4_level_fb: 0,
  zone1_name_fb: 'Living Room', zone2_name_fb: 'Kitchen',
  zone3_name_fb: 'Dining Room', zone4_name_fb: 'Entry',
  preset_morning_fb: false, preset_day_fb: false,
  preset_evening_fb: true,  preset_night_fb: false, preset_movie_fb: false,
  // Climate
  hvac_mode_cool_fb: true, hvac_mode_heat_fb: false,
  hvac_mode_auto_fb: false, hvac_mode_off_fb: false,
  fan_speed_auto_fb: true,  fan_speed_low_fb: false,
  fan_speed_med_fb: false,  fan_speed_high_fb: false,
  current_temp_fb: 72, humidity_fb: 45,
  setpoint_cool_fb: 68, setpoint_heat_fb: 65,
  hvac_status_fb: 'Cooling Active',
  // A/V
  av_power_fb: true,
  source_tv_fb: false, source_cable_fb: false,
  source_appletv_fb: true, source_bluray_fb: false,
  source_radio_fb: false, source_aux_fb: false,
  vol_mute_fb: false, volume_level_fb: 45,
  transport_playing_fb: true,
  now_playing_fb: 'Midnight City — M83',
  source_name_fb: 'Apple TV',
  // Shades
  shade1_position_fb: 0, shade2_position_fb: 0,
  shade3_position_fb: 0, shade4_position_fb: 0,
};

/* ─────────────────────────────────────────
   Public API
───────────────────────────────────────── */

/**
 * Subscribe to a signal feedback value.
 * @param {'b'|'n'|'s'} type  b=boolean, n=number, s=string
 * @param {string}       name Signal name
 * @param {Function}     cb   Callback(value)
 * @returns {string} subscription ID (use to unsubscribe)
 */
export function subscribe(type, name, cb) {
  const id = String(_subIdCounter++);

  if (isCrComAvailable()) {
    const crId = window.CrComLib.subscribeState(type, name, cb);
    return crId;
  }

  // Mock: register locally and immediately fire with current mock value
  if (!_subscriptions.has(name)) _subscriptions.set(name, []);
  _subscriptions.get(name).push({ id, callback: cb });

  const val = _mockState[name];
  if (val !== undefined) setTimeout(() => cb(val), 0);

  return id;
}

/**
 * Unsubscribe from a signal.
 */
export function unsubscribe(type, name, id) {
  if (isCrComAvailable()) {
    window.CrComLib.unsubscribeState(type, name, id);
    return;
  }
  const subs = _subscriptions.get(name);
  if (!subs) return;
  const idx = subs.findIndex(s => s.id === id);
  if (idx !== -1) subs.splice(idx, 1);
}

/**
 * Publish a boolean pulse signal (send-event).
 */
export function publishBoolean(name, value = true) {
  if (isCrComAvailable()) {
    window.CrComLib.publishEvent('b', name, value);
    return;
  }
  _mockPublish(name, value);
}

/**
 * Publish a number/analog signal.
 * @param {string} name
 * @param {number} value  0–65535 (Crestron analog range)
 */
export function publishNumber(name, value) {
  if (isCrComAvailable()) {
    window.CrComLib.publishEvent('n', name, value);
    return;
  }
  _mockPublish(name, value);
}

/**
 * Publish a string/serial signal.
 */
export function publishString(name, value) {
  if (isCrComAvailable()) {
    window.CrComLib.publishEvent('s', name, value);
    return;
  }
  _mockPublish(name, value);
}

/* Convert 0-100% to Crestron 0-65535 analog range */
export function pctToAnalog(pct) {
  return Math.round((pct / 100) * 65535);
}

/* Convert Crestron 0-65535 to 0-100% */
export function analogToPct(analog) {
  return Math.round((analog / 65535) * 100);
}

/* ─────────────────────────────────────────
   Mock internals
───────────────────────────────────────── */
function _mockPublish(name, value) {
  // Update mock state and notify subscribers for relevant feedback signals
  _mockState[name] = value;

  // Derive feedback signal name pattern
  const fbName = name + '_fb';
  if (_mockState[fbName] !== undefined) {
    _mockState[fbName] = value;
    _notifySubscribers(fbName, value);
  }

  // Mirror exclusive mode group feedbacks (HVAC modes, fan speeds)
  const hvacModes = ['hvac_mode_cool', 'hvac_mode_heat', 'hvac_mode_auto', 'hvac_mode_off'];
  const fanSpeeds = ['fan_speed_auto', 'fan_speed_low', 'fan_speed_med', 'fan_speed_high'];
  const sources   = ['source_tv', 'source_cable', 'source_appletv', 'source_bluray', 'source_radio', 'source_aux'];
  const lightScenes = ['preset_morning', 'preset_day', 'preset_evening', 'preset_night', 'preset_movie'];

  [hvacModes, fanSpeeds, sources, lightScenes].forEach(group => {
    if (group.includes(name)) {
      group.forEach(g => {
        const fb = g + '_fb';
        const newVal = (g === name) ? true : false;
        _mockState[fb] = newVal;
        _notifySubscribers(fb, newVal);
      });
    }
  });
}

function _notifySubscribers(name, value) {
  const subs = _subscriptions.get(name);
  if (!subs || subs.length === 0) return;
  subs.forEach(({ callback }) => {
    try { callback(value); } catch (e) { /* */ }
  });
}
