// The motorbike model. The chassis group follows the physics chassis; wheels are
// separate so they can spin and the forks stretch with the suspension.
// Five bike designs (see garage.js), each in any paint.
import * as THREE from '../vendor/three.module.js';
import { toon, limb, buildRider } from './rider.js';
import { TUNING } from './physics.js';
import { bikeById, paintById, tuningFor } from './garage.js';

const v = (x, y, z = 0) => new THREE.Vector3(x, y, z);

function mats(paint) {
  return {
    paint: toon(paint.main, paint.shine ? { emissive: '#5a3c00', emissiveIntensity: 0.35 } : {}),
    accent: toon(paint.accent),
    metal: toon('#c9ccd2'),
    chrome: toon('#e8ecf2', { emissive: '#30343a' }),
    engine: toon('#5b5f66'),
    black: toon('#1c1c1e'),
    tyre: toon('#232326'),
    light: toon('#fff4c2', { emissive: '#ffd36b', emissiveIntensity: 0.6 }),
    glass: toon('#9cc9e0', { transparent: true, opacity: 0.55 }),
  };
}

function wheel(m, r, chunky) {
  const g = new THREE.Group();
  const tyre = chunky ? 0.085 : 0.075;
  g.add(new THREE.Mesh(new THREE.TorusGeometry(r - tyre, tyre, 10, 28), m.tyre));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(r - 0.15, 0.022, 6, 24), m.metal));
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry((r - 0.15) * 2, 0.03, 0.02), m.metal);
    spoke.rotation.z = (i / 3) * Math.PI;
    g.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 12), m.engine);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  return g;
}

const box = (w, h, d, mat, x, y, z = 0, rz = 0) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  b.position.set(x, y, z);
  b.rotation.z = rz;
  return b;
};

const lamp = (m, x, y, r = 0.08) => {
  const l = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.75, 0.06, 14), m.light);
  l.rotation.z = Math.PI / 2;
  l.position.set(x, y, 0);
  return l;
};

const bars = (m, x, y, half = 0.26) => limb(v(x, y, -half), v(x, y, half), 0.025, m.black);

// Each design: frame parts, plus where the forks and swingarm attach.
// head: top of the front forks. pivot: swingarm pivot. All in chassis space.
const DESIGNS = {
  dirt(g, m) {
    g.add(box(0.4, 0.26, 0.26, m.engine, -0.02, -0.12));
    const tank = limb(v(-0.05, 0.14), v(0.32, 0.2), 0.12, m.paint);
    tank.scale.set(1, 1, 1.25);
    g.add(tank);
    g.add(box(0.52, 0.08, 0.24, m.black, -0.33, 0.24, 0, 0.08));
    g.add(box(0.46, 0.05, 0.2, m.paint, -0.66, 0.2, 0, 0.25));
    g.add(box(0.3, 0.2, 0.04, m.accent, -0.36, 0.06, 0.14)); // number board
    g.add(limb(v(-0.1, -0.2, 0.17), v(-0.68, 0.02, 0.17), 0.045, m.metal)); // exhaust
    g.add(limb(v(0.42, 0.25), v(0.44, 0.58), 0.03, m.black), bars(m, 0.44, 0.6));
    g.add(lamp(m, 0.56, 0.38), box(0.12, 0.2, 0.22, m.paint, 0.5, 0.36));
    return { head: v(0.42, 0.27), pivot: v(-0.12, -0.12), fender: true };
  },
  trials(g, m) {
    // Skinny frame, tiny tank, no real seat: you stand on these.
    g.add(limb(v(0.4, 0.28), v(-0.12, -0.14), 0.035, m.paint));
    g.add(limb(v(0.4, 0.28), v(-0.42, 0.18), 0.03, m.paint));
    g.add(limb(v(-0.42, 0.18), v(-0.12, -0.14), 0.03, m.paint));
    g.add(box(0.3, 0.22, 0.2, m.engine, 0.02, -0.1));
    g.add(limb(v(0.05, 0.18), v(0.25, 0.22), 0.07, m.paint));
    g.add(box(0.3, 0.04, 0.16, m.black, -0.4, 0.22, 0, 0.1));
    g.add(box(0.36, 0.04, 0.18, m.paint, -0.72, 0.24, 0, 0.35));
    g.add(limb(v(0.42, 0.27), v(0.46, 0.66), 0.03, m.black), bars(m, 0.46, 0.66, 0.3));
    g.add(box(0.2, 0.18, 0.04, m.accent, 0.48, 0.42, 0, -0.3));
    return { head: v(0.42, 0.28), pivot: v(-0.12, -0.14), fender: true };
  },
  sport(g, m) {
    // Full fairing, windscreen, clip-on bars, pointed tail.
    g.add(box(0.42, 0.28, 0.28, m.engine, -0.02, -0.12));
    const nose = limb(v(0.12, 0.12), v(0.56, 0.3), 0.17, m.paint);
    nose.scale.set(1, 1, 1.15);
    g.add(nose);
    g.add(box(0.5, 0.18, 0.3, m.paint, 0.18, -0.05, 0, 0.12)); // belly pan
    const screen = box(0.04, 0.22, 0.26, m.glass, 0.56, 0.47, 0, -0.55);
    g.add(screen);
    g.add(limb(v(0.0, 0.2), v(0.26, 0.26), 0.12, m.paint));
    g.add(box(0.36, 0.07, 0.22, m.black, -0.3, 0.24, 0, 0.12));
    const tail = limb(v(-0.44, 0.26), v(-0.8, 0.38), 0.09, m.paint);
    g.add(tail);
    g.add(box(0.3, 0.04, 0.31, m.accent, 0.3, 0.2, 0, 0.35)); // stripe
    g.add(limb(v(-0.3, -0.15, 0.15), v(-0.7, 0.05, 0.15), 0.06, m.chrome));
    g.add(bars(m, 0.4, 0.46, 0.24));
    g.add(lamp(m, 0.66, 0.32, 0.06));
    return { head: v(0.44, 0.3), pivot: v(-0.12, -0.12), fender: true };
  },
  stunt(g, m) {
    // A light tube frame, stubby seat, cross-braced bars, foot pegs.
    g.add(limb(v(0.42, 0.28), v(-0.1, -0.12), 0.04, m.paint));
    g.add(limb(v(0.42, 0.28), v(-0.4, 0.22), 0.035, m.paint));
    g.add(limb(v(-0.4, 0.22), v(-0.1, -0.12), 0.035, m.paint));
    g.add(box(0.28, 0.2, 0.2, m.engine, 0.02, -0.08));
    g.add(box(0.3, 0.07, 0.18, m.black, -0.38, 0.27, 0, 0.05));
    g.add(limb(v(0.42, 0.27), v(0.45, 0.6), 0.03, m.black), bars(m, 0.45, 0.62, 0.28));
    g.add(limb(v(0.45, 0.52, -0.2), v(0.45, 0.52, 0.2), 0.018, m.black)); // cross brace
    for (const z of [-0.2, 0.2]) g.add(limb(v(-0.05, -0.12, z * 0.7), v(-0.05, -0.12, z), 0.03, m.metal)); // pegs
    g.add(box(0.22, 0.2, 0.04, m.accent, 0.5, 0.4, 0, -0.25));
    return { head: v(0.42, 0.27), pivot: v(-0.1, -0.12), fender: false };
  },
  chopper(g, m) {
    // Raked-out forks, teardrop tank, chrome pipes, sissy bar.
    g.add(box(0.4, 0.3, 0.26, m.chrome, -0.02, -0.12));
    const tank = limb(v(-0.02, 0.12), v(0.34, 0.24), 0.13, m.paint);
    tank.scale.set(1, 1, 1.15);
    g.add(tank);
    g.add(box(0.4, 0.08, 0.26, m.black, -0.3, 0.12, 0, -0.05));
    g.add(limb(v(-0.5, 0.12), v(-0.62, 0.62), 0.025, m.chrome)); // sissy bar
    g.add(box(0.5, 0.05, 0.22, m.paint, -0.76, 0.18, 0, 0.2));
    for (const z of [0.14, 0.2]) g.add(limb(v(-0.05, -0.18, z), v(-0.85, -0.06, z), 0.04, m.chrome));
    g.add(limb(v(0.5, 0.36), v(0.52, 0.72), 0.03, m.chrome), bars(m, 0.5, 0.72, 0.32));
    g.add(lamp(m, 0.62, 0.44, 0.09));
    g.add(box(0.36, 0.04, 0.27, m.accent, 0.12, 0.3, 0, 0.3)); // tank stripe
    return { head: v(0.5, 0.38), pivot: v(-0.14, -0.12), fender: true };
  },
};

export class BikeModel {
  // look: { bike, paint } from the Garage. options.ghost: a see-through copy for your best run.
  constructor(style, { ghost = false, look = { bike: 'dirt', paint: 'red' } } = {}) {
    this.isGhost = ghost;
    this.root = new THREE.Group(); // added to the scene
    this.chassis = new THREE.Group();
    this.root.add(this.chassis);
    this.style = style;
    this.setLook(look);
    this.setStyle(style);
  }

  // Rebuild the bike for a new design or paint (the rider stays).
  setLook({ bike = 'dirt', paint = 'red' } = {}) {
    this.look = { bike, paint };
    this.tuning = tuningFor(bike);
    const m = (this.mats = mats(paintById(paint)));
    if (this.frame) this.frame.removeFromParent();
    if (this.rearWheel) this.rearWheel.removeFromParent();
    if (this.frontWheel) this.frontWheel.removeFromParent();

    this.frame = new THREE.Group();
    const design = DESIGNS[bikeById(bike).id] ?? DESIGNS.dirt;
    this.anchors = design(this.frame, m);

    // Forks and swingarm are stretched between the frame and the wheels every frame.
    this.fork = new THREE.Group();
    this.swingarm = new THREE.Group();
    const tube = (r, mat, z) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), mat);
      t.position.z = z;
      return t;
    };
    for (const z of [-0.11, 0.11]) {
      this.fork.add(tube(0.03, bike === 'chopper' ? m.chrome : m.metal, z));
      this.swingarm.add(tube(0.035, m.black, z));
    }
    this.frontFender = box(0.4, 0.04, 0.2, m.paint, 0, 0, 0);
    this.frontFender.visible = this.anchors.fender;
    this.frame.add(this.fork, this.swingarm, this.frontFender);
    this.chassis.add(this.frame);

    const r = this.tuning.wheelRadius;
    this.rearWheel = wheel(m, r, bike === 'trials' || bike === 'chopper');
    this.frontWheel = wheel(m, r, bike === 'trials');
    this.root.add(this.rearWheel, this.frontWheel);
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = !this.isGhost; });
    if (this.isGhost) this.ghostify();
    if (this.lastSnap) this.update(this.lastSnap);
  }

  setStyle(style) {
    this.style = style;
    this.resetRider();
  }

  resetRider() {
    if (this.rider) this.rider.group.removeFromParent();
    this.rider = buildRider(this.style);
    this.rider.group.traverse((o) => { if (o.isMesh) o.castShadow = !this.isGhost; });
    this.chassis.add(this.rider.group);
    this.thrown = null;
    if (this.isGhost) this.ghostify();
  }

  // Make every material see-through and stop the ghost casting shadows.
  ghostify() {
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      if (!o.material.userData.ghost) {
        o.material = o.material.clone();
        Object.assign(o.material, { transparent: true, opacity: 0.32, depthWrite: false });
        o.material.userData.ghost = true;
      }
    });
  }

  // A pose for the ghost from just the chassis position (wheels at rest, spinning with distance).
  poseFromChassis(x, y, angle) {
    const t = this.tuning;
    const c = Math.cos(angle), s = Math.sin(angle);
    if (this.lastX !== undefined) this.spin = (this.spin ?? 0) - Math.hypot(x - this.lastX, y - this.lastY) / t.wheelRadius;
    this.lastX = x;
    this.lastY = y;
    const at = ([lx, ly]) => ({ x: x + c * lx - s * ly, y: y + s * lx + c * ly, angle: this.spin ?? 0 });
    return { chassis: { x, y, angle }, rear: at(t.rearWheel), front: at(t.frontWheel) };
  }

  // On a crash the rider flies off the bike and tumbles (no physics, just a toss).
  throwRider(vel) {
    const g = this.rider.group;
    this.chassis.updateMatrixWorld();
    g.updateMatrixWorld();
    const mtx = g.matrixWorld.clone();
    this.root.add(g);
    mtx.decompose(g.position, g.quaternion, g.scale);
    this.thrown = { vx: vel.x * 0.6 - 1, vy: Math.max(3, vel.y * 0.5 + 4.5), spin: 6 + Math.random() * 4 };
  }

  updateThrown(dt) {
    const t = this.thrown;
    if (!t) return;
    t.vy -= 14 * dt;
    const g = this.rider.group;
    g.position.x += t.vx * dt;
    g.position.y += t.vy * dt;
    g.rotation.z += t.spin * dt;
  }

  // Lay out parts around a pose. snap from BikeSim.snapshot(), or a fixed pose for menus.
  update(snap, { lean = 0, time = 0, speed = 0 } = {}) {
    this.lastSnap = snap;
    this.chassis.position.set(snap.chassis.x, snap.chassis.y, 0);
    this.chassis.rotation.z = snap.chassis.angle;
    this.rearWheel.position.set(snap.rear.x, snap.rear.y, 0);
    this.rearWheel.rotation.z = snap.rear.angle;
    this.frontWheel.position.set(snap.front.x, snap.front.y, 0);
    this.frontWheel.rotation.z = snap.front.angle;

    this.chassis.updateMatrixWorld();
    const local = (p) => this.chassis.worldToLocal(v(p.x, p.y));
    const stretch = (g, a, b) => {
      const d = new THREE.Vector3().subVectors(b, a);
      g.position.copy(a).addScaledVector(d, 0.5);
      g.rotation.z = Math.atan2(d.y, d.x) - Math.PI / 2;
      g.scale.set(1, d.length(), 1);
    };
    const fw = local(snap.front), rw = local(snap.rear);
    stretch(this.fork, this.anchors.head, fw);
    stretch(this.swingarm, this.anchors.pivot, rw);
    this.frontFender.position.copy(fw).add(v(-0.04, this.tuning.wheelRadius + 0.05));
    this.frontFender.rotation.z = -0.2;

    if (this.rider && !this.thrown) {
      const r = this.rider;
      r.upper.rotation.z += (lean * 0.32 - r.upper.rotation.z) * 0.25;
      if (r.scarfTail) r.scarfTail.rotation.z = Math.sin(time * 18) * 0.12 * Math.min(1, speed / 8) + 0.05;
    }
  }

  // A standing pose, e.g. for the showroom.
  restPose(x = 0, y = 0) {
    const t = this.tuning ?? TUNING;
    return {
      chassis: { x, y, angle: 0 },
      rear: { x: x + t.rearWheel[0], y: y + t.rearWheel[1], angle: 0 },
      front: { x: x + t.frontWheel[0], y: y + t.frontWheel[1], angle: 0 },
    };
  }
}
