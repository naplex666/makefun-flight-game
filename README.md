# Garuda Ridge Run — a mountain courier flight

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/naplex666/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/naplex666/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

**Garuda Ridge Run** is a complete, original 3D flight game built for the
[Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057)
competition on make.fun. Fly a bush plane down the Merapi valley, thread all
8 glowing rings before the clock runs out, mind the ridges, and bring the mail home.

## How to play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit
http://localhost:8080). No network, no downloads — everything runs from these files.

- **W / ↑** climb · **S / ↓** dive · **A / D** bank & turn
- **SHIFT / CTRL** throttle up / down
- **C** chase / cockpit camera · **V** day / dusk · **P** pause · **R** restart

Thread a ring to score 100 points — and thread it properly: a ring only counts
when you fly THROUGH the glowing hoop. Climbing over it or slipping past the
side is a miss, and the ring stays lit until you loop back through it.
Finish all 8 for a 500-point bonus plus 2 points per second left. Three lives — the mountains are not forgiving.
Stall (too slow) and the plane sinks; hit terrain and you lose a life and
respawn at the last ring.

## What is in the game

- **3D valley** (Three.js, vendored locally): seeded procedural terrain with a
  carved river valley, rice-field patchwork, dirt road, villages, pine forest,
  boulders, drifting clouds, a runway with windsock, and 8 numbered glowing
  rings along the course — each a true gate with a beacon column on the next one.
- **A real flight model**: throttle, pitch, bank-to-turn, climb speed bleed,
  stall sink, terrain collision, respawn at the last ring. Rings are gates, not
  checkpoints: only flying through the hoop counts.
- **A live HUD**: altitude, speed, vertical speed, heading + compass, score,
  rings, countdown timer, lives, throttle bar — plus a next-ring guidance strip
  (ring number, turn arrow, distance, height to the gate) and a cockpit attitude
  indicator with live RPM and airspeed in cockpit view.
- **Two looks**: bright day alpine (default) and dusk ridge — press V to swap.
- **Physics-modelled sound**: the engine note is built from crank rpm (firing
  pulses + propeller blade-pass) with spool lag and a lumpy idle, wind rush
  that grows with airspeed, ring chimes and a crash thud (WebAudio, no files).
- **Deterministic screenshots**: `?shot=start|play|cockpit|end&seed=1` freezes
  the game in a readable pose (see `shots.json`).

## Files

- `main.ts` — the entry program (Node 22): copies `game/` and `screenshots/`
  to the output and writes the dossier with the vendored make.fun library.
- `game/` — the playable game as static files (`index.html` + ES modules).
  `game/vendor/three.module.min.js` is the vendored Three.js r160 build.
- `game/src/` — one job per file: `config` (course + two palettes), `random`
  (seeded noise), `world` (terrain, river, trees, clouds, runway, rings),
  `plane` (aircraft mesh + flight physics), `input`, `hud`, `audio`, `shots`,
  `main` (state machine, camera, rings, crashes).
- `screenshots/` — 4 real renders of the game's own code.
- `vendor/makefun-game.ts` — the make.fun library, copied unchanged from the kit.
