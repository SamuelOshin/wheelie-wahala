// Wheelie Wahala: boot, game loop and screens.
import { World } from './world.js';
import { BikeModel } from './bike.js';
import { BikeSim } from './physics.js';
import { buildTrack } from './track.js';
import { LEVELS, WORLDS } from './levels.js';
import { DEFAULT_STYLE } from './rider.js';
import { FlipTracker } from './flips.js';
import { Particles, buzz } from './fx.js';
import { Missions } from './missions.js';
import { GhostRecorder, loadGhost, saveGhost, ghostPose, pruneDailyGhosts } from './ghost.js';
import { todayUTC, addDays, untilTomorrowUTC } from './rng.js';
import { setupInput, readInput, anyInput, isTouch, setTouchMode, pollGamepad } from './input.js';
import { defaultGarage, tuningFor } from './garage.js';
import { unlockAudio, setEngine, sfx, toggleMute, isMuted, setMusicLevel, setVolumes, suspendAudio } from './audio.js';
import { loadSettings, saveSettings, sanitize, cleanName } from './settings.js';
import { DIFFICULTIES, DIFFICULTY_ORDER, difficultyOf, keepCheckpoints } from './difficulty.js';
import * as THREE from '../vendor/three.module.js';
import * as startng from './startng.js';
import { encodeRace, decodeRace, drawCard, shareCard } from './share.js';
import { canFullscreen, isFullscreen, isIOS, isStandalone, enterFullscreen, toggleFullscreen, onFullscreenChange } from './screen.js';
import { LiveRoom, IDLE_SLOT } from './live.js';

const $ = (id) => document.getElementById(id);

// After signing in, start.ng sends players back with #startng_session=… in the address. This game
// talks to start.ng through its connect page instead, so the token isn't needed: take it out of the
// address bar straight away, so it's never on screen or copied into a shared link.
function stripSessionFromAddress() {
  if (!/startng_session=/.test(location.hash)) return;
  const rest = location.hash.slice(1).split('&').filter((kv) => !/^(startng_session|expires_in)=/.test(kv)).join('&');
  history.replaceState(null, '', location.pathname + location.search + (rest ? `#${rest}` : ''));
}
stripSessionFromAddress();
const STEP = 1 / 120;
const MILESTONES = [25, 100, 250, 500, 1000, 2500, 5000, 10000];
const FRENZY_TIME = 60; // seconds
const FRENZY_BONUS = 3; // seconds added for each trick at ×3 combo or more
// Reduce motion (Settings → Accessibility): no shake, slow-mo, flashes or bouncy popups.
const calm = () => !!settings?.reduceMotion;
const num = (n) => Math.round(n).toLocaleString('en');

// ---------- saved progress (this browser only) ----------
// levels: per campaign level, best time / flips / flip score / combo and which of the three
// goals (finish · time · flips) have ever been reached. flips: lifetime landed flips.
// coins, missions, daily (streak and today's best) and frenzy (best score) too.
const SAVE_KEY = 'wheelie-wahala-v2';
const OLD_KEY = 'wheelie-wahala-v1';

function loadProgress() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch {}
  if (!p || !p.levels) {
    p = { levels: {}, flips: 0, milestone: 0 };
    // Carry over progress from the first version (time-only stars).
    try {
      const old = JSON.parse(localStorage.getItem(OLD_KEY));
      if (old?.levels) {
        p.flips = old.flips || 0;
        for (const l of LEVELS) {
          const o = old.levels[l.id];
          if (o) p.levels[l.id] = {
            time: o.time, flips: o.flips || 0, score: 0, combo: 0,
            goals: { finish: true, time: o.time <= l.time, flips: (o.flips || 0) >= l.flipGoal },
          };
        }
        while (p.milestone < MILESTONES.length && p.flips >= MILESTONES[p.milestone]) p.milestone++;
      }
    } catch {}
  }
  p.coins ??= 0;
  p.missions ??= {};
  p.daily ??= { streak: 0, last: null, date: null, best: null };
  p.frenzy ??= { best: 0, runs: 0 };
  p.garage ??= defaultGarage();
  return p;
}
const progress = loadProgress();
function saveProgress() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch {}
}
const starsOf = (b) => (b ? +!!b.goals.finish + +!!b.goals.time + +!!b.goals.flips : 0);

// ---------- coins and missions ----------
// A coin drawn in CSS (the coin emoji is missing on older Windows).
function coinIcon() {
  const c = document.createElement('span');
  c.className = 'coin';
  c.setAttribute('aria-label', 'coins');
  return c;
}

function addCoins(n) {
  if (n <= 0) return;
  progress.coins += n;
  renderCoins(true);
}

function renderCoins(bumpIt = false) {
  $('coins-n').textContent = num(progress.coins);
  if (bumpIt) bump($('coins'));
}

const missions = new Missions(progress.missions, (m) => {
  addCoins(m.coins);
  setTimeout(() => { popup([['✅ MISSION DONE'], [`+${m.coins} coins`, 'pts']], 'gold'); sfx.milestone(); }, 650);
  saveProgress();
});

function renderMissionList(ul, compact = false) {
  ul.replaceChildren(...missions.state.active.map((m) => {
    const li = document.createElement('li');
    const done = m.progress >= m.target;
    li.className = done ? 'done' : '';
    const text = document.createElement('span');
    text.textContent = (done ? '✓ ' : '') + missions.text(m);
    const reward = document.createElement('span');
    reward.className = 'reward';
    reward.textContent = m.coins;
    reward.append(coinIcon());
    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('i');
    fill.style.width = `${Math.min(100, (m.progress / m.target) * 100)}%`;
    bar.append(fill);
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = `${num(m.progress)} / ${num(m.target)}`;
    li.append(text, reward, bar);
    if (!compact) li.append(count);
    return li;
  }));
}

function openMissions() {
  sfx.click();
  missions.collect();
  saveProgress();
  renderMissionList($('missions-list'));
  $('coins-note').textContent = `You have ${num(progress.coins)} coins. Spend them on bikes, paint and trails in the Garage!`;
  $('missions').hidden = false;
  renderMenuBadges();
}

function renderMenuBadges() {
  const ready = missions.state.active.filter((m) => m.progress >= m.target).length;
  $('missions-badge').hidden = !ready;
  $('missions-badge').textContent = ready;
}

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
  if (JSON.stringify(player.style) !== before) {
    bike.setStyle(player.style);
    ghostBike.setStyle(player.style);
    showroom?.setStyle(player.style);
  }
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
const look = () => ({ bike: progress.garage.bike, paint: progress.garage.paint });
const bike = new BikeModel(player.style, { look: look() });
const ghostBike = new BikeModel(player.style, { ghost: true, tint: '#5fdcff', look: look() });
ghostBike.root.position.z = -0.8; // a lane behind you, so it still shows when you're level
world.scene.add(bike.root, ghostBike.root);
const particles = new Particles(world.scene);
// A friend's ghost from a race link: their character and bike, two lanes back.
const friendBike = new BikeModel(DEFAULT_STYLE, { ghost: true, look: { bike: 'dirt', paint: 'blue' } });
friendBike.root.position.z = -1.6;
world.scene.add(friendBike.root);
let challenge = null; // the race link you opened: { courseId, name, time, style, look, daily, ghost }
let friend = null; // the challenge, while you're on its course
let lastRun = null; // the finished run, for the Share button

let state = 'menu'; // menu | playing | paused | finished
let mode = 'level'; // level | daily | frenzy | custom (a test ride from the level editor)
let levelIndex = 0;
let level, track, sim;
let run; // the current attempt
let ghost = null, recorder = null;
let diff = DIFFICULTIES.normal; // the current ride's difficulty
const tricks = new FlipTracker();
let acc = 0, last = performance.now(), clock = 0, slowmo = 0;

// Set up a course. `course` is a level object (campaign, daily or frenzy).
function loadCourse(course, courseMode) {
  mode = courseMode;
  level = course;
  track = buildTrack(level);
  // The difficulty, fixed for the whole ride: landing rules, checkpoints and flip score.
  // Frenzy keeps every checkpoint (its clock is already the cost of a crash).
  diff = difficultyOf(settings.difficulty);
  if (mode !== 'frenzy') track.checkpoints = keepCheckpoints(track.checkpoints, diff);
  sim = new BikeSim(track, tuningFor(progress.garage.bike)); // your bike's feel
  sim.rules = diff;
  world.buildLevel(level, track);
  world.attachDynamics(sim);
  world.scene.add(bike.root, ghostBike.root, friendBike.root);
  particles.attach(world.scene);
  sim.reset(track.checkpoints[0]);
  bike.resetRider();
  tricks.reset();
  tricks.scale = diff.score;
  run = {
    started: false, time: 0, checkpoint: 0, crashTimer: 0, finished: false, goalShown: false,
    saved: tricks.snapshot(), crashes: 0, timeLeft: FRENZY_TIME, bonusTime: 0,
  };
  ghost = (mode === 'level' || mode === 'daily') && settings.ghost ? loadGhost(level.id) : null;
  ghostCursor = 0;
  coachTimer = 0;
  ghostBike.root.visible = false;
  friend = challenge && challenge.courseId === level.id ? challenge : null;
  if (friend) {
    friendBike.setStyle(friend.style ?? DEFAULT_STYLE);
    friendBike.setLook(friend.look ?? { bike: 'dirt', paint: 'blue' });
  }
  friendBike.root.visible = false;
  recorder = mode === 'level' || mode === 'daily' || friend ? new GhostRecorder() : null;
  slowmo = 0;
  world.camState = null;
}

function loadLevel(i) {
  levelIndex = i;
  loadCourse(LEVELS[i], 'level');
}

function beginRun(name) {
  unlockAudio();
  if (settings.autoFullscreen && isTouch()) enterFullscreen().then(renderFullscreen);
  maybeShowIOSTip();
  setState('playing');
  $('hud-level').textContent = diff.id === 'normal' ? name : `${name} · ${diff.icon} ${diff.name}`;
  showHint(level.hint, 5);
  updateHud(true);
}

function startLevel(i) {
  loadLevel(i);
  const w = worldOf(level);
  const n = LEVELS.filter((l) => (l.world ?? 'desert') === w.id).indexOf(level) + 1;
  beginRun(`${w.name} ${n} · ${level.name}`);
}

// Today's course: generated from the date, checked by the autopilot (a variant is tried if
// it can't ride it cleanly), and the target time set from the autopilot's time.
// The generator and autopilot only load when you first play a Daily or Frenzy.
const courseTools = () => Promise.all([import('./generator.js'), import('./autopilot.js')]);

let dailyCache = null;
// known: { variant, time } when a race link says exactly which course it was.
async function dailyCourse(date = todayUTC(), known = null) {
  if (dailyCache?.date === date) return dailyCache.course;
  const [{ generateCourse }, { rideCourse }] = await courseTools();
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('wheelie-wahala-daily-v2')); } catch {}
  if (known && Number.isInteger(known.variant)) saved = { date, ...known };
  let course;
  if (saved?.date === date) {
    course = generateCourse(`${date}#${saved.variant}`, { mode: 'daily' });
    course.time = saved.time;
    course.variant = saved.variant;
  } else {
    for (let v = 0; v < 6; v++) {
      course = generateCourse(`${date}#${v}`, { mode: 'daily' });
      const res = rideCourse(course, { maxTime: 90 });
      if (res.finished || v === 5) {
        course.time = Math.ceil(res.finished ? res.time * 1.12 : course.time);
        course.variant = v;
        try { localStorage.setItem('wheelie-wahala-daily-v2', JSON.stringify({ date, variant: v, time: course.time })); } catch {}
        break;
      }
    }
  }
  course.id = `daily-${date}`;
  course.date = date;
  if (date === todayUTC()) {
    dailyCache = { date, course };
    pruneDailyGhosts(course.id);
  }
  return course;
}

async function startDaily() {
  sfx.click();
  loadCourse(await dailyCourse(), 'daily');
  beginRun(`Daily · ${todayUTC()}`);
}

async function startFrenzy(seed = String(Date.now())) {
  sfx.click();
  const [{ generateCourse }] = await courseTools();
  const course = generateCourse(seed, { mode: 'frenzy', length: 2400 });
  course.seed = seed;
  loadCourse(course, 'frenzy');
  beginRun('Flip Frenzy');
}

function respawn() {
  // Flips go back to the checkpoint (no farming the same jump for stars).
  // In Frenzy the clock is already the cost, so you keep them.
  if (mode !== 'frenzy') tricks.restore(run.saved);
  if (diff.checkpoints === 'none' && mode !== 'frenzy' && !run.race) {
    // Extreme: one life. The run starts again from scratch (in a live race the clock keeps going).
    tricks.reset();
    run.saved = tricks.snapshot();
    run.time = 0;
    run.started = false;
    ghostCursor = 0;
    if (recorder) recorder = new GhostRecorder();
    popup([['BACK TO THE START'], ['😈 Extreme: no checkpoints', 'pts']], 'bad');
  }
  run.goalShown = tricks.flips >= level.flipGoal;
  sim.reset(track.checkpoints[run.checkpoint]);
  bike.resetRider();
  run.crashTimer = 0;
  world.camState = null;
}

function restartLevel() {
  if (run?.race) return goMenu(); // a live race can't be re-run alone
  if (friend && level.id === friend.courseId) return startChallenge();
  if (mode === 'level') startLevel(levelIndex);
  else if (mode === 'daily') startDaily();
  else if (mode === 'custom') startCustom();
  else startFrenzy(level.seed);
}

// A course from the level editor (editor/), passed through this browser's storage.
function editorCourse() {
  try {
    const e = JSON.parse(localStorage.getItem('wheelie-wahala-editor'));
    if (!e || !Array.isArray(e.pieces)) return null;
    return {
      id: 'custom-editor', world: e.theme, theme: e.theme, name: e.name || 'Custom level', style: e.style,
      grip: e.theme === 'ice' ? 0.5 : undefined, start: [0, 0], pieces: e.pieces,
      time: Number(e.time) || 30, flipGoal: Number(e.flipGoal) || 0, hint: 'Test ride from the level editor',
    };
  } catch {
    return null;
  }
}

function startCustom() {
  const course = editorCourse();
  if (!course) return;
  loadCourse(course, 'custom');
  beginRun(`Test ride · ${course.name}`);
}

function setState(s) {
  state = s;
  document.body.classList.toggle('playing', s === 'playing' || s === 'paused');
  $('menu').hidden = s !== 'menu';
  $('world').hidden = true;
  $('garage').hidden = true;
  if (showroom) showroom.active = false;
  $('pause').hidden = s !== 'paused';
  $('finish').hidden = s !== 'finished';
  $('hud').hidden = !(s === 'playing' || s === 'paused');
  $('touch').hidden = !(s === 'playing' && isTouch());
  $('player-card').hidden = !startngConnected || s === 'playing' || s === 'paused';
  $('coins').hidden = !(s === 'menu' || s === 'finished');
  if (s !== 'playing') $('spin').toggleAttribute('hidden', true);
  if (s === 'menu') renderMenu();
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
  const frenzy = mode === 'frenzy';
  const timeEl = $('hud-time');
  timeEl.textContent = frenzy ? Math.max(0, run.timeLeft).toFixed(1) : fmt(run.time);
  timeEl.classList.toggle('hud-time-low', frenzy && run.timeLeft < 10);
  if (force || tricks.flips !== shownFlips) {
    shownFlips = tricks.flips;
    $('hud-flipcount').textContent = tricks.flips;
    const goal = frenzy ? '' : tricks.flips >= level.flipGoal ? '✓' : `/ ${level.flipGoal}`;
    $('hud-flipgoal').textContent = goal;
    $('hud-flips').querySelector('.flip-count').classList.toggle('done', !frenzy && tricks.flips >= level.flipGoal);
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

// lines: [text, className?][], the first line is the headline.
function popup(lines, cls = '') {
  const el = document.createElement('div');
  el.className = `popup ${cls}`;
  for (const [text, c] of lines) {
    const span = document.createElement('span');
    if (c) span.className = c;
    span.textContent = text;
    el.append(span);
  }
  $('popups').append(el);
  setTimeout(() => el.remove(), 1300);
  $('sr').textContent = lines.map(([t]) => t).join(', ');
}

function flash() {
  if (calm()) return;
  const f = $('flash');
  f.classList.remove('on');
  void f.offsetWidth;
  f.classList.add('on');
}

function shake(amount) {
  if (!calm()) world.shake(amount);
}

function slowMo(seconds) {
  if (!calm()) slowmo = Math.max(slowmo, seconds);
}

// ---------- menu ----------
function totalStars() {
  return LEVELS.reduce((sum, l) => sum + starsOf(progress.levels[l.id]), 0);
}

// Worlds open with stars; inside a world, each level opens when the one before it is finished.
const worldOf = (l) => WORLDS.find((w) => w.id === (l.world ?? 'desert'));
const worldUnlocked = (w) => totalStars() >= w.stars;
function unlocked(i) {
  const l = LEVELS[i], prev = LEVELS[i - 1];
  if (!worldUnlocked(worldOf(l))) return false;
  return !prev || prev.world !== l.world || !!progress.levels[prev.id]?.goals.finish;
}

// The streak still counts if you played yesterday (play today to keep it going).
function liveStreak() {
  const d = progress.daily, today = todayUTC();
  return d.last === today || d.last === addDays(today, -1) ? d.streak : 0;
}

function renderMenu() {
  missions.collect();
  saveProgress();
  renderCoins();
  renderMenuBadges();
  renderWorlds();

  const today = todayUTC(), d = progress.daily;
  const doneToday = d.date === today && d.best;
  $('daily-sub').textContent = doneToday
    ? `Done ✓ best ${fmt(d.best.time)} · new course in ${untilTomorrowUTC()}`
    : 'A new course every day, the same for everyone';
  const streak = liveStreak();
  $('daily-streak').textContent = streak ? `🔥 ${streak}` : '';
  $('frenzy-sub').textContent = progress.frenzy.best ? `Best ${num(progress.frenzy.best)} points` : 'Flip as much as you can in 60 s';

  const lt = $('menu-lifetime');
  lt.hidden = !progress.flips;
  lt.textContent = `↻ ${num(progress.flips)} lifetime flips`;
}

function renderWorlds() {
  const stars = totalStars();
  $('worlds').replaceChildren(...WORLDS.map((w) => {
    const levels = LEVELS.filter((l) => (l.world ?? 'desert') === w.id);
    const got = levels.reduce((s, l) => s + starsOf(progress.levels[l.id]), 0);
    const open = stars >= w.stars;
    const b = document.createElement('button');
    b.className = `worldcard ${w.theme}${open ? '' : ' locked'}`;
    const name = document.createElement('span');
    name.className = 'wname';
    name.textContent = w.name;
    const sub = document.createElement('span');
    sub.className = 'wsub';
    sub.textContent = open ? w.blurb : `🔒 Needs ${w.stars} ★ (you have ${stars})`;
    const st = document.createElement('span');
    st.className = 'wstars';
    st.textContent = `★ ${got}/${levels.length * 3}`;
    b.append(st, name, sub);
    b.onclick = () => {
      if (!open) {
        popup([[`🔒 ${w.stars - stars} more ★ to open`]], 'small');
        return;
      }
      sfx.click();
      openWorld(w);
    };
    return b;
  }));
}

let currentWorld = WORLDS[0];
function openWorld(w) {
  currentWorld = w;
  const first = LEVELS.findIndex((l) => (l.world ?? 'desert') === w.id);
  if (level?.world !== w.id && LEVELS[levelIndex].world !== w.id) loadLevel(first); // the world as a backdrop
  renderLevels(w);
  $('menu').hidden = true;
  $('world').hidden = false;
}

function closeWorld() {
  $('world').hidden = true;
  $('menu').hidden = false;
  renderMenu();
}
$('btn-world-back').onclick = () => { sfx.click(); closeWorld(); };

function renderLevels(w) {
  const levels = LEVELS.map((l, i) => [l, i]).filter(([l]) => (l.world ?? 'desert') === w.id);
  $('world-name').textContent = w.name;
  const got = levels.reduce((s, [l]) => s + starsOf(progress.levels[l.id]), 0);
  $('world-stars').textContent = `★ ${got} / ${levels.length * 3}${w.grip ? ' · slippery!' : ''}`;
  $('levels').replaceChildren(...levels.map(([l, i], k) => {
    const best = progress.levels[l.id];
    const b = document.createElement('button');
    b.className = 'level' + (unlocked(i) ? '' : ' locked');
    const n = starsOf(best);
    const stars = [1, 2, 3].map((s) => `<span class="${n >= s ? 'on' : ''}">★</span>`).join('');
    b.innerHTML = `<div class="num">${k + 1}</div><div class="name"></div><div class="lstars">${stars}</div><div class="best"></div>`;
    b.querySelector('.name').textContent = l.name;
    if (best?.hardest === 'hard' || best?.hardest === 'extreme') {
      const badge = document.createElement('div');
      badge.className = 'ldiff';
      badge.textContent = DIFFICULTIES[best.hardest].icon;
      badge.title = `Finished on ${DIFFICULTIES[best.hardest].name}`;
      b.append(badge);
    }
    b.querySelector('.best').textContent = best ? `${fmt(best.time)} · ↻ ${best.flips}` : unlocked(i) ? 'New!' : '🔒';
    b.onclick = () => {
      if (!unlocked(i)) return;
      sfx.click();
      $('world').hidden = true;
      startLevel(i);
    };
    return b;
  }));
}

// ---------- tricks, landings, crashes ----------
function onLand(e) {
  tricks.land(e);
  const strength = Math.min(2, e.impact / 7);
  const p = sim.rear.getPosition();
  particles.dust(p.x, p.y - 0.3, strength);
  shake(Math.min(0.45, e.impact * 0.035));
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

  // Frenzy: big combos buy more time.
  if (mode === 'frenzy' && e.multiplier >= 3) {
    run.timeLeft += FRENZY_BONUS;
    run.bonusTime += FRENZY_BONUS;
    setTimeout(() => popup([[`+${FRENZY_BONUS} s`]], 'gold'), 300);
  }

  missions.report('flips', e.flips);
  missions.report(e.back ? 'backflips' : 'frontflips', e.flips);
  if (e.perfect) missions.report('perfects');
  missions.report('combo', e.multiplier);
  missions.report('bigTrick', e.flips);

  if (mode !== 'frenzy' && !run.goalShown && tricks.flips >= level.flipGoal) {
    run.goalShown = true;
    setTimeout(() => { popup([['★ FLIP GOAL!']], 'gold'); sfx.star(2); }, 450);
  }
  while (progress.milestone < MILESTONES.length && progress.flips >= MILESTONES[progress.milestone]) {
    const m = MILESTONES[progress.milestone++];
    addCoins(Math.round(m / 2));
    setTimeout(() => { popup([[`🏆 ${num(m)} LIFETIME FLIPS!`], [`+${num(m / 2)} coins`, 'pts']], 'gold'); sfx.milestone(); }, 900);
  }
  saveProgress();
}

function crash(e) {
  if (run.crashTimer) return;
  sim.crashed = true;
  run.crashTimer = 1.1;
  run.crashes++;
  const lost = tricks.crash();
  bike.throwRider(sim.chassis.getLinearVelocity());
  const c = sim.chassis.getPosition();
  particles.sparks(c.x, c.y);
  shake(0.6);
  sfx.crash();
  buzz(90);
  const what = e?.reason === 'landing' ? 'BAD LANDING!' : 'OUCH!';
  popup(lost.bailed ? [[what], ['trick lost', 'pts']] : lost.comboLost ? [[what], ['combo lost', 'pts']]
    : e?.reason === 'landing' ? [[what], ['land level with the track', 'pts']] : [[what]], 'bad');
}

function onTrickEvent(e) {
  if (e?.type === 'trick') onTrick(e);
  else if (e?.type === 'comboEnd') popup([[`${e.combo}× COMBO`], ['nice chain!', 'pts']], 'small');
}

// ---------- finishing ----------
function bestFlipScore() {
  return Math.max(progress.frenzy.best, progress.daily.best?.score ?? 0, ...LEVELS.map((l) => progress.levels[l.id]?.score ?? 0));
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

function goalRow(label, value, ok, isNew) {
  const li = document.createElement('li');
  li.className = (ok ? 'ok' : '') + (isNew ? ' new' : '');
  const tick = document.createElement('span');
  tick.className = 'tick';
  tick.textContent = ok ? '✓' : '';
  const text = document.createElement('span');
  text.textContent = label;
  if (isNew) {
    const n = document.createElement('small');
    n.textContent = '  NEW ★';
    text.append(n);
  }
  const val = document.createElement('span');
  val.className = 'val';
  val.textContent = value;
  li.append(tick, text, val);
  return li;
}

function finishRun() {
  run.finished = true;
  sim.coasting = true;
  // A trick landed right on the line still counts.
  if (tricks.pending) onTrickEvent(tricks.confirm());
  const time = run.time, flips = tricks.flips;
  let coins = 0, rows = [], note = '', stars = 0, banner = 'STAGE CLEAR!', streakText = '';

  if (mode === 'frenzy') {
    banner = "TIME'S UP!";
    const prevBest = progress.frenzy.best;
    const best = tricks.score > prevBest;
    progress.frenzy.best = Math.max(prevBest, tricks.score);
    progress.frenzy.runs++;
    coins = Math.floor(tricks.score / 100) + flips;
    rows = [
      goalRow('Flip score', num(tricks.score), best, false),
      goalRow('Flips', `${flips} ↻`, flips > 0, false),
      goalRow('Bonus time earned', `+${run.bonusTime} s`, run.bonusTime > 0, false),
    ];
    note = best ? (prevBest ? `New best! Up from ${num(prevBest)}` : 'Your first Frenzy score!') : `Best: ${num(prevBest)}. ${num(prevBest - tricks.score)} more to beat it`;
    missions.report('frenzy', tricks.score);
  } else {
    const got = { finish: true, time: time <= level.time, flips: flips >= level.flipGoal };
    let had = {};
    if (mode === 'custom') {
      banner = 'TEST RIDE DONE!';
      stars = +got.finish + +got.time + +got.flips;
    } else if (mode === 'level') {
      const prev = progress.levels[level.id];
      had = prev?.goals ?? {};
      progress.levels[level.id] = {
        time: Math.min(time, prev?.time ?? Infinity),
        flips: Math.max(flips, prev?.flips ?? 0),
        score: Math.max(tricks.score, prev?.score ?? 0),
        combo: Math.max(tricks.bestCombo, prev?.combo ?? 0),
        goals: { finish: true, time: got.time || !!had.time, flips: got.flips || !!had.flips },
        // The hardest difficulty you've finished it on (shown on the level button).
        hardest: DIFFICULTY_ORDER[Math.max(DIFFICULTY_ORDER.indexOf(prev?.hardest ?? 'easy'), DIFFICULTY_ORDER.indexOf(diff.id))],
      };
      stars = starsOf(progress.levels[level.id]);
      const newStars = ['finish', 'time', 'flips'].filter((k) => got[k] && !had[k]).length;
      if (newStars) missions.report('stars', newStars);
      coins = 5 + flips + tricks.perfects * 2 + newStars * 15;
    } else {
      // Daily: keep today's best, and the streak of days in a row.
      banner = 'DAILY DONE!';
      const today = todayUTC(), d = progress.daily;
      const firstToday = d.date !== today;
      if (firstToday) {
        d.streak = d.last === addDays(today, -1) ? d.streak + 1 : 1;
        d.last = today;
        d.date = today;
        d.best = null;
      }
      had = d.best?.goals ?? {};
      d.best = {
        time: Math.min(time, d.best?.time ?? Infinity),
        flips: Math.max(flips, d.best?.flips ?? 0),
        score: Math.max(tricks.score, d.best?.score ?? 0),
        goals: { finish: true, time: got.time || !!had.time, flips: got.flips || !!had.flips },
      };
      stars = starsOf(d.best);
      coins = 5 + flips + tricks.perfects * 2 + (firstToday ? 50 + 10 * Math.min(d.streak, 5) : 0);
      streakText = `🔥 ${d.streak}-day streak`;
      missions.report('daily');
    }
    rows = [
      goalRow('Finish', fmt(time), true, !had.finish),
      goalRow(`Under ${fmt(level.time)}`, fmt(time), got.time, got.time && !had.time),
      goalRow(`${level.flipGoal} flips`, `${flips} ↻`, got.flips, got.flips && !had.flips),
    ];
    const notes = [];
    if (!got.time) notes.push(`${(time - level.time).toFixed(2)} s off the time star`);
    if (!got.flips) {
      const short = level.flipGoal - flips;
      notes.push(`${short} flip${short > 1 ? 's' : ''} short of the flip star`);
    }
    note = notes.length ? `So close: ${notes.join(' · ')}` : 'All three goals in one run! 🔥';
    if (mode !== 'custom') {
      missions.report('finishes');
      if (run.crashes === 0) missions.report('cleanRun');
      // Keep the ghost if this was the fastest run on this course.
      const old = loadGhost(level.id);
      if (recorder && (!old || time < old.time)) saveGhost(level.id, time, recorder.samples);
    }
  }

  // Your own ghost: how did you do against it, or tell first-timers it now exists.
  let ghostLine = '';
  if ((mode === 'level' || mode === 'daily') && settings.ghost && !friend) {
    if (ghost) {
      const d = time - ghost.time;
      ghostLine = d < 0 ? `👻 You beat your ghost by ${(-d).toFixed(2)} s! This run is your new ghost.` : `👻 Your ghost wins by ${d.toFixed(2)} s. Try again?`;
    } else {
      ghostLine = '👻 This run is saved as your ghost. Race it next time!';
    }
  }
  // Racing a friend's ghost: who won?
  if (friend && mode !== 'frenzy') {
    const d = time - friend.time;
    note = d < 0 ? `🏆 You beat ${friend.name} by ${(-d).toFixed(2)} s!` : `${friend.name} was ${d.toFixed(2)} s faster. Rematch?`;
    banner = d < 0 ? 'YOU WIN!' : 'SO CLOSE!';
  }
  if (run.race) {
    live.say(`ww:fin:${run.race.id}:${Math.round(time * 1000)}`);
    banner = 'RACE OVER!';
  }
  lastRun = {
    course: level.name, courseId: level.id, time, flips, score: tricks.score, stars, mode, diff: diff.id,
    ghost: recorder && mode !== 'frenzy' ? { time, s: recorder.samples.slice() } : null,
    daily: level.date ? { variant: level.variant, time: level.time } : undefined,
  };
  coins = Math.round(coins * diff.coins);
  addCoins(coins);
  saveProgress();
  sfx.finish();
  const c = sim.chassis.getPosition();
  if (!calm()) particles.confetti(c.x + 4, c.y + 1);
  setState('finished');

  $('banner').textContent = banner;
  $('res-diff').textContent = `${diff.icon} ${diff.name}${diff.score !== 1 ? ` · flips ×${diff.score}` : ''}`;
  $('stars').hidden = mode === 'frenzy';
  $('goals').replaceChildren(...rows);
  $('res-score').textContent = num(tricks.score);
  $('res-combo').textContent = tricks.bestCombo ? `×${tricks.bestCombo}` : '–';
  $('res-perfect').textContent = tricks.perfects;
  $('res-lifetime').textContent = `↻ ${num(progress.flips)} lifetime flips`;
  $('res-note').textContent = note;
  $('res-ghost').textContent = ghostLine;
  $('res-ghost').hidden = !ghostLine;
  $('res-coins').textContent = `+${num(coins)}`;
  $('res-coins').append(coinIcon());
  $('res-streak').hidden = !streakText;
  $('res-streak').textContent = streakText;
  renderMissionList($('res-missions'), true);
  $('btn-next').hidden = mode !== 'level' || !nextLevel();
  $('btn-retry').textContent = mode === 'frenzy' ? '↻ Same course' : '↻ Retry';
  $('btn-menu').textContent = level.id === 'custom-editor' ? '✎ Editor' : 'Levels';
  $('btn-share').hidden = level.id === 'custom-editor';
  $('btn-x').hidden = level.id === 'custom-editor';
  renderRaceResults();

  const starEls = [...$('stars').children];
  starEls.forEach((s) => s.classList.remove('on'));
  starEls.slice(0, stars).forEach((s, i) => setTimeout(() => { s.classList.add('on'); sfx.star(i); }, 450 + i * 380));
  if (mode !== 'custom') submitScore();
  else $('res-save').textContent = friend ? 'Race links on past Daily courses are just for fun: not saved.' : 'Test rides are not saved.';
}

async function submitScore() {
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
$('btn-missions').onclick = openMissions;
$('btn-missions-close').onclick = () => { sfx.click(); $('missions').hidden = true; };
$('mode-daily').onclick = startDaily;
$('mode-frenzy').onclick = () => startFrenzy();
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
// The next level you can play: the next one along, if it's open.
function nextLevel() {
  const i = levelIndex + 1;
  return i < LEVELS.length && unlocked(i) ? i : null;
}
$('btn-next').onclick = () => startLevel(nextLevel() ?? levelIndex);

// ---------- garage ----------
// The showroom and shop load the first time you open the Garage.
let showroom = null, garageUI = null;
async function loadGarage() {
  if (garageUI) return;
  const [{ Showroom }, { setupGarage }] = await Promise.all([import('./showroom.js'), import('./garageui.js')]);
  showroom = new Showroom(player.style, look());
  showroom.trail = progress.garage.trail;
  showroom.attach($('game'));
  garageUI = setupGarage({
  progress,
  save: saveProgress,
  spend(n) {
    if (progress.coins < n) return false;
    progress.coins -= n;
    renderCoins(true);
    saveProgress();
    return true;
  },
  showroom,
  onEquip() {
    bike.setLook(look());
    ghostBike.setLook(look());
  },
  sfx,
  popup,
  });
}

async function openGarage() {
  sfx.click();
  await loadGarage();
  garageUI.open();
  showroom.active = true;
  $('menu').hidden = true;
  $('player-card').hidden = true;
  $('garage').hidden = false;
}

function closeGarage() {
  garageUI.reset();
  showroom.active = false;
  $('garage').hidden = true;
  setState('menu');
}
$('btn-garage').onclick = openGarage;
$('btn-garage-back').onclick = () => { sfx.click(); closeGarage(); };

// ---------- sharing ----------
// The link that goes with a shared result: the game, plus your ghost to race when there is one.
async function resultLink() {
  let url = location.origin + location.pathname;
  if (lastRun.ghost) {
    url += `#race=${await encodeRace({
      courseId: lastRun.courseId, name: riderName() || player.name || 'A friend', time: lastRun.time, ghost: lastRun.ghost,
      style: player.style, look: look(), daily: lastRun.daily,
    })}`;
  }
  return url;
}

// 𝕏 Post: opens a post with your result and the link (start.ng's game standards ask for this).
$('btn-x').onclick = async () => {
  if (!lastRun) return;
  sfx.click();
  const d = difficultyOf(lastRun.diff);
  const on = d.id === 'normal' ? '' : ` on ${d.icon} ${d.name}`;
  const text = lastRun.mode === 'frenzy'
    ? `I scored ${num(lastRun.score)} in Flip Frenzy${on} with ${lastRun.flips} flips! 🏍️ Wheelie Wahala on start.ng. Can you beat me?`
    : `I cleared ${lastRun.course} in ${fmt(lastRun.time)} with ${lastRun.flips} flips${on} ${'★'.repeat(lastRun.stars)} 🏍️ Wheelie Wahala on start.ng. ${lastRun.ghost ? 'Race my ghost!' : 'Can you beat me?'}`;
  const post = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(await resultLink())}`;
  window.open(post, '_blank', 'noopener');
};

$('btn-share').onclick = async () => {
  if (!lastRun) return;
  sfx.click();
  world.render(); // a fresh frame to put on the card
  const card = drawCard(world.renderer.domElement, {
    course: lastRun.course, time: fmt(lastRun.time), flips: lastRun.flips, score: num(lastRun.score),
    stars: lastRun.stars, rider: riderName() || player.name, url: location.host,
  });
  const url = await resultLink();
  const text = `I finished ${lastRun.course} in ${fmt(lastRun.time)} with ${lastRun.flips} flips on Wheelie Wahala! ${lastRun.ghost ? 'Race my ghost:' : 'Play:'}`;
  const res = await shareCard(card, { text, url, filename: 'wheelie-wahala.png' });
  if (res === 'downloaded+copied') popup([['Picture saved'], ['race link copied: paste it to a friend', 'pts']], 'small');
  else if (res === 'downloaded') popup([['Picture saved']], 'small');
};

// ---------- race links ----------
const courseName = (id) => (id.startsWith('daily-') ? `the Daily (${id.slice(6)})` : LEVELS.find((l) => l.id === id)?.name ?? 'a course');

async function readRaceLink() {
  const m = location.hash.match(/^#race=(.+)$/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search); // so a reload doesn't reopen it
  const c = await decodeRace(m[1]);
  if (!c) return popup([['That race link is broken']], 'small');
  if (!c.courseId.startsWith('daily-') && !LEVELS.some((l) => l.id === c.courseId)) return popup([['That course isn\'t in this version']], 'small');
  challenge = c;
  $('ch-text').textContent = `${c.name} finished ${courseName(c.courseId)} in ${fmt(c.time)}. Can you beat their ghost?`;
  $('challenge').hidden = false;
}

// Challenges open any course, even one you haven't unlocked yet.
async function startChallenge() {
  $('challenge').hidden = true;
  const c = challenge;
  if (!c) return;
  if (c.courseId.startsWith('daily-')) {
    const date = c.courseId.slice(6);
    loadCourse(await dailyCourse(date, c.daily), date === todayUTC() ? 'daily' : 'custom');
  } else {
    loadLevel(LEVELS.findIndex((l) => l.id === c.courseId));
  }
  beginRun(`Race ${c.name} · ${level.name}`);
}
$('btn-ch-go').onclick = () => { sfx.click(); startChallenge(); };
$('btn-ch-no').onclick = () => { sfx.click(); $('challenge').hidden = true; challenge = null; };

// ---------- name tags for ghosts and live riders ----------
const tagEls = new Map();
function setTag(id, text, x, y, z = 0, cls = '') {
  let el = tagEls.get(id);
  if (!text) {
    if (el) { el.remove(); tagEls.delete(id); }
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.className = `tag ${cls}`;
    $('tags').append(el);
    tagEls.set(id, el);
  }
  if (el.textContent !== text) el.textContent = text;
  tmp.set(x, y, z).project(world.camera);
  const sx = (tmp.x * 0.5 + 0.5) * innerWidth, sy = (-tmp.y * 0.5 + 0.5) * innerHeight;
  el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
  el.hidden = tmp.z > 1;
}

// ---------- live riders (start.ng live room) ----------
// Courses in the room: campaign levels 0–29, today's Daily 30, anything else isn't shared.
function courseSlot() {
  if (state !== 'playing' && state !== 'finished') return IDLE_SLOT;
  if (mode === 'level') return levelIndex;
  if (mode === 'daily' && level.id === `daily-${todayUTC()}`) return 30;
  return IDLE_SLOT;
}

const live = new LiveRoom({
  onStatus: renderLive,
  onPeers: renderLive,
  onChat: onLiveChat,
});

function renderLive() {
  const on = live.status === 'live';
  const n = live.count;
  $('live-count').hidden = !on;
  $('live-count').textContent = n ? `🟢 ${n} other rider${n > 1 ? 's' : ''} online` : '🟢 Live: invite riders when they come online';
  $('btn-race').hidden = !on;
}

// Other riders on your course, as see-through bikes in their own start.ng look.
const peerBikes = new Map();
function updatePeers() {
  const slot = courseSlot();
  const riders = slot === IDLE_SLOT ? [] : live.ridersOn(slot).slice(0, 8);
  const seen = new Set();
  riders.forEach((r, i) => {
    seen.add(r.id);
    let pb = peerBikes.get(r.id);
    if (!pb) {
      pb = new BikeModel(r.style ?? DEFAULT_STYLE, { ghost: true, look: { bike: 'dirt', paint: ['blue', 'green', 'pink', 'danfo'][r.id % 4] } });
      world.scene.add(pb.root);
      peerBikes.set(r.id, pb);
    }
    if (pb.root.parent !== world.scene) world.scene.add(pb.root);
    pb.root.position.z = -2.4 - (i % 3) * 0.8;
    pb.root.visible = true;
    pb.update(pb.poseFromChassis(r.x, r.y, r.angle));
    setTag(`peer${r.id}`, r.name, r.x, r.y + 1.9, pb.root.position.z);
  });
  for (const [id, pb] of peerBikes) {
    if (seen.has(id)) continue;
    pb.root.visible = false;
    setTag(`peer${id}`, null);
    if (!live.peers.has(id)) {
      pb.root.removeFromParent();
      peerBikes.delete(id);
    }
  }
}

// ---------- live races: invite, lobby, 3-2-1, results ----------
const LOBBY_MS = 12000;
let race = null; // the race you're in: { id, slot, host, startAt, riders: Map(id -> { name, time }) }
let invite = null; // a race someone else started that you could join

const slotName = (slot) => (slot === 30 ? "today's Daily" : LEVELS[slot]?.name ?? 'a course');

function onLiveChat(m, mine) {
  const [, kind, a, b] = m.text.split(':');
  if (kind === 'race') {
    const slot = parseInt(a, 10);
    if (!(slot >= 0 && slot <= 30)) return;
    const r = { id: `${m.id}-${m.at}`, slot, host: m.name, startAt: performance.now() + LOBBY_MS, riders: new Map([[m.id, { name: m.name, time: null }]]) };
    if (mine) {
      race = r;
      openLobby();
    } else if (!race) {
      invite = r;
      $('invite-text').textContent = `${m.name} is starting a race on ${slotName(slot)}!`;
      $('invite').hidden = false;
      sfx.checkpoint();
    }
  } else if (kind === 'join') {
    for (const r of [race, invite]) if (r?.id === a) r.riders.set(m.id, { name: m.name, time: null });
    renderLobby();
  } else if (kind === 'fin') {
    if (race?.id !== a) return;
    const ms = parseInt(b, 10);
    if (!(ms > 0)) return;
    race.riders.set(m.id, { name: m.name, time: ms / 1000 });
    renderRaceResults();
  }
}

function openLobby() {
  $('racepick').hidden = true;
  $('invite').hidden = true;
  $('menu').hidden = true;
  $('world').hidden = true;
  $('garage').hidden = true;
  if (showroom) showroom.active = false;
  $('lobby').hidden = false;
  $('lobby-course').textContent = `${race.host}'s race on ${slotName(race.slot)}`;
  renderLobby();
}

function renderLobby() {
  if (!race || $('lobby').hidden) return;
  $('lobby-riders').replaceChildren(...[...race.riders.values()].map((r) => {
    const li = document.createElement('li');
    li.textContent = r.name;
    return li;
  }));
}

function updateRaceTimers() {
  const now = performance.now();
  if (invite && now >= invite.startAt) {
    invite = null;
    $('invite').hidden = true;
  }
  if (race && !$('lobby').hidden) {
    const left = Math.max(0, Math.ceil((race.startAt - now) / 1000));
    if ($('lobby-time').textContent !== String(left)) $('lobby-time').textContent = left;
    if (now >= race.startAt) startRace();
  }
}

async function startRace() {
  $('lobby').hidden = true;
  const r = race;
  if (r.slot === 30) loadCourse(await dailyCourse(), 'daily');
  else loadLevel(r.slot);
  run.race = r;
  run.countdown = 3;
  beginRun(`Live race · ${level.name}`);
  $('hint').style.opacity = 0;
}

function renderRaceResults() {
  const box = $('res-race');
  if (!race || state !== 'finished') return;
  const rows = [...race.riders.entries()].sort(([, a], [, b]) => (a.time ?? Infinity) - (b.time ?? Infinity));
  box.replaceChildren(...rows.map(([id, r]) => {
    const li = document.createElement('li');
    li.className = id === live.me ? 'me' : '';
    li.textContent = `${r.name}${id === live.me ? ' (you)' : ''}: ${r.time != null ? fmt(r.time) : 'still riding…'}`;
    return li;
  }));
  box.hidden = false;
}

$('btn-race').onclick = () => {
  sfx.click();
  $('btn-race-level').textContent = `${LEVELS[levelIndex].name}`;
  $('racepick').hidden = false;
};
$('btn-race-level').onclick = () => { live.say(`ww:race:${levelIndex}`); };
$('btn-race-daily').onclick = () => { live.say('ww:race:30'); };
$('btn-race-cancel').onclick = () => { $('racepick').hidden = true; };
$('btn-invite-join').onclick = () => {
  if (!invite) return;
  sfx.click();
  race = invite;
  invite = null;
  live.say(`ww:join:${race.id}`);
  if (state === 'playing') setState('menu');
  openLobby();
};
$('btn-invite-no').onclick = () => { invite = null; $('invite').hidden = true; };
$('btn-lobby-leave').onclick = () => { race = null; $('lobby').hidden = true; setState('menu'); };

// ---------- full screen ----------
// Phones: a ⛶ button in the corner and on the pause screen, and (by default) full screen as a
// ride starts. iPhones can't do it for web pages, so the button explains Add to Home Screen.
function renderFullscreen() {
  const iosTip = isIOS() && !isStandalone() && !canFullscreen();
  const show = canFullscreen() || iosTip;
  $('btn-fullscreen').hidden = !show;
  $('btn-fullscreen-p').hidden = !show;
  const on = isFullscreen();
  $('btn-fullscreen').textContent = on ? '⤓' : '⛶';
  $('btn-fullscreen').title = on ? 'Leave full screen' : 'Full screen';
  $('btn-fullscreen-p').textContent = on ? '⤓ Leave full screen' : '⛶ Full screen';
}

function fullscreenButton() {
  sfx.click();
  if (!canFullscreen()) {
    $('iostip').hidden = false;
    return;
  }
  toggleFullscreen().then(renderFullscreen);
}
$('btn-fullscreen').onclick = fullscreenButton;
$('btn-fullscreen-p').onclick = fullscreenButton;
$('btn-iostip-ok').onclick = () => { sfx.click(); $('iostip').hidden = true; };
onFullscreenChange(() => {
  renderFullscreen();
  world.resize();
});

// iPhone players see the Add to Home Screen tip once, on their first ride.
function maybeShowIOSTip() {
  if (!isIOS() || isStandalone() || canFullscreen() || !isTouch()) return;
  try {
    if (localStorage.getItem('wheelie-wahala-iostip')) return;
    localStorage.setItem('wheelie-wahala-iostip', '1');
  } catch {}
  setTimeout(() => {
    if (state !== 'playing') return;
    setState('paused');
    $('iostip').hidden = false;
  }, 600);
}

// ---------- automatic quality ----------
// "Auto" starts at High on computers and Medium on phones, then steps down while riding
// if the frame rate stays low. The level it settles on is remembered for next time.
const QUALITY_STEPS = ['high', 'medium', 'low'];
const autoQuality = { level: 'high', time: 0, frames: 0, slow: 0 };
try { autoQuality.level = localStorage.getItem('wheelie-wahala-autoq') || (isTouch() ? 'medium' : 'high'); } catch {}

function watchFrameRate(dt) {
  if (settings.quality !== 'auto' || state !== 'playing' || document.hidden) return;
  autoQuality.time += dt;
  autoQuality.frames++;
  if (autoQuality.time < 2) return;
  const fps = autoQuality.frames / autoQuality.time;
  autoQuality.time = autoQuality.frames = 0;
  autoQuality.slow = fps < 40 ? autoQuality.slow + 1 : 0;
  const i = QUALITY_STEPS.indexOf(autoQuality.level);
  if (autoQuality.slow >= 2 && i < QUALITY_STEPS.length - 1) {
    autoQuality.level = QUALITY_STEPS[i + 1];
    autoQuality.slow = 0;
    try { localStorage.setItem('wheelie-wahala-autoq', autoQuality.level); } catch {}
    world.setQuality(autoQuality.level);
    popup([['Smoother graphics'], [`quality set to ${autoQuality.level}`, 'pts']], 'small');
  }
}

// ---------- offline play ----------
// On start.ng the service worker keeps the game's files so it starts with no connection.
// Locally it only runs with ?sw, so development files never get stuck in a cache.
{
  const params = new URLSearchParams(location.search);
  if ('serviceWorker' in navigator && !params.has('src') && (startng.onStartNg() || params.has('sw'))) {
    const register = () => navigator.serviceWorker.register('./sw.js').catch(() => {});
    // The game loads after the page, so 'load' may already have happened.
    if (document.readyState === 'complete') register();
    else addEventListener('load', register);
  }
}

// ---------- settings ----------
let settings = loadSettings();

function applySettings() {
  setVolumes({ master: settings.master / 100, music: settings.music / 100, sfx: settings.sfx / 100, engine: settings.engine / 100 });
  world.setQuality(settings.quality === 'auto' ? autoQuality.level : settings.quality);
  setTouchMode(settings.touch);
  document.body.classList.toggle('calm', settings.reduceMotion);
  document.body.classList.toggle('left-handed', settings.leftHanded);
  document.body.classList.toggle('big-buttons', settings.bigButtons);
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
  $('set-ghost').checked = settings.ghost;
  renderDifficulty();
  for (const k of ['reduceMotion', 'leftHanded', 'bigButtons', 'autoFullscreen']) $(`set-${k}`).checked = settings[k];
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

// Difficulty: Settings and the menu button (which steps through them). It applies from the next ride.
function renderDifficulty() {
  const d = difficultyOf(settings.difficulty);
  for (const b of $('set-difficulty').children) b.classList.toggle('on', b.dataset.v === d.id);
  const midRide = state === 'paused' && d.id !== diff.id;
  $('set-difficulty-note').textContent = d.blurb + (midRide ? ' (From your next ride.)' : '');
  const btn = $('btn-diff');
  btn.textContent = `${d.icon} ${d.name}`;
  btn.className = `pill diff d-${d.id}`;
  btn.title = `Difficulty: ${d.name}. ${d.blurb} Tap to change.`;
}
function setDifficulty(id) {
  updateSetting('difficulty', id);
  renderDifficulty();
}
for (const b of $('set-difficulty').children) {
  b.onclick = () => { sfx.click(); setDifficulty(b.dataset.v); };
}
$('btn-diff').onclick = () => {
  sfx.click();
  const next = DIFFICULTY_ORDER[(DIFFICULTY_ORDER.indexOf(settings.difficulty) + 1) % DIFFICULTY_ORDER.length];
  setDifficulty(next);
  const d = difficultyOf(next);
  popup([[`${d.icon} ${d.name.toUpperCase()}`], [d.blurb, 'pts']], d.id === 'extreme' ? 'bad' : 'small');
};

$('btn-settings').onclick = openSettings;
$('btn-settings-p').onclick = openSettings;
$('btn-settings-close').onclick = () => { sfx.click(); $('settings').hidden = true; };
$('set-name').addEventListener('input', (e) => updateSetting('riderName', e.target.value));
$('set-name').addEventListener('change', (e) => { e.target.value = cleanName(e.target.value); });
$('set-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
$('set-nametag').addEventListener('change', (e) => updateSetting('nameTag', e.target.checked));
for (const k of ['reduceMotion', 'leftHanded', 'bigButtons', 'autoFullscreen']) {
  $(`set-${k}`).addEventListener('change', (e) => updateSetting(k, e.target.checked));
}
$('set-ghost').addEventListener('change', (e) => {
  updateSetting('ghost', e.target.checked);
  ghost = settings.ghost && mode !== 'frenzy' ? loadGhost(level.id) : null;
});
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
      if (key === 'quality') settings.qualityPicked = true;
      updateSetting(key, b.dataset.v);
    };
  }
}
$('btn-reset').onclick = () => {
  if (!confirm('Reset all your stars, best times, lifetime flips, coins, streak and missions on this device? Scores already on the start.ng leaderboard stay there.')) return;
  progress.levels = {};
  progress.flips = 0;
  progress.milestone = 0;
  progress.coins = 0;
  progress.daily = { streak: 0, last: null, date: null, best: null };
  progress.frenzy = { best: 0, runs: 0 };
  progress.missions.active = [];
  missions.fill();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('wheelie-wahala-ghost:')) localStorage.removeItem(k);
    }
  } catch {}
  ghost = null;
  saveProgress();
  renderMenu();
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
  // Spin ring while flying: fills once per flip, the badge is flips so far.
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

// The see-through bike replays your best run on this course, in step with your clock.
// Where your ghost was when it reached x: its time there, for the live gap. Walks forward through
// the samples as you ride (loops send x backwards for a moment; the gap just holds still).
let ghostCursor = 0, coachTimer = 0, gapShownAt = 0;
function ghostTimeAt(x) {
  const s = ghost.s, n = s.length / 4;
  while (ghostCursor < n - 1 && s[(ghostCursor + 1) * 4 + 1] <= x) ghostCursor++;
  if (ghostCursor >= n - 1 || s[ghostCursor * 4 + 1] > x) return null;
  const a = ghostCursor * 4, b = a + 4;
  const k = (x - s[a + 1]) / ((s[b + 1] - s[a + 1]) || 1);
  return s[a] + (s[b] - s[a]) * Math.max(0, Math.min(1, k));
}

function updateGhost() {
  const pose = ghost && settings.ghost && state === 'playing' ? ghostPose(ghost, run.time) : null;
  ghostBike.root.visible = !!pose;
  if (pose) ghostBike.update(ghostBike.poseFromChassis(pose.x, pose.y, pose.angle));
  // 1. Name it: a cyan tag above it.
  if (pose) setTag('mine', `👻 Your best · ${fmt(ghost.time)}`, pose.x, pose.y + 1.9, -0.8, 'mine');
  else setTag('mine', null);

  // 2. The gap: how far ahead (green) or behind (red) your ghost you are, right now.
  const gapEl = $('hud-gap');
  const me = sim.chassis.getPosition();
  const tg = pose && run.started ? ghostTimeAt(me.x) : null;
  gapEl.hidden = tg === null;
  if (tg !== null && clock - gapShownAt > 0.12) {
    gapShownAt = clock;
    const d = run.time - tg;
    gapEl.textContent = `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)} s 👻`;
    gapEl.className = `hud-gap ${d < 0 ? 'ahead' : 'behind'}`;
  }

  // 3. Off the screen: an arrow at the edge saying where it is.
  const edge = $('ghost-edge');
  let off = false;
  if (pose && run.started) {
    tmp.set(pose.x, pose.y + 0.8, -0.8).project(world.camera);
    const sx = (tmp.x * 0.5 + 0.5) * innerWidth, sy = (-tmp.y * 0.5 + 0.5) * innerHeight;
    off = sx < 0 || sx > innerWidth;
    if (off) {
      const ahead = pose.x > me.x;
      const m = Math.round(Math.abs(pose.x - me.x));
      edge.textContent = ahead ? `👻 ${m} m ahead ▶` : `◀ 👻 ${m} m behind`;
      const y = Math.max(90, Math.min(innerHeight - 140, sy));
      const x = ahead ? innerWidth - edge.offsetWidth - 12 : 12;
      edge.style.transform = `translate(${x}px, ${y}px)`;
    }
  }
  edge.hidden = !off;

  // 4. Once ever: point at it the first time it rides with you.
  // It counts as seen the moment it appears; it stays up for 4 s of this run.
  const coach = $('coach');
  if (pose && run.started && !off && coachTimer === 0) {
    let seen = true;
    try { seen = !!localStorage.getItem('wheelie-wahala-ghost-intro'); } catch {}
    if (!seen) {
      coachTimer = 0.001;
      try { localStorage.setItem('wheelie-wahala-ghost-intro', '1'); } catch {}
    }
  }
  if (pose && !off && coachTimer > 0 && coachTimer < 4) {
    coachTimer += 1 / 60;
    tmp.set(pose.x, pose.y + 2.6, -0.8).project(world.camera);
    const sx = (tmp.x * 0.5 + 0.5) * innerWidth, sy = (-tmp.y * 0.5 + 0.5) * innerHeight;
    coach.hidden = false;
    coach.style.transform = `translate(${sx - coach.offsetWidth / 2}px, ${sy - coach.offsetHeight - 10}px)`;
  } else {
    coach.hidden = true;
  }
  // A friend's ghost always shows (that's the point of the link).
  const fp = friend && (state === 'playing' || state === 'finished') ? ghostPose(friend.ghost, run.time) : null;
  friendBike.root.visible = !!fp;
  if (fp) {
    friendBike.update(friendBike.poseFromChassis(fp.x, fp.y, fp.angle));
    setTag('friend', `${friend.name} 👻`, fp.x, fp.y + 1.9, -1.6, 'friend');
  } else setTag('friend', null);
}

function pause() {
  if (state === 'playing') setState('paused');
  renderGhostButton();
}

// Pause → 👻 Ghost: on/off (also in Settings).
function renderGhostButton() {
  $('btn-ghost-p').textContent = `👻 Ghost: ${settings.ghost ? 'on' : 'off'}`;
}
$('btn-ghost-p').onclick = () => {
  sfx.click();
  updateSetting('ghost', !settings.ghost);
  ghost = settings.ghost && (mode === 'level' || mode === 'daily') ? loadGhost(level.id) : null;
  ghostCursor = 0;
  renderGhostButton();
};

function goMenu() {
  race = null;
  $('res-race').hidden = true;
  if (mode === 'custom' && level?.id === 'custom-editor') {
    location.href = 'editor/';
    return;
  }
  const fromLevel = mode === 'level';
  loadLevel(levelIndex);
  setState('menu');
  if (fromLevel) openWorld(worldOf(level)); // back to the world you were playing
}

setupInput({
  onKey(code) {
    unlockAudio();
    if (code === 'KeyR' && state === 'playing') respawn();
    if (code === 'KeyT' && (state === 'playing' || state === 'paused' || state === 'finished')) restartLevel();
    if ((code === 'Escape' || code === 'KeyP')) {
      if (!$('iostip').hidden) $('iostip').hidden = true;
      else if (!$('settings').hidden) $('settings').hidden = true;
      else if (!$('missions').hidden) $('missions').hidden = true;
      else if (!$('world').hidden) closeWorld();
      else if (!$('garage').hidden) closeGarage();
      else if (state === 'playing') pause();
      else if (state === 'paused') setState('playing');
      else if (!$('board').hidden) $('board').hidden = true;
    }
    if (code === 'Enter' && state === 'paused') setState('playing');
    if ((code === 'Enter' || code === 'Space') && $('settings').hidden && $('board').hidden && $('missions').hidden && $('world').hidden && $('garage').hidden && $('lobby').hidden && $('racepick').hidden && $('challenge').hidden) {
      if (state === 'finished') ($('btn-next').hidden ? $('btn-retry') : $('btn-next')).click();
      else if (state === 'menu') startLevel(levelIndex);
    }
  },
});
addEventListener('gamepadconnected', () => {
  popup([['🎮 Controller ready'], ['A ride · B brake · stick lean · Start pause', 'pts']], 'small');
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
    else if (e.type === 'crash') crash(e);
    else if (e.type === 'boost') onBoost();
    else if (e.type === 'smash') onSmash(e);
  }
}

function onBoost() {
  sfx.boost();
  shake(0.15);
  buzz(20);
  popup([['BOOST!']], 'small');
}

// Crates: a few points and a crunch each.
const SMASH_POINTS = 50;
function onSmash(e) {
  tricks.score += SMASH_POINTS;
  sfx.smash();
  particles.dust(e.x, e.y, 0.9, '#c8873f');
  missions.report('crates');
}

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!window.__ww?.frozen) frame(dt); // tests can freeze the game to take screenshots
  requestAnimationFrame(tick);
}

function frame(dt) {
  clock += dt;
  watchFrameRate(dt);
  pollGamepad();
  // Slow motion on big tricks: game time runs at 35% and the camera punches in.
  const scale = slowmo > 0 ? 0.35 : 1;
  slowmo = Math.max(0, slowmo - dt);
  world.zoom = slowmo > 0 ? 0.8 : 1;
  const gdt = dt * scale;

  if (state === 'playing' && run.countdown > 0) {
    // Live race start: 3 · 2 · 1 · GO, everyone together. Nothing moves until GO.
    run.countdown -= dt;
    const n = Math.ceil(run.countdown);
    const cd = $('countdown');
    cd.hidden = false;
    if (cd.textContent !== String(n) && n > 0) { cd.textContent = n; sfx.star(0); }
    if (run.countdown <= 0) {
      cd.textContent = 'GO!';
      sfx.finish();
      setTimeout(() => (cd.hidden = true), 700);
      run.started = true;
    }
    bike.update(sim.snapshot(), { time: clock });
    world.follow(sim.chassis.getPosition(), sim.chassis.getLinearVelocity(), false, dt);
  } else if (state === 'playing') {
    const input = readInput();
    if (!run.started && anyInput()) run.started = true;
    const controls = run.crashTimer ? { throttle: 0, brake: 0, lean: 0 } : input;
    acc += gdt;
    while (acc >= STEP) {
      physicsStep(controls);
      acc -= STEP;
    }
    if (!sim.crashed) onTrickEvent(tricks.update(gdt));
    if (run.started && !run.finished) {
      run.time += gdt;
      if (mode === 'frenzy') run.timeLeft -= gdt;
    }

    const p = sim.chassis.getPosition();
    recorder?.record(run.time, p.x, p.y, sim.chassis.getAngle());
    for (let i = run.checkpoint + 1; i < track.checkpoints.length; i++) {
      if (p.x >= track.checkpoints[i].x && !sim.crashed) {
        run.checkpoint = i;
        if (tricks.pending) onTrickEvent(tricks.confirm());
        run.saved = tricks.snapshot();
        world.markCheckpoint(i);
        if (mode !== 'frenzy') {
          sfx.checkpoint();
          popup([['CHECKPOINT']], 'small');
        }
      }
    }
    if (p.y < track.killY) crash();
    if (run.crashTimer) {
      run.crashTimer -= dt;
      bike.updateThrown(gdt);
      if (run.crashTimer <= 0) respawn();
    }
    const timeUp = mode === 'frenzy' && run.timeLeft <= 0;
    if (!run.finished && ((!sim.crashed && p.x >= track.finishX) || timeUp)) finishRun();
    setEngine(sim.speed, input.throttle, !sim.crashed);
    if (state === 'playing') updateHud();
    bike.update(sim.snapshot(), { lean: input.lean, time: clock, speed: sim.speed });
    updateGhost();
    live.sendPose(courseSlot(), p.x, p.y, sim.chassis.getAngle(), run.started && !run.finished);
    world.follow(p, sim.chassis.getLinearVelocity(), !sim.rearGround && !sim.frontGround, dt);
  } else if (state === 'finished') {
    // Let the bike roll to a quiet stop.
    acc += gdt;
    while (acc >= STEP) {
      sim.step({ throttle: 0, brake: 0, lean: 0 }, STEP);
      acc -= STEP;
    }
    setEngine(0, 0, false);
    updateGhost();
    bike.update(sim.snapshot(), { time: clock, speed: sim.speed });
    world.follow(sim.chassis.getPosition(), sim.chassis.getLinearVelocity(), false, dt);
  } else if (state === 'menu') {
    // Show off the rider: slow orbit around the bike at the start line.
    setEngine(0, 0, false);
    updateGhost();
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

  // Your trail streams from the rear wheel while you ride.
  const trail = progress.garage.trail;
  if (trail !== 'none' && state === 'playing' && !sim.crashed && sim.speed > 4) {
    const r = sim.rear.getPosition(), v = sim.chassis.getLinearVelocity();
    particles.trail(trail, r.x, r.y, v.x, v.y, clock);
  }
  updatePeers();
  updateRaceTimers();
  particles.update(state === 'paused' ? 0 : gdt);
  world.syncDynamics();
  world.animate(clock);
  if (showroom?.active) showroom.render(world.renderer, clock, dt);
  else world.render();
  updateOverlays();
}

applySettings();
renderDifficulty();
loadLevel(0);
setState('menu');
readRaceLink();
live.connect();
// A link opened while the game is already open in this tab only changes the part after #.
addEventListener('hashchange', () => {
  stripSessionFromAddress();
  readRaceLink();
});
renderFullscreen();
if (new URLSearchParams(location.search).get('play') === 'editor') startCustom();
refreshPlayer();
requestAnimationFrame(tick);

// For quick checks from the console.
// advance(seconds) steps the game without waiting for the screen (for automated tests).
window.__ww = {
  get sim() { return sim; }, get run() { return run; }, get state() { return state; }, get mode() { return mode; },
  startLevel, startDaily, startFrenzy, player, progress, bike, goMenu, world, tricks, totals, missions,
  live, get race() { return race; }, get challenge() { return challenge; }, get lastRun() { return lastRun; },
  advance(seconds, fps = 60) { for (let t = 0; t < seconds; t += 1 / fps) frame(1 / fps); },
};
