// Sharing: a picture of your result, and a link that lets a friend race your ghost.
//
// Ghost links carry the run in the address after # (never sent to any server):
//   #race=<course id>~<data>
// data: base64url of one deflate-compressed block: a 2-byte length, the header as JSON
//   { v: 2, c: course id, n: name, t: time, st: style, lk: bike look, d: daily info }
// and then int16 deltas, 10 samples a second: x, y (5 cm), angle (0.01 rad).
// The first version (#race=<base64 JSON header>.<path>) still opens. It looked just like a
// sign-in token (both start "eyJ…"), which worried people, so links no longer use it.
import { ghostPose } from './ghost.js';

const RATE = 10; // samples per second in a link
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const textBytes = (s) => new TextEncoder().encode(s);

async function squeeze(bytes, mode) {
  if (typeof CompressionStream !== 'function') return null;
  const stream = new Blob([bytes]).stream().pipeThrough(mode === 'in' ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ghost: { time, s: [t, x, y, angle, ...] } as saved by ghost.js
export async function encodeRace({ courseId, name, time, ghost, style, look, daily }) {
  const n = Math.floor(time * RATE) + 1;
  const ints = new Int16Array(n * 3);
  let px = 0, py = 0, pa = 0;
  for (let i = 0; i < n; i++) {
    const last = ghost.s.length - 4;
    const p = ghostPose(ghost, i / RATE) ?? { x: ghost.s[last + 1], y: ghost.s[last + 2], angle: ghost.s[last + 3] };
    const x = Math.round(p.x * 20), y = Math.round(p.y * 20), a = Math.round(p.angle * 100);
    const clamp = (v) => Math.max(-32768, Math.min(32767, v));
    ints[i * 3] = clamp(x - px);
    ints[i * 3 + 1] = clamp(y - py);
    ints[i * 3 + 2] = clamp(a - pa);
    px = x; py = y; pa = a;
  }
  const head = textBytes(JSON.stringify({ v: 2, c: courseId, n: name, t: Math.round(time * 100) / 100, st: style, lk: look, d: daily }));
  const raw = new Uint8Array(2 + head.length + ints.byteLength);
  raw[0] = head.length >> 8;
  raw[1] = head.length & 255;
  raw.set(head, 2);
  raw.set(new Uint8Array(ints.buffer), 2 + head.length);
  const packed = await squeeze(raw, 'in');
  // "z" marks a compressed block (browsers without CompressionStream send it as it is).
  return `${courseId}~${packed ? 'z' : 'r'}${b64url(packed ?? raw)}`;
}

async function decodeV2(text) {
  const data = text.slice(text.indexOf('~') + 1);
  let bytes = unb64url(data.slice(1));
  if (data[0] === 'z') bytes = await squeeze(bytes, 'out');
  if (!bytes) return null;
  const len = (bytes[0] << 8) | bytes[1];
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(2, 2 + len)));
  if (header.v !== 2) return null;
  const body = bytes.slice(2 + len); // a copy, so the int16 view starts on an even byte
  return { header, ints: new Int16Array(body.buffer, 0, Math.floor(body.length / 2)) };
}

// Back to { courseId, name, time, style, look, daily, ghost } or null if the link is broken.
export async function decodeRace(text) {
  try {
    let header, ints;
    if (text.includes('~')) {
      const v2 = await decodeV2(text);
      if (!v2) return null;
      ({ header, ints } = v2);
    } else {
      const [h, data] = text.split('.');
      header = JSON.parse(new TextDecoder().decode(unb64url(h)));
      if (header.v !== 1) return null;
      let bytes = unb64url(data);
      if (header.z) bytes = await squeeze(bytes, 'out');
      if (!bytes) return null;
      bytes = bytes.slice();
      ints = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
    }
    if (typeof header.c !== 'string' || !(header.t > 0)) return null;
    const s = [];
    let x = 0, y = 0, a = 0;
    for (let i = 0; i + 2 < ints.length; i += 3) {
      x += ints[i]; y += ints[i + 1]; a += ints[i + 2];
      s.push(i / 3 / RATE, x / 20, y / 20, a / 100);
    }
    const name = String(header.n ?? 'A friend').slice(0, 20);
    return { courseId: header.c, name, time: header.t, style: header.st, look: header.lk, daily: header.d, ghost: { time: header.t, s } };
  } catch {
    return null;
  }
}

// ---------- result card ----------
// A 1200×630 picture: the moment you crossed the line, plus your numbers.
export function drawCard(sceneCanvas, { course, time, flips, score, stars, rider, url }) {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 630;
  const g = c.getContext('2d');
  // The game view, cropped to fill.
  const sw = sceneCanvas.width, sh = sceneCanvas.height;
  const scale = Math.max(1200 / sw, 630 / sh);
  g.drawImage(sceneCanvas, (1200 - sw * scale) / 2, (630 - sh * scale) / 2, sw * scale, sh * scale);
  const shade = g.createLinearGradient(0, 220, 0, 630);
  shade.addColorStop(0, 'rgba(42,22,8,0)');
  shade.addColorStop(1, 'rgba(42,22,8,.85)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 1200, 630);

  const text = (t, x, y, size, fill, stroke = '#c8551b', align = 'left') => {
    g.font = `${size}px "Lilita One", "Arial Black", sans-serif`;
    g.textAlign = align;
    g.lineJoin = 'round';
    g.lineWidth = size * 0.14;
    g.strokeStyle = stroke;
    g.strokeText(t, x, y);
    g.fillStyle = fill;
    g.fillText(t, x, y);
  };
  text('Wheelie Wahala!', 44, 92, 64, '#ffe14d');
  text(course, 44, 430, 44, '#ffffff');
  text(`⏱ ${time}`, 44, 510, 64, '#ffffff');
  text(`↻ ${flips} flips · ${score} pts`, 44, 580, 40, '#ffe14d');
  text('★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars), 1156, 510, 70, '#ffb400', '#7a4f00', 'right');
  if (rider) text(rider, 1156, 580, 36, '#ffffff', '#c8551b', 'right');
  g.font = '22px Nunito, sans-serif';
  g.textAlign = 'right';
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.fillText(url, 1156, 60);
  return c;
}

// Share the picture (and link) with the phone's share sheet, or download it on computers.
export async function shareCard(canvas, { text, url, filename }) {
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  const file = blob && new File([blob], filename, { type: 'image/png' });
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: `${text} ${url}` });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  // Computers: save the picture and copy the link.
  if (blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return 'downloaded+copied';
  } catch {
    return 'downloaded';
  }
}
