// Missions: three ways to fly the canyon, each with its own goal, clock and
// fuel. A sortie is a decision, not a sightseeing lap: throttle burns fuel,
// and the green gates are the only refill on the course.

import { COURSE } from './config.js';

// Green fuel gates sit on these course waypoints, between the amber rings.
export const FUEL_RING_WAYPOINTS = [3, 6, 9, 11];

export const MISSIONS = [
  {
    id: 'courier', index: 0, name: 'COURIER RUN',
    tagline: 'Thread all 8 rings — the mail gets through.',
    ringCount: 8, timeLimitSec: COURSE.timeLimitSec,
    fuelStart: 100, fuelBurnPerSec: 0.35,
  },
  {
    id: 'dash', index: 1, name: 'CANYON DASH',
    tagline: 'Five gates, one hundred seconds — fly it flat out.',
    ringCount: 5, timeLimitSec: 100,
    fuelStart: 70, fuelBurnPerSec: 0.8,
  },
  {
    id: 'fuel', index: 2, name: 'FUEL RUN',
    tagline: 'Eight rings on a dry tank — drink from the green gates or glide home.',
    ringCount: 8, timeLimitSec: 240,
    fuelStart: 55, fuelBurnPerSec: 0.35,
  },
];

// Fuel burns with throttle: full power costs almost twice cruise.
// Returns the fuel left (0..100).
export function burnFuel(fuel, throttle, dt, burnPerSec) {
  const rate = burnPerSec * (0.35 + 0.65 * throttle);
  return Math.max(0, fuel - rate * dt);
}

// A green gate refills the tank; it never overfills.
export function refuelAtGate(fuel, bonus) {
  return Math.min(100, fuel + bonus);
}
