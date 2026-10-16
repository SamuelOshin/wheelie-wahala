// Player settings, kept in this browser only.
const KEY = 'wheelie-wahala-settings-v1';

export const DEFAULTS = {
  riderName: '', // empty = use the start.ng character name
  nameTag: true,
  ghost: true, // race your best run
  master: 100,
  music: 70,
  sfx: 80,
  engine: 60,
  quality: 'high', // high | medium | low
  touch: 'auto', // auto | on | off
};

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') return sanitize({ ...DEFAULTS, ...s });
  } catch {}
  return { ...DEFAULTS };
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export function sanitize(s) {
  s = { ...DEFAULTS, ...s };
  return {
    riderName: cleanName(s.riderName),
    nameTag: s.nameTag !== false,
    ghost: s.ghost !== false,
    master: clamp(s.master),
    music: clamp(s.music),
    sfx: clamp(s.sfx),
    engine: clamp(s.engine),
    quality: ['high', 'medium', 'low'].includes(s.quality) ? s.quality : DEFAULTS.quality,
    touch: ['auto', 'on', 'off'].includes(s.touch) ? s.touch : DEFAULTS.touch,
  };
}

// Letters, numbers, spaces and a little punctuation; at most 16 characters.
export function cleanName(name) {
  return String(name ?? '').replace(/[^\p{L}\p{N} ._'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
}
