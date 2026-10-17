// Talks to start.ng through its hidden connect page (see https://start.ng/docs.md).
// Off start.ng (for example on localhost) nothing answers, and the game plays without a player.
const START_NG = 'https://start.ng';
let frame;

function connectFrame() {
  frame ??= new Promise((resolve, reject) => {
    const el = document.createElement('iframe');
    el.src = `${START_NG}/connect`;
    el.hidden = true;
    el.title = 'start.ng';
    el.onload = () => resolve(el);
    el.onerror = reject;
    document.body.append(el);
  });
  return frame;
}

// Sends a message and resolves to start.ng's reply, or null if it didn't answer.
async function askStartNg(message, replyType, timeoutMs = 5000) {
  let el;
  try {
    el = await connectFrame();
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const done = (reply) => {
      clearTimeout(timer);
      removeEventListener('message', onMessage);
      resolve(reply);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    function onMessage(e) {
      if (e.origin !== START_NG || e.source !== el.contentWindow) return;
      if (e.data?.type === replyType && e.data.requestId === requestId) done(e.data);
    }
    addEventListener('message', onMessage);
    el.contentWindow.postMessage({ ...message, requestId }, START_NG);
  });
}

export const onStartNg = () => location.hostname.endsWith('.start.ng');
export const isGuestVisit = () => new URLSearchParams(location.search).has('guest');

// { user, guest } or null when start.ng isn't there.
export async function whoami() {
  if (!onStartNg()) return null;
  // The connect page can miss a message sent while it is still starting up (slow
  // connections), so ask a few times before giving up.
  let reply = null;
  for (let attempt = 0; attempt < 4 && !reply; attempt++) {
    reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user', 2500 + attempt * 1500);
  }
  if (!reply) return null;
  return { user: reply.user ?? null, guest: reply.guest ?? null };
}

export function signIn() {
  location.href = `${START_NG}/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;
}

export async function saveRun(stats) {
  if (!onStartNg()) return { ok: false, error: 'Play on start.ng to save scores' };
  const reply = await askStartNg({ type: 'startng:score', stats }, 'startng:scoreSaved', 8000);
  return reply ?? { ok: false, error: 'start.ng did not answer' };
}

export async function leaderboard(limit = 10) {
  if (!onStartNg()) return { ok: false, error: 'The leaderboard lives on start.ng', entries: [] };
  const reply = await askStartNg({ type: 'startng:leaderboard', limit }, 'startng:leaderboardData', 8000);
  return reply ?? { ok: false, error: 'start.ng did not answer', entries: [] };
}

// A one-minute ticket for the live room (signed-in players only): { ok, ticket, url } or null.
export async function liveTicket() {
  if (!onStartNg()) return null;
  return askStartNg({ type: 'startng:ticket' }, 'startng:ticketData', 8000);
}
