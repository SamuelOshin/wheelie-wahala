// Turns a compact level description into track polylines and segments.
//
// A level is a start point plus a list of pieces. Each piece moves a "pen" to the
// right, adding points to the current chain:
//   ['flat', dx]               straight and level
//   ['line', dx, dy]           straight line
//   ['slope', dx, dy]          smooth S-curve (flat at both ends)
//   ['ramp', dx, dy]           flat start, steep lip at the end (a kicker)
//   ['dip', dx, depth]         U-shaped valley that comes back to the same height
//   ['hill', dx, h]            smooth bump
//   ['bumps', dx, h, n]        n small bumps
//   ['loop', r]                a full loop, exits a little further right
//   ['gap', dx, dy, style?]    lift the pen and start a new chain (a jump)
//   ['style', name]            change style of the following chains
//   ['checkpoint']             respawn point just after the pen (put it on a flat)
//   ['boost', dx]              flat boost pad that pushes the bike forward
//   ['seesaw', len]            a plank on a pivot across a gap: ride up, it tips you down
//   ['crates', n]              a stack of n crates on the track ahead to smash through
//
// Styles: 'ground' (filled earth), 'line' (thin red line), 'wood' / 'ice' (thick bands),
// 'road' (Lagos asphalt), 'snow' (snowy earth).

const STEP = 0.4; // metres between sampled points
const RUN_IN = 40, RUN_OUT = 100;

export function buildTrack(level) {
  const chains = [];
  const startX = level.start?.[0] ?? 0;
  // Run-in before the start and run-out past the finish, so no cliff edges show.
  const pieces = [['flat', RUN_IN], ...level.pieces, ['flat', RUN_OUT]];
  let x = startX - RUN_IN;
  let y = level.start?.[1] ?? 0;
  let style = level.style ?? 'ground';
  let cur;
  const checkpoints = [];
  const boosts = [], seesaws = [], crates = [];

  const newChain = () => {
    cur = { style, points: [{ x, y }] };
    chains.push(cur);
  };
  const to = (px, py) => {
    cur.points.push({ x: px, y: py });
    x = px;
    y = py;
  };
  // Samples y = y0 + f(t) * dy over dx, t in (0, 1].
  const curve = (dx, f) => {
    const x0 = x, y0 = y;
    const n = Math.max(1, Math.ceil(Math.abs(dx) / STEP));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      to(x0 + dx * t, y0 + f(t));
    }
  };

  newChain();
  for (const p of pieces) {
    const [kind, a = 0, b = 0, c = 0] = p;
    switch (kind) {
      case 'flat': to(x + a, y); break;
      case 'line': to(x + a, y + b); break;
      case 'slope': curve(a, (t) => b * (1 - Math.cos(Math.PI * t)) / 2); break;
      case 'ramp': curve(a, (t) => b * t * t); break;
      case 'dip': curve(a, (t) => -b * Math.sin(Math.PI * t) ** 2); break;
      case 'hill': curve(a, (t) => b * Math.sin(Math.PI * t) ** 2); break;
      case 'bumps': curve(a, (t) => b * Math.sin(Math.PI * t * c) ** 2); break;
      case 'loop': {
        // A loop whose centre drifts right while it turns, so the way out sits
        // beside the way in. The physics only lets the bike touch track near its
        // own progress along the course, so the overlap never matters.
        const r = a, drift = b || 3.2;
        const x0 = x, y0 = y;
        const n = Math.ceil((2 * Math.PI * r) / STEP);
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          const th = -Math.PI / 2 + t * Math.PI * 2;
          to(x0 + drift * t + r * Math.cos(th), y0 + r + r * Math.sin(th));
        }
        break;
      }
      case 'gap':
        x += a;
        y += b;
        if (c) style = c;
        newChain();
        break;
      case 'style':
        style = a;
        cur.style = a;
        break;
      case 'checkpoint':
        checkpoints.push(x + 2);
        break;
      case 'boost':
        boosts.push({ x0: x, x1: x + a, y });
        to(x + a, y);
        break;
      case 'seesaw':
        // The track stops; the plank bridges the gap; the track carries on at the same height.
        seesaws.push({ x0: x, y, len: a });
        x += a;
        newChain();
        break;
      case 'crates':
        crates.push({ x: x + 4, y, n: a || 3 });
        break;
      default:
        throw new Error(`Unknown track piece ${kind}`);
    }
  }

  // Segments in course order, with distance along the course (s).
  const segments = [];
  let s = 0;
  chains.forEach((chain, ci) => {
    chain.segStart = segments.length;
    for (let i = 1; i < chain.points.length; i++) {
      const a = chain.points[i - 1], b = chain.points[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 1e-6) continue;
      segments.push({
        ax: a.x, ay: a.y, bx: b.x, by: b.y, len,
        nx: -(b.y - a.y) / len, ny: (b.x - a.x) / len, // left of travel = "up"
        s0: s, s1: s + len, chain: ci,
      });
      s += len;
    }
    chain.segEnd = segments.length;
    // Distance across a gap still counts, so the window logic stays simple.
    const next = chains[ci + 1];
    if (next) {
      const last = chain.points[chain.points.length - 1];
      s += Math.hypot(next.points[0].x - last.x, next.points[0].y - last.y);
    }
  });

  const lastChain = chains[chains.length - 1];
  const end = lastChain.points[lastChain.points.length - 1];
  const finishX = end.x - RUN_OUT;

  let minY = Infinity;
  for (const ch of chains) for (const p of ch.points) minY = Math.min(minY, p.y);
  // Falling this far below the lowest track means the bike has left the course.
  const killY = minY - 40;
  const track = { chains, segments, length: s, finishX, end, minY, killY, boosts, seesaws, crates, friction: level.grip };
  track.checkpoints = [startX + 3, ...checkpoints].map((cx) => spawnAtX(track, cx));
  return track;
}

// First place along the course whose segment spans x (ignores downhill-facing
// undersides of loops because we take the first match in course order).
export function spawnAtX(track, x) {
  for (const seg of track.segments) {
    const lo = Math.min(seg.ax, seg.bx), hi = Math.max(seg.ax, seg.bx);
    if (seg.bx > seg.ax && x >= lo && x <= hi) {
      const t = (x - seg.ax) / (seg.bx - seg.ax);
      return {
        x, y: seg.ay + (seg.by - seg.ay) * t,
        angle: Math.atan2(seg.by - seg.ay, seg.bx - seg.ax),
        s: seg.s0 + seg.len * t,
      };
    }
  }
  const s0 = track.segments[0];
  return { x: s0.ax, y: s0.ay, angle: 0, s: 0 };
}

// Index of the first segment with s1 >= s (binary search).
export function segmentIndexAt(track, s) {
  const segs = track.segments;
  let lo = 0, hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid].s1 < s) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
