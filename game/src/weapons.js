// weapons.js — the five guns of PRISM BREAK v2. The blaster is the ship's
// own; the other four arrive as timed pickups dropped by broken enemies and
// each bends the player's fire in a different direction: a five-pellet
// scatter fan, a piercing rail lance, a swarm of homing shards, and a
// rapid pulse stream. Firing and projectile motion both live here; hits
// are resolved by game.js.

import { PALETTE, TAU, randRange } from './util.js';
import { sparks } from './particles.js';

export const WEAPON_ORDER = ['scatter', 'rail', 'seeker', 'pulse'];

export const WEAPONS = {
  blaster: {
    id: 'blaster',
    name: 'PRISM BLASTER',
    color: PALETTE.blaster,
    rate: 7, // shots per second
    duration: Infinity,
    blurb: 'the ship standard',
  },
  scatter: {
    id: 'scatter',
    name: 'HELIX SCATTER',
    color: PALETTE.scatter,
    rate: 4.2,
    duration: 14,
    blurb: 'five-pellet fan',
  },
  rail: {
    id: 'rail',
    name: 'LANCE RAIL',
    color: PALETTE.rail,
    rate: 2.6,
    duration: 12,
    blurb: 'piercing bolts',
  },
  seeker: {
    id: 'seeker',
    name: 'SWARM SEEKER',
    color: PALETTE.seeker,
    rate: 5.5,
    duration: 13,
    blurb: 'homing shards',
  },
  pulse: {
    id: 'pulse',
    name: 'NOVA PULSE',
    color: PALETTE.pulse,
    rate: 15,
    duration: 11,
    blurb: 'rapid stream',
  },
};

function addBullet(state, b) {
  if (state.bullets.length < 700) state.bullets.push(b);
}

// Spawn one shot of the player's current weapon from the ship's nose.
// `aim` is the angle from the player to the cursor. Recoil and muzzle
// sparks are applied here so every caller gets the full feel for free.
export function fireWeapon(state, aim) {
  const p = state.player;
  const w = WEAPONS[p.weapon];
  const rng = state.rng;
  const nx = p.x + Math.cos(p.angle) * 20;
  const ny = p.y + Math.sin(p.angle) * 20;
  state.events.push({ type: 'shoot', kind: p.weapon });

  switch (p.weapon) {
    case 'scatter': {
      state.stats.shots += 5;
      for (let i = -2; i <= 2; i++) {
        const a = aim + i * 0.13 + randRange(rng, -0.02, 0.02);
        const sp = randRange(rng, 620, 700);
        addBullet(state, {
          x: nx, y: ny, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.55, dmg: 1, pierce: 0, homing: 0, r: 3.4,
          color: w.color, kind: 'pellet',
        });
      }
      p.recoil = 5;
      break;
    }
    case 'rail': {
      state.stats.shots += 1;
      const sp = 1150;
      addBullet(state, {
        x: nx, y: ny, vx: Math.cos(aim) * sp, vy: Math.sin(aim) * sp,
        life: 0.85, dmg: 3, pierce: 99, homing: 0, r: 4.6,
        color: w.color, kind: 'rail',
      });
      p.recoil = 7;
      state.fx.shake = Math.min(22, state.fx.shake + 1.6);
      break;
    }
    case 'seeker': {
      state.stats.shots += 3;
      for (let i = -1; i <= 1; i++) {
        const a = aim + i * 0.3;
        const sp = 430;
        addBullet(state, {
          x: nx, y: ny, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 1.5, dmg: 1, pierce: 0, homing: 7.5, r: 3.6,
          color: w.color, kind: 'seeker', turnSeed: rng() * TAU,
        });
      }
      p.recoil = 3;
      break;
    }
    case 'pulse': {
      state.stats.shots += 1;
      const a = aim + randRange(rng, -0.035, 0.035);
      const sp = 780;
      addBullet(state, {
        x: nx, y: ny, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.62, dmg: 1, pierce: 0, homing: 0, r: 3,
        color: w.color, kind: 'pulse',
      });
      p.recoil = 1.6;
      break;
    }
    default: { // blaster
      state.stats.shots += 1;
      const a = aim + randRange(rng, -0.012, 0.012);
      const sp = 860;
      addBullet(state, {
        x: nx, y: ny, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.8, dmg: 1, pierce: 0, homing: 0, r: 3.4,
        color: w.color, kind: 'bolt',
      });
      p.recoil = 2.6;
    }
  }
  sparks(state.fx, rng, nx, ny, aim, w.color, 2);
}

// Seconds between shots for a weapon.
export function fireInterval(weaponId) {
  return 1 / WEAPONS[weaponId].rate;
}

// Advance player projectiles: straight flight, seeker steering toward the
// nearest living enemy, and a gentle wobble that makes shards feel alive.
export function updateProjectiles(state, dt) {
  const bs = state.bullets;
  for (let i = bs.length - 1; i >= 0; i--) {
    const b = bs[i];
    b.life -= dt;
    if (b.life <= 0) {
      bs.splice(i, 1);
      continue;
    }
    if (b.homing > 0) steerSeeker(state, b, dt);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
}

function steerSeeker(state, b, dt) {
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const d = (e.x - b.x) * (e.x - b.x) + (e.y - b.y) * (e.y - b.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  const speed = Math.hypot(b.vx, b.vy) || 1;
  if (best) {
    const want = Math.atan2(best.y - b.y, best.x - b.x);
    const cur = Math.atan2(b.vy, b.vx);
    let delta = want - cur;
    while (delta > Math.PI) delta -= TAU;
    while (delta < -Math.PI) delta += TAU;
    const turn = Math.max(-b.homing * dt, Math.min(b.homing * dt, delta));
    const a = cur + turn;
    b.vx = Math.cos(a) * speed;
    b.vy = Math.sin(a) * speed;
  }
  // A whisper of sinusoidal drift keeps idle shards from flying ruler-flat.
  const wob = Math.sin(state.time * 14 + (b.turnSeed || 0)) * 26 * dt;
  const px = -b.vy / speed;
  const py = b.vx / speed;
  b.x += px * wob;
  b.y += py * wob;
}

// The pickup kind a broken enemy drops, rolled by game.js; this maps a kind
// to its display data for the renderer and HUD.
export function pickupInfo(kind) {
  if (kind === 'heart') return { label: 'REPAIR', color: PALETTE.heart, glyph: '+' };
  if (kind === 'gem') return { label: 'CORE', color: PALETTE.gem, glyph: '◆' };
  const w = WEAPONS[kind];
  if (w) return { label: w.name, color: w.color, glyph: '▲' };
  return { label: kind, color: '#ffffff', glyph: '?' };
}
