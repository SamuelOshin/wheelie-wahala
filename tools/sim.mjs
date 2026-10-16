// Headless physics check: node tools/sim.mjs [levelId]
// Rides a level with a simple scripted rider and prints what happened.
import { buildTrack } from '../src/track.js';
import { BikeSim } from '../src/physics.js';
import { LEVELS } from '../src/levels.js';

const TEST = {
  id: 'test',
  start: [0, 0],
  pieces: [
    ['flat', 40], ['slope', 30, -8], ['flat', 20], ['loop', 4.5], ['flat', 25],
    ['ramp', 12, 3], ['gap', 14, -6], ['slope', 20, -4], ['flat', 40],
  ],
};

const id = process.argv.slice(2).find((a) => !a.startsWith('--'));
const level = id ? LEVELS.find((l) => l.id === id) : TEST;
const track = buildTrack(level);
const sim = new BikeSim(track);
sim.reset(track.checkpoints[0]);

const dt = 1 / 120;
let t = 0, crashes = 0, flips = 0, maxSpeed = 0, lastLog = -1, cp = 0;
const leanInAir = process.argv.includes('--flip') ? 1 : 0;
while (t < 120) {
  const air = !sim.rearGround && !sim.frontGround;
  // Level the bike in the air unless we're testing flips.
  const ang = Math.atan2(Math.sin(sim.chassis.getAngle()), Math.cos(sim.chassis.getAngle()));
  const level = ang > 0.15 ? -1 : ang < -0.15 ? 1 : 0;
  const flipping = leanInAir && sim.airTime > 0.15 && sim.airSpin < Math.PI * 2 - 1.2;
  const lean = process.argv.includes('--raw') ? 0 : air ? (flipping ? 1 : level) : 0;
  const ev = sim.step({ throttle: 1, brake: 0, lean }, dt);
  t += dt;
  const p = sim.chassis.getPosition();
  for (let i = cp + 1; i < track.checkpoints.length; i++) if (p.x >= track.checkpoints[i].x) cp = i;
  for (const e of ev) {
    if (e.type === 'crash') {
      crashes++;
      console.log(`${t.toFixed(2)}s CRASH at x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} s=${sim.progress.toFixed(1)}`);
      sim.reset(track.checkpoints[cp]);
      if (crashes > 8) { console.log('too many crashes'); process.exit(1); }
    }
    if (e.type === 'land') {
      flips += e.flips;
      console.log(`${t.toFixed(2)}s landed after ${e.air.toFixed(2)}s air at x=${p.x.toFixed(1)}` +
        `${e.flips ? `, FLIP x${e.flips}` : ''}${e.perfect ? ', PERFECT' : ''}, impact ${e.impact.toFixed(1)} m/s`);
    }
  }
  maxSpeed = Math.max(maxSpeed, sim.speed);
  if (Math.floor(t) !== lastLog && Math.floor(t) % 2 === 0) {
    lastLog = Math.floor(t);
    console.log(`${t.toFixed(0)}s x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} v=${sim.speed.toFixed(1)} s=${sim.progress.toFixed(1)} ${air ? 'AIR' : ''}`);
  }
  if (p.y < -200) { console.log('fell off the world'); sim.reset(track.checkpoints[cp]); crashes++; }
  if (p.x >= track.finishX) { console.log(`FINISH in ${t.toFixed(2)}s, crashes ${crashes}, flips ${flips}, top speed ${maxSpeed.toFixed(1)} m/s`); process.exit(0); }
}
console.log(`DNF: x=${sim.chassis.getPosition().x.toFixed(1)} of ${track.finishX.toFixed(1)}`);
