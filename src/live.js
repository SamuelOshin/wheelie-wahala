// Live riders and races, through start.ng's live room for this game.
//
// The room carries { x, z, ry, moving } per player, with x and z kept within ±60 m. A bike
// course is longer than that, so a position is packed into those numbers:
//   x  = -60 + distance / 10            (0–1200 m along the course)
//   z  = -60 + course * 3 + h * 2.9     (course slot 0–39; h = height mapped to 0–1)
//   ry = the bike's angle (the room keeps it in 0–2π)
//   moving = riding right now
// Race invites, joins and finish times travel as short room chat messages starting "ww:".
import { liveTicket, onStartNg } from './startng.js';

const BAD_TICKET = 4401, ROOM_FULL = 4403, REPLACED = 4409;
export const IDLE_SLOT = 39;
const H_MIN = -200, H_SPAN = 500;

export function packPose(slot, x, y, angle, riding) {
  const h = Math.max(0, Math.min(0.999, (y - H_MIN) / H_SPAN));
  return {
    type: 'move',
    x: Math.max(-60, Math.min(60, -60 + x / 10)),
    z: -60 + slot * 3 + h * 2.9,
    ry: angle,
    moving: riding,
  };
}

export function unpackPose(m) {
  const zz = m.z + 60;
  const slot = Math.floor(zz / 3);
  return {
    slot,
    x: (m.x + 60) * 10,
    y: ((zz - slot * 3) / 2.9) * H_SPAN + H_MIN,
    angle: m.ry > Math.PI ? m.ry - Math.PI * 2 : m.ry,
    riding: !!m.moving,
  };
}

export class LiveRoom {
  // handlers: onStatus(status), onPeers(), onChat(msg, mine)
  constructor(handlers) {
    this.h = handlers;
    this.peers = new Map(); // id -> { id, name, style, pose, prev, at }
    this.me = null;
    this.ws = null;
    this.tries = 0;
    this.status = 'off'; // off | connecting | live | signin | full | replaced
    this.lastSend = 0;
  }

  // Locally, ?live=ws://localhost:8770 connects to tools/live-mock.py for testing.
  async connect() {
    const dev = new URLSearchParams(location.search).get('live');
    if (!dev && !onStartNg()) return;
    this.setStatus('connecting');
    let url;
    if (dev) {
      url = `${dev}?ticket=dev-${encodeURIComponent(new URLSearchParams(location.search).get('as') || 'Tester')}`;
    } else {
      const pass = await liveTicket();
      if (!pass) return this.retry();
      if (!pass.ok) return this.setStatus('signin');
      url = `${pass.url}?ticket=${encodeURIComponent(pass.ticket)}`;
    }
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      this.receive(m);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.peers.clear();
      this.h.onPeers();
      if (e.code === BAD_TICKET) return this.setStatus('signin');
      if (e.code === REPLACED) return this.setStatus('replaced');
      this.setStatus(e.code === ROOM_FULL ? 'full' : 'connecting');
      this.retry();
    };
  }

  retry() {
    const delay = Math.min(20000, 1500 * 2 ** this.tries++);
    setTimeout(() => this.connect(), delay);
  }

  setStatus(s) {
    this.status = s;
    this.h.onStatus(s);
  }

  receive(m) {
    const now = performance.now();
    switch (m.type) {
      case 'welcome':
        this.tries = 0;
        this.me = m.you;
        this.peers.clear();
        for (const p of m.players ?? []) if (p.id !== m.you) this.addPeer(p);
        this.setStatus('live');
        break;
      case 'join':
        if (m.player?.id !== this.me) this.addPeer(m.player);
        break;
      case 'move': {
        const p = this.peers.get(m.id);
        if (!p) break;
        p.prev = p.pose;
        p.pose = unpackPose(m);
        p.at = now;
        break;
      }
      case 'leave':
        this.peers.delete(m.id);
        break;
      case 'chat':
        if (typeof m.text === 'string' && m.text.startsWith('ww:')) this.h.onChat(m, m.id === this.me);
        return;
      default:
        return;
    }
    this.h.onPeers();
  }

  addPeer(p) {
    if (!p) return;
    const pose = p.x == null ? null : unpackPose(p);
    this.peers.set(p.id, { id: p.id, name: p.name, style: p.style, pose, prev: pose, at: performance.now() });
  }

  // Up to ten times a second while riding (the room allows 25).
  sendPose(slot, x, y, angle, riding) {
    const now = performance.now();
    if (!this.live || now - this.lastSend < 100) return;
    this.lastSend = now;
    this.ws.send(JSON.stringify(packPose(slot, x, y, angle, riding)));
  }

  say(text) {
    if (this.live) this.ws.send(JSON.stringify({ type: 'chat', text }));
  }

  get live() {
    return this.ws?.readyState === WebSocket.OPEN && this.status === 'live';
  }

  // Riders on a course, with their pose smoothed between updates.
  ridersOn(slot) {
    const now = performance.now();
    const out = [];
    for (const p of this.peers.values()) {
      if (!p.pose || p.pose.slot !== slot || !p.pose.riding || now - p.at > 3000) continue;
      const k = Math.min(1, (now - p.at) / 100);
      const a = p.prev?.slot === slot ? p.prev : p.pose, b = p.pose;
      let da = b.angle - a.angle;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      out.push({ ...p, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: a.angle + da * k });
    }
    return out;
  }

  // How many people are in the room (riding anywhere or in the menus).
  get count() {
    return this.peers.size;
  }
}
