import type { Rng } from '../../lib/prng.ts'
import { clamp } from '../../lib/math.ts'

/**
 * LUMEN — pure simulation. No DOM, no framework, runs in Node.
 *
 * ## The idea
 *
 * You keep twelve signal-fires on the rim of a caldera through the polar night.
 * Light is the only substance in the game: it is your score, your weapon, your
 * fuel and your bait, and it exists in exactly two places — the lantern you
 * carry and the lamps you have poured it into. Everything you can do is move
 * light between those two places.
 *
 * Five rules produce the whole game:
 *
 * 1. **Lamps cast overlapping light.** Illumination is additive, so two lamps
 *    standing next to each other are worth far more than two lamps apart.
 * 2. **Light above a threshold burns.** One lamp, however bright, can never
 *    reach the threshold on its own — burning requires *adjacency*, which is a
 *    statement about geometry rather than about power.
 * 3. **Shades are moths.** They climb out of the Deep and drift toward the
 *    brightest thing they can see, and light slows their climb. A bright lamp
 *    is therefore a lure before it is a defence.
 * 4. **A shade that reaches the rim keeps taking.** At a lit lamp it latches on
 *    and drinks — and standing inside that lamp's own light does not burn it,
 *    because one lamp is never enough. In the dark it walks the rim after you
 *    and drinks your lantern instead.
 * 5. **The multiplier is the darkness.** Every unlit lamp is +1. So the safe
 *    ring scores nothing and the profitable ring is nearly blind.
 *
 * Everything else — funnels, kill zones, the decision to snuff your own lamp to
 * open a lane, the moment a drinking shade cannot be reached because you built
 * one lamp instead of two — falls out of those five.
 *
 * ## Tuning
 *
 * All numbers live in `TUNING` rather than being scattered through the logic,
 * because this design gets rebalanced dozens of times and a game that needs
 * code edits to tune never gets tuned enough.
 */

/** Lamps around the rim. Positions are continuous in "lamp units", 0..12. */
export const LAMPS = 12
export const LAMP_CAPACITY = 100
export const LANTERN_CAPACITY = 140

export const TUNING = {
  /**
   * Angular half-width of a lamp's cone, in lamp units, at full brightness.
   *
   * Exactly 2 is not a round number chosen for tidiness: it makes a brazier two
   * places away contribute *precisely nothing*, which is what keeps "only
   * neighbours combine" true rather than approximately true. A ring of six
   * alternating fires looks bright and cannot kill a thing.
   */
  coneHalf: 2,
  /**
   * A dim lamp's cone narrows to this fraction of the full width. Kept high so
   * that a fire losing fuel loses *brightness* before it loses *reach* — the
   * failure is gradual and visible rather than a cliff you fall off in three
   * seconds.
   */
  coneFloor: 0.8,
  /** How far down the caldera wall full light reaches, in climb units. */
  reach: 0.9,
  /** A dim lamp's reach shortens to this fraction. */
  reachFloor: 0.6,
  /**
   * Illumination at which light stops repelling and starts burning.
   *
   * A single lamp peaks at exactly 1.0 however much fuel it holds, and two
   * lamps with a gap between them peak at exactly 1.0 as well, so this sits
   * just above both. An adjacent pair peaks at 1.5 and a triple at 2.0 — which
   * is the entire geometry of the game in three numbers.
   */
  burnThreshold: 1.08,
  /** Damage per second per unit of illumination above the threshold. */
  burnRate: 6,
  /**
   * Lamps lose this fraction of their remaining fuel per second.
   *
   * This number decides how many braziers the ring can support at once, which
   * is the size of the whole strategy space. At 0.02 a pair costs about 4 light
   * a second and a full ring about 24 — well past what the Deep sends up — so
   * "light everything" is not cautious, it is impossible, and the interesting
   * question becomes which two to four fires, and where.
   */
  lampDecay: 0.02,
  /**
   * Plus a small constant, so a nearly-empty lamp actually dies instead of
   * decaying toward zero forever. A flat snuff cutoff cannot be used here: a
   * pour delivers `pourRate × dt`, which at 120 Hz is half a unit, so any
   * cutoff above that makes lighting a cold lamp impossible.
   */
  lampFloor: 0.25,
  /** A lamp below this reads as dark: it stops casting and pays multiplier. */
  darkFuel: 5,

  pourRate: 62,
  drawRate: 95,
  /** Lamp units per second. A full lap of the rim takes ~3.5s. */
  keeperSpeed: 3.4,

  /** Climb per second at watch 0, and the per-watch increase. */
  shadeClimb: 0.115,
  shadeClimbPerWatch: 0.014,
  /**
   * Illumination divides climb speed by (1 + slow × illumination).
   *
   * Set high on purpose. Light below the burning threshold still holds shades
   * almost still, so a furnace that has dimmed too far to kill does not leak —
   * it queues. Re-light it and the whole queue goes up at once, which is both
   * the game's best moment and what stops a dip in fuel from being a death
   * spiral you cannot come back from.
   */
  slow: 2,
  /**
   * Maximum angular drift toward light, in lamp units per second, at the
   * bottom of the wall. Shades are moths — but the pull falls off sharply with
   * distance, so a small fire has a catchment of about three lamps either side
   * and the rest of the ring genuinely leaks. Widening that catchment is what
   * more lit braziers buy you, and it is paid for in multiplier.
   */
  lure: 1.5,
  /** Per-shade random angular bias, so they never stack into one line. */
  wander: 0.22,

  /** Fuel a latched shade drinks from its lamp per second. */
  drinkRate: 20,
  /**
   * Shades shelter behind each other.
   *
   * A shade closer to the rim casts a shadow on the ones below it, so a crowd
   * queueing into a narrow band shields its own back rank — and the back rank
   * keeps climbing. This is what stops a two-lamp furnace being a perfect
   * defence: its throughput is capped by how *wide* the band is, not by how
   * bright it is, so the answer to more shades is always more braziers, which
   * is always paid for in multiplier.
   */
  shelterSpread: 0.55,
  shelterDepth: 0.35,
  shelterPerShade: 0.42,
  /** Rim speed of a shade hunting the keeper, at watch 0. */
  huntSpeed: 1.9,
  huntSpeedPerWatch: 0.13,
  /** Light a hunter takes from the lantern per bite. */
  steal: 16,
  /** Seconds before a hunter that has bitten can bite again. */
  biteCooldown: 2,
  /** Where a hunter falls back to after biting. */
  stealKnockback: 0.42,

  watchLength: 45,
  respite: 10,
  spawnBase: 1.15,
  spawnPerWatch: 0.11,
  spawnFloor: 0.32,
  /** Chance a spawn is a maw rather than a wisp, ramping from watch 2. */
  mawFromWatch: 2,
  mawChancePerWatch: 0.06,
  mawChanceCap: 0.34,

  /** Seconds of POUR held at an offer brazier to claim it. */
  claimTime: 0.45,
  claimReach: 0.6,

  maxShades: 60,
} as const

/**
 * Two kinds, differing in kind rather than degree.
 *
 * A wisp is stopped by light and dies in it. A **maw** barely feels it —
 * `slowResist` halves the braking — so it walks through a two-lamp band, takes
 * most but not all of the damage on the way, and latches onto the brazier at
 * the top. That is the pressure that breaks a comfortable little furnace and
 * the reason a ring eventually has to grow: the answer to a maw is a *deeper*
 * band, which means a third fire, which costs a multiplier.
 */
export const SHADE_KINDS = {
  wisp: { hp: 1, light: 13, score: 120, size: 1, slowResist: 1 },
  maw: { hp: 14, light: 42, score: 620, size: 1.9, slowResist: 0.45 },
} as const

export type ShadeKind = keyof typeof SHADE_KINDS

/**
 * The eight boons.
 *
 * They differ in *kind*, not degree — economy, geometry, threshold, tempo,
 * sustain, safety, feedback and throughput — so the interesting question is
 * which one your current ring wants, not which one is biggest. GALE is only
 * good if you have somewhere to put what it drags in; IRON is only good if you
 * are running dark; EMBER only pays if your furnace is where things die.
 */
export const BOONS = {
  oil: { name: 'OIL', glyph: 'drop', blurb: 'Lamps burn 22% slower' },
  mirror: { name: 'MIRROR', glyph: 'lens', blurb: 'Light spreads 18% wider' },
  prism: { name: 'PRISM', glyph: 'prism', blurb: 'Burning starts sooner' },
  wick: { name: 'WICK', glyph: 'flame', blurb: 'Pour and draw 45% faster' },
  vigil: { name: 'VIGIL', glyph: 'eye', blurb: 'Kills return 40% more light' },
  iron: { name: 'IRON', glyph: 'shield', blurb: 'Hunters slower, bites smaller' },
  ember: { name: 'EMBER', glyph: 'spark', blurb: 'Kills feed the nearest lamp' },
  gale: { name: 'GALE', glyph: 'wind', blurb: 'Shades drawn to light 50% harder' },
} as const

export type BoonId = keyof typeof BOONS
export const BOON_IDS = Object.keys(BOONS) as BoonId[]

export interface Lamp {
  fuel: number
  /** Visual only: decays after a pour lands or a shade is torn off. */
  flare: number
}

export interface Shade {
  id: number
  /** Continuous position around the rim, 0..LAMPS. */
  angle: number
  /** 0 at the mouth of the Deep, 1 at the rim. */
  climb: number
  kind: ShadeKind
  hp: number
  /** Light taken from a lamp or the lantern. Returned in full when burned. */
  carried: number
  wander: number
  mode: 'rising' | 'drinking' | 'hunting'
  /** Lamp being drunk from, while `mode` is 'drinking'. */
  latched: number
  /** Visual only: how hard this shade is currently burning, 0..1. */
  sear: number
  /** How much light the shades above it are blocking. 0 is full exposure. */
  shelter: number
  /** Counts down after a bite, during which the shade cannot bite again. */
  sated: number
}

export interface Offer {
  lamp: number
  boon: BoonId
}

export interface LumenInput {
  left: boolean
  right: boolean
  pour: boolean
  draw: boolean
}

/** Values derived from the boons taken. Recomputed only when a boon lands. */
export interface Derived {
  coneHalf: number
  reach: number
  threshold: number
  pourRate: number
  drawRate: number
  killLight: number
  huntSpeed: number
  steal: number
  emberShare: number
  lure: number
  lampDecay: number
}

export interface LumenState {
  keeper: number
  /** Light in hand. Spendable, stealable, and drawn on your lantern. */
  lantern: number
  lamps: Lamp[]
  shades: Shade[]
  nextShadeId: number

  watch: number
  /** Seconds left in the current watch, or in the respite between them. */
  phase: 'watch' | 'respite'
  phaseTimer: number
  spawnTimer: number
  /** Shuffled sectors, so spawns spread around the rim instead of clumping. */
  sectorBag: number[]
  boonBag: BoonId[]
  offers: Offer[]
  boons: Record<BoonId, number>
  claim: number
  derived: Derived

  score: number
  multiplier: number
  burned: number
  mawsBurned: number
  lightStolen: number
  lightSpent: number
  peakMultiplier: number
  bestBurn: number
  boonsTaken: BoonId[]

  elapsed: number
  alive: boolean
}

export interface BurnEvent {
  angle: number
  climb: number
  kind: ShadeKind
  score: number
  light: number
}

export interface LumenEvents {
  burned?: BurnEvent[]
  lampLit?: number
  lampSnuffed?: number
  latched?: number
  stolen?: number
  boon?: BoonId
  watchEnded?: number
  watchBegan?: number
  died?: boolean
}

// --- Ring geometry ----------------------------------------------------------

/** Wrap a continuous rim position into 0..LAMPS. */
export function wrapRing(position: number): number {
  const wrapped = position % LAMPS
  return wrapped < 0 ? wrapped + LAMPS : wrapped
}

/** Shortest signed step from `from` to `to`, in (-LAMPS/2, LAMPS/2]. */
export function ringDelta(from: number, to: number): number {
  let delta = (to - from) % LAMPS
  if (delta > LAMPS / 2) delta -= LAMPS
  if (delta <= -LAMPS / 2) delta += LAMPS
  return delta
}

/** Shortest distance between two rim positions, in lamp units. */
export function ringDistance(a: number, b: number): number {
  return Math.abs(ringDelta(a, b))
}

// --- Light ------------------------------------------------------------------

/**
 * Total illumination at a point on the caldera wall.
 *
 * Additive across lamps, which is the single rule the whole design rests on.
 * The radial falloff is squared so light stays strong for the first third of
 * the wall and then drops away — a linear falloff made the burning band a
 * sliver at the very lip, which shades crossed before they could die in it.
 */
export function illuminationAt(state: LumenState, angle: number, climb: number): number {
  const depth = 1 - climb
  if (depth < 0) return 0
  const { coneHalf, reach } = state.derived
  let total = 0

  for (let i = 0; i < LAMPS; i++) {
    const lamp = state.lamps[i]
    if (!lamp || lamp.fuel <= TUNING.darkFuel) continue
    const brightness = lamp.fuel / LAMP_CAPACITY

    const half = coneHalf * (TUNING.coneFloor + (1 - TUNING.coneFloor) * brightness)
    const angular = ringDistance(angle, i)
    if (angular >= half) continue

    const lampReach = reach * (TUNING.reachFloor + (1 - TUNING.reachFloor) * brightness)
    if (depth >= lampReach) continue

    const fade = depth / lampReach
    total += brightness * (1 - angular / half) * (1 - fade * fade)
  }

  return total
}

/**
 * How far down the wall the burning band extends at this rim position.
 *
 * Returned in depth units below the rim, 0 meaning nothing burns here. The
 * renderer draws this directly, so the white-hot band on screen *is* the kill
 * zone rather than a decoration that approximates it.
 */
export function burnDepthAt(state: LumenState, angle: number): number {
  const threshold = state.derived.threshold
  if (illuminationAt(state, angle, 1) < threshold) return 0

  let lo = 0
  let hi = state.derived.reach
  for (let i = 0; i < 9; i++) {
    const mid = (lo + hi) / 2
    if (illuminationAt(state, angle, 1 - mid) >= threshold) lo = mid
    else hi = mid
  }
  return lo
}

export function litLamps(state: LumenState): number {
  let count = 0
  for (const lamp of state.lamps) if (lamp.fuel > TUNING.darkFuel) count += 1
  return count
}

export function darkLamps(state: LumenState): number {
  return LAMPS - litLamps(state)
}

/** Light you still own: in hand plus in the lamps. Not what shades carry. */
export function totalLight(state: LumenState): number {
  let total = state.lantern
  for (const lamp of state.lamps) total += lamp.fuel
  return total
}

// --- Setup ------------------------------------------------------------------

function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    const a = items[i]
    const b = items[j]
    if (a === undefined || b === undefined) continue
    items[i] = b
    items[j] = a
  }
  return items
}

export function computeDerived(boons: Record<BoonId, number>): Derived {
  return {
    coneHalf: TUNING.coneHalf * Math.pow(1.18, boons.mirror),
    reach: TUNING.reach,
    threshold: Math.max(0.72, TUNING.burnThreshold - 0.14 * boons.prism),
    pourRate: TUNING.pourRate * Math.pow(1.45, boons.wick),
    drawRate: TUNING.drawRate * Math.pow(1.3, boons.wick),
    killLight: Math.pow(1.4, boons.vigil),
    huntSpeed: Math.pow(0.78, boons.iron),
    steal: Math.pow(0.62, boons.iron),
    emberShare: 1 - Math.pow(0.6, boons.ember),
    lure: TUNING.lure * Math.pow(1.5, boons.gale),
    lampDecay: TUNING.lampDecay * Math.pow(0.78, boons.oil),
  }
}

function emptyBoons(): Record<BoonId, number> {
  return { oil: 0, mirror: 0, prism: 0, wick: 0, vigil: 0, iron: 0, ember: 0, gale: 0 }
}

/**
 * The opening position teaches rule 2 without a word of text.
 *
 * Two adjacent lamps are already burning at 88, which is just enough to hold a
 * kill band, and the keeper starts standing in it. The first shade climbs into
 * that band and dies in front of you inside the first ten seconds. Pour, and
 * you watch the band deepen; walk away and light a third lamp somewhere else,
 * and you watch it collapse.
 */
export function createState(rng: Rng): LumenState {
  const boons = emptyBoons()
  const lamps: Lamp[] = Array.from({ length: LAMPS }, () => ({ fuel: 0, flare: 0 }))
  const first = lamps[5]
  const second = lamps[6]
  if (first) first.fuel = 92
  if (second) second.fuel = 92

  return {
    keeper: 5.5,
    lantern: 100,
    lamps,
    shades: [],
    nextShadeId: 1,

    watch: 0,
    phase: 'watch',
    phaseTimer: TUNING.watchLength,
    spawnTimer: 1.2,
    sectorBag: shuffle(Array.from({ length: LAMPS }, (_, i) => i), rng),
    boonBag: shuffle([...BOON_IDS], rng),
    offers: [],
    boons,
    claim: 0,
    derived: computeDerived(boons),

    score: 0,
    multiplier: 1,
    burned: 0,
    mawsBurned: 0,
    lightStolen: 0,
    lightSpent: 0,
    peakMultiplier: 1,
    bestBurn: 0,
    boonsTaken: [],

    elapsed: 0,
    alive: true,
  }
}

// --- Step -------------------------------------------------------------------

export function step(state: LumenState, input: LumenInput, dt: number, rng: Rng): LumenEvents {
  const events: LumenEvents = {}
  if (!state.alive) return events

  state.elapsed += dt

  moveKeeper(state, input, dt)
  transferLight(state, input, dt, events)
  burnLamps(state, dt, events)
  updatePhase(state, dt, rng, events)
  spawnShades(state, dt, rng)
  updateShades(state, dt, events)

  state.multiplier = 1 + darkLamps(state)
  if (state.multiplier > state.peakMultiplier) state.peakMultiplier = state.multiplier

  if (totalLight(state) <= 0.5) {
    state.alive = false
    state.lantern = 0
    for (const lamp of state.lamps) lamp.fuel = 0
    events.died = true
  }

  return events
}

function moveKeeper(state: LumenState, input: LumenInput, dt: number): void {
  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  if (direction === 0) return
  state.keeper = wrapRing(state.keeper + direction * TUNING.keeperSpeed * dt)
}

function nearestLampIndex(position: number): number {
  return Math.round(wrapRing(position)) % LAMPS
}

/**
 * Pour and draw, the only two verbs.
 *
 * Pouring into an offer brazier claims a boon instead of feeding the lamp, so
 * the draft costs exactly what everything else costs: the seconds you were not
 * spending on the fire.
 */
function transferLight(
  state: LumenState,
  input: LumenInput,
  dt: number,
  events: LumenEvents,
): void {
  const index = nearestLampIndex(state.keeper)
  const lamp = state.lamps[index]
  if (!lamp) return
  const inReach = ringDistance(state.keeper, index) <= TUNING.claimReach
  const offer = inReach ? state.offers.find((o) => o.lamp === index) : undefined

  if (offer && input.pour) {
    state.claim += dt
    if (state.claim >= TUNING.claimTime) {
      takeBoon(state, offer.boon)
      events.boon = offer.boon
      state.offers = []
      state.claim = 0
    }
    return
  }
  state.claim = 0

  if (input.pour && state.lantern > 0) {
    const wasDark = lamp.fuel <= TUNING.darkFuel
    const amount = Math.min(
      state.derived.pourRate * dt,
      state.lantern,
      LAMP_CAPACITY - lamp.fuel,
    )
    if (amount > 0) {
      state.lantern -= amount
      lamp.fuel += amount
      lamp.flare = Math.min(1, lamp.flare + dt * 4)
      if (wasDark && lamp.fuel > TUNING.darkFuel) events.lampLit = index
    }
  } else if (input.draw && lamp.fuel > 0) {
    const wasLit = lamp.fuel > TUNING.darkFuel
    const amount = Math.min(
      state.derived.drawRate * dt,
      lamp.fuel,
      LANTERN_CAPACITY - state.lantern,
    )
    if (amount > 0) {
      lamp.fuel -= amount
      state.lantern += amount
      if (wasLit && lamp.fuel <= TUNING.darkFuel) events.lampSnuffed = index
    }
  }
}

/**
 * Lamps lose a fraction of what they hold, so brightness is what costs — a lamp
 * at 90 burns nine times as fast as one at 10. This is the pressure that makes
 * a hot furnace a decision rather than an obvious upgrade.
 */
function burnLamps(state: LumenState, dt: number, events: LumenEvents): void {
  const decay = state.derived.lampDecay
  for (let i = 0; i < LAMPS; i++) {
    const lamp = state.lamps[i]
    if (!lamp) continue
    lamp.flare = Math.max(0, lamp.flare - dt * 2.5)
    if (lamp.fuel <= 0) continue

    const wasLit = lamp.fuel > TUNING.darkFuel
    const spent = Math.min(lamp.fuel, (lamp.fuel * decay + TUNING.lampFloor) * dt)
    lamp.fuel -= spent
    state.lightSpent += spent
    if (wasLit && lamp.fuel <= TUNING.darkFuel && events.lampSnuffed === undefined) {
      events.lampSnuffed = i
    }
  }
}

function takeBoon(state: LumenState, boon: BoonId): void {
  state.boons[boon] += 1
  state.boonsTaken.push(boon)
  state.derived = computeDerived(state.boons)
}

function drawOffers(state: LumenState, rng: Rng): void {
  if (state.boonBag.length < 3) state.boonBag = shuffle([...BOON_IDS], rng)
  const picks = state.boonBag.splice(0, 3)
  // Evenly spaced around the rim from a random start: the boon you want is
  // often the one furthest from the fire you are keeping alive.
  const start = rng.int(0, LAMPS - 1)
  state.offers = picks.map((boon, i) => ({ lamp: (start + i * 4) % LAMPS, boon }))
}

function updatePhase(state: LumenState, dt: number, rng: Rng, events: LumenEvents): void {
  state.phaseTimer -= dt
  if (state.phaseTimer > 0) return

  if (state.phase === 'watch') {
    state.phase = 'respite'
    state.phaseTimer = TUNING.respite
    state.score += Math.round(750 * (state.watch + 1) * state.multiplier)
    drawOffers(state, rng)
    events.watchEnded = state.watch
  } else {
    state.phase = 'watch'
    state.watch += 1
    state.phaseTimer = TUNING.watchLength
    events.watchBegan = state.watch
  }
}

function spawnInterval(state: LumenState): number {
  return Math.max(TUNING.spawnFloor, TUNING.spawnBase - state.watch * TUNING.spawnPerWatch)
}

function mawChance(state: LumenState): number {
  if (state.watch < TUNING.mawFromWatch) return 0
  return Math.min(
    TUNING.mawChanceCap,
    (state.watch - TUNING.mawFromWatch + 1) * TUNING.mawChancePerWatch,
  )
}

/**
 * Spawns walk a shuffled bag of rim sectors rather than rolling independently,
 * so the Deep never sends six in a row up the same lane and never leaves a
 * third of the ring untouched for a minute. Perceived fairness is engineered.
 */
function spawnShades(state: LumenState, dt: number, rng: Rng): void {
  if (state.phase === 'respite') return
  state.spawnTimer -= dt
  if (state.spawnTimer > 0) return
  state.spawnTimer = spawnInterval(state)
  if (state.shades.length >= TUNING.maxShades) return

  if (state.sectorBag.length === 0) {
    state.sectorBag = shuffle(Array.from({ length: LAMPS }, (_, i) => i), rng)
  }
  const sector = state.sectorBag.pop() ?? rng.int(0, LAMPS - 1)
  const kind: ShadeKind = rng.chance(mawChance(state)) ? 'maw' : 'wisp'

  state.shades.push({
    id: state.nextShadeId++,
    angle: wrapRing(sector + rng.range(-0.45, 0.45)),
    climb: 0.02,
    kind,
    hp: SHADE_KINDS[kind].hp,
    carried: 0,
    wander: rng.range(-TUNING.wander, TUNING.wander),
    mode: 'rising',
    latched: -1,
    sear: 0,
    shelter: 0,
    sated: 0,
  })
}

/**
 * The angular pull toward light.
 *
 * Inverse-distance weighted over every lit lamp, which converges smoothly on a
 * cluster without the jitter a sampled gradient produces, and naturally makes a
 * bright pair a stronger lure than two scattered lamps of the same total fuel —
 * the same asymmetry that governs burning.
 */
function lightPull(state: LumenState, angle: number): number {
  let pull = 0
  for (let i = 0; i < LAMPS; i++) {
    const lamp = state.lamps[i]
    if (!lamp || lamp.fuel <= TUNING.darkFuel) continue
    const delta = ringDelta(angle, i)
    if (delta === 0) continue
    const falloff = 0.7 + Math.abs(delta)
    const weight = (lamp.fuel / LAMP_CAPACITY) / (falloff * falloff)
    pull += Math.sign(delta) * weight
  }
  return clamp(pull * 3, -1, 1)
}

/**
 * How much light each shade is being denied by the ones above it.
 *
 * O(n²) over a list capped at sixty, which is a few thousand comparisons a
 * frame and does not show up in a profile — and it is worth far more than that,
 * because it is the rule that turns "how bright" into "how wide".
 */
function updateShelter(state: LumenState): void {
  const shades = state.shades
  for (const shade of shades) shade.shelter = 0

  for (let i = 0; i < shades.length; i++) {
    const below = shades[i]
    if (!below) continue
    for (let j = 0; j < shades.length; j++) {
      if (i === j) continue
      const above = shades[j]
      if (!above) continue
      const rise = above.climb - below.climb
      if (rise <= 0 || rise > TUNING.shelterDepth) continue
      if (Math.abs(ringDelta(below.angle, above.angle)) > TUNING.shelterSpread) continue
      below.shelter += SHADE_KINDS[above.kind].size * TUNING.shelterPerShade
    }
  }
}

function updateShades(state: LumenState, dt: number, events: LumenEvents): void {
  const climbSpeed = TUNING.shadeClimb + state.watch * TUNING.shadeClimbPerWatch
  const huntSpeed = (TUNING.huntSpeed + state.watch * TUNING.huntSpeedPerWatch)
    * state.derived.huntSpeed
  const threshold = state.derived.threshold
  updateShelter(state)

  for (let i = state.shades.length - 1; i >= 0; i--) {
    const shade = state.shades[i]
    if (!shade) continue

    shade.sated = Math.max(0, shade.sated - dt)
    const illumination = illuminationAt(state, shade.angle, shade.climb) / (1 + shade.shelter)

    if (illumination > threshold) {
      shade.hp -= (illumination - threshold) * TUNING.burnRate * dt
      shade.sear = Math.min(1, shade.sear + dt * 5)
      if (shade.hp <= 0) {
        burnShade(state, shade, i, events)
        continue
      }
    } else {
      shade.sear = Math.max(0, shade.sear - dt * 2.5)
    }

    switch (shade.mode) {
      case 'rising':
        riseShade(state, shade, dt, climbSpeed, illumination, events)
        break
      case 'drinking':
        drinkShade(state, shade, dt)
        break
      case 'hunting':
        huntShade(state, shade, dt, huntSpeed, events)
        break
    }
  }
}

function riseShade(
  state: LumenState,
  shade: Shade,
  dt: number,
  climbSpeed: number,
  illumination: number,
  events: LumenEvents,
): void {
  // A shade deep in the well has time to manoeuvre and does; one about to crest
  // the rim is committed. Without that, they slide sideways along the lip and
  // the whole approach reads as sliding rather than as climbing.
  const commitment = 0.35 + 0.65 * (1 - shade.climb)
  shade.angle = wrapRing(
    shade.angle
    + (lightPull(state, shade.angle) * state.derived.lure * commitment + shade.wander) * dt,
  )
  shade.climb += climbSpeed
    / (1 + TUNING.slow * SHADE_KINDS[shade.kind].slowResist * illumination) * dt
  if (shade.climb < 1) return

  shade.climb = 1
  const index = nearestLampIndex(shade.angle)
  const lamp = state.lamps[index]
  if (lamp && lamp.fuel > TUNING.darkFuel) {
    shade.mode = 'drinking'
    shade.latched = index
    shade.angle = index
    events.latched = index
  } else {
    shade.mode = 'hunting'
    shade.latched = -1
  }
}

/**
 * A latched shade sits at the foot of the lamp it is draining, inside that
 * lamp's own light — which is exactly the illumination that can never reach the
 * threshold. A lone bright lamp is therefore not a defence but a feeding
 * trough, and the only answer is a lit neighbour.
 */
function drinkShade(state: LumenState, shade: Shade, dt: number): void {
  const lamp = state.lamps[shade.latched]
  if (!lamp || lamp.fuel <= TUNING.darkFuel) {
    shade.mode = 'hunting'
    shade.latched = -1
    return
  }
  const amount = Math.min(TUNING.drinkRate * dt, lamp.fuel)
  lamp.fuel = Math.max(0, lamp.fuel - amount)
  shade.carried += amount
  state.lightStolen += amount
}

function huntShade(
  state: LumenState,
  shade: Shade,
  dt: number,
  huntSpeed: number,
  events: LumenEvents,
): void {
  const delta = ringDelta(shade.angle, state.keeper)
  const stride = huntSpeed * dt
  shade.angle = Math.abs(delta) <= stride
    ? state.keeper
    : wrapRing(shade.angle + Math.sign(delta) * stride)

  if (shade.sated > 0 || Math.abs(ringDelta(shade.angle, state.keeper)) > 0.3) return

  const amount = Math.min(TUNING.steal * state.derived.steal, state.lantern)
  state.lantern -= amount
  shade.carried += amount
  state.lightStolen += amount
  shade.sated = TUNING.biteCooldown
  // It dives back into the Deep with what it took. Burn it and you get it all
  // back, so a bite is a loan at a bad rate rather than a wound.
  shade.mode = 'rising'
  shade.climb = TUNING.stealKnockback
  shade.latched = -1
  events.stolen = (events.stolen ?? 0) + amount
}

function burnShade(state: LumenState, shade: Shade, index: number, events: LumenEvents): void {
  state.shades.splice(index, 1)
  const spec = SHADE_KINDS[shade.kind]

  const recovered = (spec.light + shade.carried) * state.derived.killLight
  const toLamp = recovered * state.derived.emberShare
  const nearest = state.lamps[nearestLampIndex(shade.angle)]
  if (nearest && toLamp > 0) {
    nearest.fuel = Math.min(LAMP_CAPACITY, nearest.fuel + toLamp)
    nearest.flare = 1
  }
  state.lantern = Math.min(LANTERN_CAPACITY, state.lantern + (recovered - toLamp))

  const points = Math.round((spec.score + shade.carried * 8) * state.multiplier)
  state.score += points
  state.burned += 1
  if (shade.kind === 'maw') state.mawsBurned += 1
  if (points > state.bestBurn) state.bestBurn = points

  const burns = events.burned ?? (events.burned = [])
  burns.push({
    angle: shade.angle,
    climb: shade.climb,
    kind: shade.kind,
    score: points,
    light: recovered,
  })
}

// --- Readouts for the shell -------------------------------------------------

export function drinkingCount(state: LumenState): number {
  let count = 0
  for (const shade of state.shades) if (shade.mode === 'drinking') count += 1
  return count
}

export function huntingCount(state: LumenState): number {
  let count = 0
  for (const shade of state.shades) if (shade.mode === 'hunting') count += 1
  return count
}

/** The offer the keeper is standing at, if any. Drives the in-world label. */
export function offerUnderKeeper(state: LumenState): Offer | undefined {
  return state.offers.find((offer) => ringDistance(state.keeper, offer.lamp) <= TUNING.claimReach)
}
