# Wheelie Wahala

A 3D stunt-bike racer for [start.ng](https://start.ng), built with three.js. Ride across the desert, flip
off the ramps and hold the throttle through the loops, as **your own start.ng character**.

Play it at **https://wheelie-wahala.start.ng**.

## How to play

| | Keyboard | Phone |
| --- | --- | --- |
| Ride | ↑ / W | GO |
| Brake / reverse | ↓ / S | BRAKE |
| Lean back (backflip) | ← / A | ◀ |
| Lean forward (frontflip) | → / D | ▶ |
| Back to checkpoint | R | ⟲ |
| Restart the level | T | ⟲ twice |
| Pause | Esc / P | ⏸ |

**Flips are the heart of it.** A ring round the bike fills as you spin, and every landed flip counts.
Chain flips jump after jump (within 4.5 s) for a combo multiplier up to ×8. Land level with the
track for a **PERFECT** (+50%). Crash before you've ridden away from a landing and the trick is lost.

Each level has **three stars, one per goal**: finish, beat the target time, and land the flip target in
one run. Crash by landing on your head and you go back to the last checkpoint, along with your flip
count from when you got there. Every flip you ever land adds to your **lifetime flips**, with
milestones at 25, 100, 250, 500 and up.

## Difficulty

Pick it in ⚙️ Settings, or tap the difficulty button on the menu to step through them. It applies
from your next ride. The goals (target time, flip goal) are the same on every difficulty; what changes
is how forgiving the bike is:

| | Landings | Checkpoints | Flip score | Coins |
| --- | --- | --- | --- | --- |
| 🙂 **Easy** (beginner friendly) | any landing on your wheels is safe, and the bike levels itself in the air and won't wheelie over | all | ×0.5 | ×1 |
| 😎 **Normal** | land within 50° of the track or you crash | all | ×1 | ×1 |
| 😤 **Hard** | within 40° | every other one | ×1.5 | ×1.5 |
| 😈 **Extreme** | within 30° | none: crash once and the run starts again | ×2 | ×2 |

A crash from a bad landing says **BAD LANDING!** The results show the difficulty you rode, and a level
you've finished on Hard or Extreme gets a 😤 / 😈 badge. Flip scores on the leaderboard include the
multiplier, so harder rides score more.

## Modes

- **Three worlds, 30 levels**: Desert Canyon, Lagos City (opens at 12 ★: the Third Mainland Bridge,
  danfos, boost lanes) and Ice Peaks (opens at 30 ★: less grip, so climbs and landings are slippery).
  Three stars per level.
- **Track pieces**: kickers, drops, loops, **boost pads** (fire you forward), **see-saws** (tip as you
  ride over; hit one fast and it throws you) and **crates** to smash for points.
- **The levels get hard.** The first three of each world teach; from level 4 they add **ledges to jump
  up onto**, **steep walls** (lean forward or flip over backwards), **staircases** of drop-offs,
  **platforms over pits**, long **canyon jumps** onto flat ground, **mega kickers** with room for a
  double or triple, and rough **whoops**. Target times are the autopilot's time plus 8%, and the flip
  goal is about 85% of the flips there's air for.
- **Daily Challenge**: a new course every day (UTC) in one of the three worlds, the same for everyone. It's generated from the
  date and checked by an autopilot before you see it. Finish it on consecutive days to build a 🔥 streak.
- **Flip Frenzy**: 60 seconds on a long generated course full of kickers. Score as many flip
  points as you can; every trick landed at ×3 combo or higher adds 3 seconds.
- **Ghost**: your fastest run on each level (and today's daily) rides along as a cyan see-through bike
  tagged "👻 Your best". The gap under the timer shows how far ahead (green) or behind (red) you are,
  an arrow at the screen edge shows where it is when it's off screen, a one-time coach mark points it
  out, and the results say whether you beat it. Toggle it on the pause screen or in Settings.
- **Coins and missions**: three missions at a time ("Land 10 flips", "Reach a ×3 combo"…). Coins come
  from runs, missions, daily streaks and lifetime-flip milestones.
- **Garage**: a spotlit 3D showroom. Buy and equip five bikes (Dirt, Trials, Sport, Stunt, Chopper),
  eight paints and seven trails (Smoke, Sparks, Confetti, Green-White-Green, Fire, Rainbow). Bikes feel
  different (grip, spin speed, weight, wheelbase) but are tuned to the same pace:
  `node tools/bike-check.mjs` rides all 30 levels on each bike and compares total times.

## Play with friends

- **Share**: the results screen makes a picture of your finish (course, time, flips, stars) and shares
  it with the phone's share sheet. On computers it saves the picture and copies a link.
- **Race my ghost**: the 📤 Share link carries your whole run (a few hundred characters after
  `#race=<course>~`, so it never reaches a server, and it holds no sign-in details). **𝕏 Post** links
  to the game only, so posts stay short. A friend who opens it races a see-through copy of you, in your start.ng look and your bike,
  and sees who won.
- **Live riders and races** (signed-in players, through start.ng's live room for this game): other
  riders on the same course appear as see-through bikes with name tags. **🏁 Live race** → pick a
  course, and you get a lobby with an **invite link** (📤 Share, WhatsApp or 📋 Copy). Send it to one
  friend or a whole group: opening it drops them straight into your lobby (guests sign in on start.ng
  first and come back to it). Players already in the game get a Join pop-up too. You press
  **▶ Start race** when everyone's in; all of you get the 3-2-1 together and the results list
  everyone's time. The room only carries x/z positions within ±60 m, so `src/live.js` packs the
  course position, height and course into those numbers. The lobby, joins, the start and finish
  times travel as short room chat messages (the host re-announces the lobby every 4 s, so people
  arriving from the link find it).
  Test locally with `tools/live-mock.py` and `?live=ws://localhost:8770&as=Name` in two tabs.

## Reach

- **Fast loading**: the bundled build above, and the Garage and the Daily/Frenzy course tools load
  only when first used.
- **Plays offline** after the first visit (service worker). Updates arrive on the next reload.
- **Full screen on phones**: the ⛶ button (menu corner, pause screen), and by default the game goes
  full screen and locks to landscape when a ride starts (Settings → "Full screen when you ride").
  iPhones don't allow full screen for web pages, so iPhone players get a one-time tip to
  **Add to Home Screen**. `manifest.json` then opens the game as an app with no browser bars (Android
  can install it too). On short landscape screens the results card switches to two columns.
- **Auto quality** (default): High on computers, Medium on phones, and it steps down if the frame
  rate stays under 40.
- **Controllers**: A / right trigger ride, B / left trigger brake, stick or D-pad lean, Start pause,
  Y checkpoint, Back restart.
- **Accessibility** (Settings): reduce motion, left-handed touch buttons, bigger touch buttons, and
  screen-reader announcements for tricks, crashes and checkpoints.

## Settings

⚙️ on the menu or pause screen:

- **Rider name**: shown in a tag above your rider (leave it empty to use your start.ng character's name).
- **Sound**: separate master, music, effects and engine volumes. 🔊 on the menu mutes everything.
- **Quality**: High (sharp, soft shadows), Medium, or Low (no shadows) for slower phones.
- **Touch buttons**: Auto, On or Off.
- **Reset progress** for this device.

The music is a quiet generated loop, turned down while you ride.

## start.ng

- **Your character rides the bike.** The rider is built in 3D from your start.ng `style`: body, top and
  trouser colours, skin, hair (short, afro, braids, bun, ponytail, dreads, bald), hat (cap, beanie, top
  hat, crown) and accessory (glasses, earrings, beard, scarf, backpack). Change your look on start.ng
  and come back to the tab, and the rider updates.
- Guests ride as start.ng's guest look, with a sign-in button.
- **Leaderboard** (`startng.json`): total stars, then best flip score, then lifetime flips, then total
  best time.

## How it's built

- Static files only: no build step. `index.html` loads ES modules from `src/`.
- **three.js** (r186, in `vendor/`) draws everything: toon-shaded low-poly bike, rider, tracks and
  scenery, with a perspective side-on camera so the desert layers move with parallax.
- **Planck.js** (Box2D, in `vendor/`) runs the 2D physics: a chassis on two sprung wheels with a rear
  motor. The bike only touches track near its own progress along the course, which is what lets
  loops cross over themselves.
- Levels are short lists of pieces (`flat`, `ramp`, `loop`, `gap`, ...) in `src/levels.js`, turned into
  track by `src/track.js`.
- Sound is generated with WebAudio, so there are no audio files.

## Building (do this before every push)

The page loads a bundled, minified build from `build/`, not `src/` directly:

```bash
npm install
npm run build
```

`npm run build` (esbuild) bundles `src/` with three.js and Planck into 6 files (about 180 KB
compressed, down from 24 files and 407 KB), with hashed file names. It also points `index.html` at the
new files and writes `sw.js`, the service worker that keeps the game playable offline. Commit `build/`,
`index.html` and `sw.js` together. start.ng never runs npm.

For development, add `?src` to the address to run the unbundled source. The service worker only runs
on start.ng, or locally with `?sw`.

## Run it locally

```bash
python -m http.server 8765
```

Then open http://localhost:8765. Sign-in and scores only work on `wheelie-wahala.start.ng`.
Locally the game plays with a default rider.

**Level editor**: open `editor/` (or ⚙️ Settings → Level editor). Add pieces, see the course, run
the autopilot check (it marks crash spots) and test ride it in the game. "Copy as code" gives the
level as JSON.

`node tools/level-check.mjs` rides all 30 levels with the autopilot and suggests target times and flip
goals. Add `--diff=hard` (or `easy`, `extreme`) to ride with that difficulty's landing rules and
checkpoints, and `--raw` for a beginner who never leans (try `--diff=easy --raw`). Every level rides
cleanly on all four difficulties. `node tools/bike-check.mjs --why` lists where each bike crashes. `node tools/gen-check.mjs 40` rides 40 generated Daily and Frenzy courses with the autopilot and lists
any it can't finish cleanly.

`node tools/sim.mjs desert-2` rides a level headlessly with a scripted rider (add `--raw` for a rider
who never leans, or `--flip` to try flips) and prints crashes, jumps and the finish time.
Use it to check a level after changing it.

Reference art direction came from the Bike Race (Wildlife Studios) gameplay trailer. All art, code
and sound here are original.
