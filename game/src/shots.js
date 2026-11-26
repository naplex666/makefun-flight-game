// Deterministic screenshot presets: ?shot=start|play|cockpit|end (&seed=, &palette=).
// Each preset freezes the plane in a readable pose so a screenshot is stable.
import { COURSE } from './config.js';

export function getShotParams(params) {
  return {
    shot: params.get('shot') || null,
    palette: params.get('palette') || null,
    seed: Number(params.get('seed') || 1),
  };
}

function yawFromDir(dx, dz) {
  // forward = (sin yaw, -cos yaw) in (x, z); solve for yaw.
  return Math.atan2(dx, -dz);
}

export function planShot(world, shot) {
  const rings = world.rings;
  if (shot === 'play') {
    // Mid-course: approaching ring 3, rings 1-2 already threaded.
    const target = rings[2];
    const prev = rings[1];
    const dx = target.pos.x - prev.pos.x, dz = target.pos.z - prev.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    return {
      mode: 'playing', camera: 'chase', frozen: true,
      pos: { x: target.pos.x - (dx / len) * 130, y: target.pos.y + 4, z: target.pos.z - (dz / len) * 130 },
      yaw: yawFromDir(dx / len, dz / len), pitch: 0.04, roll: -0.18,
      speed: 58, throttle: 0.72, ringsPassed: 2, score: 200, timeLeft: 142, lives: 3,
    };
  }
  if (shot === 'cockpit') {
    // Cockpit view: chasing ring 5 down the valley at dusk.
    const target = rings[4];
    const prev = rings[3];
    const dx = target.pos.x - prev.pos.x, dz = target.pos.z - prev.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    return {
      mode: 'playing', camera: 'cockpit', frozen: true,
      pos: { x: target.pos.x - (dx / len) * 90, y: target.pos.y + 2, z: target.pos.z - (dz / len) * 90 },
      yaw: yawFromDir(dx / len, dz / len), pitch: 0.02, roll: 0.12,
      speed: 64, throttle: 0.78, ringsPassed: 4, score: 400, timeLeft: 105, lives: 3,
    };
  }
  if (shot === 'end') {
    return {
      mode: 'gameover', camera: 'chase', frozen: true,
      pos: { x: world.startPos.x, y: world.startPos.y + 2, z: world.startPos.z },
      yaw: world.startYaw, pitch: 0, roll: 0,
      speed: 0, throttle: 0, ringsPassed: 8, score: 1240, timeLeft: 38, lives: 3,
      overTitle: 'FLIGHT COMPLETE', overSub: 'All 8 rings threaded — the mail got through.',
    };
  }
  // start (default): on the runway, title screen up.
  return {
    mode: 'title', camera: 'chase', frozen: true,
    pos: { x: world.startPos.x, y: world.startPos.y, z: world.startPos.z },
    yaw: world.startYaw, pitch: 0, roll: 0,
    speed: 0, throttle: 0.6, ringsPassed: 0, score: 0, timeLeft: COURSE.timeLimitSec, lives: COURSE.lives,
  };
}
