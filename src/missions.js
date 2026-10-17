// Missions: three small goals at a time. Finish one, collect coins, a new one appears.
import { rng } from './rng.js';

// kind: what counts. tiers: [target, coins]. text: how it reads to the player.
const POOL = {
  flips: { tiers: [[10, 30], [25, 60], [60, 120]], text: (n) => `Land ${n} flips` },
  backflips: { tiers: [[8, 30], [20, 60]], text: (n) => `Land ${n} backflips` },
  frontflips: { tiers: [[3, 40], [8, 80]], text: (n) => `Land ${n} frontflips` },
  perfects: { tiers: [[3, 30], [8, 60], [15, 100]], text: (n) => `Land ${n} PERFECT landings` },
  combo: { tiers: [[2, 30], [3, 60], [4, 100]], text: (n) => `Reach a ×${n} combo` },
  bigTrick: { tiers: [[2, 50], [3, 120]], text: (n) => (n === 2 ? 'Land a double flip' : 'Land a triple flip') },
  cleanRun: { tiers: [[1, 50]], text: () => 'Finish a course without crashing' },
  finishes: { tiers: [[3, 30], [6, 60]], text: (n) => `Finish ${n} courses` },
  daily: { tiers: [[1, 60]], text: () => "Finish today's Daily Challenge" },
  frenzy: { tiers: [[1500, 40], [3000, 80], [6000, 150]], text: (n) => `Score ${n.toLocaleString('en')} in Flip Frenzy` },
  stars: { tiers: [[1, 40], [2, 80]], text: (n) => `Earn ${n} new star${n > 1 ? 's' : ''}` },
  crates: { tiers: [[5, 30], [15, 60], [30, 100]], text: (n) => `Smash ${n} crates` },
};

// Missions where progress is "best value" rather than "add up".
const BEST_OF = new Set(['combo', 'bigTrick', 'frenzy']);

export class Missions {
  // state lives in the saved progress: { active: [...], made: n }
  constructor(state, onComplete) {
    this.state = state;
    this.state.active ??= [];
    this.state.made ??= 0;
    this.onComplete = onComplete;
    this.fill();
  }

  // Keep three missions, all of different kinds.
  fill() {
    while (this.state.active.length < 3) {
      const r = rng(`mission:${this.state.made}`);
      const kinds = Object.keys(POOL).filter((k) => !this.state.active.some((m) => m.kind === k));
      const kind = r.pick(kinds);
      const tierIndex = Math.min(POOL[kind].tiers.length - 1, Math.floor(this.state.made / 6) + r.int(0, 1));
      const [target, coins] = POOL[kind].tiers[tierIndex];
      this.state.active.push({ kind, target, coins, progress: 0, id: this.state.made++ });
    }
  }

  text(m) {
    return POOL[m.kind].text(m.target);
  }

  // Something happened in the game. kind as in POOL, value = amount (or best value).
  report(kind, value = 1) {
    let changed = false;
    for (const m of this.state.active) {
      if (m.kind !== kind || m.progress >= m.target) continue;
      m.progress = BEST_OF.has(kind) ? Math.max(m.progress, value) : m.progress + value;
      changed = true;
      if (m.progress >= m.target) {
        m.progress = m.target;
        this.onComplete(m);
      }
    }
    return changed;
  }

  // Completed missions are swapped for new ones when the player next sees the list
  // (results screen or menu), so they get to see the tick first.
  collect() {
    const done = this.state.active.filter((m) => m.progress >= m.target);
    this.state.active = this.state.active.filter((m) => m.progress < m.target);
    this.fill();
    return done;
  }
}
