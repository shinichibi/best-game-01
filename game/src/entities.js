// The actors: the player's ship, six kinds of prism enemy, both sides' bullets
// and the pickups enemies drop. This file owns movement and behaviour; damage
// resolution and scoring live in game.js, drawing in render.js.

import { ARENA, PALETTE, PLAYER, WAVES } from './config.js';
import { range } from './rng.js';

export function makePlayer() {
  return {
    x: ARENA.w / 2,
    y: ARENA.h / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hull: PLAYER.hull,
    maxHull: PLAYER.hull,
    fireTimer: 0,
    dashT: 0,
    dashCd: 0,
    dashDx: 0,
    dashDy: 0,
    iframes: 0,
    regen: 0, // hull per second, from upgrades
    alive: true,
  };
}

const ENEMY_BASE = {
  shard: { hp: 22, speed: 98, radius: 14, damage: 12, color: PALETTE.shard },
  mini: { hp: 9, speed: 158, radius: 9, damage: 8, color: PALETTE.mini },
  darter: { hp: 30, speed: 74, radius: 13, damage: 14, color: PALETTE.darter },
  orbiter: { hp: 36, speed: 88, radius: 15, damage: 10, color: PALETTE.orbiter },
  splitter: { hp: 55, speed: 64, radius: 19, damage: 14, color: PALETTE.splitter },
  tank: { hp: 170, speed: 40, radius: 27, damage: 20, color: PALETTE.tank },
  boss: { hp: 1450, speed: 52, radius: 46, damage: 24, color: PALETTE.boss },
};

export function spawnEnemy(state, kind, x, y) {
  const base = ENEMY_BASE[kind];
  const wave = state.wave;
  const hpScale = 1 + (wave - 1) * WAVES.hpGrowth + (kind === 'boss' ? (Math.ceil(wave / 5) - 1) * 0.9 : 0);
  const spScale = 1 + (wave - 1) * WAVES.speedGrowth;
  const e = {
    kind,
    x, y,
    vx: 0, vy: 0,
    angle: range(state.rng, 0, Math.PI * 2),
    spin: range(state.rng, -1.4, 1.4),
    radius: base.radius,
    hp: Math.round(base.hp * hpScale),
    maxHp: Math.round(base.hp * hpScale),
    speed: base.speed * spScale * range(state.rng, 0.9, 1.1),
    damage: base.damage,
    color: base.color,
    t: range(state.rng, 0, 10), // behaviour clock
    mode: 'drift',
    modeT: 0,
    fireT: range(state.rng, 1.2, 2.6),
    flash: 0, // hit flash timer, read by render
    dead: false,
  };
  state.enemies.push(e);
  return e;
}

export function updatePlayer(state, dt, intent) {
  const p = state.player;
  if (!p.alive) return;
  const up = state.upgrades;

  p.fireTimer -= dt;
  p.dashCd -= dt;
  p.iframes -= dt;
  if (p.regen > 0) p.hull = Math.min(p.maxHull, p.hull + p.regen * dt);

  p.angle = Math.atan2(intent.aimY - p.y, intent.aimX - p.x);

  if (intent.dash && p.dashCd <= 0) {
    let dx = intent.mx;
    let dy = intent.my;
    if (dx === 0 && dy === 0) {
      dx = Math.cos(p.angle);
      dy = Math.sin(p.angle);
    }
    const len = Math.hypot(dx, dy) || 1;
    p.dashDx = dx / len;
    p.dashDy = dy / len;
    p.dashT = PLAYER.dashTime;
    p.dashCd = PLAYER.dashCooldown * (up.dashRecharge || 1);
    p.iframes = Math.max(p.iframes, PLAYER.dashTime + 0.05);
    state.events.push('dash');
  }

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDx * PLAYER.dashSpeed;
    p.vy = p.dashDy * PLAYER.dashSpeed;
    state.fx.trail(p.x, p.y, PALETTE.player, 9);
  } else {
    p.vx += intent.mx * PLAYER.accel * dt;
    p.vy += intent.my * PLAYER.accel * dt;
    const damp = Math.max(0, 1 - PLAYER.drag * dt);
    if (intent.mx === 0) p.vx *= damp;
    if (intent.my === 0) p.vy *= damp;
    const sp = Math.hypot(p.vx, p.vy);
    const max = PLAYER.maxSpeed * (up.speedMul || 1);
    if (sp > max) {
      p.vx = (p.vx / sp) * max;
      p.vy = (p.vy / sp) * max;
    }
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const w = ARENA.wall + p.radius;
  p.x = Math.min(ARENA.w - w, Math.max(w, p.x));
  p.y = Math.min(ARENA.h - w, Math.max(w, p.y));

  if (intent.firing && p.fireTimer <= 0) {
    p.fireTimer = 1 / (PLAYER.fireRate * (up.fireRateMul || 1));
    fireBullets(state, p, up);
    state.events.push('shoot');
  }
}

function fireBullets(state, p, up) {
  const count = 1 + (up.extraCannons || 0);
  const spreadStep = 0.085;
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * spreadStep;
    const a = p.angle + off;
    state.bullets.push({
      x: p.x + Math.cos(p.angle) * (p.radius + 6),
      y: p.y + Math.sin(p.angle) * (p.radius + 6),
      vx: Math.cos(a) * PLAYER.bulletSpeed,
      vy: Math.sin(a) * PLAYER.bulletSpeed,
      radius: PLAYER.bulletRadius + (up.bulletSize || 0),
      damage: PLAYER.bulletDamage * (up.damageMul || 1),
      pierce: up.pierce || 0,
      life: 0.9,
      dead: false,
    });
    state.stats.shots++;
  }
  state.fx.burst(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, PALETTE.bullet, 2, 60, 0.12, 2.5);
}

function steer(e, tx, ty, dt, speedMul = 1) {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.vx = (dx / d) * e.speed * speedMul;
  e.vy = (dy / d) * e.speed * speedMul;
}

export function updateEnemies(state, dt) {
  const p = state.player;
  for (const e of state.enemies) {
    e.t += dt;
    e.modeT += dt;
    e.flash = Math.max(0, e.flash - dt * 8);
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;

    switch (e.kind) {
      case 'shard':
      case 'mini': {
        const wob = Math.sin(e.t * 3.1) * 26;
        steer(e, p.x + -dy / dist * wob, p.y + dx / dist * wob, dt);
        break;
      }
      case 'splitter':
        steer(e, p.x, p.y, dt);
        break;
      case 'darter': {
        if (e.mode === 'drift') {
          steer(e, p.x, p.y, dt, 0.8);
          if (e.modeT > 0.75 && dist < 330) {
            e.mode = 'aim';
            e.modeT = 0;
          }
        } else if (e.mode === 'aim') {
          e.vx *= 0.86;
          e.vy *= 0.86;
          e.aimX = dx / dist;
          e.aimY = dy / dist;
          if (e.modeT > 0.34) {
            e.mode = 'dash';
            e.modeT = 0;
            e.vx = e.aimX * 540;
            e.vy = e.aimY * 540;
          }
        } else if (e.mode === 'dash') {
          if (e.modeT > 0.3) {
            e.mode = 'drift';
            e.modeT = 0;
          }
        }
        break;
      }
      case 'orbiter': {
        const want = 235;
        const radial = dist > want + 24 ? 1 : dist < want - 24 ? -1 : 0;
        const tx = (dx / dist) * radial + (-dy / dist) * 0.9;
        const ty = (dy / dist) * radial + (dx / dist) * 0.9;
        e.vx = tx * e.speed;
        e.vy = ty * e.speed;
        e.fireT -= dt;
        if (e.fireT <= 0 && dist < 430) {
          e.fireT = 2.3;
          enemyShoot(state, e, dx / dist, dy / dist, 265);
        }
        break;
      }
      case 'tank': {
        steer(e, p.x, p.y, dt);
        e.fireT -= dt;
        if (e.fireT <= 0 && dist < 470) {
          e.fireT = 2.7;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + e.t;
            enemyShoot(state, e, Math.cos(a), Math.sin(a), 185);
          }
          state.events.push('enemyShoot');
        }
        break;
      }
      case 'boss': {
        updateBoss(state, e, dt, dx, dy, dist);
        break;
      }
    }

    if (e.kind !== 'darter' || e.mode !== 'dash') {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    } else {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }
    e.angle += e.spin * dt;
    const w = ARENA.wall + e.radius * 0.6;
    e.x = Math.min(ARENA.w - w, Math.max(w, e.x));
    e.y = Math.min(ARENA.h - w, Math.max(w, e.y));
  }
}

function updateBoss(state, e, dt, dx, dy, dist) {
  // The Warden Prism cycles attacks: keep its range, then radial burst,
  // an aimed fan, a shard summon, and a telegraphed charge.
  if (e.mode === 'drift') {
    const want = 265;
    const radial = dist > want + 30 ? 1 : dist < want - 30 ? -0.7 : 0;
    e.vx = (dx / dist) * radial * e.speed + (-dy / dist) * e.speed * 0.45;
    e.vy = (dy / dist) * radial * e.speed + (dx / dist) * e.speed * 0.45;
    if (e.modeT > 2.3) {
      const attacks = ['radial', 'fan', 'summon', 'chargeAim'];
      e.mode = attacks[Math.floor(state.rng() * attacks.length)];
      e.modeT = 0;
      if (e.mode === 'radial' || e.mode === 'fan') {
        // firing happens on entry below
      }
    }
  } else if (e.mode === 'radial') {
    e.vx *= 0.9;
    e.vy *= 0.9;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + e.t * 0.7;
      enemyShoot(state, e, Math.cos(a), Math.sin(a), 205);
    }
    state.events.push('enemyShoot');
    e.mode = 'drift';
    e.modeT = 0;
  } else if (e.mode === 'fan') {
    e.vx *= 0.9;
    e.vy *= 0.9;
    for (let i = -2; i <= 2; i++) {
      const a = Math.atan2(dy, dx) + i * 0.16;
      enemyShoot(state, e, Math.cos(a), Math.sin(a), 300);
    }
    state.events.push('enemyShoot');
    e.mode = 'drift';
    e.modeT = 0;
  } else if (e.mode === 'summon') {
    for (let i = 0; i < 2; i++) {
      const a = state.rng() * Math.PI * 2;
      spawnEnemy(state, 'shard', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60);
    }
    state.events.push('boss');
    e.mode = 'drift';
    e.modeT = 0;
  } else if (e.mode === 'chargeAim') {
    e.vx *= 0.84;
    e.vy *= 0.84;
    e.aimX = dx / dist;
    e.aimY = dy / dist;
    if (e.modeT > 0.55) {
      e.mode = 'charge';
      e.modeT = 0;
      e.vx = e.aimX * 430;
      e.vy = e.aimY * 430;
    }
  } else if (e.mode === 'charge') {
    if (e.modeT > 0.62) {
      e.mode = 'drift';
      e.modeT = 0;
    }
  }
}

export function enemyShoot(state, e, dx, dy, speed) {
  state.enemyBullets.push({
    x: e.x + dx * (e.radius + 4),
    y: e.y + dy * (e.radius + 4),
    vx: dx * speed,
    vy: dy * speed,
    radius: 5,
    damage: 9,
    life: 3.4,
    dead: false,
  });
  if (e.kind === 'orbiter') state.events.push('enemyShoot');
}

export function updateBullets(state, dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < 0 || b.x > ARENA.w || b.y < 0 || b.y > ARENA.h) b.dead = true;
  }
  for (const b of state.enemyBullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < 0 || b.x > ARENA.w || b.y < 0 || b.y > ARENA.h) b.dead = true;
  }
  state.bullets = state.bullets.filter((b) => !b.dead);
  state.enemyBullets = state.enemyBullets.filter((b) => !b.dead);
}

export function spawnPickup(state, kind, x, y) {
  state.pickups.push({
    kind,
    x, y,
    vx: range(state.rng, -40, 40),
    vy: range(state.rng, -40, 40),
    radius: kind === 'shard' ? 6 : 11,
    t: 0,
    life: 11,
    dead: false,
  });
}

export function updatePickups(state, dt) {
  const p = state.player;
  const magnetR = 105 * (state.upgrades.magnetMul || 1);
  for (const pk of state.pickups) {
    pk.t += dt;
    pk.life -= dt;
    if (pk.life <= 0) {
      pk.dead = true;
      continue;
    }
    const dx = p.x - pk.x;
    const dy = p.y - pk.y;
    const d = Math.hypot(dx, dy) || 1;
    if (pk.kind === 'shard' && d < magnetR) {
      const pull = 560 * (1 - d / magnetR) + 120;
      pk.vx = (dx / d) * pull;
      pk.vy = (dy / d) * pull;
    } else {
      pk.vx *= 1 - 2.4 * dt;
      pk.vy *= 1 - 2.4 * dt;
    }
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;
  }
  state.pickups = state.pickups.filter((pk) => !pk.dead);
}
