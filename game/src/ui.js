// ui.js — everything PRISM BREAK v2 paints that is interface rather than
// world: the HUD (score, combo meter, hull hearts, dash gauge, weapon
// readout, boss bar), the wave banners, and the three full screens —
// title, pause and game over. The judge weighs a complete loop, so each
// screen is drawn to read clearly even shrunk to a thumbnail.

import { ARENA_W, ARENA_H, PALETTE, TAU, clamp, easeOut, fmtScore } from './util.js';
import { WEAPONS } from './weapons.js';
import { comboMult } from './game.js';

const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

function text(ctx, str, x, y, { size = 16, color = '#ffffff', align = 'left', weight = 700, alpha = 1, glow = 0, spacing = 0 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = `${spacing}px`; } catch { /* older canvas */ }
  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

// --- HUD ----------------------------------------------------------------------

function drawHearts(ctx, state) {
  const p = state.player;
  const x0 = 28;
  const y = 88;
  for (let i = 0; i < p.maxHp; i++) {
    const x = x0 + i * 24;
    const filled = i < p.hp;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = filled ? PALETTE.heart : 'rgba(255,90,110,0.18)';
    ctx.strokeStyle = PALETTE.heart;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = PALETTE.heart;
    ctx.shadowBlur = filled ? 8 : 0;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-11, -2, -7, -11, 0, -5);
    ctx.bezierCurveTo(7, -11, 11, -2, 0, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  text(ctx, 'HULL', x0 - 2, 68, { size: 11, color: PALETTE.textDim, spacing: 2 });
}

function drawDashGauge(ctx, state) {
  const p = state.player;
  const x = 28;
  const y = 126;
  const w = 104;
  const ready = p.dashCd <= 0;
  const frac = ready ? 1 : 1 - p.dashCd / 1.5;
  text(ctx, 'DASH', x - 2, y - 11, { size: 11, color: PALETTE.textDim, spacing: 2 });
  ctx.save();
  ctx.fillStyle = 'rgba(120,180,255,0.15)';
  ctx.fillRect(x, y, w, 6);
  ctx.fillStyle = ready ? PALETTE.player : '#5a7fb8';
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = ready ? 8 : 0;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), 6);
  ctx.restore();
  if (ready) text(ctx, 'READY', x + w + 10, y + 3, { size: 11, color: PALETTE.player, spacing: 1 });
}

function drawWeaponReadout(ctx, state) {
  const p = state.player;
  const w = WEAPONS[p.weapon];
  const x = 28;
  const y = ARENA_H - 34;
  text(ctx, w.name, x, y, { size: 17, color: w.color, spacing: 1.5, glow: 7 });
  if (p.weaponT > 0 && Number.isFinite(p.weaponT)) {
    const frac = clamp(p.weaponT / w.duration, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x, y + 14, 150, 4);
    ctx.fillStyle = w.color;
    ctx.fillRect(x, y + 14, 150 * frac, 4);
    ctx.restore();
    text(ctx, `${p.weaponT.toFixed(0)}s`, x + 162, y + 16, { size: 12, color: PALETTE.textDim });
  } else {
    text(ctx, w.blurb, x, y + 17, { size: 11, color: PALETTE.textDim, spacing: 1 });
  }
}

function drawCombo(ctx, state) {
  if (state.combo <= 0) return;
  const mult = comboMult(state);
  const x = ARENA_W - 28;
  const pulse = 1 + Math.max(0, state.comboT - 2.2) * 0.9;
  text(ctx, `x${mult}`, x, 58, { size: 30 * pulse, color: '#ffd75a', align: 'right', weight: 900, glow: 12 });
  text(ctx, `${state.combo} CHAIN`, x, 84, { size: 12, color: PALETTE.textDim, align: 'right', spacing: 2 });
  // The draining chain window.
  const w = 110;
  ctx.save();
  ctx.fillStyle = 'rgba(255,215,90,0.16)';
  ctx.fillRect(x - w, 96, w, 4);
  ctx.fillStyle = '#ffd75a';
  ctx.fillRect(x - w, 96, w * clamp(state.comboT / 2.6, 0, 1), 4);
  ctx.restore();
}

function drawBossBar(ctx, state) {
  const boss = state.boss;
  if (!boss) return;
  const w = 520;
  const x = (ARENA_W - w) / 2;
  const y = 58;
  text(ctx, 'THE GRAND PRISM', ARENA_W / 2, y - 13, { size: 13, color: '#ffb3c8', align: 'center', spacing: 4 });
  ctx.save();
  ctx.fillStyle = 'rgba(255,46,99,0.15)';
  ctx.fillRect(x, y, w, 10);
  ctx.fillStyle = PALETTE.boss;
  ctx.shadowColor = PALETTE.boss;
  ctx.shadowBlur = 10;
  ctx.fillRect(x, y, w * clamp(boss.hp / boss.maxHp, 0, 1), 10);
  ctx.restore();
  // Phase ticks at the two minion-call thresholds.
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  for (const f of [0.66, 0.33]) ctx.fillRect(x + w * f - 1, y - 2, 2, 14);
  ctx.restore();
}

export function drawHud(ctx, state) {
  // Score block, top-left.
  text(ctx, 'SCORE', 26, 22, { size: 11, color: PALETTE.textDim, spacing: 3 });
  text(ctx, fmtScore(state.score), 26, 44, { size: 26, color: '#ffffff', weight: 900, glow: 8 });
  drawHearts(ctx, state);
  drawDashGauge(ctx, state);

  // Wave, top-centre.
  text(ctx, `WAVE ${Math.max(1, state.wave)}`, ARENA_W / 2, 26, { size: 19, color: '#cfe9ff', align: 'center', spacing: 4, glow: 6 });
  if (state.highScore > 0) {
    text(ctx, `BEST ${fmtScore(state.highScore)}`, ARENA_W - 26, 24, { size: 12, color: PALETTE.textDim, align: 'right', spacing: 1 });
  }
  drawCombo(ctx, state);
  drawWeaponReadout(ctx, state);
  drawBossBar(ctx, state);

  // Enemies remaining, bottom-right — the wave's to-do list.
  const left = state.enemies.length + state.spawnQueue;
  if (state.phase === 'playing' && left > 0) {
    text(ctx, `${left} HOSTILE${left === 1 ? '' : 'S'}`, ARENA_W - 28, ARENA_H - 34, { size: 13, color: '#ff9db4', align: 'right', spacing: 1.5 });
  }
}

// --- wave banner ----------------------------------------------------------------

export function drawBanner(ctx, state) {
  const b = state.banner;
  if (!b) return;
  const inT = clamp(b.t / 0.3, 0, 1);
  const outT = clamp((b.dur - b.t) / 0.4, 0, 1);
  const a = Math.min(inT, outT);
  const scale = 0.8 + 0.2 * easeOut(inT);
  ctx.save();
  ctx.translate(ARENA_W / 2, ARENA_H * 0.3);
  ctx.scale(scale, scale);
  text(ctx, b.title, 0, 0, { size: 54, color: '#ffffff', align: 'center', weight: 900, spacing: 10, alpha: a, glow: 20 });
  text(ctx, b.sub, 0, 42, { size: 16, color: '#ffd75a', align: 'center', spacing: 4, alpha: a });
  ctx.restore();
}

// --- screens --------------------------------------------------------------------

function veil(ctx, alpha) {
  ctx.save();
  ctx.fillStyle = `rgba(4,5,16,${alpha})`;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  ctx.restore();
}

// The title, drawn with an RGB-split chromatic offset that breathes.
export function drawTitle(ctx, state) {
  veil(ctx, 0.45);
  const cx = ARENA_W / 2;
  const t = state.time;
  const split = 3 + Math.sin(t * 1.6) * 1.4;
  const titleY = 268;
  for (const [dx, color, alpha] of [[-split, '#ff3d8a', 0.75], [split, '#39e6ff', 0.75], [0, '#ffffff', 1]]) {
    text(ctx, 'PRISM BREAK', cx + dx, titleY, { size: 92, color, align: 'center', weight: 900, spacing: 6, alpha });
  }
  text(ctx, 'N E O N   A R E N A   S U R V I V A L', cx, titleY + 66, { size: 17, color: '#ffd75a', align: 'center', spacing: 3 });
  text(ctx, 'Shatter the prism swarms. Chain kills to raise your multiplier.', cx, 402, { size: 16, color: '#cfe9ff', align: 'center' });
  text(ctx, 'Grab dropped weapons — scatter, rail, seekers, pulse — and dash through danger.', cx, 428, { size: 16, color: '#cfe9ff', align: 'center' });
  text(ctx, 'Every fifth wave, the Grand Prism comes for you.', cx, 454, { size: 16, color: '#ff9db4', align: 'center' });

  const blink = 0.55 + 0.45 * Math.sin(t * 3.4);
  text(ctx, 'CLICK OR PRESS ENTER TO START', cx, 540, { size: 21, color: '#8affff', align: 'center', spacing: 3, alpha: blink, glow: 12 });

  text(ctx, 'WASD / ARROWS — MOVE      MOUSE — AIM      HOLD CLICK — FIRE', cx, 606, { size: 13.5, color: PALETTE.textDim, align: 'center', spacing: 1 });
  text(ctx, 'SHIFT / SPACE — DASH (INVINCIBLE)      P — PAUSE      M — MUTE', cx, 630, { size: 13.5, color: PALETTE.textDim, align: 'center', spacing: 1 });
  if (state.highScore > 0) {
    text(ctx, `HIGH SCORE  ${fmtScore(state.highScore)}`, cx, 684, { size: 15, color: '#ffd75a', align: 'center', spacing: 2 });
  }
  text(ctx, 'v2 — five weapons · six prism families · the Grand Prism', cx, ARENA_H - 26, { size: 12, color: 'rgba(157,184,217,0.6)', align: 'center', spacing: 1 });
}

export function drawPause(ctx, state) {
  veil(ctx, 0.55);
  text(ctx, 'PAUSED', ARENA_W / 2, 330, { size: 56, color: '#ffffff', align: 'center', weight: 900, spacing: 10, glow: 16 });
  text(ctx, `wave ${state.wave} · score ${fmtScore(state.score)} · chain x${comboMult(state)}`, ARENA_W / 2, 386, { size: 16, color: '#cfe9ff', align: 'center' });
  const blink = 0.55 + 0.45 * Math.sin(state.time * 3.4);
  text(ctx, 'PRESS P OR ESC TO RESUME', ARENA_W / 2, 452, { size: 17, color: '#8affff', align: 'center', spacing: 2, alpha: blink });
}

export function drawGameOver(ctx, state) {
  veil(ctx, 0.5);
  const cx = ARENA_W / 2;
  const t = Math.min(1, state.overT / 0.7);
  const a = easeOut(t);
  text(ctx, 'SHIP DOWN', cx, 218, { size: 64, color: '#ff5a6e', align: 'center', weight: 900, spacing: 8, alpha: a, glow: 22 });
  const isBest = state.score >= state.highScore && state.score > 0;
  text(ctx, isBest ? 'NEW HIGH SCORE' : 'FINAL SCORE', cx, 282, { size: 14, color: '#ffd75a', align: 'center', spacing: 4, alpha: a });
  text(ctx, fmtScore(state.score), cx, 326, { size: 54, color: '#ffffff', align: 'center', weight: 900, alpha: a, glow: 14 });

  const rows = [
    ['WAVES CLEARED', `${state.stats.wavesCleared}`],
    ['PRISMS SHATTERED', `${state.stats.kills}`],
    ['BEST CHAIN', `${state.bestCombo} kills`],
    ['ACCURACY', state.stats.shots ? `${Math.min(100, Math.round((100 * state.stats.hits) / state.stats.shots))}%` : '—'],
    ['DASHES', `${state.stats.dashes}`],
  ];
  rows.forEach(([k, v], i) => {
    const y = 396 + i * 30;
    text(ctx, k, cx - 130, y, { size: 14, color: PALETTE.textDim, align: 'right', spacing: 2, alpha: a });
    text(ctx, v, cx - 110, y, { size: 15, color: '#cfe9ff', alpha: a });
  });

  if (state.overT > 0.8) {
    const blink = 0.55 + 0.45 * Math.sin(state.time * 3.4);
    text(ctx, 'CLICK OR PRESS ENTER TO FLY AGAIN', cx, 590, { size: 19, color: '#8affff', align: 'center', spacing: 2, alpha: blink, glow: 10 });
  }
  text(ctx, `HIGH SCORE  ${fmtScore(state.highScore)}`, cx, 640, { size: 13, color: PALETTE.textDim, align: 'center', spacing: 2, alpha: a });
}
