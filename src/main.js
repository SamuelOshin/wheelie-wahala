// Wheelie Wahala: boot, game loop and screens.
import { World } from './world.js';
import { BikeModel } from './bike.js';
import { BikeSim } from './physics.js';
import { buildTrack } from './track.js';
import { LEVELS } from './levels.js';
import { DEFAULT_STYLE } from './rider.js';
import { setupInput, readInput, anyInput, isTouch } from './input.js';
import { unlockAudio, setEngine, sfx, toggleMute, isMuted } from './audio.js';
import * as startng from './startng.js';

const $ = (id) => document.getElementById(id);
const STEP = 1 / 120;
const FLIP_BONUS = 1; // seconds off per flip

// ---------- saved progress (this browser only) ----------
const SAVE_KEY = 'wheelie-wahala-v1';
function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (p && p.levels) return p;
  } catch {}
  return { levels: {}, flips: 0 };
}
const progress = loadProgress();
function saveProgress() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch {}
}

// ---------- player (start.ng character) ----------
const player = { signedIn: false, name: 'Rider', account: null, face: null, style: DEFAULT_STYLE, id: null };

async function refreshPlayer() {
  const who = await startng.whoami();
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
  renderPlayerCard(!!who);
  if (JSON.stringify(player.style) !== before) bike.setStyle(player.style);
}

let startngConnected = false;
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

let state = 'menu'; // menu | playing | paused | finished
let levelIndex = 0;
let level, track, sim;
let run; // the current attempt
let acc = 0, last = performance.now(), clock = 0;

function loadLevel(i) {
  levelIndex = i;
  level = LEVELS[i];
  track = buildTrack(level);
  sim = new BikeSim(track);
  world.buildLevel(level, track);
  world.scene.add(bike.root);
  sim.reset(track.checkpoints[0]);
  bike.resetRider();
  run = {
    started: false, time: 0, flips: 0, checkpoint: 0,
    crashTimer: 0, finished: false, landedAt: -1,
  };
  world.camState = null;
}

function startLevel(i) {
  unlockAudio();
  loadLevel(i);
  setState('playing');
  $('hud-level').textContent = `${i + 1}. ${level.name}`;
  showHint(level.hint, 5);
  updateHud();
}

function respawn() {
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
  if (s === 'menu') renderLevels();
}

// ---------- HUD ----------
const fmt = (t) => {
  t = Math.max(0, t);
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
};
const score = () => Math.max(0, run.time - run.flips * FLIP_BONUS);

function updateHud() {
  $('hud-time').textContent = fmt(score());
  $('hud-flips').textContent = run.flips ? `${run.flips} flip${run.flips > 1 ? 's' : ''} · −${run.flips * FLIP_BONUS}s` : '';
}

let hintTimer;
function showHint(text, seconds) {
  const h = $('hint');
  h.textContent = text ?? '';
  h.style.opacity = 1;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => (h.style.opacity = 0), seconds * 1000);
}

function popup(text, cls = '') {
  const el = document.createElement('div');
  el.className = `popup ${cls}`;
  el.textContent = text;
  $('popups').append(el);
  setTimeout(() => el.remove(), 1200);
}

// ---------- level select ----------
function unlocked(i) {
  return i === 0 || !!progress.levels[LEVELS[i - 1].id];
}

function renderLevels() {
  const box = $('levels');
  box.replaceChildren(...LEVELS.map((l, i) => {
    const best = progress.levels[l.id];
    const b = document.createElement('button');
    b.className = 'level' + (unlocked(i) ? '' : ' locked');
    const stars = [1, 2, 3].map((n) => `<span class="${best && best.stars >= n ? 'on' : ''}">★</span>`).join('');
    b.innerHTML = `<div class="num">${i + 1}</div><div class="name"></div><div class="lstars">${stars}</div><div class="best"></div>`;
    b.querySelector('.name').textContent = l.name;
    b.querySelector('.best').textContent = best ? `Best ${fmt(best.time)}` : unlocked(i) ? 'New!' : '🔒 Finish the last one';
    b.onclick = () => {
      if (!unlocked(i)) return;
      sfx.click();
      startLevel(i);
    };
    return b;
  }));
}

// ---------- finishing ----------
function starsFor(time) {
  const [gold, silver] = level.stars;
  return time <= gold ? 3 : time <= silver ? 2 : 1;
}

function totals() {
  let stars = 0, time = 0;
  for (const l of LEVELS) {
    const b = progress.levels[l.id];
    if (b) {
      stars += b.stars;
      time += b.time;
    }
  }
  return { stars, flips: progress.flips, time: Math.round(time) };
}

async function finishLevel() {
  run.finished = true;
  const time = score();
  const stars = starsFor(time);
  const prev = progress.levels[level.id];
  const isBest = !prev || time < prev.time;
  progress.flips += run.flips;
  progress.levels[level.id] = {
    time: isBest ? time : prev.time,
    stars: Math.max(stars, prev?.stars ?? 0),
    flips: Math.max(run.flips, prev?.flips ?? 0),
  };
  saveProgress();
  sfx.finish();
  setState('finished');

  $('res-time').textContent = fmt(time);
  $('res-flips').textContent = run.flips;
  $('res-best').textContent = fmt(progress.levels[level.id].time);
  const [gold, silver] = level.stars;
  $('res-note').textContent = stars === 3 ? (isBest && prev ? 'New best time!' : 'Perfect run!')
    : `Beat ${fmt(stars === 2 ? gold : silver)} for ${stars === 2 ? '3' : '2'} stars`;
  $('btn-next').hidden = levelIndex >= LEVELS.length - 1;
  const starEls = [...$('stars').children];
  starEls.forEach((s) => s.classList.remove('on'));
  starEls.slice(0, stars).forEach((s, i) => setTimeout(() => { s.classList.add('on'); sfx.star(i); }, 450 + i * 380));

  const save = $('res-save');
  if (!startng.onStartNg()) {
    save.textContent = 'Play on start.ng to put your times on the leaderboard.';
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
    const cells = [e.rank, e.name, e.stats?.stars ?? e.score, e.stats?.flips ?? '–', e.stats?.time != null ? fmt(e.stats.time).slice(0, -3) : '–'];
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
const soundLabel = () => ($('btn-sound').textContent = isMuted() ? '🔇 Sound off' : '🔊 Sound on');
soundLabel();
$('btn-sound').onclick = () => { unlockAudio(); toggleMute(); soundLabel(); };
$('btn-pause').onclick = () => pause();
$('btn-restart').onclick = () => { if (state === 'playing') respawn(); };
$('btn-resume').onclick = () => setState('playing');
$('btn-retry-p').onclick = () => restartLevel();
$('btn-menu-p').onclick = () => goMenu();
$('btn-retry').onclick = () => restartLevel();
$('btn-menu').onclick = () => goMenu();
$('btn-next').onclick = () => startLevel(Math.min(levelIndex + 1, LEVELS.length - 1));

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
    if ((code === 'Escape' || code === 'KeyP')) {
      if (state === 'playing') pause();
      else if (state === 'paused') setState('playing');
      else if (!$('board').hidden) $('board').hidden = true;
    }
    if (code === 'Enter' || code === 'Space') {
      if (state === 'finished') ($('btn-next').hidden ? $('btn-retry') : $('btn-next')).click();
      else if (state === 'menu') startLevel(levelIndex);
    }
  },
});
const autoPause = !new URLSearchParams(location.search).has('nopause'); // ?nopause for automated tests
document.addEventListener('visibilitychange', () => { if (document.hidden && autoPause) pause(); });
if (isTouch()) $('controls-help').textContent = 'Left: lean back / forward · Right: brake / GO';

// ---------- game loop ----------
function physicsStep(input) {
  const events = sim.step(input, STEP);
  for (const e of events) {
    if (e.type === 'flip') {
      run.flips += e.count;
      sfx.flip(e.count);
      popup(e.count > 1 ? `${e.count}× FLIP!` : e.back ? 'BACKFLIP!' : 'FRONTFLIP!');
    } else if (e.type === 'land') {
      sfx.land();
    } else if (e.type === 'crash') {
      crash();
    }
  }
}

function crash() {
  if (run.crashTimer) return;
  sim.crashed = true;
  run.crashTimer = 1.1;
  bike.throwRider(sim.chassis.getLinearVelocity());
  sfx.crash();
  popup('OUCH!', 'bad');
}

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  frame(dt);
  requestAnimationFrame(tick);
}

function frame(dt) {
  clock += dt;

  if (state === 'playing') {
    const input = readInput();
    if (!run.started && anyInput()) run.started = true;
    const live = run.crashTimer ? { throttle: 0, brake: 0, lean: 0 } : input;
    acc += dt;
    while (acc >= STEP) {
      physicsStep(live);
      acc -= STEP;
    }
    if (run.started && !run.finished) run.time += dt;

    const p = sim.chassis.getPosition();
    // Checkpoints.
    for (let i = run.checkpoint + 1; i < track.checkpoints.length; i++) {
      if (p.x >= track.checkpoints[i].x && !sim.crashed) {
        run.checkpoint = i;
        world.markCheckpoint(i);
        sfx.checkpoint();
        popup('CHECKPOINT', 'small');
      }
    }
    if (p.y < track.checkpoints[0].y - 120) crash();
    if (run.crashTimer) {
      run.crashTimer -= dt;
      bike.updateThrown(dt);
      if (run.crashTimer <= 0) respawn();
    }
    if (!run.finished && !sim.crashed && p.x >= track.finishX) finishLevel();
    setEngine(sim.speed, input.throttle, !sim.crashed);
    updateHud();
    bike.update(sim.snapshot(), { lean: input.lean, time: clock, speed: sim.speed });
    world.follow(p, sim.chassis.getLinearVelocity(), !sim.rearGround && !sim.frontGround, dt);
  } else if (state === 'finished') {
    // Let the bike roll to a stop past the line.
    acc += dt;
    while (acc >= STEP) {
      physicsStep({ throttle: 0, brake: 1, lean: 0 });
      acc -= STEP;
    }
    setEngine(sim.speed, 0, true);
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

  world.animateFlags(clock);
  world.render();
}

loadLevel(0);
setState('menu');
refreshPlayer();
requestAnimationFrame(tick);

// For quick checks from the console.
// advance(seconds) steps the game without waiting for the screen (for automated tests).
window.__ww = {
  get sim() { return sim; }, get run() { return run; }, get state() { return state; },
  startLevel, player, progress, bike, goMenu, world,
  advance(seconds, fps = 60) { for (let t = 0; t < seconds; t += 1 / fps) frame(1 / fps); },
};
