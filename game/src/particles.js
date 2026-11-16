// Pooled visual feedback: sparks, explosion bursts, shockwave rings, dash trails
// and floating score text. Everything is pre-allocated and recycled, so a busy
// wave never allocates in the hot loop — effects are decoration only and never
// touch the simulation's outcome.

const MAX_PARTICLES = 700;
const MAX_TEXTS = 24;

export function makeEffects() {
  return {
    parts: [],
    rings: [],
    texts: [],
    burst(x, y, color, n, speed, life, size) {
      for (let i = 0; i < n; i++) {
        if (this.parts.length >= MAX_PARTICLES) return;
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.25 + Math.random() * 0.95);
        this.parts.push({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: life * (0.5 + Math.random() * 0.8),
          age: 0,
          size: size * (0.6 + Math.random() * 0.8),
          color,
        });
      }
    },
    ring(x, y, color, maxR, life) {
      this.rings.push({ x, y, color, maxR, life, age: 0 });
    },
    trail(x, y, color, size) {
      if (this.parts.length >= MAX_PARTICLES) return;
      this.parts.push({ x, y, vx: 0, vy: 0, life: 0.3, age: 0, size, color });
    },
    text(x, y, str, color) {
      if (this.texts.length >= MAX_TEXTS) this.texts.shift();
      this.texts.push({ x, y, str, color, age: 0, life: 0.9 });
    },
    update(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.age += dt;
        if (p.age >= p.life) {
          this.parts.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - 3.2 * dt;
        p.vy *= 1 - 3.2 * dt;
      }
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.age += dt;
        if (r.age >= r.life) this.rings.splice(i, 1);
      }
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.age += dt;
        t.y -= 34 * dt;
        if (t.age >= t.life) this.texts.splice(i, 1);
      }
    },
    draw(ctx) {
      for (const r of this.rings) {
        const k = r.age / r.life;
        ctx.globalAlpha = (1 - k) * 0.7;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.maxR * (0.2 + 0.8 * k), 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const p of this.parts) {
        const k = 1 - p.age / p.life;
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * k + 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const t of this.texts) {
        ctx.globalAlpha = 1 - t.age / t.life;
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    },
  };
}
