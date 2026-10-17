// The three.js scene: sky, scenery for each world, track meshes, flags and the camera.
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
    kind: 'desert',
  },
  // Lagos: lagoon water, the skyline, the Third Mainland Bridge with yellow danfos on it.
  lagos: {
    sky: ['#3fa9e6', '#9edcf6', '#ffe1b0'],
    fog: '#c3e6f2',
    floor: '#2f8fb3',
    buildings: ['#e9d8bd', '#c9d7e2', '#f2bd86', '#9fb6c9', '#d6c3e0', '#bfe0cf'],
    sun: '#fff8dc',
    kind: 'city',
  },
  ice: {
    sky: ['#5fb0ec', '#b9e1fb', '#f2faff'],
    fog: '#e1f2ff',
    floor: '#f4f9ff',
    rocks: ['#9fb7d1', '#8aa6c4', '#b3c7dc'],
    sun: '#ffffff',
    kind: 'ice',
  },
};
export const THEME_NAMES = Object.keys(THEMES);

const STYLES = {
  ground: { front: '#9a4422', spots: '#86391b', crust: '#e59a5a', top: '#f0b778', thick: 0.45, depth: 7 },
  line: { front: '#8e1b1b', top: '#a62424', thick: 0.12, depth: 1.4 },
  wood: { front: '#b4612c', spots: '#9f5324', crust: '#f2ab60', top: '#f6bf7c', under: '#7d3c18', thick: 0.55, depth: 2.2 },
  ice: { front: '#3d7cc6', spots: '#3570b6', crust: '#bfe6ff', top: '#e0f4ff', under: '#2a5e9c', thick: 0.55, depth: 2.2 },
  road: { front: '#6a717c', spots: '#5d646f', crust: '#f2c230', top: '#3d4149', under: '#4b5059', thick: 0.6, depth: 3.2 },
  snow: { front: '#8ea8c3', spots: '#7f99b6', crust: '#ffffff', top: '#f3faff', thick: 0.5, depth: 7, ground: true },
};
STYLES.ground.ground = true;

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

  if (st.ground) {
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

// Smoothed track height along x, so the desert floor and the rocks follow courses that
// climb or drop a long way (Flip Frenzy goes down a lot) instead of sitting at the lowest point.
function heightProfile(track, x0, x1, step = 4) {
  const n = Math.ceil((x1 - x0) / step) + 1;
  const raw = new Array(n).fill(NaN);
  for (const g of track.segments) {
    if (g.bx <= g.ax) continue;
    for (let i = Math.max(0, Math.ceil((g.ax - x0) / step)); i < n && x0 + i * step <= g.bx; i++) {
      if (Number.isNaN(raw[i])) raw[i] = g.ay + ((g.by - g.ay) * (x0 + i * step - g.ax)) / (g.bx - g.ax);
    }
  }
  // Fill the ends and any gaps from the nearest known height.
  let lastY = raw.find((v) => !Number.isNaN(v)) ?? 0;
  for (let i = 0; i < n; i++) Number.isNaN(raw[i]) ? (raw[i] = lastY) : (lastY = raw[i]);
  // Heavy smoothing (±60 m) so the floor rolls gently rather than copying every jump.
  const out = new Array(n), w = 15;
  let sum = 0, count = 0;
  for (let i = -w; i < n; i++) {
    if (i + w < n) { sum += raw[i + w]; count++; }
    if (i - w - 1 >= 0) { sum -= raw[i - w - 1]; count--; }
    if (i >= 0) out[i] = sum / count;
  }
  return (x) => out[Math.max(0, Math.min(n - 1, Math.round((x - x0) / step)))];
}

// Light walls with darker windows; tinted by each building's colour.
let winTex;
function windowTexture() {
  if (winTex) return winTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#6f8aa6';
  for (let y = 8; y < 64; y += 22) for (let x = 8; x < 64; x += 22) g.fillRect(x, y, 12, 12);
  winTex = new THREE.CanvasTexture(c);
  winTex.colorSpace = THREE.SRGBColorSpace;
  winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
  return winTex;
}

function crateTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#c8873f';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#8a5523';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 58, 58);
  g.beginPath();
  g.moveTo(6, 6);
  g.lineTo(58, 58);
  g.moveTo(58, 6);
  g.lineTo(6, 58);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function chevronTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,140,0,.55)';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#fff36b';
  g.beginPath();
  g.moveTo(10, 6);
  g.lineTo(34, 32);
  g.lineTo(10, 58);
  g.lineTo(24, 58);
  g.lineTo(48, 32);
  g.lineTo(24, 6);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
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
    this.shakeAmt = 0;
    this.zoom = 1; // < 1 punches the camera in (slow-mo)
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
    this.movers = [];
    this.dyn = [];
    this.boostTex = [];
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

    // Desert floor behind the track, following the course's height.
    const x0 = minX - 400, x1 = maxX + 400;
    const height = heightProfile(track, x0, x1);
    const base = (x) => height(x) - 14;
    const rows = [-4, -30, -80, -160, -260, -400, -650];
    const cols = [];
    for (let x = x0; x <= x1; x += 10) cols.push(x);
    const floorRows = rows.map((z) => cols.map((x) => new THREE.Vector3(x, base(x), z)));
    const floorMat = toon(theme.floor, { side: THREE.DoubleSide });
    for (let i = 0; i < rows.length - 1; i++) this.levelGroup.add(strip(floorRows[i + 1], floorRows[i], floorMat));

    this.addScenery(level, theme, minX - 120, maxX + 160, base, track);

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

  // base(x): ground height of the desert floor at x.
  addScenery(level, theme, x0, x1, base, track) {
    if (theme.kind === 'city') return this.addCity(level, theme, x0, x1, base);
    if (theme.kind === 'ice') return this.addIce(level, theme, x0, x1, base, track);
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
          mesa.position.set(x, base(x) + h / 2, z);
          g.add(mesa);
        } else {
          const h = 10 + r() * 34 + layer * 8, w = 2 + r() * 4;
          const p = new THREE.Mesh(new THREE.CylinderGeometry(w * (0.5 + r() * 0.5), w * 1.2, h, 6), mat);
          p.position.set(x, base(x) + h / 2, z);
          p.rotation.y = r() * 3;
          g.add(p);
          if (r() < 0.5) {
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(w * 1.1, w * 0.7, 2.5, 6), mat);
            cap.position.set(x, base(x) + h + 0.8, z);
            g.add(cap);
          }
        }
      }
    }

    // Sun.
    const sun = new THREE.Mesh(new THREE.CircleGeometry(22, 32), new THREE.MeshBasicMaterial({ color: theme.sun, fog: false }));
    sun.position.set(x0 + 140, base(x0 + 120) + 100, -420);
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

  addSun(theme, x0, base) {
    const sun = new THREE.Mesh(new THREE.CircleGeometry(22, 32), new THREE.MeshBasicMaterial({ color: theme.sun, fog: false }));
    sun.position.set(x0 + 140, base(x0 + 120) + 100, -420);
    this.levelGroup.add(sun);
    this.sunDisc = sun;
  }

  // Lagos: skyline, the Third Mainland Bridge with danfos driving on it, palms by the lagoon.
  addCity(level, theme, x0, x1, base) {
    const r = rng(level.id);
    const g = this.levelGroup;
    this.addSun(theme, x0, base);
    const win = windowTexture();
    const mats = theme.buildings.map((c) => toon(c, { map: win }));
    for (let layer = 0; layer < 3; layer++) {
      const zMin = [-75, -140, -230][layer], zMax = [-110, -200, -330][layer];
      const step = [13, 18, 26][layer];
      for (let x = x0; x < x1 + layer * 150; x += step * (0.5 + r())) {
        const w = 6 + r() * 10, d = 6 + r() * 8, h = 14 + r() * (26 + layer * 30);
        const geo = new THREE.BoxGeometry(w, h, d);
        // Scale the UVs so windows stay the same size on every building.
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 3.2, (uv.getY(i) * h) / 3.2);
        const b = new THREE.Mesh(geo, mats[Math.floor(r() * mats.length)]);
        b.position.set(x, base(x) + h / 2 - 1, zMin + (zMax - zMin) * r());
        g.add(b);
      }
    }
    // The bridge: a long deck on pillars across the lagoon.
    const deckZ = -48, deckMat = toon('#d9d4c7'), railMat = toon('#b9b2a2'), pillarMat = toon('#c8c1b0');
    const deckY = (x) => base(x) + 10;
    for (let x = x0; x < x1; x += 20) {
      const ya = deckY(x), yb = deckY(x + 20);
      const piece = new THREE.Mesh(new THREE.BoxGeometry(20.6, 1.1, 9), deckMat);
      piece.position.set(x + 10, (ya + yb) / 2, deckZ);
      piece.rotation.z = Math.atan2(yb - ya, 20);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(20.6, 0.5, 0.3), railMat);
      rail.position.set(x + 10, (ya + yb) / 2 + 0.8, deckZ + 4.4);
      rail.rotation.z = piece.rotation.z;
      g.add(piece, rail);
      if (Math.round((x - x0) / 20) % 2 === 0) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 12, 1.6), pillarMat);
        pillar.position.set(x, ya - 6, deckZ);
        g.add(pillar);
      }
    }
    // Yellow danfo buses with their black stripes, driving both ways.
    this.movers = [];
    const yellow = toon('#f7c600'), black = toon('#1d1d1d'), glass = toon('#9cc9e0');
    for (let i = 0; i < Math.ceil((x1 - x0) / 45); i++) {
      const bus = new THREE.Group();
      bus.add(new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.7, 1.8), yellow));
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.22, 0.22, 1.82), black);
      stripe.position.y = -0.2;
      const windows = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 1.84), glass);
      windows.position.y = 0.42;
      bus.add(stripe, windows);
      const dir = i % 2 ? 1 : -1;
      bus.position.z = deckZ + (dir > 0 ? 1.9 : -1.9);
      g.add(bus);
      this.movers.push({ mesh: bus, x: x0 + r() * (x1 - x0), speed: dir * (9 + r() * 6), x0, x1, y: (x) => deckY(x) + 1.4 });
    }
    // Palms along the lagoon shore.
    const trunk = toon('#9a6b3f'), leaf = toon('#3f9b4a');
    for (let x = x0; x < x1; x += 9 + r() * 14) {
      const palm = new THREE.Group();
      const h = 6 + r() * 4, lean = (r() - 0.5) * 1.6;
      palm.add(limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean, h, 0), 0.22, trunk));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        palm.add(limb(new THREE.Vector3(lean, h, 0), new THREE.Vector3(lean + Math.cos(a) * 2.6, h - 1.1, Math.sin(a) * 2.6), 0.16, leaf));
      }
      palm.position.set(x, base(x), -16 - r() * 22);
      g.add(palm);
    }
  }

  // Ice: snowy peaks in layers, pine trees, white floor.
  addIce(level, theme, x0, x1, base, track) {
    const r = rng(level.id);
    const g = this.levelGroup;
    this.addSun(theme, x0, base);
    const rockMats = theme.rocks.map((c) => toon(c, { flatShading: true }));
    const snowMat = toon('#ffffff', { flatShading: true });
    for (let layer = 0; layer < 3; layer++) {
      const zMin = [-60, -130, -220][layer], zMax = [-100, -200, -320][layer];
      const step = [24, 34, 50][layer];
      for (let x = x0; x < x1 + layer * 150; x += step * (0.5 + r())) {
        const h = 22 + r() * (30 + layer * 30), rad = h * (0.55 + r() * 0.3);
        const z = zMin + (zMax - zMin) * r();
        const peak = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 6), rockMats[Math.floor(r() * rockMats.length)]);
        peak.position.set(x, base(x) + h / 2 - 2, z);
        peak.rotation.y = r() * 3;
        const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.42, h * 0.42, 6), snowMat);
        cap.position.set(x, base(x) + h - 2 - h * 0.21 + 0.3, z);
        cap.rotation.y = peak.rotation.y;
        g.add(peak, cap);
      }
    }
    const pine = toon('#2f6b4f'), trunk = toon('#6b4a2f');
    const tree = (x, y, z, sc) => {
      const t = new THREE.Group();
      t.add(limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.2 * sc, 0), 0.15 * sc, trunk));
      for (let k = 0; k < 3; k++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry((1.4 - k * 0.35) * sc, 1.8 * sc, 7), pine);
        cone.position.y = (1.4 + k * 1.0) * sc;
        t.add(cone);
      }
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.4 * sc, 0.6 * sc, 7), snowMat);
      tip.position.y = 3.75 * sc;
      t.add(tip);
      t.position.set(x, y, z);
      g.add(t);
    };
    for (let x = x0; x < x1; x += 7 + r() * 12) tree(x, base(x), -18 - r() * 30, 1.6 + r() * 1.4);
    // Small pines beside snowy ground track.
    for (const ch of track.chains) {
      if (ch.style !== 'snow') continue;
      for (let i = 6; i < ch.points.length; i += 14 + Math.floor(r() * 16)) {
        const p = ch.points[i];
        tree(p.x, p.y, -1.6 - r() * 1.8, 0.45 + r() * 0.3);
      }
    }
  }

  // Meshes for the physics pieces: see-saw planks, crates and boost pads.
  attachDynamics(sim) {
    const plankMat = toon('#b8793f');
    const crateMat = toon('#ffffff', { map: crateTexture() });
    this.dyn = sim.dynamics.map((d) => {
      const mesh = d.kind === 'plank'
        ? new THREE.Mesh(new THREE.BoxGeometry(d.hw * 2, d.hh * 2, 2.4), plankMat)
        : new THREE.Mesh(new THREE.BoxGeometry(d.hw * 2, d.hh * 2, d.hw * 2), crateMat);
      mesh.castShadow = true;
      this.levelGroup.add(mesh);
      return { d, mesh };
    });
    // See-saw pivots.
    for (const sw of sim.track.seesaws) {
      const post = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 4), toon('#6b6f78'));
      post.position.set(sw.x0 + sw.len / 2, sw.y - 0.6, 0);
      this.levelGroup.add(post);
    }
    // Boost pads: glowing chevrons that scroll.
    this.boostTex = [];
    for (const b of sim.track.boosts) {
      const tex = chevronTexture();
      tex.repeat.set((b.x1 - b.x0) / 1.8, 1);
      this.boostTex.push(tex);
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(b.x1 - b.x0, 1.8),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set((b.x0 + b.x1) / 2, b.y + 0.03, 0);
      this.levelGroup.add(pad);
    }
    this.syncDynamics();
  }

  syncDynamics() {
    for (const { d, mesh } of this.dyn ?? []) {
      mesh.visible = d.body.isActive();
      const p = d.body.getPosition();
      mesh.position.set(p.x, p.y, 0);
      mesh.rotation.z = d.body.getAngle();
    }
  }

  // Everything that moves on its own: flags, buses, boost chevrons.
  animate(time) {
    this.animateFlags(time);
    for (const m of this.movers ?? []) {
      const span = m.x1 - m.x0;
      const x = m.x0 + ((((m.x - m.x0 + m.speed * time) % span) + span) % span);
      m.mesh.position.x = x;
      m.mesh.position.y = m.y(x);
      m.mesh.rotation.y = m.speed > 0 ? 0 : Math.PI;
    }
    for (const t of this.boostTex ?? []) t.offset.x = -time * 2.5;
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
    c.dist += (target.dist * this.zoom - c.dist) * (1 - Math.exp(-dt * (this.zoom < 1 ? 5 : 1.5)));
    // Shake: a quick random jolt that dies away.
    this.shakeAmt *= Math.exp(-dt * 9);
    const sx = (Math.random() - 0.5) * this.shakeAmt, sy = (Math.random() - 0.5) * this.shakeAmt;
    this.camera.position.set(c.x + sx, c.y + c.dist * 0.08 + sy, c.dist);
    this.camera.lookAt(c.x + sx * 0.5, c.y + sy * 0.5, 0);
    // The sun is far away: it moves with the camera.
    this.sunDisc?.position.set(c.x + 60, c.y + 95, -420);
    // Keep the sun's shadow box on the bike.
    this.sun.position.set(pos.x - 6, pos.y + 14, 10);
    this.sun.target.position.set(pos.x, pos.y, 0);
  }

  shake(amount) {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
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
