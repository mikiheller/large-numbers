# Zoom the Number

A kid-friendly place value game for ages 6+: explore thousands, ten-thousands, hundred-thousands, and millions through a toy-like sandbox and short quests.

## Play

Open `index.html` in a modern browser (Chrome, Safari, Firefox). No build step required.

## Features

- **Sandbox**: Bins for each unit (Pebble → Castle), +/− with auto-trade and auto-borrow, big total display (tap to hear), zoom slider, and jump buttons (1K, 10K, 100K, 1M). Celebrations when you reach new tiers.
- **Quests**: 15 levels—Build it, Which is bigger?, and Biggest number with N pieces.
- **Audio**: Sounds for add/trade/success and optional speech for the total and prompts. Mute toggle in the header.

## Project layout

- `index.html` — Single-page shell (Sandbox / Quests tabs).
- `css/style.css` — Layout, bins, buttons, quest UI.
- `js/model.js` — Place value model: add, subtract, setTotal, computeTotal, normalize.
- `js/sandbox.js` — Sandbox UI and milestone celebrations.
- `js/quests.js` — Quest levels and types (build, compare, biggest).
- `js/audio.js` — TTS and simple Web Audio cues.
- `js/app.js` — Mode switch and init.

## License

MIT.
