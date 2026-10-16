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
| Pause | Esc / P | ⏸ |

Every clean flip takes 1 second off your time. Finish under the target times for 2 or 3 stars. Crash by
landing on your head, and you go back to the last checkpoint.

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
- **Leaderboard** (`startng.json`): total stars, then total flips, then total best time.

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

`node tools/sim.mjs desert-2` rides a level headlessly with a scripted rider (add `--raw` for a rider
who never leans, or `--flip` to try flips) and prints crashes, jumps and the finish time.
Use it to check a level after changing it.

Reference art direction came from the Bike Race (Wildlife Studios) gameplay trailer. All art, code
and sound here are original.
