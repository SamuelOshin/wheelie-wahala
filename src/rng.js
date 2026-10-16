// Seeded randomness and calendar helpers. The same seed always gives the same course,
// which is how everyone gets the same Daily Challenge without a server.

export function hashSeed(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// mulberry32: small, fast, good enough for level design.
export function rng(seed) {
  let s = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (a, b) => a + (b - a) * next();
  next.int = (a, b) => Math.floor(next.range(a, b + 1));
  next.pick = (list) => list[Math.floor(next() * list.length)];
  return next;
}

// Today's date in UTC as YYYY-MM-DD, so the daily course changes at the same moment for everyone.
export function todayUTC(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return todayUTC(d);
}

// Time left until the next daily course, e.g. "5h 12m".
export function untilTomorrowUTC(now = new Date()) {
  const next = new Date(`${addDays(todayUTC(now), 1)}T00:00:00Z`);
  const mins = Math.max(0, Math.round((next - now) / 60000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
