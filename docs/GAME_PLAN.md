# Bike Race for start.ng: game plan

Status: **draft for review**. Nothing is built yet.

## 0. Task requirements (HNG15, individual task 1)

1. **Built with three.js** and published on start.ng.
2. **Uses start.ng's signed-in players.**
3. **The player's central start.ng styling changes how their character looks** in the game.
4. **A PR in the team repo, merged**, checked at the end of the day. Time is tight, so the scope
   below is cut to what can ship today, with extras listed as stretch goals.

What this means for the design: the game stays a **side-on 2D racer to play**, but it is
**rendered in 3D with three.js** (2.5D): a perspective camera looking side-on, a low-poly 3D bike
and rider, 3D track bands, and parallax scenery at different depths. The rider is a **3D model put
together from the start.ng `style`** (body, colours, hair, hat, accessory), which shows requirement 3
clearly.

## 1. What the reference video shows

Source: the official Bike Race (Wildlife Studios) 29-second ad, https://youtu.be/TJmt9cBjDLc.
I reviewed it at 4 frames a second (`reference/sheets/`). Gameplay runs 0:00–13:00, then the
result screen, the upgrade screen, and from 19:75 the "Play Now Free" end card.

| Time | What happens | What it tells us |
| --- | --- | --- |
| 0:00–0:75 | The rider launches off a curved wooden ramp and does a **backflip** in the air | Flips are the main skill, and the camera follows the bike smoothly |
| 1:00–4:25 | A **desert canyon track** of concentric half-pipes, loops and spirals. The bike rides **upside down around loops** and goes up near-vertical walls | Physics has to let the wheels stay on the track through loops when the bike is fast enough. Track pieces are thick wooden bands with a lighter edge |
| 4:50–7:50 | The **thin red line track**: a single 2px line with flat sections, 45° drops and U-shaped valleys. The rider does several flips | A second, cheap track style: a plain polyline on top of the scenery. Very easy to author |
| 7:75–9:25 | **City world**: a blue New York skyline, Statue of Liberty, fireworks, still on a thin red line | Worlds differ mainly in background art and colour, not in mechanics |
| 9:50–10:75 | **Ice world**: blue icy loops and spirals over snowy mountains | A third theme with the same mechanics |
| 11:00–12:75 | Desert on **solid ground** with small bumps and jumps | A third track style: filled terrain, good for easy levels |
| 13:00–14:50 | A **checkered finish flag**, the banner "STAGE CLEAR!" and a "LEVEL UP!" card filling **3 stars** one by one | Each level ends with a 1–3 star rating |
| 14:75–19:50 | **Garage**: a bike on a turntable, an **UPGRADE** button, "+SPEED" and "+POWER" | Progress means better bikes or upgrades |

The in-game HUD is minimal: a **restart** button top left and **pause** top right. The ad shows no
timer or speedometer during play. The camera is side-on 2D, zoomed so the bike is about 1/12 of the
screen height, and the bike sits slightly left of centre so you can see what's ahead.

How it feels: arcade physics, not a simulation. The bike is light, flips quickly when you lean in
the air, and stays on loops when you're going fast. Crashes come from landing on your head.

## 2. Our game: the concept

**"Bike Race"-style 2D trials racer for the browser**, built for start.ng.

- Ride a motorbike from start to finish across hand-made side-on tracks.
- Lean back and forward to balance, do flips in the air, and land on your wheels.
- Finish fast for **3 stars**. Flips knock time off your run.
- **The rider is your start.ng character** (the character rule): jacket = `primaryColor`,
  trousers = `secondaryColor`, skin, hair poking out under the helmet, and the `hat` drawn on or
  replacing the helmet (crown on top of the helmet, and so on), plus accessories (scarf trailing,
  backpack).
- We draw all our own art. **No Bike Race assets, names or logos.** We need our own title
  (ideas below), because "Bike Race" is Wildlife's trademark.

Title ideas (the subdomain becomes `<name>.start.ng`): **Flip Rider**, **Canyon Flip**,
**Loop Rider**, **Wheelie Wahala**, **Lagos Loops**.

## 3. Core mechanics

### Controls

| Action | Keyboard | Touch (phone) |
| --- | --- | --- |
| Throttle | ↑ / W | Right-side button "GO" |
| Brake / reverse | ↓ / S | Right-side button "BRAKE" |
| Lean back (wheelie, backflip) | ← / A | Left-side button ◀ |
| Lean forward (nose down, frontflip) | → / D | Left-side button ▶ |
| Restart from checkpoint | R | Restart icon top left |
| Pause | Esc / P | Pause icon top right |

Phones are a priority: start.ng players are probably mostly on phones. We use landscape and show a
"rotate your phone" hint in portrait.

### Physics (the heart of the game)

- Use **Planck.js** (a JavaScript port of Box2D, about 200 KB, MIT licence) and **copy it into the
  repo** under `vendor/`, so there's no build step and no `external_script` warning.
- The bike is a chassis body plus two wheel bodies joined by **wheel joints with springs**
  (suspension). The rear wheel has a motor (throttle). The rider is a sensor shape for the head
  and torso.
- **Leaning** applies torque to the chassis: weak on the ground, strong in the air, so flips are
  quick (about 0.6–0.8 s per rotation in the video).
- **Loops**: gravity is normal. The bike stays on because of speed and friction, as in the video.
  We tune the loop radius and speed so a full throttle run gets round; going in slowly makes you fall.
- **Crash**: the head sensor touches the track → ragdoll-light (the rider pops off, the bike
  tumbles) → after 1 s, respawn at the last checkpoint. Crashes add no penalty except lost time.
- **Flip detection**: add up the chassis angle while both wheels are off the ground. Each full
  ±360° that ends in a clean landing = 1 flip → floating "+FLIP" text and **−1 s** off the time.
- A fixed 60 Hz physics step with interpolation, so it plays the same on 60/120/144 Hz screens.

### Tracks

Three track styles, all seen in the video, all drawn from the same data:

1. **Line** (thin red line, 4:50–9:25): a polyline, drawn as a 3px stroke. Cheapest to author.
2. **Band** (thick wooden/ice bands, loops and spirals): a polyline drawn as a thick stroke with an
   outline. The physics uses a chain shape along it.
3. **Ground** (filled terrain, 11:00–12:75): a polyline filled down to the bottom of the screen.

Levels are **JSON**: a list of segments (`line`, `arc` for loops, `bezier` for curves), turned into
points when the level loads, plus checkpoints, the finish x position, star times and the theme.
Loops are arcs, so a loop is one entry rather than hundreds of points.

A loop needs the bike to move from the entry to the exit side of the track. Approach: an
overlapping arc whose entry and exit are offset sideways (like the spirals in the video), so
the bike never crosses its own track.

### Levels and progress

- **3 worlds** like the video: **Desert** (warm sunset, rock pillars), **City** (blue skyline,
  fireworks; we could make it **Lagos**, with the Third Mainland Bridge and the National Theatre,
  for a local touch), **Ice** (snowy peaks, blue icy bands).
- **MVP: 9 levels** (3 per world), rising in difficulty: ground → line → bands and loops.
- **Stars**: finish = 1★, under the silver time = 2★, under the gold time = 3★. Shown on a
  "STAGE CLEAR!" card with the stars popping in one by one (13:00–14:50).
- Stars unlock the next world (for example 6★ for City, 15★ for Ice).
- **Garage (after the MVP)**: spend stars to unlock 3 bikes with different speed and power, which
  is our version of the +SPEED/+POWER screen. Saved in `localStorage` (personal progress is fine
  there according to the start.ng docs).

### Camera

- Smooth follow with a look-ahead in the direction of travel. The bike sits about 35% from the left.
- Zoom out a little at high speed and in the air (so you can see the landing), then back in when
  you land.

## 4. start.ng integration (from `docs/startng-docs.md`)

| Requirement | How we meet it |
| --- | --- |
| Static, no build step | Plain HTML + ES modules + Canvas 2D. `index.html` at the top of the repo |
| Relative paths only | `./src/main.js`, `assets/...` |
| Who's playing | The hidden `https://start.ng/connect` iframe helper, `startng:whoami`, checking `e.origin`. Ask again on `focus` / `visibilitychange` |
| Character rule | The rider is drawn from `style` (body, colours, hair, hat, accessory). Unknown values fall back to defaults |
| Guests | Use the `guest` style and name. A "Sign in to save your times" button → `start.ng/?return_to=...`. With `?guest` in the address, skip our own sign-in prompt |
| Plays offline/locally | Without start.ng (opened locally), use a built-in default rider and skip saving scores |
| Leaderboard | `startng.json`, below. Save the run on level complete via `startng:score` (signed-in players only) |
| Cover | `cover.png` 1600×1000, rendered from the game itself, with the title on it |
| No secrets, no password fields | Nothing to hide; there are no forms |
| Publish | Public GitHub repo → `POST /games/check` → fix → `POST /games/publish` → you open the `approve_url` |

### Leaderboard design

start.ng keeps **one best run per player per game**, ranked by the first stat. A per-level
leaderboard isn't possible, so we rank on overall progress:

```json
{
  "leaderboard": {
    "stats": [
      { "key": "stars", "label": "Stars", "order": "highest" },
      { "key": "flips", "label": "Total flips", "order": "highest" },
      { "key": "time", "label": "Total time", "order": "lowest", "format": "time" }
    ]
  }
}
```

After each level we send the player's **career totals**: stars across all levels, best flips, and the
sum of their best times on the levels they've finished. start.ng only keeps a run when it's their
best, so this works naturally.

## 5. Technical architecture

```
bike_game/
├── index.html          # three.js canvas, HTML HUD overlay, touch buttons, import map
├── cover.png
├── startng.json
├── src/
│   ├── main.js         # boot, game loop (fixed step), screen state machine
│   ├── physics.js      # Planck world, bike + rider bodies, flip/crash detection
│   ├── track.js        # level JSON → points → Planck chain + render paths
│   ├── render.js       # camera, parallax backgrounds, track, bike, rider
│   ├── rider.js        # draws the start.ng character on the bike
│   ├── input.js        # keyboard + touch
│   ├── ui.js           # menus, level select, stage clear, pause
│   ├── audio.js        # WebAudio engine sound (pitch = wheel speed), SFX
│   ├── startng.js      # connect iframe, whoami, score, leaderboard
│   └── storage.js      # localStorage progress
├── levels/             # desert-1.json ... ice-3.json
├── vendor/planck.min.js
├── vendor/three.module.min.js
└── assets/             # backgrounds (SVG/PNG), sounds
```

- **Rendering: three.js** (copied into `vendor/three.module.min.js`, loaded through an import map,
  so there's no build step). A perspective camera, side-on, follows the bike.
  - **Track**: each polyline is extruded into a 3D band (a box strip about 1.5 m deep) with a
    toon material. Line tracks are thin red bands, wood and ice tracks are thick bands with an
    edge colour, and ground tracks are a filled extruded shape.
  - **Scenery**: low-poly rock pillars, buildings and mountains placed at z = −20…−200, so the
    parallax comes free from the perspective camera. A gradient sky dome and fog for depth.
  - **Bike**: low-poly primitives (torus wheels, box/cylinder frame), red as in the video.
  - **Rider** (`rider.js`): built from boxes, capsules and spheres. Jacket = `primaryColor`,
    trousers = `secondaryColor`, skin on the hands and neck, `hair` meshes (afro sphere, braids,
    bun, ponytail, dreads, short, bald) under or behind the helmet, `hat` (cap, beanie, tophat,
    crown) on top of the helmet, and `accessory` meshes (glasses on the visor, earrings, beard,
    scarf, backpack). `body` changes the proportions a little. Unknown values → defaults.
    It updates live when the player comes back to the tab with a new style.
  - `MeshToonMaterial` and outlines (inverted-hull) for the cartoon look of the video.
- **Physics stays 2D** (Planck.js, in the x/y plane). three.js only draws the result, which keeps
  the gameplay tight and predictable.
- **Audio**: an engine hum made with an oscillator (the pitch follows wheel speed), plus landing,
  flip, crash and finish sounds. We can make these in WebAudio, so there are no audio files to
  license.
- **Level editor (dev only, optional)**: a page at `tools/editor/` to place segments with the mouse.
  This is worth it if we want more than about 10 levels.

## 6. Build milestones

### Today (the deadline): a playable, published MVP

1. three.js scene + Planck bike on a test track, keyboard + touch controls, tuned feel.
2. The level format, **3 levels** (desert ground, desert line with flips, desert loops), finish,
   crash/respawn, timer, flips, stars, level select, progress saved.
3. The start.ng rider built from `style`, whoami, the guest look and sign-in button, `startng.json`, saving scores, a
   leaderboard screen.
4. Desert scenery, basic sounds, `cover.png`.
5. Push → PR into the team repo → merge → `games/check` → `games/publish` → you approve.

### Stretch (after it's live; every push updates the game automatically)

City and Ice worlds (6 more levels), garage/bikes, particles, ghost of your best run.

### Full milestone list

1. **Physics prototype**: a bike on a flat line with the 4 controls. Tune the feel (flip speed,
   suspension, loop grip). *This is where most of the time goes. Getting the feel right matters most.*
2. **Tracks**: the level JSON format with line/arc/bezier segments, the 3 render styles,
   checkpoints, finish flag.
3. **Game loop**: crash/respawn, timer, flip detection and bonus, stage clear with stars,
   level select, saved progress.
4. **Art**: 3 parallax themes, the bike, the start.ng rider drawn from `style`.
5. **start.ng**: whoami, guest handling, sign-in, `startng.json`, saving scores, a leaderboard screen.
6. **Content**: 9 levels with tuned star times.
7. **Polish**: audio, particles (dust, sparks on crash, fireworks in the City world), touch
   controls, a portrait hint, a pause menu.
8. **Ship**: `cover.png`, GitHub repo, `games/check`, `games/publish`, approve.
9. *(After the MVP)* garage/bikes, more levels, a ghost of your best run.

## 7. Decisions

**Settled:**
- Name: **Wheelie Wahala**, at `wheelie-wahala.start.ng`.
- Repo: a **new public repo on your own GitHub account**, just for this game.
- Today's MVP is the Desert world only. City (New York or Lagos) and the garage are stretch goals.

**Originally open (kept for reference):**

1. **Game name / subdomain** (section 2).
2. **City world**: New York as in the video, or **Lagos**?
3. **Garage/upgrades in the MVP**, or after it?
4. **GitHub / team repo**: what is the team repo, and does the game live in its own folder there or
   is it its own repo? start.ng needs a **public** repo with `index.html` at the top or in
   `dist/`, `build/`, `docs/` or `out/`, and publishes one game per repo. (You open the approve
   link yourself.)
