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
| **LUMEN** | Walk the rim | POUR light into a brazier (↓ DRAW) | Tempest, sort of |
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

### LUMEN — *light is the bait*
Twelve signal-fires on the rim of a caldera, on the longest night of the year.
Light is the only substance in the game — it is your score, your weapon, your
fuel and your bait — and it exists in exactly two places: the lantern you carry
and the braziers you have poured it into. Every verb moves light between them.

Five rules produce the rest:

| # | Rule | What falls out of it |
| --- | --- | --- |
| 1 | Braziers cast **additive** light, cones ±2 lamps wide at full fuel | Two fires next to each other are worth far more than two fires apart |
| 2 | Light above **1.08** burns. One lamp peaks at exactly **1.0** — and so do two lamps with a gap between them | Killing is a statement about *adjacency*, not about power. A ring of six alternating fires looks bright and cannot kill a thing |
| 3 | Shades are **moths**: they drift toward the brightest thing they can see, and light slows their climb | A bright brazier is a lure before it is a defence |
| 4 | A shade that reaches the rim **keeps taking** — it latches onto a lit brazier and drinks, or walks the rim after your lantern if the rim is dark | A lone fire is a feeding trough: the shade drinking it stands in light that by rule 2 can never hurt it |
| 5 | The multiplier **is the darkness**: ×1 plus one per unlit brazier | The safe ring scores nothing and the profitable ring is nearly blind |

Two things emerge that are written into no single rule. **Crowding**: shades
queueing into a narrow band shelter each other from the light, so a two-lamp
furnace is capped by how *wide* it is rather than how bright — the answer to
more shades is always more braziers, and more braziers always cost multiplier.
And **maws**, which barely feel light at all, walk through a two-lamp band and
latch on at the top; the only real answer is a third fire, which is to say the
game charges you a multiplier to survive.

The burning band drawn on the caldera wall is not an effect that approximates
the rule — the renderer samples the *same* `burnDepthAt` the simulation kills
with, so the white-hot shape on the wall is exactly the region a shade dies in.
That is why the game needs no numbers on screen: its most important quantity is
a shape, and its second most important one is painted on the keeper's lantern.

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
npm test         # 191 tests
```

Deployed to GitHub Pages from `main` (see `.github/workflows/deploy.yml`), which
is why `vite.config.ts` sets `base: '/arcade/'`.

## Touch

The arcade is keyboard-first, but it is fully playable on a phone.

On a coarse pointer the picker swaps its keyboard hints for tappable controls —
mode rows are real buttons and there is an explicit **PLAY** button, rather than
a second tap on the selected cabinet, which nobody could discover. In a game, an
on-screen pad appears: a d-pad, an action button labelled with that game's verb
(POUR, PLUNGE, BURN, PHASE), and a pause button. BALLAST needs only one input,
so the whole screen is its tap target.

DESCENT and LUMEN use a **split** layout instead of a cross: steering under the
left thumb, power under the right. It is sized from where thumbs actually rest
rather than from a grid — the bottom corners are reachable one-handed on a 390 px
phone and the middle of the bottom edge is not — so every control clears 44 px
comfortably and the primary verb is a 120 px target hard in the corner. The big
button is whichever key the game holds most: `↑` for a lander's thrust, SPACE for
a game without one, so a three-verb game still gets a proper primary rather than
leaving the corner empty.

The pad works by dispatching the same keyboard events a physical key would, so
the games, the pause handler, the menus and the initials entry need no touch
handling of their own — there is one input path, not two. Buttons hold their key
while a finger is down, so thrust, flippers and the plunger charge behave exactly
as they do on a keyboard, and a finger lifted outside a button still releases it.

Games that show a cross pad shrink their canvas above it, so no playfield or
readout ever sits underneath the controls. The split layout tucks into the
corners instead and can overlay a full-height canvas — LUMEN sizes its caldera to
end above them at 360, 390 and 430 px wide, and in landscape.

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
- **Input** reads `event.code`, clears on blur, and prefers a key that was *just
  pressed* over one merely held so a quick tap is never dropped between two
  simulation steps. Auto-repeat is used rather than discarded: a repeat is not a
  new press, but it is the only evidence a game gets that a key is down when it
  mounts mid-hold — dropping repeats meant holding SPACE through "SPACE to start"
  left the key unregistered until you released it, which is exactly wrong for the
  two cabinets whose main verb is a held SPACE.
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

191 tests, all running against the pure simulations in Node.

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
- **LUMEN** — the illumination guarantees are asserted from several directions
  (one brazier never burns; two adjacent full ones do; two with a gap never do;
  a pair of half-full ones is not enough), plus a balance sweep described below.

### LUMEN balance

Ten policies, fourteen seeds each, capped at seven minutes. Each "shape" holds a
set of braziers topped up and opens the next only once it can afford to — a
policy that spreads before it can fund the spread dies in a minute, which is
true of a player too and is not what we are trying to measure.

| Policy | Median | Best | Mean life | Burned |
| --- | --- | --- | --- | --- |
| **pair** (hold two adjacent) | 505,226 | 1,311,271 | 258 s | 205 |
| **adaptive** (grow a fire every two watches) | 447,766 | 1,366,406 | 262 s | 214 |
| triple / quad / arc of six / full ring (grow eagerly) | ~40,000 | 49,497 | 65 s | 23 |
| two fires (two separate pairs) | 31,886 | 209,217 | 62 s | 20 |
| alternating (six fires, none touching) | 3,960 | 25,408 | 41 s | **3** |
| hoard (draw everything, light nothing) | 0 | 0 | 22 s | 0 |
| flail (random inputs) | 0 | 10,950 | 40 s | 0 |

**The dominant strategy we found, and what was done about it.** Earlier tunings
made a fully-fuelled adjacent pair *unbeatable*: it funnelled the whole ring into
one grinder, never needed to change, and survived the cap on nine seeds in
fourteen. Two rules were added to break it rather than nerfing a number —
shade **crowding** (which caps a narrow band's throughput by width) and the
**maw** (which is barely slowed by light and walks through a two-lamp band). The
pair is now the strongest *single* shape and should be: it is the shape the game
opens in. But it no longer runs away with it — growing the ring as the watches
escalate survives slightly longer and has the higher ceiling, so the live
question is *when* to pay a multiplier for a deeper band, not *whether*.

The trap is the opposite of what it looks like: opening a fourth fire is not the
cautious play. Light is conserved, so a ring you cannot fund runs every brazier
below the burning threshold and kills nothing at all — the eager-growth policies
score an eighth of what holding two does. And "alternating", the shape that looks
safest of all, burns **three shades in forty seconds**, because none of its six
fires is next to another.

## LUMEN tuning

All of it lives in one exported `TUNING` object in `src/games/lumen/simulation.ts`
rather than being scattered through the logic, because this design was rebalanced
a dozen times and a game that needs code edits to tune never gets tuned enough.

| Value | Setting | Why this number |
| --- | --- | --- |
| `coneHalf` | 2.0 lamps | Exactly 2 makes a brazier two places away contribute *precisely zero*, which is what keeps "only neighbours combine" true rather than approximately true |
| `coneFloor` | 0.8 | A fire losing fuel loses brightness before it loses reach, so failure is gradual and visible instead of a cliff |
| `burnThreshold` | 1.08 | Just above the 1.0 that one lamp — or two with a gap — can reach. Adjacent pair peaks at 1.5, triple at 2.0 |
| `burnRate` | 6 /s per unit over threshold | A wisp dies in ~0.6 s in a full pair, ~0.25 s in a triple |
| `lampDecay` · `lampFloor` | 0.02 /s · 0.25 /s | Decides how many fires the ring can support: a pair costs ~4 light/s, a full ring ~24, which is well past what the Deep sends up. "Light everything" is not cautious, it is impossible |
| `pourRate` · `drawRate` | 62 · 95 /s | Lighting a cold brazier to burning takes ~1.4 s — long enough to be a commitment, short enough to be a panic move |
| `lure` | 1.5 lamps/s | Falls off as 1/d², giving a fire a catchment of ~3 lamps either side. Widening that catchment is what more braziers buy |
| `slow` | 2 | Light below the threshold still nearly stops a shade, so a dimmed furnace queues rather than leaks — and re-lighting it cashes the whole queue at once |
| `shelter*` | 0.55 · 0.35 · 0.42 | Crowding. Caps a narrow band's throughput by width rather than brightness |
| `drinkRate` · `steal` | 20 /s · 16 per bite | A latched shade beats decay but not a keeper who is present; the cost of drinking is that you have to *be there* |
| maw `hp` · `slowResist` | 14 · 0.45 | Tuned so a maw survives a two-lamp band (~11 damage crossing it) and dies in a three-lamp one (~28) |
| `watchLength` · `respite` | 45 s · 10 s | A run is four to six watches, three to five minutes |

Progression is a **draft, not a power curve**. Each respite raises three signs a
third of the ring apart, dealt from a shuffled bag so the same three never
repeat, and you claim one by standing at it and holding POUR — the draft costs
exactly what everything else costs, which is the seconds you were not spending on
the fire. The eight differ in *kind*: OIL (economy), MIRROR (geometry), PRISM
(threshold), WICK (tempo), VIGIL (sustain), IRON (safety), EMBER (feedback),
GALE (throughput). GALE is only good if you have somewhere to put what it drags
in; IRON is only good if you are running dark. A test asserts the bag deals all
eight, so none is dead weight.


## Known deviations

**LUMEN does not load anything from a CDN**, which was asked for. This repo is a
Vite + TypeScript bundle, and the design brief it was rebuilt against forbids
third-party requests at runtime outright — a CDN outage takes the game down, and
those requests leak players' IPs to companies they never chose. Everything LUMEN
needs already existed in `src/lib`: seeded RNG, value noise, OKLab colour mixing,
synthesized audio and pooled particles. So no library was needed in either form.
Say the word and it can be switched to CDN script tags.

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
