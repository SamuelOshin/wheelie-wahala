// The courses. Pieces are explained at the top of track.js.
// Three stars, one per goal: finish · beat `time` (seconds) · land `flipGoal` flips in one run.

export const LEVELS = [
  {
    id: 'desert-1',
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
];
