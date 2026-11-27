// Game configuration: a golden-hour canyon, three missions, fuel.
// The pairwise winner is chosen by comparing screenshots; the cover frame is
// the poster, so the default look is golden hour, not bright noon.

export const SEED = 1;

export const COURSE = {
  // Canyon waypoints (x, z) the course snakes through, start to finish.
  points: [
    [0, -1050], [60, -900], [-40, -750], [90, -600], [-70, -450],
    [40, -300], [-90, -150], [70, 0], [-50, 150], [80, 300],
    [-60, 450], [30, 600], [-80, 750], [0, 900],
  ],
  ringHeight: 34, // rings float this far above the canyon floor
  ringRadius: 11,
  ringCount: 8,
  timeLimitSec: 180,
  lives: 3,
};

export const PALETTES = {
  golden: {
    name: 'golden',
    // Sky dome gradient: low sun on the horizon, deep indigo overhead.
    skyZenith: 0x2e3a6e, skyMid: 0x9a5f74, skyHorizon: 0xffb347,
    sunDisc: 0xffa030, sunGlow: 0xff9a3c,
    fog: 0xe8a35c, fogNear: 320, fogFar: 1500,
    sunColor: 0xffb347, sunIntensity: 3.0, hemiSky: 0x8a6a9a, hemiGround: 0x7a5638, hemiIntensity: 1.05,
    sunPos: [-500, 280, 450],
    // Canyon strata: rust, ochre and umber bands over a sandy floor.
    floor: 0xc9a06a, strataA: 0x9a5a38, strataB: 0xc98a4a, strataC: 0x7a4a2e, rim: 0xd8b890,
    river: 0xd88a3a, tree: 0x46582c, trunk: 0x4a3220, cloud: 0xffd9b0,
    ring: 0xffb020, ringEmissive: 0xff8a00, fuelRing: 0x37c978, fuelRingEmissive: 0x1a7a45,
    runway: 0x3a3230,
  },
  dusk: {
    name: 'dusk',
    skyZenith: 0x1a2340, skyMid: 0x5e3a5e, skyHorizon: 0xff7a4d,
    sunDisc: 0xffc890, sunGlow: 0xff6a2a,
    fog: 0x5a4a6a, fogNear: 300, fogFar: 1600,
    sunColor: 0xff9a4d, sunIntensity: 2.6, hemiSky: 0x9a7ab8, hemiGround: 0x4a3f34, hemiIntensity: 1.0,
    sunPos: [-420, 180, -300],
    floor: 0x8a6a48, strataA: 0x6e4a34, strataB: 0x8a5a3a, strataC: 0x5e3a26, rim: 0xa8886a,
    river: 0x2a4a72, tree: 0x22482a, trunk: 0x4a3220, cloud: 0xffc8a0,
    ring: 0xffb020, ringEmissive: 0xff7a00, fuelRing: 0x37c978, fuelRingEmissive: 0x1a7a45,
    runway: 0x2e3238,
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
  fuelGate: 30, // fuel (percent) a green gate gives back
};
