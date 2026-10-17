// Keyboard and touch controls, combined into { throttle, brake, lean }.
const keys = new Set();
const touch = { throttle: false, brake: false, back: false, forward: false };
let onPress = () => {};

const MAP = {
  ArrowUp: 'throttle', KeyW: 'throttle',
  ArrowDown: 'brake', KeyS: 'brake',
  ArrowLeft: 'back', KeyA: 'back',
  ArrowRight: 'forward', KeyD: 'forward',
};

export function setupInput({ onKey } = {}) {
  onPress = onKey ?? onPress;
  const typing = (e) => e.target instanceof HTMLElement && e.target.matches('input, textarea, select');
  addEventListener('keydown', (e) => {
    if (typing(e)) return; // let people type their rider name
    if (MAP[e.code]) {
      keys.add(MAP[e.code]);
      e.preventDefault();
    }
    if (!e.repeat) onPress(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(MAP[e.code]));
  addEventListener('blur', () => {
    keys.clear();
    for (const k in touch) touch[k] = false;
  });

  // Touch buttons: data-control="throttle|brake|back|forward".
  for (const el of document.querySelectorAll('[data-control]')) {
    const name = el.dataset.control;
    const set = (on) => (e) => {
      e.preventDefault();
      touch[name] = on;
      el.classList.toggle('down', on);
    };
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture?.(e.pointerId);
      set(true)(e);
    });
    el.addEventListener('pointerup', set(false));
    el.addEventListener('pointercancel', set(false));
    el.addEventListener('lostpointercapture', set(false));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}

// ---------- gamepads ----------
// Standard layout: A / right trigger ride, B / left trigger brake, left stick or D-pad lean,
// Start pause (and confirm on menus), Y back to checkpoint, Back/Select restart.
const pad = { throttle: false, brake: false, lean: 0, connected: false };
const was = {};
const PRESS = { 9: 'Escape', 0: 'Enter', 3: 'KeyR', 8: 'KeyT' };

// Call once per frame: reads the first gamepad and turns button presses into key codes.
export function pollGamepad() {
  const gp = [...(navigator.getGamepads?.() ?? [])].find((g) => g && g.connected);
  pad.connected = !!gp;
  if (!gp) {
    pad.throttle = pad.brake = false;
    pad.lean = 0;
    return;
  }
  const b = (i) => gp.buttons[i]?.pressed || (gp.buttons[i]?.value ?? 0) > 0.4;
  pad.throttle = b(0) || b(7);
  pad.brake = b(1) || b(6);
  const stick = Math.abs(gp.axes[0] ?? 0) > 0.3 ? gp.axes[0] : 0;
  pad.lean = (b(14) ? 1 : 0) - (b(15) ? 1 : 0) || -Math.sign(stick);
  for (const [i, code] of Object.entries(PRESS)) {
    const down = b(+i);
    if (down && !was[i]) onPress(code, 'pad');
    was[i] = down;
  }
}

export const gamepadConnected = () => pad.connected;

export function readInput() {
  const on = (k) => keys.has(k) || touch[k];
  return {
    throttle: on('throttle') || pad.throttle ? 1 : 0,
    brake: on('brake') || pad.brake ? 1 : 0,
    lean: Math.max(-1, Math.min(1, (on('back') ? 1 : 0) - (on('forward') ? 1 : 0) + pad.lean)),
  };
}

export function anyInput() {
  const i = readInput();
  return i.throttle || i.brake || i.lean;
}

let touchMode = 'auto';
export const setTouchMode = (m) => (touchMode = m);
export const isTouch = () => touchMode === 'on' || (touchMode === 'auto' && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window));
