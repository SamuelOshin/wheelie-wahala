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

## Modes

- **Levels**: three hand-made desert courses, three stars each.
- **Daily Challenge**: a new course every day (UTC), the same for everyone. It's generated from the
  date and checked by an autopilot before you see it. Finish it on consecutive days to build a 🔥 streak.
- **Flip Frenzy**: 60 seconds on a long generated course full of kickers. Score as many flip
  points as you can; every trick landed at ×3 combo or higher adds 3 seconds.
- **Ghost**: your fastest run on each level (and today's daily) rides along as a see-through bike.
- **Coins and missions**: three missions at a time ("Land 10 flips", "Reach a ×3 combo"…). Coins come
  from runs, missions, daily streaks and lifetime-flip milestones (the Garage to spend them is next).

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

## Run it locally

```bash
python -m http.server 8765
```

Then open http://localhost:8765. Sign-in and scores only work on `wheelie-wahala.start.ng`.
Locally the game plays with a default rider.

`node tools/gen-check.mjs 40` rides 40 generated Daily and Frenzy courses with the autopilot and lists
any it can't finish cleanly.

`node tools/sim.mjs desert-2` rides a level headlessly with a scripted rider (add `--raw` for a rider
who never leans, or `--flip` to try flips) and prints crashes, jumps and the finish time.
Use it to check a level after changing it.

Reference art direction came from the Bike Race (Wildlife Studios) gameplay trailer. All art, code
and sound here are original.
