// World building: a golden-hour canyon — steep strata walls framing a sandy
// floor with a river, a dirt road, scrub, villages, drifting clouds, a runway
// and glowing ring gates. The course is the canyon floor; the walls are the frame.
import * as THREE from 'three';
import { COURSE, SEED, SCORE } from './config.js';
import { FUEL_RING_WAYPOINTS } from './missions.js';
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

// Soft radial glow texture, shared by the sun, the rings and the fuel gates.
function makeGlowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

export function buildCanyonWorld(palette) {
  const noise = makeNoise2D(SEED);
  const pts = COURSE.points;
  const glowTex = makeGlowTexture();

  function distToCourse(x, z) {
    let d = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      d = Math.min(d, distToSegment(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
    }
    return d;
  }

  function heightAt(x, z) {
    // Gentle canyon floor, then walls that climb steeply past 130 m from the
    // course and crest into a rim — the walls tower over the flight path.
    const floor = 26 + noise(x * 0.0016, z * 0.0016) * 26 + noise(x * 0.006, z * 0.006) * 8;
    const d = distToCourse(x, z);
    const wall = smoothstep(130, 430, d) * (150 + noise(x * 0.002 + 7, z * 0.002 + 7) * 70);
    let h = floor + wall;
    // Flatten the runway bowl near the start.
    const r = Math.hypot(x - pts[0][0], z - pts[0][1]);
    h = lerp(6, h, smoothstep(30, 130, r));
    return h;
  }

  function courseHeadingAt(i) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    return Math.atan2(b[0] - a[0], b[1] - a[1]); // heading where 0 = +z (south)
  }

  // --- sky dome: amber horizon rising to deep indigo, so the sky is a gradient ---
  const skyGeo = new THREE.SphereGeometry(1800, 24, 12);
  const skyPos = skyGeo.attributes.position;
  const skyColors = new Float32Array(skyPos.count * 3);
  const cZenith = new THREE.Color(palette.skyZenith);
  const cMid = new THREE.Color(palette.skyMid);
  const cHorizon = new THREE.Color(palette.skyHorizon);
  const tmp = new THREE.Color();
  function paintSky(p) {
    for (let i = 0; i < skyPos.count; i++) {
      const y = skyPos.getY(i) / 1800; // -1..1
      if (y >= 0.25) tmp.copy(cMid).lerp(cZenith, (y - 0.25) / 0.75);
      else if (y >= 0) tmp.copy(cHorizon).lerp(cMid, y / 0.25);
      else tmp.copy(cHorizon);
      skyColors[i * 3] = tmp.r; skyColors[i * 3 + 1] = tmp.g; skyColors[i * 3 + 2] = tmp.b;
    }
    skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
  }
  paintSky(palette);
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false,
  }));
  sky.name = 'skyDome';

  // --- low sun: a bright disc with a wide glow, parked ahead-left of the course ---
  const sunGroup = new THREE.Group();
  sunGroup.name = 'lowSun';
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(70, 32),
    new THREE.MeshBasicMaterial({ color: palette.sunDisc, fog: false }),
  );
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: palette.sunGlow, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  sunGlow.scale.set(620, 620, 1);
  sunGroup.add(sunDisc, sunGlow);
  // South-west, high over the rim, so the disc clears the canyon wall and
  // sits in the hero frame instead of hiding behind the ridge.
  sunGroup.position.set(-1000, 560, 900);
  sunGroup.lookAt(0, 60, 0);

  // --- terrain mesh with vertex colours: strata bands on the walls ---
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, 150, 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cFloor = new THREE.Color(palette.floor);
  const cStrataA = new THREE.Color(palette.strataA);
  const cStrataB = new THREE.Color(palette.strataB);
  const cStrataC = new THREE.Color(palette.strataC);
  const cRim = new THREE.Color(palette.rim);
  const cScrubA = new THREE.Color(0x8a7a3a); // dry grass on the floor
  const cScrubB = new THREE.Color(0x6a6a30);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const v = noise(x * 0.02, z * 0.02) * 0.1;
    if (h < 34) {
      tmp.copy(cFloor);
      // Dry scrub patches quilt the canyon floor so it is never one flat sand.
      const patch = noise(x * 0.008 + 40, z * 0.008 + 40);
      if (patch > 0.25) tmp.lerp(cScrubA, 0.5);
      else if (patch < -0.3) tmp.lerp(cScrubB, 0.45);
    } else if (h < 150) {
      // Horizontal strata: the band a point falls in is set by its height
      // wobbled by noise, so the walls read as layered rock.
      const band = Math.floor((h + noise(x * 0.01, z * 0.01) * 9) / 13) % 3;
      tmp.copy(band === 0 ? cStrataA : band === 1 ? cStrataB : cStrataC);
    } else {
      tmp.copy(cStrataC).lerp(cRim, Math.min(1, (h - 150) / 60));
    }
    tmp.offsetHSL(0, 0, v);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  terrain.name = 'terrain';

  // --- river ribbon along the canyon floor, catching the low sun ---
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
    color: palette.river, roughness: 0.15, metalness: 0.35, transparent: true, opacity: 0.92,
  }));
  river.name = 'river';

  // --- junipers: dark, sparse, only on the canyon floor and low slopes ---
  const rand = mulberry32(SEED + 7);
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < 650 && guard++ < 30000) {
    const x = (rand() - 0.5) * 2250, z = (rand() - 0.5) * 2250;
    if (distToCourse(x, z) < 26) continue; // trees crowd the course edges
    const h = heightAt(x, z);
    if (h < 9 || h > 80) continue;
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

  // --- scrub bushes crowding the course edges (foreground detail at low altitude) ---
  const bushSpots = [];
  guard = 0;
  while (bushSpots.length < 160 && guard++ < 8000) {
    const x = (rand() - 0.5) * 2250, z = (rand() - 0.5) * 2250;
    const d = distToCourse(x, z);
    if (d < 14 || d > 90) continue;
    const h = heightAt(x, z);
    if (h < 9 || h > 95) continue;
    bushSpots.push([x, h, z, 0.7 + rand() * 0.9]);
  }
  const bushGeo = new THREE.IcosahedronGeometry(1.6, 0);
  const bushMat = new THREE.MeshStandardMaterial({ color: palette.tree, roughness: 1 });
  const bushes = new THREE.InstancedMesh(bushGeo, bushMat, bushSpots.length);
  bushSpots.forEach(([x, h, z, sc], i) => {
    p.set(x, h + 1.1 * sc, z); s.set(sc, sc * 0.75, sc); q.identity();
    m4.compose(p, q, s); bushes.setMatrixAt(i, m4);
  });
  bushes.name = 'bushes';

  // --- dry grass plots: flat quilt squares on the canyon floor ---
  const plotGeo = new THREE.PlaneGeometry(1, 1);
  plotGeo.rotateX(-Math.PI / 2);
  const plotMat = new THREE.MeshStandardMaterial({ roughness: 1 });
  const plotColors = [0x8a7a3a, 0xa8904a, 0x6a6a30, 0xb59a55, 0x7a6a35];
  const plotSpots = [];
  guard = 0;
  while (plotSpots.length < 40 && guard++ < 8000) {
    const x = (rand() - 0.5) * 2200, z = (rand() - 0.5) * 2200;
    const d = distToCourse(x, z);
    if (d < 30 || d > 170) continue;
    const h = heightAt(x, z);
    if (h < 9 || h > 30) continue;
    plotSpots.push([x, h, z, 14 + rand() * 14, rand() * Math.PI, plotColors[Math.floor(rand() * plotColors.length)]]);
  }
  const plots = new THREE.InstancedMesh(plotGeo, plotMat, plotSpots.length);
  const plotCol = new THREE.Color();
  plotSpots.forEach(([x, h, z, size, yaw, col], i) => {
    p.set(x, h + 0.5, z); s.set(size, 1, size * (0.7 + rand() * 0.5));
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    m4.compose(p, q, s); plots.setMatrixAt(i, m4);
    plots.setColorAt(i, plotCol.setHex(col));
  });
  if (plots.instanceColor) plots.instanceColor.needsUpdate = true;
  plots.name = 'grassPlots';

  // --- dirt road ribbon along the canyon floor, beside the river ---
  const roadPos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[i + 1];
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len), nz = (dx / len);
    const off = 17; // metres to the side of the course centreline
    const hw = 3.2;
    const a = [x1 + nx * (off - hw), heightAt(x1 + nx * (off - hw), z1 + nz * (off - hw)) + 0.7, z1 + nz * (off - hw)];
    const b = [x1 + nx * (off + hw), heightAt(x1 + nx * (off + hw), z1 + nz * (off + hw)) + 0.7, z1 + nz * (off + hw)];
    const c = [x2 + nx * (off - hw), heightAt(x2 + nx * (off - hw), z2 + nz * (off - hw)) + 0.7, z2 + nz * (off - hw)];
    const d = [x2 + nx * (off + hw), heightAt(x2 + nx * (off + hw), z2 + nz * (off + hw)) + 0.7, z2 + nz * (off + hw)];
    roadPos.push(...a, ...b, ...c, ...b, ...d, ...c);
  }
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
  roadGeo.computeVertexNormals();
  const road = new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({ color: 0x8a6f52, roughness: 1 }));
  road.name = 'road';

  // --- boulders on the slopes near the course ---
  const rockSpots = [];
  guard = 0;
  while (rockSpots.length < 70 && guard++ < 8000) {
    const x = (rand() - 0.5) * 2250, z = (rand() - 0.5) * 2250;
    const d = distToCourse(x, z);
    if (d < 18 || d > 130) continue;
    const h = heightAt(x, z);
    if (h < 20 || h > 110) continue;
    rockSpots.push([x, h, z, 1 + rand() * 2.2]);
  }
  const rockGeo = new THREE.DodecahedronGeometry(1.6, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: palette.strataC, roughness: 1 });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockSpots.length);
  rockSpots.forEach(([x, h, z, sc], i) => {
    p.set(x, h + 0.4 * sc, z); s.set(sc, sc * 0.7, sc);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
    m4.compose(p, q, s); rocks.setMatrixAt(i, m4);
  });
  rocks.name = 'boulders';

  // --- villages: little houses with pitched terracotta roofs near the course ---
  const village = new THREE.Group();
  village.name = 'village';
  const wallColors = [0xf2ead8, 0xe8d8b0, 0xffffff, 0xe8b48a];
  const roofColors = [0xb8442c, 0x7a4a2e, 0x9a3a2a, 0x5a6e8a];
  const clusters = [[0, -1050, 5], [-70, -450, 4], [-50, 150, 4], [30, 600, 4]];
  clusters.forEach(([cx, cz, n]) => {
    for (let k = 0; k < n; k++) {
      const hx = cx + (rand() - 0.5) * 70 + (rand() > 0.5 ? 45 : -45);
      const hz = cz + (rand() - 0.5) * 70;
      const hy = heightAt(hx, hz);
      if (hy < 9 || hy > 40) continue;
      const house = new THREE.Group();
      const walls = new THREE.Mesh(
        new THREE.BoxGeometry(6, 4, 5),
        new THREE.MeshStandardMaterial({ color: wallColors[Math.floor(rand() * wallColors.length)], roughness: 0.9 }),
      );
      walls.position.y = 2;
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(4.6, 2.6, 4),
        new THREE.MeshStandardMaterial({ color: roofColors[Math.floor(rand() * roofColors.length)], roughness: 0.9 }),
      );
      roof.position.y = 5.3;
      roof.rotation.y = Math.PI / 4;
      house.add(walls, roof);
      house.position.set(hx, hy, hz);
      house.rotation.y = rand() * Math.PI;
      village.add(house);
    }
  });

  // --- clouds, lit warm by the low sun (unlit material, so they stay warm) ---
  const clouds = new THREE.Group();
  clouds.name = 'clouds';
  const cloudMat = new THREE.MeshBasicMaterial({ color: palette.cloud, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < n; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(9 + rand() * 9, 8, 6), cloudMat);
      s.position.set((rand() - 0.5) * 30, (rand() - 0.5) * 4, (rand() - 0.5) * 16);
      s.scale.y = 0.62;
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
  // A ring is a real gate: it only counts when the plane crosses its plane
  // inside the hoop (see main.js). Each ring stores its facing normal — the
  // direction of travel through it — so the crossing test is exact.
  // Every ring also carries a soft glow sprite, so the gate reads as lit
  // even when the contact sheet shrinks it.
  const rings = [];
  const ringGroup = new THREE.Group();
  ringGroup.name = 'rings';
  const ringIdx = [1, 2, 4, 5, 7, 8, 10, 12]; // spread over the 14 waypoints
  ringIdx.forEach((wi, k) => {
    const [x, z] = pts[wi];
    const y = heightAt(x, z) + COURSE.ringHeight;
    const heading = courseHeadingAt(wi);
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(COURSE.ringRadius, 1.1, 10, 40),
      new THREE.MeshStandardMaterial({ color: palette.ring, emissive: palette.ringEmissive, emissiveIntensity: 0.9, roughness: 0.4 }),
    );
    torus.position.set(x, y, z);
    torus.rotation.y = heading;
    torus.name = `ring${k + 1}`;
    ringGroup.add(torus);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: palette.ringEmissive, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(46, 46, 1);
    glow.position.set(x, y, z);
    ringGroup.add(glow);
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
    rings.push({
      index: k,
      pos: new THREE.Vector3(x, y, z),
      // Torus default normal is +Z; rotation.y = heading maps it to the
      // direction of travel, which is also the plane's forward at that point.
      normal: new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)),
      mesh: torus, glow, passed: false, prevSide: null,
    });
  });

  // --- green fuel gates between the rings: the only refill on the course ---
  const fuelRings = [];
  const fuelGroup = new THREE.Group();
  fuelGroup.name = 'fuelRings';
  FUEL_RING_WAYPOINTS.forEach((wi) => {
    const [x, z] = pts[wi];
    const y = heightAt(x, z) + COURSE.ringHeight;
    const heading = courseHeadingAt(wi);
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(COURSE.ringRadius, 0.9, 10, 40),
      new THREE.MeshStandardMaterial({ color: palette.fuelRing, emissive: palette.fuelRingEmissive, emissiveIntensity: 0.8, roughness: 0.4 }),
    );
    torus.position.set(x, y, z);
    torus.rotation.y = heading;
    fuelGroup.add(torus);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: palette.fuelRingEmissive, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(40, 40, 1);
    glow.position.set(x, y, z);
    fuelGroup.add(glow);
    fuelRings.push({
      pos: new THREE.Vector3(x, y, z),
      normal: new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)),
      mesh: torus, glow, passed: false, prevSide: null,
    });
  });

  // Beacon column marking the active ring so it can be found from far away.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 130, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: palette.ring, transparent: true, opacity: 0.16,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  beacon.name = 'ringBeacon';
  ringGroup.add(beacon);

  // Restyle every ring around the active one: passed rings go green, the
  // active ring burns bright and carries the beacon, later rings stay dim.
  // curPalette tracks golden/dusk swaps so the restyle always uses the live palette.
  let curPalette = palette;
  function setActiveRing(activeIdx) {
    rings.forEach((r, i) => {
      if (r.passed) {
        r.mesh.material.color.setHex(0x37c978);
        r.mesh.material.emissive.setHex(0x1a7a45);
        r.mesh.material.emissiveIntensity = 0.7;
        r.glow.material.opacity = 0.12;
      } else if (i === activeIdx) {
        r.mesh.material.color.setHex(curPalette.ring);
        r.mesh.material.emissive.setHex(curPalette.ringEmissive);
        r.mesh.material.emissiveIntensity = 1.4;
        r.glow.material.opacity = 0.5;
      } else {
        r.mesh.material.color.setHex(curPalette.ring);
        r.mesh.material.emissive.setHex(curPalette.ringEmissive);
        r.mesh.material.emissiveIntensity = 0.35;
        r.glow.material.opacity = 0.22;
      }
      r.mesh.scale.setScalar(1);
    });
    const active = rings[activeIdx];
    if (active) {
      beacon.visible = true;
      beacon.position.set(active.pos.x, active.pos.y + 40, active.pos.z);
    } else {
      beacon.visible = false;
    }
  }
  setActiveRing(0);

  return {
    heightAt, rings, fuelRings, distToCourse, setActiveRing,
    startPos: new THREE.Vector3(start[0], heightAt(start[0], start[1]) + 5.5, start[1]),
    startYaw: Math.PI - startHeading, // yaw where 0 = north (-z); course heads +z (south)
    addTo(scene) {
      scene.add(sky, sunGroup, terrain, river, road, cones, trunks, bushes, plots, rocks, village, clouds, runway, ringGroup, fuelGroup);
    },
    update(dt, t) {
      clouds.children.forEach((c, i) => {
        c.position.x += dt * (2 + (i % 3));
        if (c.position.x > 1200) c.position.x = -1200;
      });
      // Only the active (next) ring pulses, so the eye finds it at a glance.
      const active = rings.find((r) => !r.passed);
      rings.forEach((r) => {
        if (r === active) {
          r.mesh.material.emissiveIntensity = 1.1 + Math.sin(t * 3) * 0.45;
          r.mesh.scale.setScalar(1 + Math.sin(t * 3) * 0.03);
          r.glow.material.opacity = 0.4 + Math.sin(t * 3) * 0.15;
        } else if (!r.passed) {
          r.mesh.material.emissiveIntensity = 0.35;
        }
      });
      fuelRings.forEach((r) => {
        if (!r.passed) r.glow.material.opacity = 0.22 + Math.sin(t * 2.4) * 0.1;
      });
      if (beacon.visible) beacon.material.opacity = 0.12 + Math.sin(t * 3) * 0.05;
    },
    setPalette(next) {
      // Swap the live palette: sky dome, sun, river, trees, rocks, clouds, rings.
      curPalette = next;
      cZenith.setHex(next.skyZenith); cMid.setHex(next.skyMid); cHorizon.setHex(next.skyHorizon);
      paintSky(next);
      sunDisc.material.color.setHex(next.sunDisc);
      sunGlow.material.color.setHex(next.sunGlow);
      river.material.color.setHex(next.river);
      coneMat.color.setHex(next.tree);
      bushMat.color.setHex(next.tree);
      rockMat.color.setHex(next.strataC);
      trunkMat.color.setHex(next.trunk);
      cloudMat.color.setHex(next.cloud);
      beacon.material.color.setHex(next.ring);
      setActiveRing(rings.findIndex((r) => !r.passed));
    },
  };
}
