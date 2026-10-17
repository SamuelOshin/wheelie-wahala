// Level editor: build a course from pieces, see it, ride it with the autopilot, test it in the game.
import { buildTrack } from '../src/track.js';
import { BikeSim } from '../src/physics.js';
import { autopilotInput } from '../src/autopilot.js';

const $ = (id) => document.getElementById(id);
const KEY = 'wheelie-wahala-editor';

// Each piece kind and the numbers it takes (see the top of src/track.js).
const KINDS = {
  flat: [['length', 20]],
  line: [['length', 20], ['rise', -10]],
  slope: [['length', 24], ['rise', 5]],
  ramp: [['length', 12], ['height', 4]],
  dip: [['length', 30], ['depth', 5]],
  hill: [['length', 22], ['height', 3]],
  bumps: [['length', 32], ['height', 0.4], ['count', 3]],
  loop: [['radius', 4.5]],
  gap: [['length', 16], ['drop', -6]],
  checkpoint: [],
  boost: [['length', 10]],
  seesaw: [['length', 10]],
  crates: [['count', 4]],
};
const ADVANCES = new Set(['flat', 'line', 'slope', 'ramp', 'dip', 'hill', 'bumps', 'gap', 'boost', 'seesaw']);

const STYLE_COLOURS = {
  ground: ['#f0b778', '#9a4422'], line: ['#a62424', null], wood: ['#f6bf7c', '#b4612c'],
  road: ['#3d4149', '#6a717c'], snow: ['#f3faff', '#8ea8c3'], ice: ['#e0f4ff', '#3d7cc6'],
};
const SKY = { desert: ['#f9c74f', '#f6c9a0'], lagos: ['#3fa9e6', '#ffe1b0'], ice: ['#5fb0ec', '#f2faff'] };

const STARTER = {
  name: 'My level', theme: 'desert', style: 'ground', time: 30, flipGoal: 3,
  pieces: [['flat', 20], ['ramp', 12, 4], ['gap', 16, -6], ['slope', 22, -5], ['checkpoint'], ['flat', 10], ['boost', 10], ['flat', 10], ['crates', 4], ['flat', 30]],
};

let lvl = load();
let selected = -1;
let ride = null; // { path: [[x,y]...], crashes: [[x,y]...] }
const view = { x: -10, y: 10, scale: 6 }; // metres at the top-left, pixels per metre

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.pieces)) return s;
  } catch {}
  return structuredClone(STARTER);
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(lvl)); } catch {}
}

// The playable level object the game understands.
function asLevel() {
  return {
    id: 'custom-editor', world: lvl.theme, theme: lvl.theme, name: lvl.name || 'Custom level',
    style: lvl.style, grip: lvl.theme === 'ice' ? 0.5 : undefined, start: [0, 0],
    pieces: lvl.pieces, time: Number(lvl.time) || 30, flipGoal: Number(lvl.flipGoal) || 0,
    hint: 'Test ride from the level editor',
  };
}

let track = null;
function rebuild() {
  ride = null;
  try {
    track = buildTrack(asLevel());
    status('');
  } catch (e) {
    track = null;
    status(e.message, 'bad');
  }
  save();
  draw();
}

function status(text, kind = '') {
  $('status').textContent = text;
  $('status').className = kind;
}

// ---------- the side panel ----------
function renderMeta() {
  $('name').value = lvl.name;
  $('theme').value = lvl.theme;
  $('style').value = lvl.style;
  $('time').value = lvl.time;
  $('flipGoal').value = lvl.flipGoal;
}
for (const id of ['name', 'theme', 'style', 'time', 'flipGoal']) {
  $(id).addEventListener('input', (e) => { lvl[id] = e.target.value; rebuild(); });
}

$('palette').replaceChildren(...Object.keys(KINDS).map((kind) => {
  const b = document.createElement('button');
  b.className = 'small';
  b.textContent = `+ ${kind}`;
  b.onclick = () => {
    const at = selected >= 0 ? selected + 1 : lvl.pieces.length - 1; // before the final run-out
    lvl.pieces.splice(Math.max(0, at), 0, [kind, ...KINDS[kind].map(([, v]) => v)]);
    selected = Math.max(0, at);
    renderPieces();
    rebuild();
  };
  return b;
}));

function renderPieces() {
  $('pieces').replaceChildren(...lvl.pieces.map((p, i) => {
    const li = document.createElement('li');
    li.className = i === selected ? 'sel' : '';
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = i + 1;
    const kind = document.createElement('select');
    for (const k of Object.keys(KINDS)) kind.add(new Option(k, k, false, k === p[0]));
    kind.onchange = () => {
      lvl.pieces[i] = [kind.value, ...KINDS[kind.value].map(([, v]) => v)];
      renderPieces();
      rebuild();
    };
    const params = document.createElement('div');
    params.className = 'params';
    (KINDS[p[0]] ?? []).forEach(([label], k) => {
      const l = document.createElement('label');
      l.textContent = label;
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.value = p[k + 1] ?? 0;
      input.oninput = () => { lvl.pieces[i][k + 1] = Number(input.value); rebuild(); };
      l.append(input);
      params.append(l);
    });
    const acts = document.createElement('div');
    acts.className = 'acts';
    const btn = (text, title, fn) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.title = title;
      b.onclick = (e) => { e.stopPropagation(); fn(); renderPieces(); rebuild(); };
      acts.append(b);
    };
    btn('↑', 'Move up', () => { if (i > 0) [lvl.pieces[i - 1], lvl.pieces[i]] = [lvl.pieces[i], lvl.pieces[i - 1]]; selected = Math.max(0, i - 1); });
    btn('↓', 'Move down', () => { if (i < lvl.pieces.length - 1) [lvl.pieces[i + 1], lvl.pieces[i]] = [lvl.pieces[i], lvl.pieces[i + 1]]; selected = Math.min(lvl.pieces.length - 1, i + 1); });
    btn('✕', 'Delete', () => { lvl.pieces.splice(i, 1); selected = -1; });
    li.onclick = () => { selected = i; renderPieces(); focusPiece(i); draw(); };
    li.append(n, kind, params, acts);
    return li;
  }));
}

// Where each piece starts and ends along x (the same pen moves as src/track.js).
function pieceSpans() {
  let x = 0;
  return lvl.pieces.map(([kind, a = 0]) => {
    const x0 = x;
    if (ADVANCES.has(kind)) x += a;
    if (kind === 'loop') x += 3.2;
    return [x0, x];
  });
}

function focusPiece(i) {
  const [x0, x1] = pieceSpans()[i] ?? [0, 0];
  const canvas = $('view');
  view.x = (x0 + x1) / 2 - canvas.clientWidth / 2 / view.scale;
}

// ---------- drawing ----------
const canvas = $('view');
const ctx = canvas.getContext('2d');

function resize() {
  const dpr = devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}
addEventListener('resize', resize);

const sx = (x) => (x - view.x) * view.scale;
const sy = (y) => (view.y - y) * view.scale;

function draw() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const [top, bottom] = SKY[lvl.theme] ?? SKY.desert;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Grid every 10 m.
  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  ctx.lineWidth = 1;
  ctx.font = '11px Nunito, sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  for (let x = Math.floor(view.x / 10) * 10; sx(x) < w; x += 10) {
    ctx.beginPath(); ctx.moveTo(sx(x), 0); ctx.lineTo(sx(x), h); ctx.stroke();
    if (x % 50 === 0) ctx.fillText(`${x} m`, sx(x) + 3, 14);
  }

  // Selected piece.
  if (selected >= 0) {
    const [x0, x1] = pieceSpans()[selected] ?? [0, 0];
    ctx.fillStyle = 'rgba(255,225,77,.35)';
    ctx.fillRect(sx(x0), 0, Math.max(3, (x1 - x0) * view.scale), h);
  }
  if (!track) return;

  for (const ch of track.chains) {
    const [topC, frontC] = STYLE_COLOURS[ch.style] ?? STYLE_COLOURS.ground;
    if (frontC && (ch.style === 'ground' || ch.style === 'snow')) {
      ctx.fillStyle = frontC;
      ctx.beginPath();
      ctx.moveTo(sx(ch.points[0].x), h);
      for (const p of ch.points) ctx.lineTo(sx(p.x), sy(p.y));
      ctx.lineTo(sx(ch.points[ch.points.length - 1].x), h);
      ctx.fill();
    }
    ctx.strokeStyle = frontC && ch.style !== 'ground' && ch.style !== 'snow' ? frontC : topC;
    ctx.lineWidth = Math.max(2, (ch.style === 'line' ? 0.15 : 0.5) * view.scale);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ch.points.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
    ctx.stroke();
  }
  // Boosts, see-saws, crates.
  for (const b of track.boosts) {
    ctx.fillStyle = '#ff9f1c';
    ctx.fillRect(sx(b.x0), sy(b.y) - 6, (b.x1 - b.x0) * view.scale, 6);
  }
  for (const s of track.seesaws) {
    const tilt = Math.atan2(1.6, s.len);
    ctx.strokeStyle = '#8a5523';
    ctx.lineWidth = Math.max(3, 0.36 * view.scale);
    ctx.beginPath();
    ctx.moveTo(sx(s.x0), sy(s.y));
    ctx.lineTo(sx(s.x0 + s.len), sy(s.y + Math.sin(tilt) * s.len));
    ctx.stroke();
  }
  ctx.fillStyle = '#c8873f';
  for (const c of track.crates) {
    const size = 0.84 * view.scale;
    for (let i = 0; i < c.n; i++) ctx.fillRect(sx(c.x) + (i % 3 - 1) * size, sy(c.y) - size * (1 + Math.floor(i / 3)), size - 1, size - 1);
  }
  // Checkpoints and the finish.
  const flag = (x, y, colour) => {
    ctx.strokeStyle = '#6b4a2f';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx(x), sy(y)); ctx.lineTo(sx(x), sy(y + 3)); ctx.stroke();
    ctx.fillStyle = colour;
    ctx.fillRect(sx(x), sy(y + 3), 1.4 * view.scale, 0.8 * view.scale);
  };
  track.checkpoints.slice(1).forEach((c) => flag(c.x, c.y, '#2ecc71'));
  const fin = track.checkpoints.length && track.segments.find((sg) => sg.bx > sg.ax && track.finishX >= sg.ax && track.finishX <= sg.bx);
  if (fin) flag(track.finishX, fin.ay, '#111');

  // Autopilot ride.
  if (ride) {
    ctx.strokeStyle = '#1f6feb';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ride.path.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#e5383b';
    ctx.lineWidth = 3;
    for (const [x, y] of ride.crashes) {
      ctx.beginPath();
      ctx.moveTo(sx(x) - 8, sy(y) - 8); ctx.lineTo(sx(x) + 8, sy(y) + 8);
      ctx.moveTo(sx(x) + 8, sy(y) - 8); ctx.lineTo(sx(x) - 8, sy(y) + 8);
      ctx.stroke();
    }
  }
}

// Pan and zoom.
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  view.x = drag.vx - (e.clientX - drag.x) / view.scale;
  view.y = drag.vy + (e.clientY - drag.y) / view.scale;
  draw();
});
canvas.addEventListener('pointerup', () => (drag = null));
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const mx = view.x + (e.clientX - r.left) / view.scale, my = view.y - (e.clientY - r.top) / view.scale;
  view.scale = Math.min(40, Math.max(1.5, view.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  view.x = mx - (e.clientX - r.left) / view.scale;
  view.y = my + (e.clientY - r.top) / view.scale;
  draw();
}, { passive: false });

// ---------- actions ----------
$('check').onclick = () => {
  if (!track) return;
  const sim = new BikeSim(track);
  sim.reset(track.checkpoints[0]);
  const path = [], crashes = [];
  let t = 0, cp = 0, finished = false;
  while (t < 120 && crashes.length < 8) {
    for (const e of sim.step(autopilotInput(sim), 1 / 120)) {
      if (e.type === 'crash') {
        const p = sim.chassis.getPosition();
        crashes.push([p.x, p.y]);
        sim.reset(track.checkpoints[cp]);
      }
    }
    t += 1 / 120;
    const p = sim.chassis.getPosition();
    if (Math.round(t * 120) % 6 === 0) path.push([p.x, p.y]);
    for (let i = cp + 1; i < track.checkpoints.length; i++) if (p.x >= track.checkpoints[i].x) cp = i;
    if (p.y < track.killY) {
      crashes.push([p.x, p.y]);
      sim.reset(track.checkpoints[cp]);
    }
    if (p.x >= track.finishX) { finished = true; break; }
  }
  ride = { path, crashes };
  draw();
  if (finished && !crashes.length) {
    status(`✓ Autopilot finished cleanly in ${t.toFixed(1)} s. A fair target time is about ${Math.ceil(t * 1.15)} s`, 'ok');
  } else if (finished) {
    status(`Finished in ${t.toFixed(1)} s with ${crashes.length} crash${crashes.length > 1 ? 'es' : ''} (red ✕). Try smoothing those spots`, 'bad');
  } else {
    status(`The autopilot couldn't finish: look at the red ✕ marks`, 'bad');
  }
};

$('test').onclick = () => {
  save();
  location.href = '../?play=editor';
};

$('export').onclick = async () => {
  const text = JSON.stringify({ name: lvl.name, theme: lvl.theme, style: lvl.style, time: Number(lvl.time), flipGoal: Number(lvl.flipGoal), pieces: lvl.pieces });
  $('paste').value = text;
  try {
    await navigator.clipboard.writeText(text);
    status('Copied the level to the clipboard', 'ok');
  } catch {
    status('Copy the level from the box below', 'ok');
  }
};

$('load').onclick = () => {
  try {
    const data = JSON.parse($('paste').value);
    if (!Array.isArray(data.pieces)) throw new Error('No pieces in that JSON');
    for (const p of data.pieces) if (!KINDS[p[0]]) throw new Error(`Unknown piece "${p[0]}"`);
    lvl = { ...STARTER, ...data };
    selected = -1;
    renderMeta();
    renderPieces();
    rebuild();
  } catch (e) {
    status(e.message, 'bad');
  }
};

$('new').onclick = () => {
  if (!confirm('Start a new level? The current one will be replaced.')) return;
  lvl = structuredClone(STARTER);
  selected = -1;
  renderMeta();
  renderPieces();
  rebuild();
};

// Start zoomed out to show the whole course.
function fitView() {
  if (!track) return;
  let minY = Infinity, maxY = -Infinity;
  for (const ch of track.chains) for (const p of ch.points) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const w = canvas.clientWidth, h = canvas.clientHeight;
  view.scale = Math.max(1.5, Math.min(w / (track.finishX + 60), h / (maxY - minY + 30)));
  view.x = -20;
  view.y = maxY + (h / view.scale - (maxY - minY)) / 2;
  draw();
}

renderMeta();
renderPieces();
resize();
rebuild();
fitView();
