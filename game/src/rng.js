// A tiny seeded random number generator (mulberry32). The whole simulation draws
// from one of these, so a run with a fixed seed replays exactly — the property the
// headless balance tests and the screenshot scenes both rely on.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

export function chance(rng, p) {
  return rng() < p;
}
