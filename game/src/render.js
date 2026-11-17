// render.js — everything PRISM BREAK v2 paints that is the world itself:
// the parallax starfield and perspective grid, the arena frame, pickups,
// the player ship with its dash ghosts, every enemy silhouette and the
// Grand Prism boss. HUD and screens live in ui.js; effects in particles.js.
// All art is vector shapes drawn in code — there are no image assets.

import { ARENA_W, ARENA_H, WALL, PALETTE, TAU, clamp, makeRng } from './util.js';
import { ENEMY_TYPES } from './enemies.js';
import { drawParticles, drawRings, drawTexts, ghostAlpha } from './particles.js';
import { pickupInfo } from './weapons.js';

// The starfield is generated once from a fixed seed: two depth layers of
// stars plus a few soft nebula blobs, all drifting at different rates.
export function createBackground() {
  const rng = makeRng(20261);
  const stars = [];
  for (let i = 0; i < 170; i++) {
    stars.push({
      x: rng() * ARENA_W,
      y: rng() * ARENA_H,
      z: rng() < 0.6 ? 0.35 : 1, // parallax depth
      r: 0.6 + rng() * 1.5,
      tw: rng() * TAU,
    });
  }
  const nebulae = [];
  const hues = ['rgba(64,40,140,', 'rgba(16,80,110,', 'rgba(120,24,80,', 'rgba(20,60,140,'];
  for (let i = 0; i < 5; i++) {
    nebulae.push({
      x: rng() * ARENA_W,
      y: rng() * ARENA_H * 0.8,
      r: 180 + rng() * 260,
      color: hues[i % hues.length],
    });
  }
  return { stars, nebulae };
}

function drawBackground(ctx, bg, time) {
  const g = ctx.createLinearGradient(0, 0, 0, ARENA_H);
  g.addColorStop(0, '#070818');
  g.addColorStop(0.55, '#0a0a24');
  g.addColorStop(1, '#120826');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  // Nebula washes.
  for (const n of bg.nebulae) {
    const rg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    rg.addColorStop(0, n.color + '0.20)');
    rg.addColorStop(1, n.color + '0)');
    ctx.fillStyle = rg;
    ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
  }

  drawPerspectiveGrid(ctx, time);

  // Stars, twinkling and drifting with parallax.
  ctx.save();
  for (const s of bg.stars) {
    const drift = (time * 6 * s.z) % (ARENA_H + 8);
    const y = (s.y + drift) % (ARENA_H + 8) - 4;
    const a = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(time * 1.7 + s.tw));
    ctx.globalAlpha = a * s.z;
    ctx.fillStyle = '#cfe9ff';
    ctx.fillRect(s.x, y, s.r, s.r);
  }
  ctx.restore();
}

// A synthwave floor: lines converge to a horizon above the arena's middle
// and the cross-lines scroll toward the viewer, selling the 3D depth the
// top-down action floats over.
function drawPerspectiveGrid(ctx, time) {
  const horizon = ARENA_H * 0.34;
  const vanishX = ARENA_W / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(90,60,200,0.30)';
  ctx.lineWidth = 1;
  // Verticals fanning from the vanishing point.
  for (let i = -10; i <= 10; i++) {
    ctx.beginPath();
    ctx.moveTo(vanishX, horizon);
    ctx.lineTo(vanishX + i * 190, ARENA_H + 40);
    ctx.stroke();
  }
  // Horizontals with exponential spacing, scrolling.
  const scroll = (time * 0.55) % 1;
  for (let i = 0; i < 12; i++) {
    const t = (i + scroll) / 12;
    const y = horizon + Math.pow(t, 2.4) * (ARENA_H - horizon + 30);
    ctx.globalAlpha = 0.1 + t * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ARENA_W, y);
    ctx.stroke();
  }
  ctx.restore();
  // Horizon glow line.
  const hg = ctx.createLinearGradient(0, horizon - 26, 0, horizon + 30);
  hg.addColorStop(0, 'rgba(255,61,138,0)');
  hg.addColorStop(0.5, 'rgba(255,61,138,0.13)');
  hg.addColorStop(1, 'rgba(255,61,138,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, horizon - 26, ARENA_W, 56);
}

function drawArenaFrame(ctx, time) {
  const pulse = 0.65 + 0.35 * Math.sin(time * 2.2);
  ctx.save();
  ctx.strokeStyle = `rgba(57,230,255,${0.5 + 0.3 * pulse})`;
  ctx.lineWidth = 2;
  ctx.shadowColor = '#39e6ff';
  ctx.shadowBlur = 12;
  ctx.strokeRect(WALL - 8, WALL - 8, ARENA_W - (WALL - 8) * 2, ARENA_H - (WALL - 8) * 2);
  ctx.strokeStyle = 'rgba(255,61,138,0.35)';
  ctx.shadowColor = '#ff3d8a';
  ctx.strokeRect(WALL - 13, WALL - 13, ARENA_W - (WALL - 13) * 2, ARENA_H - (WALL - 13) * 2);
  ctx.restore();
  // Corner brackets.
  ctx.save();
  ctx.strokeStyle = '#eaffff';
  ctx.lineWidth = 3;
  const c = 22;
  const x0 = WALL - 13;
  const y0 = WALL - 13;
  const x1 = ARENA_W - WALL + 13;
  const y1 = ARENA_H - WALL + 13;
  for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * c, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * c);
    ctx.stroke();
  }
  ctx.restore();
}

// --- entities -----------------------------------------------------------------

export function drawShip(ctx, x, y, angle, color, alpha = 1, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(19, 0);
  ctx.lineTo(-13, -11);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-13, 11);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#eaffff';
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-5, -5.5);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-5, 5.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (!p.alive) return;
  // Invulnerability blink: the ship strobes while it cannot be hurt.
  if (p.invulnT > 0 && p.dashT <= 0 && Math.floor(state.time * 18) % 2 === 0) {
    // draw at reduced alpha below
  }
  const alpha = p.invulnT > 0 && p.dashT <= 0 ? (Math.floor(state.time * 18) % 2 === 0 ? 0.35 : 0.85) : 1;
  // Engine flame, flickering behind the hull.
  const flame = 8 + Math.sin(state.time * 42) * 3 + Math.hypot(p.vx, p.vy) * 0.012;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,160,60,0.75)';
  ctx.beginPath();
  ctx.moveTo(-12, -4);
  ctx.lineTo(-12 - flame, 0);
  ctx.lineTo(-12, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Recoil pushes the drawn ship back a touch opposite its aim.
  const rx = p.x - Math.cos(p.angle) * p.recoil * 0.7;
  const ry = p.y - Math.sin(p.angle) * p.recoil * 0.7;
  drawShip(ctx, rx, ry, p.angle, PALETTE.player, alpha);
  // Aim pip.
  ctx.save();
  ctx.strokeStyle = 'rgba(234,255,255,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30, 3.4, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function poly(ctx, x, y, r, sides, rot) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawEnemyBody(ctx, e) {
  const base = ENEMY_TYPES[e.kind];
  const color = e.flash > 0.4 ? '#ffffff' : e.tint || base.color;
  const spawnScale = e.spawnT > 0 ? 1 - (e.spawnT / 0.45) * 0.6 : 1;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(spawnScale, spawnScale);
  ctx.globalAlpha = e.spawnT > 0 ? 0.45 + 0.55 * spawnScale : 1;
  ctx.shadowColor = e.tint || base.color;
  ctx.shadowBlur = 13;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  switch (e.kind) {
    case 'chaser':
      ctx.rotate(e.angle);
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-12, -12);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, 12);
      ctx.closePath();
      ctx.fill();
      break;
    case 'dart':
      ctx.rotate(e.angle);
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-9, -5);
      ctx.lineTo(-9, 5);
      ctx.closePath();
      ctx.fill();
      if (e.lungeT < 0.25 && e.lunging <= 0) { // telegraph glint
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(10, -1.5, 7, 3);
      }
      break;
    case 'tank': {
      ctx.rotate(e.t * 0.5);
      poly(ctx, 0, 0, e.r, 6, 0);
      ctx.fill();
      ctx.fillStyle = 'rgba(5,6,15,0.55)';
      poly(ctx, 0, 0, e.r * 0.62, 6, 0.4);
      ctx.fill();
      ctx.fillStyle = color;
      poly(ctx, 0, 0, e.r * 0.3, 6, 0.8);
      ctx.fill();
      break;
    }
    case 'orbiter': {
      ctx.rotate(e.t * 2.4);
      poly(ctx, 0, 0, e.r, 4, 0);
      ctx.fill();
      ctx.fillStyle = '#0a0a24';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.42, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 2.6, 0, TAU);
      ctx.fill();
      break;
    }
    case 'weaver':
      ctx.rotate(e.angle);
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-4, -10);
      ctx.lineTo(-13, -3);
      ctx.lineTo(-9, 0);
      ctx.lineTo(-13, 3);
      ctx.lineTo(-4, 10);
      ctx.closePath();
      ctx.fill();
      break;
    case 'splitter': {
      const pulse = 1 + Math.sin(e.t * 3.1 + e.seed) * 0.08;
      ctx.scale(pulse, pulse);
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.72, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-e.r * 0.45, 0, e.r * 0.5, 0, TAU);
      ctx.arc(e.r * 0.45, 0, e.r * 0.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(5,6,15,0.5)';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.2, 0, TAU);
      ctx.fill();
      break;
    }
    case 'mite':
      ctx.rotate(e.angle);
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-7, -6);
      ctx.lineTo(-7, 6);
      ctx.closePath();
      ctx.fill();
      break;
    default:
      poly(ctx, 0, 0, e.r, 5, e.angle);
      ctx.fill();
  }
  ctx.restore();
  // Elites wear a thin gold halo so the eye finds them in a swarm.
  if (e.elite) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,215,90,0.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + 5 + Math.sin(e.t * 4) * 1.2, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  // Damage bar on anything tougher than a one-shot.
  if (e.maxHp >= 5 && e.hp < e.maxHp && e.kind !== 'boss') {
    const w = e.r * 1.7;
    ctx.save();
    ctx.fillStyle = 'rgba(10,10,30,0.7)';
    ctx.fillRect(e.x - w / 2, e.y - e.r - 11, w, 4);
    ctx.fillStyle = base.color;
    ctx.fillRect(e.x - w / 2, e.y - e.r - 11, w * clamp(e.hp / e.maxHp, 0, 1), 4);
    ctx.restore();
  }
}

// The Grand Prism: three counter-rotating prism shells around a pulsing
// core, with six orbiting shards — a boss that reads as a machine of glass.
function drawBoss(ctx, e, time) {
  const color = e.flash > 0.4 ? '#ffffff' : PALETTE.boss;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.shadowColor = PALETTE.boss;
  ctx.shadowBlur = 26;
  // Outer shell: two counter-rotating triangles.
  for (const [rot, r, alpha] of [[e.angle, e.r, 0.9], [-e.angle * 0.7, e.r * 0.8, 0.65]]) {
    ctx.save();
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    poly(ctx, 0, 0, r, 3, 0);
    ctx.stroke();
    ctx.restore();
  }
  // Middle hexagon.
  ctx.save();
  ctx.rotate(e.angle * 0.45);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = color;
  poly(ctx, 0, 0, e.r * 0.52, 6, 0);
  ctx.fill();
  ctx.restore();
  // Orbiting shards.
  ctx.fillStyle = '#ffd7e6';
  for (let i = 0; i < 6; i++) {
    const a = e.angle * 1.3 + (i / 6) * TAU;
    const ox = Math.cos(a) * e.r * 0.92;
    const oy = Math.sin(a) * e.r * 0.92;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(a + time * 2);
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }
  // Core: pulsing white-hot heart.
  const pulse = 1 + Math.sin(time * 5) * 0.16;
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 11 * pulse, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PALETTE.boss;
  ctx.beginPath();
  ctx.arc(0, 0, 6.5 * pulse, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPickup(ctx, pk, time) {
  const info = pickupInfo(pk.kind);
  const bob = Math.sin(time * 4 + pk.x * 0.05) * 3;
  const blink = pk.life < 2.5 ? (Math.floor(time * 9) % 2 === 0 ? 0.35 : 1) : 1;
  ctx.save();
  ctx.translate(pk.x, pk.y + bob);
  ctx.globalAlpha = blink;
  ctx.shadowColor = info.color;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = info.color;
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(8,10,26,0.85)';
  const s = 13;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s, 0);
  ctx.lineTo(0, s);
  ctx.lineTo(-s, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = info.color;
  ctx.font = '900 13px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pk.kind === 'heart' ? '+' : pk.kind === 'gem' ? '◆' : '▲', 0, 1);
  ctx.restore();
}

function drawBullets(ctx, state) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of state.bullets) {
    ctx.strokeStyle = b.color;
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 9;
    if (b.kind === 'rail') {
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.4, 0, TAU);
      ctx.fill();
    } else {
      const stretch = b.kind === 'seeker' ? 0.012 : 0.016;
      ctx.lineWidth = b.r * 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * stretch, b.y - b.vy * stretch);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU);
      ctx.fill();
    }
  }
  // Enemy bolts: soft pink orbs with a white heart — readable as danger.
  for (const b of state.enemyBullets) {
    ctx.fillStyle = PALETTE.enemyBullet;
    ctx.shadowColor = '#ff5a7a';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// The full world pass. Camera shake is applied here, around the world only.
export function drawScene(ctx, state, bg) {
  ctx.save();
  if (state.fx.shake > 0.2) {
    const s = state.fx.shake;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawBackground(ctx, bg, state.time);
  drawArenaFrame(ctx, state.time);
  drawRings(ctx, state.fx);
  for (const pk of state.pickups) drawPickup(ctx, pk, state.time);
  // Dash ghosts under everything else.
  for (const g of state.fx.ghosts) {
    drawShip(ctx, g.x, g.y, g.angle, g.color, ghostAlpha(g), 0.96);
  }
  for (const e of state.enemies) {
    if (e.kind === 'boss') drawBoss(ctx, e, state.time);
    else drawEnemyBody(ctx, e);
  }
  drawPlayer(ctx, state);
  drawBullets(ctx, state);
  drawParticles(ctx, state.fx);
  drawTexts(ctx, state.fx);
  ctx.restore();
  // Full-screen flash (hurt red, boss white) over the world.
  if (state.fx.flash > 0.01) {
    ctx.save();
    ctx.globalAlpha = state.fx.flash;
    ctx.fillStyle = state.fx.flashColor;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    ctx.restore();
  }
}
