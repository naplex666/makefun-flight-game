// Seeded random helpers: deterministic terrain and placement so screenshots are reproducible.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth value noise over a hashed grid, with fractal octaves.
export function makeNoise2D(seed) {
  const rand = mulberry32(seed);
  const size = 256;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const at = (ix, iz) => grid[((iz % size + size) % size) * size + ((ix % size + size) % size)];
  const smooth = (t) => t * t * (3 - 2 * t);
  function noise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = smooth(x - ix), fz = smooth(z - iz);
    const a = at(ix, iz), b = at(ix + 1, iz), c = at(ix, iz + 1), d = at(ix + 1, iz + 1);
    return (a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz) * 2 - 1;
  }
  return function fbm(x, z) {
    let v = 0, amp = 1, freq = 1, total = 0;
    for (let o = 0; o < 4; o++) {
      v += noise(x * freq, z * freq) * amp;
      total += amp; amp *= 0.5; freq *= 2.1;
    }
    return v / total;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
