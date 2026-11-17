// particles.js — the juice layer: every burst, spark, shockwave, ghost and
// floating score number lives here. Effects are plain data in the game
// state, updated by the simulation step and painted by the renderer, so a
// headless step produces exactly the effects a browser frame would.

import { TAU, clamp, randRange } from './util.js';

// Hard caps keep a chaotic late wave from ever melting the frame rate.
const MAX_PARTICLES = 900;
const MAX_RINGS = 40;
const MAX_TEXTS = 48;
const MAX_GHOSTS = 60;

export function makeFx() {
  return {
    particles: [],
    rings: [],
    texts: [],
    ghosts: [],
    shake: 0, // current screen-shake magnitude, px; decays in updateFx
    flash: 0, // full-screen colour flash, 0..1
    flashColor: '#ffffff',
    slowmo: 0, // seconds of slow motion remaining (player-hit drama)
  };
}

function pushParticle(fx, p) {
  if (fx.particles.length < MAX_PARTICLES) fx.particles.push(p);
}

// A radial burst of glowing shards — the basic enemy-death explosion.
export function burst(fx, rng, x, y, color, count = 16, speed = 260, size = 3, life = 0.55) {
  for (let i = 0; i < count; i++) {
    const a = rng() * TAU;
    const v = speed * (0.25 + rng() * 0.95);
    pushParticle(fx, {
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: life * (0.5 + rng() * 0.8),
      maxLife: life,
      size: size * (0.5 + rng() * 1.1),
      color,
      drag: 3.2,
      glow: true,
      shape: 'shard',
      rot: rng() * TAU,
      vr: randRange(rng, -9, 9),
    });
  }
}

// A tight cone of sparks for bullet impacts and wall hits.
export function sparks(fx, rng, x, y, angle, color, count = 6) {
  for (let i = 0; i < count; i++) {
    const a = angle + randRange(rng, -0.6, 0.6);
    const v = randRange(rng, 120, 380);
    pushParticle(fx, {
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: randRange(rng, 0.12, 0.3),
      maxLife: 0.3,
      size: randRange(rng, 1, 2.4),
      color,
      drag: 4.5,
      glow: true,
      shape: 'dot',
      rot: 0,
      vr: 0,
    });
  }
}

// Soft round embers that drift upward — ambient fire after big kills.
export function embers(fx, rng, x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    pushParticle(fx, {
      x: x + randRange(rng, -14, 14),
      y: y + randRange(rng, -14, 14),
      vx: randRange(rng, -30, 30),
      vy: randRange(rng, -90, -30),
      life: randRange(rng, 0.5, 1.1),
      maxLife: 1.1,
      size: randRange(rng, 1.5, 3.5),
      color,
      drag: 0.4,
      glow: true,
      shape: 'dot',
      rot: 0,
      vr: 0,
    });
  }
}

// An expanding shockwave ring (boss deaths, dash landings, bomb pickups).
export function ring(fx, x, y, color, maxR = 130, width = 3, life = 0.45) {
  if (fx.rings.length >= MAX_RINGS) fx.rings.shift();
  fx.rings.push({ x, y, r: 6, maxR, width, color, life, maxLife: life });
}

// A floating score / event label that rises and fades.
export function floatText(fx, x, y, text, color = '#ffffff', size = 15) {
  if (fx.texts.length >= MAX_TEXTS) fx.texts.shift();
  fx.texts.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9, vy: -56 });
}

// A fading silhouette of the player ship, laid down while dashing.
export function ghost(fx, x, y, angle, color) {
  if (fx.ghosts.length >= MAX_GHOSTS) fx.ghosts.shift();
  fx.ghosts.push({ x, y, angle, color, life: 0.28, maxLife: 0.28 });
}

export function addShake(fx, amount) {
  fx.shake = Math.min(22, fx.shake + amount);
}

export function flash(fx, color, strength = 0.35) {
  fx.flashColor = color;
  fx.flash = Math.max(fx.flash, strength);
}

// Advance every effect by dt seconds. Called once per simulation step.
export function updateFx(fx, dt) {
  const ps = fx.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life -= dt;
    if (p.life <= 0) {
      ps.splice(i, 1);
      continue;
    }
    const dragK = Math.max(0, 1 - p.drag * dt);
    p.vx *= dragK;
    p.vy *= dragK;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
  for (let i = fx.rings.length - 1; i >= 0; i--) {
    const r = fx.rings[i];
    r.life -= dt;
    if (r.life <= 0) {
      fx.rings.splice(i, 1);
      continue;
    }
    const t = 1 - r.life / r.maxLife;
    r.r = 6 + (r.maxR - 6) * (1 - Math.pow(1 - t, 3));
  }
  for (let i = fx.texts.length - 1; i >= 0; i--) {
    const t = fx.texts[i];
    t.life -= dt;
    if (t.life <= 0) {
      fx.texts.splice(i, 1);
      continue;
    }
    t.y += t.vy * dt;
    t.vy *= 1 - 1.8 * dt;
  }
  for (let i = fx.ghosts.length - 1; i >= 0; i--) {
    fx.ghosts[i].life -= dt;
    if (fx.ghosts[i].life <= 0) fx.ghosts.splice(i, 1);
  }
  fx.shake = Math.max(0, fx.shake - dt * 46);
  fx.flash = Math.max(0, fx.flash - dt * 2.6);
  fx.slowmo = Math.max(0, fx.slowmo - dt);
}

// --- painting ---------------------------------------------------------------

// Ghosts are drawn by render.js with the ship painter; here we only expose
// the alpha a ghost should be drawn at.
export function ghostAlpha(g) {
  return clamp(g.life / g.maxLife, 0, 1) * 0.5;
}

export function drawParticles(ctx, fx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of fx.particles) {
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    if (p.shape === 'shard') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const s = p.size * (0.4 + 0.6 * a);
      ctx.fillRect(-s, -s * 0.36, s * 2, s * 0.72);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * a), 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawRings(ctx, fx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const r of fx.rings) {
    const a = clamp(r.life / r.maxLife, 0, 1);
    ctx.globalAlpha = a * 0.8;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.width * a + 0.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawTexts(ctx, fx) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of fx.texts) {
    const a = clamp(t.life / t.maxLife, 0, 1);
    ctx.globalAlpha = Math.min(1, a * 1.6);
    ctx.font = `700 ${t.size}px "Segoe UI", Arial, sans-serif`;
    ctx.fillStyle = t.color;
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 8;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}
