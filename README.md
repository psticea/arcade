# ARCADE

Five arcade cabinets in one page. **Arrow keys and space. Nothing else** — from
the cabinet select all the way through to entering your initials on the high
score table.

The constraint is the point. With the input fixed, the games cannot differentiate
on hardware, so they differentiate on *meaning*: what the arrows do, and what
SPACE does, is different in every cabinet.

| Cabinet | Arrows mean | SPACE | Ancestry |
| --- | --- | --- | --- |
| **COIL** | Move, in fixed world directions | PHASE through your own tail | Snake |
| **DESCENT** | Rotate · thrust · survey | HARD BURN | Lunar Lander |
| **LUMEN** | Crawl the rim · dive · gather | BLOOM | Tempest |
| **GLASSWORKS** | Flippers · raise/drop a diverter | Plunger, then NUDGE | Pinball |
| **BALLAST** | *(unused — this one needs no arrows)* | FLIP gravity | Gravity-flip descent |

**Nothing in this arcade is violent.** There are no enemies, no weapons and
nothing is destroyed. Tension comes from pressure, scarcity and precision —
the same place Super Hexagon, Qix and pinball get it.

## The games

### COIL — *the arena turns, your hands do not*
A snake on a grid. Every five pickups the whole arena rotates 90°, but your keys
keep their old meaning, so your spatial memory is suddenly wrong. Pickups spawn
in pairs: a **safe** one out in the open (10 points, and it resets your combo)
and a **hot** one buried deep inside your own coils (50 points, +1 combo). PHASE
— half a second of passing through your own tail — recharges *only* by eating a
hot pickup, so the safety valve is earned exclusively through risk. Speed scales
with combo, not length, so success is what makes it harder.

Modes: **ENDLESS**, and **SPRINT 60** for a legible score-attack board.

### DESCENT — *no instruments*
A survey drone landing in procedurally generated caverns. The camera is locked to
the ship, so rotating swings the entire world around you. There is **no numeric
readout anywhere**: velocity is a vector line drawn from the nose, the target pad
glows green/amber/red by live approach quality, and fuel is the length of the
flame. Rotation has no damping — stopping a spin means deliberately
counter-rotating.

Three pads per cavern (×1 wide, ×3 medium, ×8 narrow, sunk in a chasm between
spires). A **perfect landing** adds +1 to a permanent run multiplier applied to
every later landing, so one good touchdown compounds for the rest of the run.
Fuel is a single budget across the whole expedition — there are no refills.

Modes: **EXPEDITION**, and **DAILY** (everyone flies the same caverns).

### LUMEN — *Tempest, inverted*
Motes of light rise out of a polar well. If they crest the rim they escape and
the tunnel dims; you catch them with BLOOM. The richest motes **sink** instead of
rising, so the only way to reach them is to dive into the well after them — the
multiplier lives where it costs the most to go.

There is no health bar: there is **light**, shown as the brightness of the whole
tunnel and a ring around the edge. Idling drains it, so there is no safe state.
Spires grow up through the well and block dives; a bloom from inside dissolves
them back into light. Shadow lanes darken a segment and stop the bloom working
entirely.

### GLASSWORKS — *a table that rebuilds itself*
Pinball with two ideas a table made of wood and glass cannot have. First, **you
edit the table while you play**: ↑ and ↓ drive a live diverter, so the ball's
route is a decision rather than a consequence. Second, completing a mission
triggers a **REBUILD** — ramps unfold, walls retract, targets relocate. Four
configurations, so the table you learned in minute one is gone by minute four.

Nudge is metered rather than instantly fatal, which makes it a real tactic. Ball
save runs for 15 seconds. Multiball unlocks at the third mission.

Physics is hand-rolled and substepped — both the ball *and* the flippers — so a
fast ball cannot tunnel through a flipper. There is a test for exactly that.

### BALLAST — *the stone is where the money is*
You sink through a drowned cathedral. Sideways gravity pulls you toward one wall;
SPACE flips which. Riding close to the masonry compounds a multiplier, and
flipping resets it — so every second the question is *bank it, or hold one more
beat*. Two flips inside 150 ms count as one, letting you nudge your line without
losing the multiplier, at the cost of a genuinely tight window.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173/arcade/
npm run build    # typecheck + production build
npm test         # 160 tests
```

Deployed to GitHub Pages from `main` (see `.github/workflows/deploy.yml`), which
is why `vite.config.ts` sets `base: '/arcade/'`.

## Touch

The arcade is keyboard-first, but it is fully playable on a phone.

On a coarse pointer the picker swaps its keyboard hints for tappable controls —
mode rows are real buttons and there is an explicit **PLAY** button, rather than
a second tap on the selected cabinet, which nobody could discover. In a game, an
on-screen pad appears: a d-pad, an action button labelled with that game's verb
(BLOOM, PLUNGE, BURN, PHASE), and a pause button. BALLAST needs only one input,
so the whole screen is its tap target.

The pad works by dispatching the same keyboard events a physical key would, so
the games, the pause handler, the menus and the initials entry need no touch
handling of their own — there is one input path, not two. Buttons hold their key
while a finger is down, so thrust, flippers and the plunger charge behave exactly
as they do on a keyboard, and a finger lifted outside a button still releases it.

Games that show a pad shrink their canvas above it, so no playfield or readout
ever sits underneath the controls.

## How it is built

```
src/
  arcade/     the shell: cabinet picker, HUD, pause, game over, initials, scores
  games/      one folder per cabinet, each exporting a GameModule
  lib/        prng · loop · input · juice · neon · audio · math · emitter
```

Each game exports a `GameModule` with `mount(canvas, options)` returning
`{ pause, resume, destroy, on }`. Games never import one another, and every game
is behind a dynamic import, so a cabinet's code only downloads when you choose to
play it — the shell itself is a few kilobytes.

**Simulation is pure and separate from rendering.** Every game's `simulation.ts`
is `step(state, input, dt, rng) → events` with no DOM and no canvas, which is what
makes the whole thing testable in Node.

Shared foundations, all decided by measurement rather than taste:

- **Fixed timestep** at 1/120 s with an accumulator and a 250 ms clamp, so a
  backgrounded tab cannot fast-forward a run.
- **Seeded randomness** everywhere (`sfc32` seeded via `splitmix32`) — no bare
  `Math.random()` in any simulation. Runs are reproducible, which is what makes
  the daily seed and the deterministic tests possible.
- **Input** reads `event.code`, suppresses auto-repeat, clears on blur, and
  prefers a key that was *just pressed* over one merely held so a quick tap is
  never dropped between two simulation steps.
- **Game feel** from one shared module: trauma-squared screen shake (decay 6/s,
  max 16 px), hitstop of 50/100/167 ms, and pooled particles.
- **Neon** is layered strokes with additive compositing. `shadowBlur` is blurred
  in software and would destroy the frame budget.
- **Audio** is entirely synthesized at runtime — there are no audio files. The
  `AudioContext` is created lazily on the first key press, so the first run has
  sound just like every later one.
- **Scores** live in `localStorage`, per game and per mode. Nothing leaves the
  device.

## Tests

160 tests, all running against the pure simulations in Node.

Beyond the usual unit coverage, several tests exist to catch the failures that
would not show up while playing the game the way it was meant to be played:

- **COIL** — a flood-fill bot plays 20 seeds and must score on every one; the
  hot-chasing line must outscore the safe line by more than 2×, or the greed loop
  is not doing its job.
- **DESCENT** — a PD autopilot must land on at least 9 of 12 seeds, which is what
  proves the flight model is actually flyable rather than merely coherent.
- **GLASSWORKS** — a ball at up to 95 units/s must never tunnel through a
  flipper, and a launched ball must reach the playfield rather than falling back
  down the plunger lane.
- **BALLAST** — headless policy runs assert that **no strategy dominates**: sitting
  in the safe centre scores almost nothing, micro-flipping loses to a committed
  line, spamming the double-flip loses to using it sparingly, and both the
  recklessly tight line and the timid wide line lose to a balanced one.

## Known deviations

Two problems in the original BALLAST brief could not be implemented as written,
and were resolved rather than papered over:

1. **The brief's two playstyles could not score comparably.** It promised that a
   cautious "metronome" and a greedy "diver" would land in the same score band,
   while also requiring centre play to score near-zero. Both cannot hold when
   score is only `metre × multiplier`. Depth is therefore banked at a flat rate
   *plus* a proximity-scaled bonus, and the multiplier has diminishing returns
   above ×8. Simulation confirms the result is an **interior optimum** — neither
   extreme wins — rather than the two symmetric styles the brief predicted.

2. **The brief never specified where gaps sit relative to the walls**, which is
   the single thing the whole loop depends on. Here the earning band is a ribbon
   just inside each wall, and obstacles are teeth growing out of the walls that
   reach *past the centre line*. Riding the stone is therefore exactly what puts
   you in danger, and the middle of the shaft is never a free ride. Teeth
   alternate walls, no wall may run clear for more than two in a row, and a test
   asserts every gap is reachable from the previous one given sink speed and
   lateral acceleration.

The arcade is also **desktop keyboard-first** in its design, rather than the
mobile-first framing of the BALLAST brief — it shares a cabinet with four
keyboard games. Touch is fully supported (see above), but the games were tuned
for a keyboard.
