// HUD: one clear job — mirror the flight state into the DOM overlays.

const $ = (id) => document.getElementById(id);
let toastTimer = 0;
let warnTimer = 0;

export function updateHud(f, ground, score, ringsPassed, ringTotal, timeLeft, lives, guide, fuel, mission) {
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
  // Fuel: the decision gauge — full power drinks it, green gates refill it.
  if (fuel !== undefined && $('hud-fuel')) {
    $('hud-fuel').textContent = `${Math.round(fuel)}%`;
    $('fuel-fill').style.width = `${Math.round(fuel)}%`;
    $('fuel-fill').style.background = fuel < 25
      ? 'linear-gradient(90deg, #ff5d5d, #ff7a45)'
      : 'linear-gradient(90deg, #37c978, #ffd76a)';
  }
  // Mission banner: which sortie this is and what it asks for.
  if (mission && $('hud-mission')) {
    $('hud-mission').textContent = `MISSION ${mission.index + 1} · ${mission.name}`;
  }
  // Next-gate strip: ring number, turn arrow, distance and height to the gate.
  const next = $('hud-next');
  if (guide) {
    const dy = guide.dy >= 0 ? `▲${guide.dy}m` : `▼${-guide.dy}m`;
    next.innerHTML = `NEXT RING <b>${guide.index}</b> &nbsp; ${guide.arrow} &nbsp; ${guide.dist}m &nbsp; ${dy}`;
    next.style.display = 'block';
  } else {
    next.style.display = 'none';
  }
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

export function setCockpit(on, roll, pitch, throttle, speed) {
  $('cockpit-panel').style.display = on ? 'block' : 'none';
  if (on) {
    const line = $('attitude-line');
    line.style.transform = `translateY(${(-pitch * 46).toFixed(1)}px) rotate(${(-roll * 57.3).toFixed(1)}deg)`;
    // Live instruments: rpm needle (throttle-driven) and airspeed tape.
    const rpm = $('cockpit-rpm');
    if (rpm) rpm.style.width = `${Math.round(25 + throttle * 75)}%`;
    const rpmPct = $('cockpit-rpm-pct');
    if (rpmPct) rpmPct.textContent = `${Math.round(700 + throttle * 1900)}`;
    const spd = $('cockpit-spd');
    if (spd) spd.textContent = `${Math.round(speed * 3.6)} km/h`;
  }
}
