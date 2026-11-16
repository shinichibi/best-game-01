// The upgrade draft: between waves the player picks one of three. Each entry is
// data plus an apply function; the draft only offers upgrades the player has not
// maxed, so a long run keeps presenting real choices instead of dead cards.

export const UPGRADES = [
  {
    id: 'rapid', name: 'Rapid Cycler', max: 4, color: '#40e0ff',
    desc: 'Fire 18% faster.',
    apply(s) { s.upgrades.fireRateMul *= 1.18; },
  },
  {
    id: 'heavy', name: 'Heavy Rounds', max: 4, color: '#ff7847',
    desc: 'Shots deal 22% more damage.',
    apply(s) { s.upgrades.damageMul *= 1.22; },
  },
  {
    id: 'twin', name: 'Split Cannon', max: 2, color: '#ffe74a',
    desc: 'Fire one extra projectile per shot.',
    apply(s) { s.upgrades.extraCannons += 1; },
  },
  {
    id: 'pierce', name: 'Lance Rounds', max: 2, color: '#b78bff',
    desc: 'Shots pierce through one more enemy.',
    apply(s) { s.upgrades.pierce += 1; },
  },
  {
    id: 'thrusters', name: 'Swift Thrusters', max: 3, color: '#52ffa8',
    desc: 'Move 9% faster.',
    apply(s) { s.upgrades.speedMul *= 1.09; },
  },
  {
    id: 'dash', name: 'Phase Recharge', max: 3, color: '#7af2ff',
    desc: 'Dash recharges 25% faster.',
    apply(s) { s.upgrades.dashRecharge *= 0.75; },
  },
  {
    id: 'plating', name: 'Aegis Plating', max: 4, color: '#ff5d7a',
    desc: '+25 max hull, and repair 25 now.',
    apply(s) {
      s.player.maxHull += 25;
      s.player.hull = Math.min(s.player.maxHull, s.player.hull + 25);
    },
  },
  {
    id: 'regen', name: 'Repair Nanites', max: 3, color: '#8fff6e',
    desc: 'Regenerate 0.8 hull per second.',
    apply(s) { s.player.regen += 0.8; },
  },
  {
    id: 'magnet', name: 'Tractor Coil', max: 2, color: '#ffd24a',
    desc: 'Pickup magnet range up 60%.',
    apply(s) { s.upgrades.magnetMul *= 1.6; },
  },
  {
    id: 'calibre', name: 'Calibre Rounds', max: 2, color: '#ff9de2',
    desc: 'Bigger shots that hit 10% harder.',
    apply(s) {
      s.upgrades.bulletSize += 1.6;
      s.upgrades.damageMul *= 1.1;
    },
  },
];

export function freshUpgradeState() {
  return {
    counts: {},
    fireRateMul: 1,
    damageMul: 1,
    extraCannons: 0,
    pierce: 0,
    speedMul: 1,
    dashRecharge: 1,
    magnetMul: 1,
    bulletSize: 0,
  };
}

export function draftChoices(state) {
  const open = UPGRADES.filter((u) => (state.upgrades.counts[u.id] || 0) < u.max);
  const picks = [];
  const pool = [...open];
  while (picks.length < 3 && pool.length > 0) {
    const i = Math.floor(state.rng() * pool.length);
    picks.push(pool.splice(i, 1)[0]);
  }
  return picks;
}

export function applyUpgrade(state, id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return;
  state.upgrades.counts[id] = (state.upgrades.counts[id] || 0) + 1;
  u.apply(state);
}
