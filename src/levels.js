// The courses. Pieces are explained at the top of track.js.
// Three stars, one per goal: finish · beat `time` (seconds) · land `flipGoal` flips in one run.
// Target times come from tools/level-check.mjs (autopilot time + a margin).

// Worlds unlock with stars earned across all levels.
export const WORLDS = [
  { id: 'desert', name: 'Desert Canyon', theme: 'desert', stars: 0, blurb: 'Where it all began' },
  { id: 'lagos', name: 'Lagos City', theme: 'lagos', stars: 12, blurb: 'Bridges, danfos and boost lanes' },
  { id: 'ice', name: 'Ice Peaks', theme: 'ice', stars: 30, blurb: 'Slippery! Less grip, more flips', grip: 0.5 },
];

// Reusable sections, each one ridden and checked on its own.
const cp = () => [['checkpoint'], ['flat', 8]];
// A kicker: ramp of height h, flight of length g, landing slope dropping d.
// Tall ramps get longer so the lip stays under about 40 degrees.
const rampLen = (h, min) => Math.max(min, h * 2.5);
const kick = (h = 4, g = 16, d = 6) => [['flat', 8], ['ramp', rampLen(h, 12), h], ['gap', g, -d], ['slope', 22, -d * 0.8], ['flat', 8]];
const drop = (dy = 14, dip = 5) => [['line', 18, -dy], ['dip', 30, dip], ['flat', 8]];
const loopy = (r = 4.5) => [['flat', 8], ['slope', 32, -9], ['flat', 16], ['loop', r], ['flat', 14]];
const climb = (h = 5) => [['slope', 24, h], ['flat', 8]];
const boostKick = (h = 5, g = 22, d = 8) => [['flat', 6], ['boost', 10], ['ramp', rampLen(h, 13), h], ['gap', g, -d], ['slope', 26, -d * 0.8], ['flat', 8]];
const smash = (n = 4) => [['flat', 14], ['crates', Math.min(n, 5)], ['flat', 18]]; // meet crates on the ground, not mid-air
const seesaw = (len = 10) => [['flat', 8], ['seesaw', len], ['flat', 14]];
const hills = (h = 3) => [['hill', 22, h], ['flat', 6]];
const L = (...parts) => parts.flat();

const level = (world, n, name, style, pieces, time, flipGoal, hint) => ({
  id: `${world}-${n}`, world, theme: WORLDS.find((w) => w.id === world).theme,
  grip: WORLDS.find((w) => w.id === world).grip,
  name, style, start: [0, 0], pieces, time, flipGoal, hint,
});

export const LEVELS = [
  // ---------- Desert Canyon ----------
  {
    id: 'desert-1',
    world: 'desert',
    name: 'Dusty Start',
    hint: 'Hold ↑ (or GO) to ride. Use ← → to lean and balance',
    style: 'ground',
    start: [0, 0],
    pieces: [
      ['flat', 30], ['hill', 18, 2], ['flat', 10], ['bumps', 36, 0.4, 3], ['flat', 12],
      ['slope', 22, 6], ['checkpoint'], ['flat', 8], ['ramp', 10, 2.5], ['gap', 12, -3],
      ['slope', 18, -5], ['flat', 14], ['hill', 26, 4], ['flat', 10],
      ['slope', 30, -6], ['checkpoint'], ['flat', 10], ['ramp', 12, 3.5], ['gap', 16, -5],
      ['slope', 22, -4], ['flat', 30],
    ],
    time: 22,
    flipGoal: 3,
  },
  {
    id: 'desert-2',
    world: 'desert',
    name: 'Red Line Drop',
    hint: 'Lean back in the air to backflip. Chain flips jump after jump for a combo!',
    style: 'line',
    start: [0, 0],
    pieces: [
      ['flat', 20], ['line', 20, -16], ['dip', 30, 4], ['flat', 10],
      ['ramp', 12, 5], ['gap', 18, -10], ['slope', 24, -6], ['checkpoint'], ['flat', 12],
      ['line', 14, 8], ['flat', 10], ['line', 22, -18], ['dip', 34, 6],
      ['checkpoint'], ['flat', 6], ['ramp', 14, 6], ['gap', 20, -12], ['slope', 26, -8], ['flat', 10],
      ['hill', 20, 3], ['flat', 30],
    ],
    time: 26,
    flipGoal: 6,
  },
  {
    id: 'desert-3',
    world: 'desert',
    name: 'Canyon Loops',
    hint: 'Keep the throttle on all the way round the loops',
    style: 'wood',
    start: [0, 0],
    pieces: [
      ['flat', 20], ['slope', 30, -10], ['flat', 16], ['loop', 4.5], ['flat', 18],
      ['ramp', 12, 4], ['gap', 16, -6, 'ground'], ['slope', 22, -6], ['checkpoint'], ['flat', 10],
      ['style', 'wood'], ['line', 20, -10], ['flat', 14], ['loop', 5], ['flat', 10], ['loop', 5],
      ['flat', 16], ['checkpoint'], ['dip', 28, 6], ['flat', 10], ['ramp', 12, 3.5], ['gap', 16, -6],
      ['slope', 24, -5], ['flat', 30],
    ],
    time: 27,
    flipGoal: 4,
  },
  level('desert', 4, 'Crate Canyon', 'ground', L(
    [['flat', 16]], smash(4), kick(3.5, 15, 5), cp(), smash(5), hills(3), climb(5), cp(), kick(4, 16, 6), smash(3), [['flat', 20]],
  ), 22, 3, 'Smash through crates for points'),
  level('desert', 5, 'Boost Mesa', 'ground', L(
    [['flat', 14]], boostKick(5, 22, 6), cp(), climb(6), boostKick(4, 20, 8), cp(), [['dip', 30, 5], ['flat', 6]], boostKick(5, 22, 9), [['flat', 24]],
  ), 24, 4, 'Boost pads fire you forward. Hit the ramp right after one!'),
  level('desert', 6, 'Seesaw Sands', 'ground', L(
    [['flat', 14]], climb(4), seesaw(10), cp(), kick(4, 16, 6), seesaw(12), cp(), hills(3), seesaw(10), smash(4), [['flat', 20]],
  ), 20, 3, 'See-saws tip when you ride over the middle. Fast, and they throw you'),
  level('desert', 7, 'Loop de Loop', 'wood', L(
    [['flat', 14]], loopy(4.5), cp(), kick(4, 16, 6), loopy(5), cp(), [['flat', 6], ['boost', 10], ['flat', 8], ['loop', 5], ['flat', 14]], smash(5), [['flat', 20]],
  ), 25, 3),
  level('desert', 8, 'Red Line Rush', 'line', L(
    [['flat', 14]], drop(14, 5), boostKick(5, 22, 10), cp(), [['slope', 20, 8], ['flat', 8]], drop(16, 6), kick(6, 20, 12), cp(), seesaw(10), drop(14, 5), [['flat', 24]],
  ), 33, 5),
  level('desert', 9, 'Mesa Madness', 'ground', L(
    [['flat', 14]], [['bumps', 32, 0.5, 3], ['flat', 8]], kick(4.5, 18, 7), cp(), smash(4), boostKick(5, 22, 8), cp(), climb(6), seesaw(12), kick(5, 18, 8), cp(), hills(3.5), kick(4, 16, 6), [['flat', 20]],
  ), 35, 4),
  level('desert', 10, 'Canyon King', 'wood', L(
    [['flat', 14]], loopy(5), kick(5, 18, 8), cp(), boostKick(5, 22, 9), smash(5), cp(), seesaw(10), loopy(5), cp(), drop(14, 5), boostKick(5, 24, 10), [['flat', 6]], kick(4, 16, 6), [['flat', 24]],
  ), 44, 5, 'The canyon finale. Everything you have learned!'),

  // ---------- Lagos City ----------
  level('lagos', 1, 'Third Mainland', 'road', L(
    [['flat', 20]], hills(2.5), kick(3.5, 15, 5), cp(), hills(3), climb(4), kick(4, 16, 6), [['flat', 24]],
  ), 19, 3, 'Welcome to Lagos! Ride the bridge'),
  level('lagos', 2, 'Danfo Dash', 'road', L(
    [['flat', 16]], [['boost', 10], ['flat', 10]], smash(4), kick(4, 16, 6), cp(), [['boost', 10], ['flat', 6]], smash(5), climb(5), kick(4.5, 18, 7), [['flat', 20]],
  ), 20, 3),
  level('lagos', 3, 'Bridge Jumps', 'road', L(
    [['flat', 14]], kick(4, 18, 4), kick(4, 18, 4), cp(), climb(6), kick(5, 20, 6), kick(4, 18, 5), cp(), boostKick(5, 22, 6), [['flat', 20]],
  ), 29, 4, 'Gap after gap: chain your flips for a combo'),
  level('lagos', 4, 'Ikoyi Loops', 'road', L(
    [['flat', 14]], loopy(4.5), cp(), climb(5), loopy(5), cp(), kick(4, 16, 6), [['flat', 6], ['boost', 10], ['flat', 8], ['loop', 5], ['flat', 14]], [['flat', 20]],
  ), 25, 3),
  level('lagos', 5, 'Lekki Seesaws', 'road', L(
    [['flat', 14]], seesaw(10), climb(4), seesaw(12), cp(), kick(4, 16, 6), seesaw(10), cp(), smash(4), seesaw(12), [['flat', 20]],
  ), 20, 3),
  level('lagos', 6, 'Eko Express', 'road', L(
    [['flat', 12]], boostKick(5, 22, 8), cp(), [['flat', 6], ['boost', 12], ['flat', 10]], loopy(5), cp(), boostKick(5, 24, 10), climb(6), boostKick(5, 22, 8), [['flat', 20]],
  ), 27, 3, 'Boost lanes everywhere. Hold on tight!'),
  level('lagos', 7, 'Rooftop Rush', 'line', L(
    [['flat', 14]], drop(12, 4), kick(5, 20, 10), cp(), [['slope', 20, 8], ['flat', 8]], drop(16, 6), boostKick(5, 22, 10), cp(), seesaw(10), drop(12, 4), [['flat', 20]],
  ), 31, 6),
  level('lagos', 8, 'Market Mayhem', 'road', L(
    [['flat', 14]], smash(5), hills(3), smash(6), cp(), kick(4, 16, 6), smash(5), climb(5), cp(), smash(6), boostKick(5, 22, 8), smash(4), [['flat', 20]],
  ), 26, 3, 'Market day! Crates everywhere'),
  level('lagos', 9, 'Lagoon Leap', 'road', L(
    [['flat', 14]], boostKick(5.5, 24, 12), cp(), climb(7), boostKick(5.5, 24, 12), cp(), climb(7), kick(6, 20, 12), [['flat', 20]],
  ), 25, 4, 'Huge air over the lagoon. Go for doubles!'),
  level('lagos', 10, 'Lagos Legend', 'road', L(
    [['flat', 12]], boostKick(5, 22, 9), smash(4), cp(), loopy(5), seesaw(10), cp(), drop(14, 5), kick(5, 18, 8), cp(), climb(6), boostKick(5.5, 24, 11), smash(5), [['flat', 20]],
  ), 38, 5, 'Become a Lagos legend!'),

  // ---------- Ice Peaks (less grip) ----------
  level('ice', 1, 'First Frost', 'snow', L(
    [['flat', 20]], hills(2.5), kick(3.5, 15, 5), cp(), [['slope', 26, -5], ['flat', 10]], kick(4, 16, 6), [['flat', 24]],
  ), 17, 3, 'Ice is slippery: less grip on climbs and landings'),
  level('ice', 2, 'Slippery Slopes', 'snow', L(
    [['flat', 14]], [['slope', 30, -8], ['flat', 8]], kick(4, 16, 6), cp(), climb(4), [['slope', 30, -8], ['flat', 8]], kick(4.5, 18, 7), [['flat', 24]],
  ), 19, 3),
  level('ice', 3, 'Glacier Gaps', 'ice', L(
    [['flat', 14]], kick(4, 18, 5), kick(4, 18, 5), cp(), drop(12, 4), kick(5, 20, 8), cp(), kick(4, 18, 6), [['flat', 24]],
  ), 28, 4),
  level('ice', 4, 'Ice Loops', 'ice', L(
    [['flat', 14]], loopy(4.5), cp(), kick(4, 16, 6), loopy(5), cp(), [['flat', 6], ['boost', 10], ['flat', 8], ['loop', 5], ['flat', 14]], [['flat', 20]],
  ), 23, 3),
  level('ice', 5, 'Frozen Seesaw', 'snow', L(
    [['flat', 14]], seesaw(10), kick(4, 16, 6), cp(), seesaw(12), [['slope', 26, -6], ['flat', 8]], seesaw(10), cp(), kick(4, 16, 6), [['flat', 20]],
  ), 21, 3),
  level('ice', 6, 'Avalanche Run', 'snow', L(
    [['flat', 12]], [['slope', 34, -12], ['flat', 8]], boostKick(5, 22, 10), cp(), [['slope', 34, -10], ['flat', 6]], kick(5, 20, 10), cp(), boostKick(5, 24, 10), [['flat', 20]],
  ), 24, 3, 'All downhill. Fly!'),
  level('ice', 7, 'Crystal Crates', 'ice', L(
    [['flat', 14]], smash(5), kick(4, 16, 6), cp(), smash(6), loopy(5), cp(), smash(5), kick(4.5, 18, 7), [['flat', 20]],
  ), 24, 3),
  level('ice', 8, 'Polar Drop', 'ice', L(
    [['flat', 14]], drop(16, 6), kick(5, 20, 10), cp(), drop(16, 6), boostKick(5, 22, 10), cp(), drop(14, 5), kick(5, 20, 10), [['flat', 20]],
  ), 34, 6),
  level('ice', 9, 'Blizzard', 'snow', L(
    [['flat', 12]], [['bumps', 32, 0.5, 3], ['flat', 8]], kick(4.5, 18, 7), cp(), seesaw(10), smash(5), climb(4), cp(), loopy(5), kick(5, 20, 9), cp(), boostKick(5, 22, 9), [['flat', 20]],
  ), 34, 3),
  level('ice', 10, 'Ice Peak King', 'ice', L(
    [['flat', 12]], boostKick(5, 22, 10), loopy(5), cp(), drop(16, 6), kick(5, 20, 10), smash(5), cp(), seesaw(12), boostKick(5.5, 24, 12), cp(), loopy(5), kick(5, 20, 10), [['flat', 24]],
  ), 44, 5, 'The top of the world. Earn it!'),
];
