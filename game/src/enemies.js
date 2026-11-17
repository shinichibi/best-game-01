// enemies.js — the bestiary of PRISM BREAK v2 and the minds that drive it.
// Six regular families, each with a silhouette, a palette colour and a
// behaviour you can read at a glance: chasers hunt, darts lunge, tanks
// split, orbiters strafe and shoot back, weavers slalom, splitters divide.
// Every fifth wave the Grand Prism arrives: a rotating multi-part boss
// with radial bullet patterns, aimed spreads and minion calls.

import { ARENA_W, ARENA_H, WALL, PALETTE, TAU, clamp, randRange } from './util.js';

export const ENEMY_TYPES = {
  chaser: {
    name: 'Shardling', hp: 3, speed: 118, r: 15, score: 50, touch: 1,
    color: PALETTE.chaser,
  },
  dart: {
    name: 'Needle Dart', hp: 1, speed: 205, r: 10, score: 70, touch: 1,
    color: PALETTE.dart,
  },
  tank: {
    name: 'Bulwark', hp: 16, speed: 44, r: 30, score: 220, touch: 2,
    color: PALETTE.tank, splitsInto: 'dart', splitCount: 3,
  },
  orbiter: {
    name: 'Wisp Orbiter', hp: 5, speed: 132, r: 14, score: 140, touch: 1,
    color: PALETTE.orbiter, shoots: true,
  },
  weaver: {
    name: 'Slalom Weaver', hp: 4, speed: 148, r: 13, score: 110, touch: 1,
    color: PALETTE.weaver,
  },
  splitter: {
    name: 'Mitosis', hp: 6, speed: 92, r: 19, score: 130, touch: 1,
    color: PALETTE.splitter, splitsInto: 'mite', splitCount: 2,
  },
  mite: {
    name: 'Mite', hp: 1, speed: 178, r: 8, score: 25, touch: 1,
    color: PALETTE.mite,
  },
  boss: {
    name: 'THE GRAND PRISM', hp: 300, speed: 36, r: 62, score: 5000, touch: 2,
    color: PALETTE.boss,
  },
};

let nextId = 1;

export function spawnEnemy(state, kind, x, y, opts = {}) {
  const base = ENEMY_TYPES[kind];
  const hpScale = opts.hpScale ?? 1;
  const e = {
    id: nextId++,
    kind,
    x, y,
    vx: 0, vy: 0,
    hp: Math.round(base.hp * hpScale),
    maxHp: Math.round(base.hp * hpScale),
    r: base.r,
    angle: Math.atan2(state.player.y - y, state.player.x - x),
    t: 0,
    seed: state.rng() * TAU,
    flash: 0,
    fireCd: randRange(state.rng, 1.2, 2.6),
    lungeT: randRange(state.rng, 0.4, 1.1),
    lunging: 0,
    orbitDir: state.rng() < 0.5 ? -1 : 1,
    spawnT: 0.45, // brief materialise-in: harmless and translucent
    scoreMult: 1,
    elite: false,
    tint: null,
  };
  // Elites: from wave 4, a few prisms come gilded — tougher, slower to
  // break, worth triple. The gold tint makes them read instantly.
  if (state.wave >= 4 && kind !== 'mite' && state.rng() < 0.09) {
    e.elite = true;
    e.hp = e.maxHp = Math.round(e.hp * 2.2);
    e.r = Math.round(e.r * 1.18);
    e.scoreMult = 3;
    e.tint = '#ffd75a';
  }
  state.enemies.push(e);
  return e;
}

export function spawnBoss(state, wave) {
  const hp = 210 + wave * 36;
  const e = {
    id: nextId++,
    kind: 'boss',
    x: ARENA_W / 2,
    y: -80,
    vx: 0, vy: 0,
    hp, maxHp: hp,
    r: ENEMY_TYPES.boss.r,
    angle: 0,
    t: 0,
    seed: state.rng() * TAU,
    flash: 0,
    fireCd: 2.2,
    attackT: 2.6,
    attackIndex: 0,
    spiralT: 0,
    phase: 0, // 0 entering, 1 fighting
    minionsAt: [0.66, 0.33], // hp fractions that trigger minion calls
    spawnT: 0,
  };
  state.enemies.push(e);
  state.boss = e;
  state.events.push({ type: 'bossWarn' });
  return e;
}

// What a wave is made of. Boss waves are the boss plus a trickle of escorts
// handled by game.js. Numbers grow with the wave; new families phase in so
// the arena keeps teaching the player new shapes.
export function rosterForWave(wave) {
  if (wave % 5 === 0) return { boss: true, total: 0, mix: [] };
  const total = Math.min(46, 6 + wave * 3);
  const mix = [{ kind: 'chaser', w: 10 }];
  if (wave >= 2) mix.push({ kind: 'dart', w: 3 + wave * 0.7 });
  if (wave >= 3) mix.push({ kind: 'weaver', w: 2 + wave * 0.5 });
  if (wave >= 4) mix.push({ kind: 'splitter', w: 1.6 + wave * 0.4 });
  if (wave >= 6) mix.push({ kind: 'orbiter', w: 1.4 + wave * 0.35 });
  if (wave >= 7) mix.push({ kind: 'tank', w: 0.8 + wave * 0.22 });
  return { boss: false, total, mix };
}

export function pickFromMix(rng, mix) {
  let sum = 0;
  for (const m of mix) sum += m.w;
  let roll = rng() * sum;
  for (const m of mix) {
    roll -= m.w;
    if (roll <= 0) return m.kind;
  }
  return mix[0].kind;
}

// --- per-kind minds -----------------------------------------------------------

function steer(e, dx, dy, speed, dt, turnRate = 6) {
  const want = Math.atan2(dy, dx);
  let delta = want - e.angle;
  while (delta > Math.PI) delta -= TAU;
  while (delta < -Math.PI) delta += TAU;
  const turn = clamp(delta, -turnRate * dt, turnRate * dt);
  e.angle += turn;
  e.vx = Math.cos(e.angle) * speed;
  e.vy = Math.sin(e.angle) * speed;
}

function moveChaser(state, e, dt) {
  const p = state.player;
  steer(e, p.x - e.x, p.y - e.y, ENEMY_TYPES.chaser.speed * state.speedScale, dt);
}

function moveDart(state, e, dt) {
  const p = state.player;
  const base = ENEMY_TYPES.dart;
  e.lungeT -= dt;
  if (e.lunging > 0) {
    e.lunging -= dt; // keep the velocity the lunge set
  } else if (e.lungeT <= 0) {
    // Telegraph, then strike in a straight line at the player's position.
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    e.angle = a;
    e.vx = Math.cos(a) * base.speed * 2.1 * state.speedScale;
    e.vy = Math.sin(a) * base.speed * 2.1 * state.speedScale;
    e.lunging = 0.42;
    e.lungeT = randRange(state.rng, 0.8, 1.5);
  } else {
    // Drift toward the player at cruising speed while the lunge recharges.
    steer(e, p.x - e.x, p.y - e.y, base.speed * 0.45 * state.speedScale, dt, 3.4);
  }
}

function moveTank(state, e, dt) {
  const p = state.player;
  steer(e, p.x - e.x, p.y - e.y, ENEMY_TYPES.tank.speed * state.speedScale, dt, 2.2);
}

function moveOrbiter(state, e, dt) {
  const p = state.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const want = 250; // the orbit radius it tries to hold
  const radial = clamp((d - want) / 90, -1, 1);
  const tx = (dx / d) * radial + (-dy / d) * e.orbitDir * 0.9;
  const ty = (dy / d) * radial + (dx / d) * e.orbitDir * 0.9;
  const sp = ENEMY_TYPES.orbiter.speed * state.speedScale;
  e.vx = tx * sp;
  e.vy = ty * sp;
  e.angle = Math.atan2(dy, dx);
  // It shoots back: slow, readable bolts aimed at the player.
  e.fireCd -= dt;
  if (e.fireCd <= 0 && d < 560 && e.spawnT <= 0) {
    e.fireCd = randRange(state.rng, 1.9, 2.7);
    fireEnemyBullet(state, e.x, e.y, Math.atan2(dy, dx), 215);
  }
}

function moveWeaver(state, e, dt) {
  const p = state.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const sway = Math.sin(e.t * 5.2 + e.seed) * 0.95;
  const tx = dx / d + (-dy / d) * sway;
  const ty = dy / d + (dx / d) * sway;
  const tl = Math.hypot(tx, ty) || 1;
  const sp = ENEMY_TYPES.weaver.speed * state.speedScale;
  e.vx = (tx / tl) * sp;
  e.vy = (ty / tl) * sp;
  e.angle = Math.atan2(e.vy, e.vx);
}

function moveSplitter(state, e, dt) {
  const p = state.player;
  // Wobbles inward in pulses, as if breathing its way across the arena.
  const pulse = 0.72 + 0.38 * Math.sin(e.t * 3.1 + e.seed);
  steer(e, p.x - e.x, p.y - e.y, ENEMY_TYPES.splitter.speed * pulse * state.speedScale, dt, 3.6);
}

function moveMite(state, e, dt) {
  const p = state.player;
  steer(e, p.x - e.x, p.y - e.y, ENEMY_TYPES.mite.speed * state.speedScale, dt, 8);
}

function fireEnemyBullet(state, x, y, angle, speed, r = 5) {
  if (state.enemyBullets.length >= 420) return;
  state.enemyBullets.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r,
    life: 6,
  });
}

// The Grand Prism's attack cycle: radial rings, aimed fans and a rotating
// spiral, chosen in rotation so the player learns the rhythm.
function bossAttack(state, e) {
  const p = state.player;
  const rng = state.rng;
  const idx = e.attackIndex % 3;
  e.attackIndex++;
  if (idx === 0) {
    // Radial ring with a gap aimed away from the player — always escapable.
    const gap = Math.atan2(p.y - e.y, p.x - e.x);
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + e.t;
      let d = Math.abs(((a - gap) % TAU + TAU * 1.5) % TAU - Math.PI);
      if (d < 0.42) continue; // the gap
      fireEnemyBullet(state, e.x, e.y, a, 168, 5.5);
    }
    state.events.push({ type: 'bossShot' });
  } else if (idx === 1) {
    // Three aimed fans in quick succession (scheduled via spiralT ticks).
    e.fanLeft = 3;
    e.fanT = 0;
  } else {
    // A two-second double spiral.
    e.spiralT = 2.0;
    state.events.push({ type: 'bossShot' });
  }
}

function moveBoss(state, e, dt) {
  const p = state.player;
  if (e.phase === 0) {
    // Entrance: descend to its hover line, invulnerable-looking and slow.
    e.y += 62 * dt;
    e.x += (ARENA_W / 2 - e.x) * dt * 1.4;
    if (e.y >= 168) {
      e.y = 168;
      e.phase = 1;
    }
    return;
  }
  // Hover: a slow menacing sway that tracks the player's column.
  const targetX = ARENA_W / 2 + Math.sin(e.t * 0.35) * 300 + (p.x - ARENA_W / 2) * 0.22;
  const targetY = 168 + Math.sin(e.t * 0.8) * 42;
  e.x += clamp(targetX - e.x, -1, 1) * ENEMY_TYPES.boss.speed * dt * 2.2;
  e.y += clamp(targetY - e.y, -1, 1) * ENEMY_TYPES.boss.speed * dt * 1.6;
  e.angle += dt * 0.7;

  // Minion calls at the stored health fractions.
  const frac = e.hp / e.maxHp;
  while (e.minionsAt.length && frac <= e.minionsAt[0]) {
    e.minionsAt.shift();
    for (let i = 0; i < 3; i++) {
      const kind = i === 1 ? 'dart' : 'chaser';
      spawnEnemy(state, kind, e.x + (i - 1) * 90, e.y + 60);
    }
    state.events.push({ type: 'bossSummon' });
  }

  e.attackT -= dt;
  if (e.attackT <= 0) {
    e.attackT = Math.max(1.5, 2.5 - (1 - frac) * 0.7);
    bossAttack(state, e);
  }
  if (e.fanLeft > 0) {
    e.fanT -= dt;
    if (e.fanT <= 0) {
      e.fanT = 0.24;
      e.fanLeft--;
      const base = Math.atan2(p.y - e.y, p.x - e.x);
      for (let i = -2; i <= 2; i++) fireEnemyBullet(state, e.x, e.y, base + i * 0.16, 238, 5);
      state.events.push({ type: 'bossShot' });
    }
  }
  if (e.spiralT > 0) {
    e.spiralT -= dt;
    e.spiralAcc = (e.spiralAcc || 0) + dt;
    while (e.spiralAcc > 0.09) {
      e.spiralAcc -= 0.09;
      const a = e.t * 2.4;
      fireEnemyBullet(state, e.x, e.y, a, 150, 5);
      fireEnemyBullet(state, e.x, e.y, a + Math.PI, 150, 5);
    }
  }
}

const MOVERS = {
  chaser: moveChaser,
  dart: moveDart,
  tank: moveTank,
  orbiter: moveOrbiter,
  weaver: moveWeaver,
  splitter: moveSplitter,
  mite: moveMite,
  boss: moveBoss,
};

// Advance every enemy: run its mind, integrate, keep it inside the walls,
// and apply a soft separation so swarms read as individuals, not a blob.
export function updateEnemies(state, dt) {
  const es = state.enemies;
  for (const e of es) {
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt * 7);
    e.spawnT = Math.max(0, e.spawnT - dt);
    MOVERS[e.kind](state, e, dt);
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.x = clamp(e.x, WALL + e.r * 0.6, ARENA_W - WALL - e.r * 0.6);
    e.y = clamp(e.y, WALL + e.r * 0.6, ARENA_H - WALL - e.r * 0.6);
  }
  // Pairwise separation, cheap at arena counts (<= ~60 enemies).
  for (let i = 0; i < es.length; i++) {
    for (let j = i + 1; j < es.length; j++) {
      const a = es[i];
      const b = es[j];
      if (a.kind === 'boss' || b.kind === 'boss') continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = (a.r + b.r) * 0.82;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = ((min - d) / d) * 0.5;
        a.x -= dx * push * 0.5;
        a.y -= dy * push * 0.5;
        b.x += dx * push * 0.5;
        b.y += dy * push * 0.5;
      }
    }
  }
}

export function updateEnemyBullets(state, dt) {
  const bs = state.enemyBullets;
  for (let i = bs.length - 1; i >= 0; i--) {
    const b = bs[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0 || b.x < WALL - 8 || b.x > ARENA_W - WALL + 8 || b.y < WALL - 8 || b.y > ARENA_H - WALL + 8) {
      bs.splice(i, 1);
    }
  }
}
