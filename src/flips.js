// Flip scoring: tricks, combos and PERFECT landings.
//
// A landing with flips becomes a "pending" trick. If the rider stays on the bike for
// CONFIRM seconds it counts; a crash before then is a bail and loses it.
// Landing another trick within COMBO_WINDOW seconds of the last one grows the combo
// multiplier; crashing or waiting too long ends it.

export const CONFIRM = 0.3;
export const COMBO_WINDOW = 4.5; // jumps in the levels land 2–4 s apart
export const MAX_MULTIPLIER = 8;
const PERFECT_BONUS = 1.5;

// Points for n flips in one jump: harder tricks are worth much more.
export function trickPoints(n) {
  if (n <= 0) return 0;
  return [0, 100, 250, 450, 700][Math.min(n, 4)] + Math.max(0, n - 4) * 300;
}

export function trickName(n, back) {
  if (n >= 4) return 'WAHALA!';
  if (n === 3) return 'TRIPLE FLIP!';
  if (n === 2) return 'DOUBLE FLIP!';
  return back ? 'BACKFLIP!' : 'FRONTFLIP!';
}

export class FlipTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.flips = 0; // confirmed flips this run
    this.score = 0; // flip score this run
    this.combo = 0; // tricks in the current chain
    this.bestCombo = 0;
    this.perfects = 0;
    this.pending = null;
    this.sinceTrick = Infinity; // seconds since the last confirmed trick
  }

  get multiplier() {
    return Math.min(MAX_MULTIPLIER, Math.max(1, this.combo));
  }

  // How much of the combo window is left (1 = just landed, 0 = gone).
  get comboLeft() {
    return this.combo > 0 ? Math.max(0, 1 - this.sinceTrick / COMBO_WINDOW) : 0;
  }

  // A landing from the physics. Returns nothing; results come out of update().
  land(e) {
    const airPoints = Math.round(Math.max(0, e.air - 0.4) * 20); // a little for big air
    if (e.flips > 0) {
      this.pending = { ...e, wait: CONFIRM, airPoints };
    } else if (airPoints > 0) {
      this.score += airPoints;
    }
  }

  // Advance time. Returns an event when something happens:
  //   { type: 'trick', name, flips, points, multiplier, perfect }
  //   { type: 'comboEnd', combo, points }
  update(dt) {
    if (this.pending) {
      this.pending.wait -= dt;
      if (this.pending.wait <= 0) return this.confirm();
    } else if (this.combo > 0) {
      this.sinceTrick += dt;
      if (this.sinceTrick > COMBO_WINDOW) return this.endCombo();
    }
    return null;
  }

  confirm() {
    const p = this.pending;
    this.pending = null;
    // The chain continues if this trick came soon enough after the last one.
    this.combo = this.sinceTrick <= COMBO_WINDOW ? this.combo + 1 : 1;
    this.sinceTrick = 0;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (p.perfect) this.perfects++;
    const points = Math.round(trickPoints(p.flips) * this.multiplier * (p.perfect ? PERFECT_BONUS : 1)) + p.airPoints;
    this.flips += p.flips;
    this.score += points;
    return {
      type: 'trick',
      name: trickName(p.flips, p.back),
      flips: p.flips,
      points,
      multiplier: this.multiplier,
      perfect: p.perfect,
    };
  }

  endCombo() {
    const combo = this.combo;
    this.combo = 0;
    this.sinceTrick = Infinity;
    return combo > 1 ? { type: 'comboEnd', combo } : null;
  }

  // Checkpoints save the run's totals; respawning goes back to them, so crashing and
  // redoing the same jump can't farm flips.
  snapshot() {
    return { flips: this.flips, score: this.score, bestCombo: this.bestCombo, perfects: this.perfects };
  }

  restore(snap) {
    Object.assign(this, snap);
    this.pending = null;
    this.combo = 0;
    this.sinceTrick = Infinity;
  }

  // A crash loses the trick in progress and ends the chain.
  crash() {
    const bailed = !!this.pending;
    this.pending = null;
    const hadCombo = this.combo > 1;
    this.combo = 0;
    this.sinceTrick = Infinity;
    return { bailed, comboLost: hadCombo };
  }
}
