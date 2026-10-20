// Rides all levels on every bike: node tools/bike-check.mjs
// Bikes should feel different but keep the same pace: total time within a few % of Dirt,
// and every level still finishable.
import { LEVELS } from '../src/levels.js';
import { BIKES, tuningFor } from '../src/garage.js';
import { rideCourse } from '../src/autopilot.js';

let base = null;
for (const bike of BIKES) {
  const tuning = tuningFor(bike.id);
  let total = 0, crashes = 0;
  const stuck = [];
  for (const level of LEVELS) {
    const r = rideCourse(level, { maxTime: 120, maxCrashes: 5, tuning });
    total += r.time;
    crashes += r.crashes;
    if (!r.finished) stuck.push(level.id);
    if (r.crashes && process.argv.includes('--why')) console.log(`  ${bike.id} ${level.id} crashes at x=${r.where?.join(', ')}`);
  }
  base ??= total;
  const pace = ((total / base - 1) * 100).toFixed(1);
  console.log(`${bike.id.padEnd(8)} total ${total.toFixed(1)}s  pace ${pace >= 0 ? '+' : ''}${pace}%  crashes ${crashes}${stuck.length ? `  STUCK: ${stuck.join(', ')}` : ''}`);
}
