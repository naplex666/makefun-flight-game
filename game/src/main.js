// Garuda Ridge Run — main loop: state machine, camera, rings, crashes, palette, shots.
import * as THREE from 'three';
import { PALETTES, COURSE, SCORE } from './config.js';
import { makeWorld } from './world.js';
import { buildPlane, createFlight, updateFlight, applyFlightToMesh, syncForward } from './plane.js';
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
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 4000);

const params = new URLSearchParams(location.search);
const shotParams = getShotParams(params);
const shotMode = shotParams.shot !== null;
let paletteName = shotParams.palette || 'day';
if (shotParams.shot === 'cockpit') paletteName = 'dusk';
let palette = PALETTES[paletteName];

function applyPalette(p) {
  scene.background = new THREE.Color(p.sky);
  scene.fog = new THREE.Fog(p.fog, p.fogNear, p.fogFar);
  hemi.color.setHex(p.hemiSky);
  hemi.groundColor.setHex(p.hemiGround);
  hemi.intensity = p.hemiIntensity;
  sun.color.setHex(p.sunColor);
  sun.intensity = p.sunIntensity;
  sun.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
}

const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a6b3f, 0.9);
const sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
scene.add(hemi, sun);

const world = makeWorld(palette);
world.addTo(scene);
applyPalette(palette);

const { group: planeMesh, prop } = buildPlane();
scene.add(planeMesh);

let flight = createFlight(world.startPos, world.startYaw);
let state = 'title'; // title | playing | paused | gameover
let cameraMode = 'chase';
let score = 0;
let ringsPassed = 0;
let lives = COURSE.lives;
let timeLeft = COURSE.timeLimitSec;
let invulnerableUntil = 0;
let elapsed = 0;
let framesRendered = 0;

const camTarget = new THREE.Vector3();
const camLook = new THREE.Vector3();

function nextRing() { return world.rings.find((r) => !r.passed); }

function resetFlight() {
  flight = createFlight(world.startPos, world.startYaw);
  flight.speed = 45; // rolling takeoff: already above stall speed, no sink into the runway
  invulnerableUntil = elapsed + 3; // grace while the plane lifts off
  world.rings.forEach((r) => {
    r.passed = false;
    r.mesh.material.color.setHex(palette.ring);
    r.mesh.material.emissive.setHex(palette.ringEmissive);
    r.mesh.material.emissiveIntensity = 0.9;
  });
  score = 0; ringsPassed = 0; lives = COURSE.lives; timeLeft = COURSE.timeLimitSec;
}

function startGame() {
  resetFlight();
  state = 'playing';
  hud.hideOverlays();
  audio.clickBlip();
  audio.engineStart();
  hud.toast('Take off! Thread ring 1.');
}

function gameOver(title, sub) {
  state = 'gameover';
  audio.engineStop();
  hud.showGameOver(title, sub, score, `Rings ${ringsPassed} / ${COURSE.ringCount}  ·  Lives left ${lives}`);
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
  invulnerableUntil = elapsed + 2.5;
}

function crash() {
  lives -= 1;
  score = Math.max(0, score + SCORE.crash);
  audio.crashThud();
  if (lives <= 0) {
    hud.toast('CRASH! Out of planes.');
    gameOver('OUT OF PLANES', 'The valley wins this time — the mountains are not forgiving.');
    return;
  }
  hud.toast(`CRASH! ${SCORE.crash} — ${lives} ${lives === 1 ? 'life' : 'lives'} left.`);
  respawn();
}

function passRing(ring) {
  ring.passed = true;
  ring.mesh.material.color.setHex(0x37c978);
  ring.mesh.material.emissive.setHex(0x1a7a45);
  ringsPassed += 1;
  score += SCORE.ring;
  audio.ringChime();
  if (ringsPassed >= COURSE.ringCount) {
    score += SCORE.finish + SCORE.ringTimeBonus * Math.floor(timeLeft);
    gameOver('FLIGHT COMPLETE', 'All 8 rings threaded — the mail got through.');
  } else {
    hud.toast(`RING ${ringsPassed}! +${SCORE.ring}`);
  }
}

// --- screenshot presets ---
if (shotMode) {
  const preset = planShot(world, shotParams.shot);
  flight.pos.set(preset.pos.x, preset.pos.y, preset.pos.z);
  flight.yaw = preset.yaw; flight.pitch = preset.pitch; flight.roll = preset.roll;
  flight.speed = preset.speed; flight.throttle = preset.throttle;
  score = preset.score; ringsPassed = preset.ringsPassed; timeLeft = preset.timeLeft; lives = preset.lives;
  cameraMode = preset.camera;
  world.rings.forEach((r, i) => {
    if (i < ringsPassed) {
      r.passed = true;
      r.mesh.material.color.setHex(0x37c978);
      r.mesh.material.emissive.setHex(0x1a7a45);
    }
  });
  if (preset.mode === 'title') { state = 'title'; hud.showTitle(); }
  else if (preset.mode === 'gameover') {
    state = 'gameover';
    hud.showGameOver(preset.overTitle, preset.overSub, score, `Rings ${ringsPassed} / ${COURSE.ringCount}  ·  Time left 0:38`);
  } else {
    state = 'playing';
    hud.hideOverlays();
  }
  syncForward(flight);
  applyFlightToMesh(flight, planeMesh, prop, 0, 0);
  // Snap the chase camera behind the plane at once (no lerp-in from the origin).
  camera.position.copy(flight.pos).addScaledVector(flight.forward, -15);
  camera.position.y += 4.6;
  camera.lookAt(flight.pos.x + flight.forward.x * 14, flight.pos.y + 1, flight.pos.z + flight.forward.z * 14);
} else {
  hud.showTitle();
}
window.__dbg = { get flight() { return flight; }, planeMesh, camera, world };

initInput();
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('again-btn').addEventListener('click', startGame);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function updateCamera(dt) {
  if (cameraMode === 'cockpit') {
    camTarget.copy(flight.pos).addScaledVector(flight.forward, 2.3);
    camTarget.y += 1.9;
    camera.position.lerp(camTarget, Math.min(1, 12 * dt));
    camLook.copy(flight.pos).addScaledVector(flight.forward, 40);
    camLook.y -= 2.2;
    camera.lookAt(camLook);
    return;
  }
  camTarget.copy(flight.pos).addScaledVector(flight.forward, -15);
  camTarget.y += 4.6;
  camera.position.lerp(camTarget, Math.min(1, 4.5 * dt));
  camLook.copy(flight.pos).addScaledVector(flight.forward, 14);
  camLook.y += 1;
  camera.lookAt(camLook);
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  // Global keys.
  if (wasPressed('enter') || wasPressed(' ')) {
    if (state === 'title' || state === 'gameover') startGame();
  }
  if (wasPressed('r') && (state === 'playing' || state === 'gameover' || state === 'paused')) startGame();
  if (wasPressed('p') && (state === 'playing' || state === 'paused')) {
    state = state === 'playing' ? 'paused' : 'playing';
    hud.toast(state === 'paused' ? 'PAUSED — press P to resume.' : 'Back in the air.');
  }
  if (wasPressed('c')) {
    cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
    hud.toast(cameraMode === 'cockpit' ? 'Cockpit view' : 'Chase view');
  }
  if (wasPressed('v')) {
    paletteName = paletteName === 'day' ? 'dusk' : 'day';
    palette = PALETTES[paletteName];
    applyPalette(palette);
    world.setPalette(palette);
    hud.toast(paletteName === 'dusk' ? 'Dusk over the valley' : 'Daylight over the valley');
  }

  if (state === 'playing' && !shotMode) {
    const input = readInput();
    const events = updateFlight(flight, input, dt, world.heightAt);
    audio.engineSet(flight.throttle, flight.speed);

    if (events.outOfBounds) hud.warn('TURN BACK — leaving the valley!');
    if (events.stalled) hud.warn('STALL! Add throttle.');
    if (events.crashed && elapsed > invulnerableUntil) crash();

    // Ring pass.
    const ring = nextRing();
    if (ring && flight.pos.distanceTo(ring.pos) < COURSE.ringRadius + 2) passRing(ring);

    // Timer.
    timeLeft -= dt;
    if (timeLeft <= 0 && state === 'playing') {
      timeLeft = 0;
      gameOver('OUT OF TIME', `The mail is late — ${ringsPassed} of ${COURSE.ringCount} rings threaded.`);
    }
  } else if (state === 'playing' && shotMode) {
    // Frozen pose for screenshots; prop and clouds still animate.
  }

  // Keep the plane inside the valley in shot mode too.
  if (state !== 'title') {
    flight.pos.x = THREE.MathUtils.clamp(flight.pos.x, -1180, 1180);
    flight.pos.z = THREE.MathUtils.clamp(flight.pos.z, -1180, 1180);
  }

  applyFlightToMesh(flight, planeMesh, prop, dt, elapsed);
  updateCamera(dt);
  world.update(dt, elapsed);
  hud.updateHud(flight, world.heightAt(flight.pos.x, flight.pos.z), score, ringsPassed, COURSE.ringCount, timeLeft, lives);
  hud.setCockpit(cameraMode === 'cockpit' && state === 'playing', flight.roll, flight.pitch);
  renderer.render(scene, camera);
  framesRendered += 1;
  if (framesRendered === 3) window.__shotReady = true;
}

loop();
