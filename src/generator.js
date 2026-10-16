// Builds courses from a seed, out of small hand-tested sections ("templates").
// Each template is a stretch of track that the autopilot can ride; stitched together
// they make the Daily Challenge and the long Flip Frenzy course.
import { rng } from './rng.js';

// r: seeded random. Every template ends on flat ground with a checkpoint, so respawns are fair.
const TEMPLATES = {
  runway: (r) => [['flat', r.range(14, 22)]],
  kicker: (r) => [
    ['flat', 8], ['ramp', r.range(10, 13), r.range(2.8, 4.2)], ['gap', r.range(13, 18), -r.range(4, 7)],
    ['slope', r.range(20, 26), -r.range(4, 6)], ['checkpoint'], ['flat', 10],
  ],
  bigKicker: (r) => [
    ['flat', 10], ['ramp', 13, r.range(4.5, 5.5)], ['gap', r.range(17, 20), -r.range(8, 11)],
    ['slope', 26, -r.range(6, 8)], ['checkpoint'], ['flat', 10],
  ],
  drop: (r) => [
    ['line', r.range(16, 20), -r.range(12, 16)], ['dip', r.range(28, 34), r.range(3.5, 5.5)], ['checkpoint'], ['flat', 8],
  ],
  hills: (r) => [['hill', r.range(18, 26), r.range(2, 3.5)], ['flat', 6], ['hill', r.range(18, 24), r.range(1.5, 3)], ['flat', 6]],
  bumps: () => [['bumps', 32, 0.4, 3], ['flat', 8]],
  climb: (r) => [['slope', r.range(22, 28), r.range(4, 6)], ['checkpoint'], ['flat', 10]],
  loop: (r) => [['flat', 8], ['slope', 36, -r.range(7, 9)], ['flat', 16], ['loop', 4.5], ['flat', 16], ['checkpoint'], ['flat', 6]],
};

// How often each section turns up, by mode.
const MIXES = {
  daily: { runway: 1, kicker: 4, bigKicker: 2, drop: 2, hills: 2, bumps: 1, climb: 2, loop: 1.2 },
  frenzy: { runway: 0.5, kicker: 5, bigKicker: 3, drop: 2.5, hills: 1, bumps: 0.5, climb: 2.2, loop: 0.8 },
};

function weightedPick(r, weights, allowed) {
  const keys = Object.keys(weights).filter((k) => allowed(k));
  const total = keys.reduce((s, k) => s + weights[k], 0);
  let x = r() * total;
  for (const k of keys) {
    if ((x -= weights[k]) <= 0) return k;
  }
  return keys[keys.length - 1];
}

const STYLES = ['ground', 'line', 'wood'];

// Rough height change of a section, so the course doesn't drift off the bottom of the world.
function heightChange(pieces) {
  let dy = 0;
  for (const [kind, , b = 0] of pieces) {
    if (['line', 'slope', 'ramp', 'gap'].includes(kind)) dy += b;
  }
  return dy;
}

// mode: 'daily' | 'frenzy'. length: metres of course to aim for.
export function generateCourse(seed, { mode = 'daily', length = 380 } = {}) {
  const r = rng(`${mode}:${seed}`);
  const style = r.pick(STYLES);
  const pieces = [['flat', 18]];
  let x = 18, y = 0, last = '', kickers = 0;
  while (x < length) {
    const pick = weightedPick(r, MIXES[mode], (k) =>
      k !== last && // no section twice in a row
      !(k === 'loop' && style === 'line') && // loops look wrong on a thin line
      !(y < -45 && ['drop', 'bigKicker', 'loop'].includes(k)) && // too low: go up instead
      !(y > 15 && k === 'climb'));
    const section = TEMPLATES[pick](r);
    pieces.push(...section);
    for (const [kind, a = 0] of section) if (kind !== 'checkpoint' && kind !== 'style' && kind !== 'loop') x += a;
    y += heightChange(section);
    if (pick === 'kicker' || pick === 'bigKicker' || pick === 'drop') kickers++;
    last = pick;
  }
  pieces.push(['flat', 20]);
  return {
    id: `${mode}-${seed}`,
    mode,
    name: mode === 'daily' ? 'Daily Challenge' : 'Flip Frenzy',
    style,
    start: [0, 0],
    pieces,
    // Filled in by the autopilot for the daily (target time); a sensible guess until then.
    time: Math.round(length / 15),
    flipGoal: Math.max(3, Math.round(kickers * 0.8)),
    hint: mode === 'daily' ? 'A new course every day. Same for everyone!' : '60 seconds. Flip as much as you can! Big combos add time.',
  };
}
