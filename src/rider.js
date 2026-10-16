// The rider, built from the player's start.ng character style.
// Coordinates are the bike's: +x forward, +y up, +z towards the camera (metres).
import * as THREE from '../vendor/three.module.js';

export const DEFAULT_STYLE = {
  body: 'male',
  primaryColor: '#e8483b',
  secondaryColor: '#2b2f4a',
  skinColor: '#8d5524',
  hairColor: '#17120f',
  hair: 'short',
  hat: 'none',
  accessory: 'none',
};

const OPTIONS = {
  body: ['female', 'male'],
  hair: ['short', 'afro', 'braids', 'bun', 'ponytail', 'dreads', 'bald'],
  hat: ['none', 'cap', 'beanie', 'tophat', 'crown'],
  accessory: ['none', 'glasses', 'earrings', 'beard', 'scarf', 'backpack'],
};

// start.ng may add options later: anything we don't know falls back to the default.
export function normalizeStyle(style) {
  const out = { ...DEFAULT_STYLE };
  if (!style || typeof style !== 'object') return out;
  for (const key of ['primaryColor', 'secondaryColor', 'skinColor', 'hairColor']) {
    if (/^#[0-9a-f]{6}$/i.test(style[key] ?? '')) out[key] = style[key];
  }
  for (const [key, values] of Object.entries(OPTIONS)) {
    if (values.includes(style[key])) out[key] = style[key];
  }
  return out;
}

let gradient;
export function toonGradient() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export const toon = (color, extra = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });

const v = (x, y, z = 0) => new THREE.Vector3(x, y, z);

// A capsule from a to b.
export function limb(a, b, r, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, 10), material);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(v(0, 1, 0), dir.normalize());
  return m;
}

const sphere = (r, material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), material);
  m.position.set(x, y, z);
  return m;
};

// Top part of a sphere (hair, hat domes), tilted back so it covers the back of the head.
const dome = (r, material, cover = 0.5, tilt = 0.45) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI * cover), material);
  m.rotation.z = tilt;
  return m;
};

function darker(hex, f) {
  return new THREE.Color(hex).multiplyScalar(f);
}

// Pose points on the bike (chassis space).
const HIPS = v(-0.28, 0.32);
const SHOULDER = v(-0.06, 0.86);
const HEAD = v(0.02, 1.14);
const HEAD_R = 0.21;
const ELBOW = v(0.16, 0.66);
const HAND = v(0.42, 0.62);
const KNEE = v(0.14, 0.36);
const FOOT = v(-0.02, -0.1);

// Returns { group, upper, scarfTail } where `upper` leans around the hips.
export function buildRider(rawStyle) {
  const style = normalizeStyle(rawStyle);
  const female = style.body === 'female';
  const top = toon(style.primaryColor);
  const bottom = toon(style.secondaryColor);
  const skin = toon(style.skinColor);
  const hair = toon(style.hairColor);
  const shoe = toon('#1b1b1f');
  const black = toon('#141414');
  const gold = toon('#f2c230', { emissive: '#5a3c00' });

  const group = new THREE.Group();
  group.name = 'rider';
  const rel = (p, z = 0) => v(p.x - HIPS.x, p.y - HIPS.y, z);
  group.position.copy(HIPS);

  // Legs stay on the pegs.
  const legR = female ? 0.07 : 0.08;
  for (const z of [-0.14, 0.14]) {
    group.add(limb(rel(v(0, 0), z), rel(KNEE, z), legR, bottom));
    group.add(limb(rel(KNEE, z), rel(FOOT, z), legR * 0.9, bottom));
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.11), shoe);
    boot.position.copy(rel(FOOT, z)).add(v(0.05, -0.02));
    group.add(boot);
  }

  // Upper body leans with the player's input.
  const upper = new THREE.Group();
  group.add(upper);
  const torsoR = female ? 0.15 : 0.18;
  upper.add(limb(v(0, 0.02), rel(SHOULDER), torsoR, top));
  if (female) upper.add(sphere(0.16, bottom, 0, 0.02)); // a little skirt/hip shape

  const armR = female ? 0.055 : 0.065;
  for (const z of [-0.19, 0.19]) {
    upper.add(limb(rel(SHOULDER, z * 0.9), rel(ELBOW, z), armR, top));
    upper.add(limb(rel(ELBOW, z), rel(HAND, z), armR * 0.9, top));
    upper.add(sphere(0.06, skin, ...rel(HAND, z).toArray()));
  }
  upper.add(limb(rel(SHOULDER), rel(HEAD).add(v(-0.02, -0.12)), 0.06, skin)); // neck

  // Head, facing +x.
  const head = new THREE.Group();
  head.position.copy(rel(HEAD));
  upper.add(head);
  head.add(sphere(HEAD_R, skin));
  for (const z of [-0.075, 0.075]) head.add(sphere(0.03, black, HEAD_R * 0.86, 0.03, z));
  head.add(sphere(0.035, skin, HEAD_R * 0.98, -0.03, 0)); // nose

  addHair(head, style.hair, hair);
  addHat(head, style.hat, style);
  const scarfTail = addAccessory({ head, upper, rel }, style, { black, gold, hair, bottom });

  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group, upper, scarfTail, style };
}

function addHair(head, kind, mat) {
  if (kind === 'bald') return;
  head.add(dome(HEAD_R * 1.07, mat, 0.52, 0.5));
  switch (kind) {
    case 'afro': head.add(sphere(0.27, mat, -0.11, 0.11)); break;
    case 'bun': head.add(sphere(0.095, mat, -0.19, 0.15)); break;
    case 'ponytail': {
      head.add(sphere(0.05, mat, -0.21, 0.06));
      head.add(limb(v(-0.22, 0.05), v(-0.42, -0.14), 0.055, mat));
      break;
    }
    case 'braids':
      for (let i = 0; i < 5; i++) {
        const z = -0.14 + i * 0.07;
        head.add(limb(v(-0.15, 0.02, z), v(-0.24, -0.32, z * 1.1), 0.026, mat));
      }
      break;
    case 'dreads':
      for (let i = 0; i < 8; i++) {
        const a = Math.PI * (0.55 + (i / 7) * 0.9); // round the back of the head
        const x = Math.cos(a) * 0.17, z = Math.sin(a + Math.PI / 2) * 0.17;
        head.add(limb(v(x, 0.04, z), v(x * 1.5 - 0.06, -0.3, z * 1.3), 0.036, mat));
      }
      break;
  }
}

function addHat(head, kind, style) {
  const hatMat = toon(style.secondaryColor);
  switch (kind) {
    case 'cap': {
      head.add(dome(HEAD_R * 1.12, hatMat, 0.42, 0.25));
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.3), hatMat);
      brim.position.set(HEAD_R + 0.04, 0.1, 0);
      brim.rotation.z = -0.15;
      head.add(brim);
      break;
    }
    case 'beanie': {
      head.add(dome(HEAD_R * 1.13, hatMat, 0.5, 0.3));
      head.add(sphere(0.06, toon('#ffffff'), -0.05, HEAD_R + 0.07));
      break;
    }
    case 'tophat': {
      const black = toon('#151515');
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 24), black);
      brim.position.y = HEAD_R * 0.78;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.32, 24), black);
      crown.position.y = HEAD_R * 0.78 + 0.17;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.182, 0.182, 0.05, 24), toon('#c0392b'));
      band.position.y = HEAD_R * 0.78 + 0.05;
      head.add(brim, crown, band);
      break;
    }
    case 'crown': {
      const gold = toon('#f5c518', { emissive: '#6b4a00' });
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.1, 20, 1, true), gold);
      ring.material.side = THREE.DoubleSide;
      ring.position.y = HEAD_R * 0.86;
      head.add(ring);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.11, 6), gold);
        spike.position.set(Math.cos(a) * 0.16, HEAD_R * 0.86 + 0.1, Math.sin(a) * 0.16);
        head.add(spike);
      }
      head.add(sphere(0.03, toon('#e0245e'), 0.17, HEAD_R * 0.86 + 0.02, 0));
      break;
    }
  }
}

function addAccessory({ head, upper, rel }, style, mats) {
  switch (style.accessory) {
    case 'glasses':
      for (const z of [-0.075, 0.075]) {
        const lens = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 20), mats.black);
        lens.position.set(HEAD_R * 0.95, 0.03, z);
        lens.rotation.y = Math.PI / 2;
        head.add(lens);
      }
      head.add(limb(v(HEAD_R * 0.97, 0.03, -0.03), v(HEAD_R * 0.97, 0.03, 0.03), 0.01, mats.black));
      for (const z of [-0.19, 0.19]) head.add(limb(v(HEAD_R * 0.9, 0.03, z * 0.62), v(-0.02, 0.03, z), 0.01, mats.black));
      break;
    case 'earrings':
      for (const z of [-HEAD_R, HEAD_R]) head.add(sphere(0.035, mats.gold, 0.0, -0.1, z * 0.97));
      break;
    case 'beard': {
      const beard = sphere(HEAD_R * 0.78, mats.hair, 0.06, -0.09, 0);
      beard.scale.set(1, 0.75, 1.15);
      head.add(beard);
      break;
    }
    case 'scarf': {
      const scarfMat = toon('#ffcc33');
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.05, 8, 18), scarfMat);
      ring.position.copy(rel(SHOULDER)).add(v(0.02, 0.1));
      ring.rotation.x = Math.PI / 2;
      upper.add(ring);
      // The tail flaps in the wind (animated in render.js).
      const tail = new THREE.Group();
      tail.position.copy(ring.position).add(v(-0.08, 0, 0.05));
      tail.add(limb(v(0, 0), v(-0.45, -0.05), 0.045, scarfMat));
      upper.add(tail);
      return tail;
    }
    case 'backpack': {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, 0.32), toon(darker(style.secondaryColor, 0.8).getStyle()));
      const mid = rel(SHOULDER).multiplyScalar(0.55);
      pack.position.copy(mid).add(v(-0.18, 0.04));
      pack.rotation.z = Math.atan2(SHOULDER.y - HIPS.y, SHOULDER.x - HIPS.x) - Math.PI / 2;
      upper.add(pack);
      break;
    }
  }
  return null;
}
