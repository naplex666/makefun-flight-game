// HUD: one clear job — mirror the flight state into the DOM overlays.

const $ = (id) => document.getElementById(id);
let toastTimer = 0;
let warnTimer = 0;

export function updateHud(f, ground, score, ringsPassed, ringTotal, timeLeft, lives) {
  const alt = Math.max(0, Math.round(f.pos.y - ground));
  const spd = Math.round(f.speed * 3.6);
  const vs = (f.forward.y * f.speed).toFixed(1);
  const hdg = Math.round(((f.yaw * 180 / Math.PI) % 360 + 360) % 360);
  const letters = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const letter = letters[Math.round(hdg / 45) % 8];
  $('hud-alt').textContent = String(alt);
  $('hud-spd').textContent = String(spd);
  $('hud-vs').textContent = vs;
  $('hud-hdg').innerHTML = String(hdg).padStart(3, '0') + '&deg;';
  $('hud-compass').innerHTML = String(hdg).padStart(3, '0') + '&deg; ' + letter;
  $('hud-score').textContent = String(score);
  $('hud-rings').textContent = `${ringsPassed} / ${ringTotal}`;
  const t = Math.max(0, Math.ceil(timeLeft));
  $('hud-time').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  $('hud-lives').textContent = String(lives);
  $('hud-thr').textContent = `${Math.round(f.throttle * 100)}%`;
  $('throttle-fill').style.width = `${Math.round(f.throttle * 100)}%`;
}

export function toast(msg, ms = 1700) {
  const el = $('toast');
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; }, ms);
}

export function warn(msg) {
  const el = $('warn');
  if (msg) {
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(warnTimer);
    warnTimer = setTimeout(() => { el.style.opacity = '0'; }, 1800);
  } else {
    el.style.opacity = '0';
  }
}

export function showTitle() {
  $('title').style.display = 'flex';
  $('gameover').style.display = 'none';
}

export function hideOverlays() {
  $('title').style.display = 'none';
  $('gameover').style.display = 'none';
}

export function showGameOver(title, sub, score, detail) {
  $('over-title').textContent = title;
  $('over-sub').textContent = sub;
  $('over-score').textContent = String(score);
  $('over-detail').textContent = detail;
  $('title').style.display = 'none';
  $('gameover').style.display = 'flex';
}

export function setCockpit(on, roll, pitch) {
  $('cockpit-panel').style.display = on ? 'block' : 'none';
  if (on) {
    const line = $('attitude-line');
    line.style.transform = `translateY(${(-pitch * 46).toFixed(1)}px) rotate(${(-roll * 57.3).toFixed(1)}deg)`;
  }
}
