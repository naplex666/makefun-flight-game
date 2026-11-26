// Procedural sound, WebAudio only, no files. Every call is guarded: silence is fine, a crash is not.
//
// Engine voice, modelled from the engine's physical state (our own design):
// the crank rpm follows the throttle with spool lag; a four-stroke four-
// cylinder engine fires at rpm * cylinders / 120, and the two-blade propeller
// passes at rpm * blades / 60 — both set the tone, so the engine note climbs
// with power instead of sitting on one loop. Wind rush grows with airspeed
// squared through a filtered noise bed. At idle the note is lumpy (a slow
// wobble on the gain); at power it smooths out and brightens.

let ctx = null;
let engineOsc = null, engineOsc2 = null, engineGain = null, engineFilter = null;
let windSrc = null, windGain = null, windFilter = null;

const CYLINDERS = 4; // four-stroke: one firing per cylinder per two revolutions
const BLADES = 2;
const RPM_IDLE = 700;
const RPM_MAX = 2600;

function ensure() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  } catch { return null; }
}

function beep(freq, dur, type = 'sine', vol = 0.12, when = 0) {
  const c = ensure();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + when + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + when);
    o.stop(c.currentTime + when + dur + 0.02);
  } catch { /* silent */ }
}

export function ringChime() { beep(880, 0.16, 'sine', 0.16); beep(1318, 0.3, 'sine', 0.16, 0.09); beep(1760, 0.22, 'sine', 0.08, 0.18); }
export function clickBlip() { beep(660, 0.07, 'triangle', 0.08); }
export function missBuzz() { beep(150, 0.28, 'square', 0.1); beep(110, 0.3, 'square', 0.09, 0.12); }
export function crashThud() {
  const c = ensure();
  if (!c) return;
  try {
    const len = c.sampleRate * 0.35;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = 0.25;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
    beep(110, 0.4, 'sine', 0.18);
  } catch { /* silent */ }
}

export function engineStart() {
  const c = ensure();
  if (!c || engineOsc) return;
  try {
    // Crank tone: sawtooth at the firing frequency, with a square sub-octave
    // an octave below for body. Both glide with rpm (see engineSet).
    engineOsc = c.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = (RPM_IDLE * CYLINDERS) / 120;
    engineOsc2 = c.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = (RPM_IDLE * CYLINDERS) / 240;
    engineFilter = c.createBiquadFilter();
    engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
    engineGain = c.createGain();
    engineGain.gain.value = 0.0;
    const g2 = c.createGain();
    g2.gain.value = 0.5;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(g2).connect(engineFilter);
    engineFilter.connect(engineGain).connect(c.destination);
    engineOsc.start();
    engineOsc2.start();
    // Wind bed: looped noise through a lowpass, gain driven by airspeed.
    const noiseLen = c.sampleRate * 2;
    const noiseBuf = c.createBuffer(1, noiseLen, c.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < noiseLen; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brown-ish, softer than white
      nd[i] = last * 3.2;
    }
    windSrc = c.createBufferSource();
    windSrc.buffer = noiseBuf; windSrc.loop = true;
    windFilter = c.createBiquadFilter();
    windFilter.type = 'lowpass'; windFilter.frequency.value = 600;
    windGain = c.createGain();
    windGain.gain.value = 0.0;
    windSrc.connect(windFilter).connect(windGain).connect(c.destination);
    windSrc.start();
    engineGain.gain.setTargetAtTime(0.05, c.currentTime, 0.4);
  } catch { engineOsc = null; engineOsc2 = null; }
}

export function engineSet(throttle, speed) {
  if (!ctx || !engineOsc || !engineGain) return;
  try {
    const t = ctx.currentTime;
    // rpm follows throttle with spool lag (setTargetAtTime glides it).
    const rpm = RPM_IDLE + throttle * (RPM_MAX - RPM_IDLE);
    const firing = (rpm * CYLINDERS) / 120; // Hz: 4-stroke firing pulses
    const bladePass = (rpm * BLADES) / 60; // Hz: propeller blade passes
    engineOsc.frequency.setTargetAtTime(firing, t, 0.12);
    engineOsc2.frequency.setTargetAtTime(bladePass / 2, t, 0.12);
    engineFilter.frequency.setTargetAtTime(320 + throttle * 1100, t, 0.1);
    // Louder than v1 and load-sensitive: idle putters, full power roars.
    // A slow wobble at low rpm gives the lumpy idle; it fades with power.
    const idleWobble = 1 - Math.min(1, throttle * 1.6);
    const wobble = 1 + idleWobble * 0.25 * Math.sin(t * 11);
    engineGain.gain.setTargetAtTime((0.05 + throttle * 0.09) * wobble, t, 0.1);
    if (windGain && windFilter) {
      const air = Math.min(1, speed / 92);
      windGain.gain.setTargetAtTime(air * air * 0.11, t, 0.15);
      windFilter.frequency.setTargetAtTime(500 + speed * 9, t, 0.15);
    }
  } catch { /* silent */ }
}

export function engineStop() {
  if (!ctx) return;
  try {
    if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    if (windGain) windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    const o1 = engineOsc, o2 = engineOsc2, w = windSrc;
    setTimeout(() => {
      try { if (o1) o1.stop(); } catch { /* silent */ }
      try { if (o2) o2.stop(); } catch { /* silent */ }
      try { if (w) w.stop(); } catch { /* silent */ }
    }, 400);
  } catch { /* silent */ }
  engineOsc = null; engineOsc2 = null; engineGain = null; engineFilter = null;
  windSrc = null; windGain = null; windFilter = null;
}

