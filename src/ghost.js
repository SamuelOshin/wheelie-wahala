// Ghost of your best run: the bike's path is sampled during a run, the best one is kept
// per course, and played back as a see-through bike to race against.
const RATE = 1 / 20; // samples per second of game time
const PREFIX = 'wheelie-wahala-ghost:';

export class GhostRecorder {
  constructor() {
    this.samples = []; // flat: t, x, y, angle, ...
    this.next = 0;
  }

  record(t, x, y, angle) {
    if (t < this.next) return;
    this.next = t + RATE;
    this.samples.push(+t.toFixed(2), +x.toFixed(2), +y.toFixed(2), +angle.toFixed(3));
  }
}

export function loadGhost(courseId) {
  try {
    const g = JSON.parse(localStorage.getItem(PREFIX + courseId));
    if (g && Array.isArray(g.s) && g.s.length >= 8) return g;
  } catch {}
  return null;
}

export function saveGhost(courseId, time, samples) {
  try { localStorage.setItem(PREFIX + courseId, JSON.stringify({ time, s: samples })); } catch {}
}

// Old daily ghosts aren't needed once the day is over.
export function pruneDailyGhosts(keepId) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX + 'daily-') && k !== PREFIX + keepId) localStorage.removeItem(k);
    }
  } catch {}
}

// Pose at game time t, or null when the ghost has finished.
export function ghostPose(ghost, t) {
  const s = ghost.s;
  const n = s.length / 4;
  if (t >= s[(n - 1) * 4]) return null;
  // Binary search for the sample just before t.
  let lo = 0, hi = n - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid * 4] <= t) lo = mid;
    else hi = mid;
  }
  const a = lo * 4, b = hi * 4;
  const span = s[b] - s[a] || 1;
  const k = Math.max(0, Math.min(1, (t - s[a]) / span));
  // A jump bigger than a few metres is a respawn: snap instead of sliding across.
  if (Math.hypot(s[b + 1] - s[a + 1], s[b + 2] - s[a + 2]) > 6) return { x: s[a + 1], y: s[a + 2], angle: s[a + 3] };
  let da = s[b + 3] - s[a + 3];
  da = Math.atan2(Math.sin(da), Math.cos(da));
  return { x: s[a + 1] + (s[b + 1] - s[a + 1]) * k, y: s[a + 2] + (s[b + 2] - s[a + 2]) * k, angle: s[a + 3] + da * k };
}
