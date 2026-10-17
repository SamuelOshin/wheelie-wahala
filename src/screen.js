// Full screen on phones, so the browser's address bar and buttons don't eat the game.
//  - Android and most browsers: the Fullscreen API (only allowed right after a tap), then lock to
//    landscape, which browsers allow only in full screen.
//  - iPhone Safari has no full screen for web pages: "Add to Home Screen" opens the game as an app
//    with no browser bars (see manifest.json), so iPhone players get a tip instead.

const root = document.documentElement;

export const isStandalone = () =>
  matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;

export const isIOS = () =>
  /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const canFullscreen = () => !isStandalone() && !!(root.requestFullscreen || root.webkitRequestFullscreen);

export const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

export async function enterFullscreen() {
  if (!canFullscreen() || isFullscreen()) return false;
  try {
    if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
    else root.webkitRequestFullscreen();
  } catch {
    return false; // not right after a tap, or the browser said no
  }
  try { await screen.orientation?.lock?.('landscape'); } catch {}
  return true;
}

export async function exitFullscreen() {
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else document.webkitExitFullscreen?.();
  } catch {}
}

export function toggleFullscreen() {
  return isFullscreen() ? exitFullscreen() : enterFullscreen();
}

export function onFullscreenChange(fn) {
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
}
