// All sound is made with WebAudio, so there are no audio files.
let ctx, master, engine, engineGain, engineFilter, muted = false;

try {
  muted = localStorage.getItem('ww-muted') === '1';
} catch {}

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.6;
  master.connect(ctx.destination);

  // Engine: two detuned saws through a low-pass filter.
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 700;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineFilter.connect(engineGain).connect(master);
  engine = [0, 7].map((detune) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 50;
    o.detune.value = detune;
    o.connect(engineFilter);
    o.start();
    return o;
  });
}

export function setEngine(speed, throttle, running) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const f = 45 + Math.min(30, speed) * 5.5 + (throttle ? 25 : 0);
  for (const o of engine) o.frequency.setTargetAtTime(f, t, 0.05);
  engineFilter.frequency.setTargetAtTime(500 + f * 4, t, 0.05);
  engineGain.gain.setTargetAtTime(running ? (throttle ? 0.16 : 0.08) : 0, t, 0.08);
}

function tone(freq, start, dur, type = 'square', vol = 0.15) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, vol = 0.4, cutoff = 900) {
  if (!ctx) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf;
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start();
}

export const sfx = {
  flip: (n = 1) => [660, 880, 1320].slice(0, Math.min(3, n + 1)).forEach((f, i) => tone(f, i * 0.07, 0.18, 'triangle', 0.18)),
  land: () => noise(0.12, 0.25, 400),
  crash: () => { noise(0.5, 0.6, 1200); tone(90, 0, 0.35, 'sawtooth', 0.12); },
  checkpoint: () => { tone(740, 0, 0.1, 'triangle'); tone(988, 0.08, 0.15, 'triangle'); },
  finish: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'square', 0.1)),
  star: (i) => tone(880 + i * 220, 0, 0.25, 'triangle', 0.18),
  click: () => tone(520, 0, 0.06, 'square', 0.06),
};

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('ww-muted', muted ? '1' : '0'); } catch {}
  if (master) master.gain.value = muted ? 0 : 0.6;
  return muted;
}

export const isMuted = () => muted;
