// util.js — shared foundations for PRISM BREAK v2: the arena dimensions, the
// neon palette every module paints from, a deterministic seeded random
// generator (so staged screenshots and tests replay exactly), and the small
// math helpers the simulation reaches for everywhere.

export const ARENA_W = 1280;
export const ARENA_H = 800;
export const WALL = 26; // thickness of the glowing arena frame, in px

// The whole game speaks one palette: cyan for the player, magenta for danger,
// and one hot colour per weapon and enemy family.
export const PALETTE = {
  player: '#3df3ff',
  playerCore: '#eaffff',
  blaster: '#ffe95a',
  scatter: '#ff9f2e',
  rail: '#57ff9a',
  seeker: '#ff5ad2',
  pulse: '#7ab8ff',
  heart: '#ff5a6e',
  gem: '#8affff',
  chaser: '#ff3d5e',
  dart: '#ff8a3d',
  tank: '#c44dff',
  orbiter: '#ffe93d',
  weaver: '#3dff9e',
  splitter: '#ff3dd8',
  mite: '#ff7ab0',
  boss: '#ff2e63',
  enemyBullet: '#ffb3c8',
  textDim: '#9db8d9',
};

export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Smooth 0..1 easing used by banners and screen transitions.
export function easeOut(t) {
  return 1 - Math.pow(1 - clamp(t, 0, 1), 3);
}

export function easeInOut(t) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Shortest signed turn from angle a to angle b, in (-PI, PI].
export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// mulberry32: a tiny, fast, seedable PRNG. One generator per run keeps the
// whole simulation deterministic for a given seed.
export function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return function rng() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Format a score with thousands separators for the HUD and end screen.
export function fmtScore(n) {
  const s = Math.floor(Math.abs(n)).toString();
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return (n < 0 ? '-' : '') + out;
}

// A point just inside a random arena edge, used for enemy spawn gates.
export function edgeSpawn(rng) {
  const side = randInt(rng, 0, 3);
  const m = WALL + 18;
  if (side === 0) return { x: randRange(rng, m, ARENA_W - m), y: m, side };
  if (side === 1) return { x: randRange(rng, m, ARENA_W - m), y: ARENA_H - m, side };
  if (side === 2) return { x: m, y: randRange(rng, m, ARENA_H - m), side };
  return { x: ARENA_W - m, y: randRange(rng, m, ARENA_H - m), side };
}
