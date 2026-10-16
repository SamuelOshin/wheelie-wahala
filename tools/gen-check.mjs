// Checks the course generator: node tools/gen-check.mjs [count] [mode]
// Rides generated courses with the autopilot (no crashes allowed) and reports failures.
import { generateCourse } from '../src/generator.js';
import { rideCourse } from '../src/autopilot.js';

const count = Number(process.argv[2] ?? 40);
const modes = process.argv[3] ? [process.argv[3]] : ['daily', 'frenzy'];

for (const mode of modes) {
  let ok = 0;
  const fails = [], times = [];
  const t0 = Date.now();
  for (let i = 0; i < count; i++) {
    const seed = mode === 'daily' ? `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}-${i}` : `run${i}`;
    const level = generateCourse(seed, mode === 'daily' ? { mode } : { mode, length: 2400 });
    const res = rideCourse(level, { maxTime: mode === 'daily' ? 90 : 220 });
    if (res.finished) {
      ok++;
      times.push(res.time);
    } else fails.push(`${seed} (${level.style}) stopped at x=${res.x?.toFixed(0)} after ${res.time.toFixed(1)}s`);
  }
  const avg = times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1) : '-';
  console.log(`${mode}: ${ok}/${count} finished cleanly, average ${avg}s, ${((Date.now() - t0) / count).toFixed(0)} ms per course`);
  for (const f of fails.slice(0, 12)) console.log('  FAIL', f);
}
