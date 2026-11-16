// All canvas drawing: the arena, starfield, every actor's polygon, telegraphs,
// the boss bar and the wave banner. Pure presentation — it reads the state the
// simulation wrote and never feeds anything back into it.

import { ARENA, PALETTE } from './config.js';
import { makeRng } from './rng.js';

let stars = null;
function starfield() {
  if (stars) return stars;
  const rng = makeRng(20261);
  stars = [];
  for (let i = 0; i < 130; i++) {
    stars.push({ x: rng() * ARENA.w, y: rng() * ARENA.h, r: rng() * 1.6 + 0.4, a: 0.25 + rng() * 0.6 });
  }
  return stars;
}

function poly(ctx, x, y, r, sides, rot) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawEnemy(ctx, e, time) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = e.color;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.4;
  const r = e.radius;
  switch (e.kind) {
    case 'shard': poly(ctx, 0, 0, r, 3, 0); break;
    case 'mini': poly(ctx, 0, 0, r, 3, 0); break;
    case 'darter': {
      ctx.beginPath();
      ctx.moveTo(r * 1.25, 0);
      ctx.lineTo(0, r * 0.72);
      ctx.lineTo(-r * 1.25, 0);
      ctx.lineTo(0, -r * 0.72);
      ctx.closePath();
      break;
    }
    case 'orbiter': poly(ctx, 0, 0, r, 5, 0); break;
    case 'splitter': poly(ctx, 0, 0, r, 6, 0); break;
    case 'tank': poly(ctx, 0, 0, r * 1.08, 4, Math.PI / 4); break;
    case 'boss': poly(ctx, 0, 0, r, 8, 0); break;
  }
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Inner detail: a darker core that counter-rotates, so each prism reads as a gem.
  ctx.rotate(-e.angle * 2 + time * 0.7);
  ctx.fillStyle = 'rgba(7, 11, 29, 0.55)';
  if (e.kind === 'tank') poly(ctx, 0, 0, r * 0.55, 4, Math.PI / 4);
  else if (e.kind === 'boss') poly(ctx, 0, 0, r * 0.52, 6, 0);
  else poly(ctx, 0, 0, r * 0.45, e.kind === 'orbiter' ? 5 : 3, 0);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, e.kind === 'boss' ? 7 : 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (e.flash > 0) {
    ctx.save();
    ctx.globalAlpha = e.flash * 0.75;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Wounded enemies show a slim health arc.
  if (e.hp < e.maxHp && e.kind !== 'boss') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius + 5, -Math.PI / 2, -Math.PI / 2 + (e.hp / e.maxHp) * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (!p.alive) return;
  if (p.iframes > 0 && p.dashT <= 0 && Math.floor(state.time * 18) % 2 === 0) {
    // blink while invulnerable after a hit (not during a dash)
    ctx.globalAlpha = 0.35;
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > 40) {
    const flame = 10 + Math.sin(state.time * 42) * 4 + speed * 0.02;
    ctx.fillStyle = 'rgba(64, 224, 255, 0.8)';
    ctx.beginPath();
    ctx.moveTo(-12, 4.6);
    ctx.lineTo(-12 - flame, 0);
    ctx.lineTo(-12, -4.6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 16;
  ctx.fillStyle = PALETTE.player;
  ctx.strokeStyle = '#e8fbff';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(17, 0);
  ctx.lineTo(-7, 7.5);
  ctx.lineTo(-13, 12);
  ctx.lineTo(-10, 0);
  ctx.lineTo(-13, -12);
  ctx.lineTo(-7, -7.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.playerCore;
  ctx.beginPath();
  ctx.arc(3, 0, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawPickup(ctx, pk, time) {
  const bob = Math.sin(time * 4 + pk.x * 0.05) * 2;
  ctx.save();
  ctx.translate(pk.x, pk.y + bob);
  if (pk.life < 2 && Math.floor(time * 6) % 2 === 0) ctx.globalAlpha = 0.35;
  if (pk.kind === 'shard') {
    ctx.rotate(time * 2.4);
    ctx.fillStyle = PALETTE.pickupShard;
    ctx.shadowColor = PALETTE.pickupShard;
    ctx.shadowBlur = 10;
    poly(ctx, 0, 0, 6.5, 4, 0);
    ctx.fill();
  } else if (pk.kind === 'heart') {
    ctx.fillStyle = PALETTE.pickupHeart;
    ctx.shadowColor = PALETTE.pickupHeart;
    ctx.shadowBlur = 12;
    const s = 1 + Math.sin(time * 6) * 0.12;
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-13, -2, -8, -11, 0, -5);
    ctx.bezierCurveTo(8, -11, 13, -2, 0, 8);
    ctx.fill();
  } else {
    ctx.fillStyle = PALETTE.pickupNova;
    ctx.shadowColor = PALETTE.pickupNova;
    ctx.shadowBlur = 14;
    poly(ctx, 0, 0, 10, 8, time * 1.8);
    ctx.fill();
    ctx.fillStyle = '#062a33';
    poly(ctx, 0, 0, 4.6, 8, -time * 1.8);
    ctx.fill();
  }
  ctx.restore();
}

export function drawGame(ctx, state) {
  const { w, h } = ARENA;
  // Backdrop.
  const grad = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, 620);
  grad.addColorStop(0, PALETTE.bgGlow);
  grad.addColorStop(1, PALETTE.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  for (const s of starfield()) {
    ctx.globalAlpha = s.a;
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
  // Grid.
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 48; x < w; x += 48) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = 48; y < h; y += 48) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  // Arena frame.
  ctx.strokeStyle = 'rgba(64, 224, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(ARENA.wall, ARENA.wall, w - ARENA.wall * 2, h - ARENA.wall * 2);

  for (const pk of state.pickups) drawPickup(ctx, pk, state.time);

  // Telegraphs under everything else.
  for (const e of state.enemies) {
    const aiming = (e.kind === 'darter' && e.mode === 'aim') || (e.kind === 'boss' && e.mode === 'chargeAim');
    if (aiming && e.aimX !== undefined) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 61, 113, 0.4)';
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + e.aimX * 340, e.y + e.aimY * 340);
      ctx.stroke();
      ctx.restore();
    }
  }

  for (const e of state.enemies) drawEnemy(ctx, e, state.time);

  // Bullets.
  ctx.save();
  ctx.shadowColor = PALETTE.bullet;
  ctx.shadowBlur = 8;
  ctx.fillStyle = PALETTE.bullet;
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowColor = PALETTE.enemyBullet;
  ctx.fillStyle = PALETTE.enemyBullet;
  for (const b of state.enemyBullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  drawPlayer(ctx, state);
  state.fx.draw(ctx);

  // Boss bar.
  if (state.boss && !state.boss.dead) {
    const bw = 420;
    const bx = (w - bw) / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(bx, 26, bw, 9);
    ctx.fillStyle = PALETTE.boss;
    ctx.fillRect(bx, 26, bw * Math.max(0, state.boss.hp / state.boss.maxHp), 9);
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('WARDEN PRISM', w / 2, 20);
  }

  // Wave banner.
  if (state.banner) {
    const b = state.banner;
    const fade = b.t < 0.25 ? b.t / 0.25 : b.t > b.life - 0.5 ? Math.max(0, (b.life - b.t) / 0.5) : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = '800 44px system-ui, sans-serif';
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 22;
    ctx.fillText(b.text, w / 2, h / 2 - 30);
    ctx.shadowBlur = 0;
    if (b.sub) {
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.dim;
      ctx.fillText(b.sub, w / 2, h / 2 + 2);
    }
    ctx.restore();
  }

  // Damage vignette and low-hull pulse.
  const p = state.player;
  const lowHull = p.alive && p.hull / p.maxHull < 0.3 ? (0.3 - p.hull / p.maxHull) * (0.55 + 0.2 * Math.sin(state.time * 6)) : 0;
  const red = Math.max(state.flashRed * 0.4, lowHull);
  if (red > 0.01) {
    const vg = ctx.createRadialGradient(w / 2, h / 2, 190, w / 2, h / 2, 560);
    vg.addColorStop(0, 'rgba(255,30,60,0)');
    vg.addColorStop(1, `rgba(255,30,60,${Math.min(0.5, red)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
}
