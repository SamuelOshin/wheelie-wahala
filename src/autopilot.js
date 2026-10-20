// A simple rider used to check courses: full throttle, and in the air it levels the bike
// to the slope it's about to land on. If it can finish, a person can.
import { buildTrack } from './track.js';
import { BikeSim, TUNING } from './physics.js';
import { DIFFICULTIES } from './difficulty.js';

const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function autopilotInput(sim) {
  const air = !sim.rearGround && !sim.frontGround;
  let lean = 0;
  if (air && sim.airTime > 0.1) {
    const err = norm(sim.chassis.getAngle() - sim.landingSlope());
    lean = err > 0.08 ? -1 : err < -0.08 ? 1 : 0;
  } else if (sim.contactSeg) {
    // On the ground: lean against wheelies and nose-dives, like a person would.
    const g = sim.contactSeg;
    const err = norm(sim.chassis.getAngle() - Math.atan2(g.by - g.ay, g.bx - g.ax));
    // ...but not so hard that it spins the other way.
    const w = sim.chassis.getAngularVelocity();
    lean = err > 0.3 && w > -2 ? -1 : err < -0.3 && w < 2 ? 1 : 0;
    // Front wheel over an edge and the nose tipping down: sit back.
    if (sim.rearGround && !sim.frontGround && w < -3) lean = 1;
  }
  return { throttle: 1, brake: 0, lean };
}

// Ride a level. Returns { finished, time, crashes } (time in seconds of game time).
// rules: a difficulty (difficulty.js) for its landing rules; Normal's by default.
export function rideCourse(level, { maxTime = 90, maxCrashes = 0, tuning, rules = DIFFICULTIES.normal } = {}) {
  const track = buildTrack(level);
  const sim = new BikeSim(track, tuning ?? TUNING);
  sim.rules = rules;
  sim.reset(track.checkpoints[0]);
  const dt = 1 / 120;
  let t = 0, crashes = 0, cp = 0, where;
  while (t < maxTime) {
    for (const e of sim.step(autopilotInput(sim), dt)) {
      if (e.type === 'crash') {
        crashes++;
        (where ??= []).push(Math.round(sim.chassis.getPosition().x));
        if (crashes > maxCrashes) return { finished: false, time: t, crashes, where, x: sim.chassis.getPosition().x };
        sim.reset(track.checkpoints[cp]);
      }
    }
    t += dt;
    const p = sim.chassis.getPosition();
    for (let i = cp + 1; i < track.checkpoints.length; i++) if (p.x >= track.checkpoints[i].x) cp = i;
    if (p.y < track.killY) {
      crashes++;
      (where ??= []).push(`fell ${Math.round(p.x)}`);
      if (crashes > maxCrashes) return { finished: false, time: t, crashes, x: p.x };
      sim.reset(track.checkpoints[cp]);
    }
    if (p.x >= track.finishX) return { finished: true, time: t, crashes, where };
  }
  return { finished: false, time: t, crashes, x: sim.chassis.getPosition().x };
}
