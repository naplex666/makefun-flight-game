// Procedural sound, WebAudio only, no files. Every call is guarded: silence is fine, a crash is not.

let ctx = null;
let engineOsc = null, engineGain = null, engineFilter = null;

function ensure() {
  if (ctx) return ctx;
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

export function ringChime() { beep(880, 0.16); beep(1318, 0.28, 'sine', 0.12, 0.09); }
export function clickBlip() { beep(660, 0.07, 'triangle', 0.08); }
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
    engineOsc = c.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = c.createBiquadFilter();
    engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
    engineGain = c.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(c.destination);
    engineOsc.start();
  } catch { engineOsc = null; }
}

export function engineSet(throttle, speed) {
  if (!ctx || !engineOsc || !engineGain) return;
  try {
    engineOsc.frequency.setTargetAtTime(48 + speed * 0.9, ctx.currentTime, 0.1);
    engineGain.gain.setTargetAtTime(0.015 + throttle * 0.035, ctx.currentTime, 0.1);
  } catch { /* silent */ }
}

export function engineStop() {
  if (!engineOsc || !engineGain || !ctx) return;
  try {
    engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    const osc = engineOsc;
    setTimeout(() => { try { osc.stop(); } catch { /* silent */ } }, 300);
  } catch { /* silent */ }
  engineOsc = null; engineGain = null; engineFilter = null;
}
