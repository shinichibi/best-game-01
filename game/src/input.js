// Keyboard and mouse state, sampled by the simulation once per fixed step.
// The game reads intent from here (move axes, aim point, fire and dash edges)
// instead of touching DOM events inside its update code.

export const input = {
  keys: new Set(),
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
  dashPressed: false,
  pausePressed: false,
  confirmPressed: false,
};

const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight',
]);

export function attachInput(canvas, toWorld) {
  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    input.keys.add(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') input.dashPressed = true;
    if (e.code === 'KeyP' || e.code === 'Escape') input.pausePressed = true;
    if (e.code === 'Enter' || e.code === 'KeyR') input.confirmPressed = true;
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });
  const move = (e) => {
    const p = toWorld(e.clientX, e.clientY);
    input.mouseX = p.x;
    input.mouseY = p.y;
  };
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerdown', (e) => {
    move(e);
    if (e.button === 0) input.mouseDown = true;
    if (e.button === 2) input.dashPressed = true;
  });
  window.addEventListener('pointerup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function moveAxes() {
  const k = input.keys;
  let x = 0;
  let y = 0;
  if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
  if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
  if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = Math.SQRT1_2;
    x *= inv;
    y *= inv;
  }
  return { x, y };
}

// Edge-triggered reads: each returns true once per press, then clears itself.
export function takeDash() {
  const v = input.dashPressed;
  input.dashPressed = false;
  return v;
}
export function takePause() {
  const v = input.pausePressed;
  input.pausePressed = false;
  return v;
}
export function takeConfirm() {
  const v = input.confirmPressed;
  input.confirmPressed = false;
  return v;
}
