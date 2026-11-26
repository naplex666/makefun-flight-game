// World building: seeded terrain with a carved valley, river, trees, clouds, runway and rings.
import * as THREE from 'three';
import { COURSE, SEED } from './config.js';
import { makeNoise2D, mulberry32, clamp, lerp, smoothstep } from './random.js';

const SIZE = 2400; // terrain spans -1200..1200 in x and z

function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t, cz = az + dz * t;
  return Math.hypot(px - cx, pz - cz);
}

export function makeWorld(palette) {
  const noise = makeNoise2D(SEED);
  const pts = COURSE.points;

  function distToCourse(x, z) {
    let d = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      d = Math.min(d, distToSegment(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
    }
    return d;
  }

  function heightAt(x, z) {
    const mountains = noise(x * 0.0016, z * 0.0016) * 85 + noise(x * 0.006, z * 0.006) * 16;
    const base = 28 + mountains;
    const d = distToCourse(x, z);
    const carve = (1 - smoothstep(0, 300, d)) * 62;
    let h = base - carve;
    // Flatten the runway bowl near the start.
    const r = Math.hypot(x - pts[0][0], z - pts[0][1]);
    h = lerp(6, h, smoothstep(30, 130, r));
    return h;
  }

  function courseHeadingAt(i) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    return Math.atan2(b[0] - a[0], b[1] - a[1]); // heading where 0 = +z (south)
  }

  // --- terrain mesh with vertex colours ---
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, 150, 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cValley = new THREE.Color(palette.valley);
  const cSlope = new THREE.Color(palette.slope);
  const cRock = new THREE.Color(palette.rock);
  const cSnow = new THREE.Color(palette.snow);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const v = noise(x * 0.02, z * 0.02) * 0.12;
    if (h < 22) tmp.copy(cValley);
    else if (h < 55) tmp.copy(cValley).lerp(cSlope, (h - 22) / 33);
    else if (h < palette.snowLine) tmp.copy(cSlope).lerp(cRock, (h - 55) / (palette.snowLine - 55));
    else tmp.copy(cSnow);
    tmp.offsetHSL(0, 0, v);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  terrain.name = 'terrain';

  // --- river ribbon along the valley floor ---
  const riverPts = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    riverPts.push([x, heightAt(x, z) + 1.1, z]);
  }
  const riverGeo = new THREE.BufferGeometry();
  const rPos = [];
  for (let i = 0; i < riverPts.length - 1; i++) {
    const [x1, y1, z1] = riverPts[i];
    const [x2, y2, z2] = riverPts[i + 1];
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * 7, nz = (dx / len) * 7;
    rPos.push(x1 - nx, y1, z1 - nz, x1 + nx, y1, z1 + nz, x2 - nx, y2, z2 - nz);
    rPos.push(x1 + nx, y1, z1 + nz, x2 + nx, y2, z2 + nz, x2 - nx, y2, z2 - nz);
  }
  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
  riverGeo.computeVertexNormals();
  const river = new THREE.Mesh(riverGeo, new THREE.MeshStandardMaterial({
    color: palette.river, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.9,
  }));
  river.name = 'river';

  // --- trees (instanced cones + trunks) ---
  const rand = mulberry32(SEED + 7);
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < 650 && guard++ < 20000) {
    const x = (rand() - 0.5) * 2250, z = (rand() - 0.5) * 2250;
    if (distToCourse(x, z) < 42) continue;
    const h = heightAt(x, z);
    if (h < 9 || h > 92) continue;
    treeSpots.push([x, h, z, 0.8 + rand() * 0.9]);
  }
  const coneGeo = new THREE.ConeGeometry(3.2, 11, 6);
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 3.4, 5);
  const coneMat = new THREE.MeshStandardMaterial({ color: palette.tree, roughness: 1 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: palette.trunk, roughness: 1 });
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, treeSpots.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  treeSpots.forEach(([x, h, z, sc], i) => {
    p.set(x, h + 7 * sc, z); s.set(sc, sc, sc); q.identity();
    m4.compose(p, q, s); cones.setMatrixAt(i, m4);
    p.set(x, h + 1.6 * sc, z);
    m4.compose(p, q, s); trunks.setMatrixAt(i, m4);
  });
  cones.name = 'trees'; trunks.name = 'treeTrunks';

  // --- clouds ---
  const clouds = new THREE.Group();
  clouds.name = 'clouds';
  const cloudMat = new THREE.MeshStandardMaterial({ color: palette.cloud, roughness: 1, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < n; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(9 + rand() * 9, 8, 6), cloudMat);
      s.position.set((rand() - 0.5) * 30, (rand() - 0.5) * 4, (rand() - 0.5) * 16);
      s.scale.y = 0.45;
      g.add(s);
    }
    g.position.set((rand() - 0.5) * 2200, 150 + rand() * 80, (rand() - 0.5) * 2200);
    clouds.add(g);
  }

  // --- runway at the start of the course ---
  const start = pts[0];
  const startHeading = courseHeadingAt(0); // atan2(dx, dz); runway lies along it
  const runway = new THREE.Group();
  runway.name = 'runway';
  const strip = new THREE.Mesh(new THREE.BoxGeometry(9, 0.6, 74), new THREE.MeshStandardMaterial({ color: palette.runway, roughness: 0.9 }));
  strip.position.y = 0.3;
  runway.add(strip);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xf8f8f0, roughness: 0.8 });
  for (let d = -30; d <= 30; d += 10) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 4.5), dashMat);
    dash.position.set(0, 0.68, d);
    runway.add(dash);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), new THREE.MeshStandardMaterial({ color: 0xd8d8d8 }));
  pole.position.set(8, 3.5, -20);
  runway.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.2, 8), new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.7 }));
  sock.rotation.z = Math.PI / 2.4; sock.position.set(9.5, 6.6, -20);
  runway.add(sock);
  runway.position.set(start[0], heightAt(start[0], start[1]) + 0.4, start[1]);
  runway.rotation.y = startHeading;

  // --- rings along the course ---
  const rings = [];
  const ringGroup = new THREE.Group();
  ringGroup.name = 'rings';
  const ringIdx = [1, 2, 4, 5, 7, 8, 10, 12]; // spread over the 14 waypoints
  ringIdx.forEach((wi, k) => {
    const [x, z] = pts[wi];
    const y = heightAt(x, z) + COURSE.ringHeight;
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(COURSE.ringRadius, 0.9, 10, 40),
      new THREE.MeshStandardMaterial({ color: palette.ring, emissive: palette.ringEmissive, emissiveIntensity: 0.9, roughness: 0.4 }),
    );
    torus.position.set(x, y, z);
    torus.rotation.y = courseHeadingAt(wi);
    torus.name = `ring${k + 1}`;
    ringGroup.add(torus);
    // number sprite above the ring
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffd76a'; ctx.font = 'bold 84px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 10; ctx.strokeText(String(k + 1), 64, 68); ctx.fillText(String(k + 1), 64, 68);
    const tex = new THREE.CanvasTexture(cv);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(14, 14, 1);
    spr.position.set(x, y + COURSE.ringRadius + 9, z);
    ringGroup.add(spr);
    rings.push({ index: k, pos: new THREE.Vector3(x, y, z), mesh: torus, passed: false });
  });

  return {
    heightAt, rings, distToCourse,
    startPos: new THREE.Vector3(start[0], heightAt(start[0], start[1]) + 5.5, start[1]),
    startYaw: Math.PI - startHeading, // yaw where 0 = north (-z); course heads +z (south)
    addTo(scene) {
      scene.add(terrain, river, cones, trunks, clouds, runway, ringGroup);
    },
    update(dt, t) {
      clouds.children.forEach((c, i) => {
        c.position.x += dt * (2 + (i % 3));
        if (c.position.x > 1200) c.position.x = -1200;
      });
      const pulse = 0.75 + Math.sin(t * 3) * 0.35;
      rings.forEach((r) => {
        if (!r.passed) r.mesh.material.emissiveIntensity = pulse;
      });
    },
    setPalette(next) {
      // Swap terrain colours cheaply by rebuilding only material colours used by dynamic parts.
      river.material.color.setHex(next.river);
      coneMat.color.setHex(next.tree);
      trunkMat.color.setHex(next.trunk);
      cloudMat.color.setHex(next.cloud);
      rings.forEach((r) => {
        r.mesh.material.color.setHex(next.ring);
        r.mesh.material.emissive.setHex(next.ringEmissive);
      });
    },
  };
}
