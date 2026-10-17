// All sound is made with WebAudio, so there are no audio files.
//   master ── music  (a quiet looping groove)
//          ├─ engine (motorbike sound that follows the wheel speed)
//          └─ sfx    (flips, landings, crashes, stars)
let ctx, master, musicBus, sfxBus, engineGain, engineFilter, enginePulse, engineLfo, engine = [], muted = false;
let musicTimer, nextNote = 0, stepIndex = 0, musicLevel = 0.5, musicOn = true;

try {
  muted = localStorage.getItem('ww-muted') === '1';
  musicOn = localStorage.getItem('ww-music') !== '0';
} catch {}

const MASTER = 0.7;
// 0..1 per channel, set from the settings screen.
const vol = { master: 1, music: 0.7, sfx: 0.8, engine: 0.6 };
const masterGain = () => (muted ? 0 : MASTER * vol.master);
const musicGain = () => (musicOn ? musicLevel * 0.5 * vol.music : 0);

export function setVolumes(v) {
  Object.assign(vol, v);
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(masterGain(), t, 0.05);
  musicBus.gain.setTargetAtTime(musicGain(), t, 0.1);
  sfxBus.gain.setTargetAtTime(vol.sfx, t, 0.05);
}

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = masterGain();
  master.connect(ctx.destination);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = vol.sfx;
  sfxBus.connect(master);

  // Music goes through a soft echo so the plucks sound roomy, not beepy.
  musicBus = ctx.createGain();
  musicBus.gain.value = musicGain();
  const echo = ctx.createDelay(1);
  echo.delayTime.value = 0.43;
  const echoBack = ctx.createGain();
  echoBack.gain.value = 0.28;
  const echoTone = ctx.createBiquadFilter();
  echoTone.type = 'lowpass';
  echoTone.frequency.value = 1800;
  musicBus.connect(master);
  musicBus.connect(echo);
  echo.connect(echoTone).connect(echoBack).connect(echo);
  echoBack.connect(master);

  // Engine: a motorbike "brap" in the mid range, so phone and laptop speakers can play it.
  // Two saws plus a sub square -> rumble trimmed off -> warm low-pass -> pulsing like firing strokes.
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 90;
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 800;
  engineFilter.Q.value = 0.8;
  enginePulse = ctx.createGain();
  enginePulse.gain.value = 0.65;
  engineLfo = ctx.createOscillator();
  engineLfo.frequency.value = 20;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.35;
  engineLfo.connect(lfoDepth).connect(enginePulse.gain);
  engineLfo.start();
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  hp.connect(engineFilter).connect(enginePulse).connect(engineGain).connect(master);
  engine = [['sawtooth', 1, 0, 0.5], ['sawtooth', 1, 9, 0.35], ['square', 0.5, 0, 0.3]].map(([type, ratio, detune, level]) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = 80 * ratio;
    o.detune.value = detune;
    g.gain.value = level;
    o.connect(g).connect(hp);
    o.start();
    return { o, ratio };
  });

  startMusic();
}

export function setEngine(speed, throttle, running) {
  if (!ctx) return;
  const t = ctx.currentTime;
  // Revs: about 70 Hz at idle up to about 300 Hz flat out.
  const f = 70 + Math.min(30, speed) * 6.8 + (throttle ? 18 : 0);
  for (const { o, ratio } of engine) o.frequency.setTargetAtTime(f * ratio, t, 0.07);
  engineLfo.frequency.setTargetAtTime(f / 4, t, 0.07);
  engineFilter.frequency.setTargetAtTime(520 + f * 3.2 + (throttle ? 300 : 0), t, 0.07);
  engineGain.gain.setTargetAtTime(running ? (throttle ? 0.2 : 0.1) * vol.engine : 0, t, 0.1);
}

// ---------- music ----------
// 4 bars of C – G – Am – F at 100 bpm: plucked arpeggio, round bass and a soft shaker.
const BPM = 100;
const STEP_T = 60 / BPM / 2; // eighth notes
const CHORDS = [
  [60, 64, 67, 72], // C
  [59, 62, 67, 71], // G/B
  [57, 60, 64, 69], // Am
  [53, 57, 60, 65], // F
];
const ARP = [0, 2, 1, 3, 2, 1, 3, 1];
const BASS_STEPS = new Set([0, 3, 4, 6]);
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

function startMusic() {
  nextNote = ctx.currentTime + 0.1;
  clearInterval(musicTimer);
  musicTimer = setInterval(scheduleMusic, 60);
}

function scheduleMusic() {
  while (nextNote < ctx.currentTime + 0.25) {
    const bar = Math.floor(stepIndex / 8) % CHORDS.length;
    const step = stepIndex % 8;
    const chord = CHORDS[bar];
    pluck(midi(chord[ARP[step]] + 12), nextNote, 0.5, 0.11);
    if (BASS_STEPS.has(step)) bassNote(midi(chord[0] - 24), nextNote, step === 0 ? 0.42 : 0.24);
    if (step % 2 === 1) shaker(nextNote, 0.035);
    stepIndex++;
    nextNote += STEP_T;
  }
}

function pluck(freq, t, dur, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = 'triangle';
  o.frequency.value = freq;
  f.type = 'lowpass';
  f.frequency.setValueAtTime(3200, t);
  f.frequency.exponentialRampToValueAtTime(700, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(f).connect(g).connect(musicBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function bassNote(freq, t, dur) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.28, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(musicBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let shakerBuf;
function shaker(t, vol) {
  if (!shakerBuf) {
    shakerBuf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const d = shakerBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  }
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = shakerBuf;
  f.type = 'highpass';
  f.frequency.value = 6500;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(musicBus);
  src.start(t);
}

// 0..1. The music sits a little lower while you ride so the effects come through.
export function setMusicLevel(level) {
  musicLevel = level;
  if (musicBus) musicBus.gain.setTargetAtTime(musicGain(), ctx.currentTime, 0.4);
}

export function toggleMusic() {
  musicOn = !musicOn;
  try { localStorage.setItem('ww-music', musicOn ? '1' : '0'); } catch {}
  setMusicLevel(musicLevel);
  return musicOn;
}

export const isMusicOn = () => musicOn;

// Nothing plays while the tab is hidden.
export function suspendAudio(hidden) {
  if (!ctx) return;
  if (hidden) ctx.suspend();
  else ctx.resume();
}

// ---------- effects ----------
function tone(freq, start, dur, type = 'triangle', vol = 0.1) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, vol, cutoff) {
  if (!ctx) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf;
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(sfxBus);
  src.start();
}

// Effects can be asked for many times in a row; this stops them piling up.
const lastPlayed = {};
const limit = (name, gap, fn) => (...args) => {
  const now = performance.now();
  if (now - (lastPlayed[name] ?? 0) < gap) return;
  lastPlayed[name] = now;
  fn(...args);
};

export const sfx = {
  flip: limit('flip', 150, (n = 1) => [660, 880, 1320].slice(0, Math.min(3, n + 1)).forEach((f, i) => tone(f, i * 0.07, 0.2, 'triangle', 0.1))),
  land: limit('land', 250, () => noise(0.1, 0.12, 300)),
  crash: limit('crash', 800, () => { noise(0.35, 0.25, 700); tone(110, 0, 0.3, 'sine', 0.12); }),
  checkpoint: limit('checkpoint', 300, () => { tone(740, 0, 0.12, 'sine', 0.1); tone(988, 0.08, 0.18, 'sine', 0.1); }),
  finish: limit('finish', 1000, () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.35, 'triangle', 0.09))),
  star: (i) => tone(880 + i * 220, 0, 0.3, 'sine', 0.12),
  click: limit('click', 60, () => tone(520, 0, 0.06, 'sine', 0.06)),
  // Combo: each step of the chain plays a little higher.
  combo: (m) => { const f = 523 * 2 ** (Math.min(12, (m - 1) * 2) / 12); tone(f, 0.12, 0.16, 'square', 0.05); tone(f * 1.5, 0.2, 0.2, 'triangle', 0.07); },
  perfect: limit('perfect', 200, () => { tone(1568, 0, 0.12, 'sine', 0.09); tone(2093, 0.06, 0.3, 'sine', 0.08); }),
  boost: limit('boost', 300, () => { tone(220, 0, 0.35, 'sawtooth', 0.04); tone(440, 0.05, 0.35, 'triangle', 0.07); noise(0.3, 0.12, 2400); }),
  smash: limit('smash', 70, () => { noise(0.12, 0.3, 1600); tone(140, 0, 0.1, 'square', 0.05); }),
  milestone: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.4, 'triangle', 0.09)),
};

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('ww-muted', muted ? '1' : '0'); } catch {}
  if (master) master.gain.setTargetAtTime(masterGain(), ctx.currentTime, 0.05);
  return muted;
}

export const isMuted = () => muted;
