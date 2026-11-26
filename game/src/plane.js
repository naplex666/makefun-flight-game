// The aircraft: a low-poly bush plane built from primitives, plus arcade flight physics.
import * as THREE from 'three';
import { PLANE } from './config.js';
import { clamp, lerp } from './random.js';

export function buildPlane() {
  const group = new THREE.Group();
  group.name = 'plane';
  const red = new THREE.MeshStandardMaterial({ color: 0xc22418, roughness: 0.5, metalness: 0.15 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.6, metalness: 0.05 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc93c, roughness: 0.4, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2f45, roughness: 0.2, metalness: 0.4 });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.45, 5.4, 10), red);
  fuselage.rotation.x = Math.PI / 2; // axis along z, nose toward -z
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.5, 10), gold);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.4;
  group.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 8), dark);
  canopy.scale.set(1, 0.75, 1.5);
  canopy.position.set(0, 0.62, -0.9);
  group.add(canopy);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.16, 1.8), cream);
  wing.position.set(0, 0.1, -0.4);
  group.add(wing);
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 1.1), cream);
  tailWing.position.set(0, 0.25, 2.4);
  group.add(tailWing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 1.3), red);
  fin.position.set(0, 0.85, 2.4);
  group.add(fin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.1, 5.0), gold);
  stripe.position.set(0, 0.12, 0.1);
  group.add(stripe);

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
