# Wheelie Wahala: roadmap to a game people play every day

Status: **all six phases are live** (Phase 6: share cards, race-my-ghost links, live riders and live
races in start.ng's room). **Phases 1–5** (Phase 5: 56% smaller download, offline play, auto quality, controllers,
accessibility; translations not done yet). **Phases 1–4** (Phase 4: the Garage, with 5 bikes within 2% of each other's pace,
8 paints, 7 trails). Phases 1–3: Flip Fever, Come Back Tomorrow, and Lagos & Ice (30 levels, boost pads,
see-saws, crates, level editor). Moving lifts were left out: the autopilot can't time them, so their
levels couldn't be proven beatable. Live today: 3 desert levels, flips, loops, start.ng rider, leaderboard,
settings. About 1–2 minutes of content.

## 1. Where we are, honestly

| Area | Today | What a top mobile game has |
| --- | --- | --- |
| Content | 3 levels, ~70 s to clear all | 30–100+ levels, an endless mode, something new every day |
| Reason to come back | none after level 3 | daily challenge, streaks, missions, unlocks |
| Flips | counted, but shown in small text | the core skill: big counter, combos, named tricks, goals |
| Feel ("juice") | solid physics, plain feedback | slow-mo on big tricks, shake, particles, punchy sound, instant restart |
| Progression | stars only | bikes, cosmetics, milestones |
| Competition | one board: stars → flips → time | daily board, beat-a-friend ghosts, sharing |
| Reach | 3 MB download, desktop/phone | loads in seconds on cheap Android on 3G |

The physics and the start.ng integration are a strong base. What's missing is **depth (more to do)**
and **loops (reasons to do it again)**.

## 2. Design pillars

1. **"One more try."** Restart in under 0.3 s, no menus between attempts, always show how close
   you were ("0.4 s off ★★★").
2. **Flips are the heart.** Easy to do one, hard to chain five and land clean.
3. **Always a next goal.** Every screen points at the next star, mission, unlock or rank.
4. **Fresh every day.** A daily course everyone plays, and a streak to keep.
5. **Your character, everywhere.** The start.ng rider stays the star; cosmetics go on the bike and
   trails, never over the character.

Not doing: pay-to-win, energy/lives timers, ads, loot boxes. This should be compulsive because it's
fun and fair, not because it nags.

## 3. Your idea: the flip system

Flips become the main score, not just a time bonus.

### 3.1 Counting and showing flips

- **Big live flip counter** in the HUD: `FLIPS 12`, which pops on every flip.
- **In-air counter**: while you spin, a ring fills around the bike and the number climbs
  `1… 2… 3…`, so you know when to stop spinning and land.
- **Named tricks**: Backflip, Frontflip, Double, Triple, "Wahala!" (4+). Shown big, with a sound
  that rises in pitch.
- **Lifetime flips** on the menu ("You've flipped 1,284 times") and on the results screen.
  Milestones at 100 / 500 / 1,000 / 5,000 / 10,000 with a celebration and an unlock.

### 3.2 Combos (what makes it addictive)

- **Combo chain**: land a flip clean, then flip again on the **next jump within 4.5 s** → the chain
  continues and the multiplier grows ×1 → ×2 → ×3 … A crash or a slow gap breaks it.
- **Perfect landing**: both wheels down with the bike parallel to the track (within ±12°) →
  "PERFECT" and +50% for that trick. Sloppy landings still count, but get no bonus.
- **Air time** and **wheelie distance** add small points between flips, so the chain has a rhythm.
- **Flip score** = Σ (flips in jump × combo multiplier × landing bonus). Shown live.

### 3.3 Flips in the goals

Each level gets **3 stars from 3 different goals** (like Trials or Bike Race):

| ★ | Goal |
| --- | --- |
| 1 | Finish |
| 2 | Beat the target time |
| 3 | Reach the flip target (e.g. "8 flips" or "a ×4 combo") |

Players who are good at speed and players who are good at tricks both have something to master,
and going back for the third star is the replay loop.

### 3.4 Flips on the leaderboard

start.ng gives **one board per game**, keeps each player's **best run**, ranks on the **first** of up to
5 stats, and only accepts whole numbers. Proposed columns:

| Order | Stat | Why |
| --- | --- | --- |
| 1 | `stars` Stars | Rewards finishing the whole game |
| 2 | `flip_score` Best flip score | Your best single-level trick run: the bragging number |
| 3 | `flips` Lifetime flips | Shows who plays the most |
| 4 | `time` Total time | Tie-break |

Alternative: put **flip score first** so the board is purely about tricks (more exciting, but less
reason to finish every level). **Your call** (section 9).

## 4. More to play

- **3 worlds × 10 levels = 30 levels** to start: Desert (have), **Lagos City** (Third Mainland
  Bridge, yellow danfo buses as obstacles, rooftops), **Ice** (slippery grip, icy loops).
  Later: Volcano, Night Neon.
- **New track pieces**: moving platforms, see-saws, boost pads, wall rides, breakable crates,
  rope bridges, tunnels.
- **Level editor (for us)**: a page to drag pieces and test instantly, so a level takes 20 minutes,
  not 2 hours. Also lets the community make levels later.
- **Endless "Flip Frenzy" mode**: a course generated from a seed, a 60 s timer, and score = flip
  score. Each clean ×3+ combo adds +3 s. Perfect for short sessions.

## 5. Reasons to come back

- **Daily Challenge**: one generated course per day, the **same for everyone** (seeded by the date,
  so no server is needed). A best time and flip score per day. A 🔥 **streak counter** for days
  played in a row.
- **Missions**: 3 at a time, for example "Do 5 frontflips", "Finish Canyon Loops without crashing",
  "Land a ×3 combo". Complete one and a new one appears. Rewards: coins.
- **Ghost racing**: your best run plays as a see-through bike. Later, "race a friend's ghost"
  through a share link.
- **Near-miss feedback**: "Only 0.4 s off ★★★" and "1 flip short", with a big Retry button.

## 6. Progression (fair)

- **Coins** from finishing, flips, missions and daily play. Nothing to buy with real money.
- **Bikes** (5 to start), each with a different feel rather than a straight upgrade: Dirt (balanced),
  Trials (grippy, slow), Sport (fast, heavy), Stunt (light, spins fast, twitchy), Chopper (just
  fun). Unlocked with stars and flip milestones.
- **Cosmetics**: bike paint, wheel colours, trail effects (sparks, confetti, Naija flag colours),
  flip sound packs. Your start.ng character always stays as is.
- **Leaderboard fairness**: every bike is about equally fast on a skilled run, so unlocks never
  decide rank.

## 7. Feel and polish ("juice")

- Slow motion (0.3 s) on a ×3+ combo or a 3+ flip, camera punch-in, screen flash on PERFECT.
- Landing dust, sparks when scraping, wheel trails, confetti at the finish.
- Camera shake scaled to the impact; phone vibration on landings and crashes (`navigator.vibrate`).
- Rider ragdoll-lite on crashes (it flies, bounces, lands), with a funny "OUCH" each time.
- Music that builds: drums come in during combos, filtered on pause.
- Instant restart: hold R or tap ⟲ for a checkpoint, double-tap to restart the level.
- Countdown "3 · 2 · 1 · GO!" and a finish-line slow-mo.

## 8. Built for millions

- **Fast load**: the download is ~3 MB today (three.js is 2.1 MB unminified). Minify the
  vendored files (about −65%), lazy-load worlds 2 and 3, aim for **under 1.2 MB before first play**.
- **Low-end phones**: detect the frame rate and drop quality automatically. Use instanced scenery,
  merged geometry, shadows only on High.
- **Works offline after the first visit** (service worker, if start.ng serves it from the game's address).
- **Controls**: gamepad support, remappable keys, left-handed touch layout, bigger buttons option.
- **Accessibility**: reduced-motion mode (no shake or slow-mo), colour-blind-safe stars, captions
  for sound cues.
- **Languages**: English first; Yoruba, Hausa, Igbo and Pidgin text packs are easy wins for the
  start.ng audience.
- **Cheating**: scores come from the browser, so they can be faked. Keep stats within realistic
  limits (for example flips per level ≤ jumps × 6) and use the owner's remove-score endpoint.
- **Knowing if it's working**: start.ng gives us no analytics. Plan: playtest sessions (watch 5
  people play for 10 minutes, see where they quit and where they hit retry), and simple local
  counters shown in a hidden debug panel.

## 9. Phased plan

| Phase | Focus | Contents | Size |
| --- | --- | --- | --- |
| **1. Flip Fever** | the core loop | Big flip counter and in-air ring, combos, PERFECT landings, flip score, 3-goal stars, lifetime flips and milestones, leaderboard columns updated, juice pass (slow-mo, particles, shake, vibration), instant restart, near-miss messages | 1–2 days |
| **2. Come Back Tomorrow** | retention | Daily Challenge with streak, missions and coins, ghost of your best run, Flip Frenzy endless mode | 2–3 days |
| **3. Lagos & Ice** | content | Level editor, 27 more levels across 3 worlds, new track pieces | 3–5 days |
| **4. Garage** | progression | 5 bikes, cosmetics, trails, sound packs | 2 days |
| **5. Reach** | scale | Minified and lazy-loaded build, auto quality, offline, gamepad, accessibility, languages | 2 days |
| **6. Together** | social | Share card (image of your run), friend ghost links, live races in start.ng multiplayer rooms | 3+ days |

Every phase ships live on its own (push → live in a minute), so players see improvements every few days.

## 10. Decisions for you

1. **Leaderboard first column**: Stars (finish everything) or Flip score (tricks first)?
2. **3rd star = flip goal?** (recommended) Or keep time-only stars?
3. **Do bikes change the physics**, or are they cosmetic only? (Recommended: different feel, equal
   pace.)
4. **City world**: Lagos (recommended for the start.ng audience) or something else?
5. **Start with Phase 1 now?**
