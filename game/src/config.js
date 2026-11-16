// PRISM BREAK — shared tuning: arena, palette and every balance number lives here,
// so the rest of the game never hard-codes a value the designer might retune.

export const ARENA = { w: 960, h: 540, wall: 14 };

export const PALETTE = {
  bg: '#070b1d',
  bgGlow: '#0d1440',
  grid: 'rgba(64, 224, 255, 0.07)',
  player: '#40e0ff',
  playerCore: '#e8fbff',
  bullet: '#aef4ff',
  enemyBullet: '#ff5d8f',
  shard: '#ff5d8f',
  darter: '#ffb340',
  orbiter: '#b78bff',
  splitter: '#52ffa8',
  tank: '#ff7847',
  boss: '#ff3d71',
  mini: '#ff8fab',
  pickupShard: '#ffe74a',
  pickupHeart: '#ff5d7a',
  pickupNova: '#7af2ff',
  text: '#dceeff',
  dim: '#7d8fb3',
};

export const PLAYER = {
  radius: 13,
  accel: 2400,
  maxSpeed: 305,
  drag: 6.5,
  hull: 100,
  fireRate: 7.5, // shots per second
  bulletSpeed: 640,
  bulletDamage: 12,
  bulletRadius: 4,
  dashTime: 0.16,
  dashCooldown: 1.6,
  dashSpeed: 1150,
  iframeTime: 0.35,
};

export const WAVES = {
  firstBudget: 7,
  budgetGrowth: 3.5,
  hpGrowth: 0.19, // +19% enemy hull per wave after the first
  speedGrowth: 0.022,
  maxAlive: 26,
  spawnInterval: 0.85,
  bossEvery: 5,
  winWave: 15,
};

export const SCORE = {
  shard: 50,
  darter: 80,
  orbiter: 110,
  splitter: 90,
  mini: 25,
  tank: 220,
  boss: 2500,
  waveClear: 150,
  shardPickup: 15,
};

export const FIXED_STEP = 1 / 60;
