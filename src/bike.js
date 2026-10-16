// The motorbike model. The chassis group follows the physics chassis; wheels are
// separate so they can spin and the forks stretch with the suspension.
import * as THREE from '../vendor/three.module.js';
import { toon, limb, buildRider } from './rider.js';
import { TUNING } from './physics.js';

const v = (x, y, z = 0) => new THREE.Vector3(x, y, z);

const MATS = () => ({
  red: toon('#d7262b'),
  darkRed: toon('#9e1a1f'),
  metal: toon('#c9ccd2'),
  engine: toon('#5b5f66'),
  black: toon('#1c1c1e'),
  tyre: toon('#232326'),
  light: toon('#fff4c2', { emissive: '#ffd36b', emissiveIntensity: 0.6 }),
  white: toon('#f4f4f4'),
});

function wheel(m) {
  const g = new THREE.Group();
  const r = TUNING.wheelRadius;
  g.add(new THREE.Mesh(new THREE.TorusGeometry(r - 0.075, 0.075, 10, 28), m.tyre));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r - 0.15, 0.022, 6, 24), m.metal);
  g.add(rim);
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

export class BikeModel {
  constructor(style) {
    const m = (this.mats = MATS());
    this.root = new THREE.Group(); // added to the scene
    this.chassis = new THREE.Group();
    this.root.add(this.chassis);

    const c = this.chassis;
    c.add(box(0.4, 0.26, 0.26, m.engine, -0.02, -0.12));
    const tank = limb(v(-0.05, 0.14), v(0.32, 0.2), 0.12, m.red);
    tank.scale.set(1, 1, 1.25);
    c.add(tank);
    c.add(box(0.52, 0.08, 0.24, m.black, -0.33, 0.24, 0, 0.08));
    c.add(box(0.46, 0.05, 0.2, m.red, -0.66, 0.2, 0, 0.25));
    c.add(box(0.3, 0.2, 0.04, m.white, -0.36, 0.06, 0.14)); // number board
    c.add(limb(v(-0.1, -0.2, 0.17), v(-0.68, 0.02, 0.17), 0.045, m.metal)); // exhaust
    c.add(limb(v(0.42, 0.25), v(0.44, 0.58), 0.03, m.black)); // bar riser
    c.add(limb(v(0.44, 0.6, -0.26), v(0.44, 0.6, 0.26), 0.025, m.black)); // handlebar
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.06, 14), m.light);
    lamp.rotation.z = Math.PI / 2;
    lamp.position.set(0.56, 0.38, 0);
    c.add(lamp);
    c.add(box(0.12, 0.2, 0.22, m.red, 0.5, 0.36));

    // Forks and swingarm are stretched between the frame and the wheels every frame.
    this.fork = new THREE.Group();
    this.swingarm = new THREE.Group();
    const tube = (r, mat, z) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), mat);
      t.position.z = z;
      return t;
    };
    for (const z of [-0.11, 0.11]) {
      this.fork.add(tube(0.03, m.metal, z));
      this.swingarm.add(tube(0.035, m.black, z));
    }
    this.frontFender = box(0.4, 0.04, 0.2, m.red, 0, 0, 0);
    c.add(this.fork, this.swingarm, this.frontFender);

    this.rearWheel = wheel(m);
    this.frontWheel = wheel(m);
    this.root.add(this.rearWheel, this.frontWheel);

    this.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.setStyle(style);
  }

  setStyle(style) {
    this.style = style;
    this.resetRider();
  }

  resetRider() {
    if (this.rider) this.rider.group.removeFromParent();
    this.rider = buildRider(this.style);
    this.rider.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.chassis.add(this.rider.group);
    this.thrown = null;
  }

  // On a crash the rider flies off the bike and tumbles (no physics, just a toss).
  throwRider(vel) {
    const g = this.rider.group;
    this.chassis.updateMatrixWorld();
    g.updateMatrixWorld();
    const m = g.matrixWorld.clone();
    this.root.add(g);
    m.decompose(g.position, g.quaternion, g.scale);
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
    stretch(this.fork, v(0.42, 0.27), fw);
    stretch(this.swingarm, v(-0.12, -0.12), rw);
    this.frontFender.position.copy(fw).add(v(-0.04, TUNING.wheelRadius + 0.05));
    this.frontFender.rotation.z = -0.2;

    if (this.rider && !this.thrown) {
      const r = this.rider;
      r.upper.rotation.z += (lean * 0.32 - r.upper.rotation.z) * 0.25;
      if (r.scarfTail) r.scarfTail.rotation.z = Math.sin(time * 18) * 0.12 * Math.min(1, speed / 8) + 0.05;
    }
  }

  // A standing pose for the showroom.
  restPose(x = 0, y = 0) {
    const t = TUNING;
    return {
      chassis: { x, y, angle: 0 },
      rear: { x: x + t.rearWheel[0], y: y + t.rearWheel[1], angle: 0 },
      front: { x: x + t.frontWheel[0], y: y + t.frontWheel[1], angle: 0 },
    };
  }
}
