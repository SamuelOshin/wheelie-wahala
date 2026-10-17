// Rides every level with the autopilot: node tools/level-check.mjs [levelId]
// Prints whether it finishes cleanly, its time, the big jumps (where flips happen),
// and suggested targets next to the ones in levels.js.
import { LEVELS } from '../src/levels.js';
import { buildTrack } from '../src/track.js';
import { BikeSim } from '../src/physics.js';
import { autopilotInput } from '../src/autopilot.js';

const only = process.argv[2];
let problems = 0;
for (const level of LEVELS) {
  if (only && level.id !== only) continue;
  const track = buildTrack(level);
  const sim = new BikeSim(track);
  sim.reset(track.checkpoints[0]);
  const dt = 1 / 120;
  let t = 0, cp = 0, crashes = 0, bigJumps = 0, smashes = 0, finished = false, where = '';
  while (t < 120) {
    for (const e of sim.step(autopilotInput(sim), dt)) {
      if (e.type === 'land' && e.air > 1.0) bigJumps++;
      if (e.type === 'smash') smashes++;
      if (e.type === 'crash') {
        crashes++;
        where ||= `x=${sim.chassis.getPosition().x.toFixed(0)}`;
        sim.reset(track.checkpoints[cp]);
      }
    }
    t += dt;
    const p = sim.chassis.getPosition();
    for (let i = cp + 1; i < track.checkpoints.length; i++) if (p.x >= track.checkpoints[i].x) cp = i;
    if (p.y < track.killY) {
      crashes++;
      where ||= `fell x=${p.x.toFixed(0)}`;
      sim.reset(track.checkpoints[cp]);
    }
    if (p.x >= track.finishX) { finished = true; break; }
    if (crashes > 6) break;
  }
  const suggestTime = Math.ceil(t * 1.15);
  const suggestFlips = Math.max(3, Math.round(bigJumps * 0.6));
  const flag = !finished ? `STUCK (${where})` : crashes ? `crashes ${crashes} (${where})` : 'clean';
  if (!finished || crashes) problems++;
  console.log(
    `${level.id.padEnd(10)} ${flag.padEnd(26)} ${t.toFixed(1).padStart(5)}s  jumps ${String(bigJumps).padStart(2)}  crates ${String(smashes).padStart(2)}` +
    `  time ${level.time}→${suggestTime}  flips ${level.flipGoal}→${suggestFlips}  len ${Math.round(track.finishX)}m`,
  );
}
console.log(problems ? `${problems} level(s) need a look` : 'All levels ride cleanly');
