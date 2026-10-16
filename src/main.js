// Wheelie Wahala: boot, game loop and screens.
import { World } from './world.js';
import { BikeModel } from './bike.js';
import { BikeSim } from './physics.js';
import { buildTrack } from './track.js';
import { LEVELS } from './levels.js';
import { DEFAULT_STYLE } from './rider.js';
import { FlipTracker } from './flips.js';
import { Particles, buzz } from './fx.js';
import { setupInput, readInput, anyInput, isTouch, setTouchMode } from './input.js';
import { unlockAudio, setEngine, sfx, toggleMute, isMuted, setMusicLevel, setVolumes, suspendAudio } from './audio.js';
import { loadSettings, saveSettings, sanitize, cleanName } from './settings.js';
import * as THREE from '../vendor/three.module.js';
import * as startng from './startng.js';

const $ = (id) => document.getElementById(id);
const STEP = 1 / 120;
const MILESTONES = [25, 100, 250, 500, 1000, 2500, 5000, 10000];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const num = (n) => Math.round(n).toLocaleString('en');

// ---------- saved progress (this browser only) ----------
// Per level: best time, most flips, best flip score, best combo, and which of the three
// goals (finish · time · flips) have ever been reached. Lifetime flips count every landed flip.
const SAVE_KEY = 'wheelie-wahala-v2';
const OLD_KEY = 'wheelie-wahala-v1';

function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (p && p.levels) return p;
  } catch {}
  const fresh = { levels: {}, flips: 0, milestone: 0 };
  // Carry over progress from the first version (time-only stars).
  try {
    const old = JSON.parse(localStorage.getItem(OLD_KEY));
    if (old?.levels) {
      fresh.flips = old.flips || 0;
      for (const l of LEVELS) {
        const o = old.levels[l.id];
        if (o) fresh.levels[l.id] = {
          time: o.time, flips: o.flips || 0, score: 0, combo: 0,
          goals: { finish: true, time: o.time <= l.time, flips: (o.flips || 0) >= l.flipGoal },
        };
      }
      while (fresh.milestone < MILESTONES.length && fresh.flips >= MILESTONES[fresh.milestone]) fresh.milestone++;
    }
  } catch {}
  return fresh;
}
const progress = loadProgress();
function saveProgress() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch {}
}
const starsOf = (b) => (b ? +!!b.goals.finish + +!!b.goals.time + +!!b.goals.flips : 0);

// ---------- player (start.ng character) ----------
const player = { signedIn: false, name: 'Rider', account: null, face: null, style: DEFAULT_STYLE, id: null };
let startngConnected = false;

let refreshing = null, lookups = 0;
function refreshPlayer() {
  refreshing ??= lookUpPlayer().finally(() => (refreshing = null));
  return refreshing;
}

async function lookUpPlayer() {
  const who = await startng.whoami();
  // On start.ng but no answer yet (slow connection): keep trying for a while.
  if (!who && startng.onStartNg() && !startngConnected && ++lookups < 8) setTimeout(refreshPlayer, 4000);
  const p = who?.user ?? who?.guest;
  const before = JSON.stringify(player.style);
  if (p) {
    player.signedIn = !!who.user;
    player.name = p.name || (who.user ? 'Rider' : 'Guest');
    player.account = who.user?.account ?? null;
    player.face = p.face ?? null;
    player.style = p.style ?? DEFAULT_STYLE;
    player.id = who.user?.id ?? null;
  }
  renderPlayerCard(!!who || startngConnected);
  if (JSON.stringify(player.style) !== before) bike.setStyle(player.style);
}

function renderPlayerCard(connected) {
  startngConnected = connected;
  const card = $('player-card');
  card.hidden = !connected || state === 'playing' || state === 'paused';
  if (!connected) return;
  if (player.face) $('player-face').src = player.face;
  $('player-name').textContent = player.name;
  $('player-account').textContent = player.account ? `@${player.account}` : 'Not signed in';
  // Guests who chose "play as guest" on start.ng aren't asked again in the corner card,
  // but can still sign in from the results screen.
  $('player-sign-in').hidden = player.signedIn || startng.isGuestVisit();
}

$('player-sign-in').onclick = () => startng.signIn();
addEventListener('focus', refreshPlayer);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshPlayer(); });

// ---------- world ----------
const world = new World($('game'));
const bike = new BikeModel(player.style);
world.scene.add(bike.root);
const particles = new Particles(world.scene);

let state = 'menu'; // menu | playing | paused | finished
let levelIndex = 0;
let level, track, sim;
let run; // the current attempt
const tricks = new FlipTracker();
let acc = 0, last = performance.now(), clock = 0, slowmo = 0;

function loadLevel(i) {
  levelIndex = i;
  level = LEVELS[i];
  track = buildTrack(level);
  sim = new BikeSim(track);
  world.buildLevel(level, track);
  world.scene.add(bike.root);
  particles.attach(world.scene);
  sim.reset(track.checkpoints[0]);
  bike.resetRider();
  tricks.reset();
  run = { started: false, time: 0, checkpoint: 0, crashTimer: 0, finished: false, goalShown: false, saved: tricks.snapshot() };
  slowmo = 0;
  world.camState = null;
}

function startLevel(i) {
  unlockAudio();
  loadLevel(i);
  setState('playing');
  $('hud-level').textContent = `${i + 1}. ${level.name}`;
  showHint(level.hint, 5);
  updateHud(true);
}

function respawn() {
  tricks.restore(run.saved);
  run.goalShown = tricks.flips >= level.flipGoal;
  sim.reset(track.checkpoints[run.checkpoint]);
  bike.resetRider();
  run.crashTimer = 0;
  world.camState = null;
}

function restartLevel() {
  startLevel(levelIndex);
}

function setState(s) {
  state = s;
  document.body.classList.toggle('playing', s === 'playing' || s === 'paused');
  $('menu').hidden = s !== 'menu';
  $('pause').hidden = s !== 'paused';
  $('finish').hidden = s !== 'finished';
  $('hud').hidden = !(s === 'playing' || s === 'paused');
  $('touch').hidden = !(s === 'playing' && isTouch());
  $('player-card').hidden = !startngConnected || s === 'playing' || s === 'paused';
  if (s !== 'playing') $('spin').toggleAttribute('hidden', true);
  if (s === 'menu') renderLevels();
  setMusicLevel(s === 'playing' ? 0.32 : s === 'paused' ? 0.25 : 0.6);
}

// ---------- HUD ----------
const fmt = (t) => {
  t = Math.max(0, t);
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
};

let shownFlips = -1;
function updateHud(force = false) {
  $('hud-time').textContent = fmt(run.time);
  if (force || tricks.flips !== shownFlips) {
    shownFlips = tricks.flips;
    $('hud-flipcount').textContent = tricks.flips;
    $('hud-flipgoal').textContent = tricks.flips >= level.flipGoal ? '✓' : `/ ${level.flipGoal}`;
    $('hud-flips').querySelector('.flip-count').classList.toggle('done', tricks.flips >= level.flipGoal);
  }
  $('hud-score').textContent = num(tricks.score);
  const showCombo = tricks.combo >= 2;
  $('combo').hidden = !showCombo;
  if (showCombo) {
    $('combo-x').textContent = `×${tricks.multiplier}`;
    $('combo-bar').style.transform = `scaleX(${tricks.comboLeft.toFixed(3)})`;
  }
}

const bump = (el) => {
  el.classList.remove('bump');
  void el.offsetWidth; // restart the animation
  el.classList.add('bump');
};

let hintTimer;
function showHint(text, seconds) {
  const h = $('hint');
  h.textContent = text ?? '';
  h.style.opacity = 1;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => (h.style.opacity = 0), seconds * 1000);
}

// lines: [text, className?][] — the first line is the headline.
function popup(lines, cls = '') {
  const el = document.createElement('div');
  el.className = `popup ${cls}`;
  for (const [i, [text, c]] of lines.entries()) {
    const span = document.createElement(i === 0 ? 'span' : 'span');
    if (c) span.className = c;
    span.textContent = text;
    el.append(span);
  }
  $('popups').append(el);
  setTimeout(() => el.remove(), 1300);
}

function flash() {
  if (reducedMotion) return;
  const f = $('flash');
  f.classList.remove('on');
  void f.offsetWidth;
  f.classList.add('on');
}

function slowMo(seconds) {
  if (!reducedMotion) slowmo = Math.max(slowmo, seconds);
}

// ---------- level select ----------
function unlocked(i) {
  return i === 0 || !!progress.levels[LEVELS[i - 1].id]?.goals.finish;
}

function renderLevels() {
  const box = $('levels');
  box.replaceChildren(...LEVELS.map((l, i) => {
    const best = progress.levels[l.id];
    const b = document.createElement('button');
    b.className = 'level' + (unlocked(i) ? '' : ' locked');
    const n = starsOf(best);
    const stars = [1, 2, 3].map((k) => `<span class="${n >= k ? 'on' : ''}">★</span>`).join('');
    b.innerHTML = `<div class="num">${i + 1}</div><div class="name"></div><div class="lstars">${stars}</div><div class="best"></div>`;
    b.querySelector('.name').textContent = l.name;
    b.querySelector('.best').textContent = best
      ? `Best ${fmt(best.time)} · ↻ ${best.flips}`
      : unlocked(i) ? 'New!' : '🔒 Finish the last one';
    b.onclick = () => {
      if (!unlocked(i)) return;
      sfx.click();
      startLevel(i);
    };
    return b;
  }));
  const lt = $('menu-lifetime');
  lt.hidden = !progress.flips;
  lt.textContent = `↻ ${num(progress.flips)} lifetime flips`;
}

// ---------- tricks, landings, crashes ----------
function onLand(e) {
  tricks.land(e);
  const strength = Math.min(2, e.impact / 7);
  const p = sim.rear.getPosition();
  particles.dust(p.x, p.y - 0.3, strength);
  world.shake(Math.min(0.45, e.impact * 0.035));
  if (e.impact > 5) sfx.land();
  if (e.impact > 10) buzz(18);
}

function onTrick(e) {
  progress.flips += e.flips;
  $('popups').replaceChildren(); // the newest trick replaces the last one on screen
  const lines = [[e.name], [`+${num(e.points)}${e.multiplier > 1 ? `  ×${e.multiplier}` : ''}`, 'pts']];
  if (e.perfect) lines.push(['PERFECT!', 'perfect']);
  popup(lines, e.flips >= 3 ? 'big' : '');
  sfx.flip(e.flips);
  if (e.multiplier > 1) sfx.combo(e.multiplier);
  bump($('hud-flips').querySelector('.flip-count'));
  if (e.multiplier > 1) bump($('combo-x'));
  if (e.perfect) {
    flash();
    sfx.perfect();
    const c = sim.chassis.getPosition();
    particles.sparkle(c.x, c.y);
  }
  if (e.flips >= 3 || e.multiplier >= 3) slowMo(0.5);
  buzz(e.perfect ? 45 : 25);

  if (!run.goalShown && tricks.flips >= level.flipGoal) {
    run.goalShown = true;
    setTimeout(() => { popup([['★ FLIP GOAL!']], 'gold'); sfx.star(2); }, 450);
  }
  while (progress.milestone < MILESTONES.length && progress.flips >= MILESTONES[progress.milestone]) {
    const m = MILESTONES[progress.milestone++];
    setTimeout(() => { popup([[`🏆 ${num(m)} LIFETIME FLIPS!`]], 'gold'); sfx.milestone(); }, 900);
  }
  saveProgress();
}

function crash() {
  if (run.crashTimer) return;
  sim.crashed = true;
  run.crashTimer = 1.1;
  const lost = tricks.crash();
  bike.throwRider(sim.chassis.getLinearVelocity());
  const c = sim.chassis.getPosition();
  particles.sparks(c.x, c.y);
  world.shake(0.6);
  sfx.crash();
  buzz(90);
  popup(lost.bailed ? [['BAILED!'], ['trick lost', 'pts']] : lost.comboLost ? [['OUCH!'], ['combo lost', 'pts']] : [['OUCH!']], 'bad');
}

function onTrickEvent(e) {
  if (e?.type === 'trick') onTrick(e);
  else if (e?.type === 'comboEnd') popup([[`${e.combo}× COMBO`], ['nice chain!', 'pts']], 'small');
}

// ---------- finishing ----------
function bestFlipScore() {
  return Math.max(0, ...LEVELS.map((l) => progress.levels[l.id]?.score ?? 0));
}

function totals() {
  let stars = 0, time = 0;
  for (const l of LEVELS) {
    const b = progress.levels[l.id];
    if (b) {
      stars += starsOf(b);
      time += b.time;
    }
  }
  return { stars, flip_score: Math.round(bestFlipScore()), flips: progress.flips, time: Math.round(time) };
}

async function finishLevel() {
  run.finished = true;
  sim.coasting = true;
  // A trick landed right on the line still counts.
  if (tricks.pending) onTrickEvent(tricks.confirm());
  const time = run.time;
  const flips = tricks.flips;
  const got = { finish: true, time: time <= level.time, flips: flips >= level.flipGoal };
  const prev = progress.levels[level.id];
  const had = prev?.goals ?? {};
  progress.levels[level.id] = {
    time: Math.min(time, prev?.time ?? Infinity),
    flips: Math.max(flips, prev?.flips ?? 0),
    score: Math.max(tricks.score, prev?.score ?? 0),
    combo: Math.max(tricks.bestCombo, prev?.combo ?? 0),
    goals: { finish: true, time: got.time || !!had.time, flips: got.flips || !!had.flips },
  };
  const best = progress.levels[level.id];
  saveProgress();
  sfx.finish();
  const c = sim.chassis.getPosition();
  particles.confetti(c.x + 4, c.y + 1);
  setState('finished');

  // The three goals for this run.
  const goals = [
    ['finish', 'Finish', fmt(time), got.finish],
    ['time', `Under ${fmt(level.time)}`, fmt(time), got.time],
    ['flips', `${level.flipGoal} flips`, `${flips} ↻`, got.flips],
  ];
  $('goals').replaceChildren(...goals.map(([key, label, value, ok]) => {
    const li = document.createElement('li');
    li.className = (ok ? 'ok' : '') + (ok && !had[key] ? ' new' : '');
    const tick = document.createElement('span');
    tick.className = 'tick';
    tick.textContent = ok ? '✓' : '';
    const text = document.createElement('span');
    text.textContent = label;
    if (ok && !had[key]) {
      const n = document.createElement('small');
      n.textContent = '  NEW ★';
      text.append(n);
    }
    const val = document.createElement('span');
    val.className = 'val';
    val.textContent = value;
    li.append(tick, text, val);
    return li;
  }));
  $('res-score').textContent = num(tricks.score);
  $('res-combo').textContent = tricks.bestCombo ? `×${tricks.bestCombo}` : '–';
  $('res-perfect').textContent = tricks.perfects;
  $('res-lifetime').textContent = `↻ ${num(progress.flips)} lifetime flips`;

  // Always point at the next goal: how close was it?
  const notes = [];
  if (!got.time) notes.push(`${(time - level.time).toFixed(2)} s off the time star`);
  if (!got.flips) {
    const short = level.flipGoal - flips;
    notes.push(`${short} flip${short > 1 ? 's' : ''} short of the flip star`);
  }
  $('res-note').textContent = notes.length ? `So close: ${notes.join(' · ')}` : 'All three goals in one run! 🔥';
  $('btn-next').hidden = levelIndex >= LEVELS.length - 1;

  const n = starsOf(best);
  const starEls = [...$('stars').children];
  starEls.forEach((s) => s.classList.remove('on'));
  starEls.slice(0, n).forEach((s, i) => setTimeout(() => { s.classList.add('on'); sfx.star(i); }, 450 + i * 380));

  const save = $('res-save');
  if (!startng.onStartNg()) {
    save.textContent = 'Play on start.ng to put your score on the leaderboard.';
  } else if (!player.signedIn) {
    save.innerHTML = '';
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = 'Sign in with start.ng to save your score';
    a.onclick = (e) => { e.preventDefault(); startng.signIn(); };
    save.append(a);
  } else {
    save.textContent = 'Saving to the start.ng leaderboard…';
    const res = await startng.saveRun(totals());
    if (res.ok) {
      const r = res.result;
      save.textContent = r?.improved ? `New best on start.ng! You're #${r.rank}` : `Saved. You're #${r?.rank ?? '?'} on start.ng`;
    } else {
      save.textContent = res.error ?? 'Could not save your score';
    }
  }
}

// ---------- leaderboard ----------
async function openBoard() {
  sfx.click();
  $('board').hidden = false;
  const rows = $('board-rows');
  rows.innerHTML = '<tr><td colspan="5">Loading…</td></tr>';
  $('board-note').textContent = '';
  const res = await startng.leaderboard(10);
  const entries = res.entries ?? [];
  rows.replaceChildren(...entries.map((e) => {
    const tr = document.createElement('tr');
    if (player.id && e.player_id === player.id) tr.className = 'me';
    const st = e.stats ?? {};
    const cells = [e.rank, e.name, st.stars ?? e.score, st.flip_score != null ? num(st.flip_score) : '–', st.flips != null ? num(st.flips) : '–'];
    cells.forEach((c, i) => {
      const td = document.createElement('td');
      if (i === 1) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = /^#[0-9a-f]{6}$/i.test(e.color ?? '') ? e.color : '#999';
        td.append(dot);
      }
      td.append(String(c));
      tr.append(td);
    });
    return tr;
  }));
  if (!entries.length) rows.innerHTML = '';
  $('board-note').textContent = !res.ok ? res.error : entries.length ? (player.signedIn ? '' : 'Sign in with start.ng to get on the board.') : 'No riders yet. Be the first!';
}

// ---------- buttons ----------
$('btn-board').onclick = openBoard;
$('btn-board-close').onclick = () => ($('board').hidden = true);
const soundLabel = () => {
  $('btn-sound').textContent = isMuted() ? '🔇' : '🔊';
  $('btn-sound').title = isMuted() ? 'Sound off' : 'Sound on';
};
soundLabel();
$('btn-sound').onclick = () => { unlockAudio(); toggleMute(); soundLabel(); };
// Browsers only allow sound after the player does something, so start it on the first tap or key.
addEventListener('pointerdown', () => unlockAudio(), { once: true });
$('btn-pause').onclick = () => pause();
// Tap once: back to the checkpoint. Tap twice quickly: restart the level.
let lastRestartTap = 0;
$('btn-restart').onclick = () => {
  if (state !== 'playing') return;
  const now = performance.now();
  if (now - lastRestartTap < 400) restartLevel();
  else respawn();
  lastRestartTap = now;
};
$('btn-resume').onclick = () => setState('playing');
$('btn-retry-p').onclick = () => restartLevel();
$('btn-menu-p').onclick = () => goMenu();
// Leaving the game only makes sense on start.ng; elsewhere there's nowhere to go back to.
$('btn-exit').hidden = !startng.onStartNg();
$('btn-retry').onclick = () => restartLevel();
$('btn-menu').onclick = () => goMenu();
$('btn-next').onclick = () => startLevel(Math.min(levelIndex + 1, LEVELS.length - 1));

// ---------- settings ----------
let settings = loadSettings();

function applySettings() {
  setVolumes({ master: settings.master / 100, music: settings.music / 100, sfx: settings.sfx / 100, engine: settings.engine / 100 });
  world.setQuality(settings.quality);
  setTouchMode(settings.touch);
  $('touch').hidden = !(state === 'playing' && isTouch());
  $('controls-help').textContent = isTouch()
    ? 'Left: lean back / forward · Right: brake / GO · ⟲ twice to restart'
    : '↑ ride · ↓ brake · ← → lean · R checkpoint · T restart · Esc pause';
}

// The name over the rider: your own pick, or your start.ng character's name.
const riderName = () => settings.riderName || (startngConnected ? player.name : '');

function openSettings() {
  sfx.click();
  $('set-name').value = settings.riderName;
  $('set-name').placeholder = startngConnected ? player.name : 'Rider';
  $('set-nametag').checked = settings.nameTag;
  for (const k of ['master', 'music', 'sfx', 'engine']) {
    const input = $(`set-${k}`);
    input.value = settings[k];
    input.nextElementSibling.textContent = settings[k];
  }
  for (const [id, key] of [['set-quality', 'quality'], ['set-touch', 'touch']]) {
    for (const b of $(id).children) b.classList.toggle('on', b.dataset.v === settings[key]);
  }
  $('settings').hidden = false;
}

function updateSetting(key, value) {
  settings = sanitize({ ...settings, [key]: value });
  saveSettings(settings);
  applySettings();
}

$('btn-settings').onclick = openSettings;
$('btn-settings-p').onclick = openSettings;
$('btn-settings-close').onclick = () => { sfx.click(); $('settings').hidden = true; };
$('set-name').addEventListener('input', (e) => updateSetting('riderName', e.target.value));
$('set-name').addEventListener('change', (e) => { e.target.value = cleanName(e.target.value); });
$('set-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
$('set-nametag').addEventListener('change', (e) => updateSetting('nameTag', e.target.checked));
for (const k of ['master', 'music', 'sfx', 'engine']) {
  $(`set-${k}`).addEventListener('input', (e) => {
    unlockAudio();
    e.target.nextElementSibling.textContent = e.target.value;
    updateSetting(k, e.target.value);
  });
}
for (const [id, key] of [['set-quality', 'quality'], ['set-touch', 'touch']]) {
  for (const b of $(id).children) {
    b.onclick = () => {
      sfx.click();
      for (const o of $(id).children) o.classList.toggle('on', o === b);
      updateSetting(key, b.dataset.v);
    };
  }
}
$('btn-reset').onclick = () => {
  if (!confirm('Reset all your stars, best times and lifetime flips on this device? Scores already on the start.ng leaderboard stay there.')) return;
  progress.levels = {};
  progress.flips = 0;
  progress.milestone = 0;
  saveProgress();
  renderLevels();
  sfx.click();
};

// ---------- things that follow the bike on screen ----------
const tmp = new THREE.Vector3();
function toScreen(lx, ly) {
  tmp.set(lx, ly, 0).applyMatrix4(bike.chassis.matrixWorld).project(world.camera);
  return [(tmp.x * 0.5 + 0.5) * innerWidth, (-tmp.y * 0.5 + 0.5) * innerHeight];
}

function updateOverlays() {
  bike.chassis.updateMatrixWorld();
  // Name tag above the rider.
  const tag = $('nametag');
  const name = riderName();
  const showTag = settings.nameTag && name && state === 'playing' && !bike.thrown;
  tag.hidden = !showTag;
  if (showTag) {
    if (tag.textContent !== name) tag.textContent = name;
    const [x, y] = toScreen(0.02, 1.75);
    tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }
  // Spin ring while flying: fills once per flip, the number is flips so far.
  const ring = $('spin');
  const inAir = state === 'playing' && !sim.crashed && !sim.rearGround && !sim.frontGround && sim.airTime > 0.3;
  ring.toggleAttribute('hidden', !inAir); // an <svg> has no .hidden property
  if (inAir) {
    const spin = Math.abs(sim.airSpin);
    const n = Math.floor((spin + 0.7) / (Math.PI * 2));
    const part = (spin % (Math.PI * 2)) / (Math.PI * 2);
    $('spin-fill').style.strokeDasharray = `${(part * 100).toFixed(1)} 100`;
    $('spin-n').textContent = n;
    ring.classList.toggle('full', n > 0);
    const c = sim.chassis.getPosition();
    tmp.set(c.x, c.y + 0.3, 0).project(world.camera);
    const x = (tmp.x * 0.5 + 0.5) * innerWidth, y = (-tmp.y * 0.5 + 0.5) * innerHeight;
    ring.style.transform = `translate(${(x - 75).toFixed(1)}px, ${(y - 75).toFixed(1)}px)`;
  }
}

function pause() {
  if (state === 'playing') setState('paused');
}

function goMenu() {
  loadLevel(levelIndex);
  setState('menu');
}

setupInput({
  onKey(code) {
    unlockAudio();
    if (code === 'KeyR' && state === 'playing') respawn();
    if (code === 'KeyT' && (state === 'playing' || state === 'paused' || state === 'finished')) restartLevel();
    if ((code === 'Escape' || code === 'KeyP')) {
      if (!$('settings').hidden) $('settings').hidden = true;
      else if (state === 'playing') pause();
      else if (state === 'paused') setState('playing');
      else if (!$('board').hidden) $('board').hidden = true;
    }
    if ((code === 'Enter' || code === 'Space') && $('settings').hidden && $('board').hidden) {
      if (state === 'finished') ($('btn-next').hidden ? $('btn-retry') : $('btn-next')).click();
      else if (state === 'menu') startLevel(levelIndex);
    }
  },
});
const autoPause = !new URLSearchParams(location.search).has('nopause'); // ?nopause for automated tests
document.addEventListener('visibilitychange', () => {
  if (document.hidden && autoPause) pause();
  suspendAudio(document.hidden);
});

// ---------- game loop ----------
function physicsStep(input) {
  for (const e of sim.step(input, STEP)) {
    if (e.type === 'land') onLand(e);
    else if (e.type === 'crash') crash();
  }
}

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!window.__ww?.frozen) frame(dt); // tests can freeze the game to take screenshots
  requestAnimationFrame(tick);
}

function frame(dt) {
  clock += dt;
  // Slow motion on big tricks: game time runs at 35% and the camera punches in.
  const scale = slowmo > 0 ? 0.35 : 1;
  slowmo = Math.max(0, slowmo - dt);
  world.zoom = slowmo > 0 ? 0.8 : 1;
  const gdt = dt * scale;

  if (state === 'playing') {
    const input = readInput();
    if (!run.started && anyInput()) run.started = true;
    const live = run.crashTimer ? { throttle: 0, brake: 0, lean: 0 } : input;
    acc += gdt;
    while (acc >= STEP) {
      physicsStep(live);
      acc -= STEP;
    }
    if (!sim.crashed) onTrickEvent(tricks.update(gdt));
    if (run.started && !run.finished) run.time += gdt;

    const p = sim.chassis.getPosition();
    for (let i = run.checkpoint + 1; i < track.checkpoints.length; i++) {
      if (p.x >= track.checkpoints[i].x && !sim.crashed) {
        run.checkpoint = i;
        if (tricks.pending) onTrickEvent(tricks.confirm());
        run.saved = tricks.snapshot();
        world.markCheckpoint(i);
        sfx.checkpoint();
        popup([['CHECKPOINT']], 'small');
      }
    }
    if (p.y < track.checkpoints[0].y - 120) crash();
    if (run.crashTimer) {
      run.crashTimer -= dt;
      bike.updateThrown(gdt);
      if (run.crashTimer <= 0) respawn();
    }
    if (!run.finished && !sim.crashed && p.x >= track.finishX) finishLevel();
    setEngine(sim.speed, input.throttle, !sim.crashed);
    updateHud();
    bike.update(sim.snapshot(), { lean: input.lean, time: clock, speed: sim.speed });
    world.follow(p, sim.chassis.getLinearVelocity(), !sim.rearGround && !sim.frontGround, dt);
  } else if (state === 'finished') {
    // Let the bike roll to a quiet stop past the line.
    acc += gdt;
    while (acc >= STEP) {
      sim.step({ throttle: 0, brake: 0, lean: 0 }, STEP);
      acc -= STEP;
    }
    setEngine(0, 0, false);
    bike.update(sim.snapshot(), { time: clock, speed: sim.speed });
    world.follow(sim.chassis.getPosition(), sim.chassis.getLinearVelocity(), false, dt);
  } else if (state === 'menu') {
    // Show off the rider: slow orbit around the bike at the start line.
    setEngine(0, 0, false);
    acc += dt;
    while (acc >= STEP) {
      sim.step({ throttle: 0, brake: 0, lean: 0 }, STEP);
      acc -= STEP;
    }
    bike.update(sim.snapshot(), { time: clock });
    const p = sim.chassis.getPosition();
    const a = clock * 0.35;
    const wide = (world.camera.aspect < 1 ? 1.7 : 1) * 1.55;
    world.camera.position.set(p.x + Math.sin(a) * 4.2 * wide, p.y + 1.3, Math.cos(a) * 4.2 * wide + 0.5);
    world.camera.lookAt(p.x, p.y + 0.15 - (innerHeight > 600 ? 0.5 : 0.2), 0);
    world.sun.target.position.set(p.x, p.y, 0);
    world.sun.position.set(p.x - 6, p.y + 14, 10);
  } else {
    setEngine(0, 0, false);
  }

  particles.update(state === 'paused' ? 0 : gdt);
  world.animateFlags(clock);
  world.render();
  updateOverlays();
}

applySettings();
loadLevel(0);
setState('menu');
refreshPlayer();
requestAnimationFrame(tick);

// For quick checks from the console.
// advance(seconds) steps the game without waiting for the screen (for automated tests).
window.__ww = {
  get sim() { return sim; }, get run() { return run; }, get state() { return state; },
  startLevel, player, progress, bike, goMenu, world, tricks, totals,
  advance(seconds, fps = 60) { for (let t = 0; t < seconds; t += 1 / fps) frame(1 / fps); },
};
