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
  addEventListener('keydown', (e) => {
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

export function readInput() {
  const on = (k) => keys.has(k) || touch[k];
  return {
    throttle: on('throttle') ? 1 : 0,
    brake: on('brake') ? 1 : 0,
    lean: (on('back') ? 1 : 0) - (on('forward') ? 1 : 0),
  };
}

export function anyInput() {
  const i = readInput();
  return i.throttle || i.brake || i.lean;
}

export const isTouch = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
