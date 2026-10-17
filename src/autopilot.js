// A simple rider used to check courses: full throttle, and in the air it levels the bike
// to the slope it's about to land on. If it can finish, a person can.
import { buildTrack } from './track.js';
import { BikeSim, TUNING } from './physics.js';

const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Slope of the track below x, at or ahead of the bike's progress.
function groundBelow(sim, x) {
  for (const g of sim.track.segments) {
    if (g.s1 < sim.progress - 2) continue;
    if (g.bx > g.ax && x >= g.ax && x <= g.bx) return Math.atan2(g.by - g.ay, g.bx - g.ax);
    if (g.s0 > sim.progress + 120) break;
  }
  return 0;
}

export function autopilotInput(sim) {
  const air = !sim.rearGround && !sim.frontGround;
  let lean = 0;
  if (air && sim.airTime > 0.1) {
    const c = sim.chassis.getPosition(), v = sim.chassis.getLinearVelocity();
    const err = norm(sim.chassis.getAngle() - groundBelow(sim, c.x + v.x * 0.5));
    lean = err > 0.12 ? -1 : err < -0.12 ? 1 : 0;
  } else if (sim.contactSeg) {
    // On the ground: lean against wheelies and nose-dives, like a person would.
    const g = sim.contactSeg;
    const err = norm(sim.chassis.getAngle() - Math.atan2(g.by - g.ay, g.bx - g.ax));
    lean = err > 0.3 ? -1 : err < -0.3 ? 1 : 0;
  }
  return { throttle: 1, brake: 0, lean };
}

// Ride a level. Returns { finished, time, crashes } (time in seconds of game time).
export function rideCourse(level, { maxTime = 90, maxCrashes = 0, tuning } = {}) {
  const track = buildTrack(level);
  const sim = new BikeSim(track, tuning ?? TUNING);
  sim.reset(track.checkpoints[0]);
  const dt = 1 / 120;
  let t = 0, crashes = 0, cp = 0;
  while (t < maxTime) {
    for (const e of sim.step(autopilotInput(sim), dt)) {
      if (e.type === 'crash') {
        crashes++;
        if (crashes > maxCrashes) return { finished: false, time: t, crashes, x: sim.chassis.getPosition().x };
        sim.reset(track.checkpoints[cp]);
      }
    }
    t += dt;
    const p = sim.chassis.getPosition();
    for (let i = cp + 1; i < track.checkpoints.length; i++) if (p.x >= track.checkpoints[i].x) cp = i;
    if (p.y < track.killY) {
      crashes++;
      if (crashes > maxCrashes) return { finished: false, time: t, crashes, x: p.x };
      sim.reset(track.checkpoints[cp]);
    }
    if (p.x >= track.finishX) return { finished: true, time: t, crashes };
  }
  return { finished: false, time: t, crashes, x: sim.chassis.getPosition().x };
}
