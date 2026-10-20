// Rides every level with the autopilot: node tools/level-check.mjs [levelId] [--diff=hard] [--raw]
// --diff rides with that difficulty's landing rules and checkpoints (default normal).
// --raw is a beginner who never leans (try it with --diff=easy).
// Prints whether it finishes cleanly, its time, the big jumps (where flips happen),
// and suggested targets next to the ones in levels.js.
import { LEVELS } from '../src/levels.js';
import { buildTrack } from '../src/track.js';
import { BikeSim } from '../src/physics.js';
import { autopilotInput } from '../src/autopilot.js';
import { difficultyOf, keepCheckpoints } from '../src/difficulty.js';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const diff = difficultyOf(arg('diff') ?? 'normal');
const raw = process.argv.includes('--raw');

const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
let problems = 0;
for (const level of LEVELS) {
  if (only && level.id !== only) continue;
  const track = buildTrack(level);
  track.checkpoints = keepCheckpoints(track.checkpoints, diff);
  const sim = new BikeSim(track);
  sim.rules = diff;
  sim.reset(track.checkpoints[0]);
  const dt = 1 / 120;
  let t = 0, cp = 0, crashes = 0, bigJumps = 0, flipChances = 0, smashes = 0, finished = false, where = '';
  while (t < 120) {
    for (const e of sim.step(raw ? { throttle: 1, brake: 0, lean: 0 } : autopilotInput(sim), dt)) {
      if (e.type === 'land' && e.air > 1.0) { bigJumps++; flipChances += e.air > 2.6 ? 2 : 1; } // long air: room for a double
      if (e.type === 'smash') smashes++;
      if (e.type === 'crash') {
        crashes++;
        where ||= `x=${sim.chassis.getPosition().x.toFixed(0)}`;
        const c = sim.chassis.getPosition();
        if (only) console.log(`  crash (${e.reason ?? 'head'}) x=${c.x.toFixed(1)} y=${c.y.toFixed(1)}${e.off ? ` off ${(e.off * 57.3).toFixed(0)}°` : ''}`);
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
  const suggestTime = Math.ceil(t * 1.08);
  const suggestFlips = Math.max(3, Math.round(flipChances * 0.85));
  const flag = !finished ? `STUCK (${where})` : crashes ? `crashes ${crashes} (${where})` : 'clean';
  if (!finished || crashes) problems++;
  console.log(
    `${level.id.padEnd(10)} ${flag.padEnd(26)} ${t.toFixed(1).padStart(5)}s  jumps ${String(bigJumps).padStart(2)}  crates ${String(smashes).padStart(2)}` +
    `  time ${level.time}→${suggestTime}  flips ${level.flipGoal}→${suggestFlips}  len ${Math.round(track.finishX)}m`,
  );
}
console.log(`Difficulty: ${diff.name}${raw ? ', rider never leans' : ''}`);
console.log(problems ? `${problems} level(s) need a look` : 'All levels ride cleanly');
