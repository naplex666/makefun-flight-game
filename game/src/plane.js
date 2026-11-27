// The aircraft: a low-poly bush plane built from primitives — cowling, struts,
// fixed gear, navigation lights and a striped fin — plus arcade flight physics.
import * as THREE from 'three';
import { PLANE } from './config.js';
import { clamp, lerp } from './random.js';

export function buildBushPlane() {
  const group = new THREE.Group();
  group.name = 'plane';
  const red = new THREE.MeshStandardMaterial({ color: 0xc22418, roughness: 0.5, metalness: 0.15 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.6, metalness: 0.05 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc93c, roughness: 0.4, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2f45, roughness: 0.2, metalness: 0.4 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.4, metalness: 0.6 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

  // Fuselage with a cream engine cowling up front and a tapered tail.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.45, 5.4, 10), red);
  fuselage.rotation.x = Math.PI / 2; // axis along z, nose toward -z
  group.add(fuselage);
  const cowling = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.88, 1.1, 10), cream);
  cowling.rotation.x = Math.PI / 2;
  cowling.position.z = -2.9;
  group.add(cowling);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.5, 10), gold);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.4;
  group.add(nose);
  // Gold cheatline along the fuselage sides.
  [-0.86, 0.86].forEach((x) => {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 4.6), gold);
    stripe.position.set(x, 0.12, 0.1);
    group.add(stripe);
  });
  // Canopy with a gold windshield frame.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 8), dark);
  canopy.scale.set(1, 0.75, 1.5);
  canopy.position.set(0, 0.62, -0.9);
  group.add(canopy);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 6, 16), gold);
  frame.position.set(0, 0.62, -1.75);
  frame.rotation.x = 0.5;
  group.add(frame);
  // High wing with red tips, held by struts.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.16, 1.8), cream);
  wing.position.set(0, 0.1, -0.4);
  group.add(wing);
  [-4.55, 4.55].forEach((x) => {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 1.8), red);
    tip.position.set(x, 0.1, -0.4);
    group.add(tip);
  });
  [-1, 1].forEach((side) => {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.1, 6), steel);
    strut.position.set(side * 1.9, -0.75, -0.4);
    strut.rotation.z = side * 0.5;
    group.add(strut);
  });
  // Tail: stabiliser, fin with a gold stripe, tail cone.
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 1.1), cream);
  tailWing.position.set(0, 0.25, 2.4);
  group.add(tailWing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 1.3), red);
  fin.position.set(0, 0.85, 2.4);
  group.add(fin);
  const finStripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 1.32), gold);
  finStripe.position.set(0, 1.15, 2.4);
  group.add(finStripe);
  // Fixed landing gear: two legs and wheels under the belly.
  [-0.9, 0.9].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 6), steel);
    leg.position.set(x, -1.15, -0.6);
    leg.rotation.z = -x * 0.28;
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), tyre);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x * 1.25, -1.85, -0.6);
    group.add(wheel);
  });
  // Navigation lights: red port, green starboard, white tail — lit.
  const navRed = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 2.5 }));
  navRed.position.set(-4.8, 0.1, -0.4);
  group.add(navRed);
  const navGreen = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x20ff60, emissive: 0x10c040, emissiveIntensity: 2.5 }));
  navGreen.position.set(4.8, 0.1, -0.4);
  group.add(navGreen);
  const navWhite = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 }));
  navWhite.position.set(0, 0.3, 3.05);
  group.add(navWhite);

  const prop = new THREE.Group();
  prop.position.z = -4.25;
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, transparent: true, opacity: 0.38 });
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.12), bladeMat);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.28, 0.12), bladeMat);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), gold);
  prop.add(b1, b2, hub);
  group.add(prop);
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { group, prop };
}

export function syncForward(f) {
  f.forward.set(
    Math.sin(f.yaw) * Math.cos(f.pitch),
    Math.sin(f.pitch),
    -Math.cos(f.yaw) * Math.cos(f.pitch),
  );
}

export function createFlight(startPos, startYaw) {
  return {
    pos: startPos.clone(),
    yaw: startYaw, // 0 = north (-z); PI = south (+z)
    pitch: 0, roll: 0,
    speed: 0, throttle: PLANE.cruiseThrottle,
    forward: new THREE.Vector3(0, 0, 1),
  };
}

// Returns events: { stalled, crashed, outOfBounds }
export function updateFlight(f, input, dt, heightAt) {
  const events = { stalled: false, crashed: false, outOfBounds: false };

  if (input.throttleUp) f.throttle = clamp(f.throttle + 0.55 * dt, 0, 1);
  if (input.throttleDown) f.throttle = clamp(f.throttle - 0.55 * dt, 0, 1);

  const targetSpeed = f.throttle * PLANE.maxSpeed;
  f.speed += (targetSpeed - f.speed) * Math.min(1, 0.9 * dt);

  // Pitch: +1 climbs. Roll: +1 banks right, which turns right.
  if (input.pitch !== 0) f.pitch = clamp(f.pitch + PLANE.pitchRate * input.pitch * dt, -0.6, 0.6);
  else f.pitch = lerp(f.pitch, 0, Math.min(1, 0.5 * dt));
  const rollTarget = input.roll * 0.9;
  f.roll = lerp(f.roll, rollTarget, Math.min(1, 3.2 * dt));
  f.yaw += Math.sin(f.roll) * PLANE.turnRate * dt;

  // Climbing bleeds speed, diving gains it.
  f.speed = clamp(f.speed - f.pitch * 9 * dt, 0, PLANE.maxSpeed);

  f.forward.set(
    Math.sin(f.yaw) * Math.cos(f.pitch),
    Math.sin(f.pitch),
    -Math.cos(f.yaw) * Math.cos(f.pitch),
  );

  f.pos.addScaledVector(f.forward, f.speed * dt);

  if (f.speed < PLANE.minSpeed) {
    const sink = PLANE.sinkRate * (1 - f.speed / PLANE.minSpeed);
    f.pos.y -= sink * dt;
    events.stalled = true;
  }

  const ground = heightAt(f.pos.x, f.pos.z);
  if (f.pos.y < ground + 2.2) events.crashed = true;
  if (Math.abs(f.pos.x) > 1180 || Math.abs(f.pos.z) > 1180) events.outOfBounds = true;
  return events;
}

export function applyFlightToMesh(f, mesh, prop, dt, t) {
  mesh.position.copy(f.pos);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = -f.yaw;
  mesh.rotation.x = f.pitch;
  mesh.rotation.z = f.roll;
  prop.rotation.z += dt * (4 + f.speed * 0.55);
}
