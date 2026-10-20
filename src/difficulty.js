// How forgiving the riding is. Picked in Settings or on the menu; it applies from the next ride.
// The goals (target time, flip goal) are the same on every difficulty. What changes is how
// cleanly you must land, how many checkpoints you get, and how much your flips are worth.
const DEG = Math.PI / 180;

export const DIFFICULTIES = {
  easy: {
    id: 'easy', name: 'Easy', icon: '🙂', score: 0.5, coins: 1,
    blurb: 'Beginner friendly. The bike levels itself in the air, and any landing on your wheels is safe.',
    assist: true, landLimit: Infinity, checkpoints: 'all',
  },
  normal: {
    id: 'normal', name: 'Normal', icon: '😎', score: 1, coins: 1,
    blurb: 'Land within 50° of the track or you crash.',
    assist: false, landLimit: 50 * DEG, checkpoints: 'all',
  },
  hard: {
    id: 'hard', name: 'Hard', icon: '😤', score: 1.5, coins: 1.5,
    blurb: 'Land within 40°, and only half the checkpoints. Flips score ×1.5.',
    assist: false, landLimit: 40 * DEG, checkpoints: 'half',
  },
  extreme: {
    id: 'extreme', name: 'Extreme', icon: '😈', score: 2, coins: 2,
    blurb: 'Land within 30°. No checkpoints: crash once and you start again. Flips score ×2.',
    assist: false, landLimit: 30 * DEG, checkpoints: 'none',
  },
};

export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard', 'extreme'];
export const difficultyOf = (id) => DIFFICULTIES[id] ?? DIFFICULTIES.normal;

// The checkpoints you get: all of them, every other one, or just the start.
export function keepCheckpoints(checkpoints, d) {
  if (d.checkpoints === 'none') return checkpoints.slice(0, 1);
  if (d.checkpoints === 'half') return checkpoints.filter((_, i) => i % 2 === 0);
  return checkpoints;
}
