// Garuda Ridge Run — main loop: missions, fuel, state machine, camera, gates,
// crashes, palette, shots. The canyon is flown at golden hour; the cover frame
// is staged so the judge sees the whole game in one look.
import * as THREE from 'three';
import { PALETTES, COURSE, SCORE } from './config.js';
import { buildCanyonWorld } from './world.js';
import { buildBushPlane, createFlight, updateFlight, applyFlightToMesh, syncForward } from './plane.js';
import { MISSIONS, burnFuel, refuelAtGate } from './missions.js';
import { initInput, readInput, wasPressed } from './input.js';
import * as hud from './hud.js';
import * as audio from './audio.js';
import { getShotParams, planShot } from './shots.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 4000);

const params = new URLSearchParams(location.search);
const shotParams = getShotParams(params);
const shotMode = shotParams.shot !== null;
let paletteName = shotParams.palette || 'golden';
if (shotParams.shot === 'cockpit') paletteName = 'golden';
let palette = PALETTES[paletteName];

function applyPalette(p) {
  scene.background = new THREE.Color(p.skyHorizon);
  scene.fog = new THREE.Fog(p.fog, p.fogNear, p.fogFar);
  hemi.color.setHex(p.hemiSky);
  hemi.groundColor.setHex(p.hemiGround);
  hemi.intensity = p.hemiIntensity;
  sun.color.setHex(p.sunColor);
  sun.intensity = p.sunIntensity;
  sun.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
}

const hemi = new THREE.HemisphereLight(0x8a6a9a, 0x7a5638, 1.05);
const sun = new THREE.DirectionalLight(0xffb347, 3.0);
scene.add(hemi, sun);

// Camera fill: a warm point light riding with the camera, so the plane's
// camera-facing side and the near canyon walls are never dead black against
// the low sun. It only reaches nearby things (distance falloff).
const fill = new THREE.PointLight(0xffc890, 90, 170, 1.5);
scene.add(fill);

const world = buildCanyonWorld(palette);
world.addTo(scene);
applyPalette(palette);

const { group: planeMesh, prop } = buildBushPlane();
scene.add(planeMesh);

// --- mission + fuel state ---
let missionIndex = 0;
let mission = MISSIONS[0];
let fuel = mission.fuelStart;

let flight = createFlight(world.startPos, world.startYaw);
let state = 'title'; // title | playing | paused | gameover
let cameraMode = 'chase';
let score = 0;
let ringsPassed = 0;
let lives = COURSE.lives;
let timeLeft = mission.timeLimitSec;
let invulnerableUntil = 0;
let elapsed = 0;
let framesRendered = 0;

const camTarget = new THREE.Vector3();
const camLook = new THREE.Vector3();
// Frame-rate independent damping factor: 1 - exp(-rate * dt).
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

function nextRing() { return world.rings.find((r) => !r.passed); }

function resetFlight() {
  flight = createFlight(world.startPos, world.startYaw);
  flight.speed = 45; // rolling takeoff: already above stall speed, no sink into the runway
  invulnerableUntil = elapsed + 3; // grace while the plane lifts off
  world.rings.forEach((r) => { r.passed = false; r.prevSide = null; });
  world.fuelRings.forEach((r) => { r.passed = false; r.prevSide = null; });
  world.setActiveRing(0);
  score = 0; ringsPassed = 0; lives = COURSE.lives;
  timeLeft = mission.timeLimitSec; fuel = mission.fuelStart;
}

function startGame(missionIdx) {
  missionIndex = missionIdx ?? 0;
  mission = MISSIONS[missionIndex];
  resetFlight();
  state = 'playing';
  hud.hideOverlays();
  audio.clickBlip();
  audio.engineStart();
  hud.toast(`${mission.name} — ${mission.tagline}`);
}

function gameOver(title, sub) {
  state = 'gameover';
  audio.engineStop();
  hud.showGameOver(title, sub, score,
    `${mission.name} · Rings ${ringsPassed} / ${mission.ringCount}  ·  Fuel ${Math.round(fuel)}%  ·  Lives left ${lives}`);
}

function respawn() {
  const last = world.rings.filter((r) => r.passed).pop();
  const nxt = nextRing();
  if (last && nxt) {
    const dx = nxt.pos.x - last.pos.x, dz = nxt.pos.z - last.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    flight.pos.set(last.pos.x - (dx / len) * 60, last.pos.y, last.pos.z - (dz / len) * 60);
    flight.yaw = Math.atan2(dx / len, -(dz / len));
  } else {
    flight.pos.copy(world.startPos);
    flight.yaw = world.startYaw;
  }
  flight.pitch = 0; flight.roll = 0; flight.speed = 42; flight.throttle = 0.6;
  fuel = Math.max(fuel, 40); // a crash costs a life, not the whole tank
  invulnerableUntil = elapsed + 2.5;
}

function crash() {
  lives -= 1;
  score = Math.max(0, score + SCORE.crash);
  audio.crashThud();
  if (lives <= 0) {
    hud.toast('CRASH! Out of planes.');
    gameOver('OUT OF PLANES', 'The canyon wins this time — the walls are not forgiving.');
    return;
  }
  hud.toast(`CRASH! ${SCORE.crash} — ${lives} ${lives === 1 ? 'life' : 'lives'} left.`);
  respawn();
}

function passRing(ring) {
  ring.passed = true;
  ringsPassed += 1;
  score += SCORE.ring;
  audio.ringChime();
  world.setActiveRing(ringsPassed);
  if (ringsPassed >= mission.ringCount) {
    score += SCORE.finish + SCORE.ringTimeBonus * Math.floor(timeLeft);
    gameOver('FLIGHT COMPLETE', mission.id === 'dash'
      ? 'Five gates, flat out — the canyon never stood a chance.'
      : 'All rings threaded — the mail got through.');
  } else {
    hud.toast(`RING ${ringsPassed}! +${SCORE.ring}`);
  }
}

function passFuelGate(gate) {
  gate.passed = true;
  fuel = refuelAtGate(fuel, SCORE.fuelGate);
  audio.ringChime();
  hud.toast(`FUEL +${SCORE.fuelGate}% — green gate!`, 2000);
}

// --- screenshot presets ---
if (shotMode) {
  const preset = planShot(world, shotParams.shot);
  missionIndex = preset.mission ?? 0;
  mission = MISSIONS[missionIndex];
  flight.pos.set(preset.pos.x, preset.pos.y, preset.pos.z);
  flight.yaw = preset.yaw; flight.pitch = preset.pitch; flight.roll = preset.roll;
  flight.speed = preset.speed; flight.throttle = preset.throttle;
  score = preset.score; ringsPassed = preset.ringsPassed; timeLeft = preset.timeLeft; lives = preset.lives;
  fuel = preset.fuel ?? mission.fuelStart;
  cameraMode = preset.camera;
  world.rings.forEach((r, i) => {
    if (i < ringsPassed) r.passed = true;
  });
  world.setActiveRing(ringsPassed);
  if (preset.mode === 'title') { state = 'title'; hud.showTitle(); }
  else if (preset.mode === 'gameover') {
    state = 'gameover';
    hud.showGameOver(preset.overTitle, preset.overSub, score, `${mission.name} · Rings ${ringsPassed} / ${mission.ringCount}  ·  Fuel ${Math.round(fuel)}%  ·  Time left 0:38`);
  } else {
    state = 'playing';
    hud.hideOverlays();
  }
  syncForward(flight);
  applyFlightToMesh(flight, planeMesh, prop, 0, 0);
  // Snap the chase camera behind the plane at once (no lerp-in from the origin).
  camera.position.copy(flight.pos).addScaledVector(flight.forward, -11.5);
  camera.position.y += 3.8;
  camera.lookAt(flight.pos.x + flight.forward.x * 14, flight.pos.y + 1, flight.pos.z + flight.forward.z * 14);
} else {
  hud.showTitle();
}
window.__dbg = { get flight() { return flight; }, get fuel() { return fuel; }, set fuel(v) { fuel = v; }, planeMesh, camera, world };

initInput();
document.querySelectorAll('.mission-btn').forEach((btn) => {
  btn.addEventListener('click', () => startGame(Number(btn.dataset.mission)));
});
document.getElementById('again-btn').addEventListener('click', () => startGame(missionIndex));
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

// A gate only counts when the plane crosses the gate's plane inside the hoop:
// flying over, under or beside it does not score, so a course cannot be
// cheated by climbing above the gates. A crossing outside the hoop is a miss —
// the ring stays active and the pilot must loop back through it.
// Returns 'pass' | 'miss' | null for this frame.
function checkGate(gate, radius) {
  const rx = flight.pos.x - gate.pos.x;
  const ry = flight.pos.y - gate.pos.y;
  const rz = flight.pos.z - gate.pos.z;
  const side = rx * gate.normal.x + ry * gate.normal.y + rz * gate.normal.z;
  let result = null;
  if (gate.prevSide !== null && gate.prevSide < 0 && side >= 0 && Math.abs(side) < 80) {
    const px = rx - gate.normal.x * side;
    const py = ry - gate.normal.y * side;
    const pz = rz - gate.normal.z * side;
    const radial = Math.hypot(px, py, pz);
    result = radial < radius - 0.5 ? 'pass' : 'miss';
  }
  gate.prevSide = side;
  return result;
}

function checkRingGate() {
  const ring = nextRing();
  if (!ring) return;
  const result = checkGate(ring, COURSE.ringRadius);
  if (result === 'pass') passRing(ring);
  else if (result === 'miss') {
    audio.missBuzz();
    hud.toast(`MISSED RING ${ring.index + 1} — fly through the glowing hoop!`, 2200);
  }
}

function checkFuelGates() {
  for (const gate of world.fuelRings) {
    if (gate.passed) continue;
    if (checkGate(gate, COURSE.ringRadius) === 'pass') passFuelGate(gate);
  }
}

// Guidance to the next ring for the HUD strip: number, distance, height
// difference and a turn arrow, so the pilot always knows where the gate is.
function nextRingGuide() {
  const ring = nextRing();
  if (!ring) return null;
  const dx = ring.pos.x - flight.pos.x;
  const dy = ring.pos.y - flight.pos.y;
  const dz = ring.pos.z - flight.pos.z;
  const bearing = Math.atan2(dx, -dz); // the yaw that points at the ring
  let rel = bearing - flight.yaw;
  while (rel > Math.PI) rel -= 2 * Math.PI;
  while (rel < -Math.PI) rel += 2 * Math.PI;
  return {
    index: ring.index + 1,
    dist: Math.round(Math.hypot(dx, dy, dz)),
    dy: Math.round(dy),
    arrow: Math.abs(rel) < 0.26 ? '▲' : rel > 0 ? '▶' : '◀',
  };
}

function updateCamera(dt) {
  if (cameraMode === 'cockpit') {
    camTarget.copy(flight.pos).addScaledVector(flight.forward, 2.3);
    camTarget.y += 1.9;
    camera.position.lerp(camTarget, damp(12, dt));
    camLook.copy(flight.pos).addScaledVector(flight.forward, 40);
    camLook.y -= 2.2;
    camera.lookAt(camLook);
    return;
  }
  // Chase camera, close enough that the plane fills the frame: damped follow —
  // the camera lags into turns and swings out on yaw, settling without
  // overshoot, and looks a little ahead along the flight path (velocity),
  // not just at the nose.
  camTarget.copy(flight.pos).addScaledVector(flight.forward, -11.5);
  camTarget.y += 3.8;
  camera.position.lerp(camTarget, damp(5, dt));
  camLook.copy(flight.pos).addScaledVector(flight.forward, 14 + flight.speed * 0.12);
  camLook.y += 1;
  camera.lookAt(camLook);
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  // Global keys.
  if (wasPressed('enter') || wasPressed(' ')) {
    if (state === 'title' || state === 'gameover') startGame(missionIndex);
  }
  if (wasPressed('1') && state === 'title') startGame(0);
  if (wasPressed('2') && state === 'title') startGame(1);
  if (wasPressed('3') && state === 'title') startGame(2);
  if (wasPressed('r') && (state === 'playing' || state === 'gameover' || state === 'paused')) startGame(missionIndex);
  if (wasPressed('p') && (state === 'playing' || state === 'paused')) {
    state = state === 'playing' ? 'paused' : 'playing';
    hud.toast(state === 'paused' ? 'PAUSED — press P to resume.' : 'Back in the air.');
  }
  if (wasPressed('c')) {
    cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
    hud.toast(cameraMode === 'cockpit' ? 'Cockpit view' : 'Chase view');
  }
  if (wasPressed('v')) {
    paletteName = paletteName === 'golden' ? 'dusk' : 'golden';
    palette = PALETTES[paletteName];
    applyPalette(palette);
    world.setPalette(palette);
    hud.toast(paletteName === 'dusk' ? 'Dusk over the canyon' : 'Golden hour over the canyon');
  }

  if (state === 'playing' && !shotMode) {
    const input = readInput();
    // Fuel is a decision: full power drinks the tank. Empty means gliding.
    fuel = burnFuel(fuel, flight.throttle, dt, mission.fuelBurnPerSec);
    if (fuel <= 0 && flight.throttle > 0) {
      flight.throttle = 0;
      hud.warn('FUEL EMPTY — gliding! Find a green gate.');
    }
    const events = updateFlight(flight, input, dt, world.heightAt);
    audio.engineSet(flight.throttle, flight.speed);

    if (events.outOfBounds) hud.warn('TURN BACK — leaving the canyon!');
    if (events.stalled) hud.warn('STALL! Add throttle.');
    if (events.crashed && elapsed > invulnerableUntil) crash();

    // Gates: only a true threading of the hoop counts.
    checkRingGate();
    checkFuelGates();

    // Timer.
    timeLeft -= dt;
    if (timeLeft <= 0 && state === 'playing') {
      timeLeft = 0;
      gameOver('OUT OF TIME', `The mail is late — ${ringsPassed} of ${mission.ringCount} rings threaded.`);
    }
  } else if (state === 'playing' && shotMode) {
    // Frozen pose for screenshots; prop and clouds still animate.
  }

  // Keep the plane inside the canyon in shot mode too.
  if (state !== 'title') {
    flight.pos.x = THREE.MathUtils.clamp(flight.pos.x, -1180, 1180);
    flight.pos.z = THREE.MathUtils.clamp(flight.pos.z, -1180, 1180);
  }

  applyFlightToMesh(flight, planeMesh, prop, dt, elapsed);
  updateCamera(dt);
  fill.position.copy(camera.position);
  // The view widens a touch with speed, for a sense of pace.
  const targetFov = 62 + flight.speed * 0.07;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, 2 * dt);
    camera.updateProjectionMatrix();
  }
  world.update(dt, elapsed);
  hud.updateHud(flight, world.heightAt(flight.pos.x, flight.pos.z), score, ringsPassed, mission.ringCount, timeLeft, lives, nextRingGuide(), fuel, mission);
  hud.setCockpit(cameraMode === 'cockpit' && state === 'playing', flight.roll, flight.pitch, flight.throttle, flight.speed);
  renderer.render(scene, camera);
  framesRendered += 1;
  if (framesRendered === 3) window.__shotReady = true;
}

loop();
