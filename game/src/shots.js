// Deterministic screenshot presets: ?shot=start|play|cockpit|end (&seed=, &palette=).
// Each preset freezes the plane in a readable pose so a screenshot is stable.
// The cover (play) is the poster: golden hour, ring 3 dead ahead and glowing,
// the sun low in the frame, the canyon walls framing the shot.
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
    // Hero frame: approaching ring 3, rings 1-2 already threaded, 70 m out so
    // the glowing hoop fills the frame ahead, canyon walls on both sides.
    const target = rings[2];
    const prev = rings[1];
    const dx = target.pos.x - prev.pos.x, dz = target.pos.z - prev.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    return {
      mode: 'playing', camera: 'chase', frozen: true, mission: 0, fuel: 78,
      pos: { x: target.pos.x - (dx / len) * 70, y: target.pos.y + 2, z: target.pos.z - (dz / len) * 70 },
      yaw: yawFromDir(dx / len, dz / len), pitch: 0.04, roll: -0.18,
      speed: 58, throttle: 0.72, ringsPassed: 2, score: 200, timeLeft: 142, lives: 3,
    };
  }
  if (shot === 'cockpit') {
    // Cockpit view, second mission: CANYON DASH, chasing ring 3 of 5 at golden hour.
    const target = rings[2];
    const prev = rings[1];
    const dx = target.pos.x - prev.pos.x, dz = target.pos.z - prev.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    return {
      mode: 'playing', camera: 'cockpit', frozen: true, mission: 1, fuel: 52,
      pos: { x: target.pos.x - (dx / len) * 60, y: target.pos.y + 2, z: target.pos.z - (dz / len) * 60 },
      yaw: yawFromDir(dx / len, dz / len), pitch: 0.02, roll: 0.12,
      speed: 71, throttle: 0.9, ringsPassed: 2, score: 200, timeLeft: 58, lives: 3,
    };
  }
  if (shot === 'end') {
    return {
      mode: 'gameover', camera: 'chase', frozen: true, mission: 0, fuel: 22,
      pos: { x: world.startPos.x, y: world.startPos.y + 2, z: world.startPos.z },
      yaw: world.startYaw, pitch: 0, roll: 0,
      speed: 0, throttle: 0, ringsPassed: 8, score: 1240, timeLeft: 38, lives: 3,
      overTitle: 'FLIGHT COMPLETE', overSub: 'All 8 rings threaded — the mail got through.',
    };
  }
  // start (default): on the runway at golden hour, mission select up.
  return {
    mode: 'title', camera: 'chase', frozen: true, mission: 0, fuel: 100,
    pos: { x: world.startPos.x, y: world.startPos.y, z: world.startPos.z },
    yaw: world.startYaw, pitch: 0, roll: 0,
    speed: 0, throttle: 0.6, ringsPassed: 0, score: 0, timeLeft: COURSE.timeLimitSec, lives: COURSE.lives,
  };
}
