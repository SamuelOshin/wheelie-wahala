// The courses. Pieces are explained at the top of track.js.
// Three stars, one per goal: finish · beat `time` (seconds) · land `flipGoal` flips in one run.
// Target times and flip goals come from tools/level-check.mjs: the autopilot's time + 8%, and
// about 85% of the flips there's air for. The early levels teach; from level 4 they bite.

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
// The tougher stuff, for the later levels:
// a boost, then a jump UP onto a higher ledge (let off the throttle and you hit the wall)
const leapUp = (h = 4, g = 12, up = 1.5) => [['flat', 4], ['boost', 6], ['flat', 6], ['ramp', rampLen(h, 12), h], ['gap', g, up], ['flat', 24]];
// a steep wall that throws you into the air at the top, with a long back side to land on
const wall = (h = 9) => [['flat', 10], ['slope', 18, h], ['flat', 4], ['slope', 40, -h], ['flat', 10]];
// a staircase of drop-offs: land each one level
const stairs = (n = 3) => [['flat', 8], ...Array.from({ length: n }, () => [['gap', 5, -2.5], ['flat', 14]]).flat(), ['flat', 4]];
// platforms over pits, one hop after another
const stones = (n = 3) => [['flat', 8], ...Array.from({ length: n }, () => [['ramp', 10, 2], ['gap', 11, -2], ['flat', 18]]).flat()];
// a long pit jump onto flat ground: no landing slope to save you
const canyon = (h = 4, g = 22) => [['flat', 8], ['ramp', rampLen(h, 14), h], ['gap', g, -2], ['flat', 14]];
// a huge kicker with a long landing: time for a double or a triple
const mega = (h = 7, g = 30, d = 14) => [['flat', 6], ['ramp', rampLen(h, 17), h], ['gap', g, -d], ['slope', 44, -d], ['flat', 14]];
// rough ground that bucks the bike about
const whoops = (h = 0.8) => [['bumps', 30, h, 5], ['flat', 18]];
// ride off a ledge onto flat ground
const dropOff = (d = 8) => [['flat', 8], ['gap', 10, -d], ['flat', 14]];
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
    flipGoal: 5,
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
    flipGoal: 9,
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
    time: 26,
    flipGoal: 3,
  },
  level('desert', 4, 'Crate Canyon', 'ground', L(
    [['flat', 16]], smash(4), kick(3.5, 15, 5), cp(), whoops(0.7), smash(5), canyon(4, 20), cp(), kick(4, 16, 6), smash(3), [['flat', 20]],
  ), 23, 4, 'Smash through crates. Land the canyon jump level!'),
  level('desert', 5, 'Boost Mesa', 'ground', L(
    [['flat', 14]], boostKick(5, 22, 6), cp(), leapUp(4, 14, 1.5), climb(6), boostKick(4, 20, 8), cp(), [['dip', 30, 5], ['flat', 6]], leapUp(4.5, 15, 2), boostKick(5, 22, 9), [['flat', 24]],
  ), 30, 9, 'Jump UP onto the ledges: keep your speed or hit the wall'),
  level('desert', 6, 'Seesaw Sands', 'ground', L(
    [['flat', 14]], climb(4), seesaw(10), cp(), stairs(3), kick(4, 16, 6), seesaw(12), cp(), whoops(0.8), seesaw(10), stairs(4), smash(4), [['flat', 20]],
  ), 27, 3, 'See-saws tip you down. Land every step of the stairs flat'),
  level('desert', 7, 'Loop de Loop', 'wood', L(
    [['flat', 14]], loopy(4.5), cp(), wall(9), kick(4, 16, 6), loopy(5), cp(), [['flat', 6], ['boost', 10], ['flat', 8], ['loop', 5], ['flat', 14]], dropOff(8), wall(9), smash(5), [['flat', 20]],
  ), 35, 7, 'Lean forward up the walls or you flip over backwards'),
  level('desert', 8, 'Red Line Rush', 'line', L(
    [['flat', 14]], drop(14, 5), stones(3), cp(), boostKick(5, 22, 10), [['slope', 20, 8], ['flat', 8]], dropOff(9), mega(), cp(), seesaw(10), stairs(4), drop(14, 5), [['flat', 24]],
  ), 39, 10, 'Hop from platform to platform. Miss one and you drop'),
  level('desert', 9, 'Mesa Madness', 'ground', L(
    [['flat', 14]], whoops(0.8), kick(4.5, 18, 7), cp(), stones(3), leapUp(4.5, 15, 2), canyon(4, 22), cp(), wall(9), seesaw(12), mega(), cp(), stairs(4), whoops(0.8), kick(5, 18, 8), [['flat', 20]],
  ), 52, 12, 'No easy bits now. Every landing counts'),
  level('desert', 10, 'Canyon King', 'wood', L(
    [['flat', 14]], loopy(5), mega(), cp(), stones(4), wall(9), boostKick(5, 22, 9), cp(), stairs(4), leapUp(5, 16, 2.5), loopy(5), cp(), canyon(4.5, 24), mega(7.5, 32, 16), cp(), dropOff(10), whoops(0.8), kick(5, 18, 8), [['flat', 24]],
  ), 67, 17, 'The canyon finale. Doubles off the big kickers!'),

  // ---------- Lagos City ----------
  level('lagos', 1, 'Third Mainland', 'road', L(
    [['flat', 20]], hills(2.5), kick(3.5, 15, 5), cp(), hills(3), climb(4), kick(4, 16, 6), [['flat', 24]],
  ), 18, 4, 'Welcome to Lagos! Ride the bridge'),
  level('lagos', 2, 'Danfo Dash', 'road', L(
    [['flat', 16]], [['boost', 10], ['flat', 10]], smash(4), kick(4, 16, 6), cp(), whoops(0.7), [['boost', 10], ['flat', 6]], smash(5), climb(5), kick(4.5, 18, 7), [['flat', 20]],
  ), 21, 4, 'Potholes! Keep the bike steady over the rough road'),
  level('lagos', 3, 'Bridge Jumps', 'road', L(
    [['flat', 14]], kick(4, 18, 4), kick(4, 18, 4), cp(), leapUp(4, 14, 1.5), stones(3), cp(), climb(6), kick(5, 20, 6), kick(4, 18, 5), cp(), boostKick(5, 22, 6), [['flat', 20]],
  ), 39, 11, 'Gap after gap: chain your flips for a combo'),
  level('lagos', 4, 'Ikoyi Loops', 'road', L(
    [['flat', 14]], loopy(4.5), cp(), wall(9), loopy(5), cp(), kick(4, 16, 6), dropOff(8), [['flat', 6], ['boost', 10], ['flat', 8], ['loop', 5], ['flat', 14]], wall(9), [['flat', 20]],
  ), 33, 7, 'Walls and loops. Throttle on, lean forward on the climbs'),
  level('lagos', 5, 'Lekki Seesaws', 'road', L(
    [['flat', 14]], seesaw(10), stairs(3), seesaw(12), cp(), kick(4, 16, 6), seesaw(10), cp(), whoops(0.8), smash(4), seesaw(12), stairs(4), [['flat', 20]],
  ), 27, 3),
  level('lagos', 6, 'Eko Express', 'road', L(
    [['flat', 12]], boostKick(5, 22, 8), cp(), [['flat', 6], ['boost', 12], ['flat', 10]], loopy(5), mega(), cp(), boostKick(5, 24, 10), cp(), leapUp(4, 14, 1.5), climb(6), boostKick(5, 22, 8), [['flat', 20]],
  ), 36, 9, 'Boost lanes everywhere. Hold on tight!'),
  level('lagos', 7, 'Rooftop Rush', 'line', L(
    [['flat', 14]], drop(12, 4), stairs(4), cp(), kick(5, 20, 10), stones(3), cp(), dropOff(9), leapUp(4.5, 15, 2), boostKick(5, 22, 10), cp(), seesaw(10), stairs(4), drop(12, 4), [['flat', 20]],
  ), 45, 12, 'Roof to roof. Drop, hop and land flat'),
  level('lagos', 8, 'Market Mayhem', 'road', L(
    [['flat', 14]], smash(5), whoops(0.8), smash(6), cp(), canyon(4, 20), smash(5), wall(9), cp(), smash(6), boostKick(5, 22, 8), whoops(0.8), smash(4), [['flat', 20]],
  ), 31, 6, 'Market day! Crates, potholes and a canyon'),
  level('lagos', 9, 'Lagoon Leap', 'road', L(
    [['flat', 14]], mega(), cp(), climb(7), stones(3), boostKick(5.5, 24, 12), cp(), leapUp(5, 16, 2.5), mega(7.5, 32, 16), cp(), canyon(4.5, 24), kick(6, 20, 12), [['flat', 20]],
  ), 44, 12, 'Huge air over the lagoon. Go for doubles!'),
  level('lagos', 10, 'Lagos Legend', 'road', L(
    [['flat', 12]], boostKick(5, 22, 9), stones(3), cp(), loopy(5), wall(9), seesaw(10), cp(), mega(), stairs(4), cp(), leapUp(5, 16, 2.5), whoops(0.8), canyon(4.5, 24), cp(), mega(7.5, 32, 16), smash(5), [['flat', 20]],
  ), 58, 12, 'Become a Lagos legend!'),

  // ---------- Ice Peaks (less grip) ----------
  level('ice', 1, 'First Frost', 'snow', L(
    [['flat', 20]], hills(2.5), kick(3.5, 15, 5), cp(), [['slope', 26, -5], ['flat', 10]], kick(4, 16, 6), [['flat', 24]],
  ), 16, 4, 'Ice is slippery: less grip on climbs and landings'),
  level('ice', 2, 'Slippery Slopes', 'snow', L(
    [['flat', 14]], [['slope', 30, -8], ['flat', 8]], kick(4, 16, 6), cp(), climb(4), [['slope', 30, -8], ['flat', 8]], kick(4.5, 18, 7), [['flat', 24]],
  ), 18, 3),
  level('ice', 3, 'Glacier Gaps', 'ice', L(
    [['flat', 14]], kick(4, 18, 5), kick(4, 18, 5), cp(), stones(3), drop(12, 4), kick(5, 20, 8), cp(), canyon(4, 20), kick(4, 18, 6), [['flat', 24]],
  ), 36, 10, "Icy platforms over the gaps. Don't slide off!"),
  level('ice', 4, 'Ice Loops', 'ice', L(
    [['flat', 14]], loopy(4.5), cp(), kick(4, 16, 6), wall(8), loopy(5), cp(), [['flat', 6], ['boost', 10], ['flat', 8], ['loop', 5], ['flat', 14]], dropOff(8), [['flat', 20]],
  ), 28, 4),
  level('ice', 5, 'Frozen Seesaw', 'snow', L(
    [['flat', 14]], seesaw(10), kick(4, 16, 6), cp(), stairs(3), seesaw(12), [['slope', 26, -6], ['flat', 8]], seesaw(10), cp(), whoops(0.8), kick(4, 16, 6), [['flat', 20]],
  ), 25, 4),
  level('ice', 6, 'Avalanche Run', 'snow', L(
    [['flat', 12]], [['slope', 34, -12], ['flat', 8]], boostKick(5, 22, 10), cp(), [['slope', 34, -10], ['flat', 6]], kick(5, 20, 10), cp(), dropOff(9), stairs(4), boostKick(5, 24, 10), [['flat', 20]],
  ), 28, 4, 'All downhill. Fly!'),
  level('ice', 7, 'Crystal Crates', 'ice', L(
    [['flat', 14]], smash(5), kick(4, 16, 6), cp(), smash(6), leapUp(4.5, 15, 2), loopy(5), cp(), whoops(0.8), smash(5), canyon(4, 20), kick(4.5, 18, 7), [['flat', 20]],
  ), 32, 7),
  level('ice', 8, 'Polar Drop', 'ice', L(
    [['flat', 14]], drop(16, 6), [['flat', 12]], stones(3), cp(), kick(5, 20, 10), drop(16, 6), mega(), cp(), stairs(4), drop(14, 5), dropOff(9), kick(5, 20, 10), [['flat', 20]],
  ), 47, 14),
  level('ice', 9, 'Blizzard', 'snow', L(
    [['flat', 12]], whoops(0.8), kick(4.5, 18, 7), cp(), seesaw(10), stones(3), wall(8), cp(), loopy(5), leapUp(4.5, 15, 2), kick(5, 20, 9), cp(), mega(), canyon(4, 22), boostKick(5, 22, 9), [['flat', 20]],
  ), 54, 13, 'Rough, slippery and no let-up'),
  level('ice', 10, 'Ice Peak King', 'ice', L(
    [['flat', 12]], mega(), loopy(5), cp(), stones(4), drop(16, 6), kick(5, 20, 10), cp(), wall(8), seesaw(12), mega(7.5, 32, 16), cp(), stairs(4), leapUp(5, 16, 2.5), canyon(4.5, 24), cp(), loopy(5), mega(), whoops(0.8), [['flat', 24]],
  ), 74, 16, 'The top of the world. Earn it!'),
];
