# Crestron CH5 UI — TS-770 & iPad

A complete Crestron HTML5 (CH5) control interface for the **TS-770 7" touch panel** and **iPad via WebXPanel**.

## Pages

| Page | Description |
|------|-------------|
| **Home** | Status overview, scene presets, quick actions |
| **Lighting** | 4-zone dimmer control + 6 scene presets |
| **Climate** | Thermostat, mode selector (Cool/Heat/Auto/Off), fan speed |
| **A/V** | 6-source selector, volume, transport controls, now playing |
| **Shades** | 4-zone shade control + Open All / Privacy / Blackout / Close All |

## Setup

```bash
npm install
npm run dev        # Browser preview (mock signals)
npm run build      # Production build → ./dist
npm run deploy:panel   # Deploy to TS-770 (configure IP in project.json)
```

## Configuration

Edit **`project.json`** to set your control processor IP address:
```json
{
  "crestronCHFiveDeploy": {
    "deviceAddress": "192.168.1.100"
  },
  "webXPanel": {
    "host": "192.168.1.100",
    "ipId": "0x03"
  }
}
```

Edit **`webxpanel.config.json`** to match your WebXPanel settings for iPad.

## Signal Contract

All signals are defined in **`contract.cse2j`**.  
Import this file into your SIMPL Windows or SIMPL# Pro program for auto-generated signal wiring.

### Key Signal Groups

**Lighting** — `zone1_level` … `zone4_level` (0–65535), `preset_morning/day/evening/night/movie`, `lights_master_on/off`

**Climate** — `setpoint_cool/heat`, `hvac_mode_cool/heat/auto/off`, `fan_speed_auto/low/med/high`, `current_temp_fb`, `humidity_fb`

**A/V** — `source_appletv/tv/cable/bluray/radio/aux`, `volume_level` (0–65535), `vol_mute`, `transport_play/pause/next/prev`

**Shades** — `shade1..4_open/close/stop`, `shade1..4_position` (0–65535), scene presets

## Target Devices

- **Crestron TS-770** — 7" 1280×800 capacitive touch screen
- **Crestron TS-770-B** (Black version)
- **iPad** via Crestron WebXPanel / XPanel
- Any modern WebKit/Chromium browser (for development)

## Tech Stack

- Vanilla HTML5 / CSS3 (custom properties design system) / ES Modules
- `@crestron/ch5-components` — CH5 custom element library
- `@crestron/ch5-crcomlib` — signal communication to control processor
- `@crestron/ch5-webxpanel` — iPad/browser WebXPanel connection
- Vite — build tool & dev server
