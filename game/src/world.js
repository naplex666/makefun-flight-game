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
  const cFieldA = new THREE.Color(0x9aa84e); // sunlit rice plot
  const cFieldB = new THREE.Color(0x6f8f3e); // shaded paddy
  const cFieldC = new THREE.Color(0xb59a55); // dry stubble plot
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
    // Valley-floor patchwork: rice plots read as a quilt of greens and gold
    // from the air, so the foreground is never one flat green.
    if (h < 30) {
      const patch = noise(x * 0.008 + 40, z * 0.008 + 40);
      if (patch > 0.28) tmp.lerp(cFieldA, 0.55);
      else if (patch > 0.05) tmp.lerp(cFieldB, 0.4);
      else if (patch < -0.32) tmp.lerp(cFieldC, 0.45);
    }
    // Rock strata break through on steep ground.
    const steep = noise(x * 0.004 + 90, z * 0.004 + 90);
    if (h >= 55 && h < palette.snowLine && steep > 0.3) tmp.lerp(cRock, 0.35);
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
  while (treeSpots.length < 1100 && guard++ < 30000) {
    const x = (rand() - 0.5) * 2250, z = (rand() - 0.5) * 2250;
    if (distToCourse(x, z) < 26) continue; // trees crowd the course edges now
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

  // --- bushes crowding the course edges (foreground detail at low altitude) ---
  const bushSpots = [];
  guard = 0;
  while (bushSpots.length < 220 && guard++ < 8000) {
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

  // --- rice-field plots: flat quilt squares on the valley floor ---
  const plotGeo = new THREE.PlaneGeometry(1, 1);
  plotGeo.rotateX(-Math.PI / 2);
  const plotMat = new THREE.MeshStandardMaterial({ roughness: 1 });
  const plotColors = [0x8fae4e, 0xa8b45a, 0x7a9a44, 0xc2a95e, 0x5f8f3f];
  const plotSpots = [];
  guard = 0;
  while (plotSpots.length < 46 && guard++ < 8000) {
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
  plots.name = 'ricePlots';

  // --- dirt road ribbon along the valley, beside the river ---
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
  const rockMat = new THREE.MeshStandardMaterial({ color: palette.rock, roughness: 1 });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockSpots.length);
  rockSpots.forEach(([x, h, z, sc], i) => {
    p.set(x, h + 0.4 * sc, z); s.set(sc, sc * 0.7, sc);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
    m4.compose(p, q, s); rocks.setMatrixAt(i, m4);
  });
  rocks.name = 'boulders';

  // --- villages: little houses with pitched roofs near the runway and course ---
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
  const rings = [];
  const ringGroup = new THREE.Group();
  ringGroup.name = 'rings';
  const ringIdx = [1, 2, 4, 5, 7, 8, 10, 12]; // spread over the 14 waypoints
  ringIdx.forEach((wi, k) => {
    const [x, z] = pts[wi];
    const y = heightAt(x, z) + COURSE.ringHeight;
    const heading = courseHeadingAt(wi);
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(COURSE.ringRadius, 0.9, 10, 40),
      new THREE.MeshStandardMaterial({ color: palette.ring, emissive: palette.ringEmissive, emissiveIntensity: 0.9, roughness: 0.4 }),
    );
    torus.position.set(x, y, z);
    torus.rotation.y = heading;
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
    rings.push({
      index: k,
      pos: new THREE.Vector3(x, y, z),
      // Torus default normal is +Z; rotation.y = heading maps it to the
      // direction of travel, which is also the plane's forward at that point.
      normal: new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)),
      mesh: torus, passed: false,
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
  // curPalette tracks day/dusk swaps so the restyle always uses the live palette.
  let curPalette = palette;
  function setActiveRing(activeIdx) {
    rings.forEach((r, i) => {
      if (r.passed) {
        r.mesh.material.color.setHex(0x37c978);
        r.mesh.material.emissive.setHex(0x1a7a45);
        r.mesh.material.emissiveIntensity = 0.7;
      } else if (i === activeIdx) {
        r.mesh.material.color.setHex(curPalette.ring);
        r.mesh.material.emissive.setHex(curPalette.ringEmissive);
        r.mesh.material.emissiveIntensity = 1.4;
      } else {
        r.mesh.material.color.setHex(curPalette.ring);
        r.mesh.material.emissive.setHex(curPalette.ringEmissive);
        r.mesh.material.emissiveIntensity = 0.35;
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
    heightAt, rings, distToCourse, setActiveRing,
    startPos: new THREE.Vector3(start[0], heightAt(start[0], start[1]) + 5.5, start[1]),
    startYaw: Math.PI - startHeading, // yaw where 0 = north (-z); course heads +z (south)
    addTo(scene) {
      scene.add(terrain, river, road, cones, trunks, bushes, plots, rocks, village, clouds, runway, ringGroup);
    },
    update(dt, t) {
      clouds.children.forEach((c, i) => {
        c.position.x += dt * (2 + (i % 3));
        if (c.position.x > 1200) c.position.x = -1200;
      });
      // Only the active (next) ring pulses, so the eye finds it at a glance.
      const active = rings.find((r) => !r.passed);
      const pulse = 0.75 + Math.sin(t * 3) * 0.35;
      rings.forEach((r) => {
        if (r === active) {
          r.mesh.material.emissiveIntensity = 1.1 + Math.sin(t * 3) * 0.45;
          r.mesh.scale.setScalar(1 + Math.sin(t * 3) * 0.03);
        } else if (!r.passed) {
          r.mesh.material.emissiveIntensity = 0.35;
        }
      });
      if (beacon.visible) beacon.material.opacity = 0.12 + Math.sin(t * 3) * 0.05;
    },
    setPalette(next) {
      // Swap terrain colours cheaply by rebuilding only material colours used by dynamic parts.
      curPalette = next;
      river.material.color.setHex(next.river);
      coneMat.color.setHex(next.tree);
      bushMat.color.setHex(next.tree);
      rockMat.color.setHex(next.rock);
      trunkMat.color.setHex(next.trunk);
      cloudMat.color.setHex(next.cloud);
      beacon.material.color.setHex(next.ring);
      setActiveRing(rings.findIndex((r) => !r.passed));
    },
  };
}
