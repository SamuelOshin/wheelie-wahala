// The three.js scene: sky, desert scenery, track meshes, flags and the camera.
import * as THREE from '../vendor/three.module.js';
import { toon, limb } from './rider.js';
import { spawnAtX } from './track.js';

const THEMES = {
  desert: {
    sky: ['#f9c74f', '#fbd986', '#f6c9a0'],
    fog: '#f1c7a6',
    floor: '#eab48c',
    rocks: ['#d98760', '#c9744f', '#e19a73', '#cf805c'],
    sun: '#fff3c4',
  },
};

const STYLES = {
  ground: { front: '#9a4422', spots: '#86391b', crust: '#e59a5a', top: '#f0b778', thick: 0.45, depth: 7 },
  line: { front: '#8e1b1b', top: '#a62424', thick: 0.12, depth: 1.4 },
  wood: { front: '#b4612c', spots: '#9f5324', crust: '#f2ab60', top: '#f6bf7c', under: '#7d3c18', thick: 0.55, depth: 2.2 },
  ice: { front: '#3d7cc6', spots: '#3570b6', crust: '#bfe6ff', top: '#e0f4ff', under: '#2a5e9c', thick: 0.55, depth: 2.2 },
};

// Small seeded random so every level's scenery is the same each time.
function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function skyTexture(colors) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.55, colors[1]);
  grad.addColorStop(1, colors[2]);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Rocky texture for the front faces of the track.
const spotCache = new Map();
function spotTexture(base, spot) {
  const key = base + spot;
  if (spotCache.has(key)) return spotCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = spot;
  const r = rng(key);
  for (let i = 0; i < 40; i++) {
    const x = r() * 256, y = r() * 256, w = 6 + r() * 16;
    for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      g.beginPath();
      g.ellipse(x + dx, y + dy, w, w * (0.5 + r() * 0.3), r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  spotCache.set(key, tex);
  return tex;
}

// A strip of quads between two rows of points (same length).
function strip(rowA, rowB, material, uv) {
  const n = rowA.length;
  const pos = new Float32Array(n * 6);
  const uvs = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    rowA[i].toArray(pos, i * 6);
    rowB[i].toArray(pos, i * 6 + 3);
    if (uv) {
      uv(rowA[i], uvs, i * 4);
      uv(rowB[i], uvs, i * 4 + 2);
    }
  }
  const index = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    index.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

// Smoothed normals at each point of a chain.
function pointNormals(points) {
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  });
}

const worldUV = (scale) => (p, arr, o) => {
  arr[o] = p.x / scale;
  arr[o + 1] = p.y / scale;
};

function trackMesh(chain, bottomY) {
  const st = STYLES[chain.style] ?? STYLES.ground;
  const group = new THREE.Group();
  const pts = chain.points;
  const nrm = pointNormals(pts);
  const zF = st.depth / 2, zB = -st.depth / 2;
  const at = (i, along, z) => new THREE.Vector3(pts[i].x - nrm[i].x * along, pts[i].y - nrm[i].y * along, z);
  const row = (along, z) => pts.map((_, i) => at(i, along, z));
  const side = THREE.DoubleSide;

  // Riding surface.
  group.add(strip(row(0, zB), row(0, zF), toon(st.top, { side })));

  if (chain.style === 'ground') {
    // Lighter crust, then the earth all the way down.
    group.add(strip(row(0, zF), row(st.thick, zF), toon(st.crust, { side })));
    const down = pts.map((p, i) => new THREE.Vector3(p.x - nrm[i].x * st.thick, bottomY, zF));
    const tex = spotTexture(st.front, st.spots);
    group.add(strip(row(st.thick, zF), down, toon('#ffffff', { map: tex, side }), worldUV(6)));
  } else if (chain.style === 'line') {
    group.add(strip(row(0, zF), row(st.thick, zF), toon(st.front, { side })));
    group.add(strip(row(st.thick, zB), row(st.thick, zF), toon(st.front, { side })));
  } else {
    const tex = spotTexture(st.front, st.spots);
    group.add(strip(row(0, zF), row(0.12, zF), toon(st.crust, { side })));
    group.add(strip(row(0.12, zF), row(st.thick, zF), toon('#ffffff', { map: tex, side }), worldUV(3)));
    group.add(strip(row(st.thick, zB), row(st.thick, zF), toon(st.under, { side })));
    group.add(strip(row(0, zB), row(st.thick, zB), toon(st.under, { side })));
  }
  return group;
}

function flag(colorA, colorB, checkered) {
  const g = new THREE.Group();
  g.add(limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 3.2, 0), 0.05, toon('#b98a3e')));
  let mat;
  if (checkered) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 40;
    const x = c.getContext('2d');
    for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) {
      x.fillStyle = (i + j) % 2 ? colorA : colorB;
      x.fillRect(i * 8, j * 8, 8, 8);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    mat = toon('#ffffff', { map: tex, side: THREE.DoubleSide });
  } else {
    mat = toon(colorA, { side: THREE.DoubleSide });
  }
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.85, 8, 1), mat);
  cloth.position.set(0.72, 2.75, 0);
  g.add(cloth);
  g.userData.cloth = cloth;
  return g;
}

export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 600);
    this.camera.position.set(0, 2, 16);

    const hemi = new THREE.HemisphereLight('#fff3d6', '#c98a6a', 1.6);
    this.sun = new THREE.DirectionalLight('#fff1d0', 2.2);
    this.sun.position.set(-6, 14, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -8;
    sc.right = sc.top = 8;
    sc.near = 1;
    sc.far = 40;
    this.scene.add(hemi, this.sun, this.sun.target);

    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);
    this.camState = null;
    this.flags = [];
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  // high: sharp + soft shadows · medium: 1.5x pixels, shadows · low: 1x pixels, no shadows.
  setQuality(q) {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(Math.min(dpr, q === 'high' ? 2 : q === 'medium' ? 1.5 : 1));
    this.sun.castShadow = q !== 'low';
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  clear() {
    this.levelGroup.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.scene.remove(this.levelGroup);
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);
    this.flags = [];
  }

  buildLevel(level, track) {
    this.clear();
    const theme = THEMES[level.theme ?? 'desert'];
    this.scene.background = skyTexture(theme.sky);
    this.scene.fog = new THREE.Fog(theme.fog, 60, 330);

    let minY = Infinity, maxX = -Infinity, minX = Infinity;
    for (const ch of track.chains) for (const p of ch.points) {
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      minX = Math.min(minX, p.x);
    }
    const floorY = minY - 14;
    for (const ch of track.chains) this.levelGroup.add(trackMesh(ch, floorY));

    // Desert floor far below and behind.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 700), toon(theme.floor));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((minX + maxX) / 2, floorY, -330);
    floor.receiveShadow = true;
    this.levelGroup.add(floor);

    this.addScenery(level, theme, minX - 120, maxX + 160, floorY, track);

    // Flags.
    const fin = spawnAtX(track, track.finishX);
    const finish = flag('#111111', '#ffffff', true);
    finish.position.set(fin.x, fin.y, -0.9);
    this.levelGroup.add(finish);
    this.flags.push(finish);
    this.checkpointFlags = track.checkpoints.slice(1).map((cp) => {
      const f = flag('#2ecc71', null, false);
      f.position.set(cp.x, cp.y, -0.9);
      f.scale.setScalar(0.7);
      this.levelGroup.add(f);
      this.flags.push(f);
      return f;
    });
  }

  markCheckpoint(i) {
    const f = this.checkpointFlags?.[i - 1];
    if (f) f.userData.cloth.material.color.set('#f1c40f');
  }

  addScenery(level, theme, x0, x1, floorY, track) {
    const r = rng(level.id);
    const rockMats = theme.rocks.map((c) => toon(c, { flatShading: true }));
    const g = this.levelGroup;

    // Rock pillars and mesas at several depths, so the parallax is free.
    for (let layer = 0; layer < 3; layer++) {
      const zMin = [-26, -70, -150][layer], zMax = [-45, -120, -240][layer];
      const step = [11, 22, 40][layer];
      for (let x = x0; x < x1 + layer * 120; x += step * (0.6 + r())) {
        const z = zMin + (zMax - zMin) * r();
        const mat = rockMats[Math.floor(r() * rockMats.length)];
        if (r() < 0.35) {
          const w = 10 + r() * 30, h = 8 + r() * 22;
          const mesa = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.5, h, 7), mat);
          mesa.scale.z = 0.5;
          mesa.position.set(x, floorY + h / 2, z);
          g.add(mesa);
        } else {
          const h = 10 + r() * 34 + layer * 8, w = 2 + r() * 4;
          const p = new THREE.Mesh(new THREE.CylinderGeometry(w * (0.5 + r() * 0.5), w * 1.2, h, 6), mat);
          p.position.set(x, floorY + h / 2, z);
          p.rotation.y = r() * 3;
          g.add(p);
          if (r() < 0.5) {
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(w * 1.1, w * 0.7, 2.5, 6), mat);
            cap.position.set(x, floorY + h + 0.8, z);
            g.add(cap);
          }
        }
      }
    }

    // Sun.
    const sun = new THREE.Mesh(new THREE.CircleGeometry(22, 32), new THREE.MeshBasicMaterial({ color: theme.sun, fog: false }));
    sun.position.set((x0 + x1) / 2, floorY + 90, -420);
    g.add(sun);
    this.sunDisc = sun;

    // Cacti and stones on the ground track.
    const cactusMat = toon('#5f9e45');
    const stoneMat = toon('#c98d6a', { flatShading: true });
    for (const ch of track.chains) {
      if (ch.style !== 'ground') continue;
      for (let i = 4; i < ch.points.length; i += 9 + Math.floor(r() * 12)) {
        const p = ch.points[i];
        const z = -1.2 - r() * 2.2;
        if (r() < 0.5) {
          const h = 0.8 + r() * 1.2;
          const cactus = new THREE.Group();
          cactus.add(limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h, 0), 0.14, cactusMat));
          cactus.add(limb(new THREE.Vector3(0, h * 0.45, 0), new THREE.Vector3(0.35, h * 0.55, 0), 0.08, cactusMat));
          cactus.add(limb(new THREE.Vector3(0.35, h * 0.55, 0), new THREE.Vector3(0.35, h * 0.85, 0), 0.08, cactusMat));
          cactus.position.set(p.x, p.y, z);
          cactus.rotation.y = r() * 3;
          g.add(cactus);
        } else {
          const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + r() * 0.35), stoneMat);
          s.position.set(p.x, p.y + 0.05, z);
          g.add(s);
        }
      }
    }
  }

  // Follow the bike: look ahead in the direction of travel, pull back with speed and air.
  follow(pos, vel, airborne, dt, snap = false) {
    const speed = Math.hypot(vel.x, vel.y);
    const portrait = Math.max(1, 1.5 / this.camera.aspect);
    const target = {
      x: pos.x + Math.max(-3, Math.min(7, vel.x * 0.32)) + 2.5,
      y: pos.y + 1.4 + Math.max(-2, Math.min(2, vel.y * 0.12)),
      dist: (15 + Math.min(8, speed * 0.28) + (airborne ? 3 : 0)) * portrait,
    };
    if (!this.camState || snap) this.camState = { ...target };
    const c = this.camState;
    const k = 1 - Math.exp(-dt * 4);
    c.x += (target.x - c.x) * k;
    c.y += (target.y - c.y) * k * 1.4;
    c.dist += (target.dist - c.dist) * (1 - Math.exp(-dt * 1.5));
    this.camera.position.set(c.x, c.y + c.dist * 0.08, c.dist);
    this.camera.lookAt(c.x, c.y, 0);
    // Keep the sun's shadow box on the bike.
    this.sun.position.set(pos.x - 6, pos.y + 14, 10);
    this.sun.target.position.set(pos.x, pos.y, 0);
  }

  animateFlags(time) {
    for (const f of this.flags) {
      const cloth = f.userData.cloth;
      const p = cloth.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) + 0.7;
        p.setZ(i, Math.sin(time * 6 - x * 3) * 0.12 * x);
      }
      p.needsUpdate = true;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
