// random.js — a small seeded random generator and the smooth noise
// built on it. The whole world is generated from a mission seed, so a
// given mission is the same valley on every flight and in every
// screenshot: no Math.random anywhere in the game.

// mulberry32: one 32-bit state, a well-mixed stream of [0, 1) values.
export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A 1-D value-noise field: random heights on a coarse lattice, smoothly
// interpolated. Layered at a few scales it makes ridgelines that look
// eroded rather than sine-wave smooth.
export function makeNoise1d(seed, latticeSize = 256) {
  const rng = makeRng(seed);
  const lattice = new Float32Array(latticeSize);
  for (let i = 0; i < latticeSize; i++) lattice[i] = rng() * 2 - 1;
  const at = (i) => lattice[((i % latticeSize) + latticeSize) % latticeSize];
  return function noise(x) {
    const ix = Math.floor(x);
    const fx = x - ix;
    // Smoothstep between the two lattice points around x.
    const t = fx * fx * (3 - 2 * fx);
    return at(ix) * (1 - t) + at(ix + 1) * t;
  };
}

// Fractal sum of a 1-D noise at a few octaves, roughly in [-1, 1].
export function fbm1d(noise, x, octaves = 4) {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.13;
  }
  return sum / norm;
}

// Deterministic hash of an integer cell, for placing trees and rocks
// without storing a table: the same cell always grows the same tree.
export function cellHash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296);
}
