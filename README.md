# Garuda Ridge Run — a mountain courier flight

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/naplex666/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/naplex666/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

**Garuda Ridge Run** is a complete, original 3D flight game built for the
[Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057)
competition on make.fun. Fly a bush plane down a golden-hour canyon, thread the
glowing rings, watch the fuel gauge — and pick your sortie: three missions,
one canyon, fuel is a decision.

## How to play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit
http://localhost:8080). No network, no downloads — everything runs from these files.

- **W / ↑** climb · **S / ↓** dive · **A / D** bank & turn
- **SHIFT / CTRL** throttle up / down
- **C** chase / cockpit camera · **V** day / dusk · **P** pause · **R** restart

Thread a ring to score 100 points — and thread it properly: a ring only counts
when you fly THROUGH the glowing hoop. Climbing over it or slipping past the
side is a miss, and the ring stays lit until you loop back through it.
Finish the mission for a 500-point bonus plus 2 points per second left. Three lives — the canyon is not forgiving.
Stall (too slow) and the plane sinks; hit terrain and you lose a life and
respawn at the last ring with a topped-up tank.

## Missions

Pick one on the title screen (or keys 1 / 2 / 3):

- **1 · COURIER RUN** — thread all 8 rings before the clock runs out. The classic mail run.
- **2 · CANYON DASH** — five gates, one hundred seconds, a short tank. Fly it flat out — but full power drinks the fuel, so the last gate is a decision.
- **3 · FUEL RUN** — eight rings on a dry tank. Only the green gates refill it; run dry and you glide. Thread a green gate for +30% fuel.

## What is in the game

- **A golden-hour canyon** (Three.js, vendored locally): seeded procedural
  terrain with strata-banded walls framing a sandy floor, a river catching the
  low sun, dirt road, villages, junipers, boulders, warm clouds, a runway with
  windsock, and 8 numbered glowing rings along the course — each a true gate
  with a beacon column on the next one, plus green fuel gates between them.
  A gradient sky dome and a low amber sun put the whole frame in one style.
- **A real flight model**: throttle, pitch, bank-to-turn, climb speed bleed,
  stall sink, terrain collision, respawn at the last ring. Rings are gates, not
  checkpoints: only flying through the hoop counts.
- **Fuel is a decision**: throttle burns the tank, empty means gliding, and
  only the green gates refill it (+30%). A crash costs a life, not the tank.
- **A live HUD**: altitude, speed, vertical speed, heading + compass, score,
  rings, countdown timer, lives, throttle bar, fuel bar, mission banner — plus
  a next-ring guidance strip (ring number, turn arrow, distance, height to the
  gate) and a cockpit attitude indicator with live RPM and airspeed in cockpit view.
- **Two looks**: golden hour (default) and dusk — press V to swap.
- **A built bush plane**: cowling, struts, fixed gear, navigation lights,
  striped fin — chased by a damped camera that sits close enough to fill the frame.
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
  (seeded noise), `world` (canyon, sky dome, sun, river, trees, clouds, runway,
  rings, fuel gates), `plane` (aircraft mesh + flight physics), `missions`
  (three missions + fuel burn/refill), `input`, `hud`, `audio`, `shots`,
  `main` (missions, fuel, state machine, camera, gates, crashes).
- `screenshots/` — 4 real renders of the game's own code.
- `vendor/makefun-game.ts` — the make.fun library, copied unchanged from the kit.
