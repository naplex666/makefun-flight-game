// Game configuration: two candidate palettes (day alpine vs dusk ridge) and the course.
// The pairwise winner is chosen by comparing their screenshots; the loser stays in-game
// on the V key so both candidates' work ships.

export const SEED = 1;

export const COURSE = {
  // Valley waypoints (x, z) the course snakes through, start to finish.
  points: [
    [0, -1050], [60, -900], [-40, -750], [90, -600], [-70, -450],
    [40, -300], [-90, -150], [70, 0], [-50, 150], [80, 300],
    [-60, 450], [30, 600], [-80, 750], [0, 900],
  ],
  ringHeight: 34, // rings float this far above the valley floor
  ringRadius: 11,
  ringCount: 8,
  timeLimitSec: 180,
  lives: 3,
};

export const PALETTES = {
  day: {
    name: 'day',
    sky: 0x87bfe8, fog: 0x9fc8e8, fogNear: 350, fogFar: 1600,
    sunColor: 0xfff2d8, sunIntensity: 2.4, hemiSky: 0xbfe3ff, hemiGround: 0x4a6b3f, hemiIntensity: 0.9,
    sunPos: [300, 500, 200],
    valley: 0x4f8f4a, slope: 0x7a7a5e, rock: 0x8d8578, snow: 0xf4f8ff, snowLine: 105,
    river: 0x2f7fc2, tree: 0x2e6b34, trunk: 0x6b4a2f, cloud: 0xffffff,
    ring: 0xff8c1a, ringEmissive: 0xff6a00, runway: 0x3a3f45,
  },
  dusk: {
    name: 'dusk',
    sky: 0x2e3a5e, fog: 0x5a4a6a, fogNear: 300, fogFar: 1600,
    sunColor: 0xff9a4d, sunIntensity: 2.6, hemiSky: 0x9a7ab8, hemiGround: 0x4a3f34, hemiIntensity: 1.0,
    sunPos: [-420, 180, -300],
    valley: 0x3d5a3a, slope: 0x5e5245, rock: 0x6e6258, snow: 0xd8c8d8, snowLine: 100,
    river: 0x2a4a72, tree: 0x22482a, trunk: 0x4a3220, cloud: 0xffc8a0,
    ring: 0xffb020, ringEmissive: 0xff7a00, runway: 0x2e3238,
  },
};

export const PLANE = {
  maxSpeed: 92, // m/s at full throttle
  minSpeed: 26, // below this the plane sinks fast (stall)
  cruiseThrottle: 0.6,
  turnRate: 0.55, // rad/s at full bank
  pitchRate: 0.5,
  climbBleed: 0.35, // climbing costs speed
  sinkRate: 14, // m/s sink at stall
};

export const SCORE = {
  ring: 100,
  ringTimeBonus: 2, // per second left when a ring is threaded
  finish: 500,
  crash: -150,
};
