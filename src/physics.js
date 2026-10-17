// 2D bike physics on Planck.js (Box2D). three.js only draws what this computes.
import * as planck from '../vendor/planck.mjs';
import { segmentIndexAt } from './track.js';

const { Vec2 } = planck;

export const TUNING = {
  gravity: -11,
  wheelRadius: 0.36,
  rearWheel: [-0.62, -0.42],
  frontWheel: [0.66, -0.42],
  chassisDensity: 4,
  riderDensity: 2,
  wheelDensity: 2,
  wheelFriction: 1.6,
  trackFriction: 1.0,
  suspensionHz: 4.5,
  suspensionDamping: 0.75,
  topSpeed: 62, // rad/s at the rear wheel
  motorTorque: 11,
  brakeTorque: 14,
  reverseSpeed: 14,
  reverseTorque: 5,
  coastBrake: 6,
  rollingTorque: 0.25,
  groundLeanTorque: 14,
  airSpin: 8.5, // rad/s you can spin at in the air
  airResponse: 7, // how quickly the spin follows your lean
  airDamping: 4,
  groundDamping: 3,
  head: [0.02, 1.14, 0.22], // rider head in chassis space: x, y, radius
  torso: [-0.18, 0.6, 0.2],
  windowBack: 6, // the bike only touches track within this distance of its progress
  windowAhead: 10,
  boostAccel: 32, // m/s² while on a boost pad
  boostTopSpeed: 34,
  seesawRise: 1.6, // how far the high end of a see-saw sits above the track
};

const CAT_TRACK = 0x1, CAT_WHEEL = 0x2, CAT_BODY = 0x4, CAT_CRATE = 0x8;

export class BikeSim {
  constructor(track, tuning = TUNING) {
    this.track = track;
    this.t = tuning;
    this.world = new planck.World({ gravity: Vec2(0, tuning.gravity) });
    this.progress = 0; // distance along the course (s) the bike is at
    this.dynamics = []; // see-saw planks and crates, for drawing: { kind, body, hw, hh }
    this.buildTrack();
    this.buildPieces();
    this.buildBike();
    this.world.on('pre-solve', (contact) => this.preSolve(contact));
  }

  buildTrack() {
    const ground = (this.ground = this.world.createBody());
    this.track.chains.forEach((chain, ci) => {
      const verts = chain.points.map((p) => Vec2(p.x, p.y));
      const f = ground.createFixture(planck.Chain(verts, false), {
        friction: this.track.friction ?? this.t.trackFriction, // ice levels are slippery
        filterCategoryBits: CAT_TRACK,
        filterMaskBits: CAT_WHEEL | CAT_CRATE,
      });
      f.setUserData({ chain: ci });
    });
  }

  // See-saws and crates: real bodies the bike pushes around.
  buildPieces() {
    const ground = this.ground;
    for (const sw of this.track.seesaws) {
      const half = sw.len / 2, thick = 0.18;
      const tilt = Math.atan2(this.t.seesawRise, sw.len); // the near end starts down, at track height
      const pivot = Vec2(sw.x0 + half, sw.y + half * Math.sin(tilt) - thick);
      const plank = this.world.createDynamicBody({ position: pivot, angle: tilt, angularDamping: 1.5, allowSleep: false });
      plank.createFixture(planck.Box(half, thick), {
        density: 1.5, friction: this.track.friction ?? this.t.trackFriction,
        filterCategoryBits: CAT_TRACK, filterMaskBits: CAT_WHEEL | CAT_CRATE,
      }).setUserData({ kind: 'plank' });
      // Joint limits are relative to the starting tilt: it can swing down to -tilt and no further up.
      this.world.createJoint(planck.RevoluteJoint({ enableLimit: true, lowerAngle: -2 * tilt, upperAngle: 0 }, ground, plank, pivot));
      this.dynamics.push({ kind: 'plank', body: plank, hw: half, hh: thick, home: { x: pivot.x, y: pivot.y, angle: tilt } });
    }
    for (const stack of this.track.crates) {
      // A little pyramid: rows of 3, 2, 1… until n crates are placed.
      const size = 0.42;
      let left = stack.n, row = 0;
      while (left > 0) {
        const inRow = Math.min(left, Math.max(1, Math.ceil(stack.n / 2) - row));
        for (let i = 0; i < inRow; i++) {
          const x = stack.x + (i - (inRow - 1) / 2) * size * 2.05;
          const y = stack.y + size + row * size * 2.02;
          const crate = this.world.createDynamicBody({ position: Vec2(x, y), allowSleep: true });
          crate.createFixture(planck.Box(size, size), {
            density: 0.12, friction: 0.2, restitution: 0.2,
            filterCategoryBits: CAT_CRATE, filterMaskBits: CAT_TRACK | CAT_WHEEL | CAT_CRATE,
          }).setUserData({ kind: 'crate' });
          this.dynamics.push({ kind: 'crate', body: crate, hw: size, hh: size, home: { x, y, angle: 0 }, smashed: false });
        }
        left -= inRow;
        row++;
      }
    }
  }

  buildBike() {
    const t = this.t;
    const body = (x, y) => this.world.createDynamicBody({ position: Vec2(x, y), allowSleep: false });
    this.chassis = body(0, 0);
    // The chassis and rider never touch the track: only the wheels do. The head and
    // torso are checked by hand so that hitting them crashes the rider.
    const noCollide = { filterCategoryBits: CAT_BODY, filterMaskBits: 0 };
    this.chassis.createFixture(planck.Box(0.68, 0.16, Vec2(0, 0), 0), { density: t.chassisDensity, ...noCollide });
    this.chassis.createFixture(planck.Box(0.18, 0.42, Vec2(-0.2, 0.55), 0), { density: t.riderDensity, ...noCollide });

    const wheel = ([wx, wy]) => {
      const w = body(wx, wy);
      w.createFixture(planck.Circle(t.wheelRadius), {
        density: t.wheelDensity,
        friction: t.wheelFriction,
        filterCategoryBits: CAT_WHEEL,
        filterMaskBits: CAT_TRACK | CAT_CRATE,
      });
      w.setUserData({ wheel: true });
      return w;
    };
    this.rear = wheel(t.rearWheel);
    this.front = wheel(t.frontWheel);
    const joint = (w) => this.world.createJoint(planck.WheelJoint({
      motorSpeed: 0, maxMotorTorque: t.rollingTorque, enableMotor: true,
      frequencyHz: t.suspensionHz, dampingRatio: t.suspensionDamping,
    }, this.chassis, w, w.getPosition(), Vec2(0, 1)));
    this.rearJoint = joint(this.rear);
    this.frontJoint = joint(this.front);
  }

  // Put the bike at a spawn point ({x, y, angle, s}) standing on the track.
  reset(spawn) {
    const t = this.t;
    const c = Math.cos(spawn.angle), s = Math.sin(spawn.angle);
    const lift = t.wheelRadius - t.rearWheel[1] + 0.05; // chassis height above track
    const cx = spawn.x - s * lift, cy = spawn.y + c * lift;
    const place = (b, lx, ly, angle) => {
      b.setTransform(Vec2(cx + c * lx - s * ly, cy + s * lx + c * ly), angle);
      b.setLinearVelocity(Vec2(0, 0));
      b.setAngularVelocity(0);
      b.setAwake(true);
    };
    // See-saws and crates ahead of the spawn go back to how they started.
    for (const d of this.dynamics) {
      if (d.home.x < spawn.x - 1) continue;
      d.body.setTransform(Vec2(d.home.x, d.home.y), d.home.angle);
      d.body.setLinearVelocity(Vec2(0, 0));
      d.body.setAngularVelocity(0);
      d.body.setActive(true);
      d.body.setAwake(true);
      d.smashed = false;
    }
    place(this.chassis, 0, 0, spawn.angle);
    place(this.rear, ...t.rearWheel, 0);
    place(this.front, ...t.frontWheel, 0);
    this.progress = spawn.s;
    this.crashed = false;
    this.coasting = false;
    this.airTime = 0;
    this.airSpin = 0;
    this.lastAngle = spawn.angle;
    this.rearGround = this.frontGround = true;
  }

  segmentOf(fixture, childIndex) {
    const data = fixture.getUserData();
    if (!data || data.chain === undefined) return null;
    return this.track.segments[this.track.chains[data.chain].segStart + childIndex];
  }

  // Only track near the bike's progress counts. This lets loops cross over themselves
  // and stops the far side of a loop from catching the bike on the way in.
  preSolve(contact) {
    const a = contact.getFixtureA(), b = contact.getFixtureB();
    // Only the bike's wheels are limited to nearby track; crates rest on track anywhere.
    if (a.getFilterCategoryBits() !== CAT_WHEEL && b.getFilterCategoryBits() !== CAT_WHEEL) return;
    const seg = this.segmentOf(a, contact.getChildIndexA()) ?? this.segmentOf(b, contact.getChildIndexB());
    if (!seg) return;
    if (seg.s1 < this.progress - this.t.windowBack || seg.s0 > this.progress + this.t.windowAhead) {
      contact.setEnabled(false);
    }
  }

  // Course position of the nearest track a wheel is touching, or null.
  // Also remembers that segment in this.contactSeg (used to judge landings).
  wheelContact(wheel) {
    let best = null;
    const p = wheel.getPosition();
    for (let ce = wheel.getContactList(); ce; ce = ce.next) {
      const c = ce.contact;
      if (!c.isTouching() || !c.isEnabled()) continue;
      let seg = this.segmentOf(c.getFixtureA(), c.getChildIndexA()) ?? this.segmentOf(c.getFixtureB(), c.getChildIndexB());
      if (!seg) {
        // On a plank or a crate: ground for flips and landings, sloped like the body.
        const other = c.getFixtureA().getBody() === wheel ? c.getFixtureB() : c.getFixtureA();
        if (!other.getUserData()?.kind) continue;
        const ang = other.getBody().getAngle();
        const dx = Math.cos(ang), dy = Math.sin(ang);
        seg = { ax: p.x - dx, ay: p.y - dy, bx: p.x + dx, by: p.y + dy, nx: -dy, ny: dx, len: 2, s0: this.progress - 1 };
      }
      const u = ((p.x - seg.ax) * (seg.bx - seg.ax) + (p.y - seg.ay) * (seg.by - seg.ay)) / (seg.len * seg.len);
      const s = seg.s0 + seg.len * Math.max(0, Math.min(1, u));
      if (best === null || Math.abs(s - this.progress) < Math.abs(best - this.progress)) {
        best = s;
        this.contactSeg = seg;
      }
    }
    return best;
  }

  // input: { throttle: 0|1, brake: 0|1, lean: -1..1 } (lean +1 = back / anticlockwise)
  step(input, dt) {
    const t = this.t;
    const events = [];
    // Brief hops off bumps still count as on the ground for control.
    const airborne = !this.rearGround && !this.frontGround && this.airTime > 0.1;

    if (this.coasting) {
      // Past the finish line: a gentle rear brake, no reverse, nothing to control.
      this.rearJoint.setMotorSpeed(0);
      this.rearJoint.setMaxMotorTorque(t.coastBrake);
      this.frontJoint.setMotorSpeed(0);
      this.frontJoint.setMaxMotorTorque(t.rollingTorque);
      const w = this.chassis.getAngularVelocity();
      this.chassis.setAngularVelocity(w * Math.exp(-t.groundDamping * dt));
    } else if (!this.crashed) {
      const rearSpeed = this.rear.getAngularVelocity();
      if (input.throttle) {
        this.rearJoint.setMotorSpeed(-t.topSpeed);
        // In the air the motor would just spin the bike backwards, so it's mostly cut.
        this.rearJoint.setMaxMotorTorque(airborne ? t.motorTorque * 0.08 : t.motorTorque);
        this.frontJoint.setMotorSpeed(0);
        this.frontJoint.setMaxMotorTorque(t.rollingTorque);
      } else if (input.brake) {
        const rolling = rearSpeed < -2;
        const speed = rolling ? 0 : t.reverseSpeed;
        const torque = rolling ? t.brakeTorque : t.reverseTorque;
        this.rearJoint.setMotorSpeed(speed);
        this.rearJoint.setMaxMotorTorque(torque);
        this.frontJoint.setMotorSpeed(rolling ? 0 : speed);
        this.frontJoint.setMaxMotorTorque(rolling ? torque : t.rollingTorque);
      } else {
        for (const j of [this.rearJoint, this.frontJoint]) {
          j.setMotorSpeed(0);
          j.setMaxMotorTorque(t.rollingTorque);
        }
      }

      const w = this.chassis.getAngularVelocity();
      if (airborne) {
        if (input.lean) {
          const target = input.lean * t.airSpin;
          this.chassis.setAngularVelocity(w + (target - w) * Math.min(1, t.airResponse * dt));
        } else {
          // Hands off: the spin dies away slowly, so small hops don't end in a crash.
          this.chassis.setAngularVelocity(w * Math.exp(-t.airDamping * dt));
        }
      } else if (input.lean) {
        this.chassis.applyTorque(input.lean * t.groundLeanTorque, true);
      } else {
        this.chassis.setAngularVelocity(w * Math.exp(-t.groundDamping * dt));
      }
    } else {
      for (const j of [this.rearJoint, this.frontJoint]) {
        j.setMotorSpeed(0);
        j.setMaxMotorTorque(t.rollingTorque * 4);
      }
    }

    const vBefore = this.chassis.getLinearVelocity();
    const vx = vBefore.x, vy = vBefore.y;
    this.world.step(dt, 8, 3);

    // Ground contact and course progress.
    const rs = this.wheelContact(this.rear), fs = this.wheelContact(this.front);
    this.rearGround = rs !== null;
    this.frontGround = fs !== null;
    if (rs !== null || fs !== null) {
      this.progress = Math.max(rs ?? -Infinity, fs ?? -Infinity);
    } else {
      this.progressInAir();
    }

    // Flips: add up rotation while in the air, count them on landing.
    const angle = this.chassis.getAngle();
    let d = angle - this.lastAngle;
    this.lastAngle = angle;
    const nowAir = !this.rearGround && !this.frontGround;
    if (nowAir) {
      this.airTime += dt;
      this.airSpin += d;
    } else {
      if (this.airTime > 0.25 && !this.crashed && this.contactSeg) {
        // How the bike met the track: a full turn within ~40° counts as a flip,
        // and landing within 12° of the slope is a PERFECT landing.
        const g = this.contactSeg;
        const slope = Math.atan2(g.by - g.ay, g.bx - g.ax);
        let off = angle - slope;
        off = Math.abs(Math.atan2(Math.sin(off), Math.cos(off)));
        const flips = Math.floor((Math.abs(this.airSpin) + 0.7) / (Math.PI * 2));
        events.push({
          type: 'land',
          air: this.airTime,
          flips,
          back: this.airSpin > 0,
          perfect: off < (12 * Math.PI) / 180,
          impact: Math.abs(vx * g.nx + vy * g.ny), // speed into the track
        });
      }
      this.airTime = 0;
      this.airSpin = 0;
    }

    // Boost pads push the bike along while a wheel is on them.
    const cpos = this.chassis.getPosition();
    const pad = (this.rearGround || this.frontGround) && !this.crashed
      ? this.track.boosts.find((b) => cpos.x >= b.x0 - 0.5 && cpos.x <= b.x1 && Math.abs(cpos.y - b.y - 0.8) < 1.6)
      : null;
    if (pad) {
      const v = this.chassis.getLinearVelocity();
      if (v.x < t.boostTopSpeed) {
        const m = this.chassis.getMass() + this.rear.getMass() + this.front.getMass();
        this.chassis.applyForceToCenter(Vec2(t.boostAccel * m, 0), true);
      }
      if (this.onPad !== pad) events.push({ type: 'boost' });
    }
    this.onPad = pad;

    // A crate that's hit hard or knocked away smashes: it bursts and is gone a moment
    // later, so the pieces never litter the track ahead.
    for (const d of this.dynamics) {
      if (d.kind !== 'crate') continue;
      if (d.smashed) {
        if (d.body.isActive() && (d.gone -= dt) <= 0) d.body.setActive(false);
        continue;
      }
      const q = d.body.getPosition();
      if (d.body.getLinearVelocity().length() > 3 || Math.hypot(q.x - d.home.x, q.y - d.home.y) > 1) {
        d.smashed = true;
        d.gone = 0.25;
        if (!this.coasting) events.push({ type: 'smash', x: q.x, y: q.y });
      }
    }

    if (this.coasting) return [];
    if (!this.crashed && this.riderHitsTrack()) {
      this.crashed = true;
      events.push({ type: 'crash' });
    }
    return events;
  }

  // In the air, keep progress on the track below the bike (first match ahead).
  progressInAir() {
    const segs = this.track.segments;
    const x = this.chassis.getPosition().x;
    let i = segmentIndexAt(this.track, this.progress);
    const limit = this.progress + 90;
    for (; i < segs.length && segs[i].s0 < limit; i++) {
      const g = segs[i];
      if (g.bx > g.ax && x >= g.ax && x <= g.bx) {
        if (g.s0 > this.progress + 1) this.progress = g.s0 - 1;
        return;
      }
    }
  }

  riderHitsTrack() {
    const segs = this.track.segments;
    const pts = [this.t.head, this.t.torso].map(([lx, ly, r]) => {
      const p = this.chassis.getWorldPoint(Vec2(lx, ly));
      return [p.x, p.y, r];
    });
    let i = segmentIndexAt(this.track, this.progress - this.t.windowBack);
    const end = this.progress + this.t.windowAhead;
    for (; i < segs.length && segs[i].s0 <= end; i++) {
      const g = segs[i];
      for (const [px, py, r] of pts) {
        const vx = g.bx - g.ax, vy = g.by - g.ay;
        const u = Math.max(0, Math.min(1, ((px - g.ax) * vx + (py - g.ay) * vy) / (g.len * g.len)));
        const dx = g.ax + vx * u - px, dy = g.ay + vy * u - py;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  }

  get speed() {
    return this.chassis.getLinearVelocity().length();
  }

  snapshot() {
    const pose = (b) => ({ x: b.getPosition().x, y: b.getPosition().y, angle: b.getAngle() });
    return {
      chassis: pose(this.chassis),
      rear: pose(this.rear),
      front: pose(this.front),
      // Suspension travel, for drawing the forks.
      rearTravel: this.rearJoint.getJointTranslation(),
      frontTravel: this.frontJoint.getJointTranslation(),
    };
  }
}
