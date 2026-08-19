import type { GameDefinition } from '../lib/types.ts'

/**
 * The cabinet line-up.
 *
 * Every game is loaded dynamically so the shell stays small and a game's code
 * only downloads when someone chooses to play it.
 *
 * Each entry carries a `briefing`. These games are all deliberately wordless
 * while you play — no tutorial, no tooltips, no text in the world — which is
 * good for the playing and leaves the first thirty seconds as pure guesswork.
 * The briefing is the one place a game explains itself, so its numbers are
 * taken from the simulation constants rather than described loosely. If a rule
 * changes in a `simulation.ts`, it has to change here too.
 */
export const GAMES: GameDefinition[] = [
  {
    id: 'coil',
    name: 'COIL',
    tagline: 'The arena turns. Your hands do not.',
    arrows: 'Move (fixed world directions)',
    space: 'PHASE through your tail',
    accent: '#00ff88',
    modes: [
      { id: 'endless', name: 'ENDLESS', description: 'Run until you fold into yourself.' },
      { id: 'sprint', name: 'SPRINT 60', description: 'Sixty seconds. Pure score attack.' },
    ],
    touchKeys: ['left', 'right', 'up', 'down', 'space'],
    actionLabel: 'PHASE',
    briefing: {
      story: 'A snake in a rotating arena. Every five pickups the whole world turns a quarter turn — but your controls never do.',
      goal: 'Eat pickups and grow without hitting a wall or your own tail.',
      ends: 'You hit a wall, or run into your own tail while not phasing. In SPRINT 60 the run also ends when the clock does.',
      scoring: [
        'Safe pickup: 10 points. Hot pickup: 50 points.',
        'Both are multiplied by (1 + combo × 0.5).',
        'A hot pickup adds 1 to your combo. A safe pickup resets it to zero.',
        'Hot pickups spawn in the most enclosed cell on the board — the multiplier deliberately lives where it is most dangerous to go.',
      ],
      controls: [
        { keys: '← → ↑ ↓', touchKeys: 'D-PAD', action: 'Move. Keys map to fixed world directions and never rotate with the arena.' },
        { keys: 'SPACE', touchKeys: 'PHASE', action: 'Phase for 0.5s and pass through your own tail. Two charges maximum; each hot pickup refunds one.' },
      ],
      tip: 'Your combo also makes you faster, so every combo is harder to hold than the last.',
    },
    load: () => import('../games/coil/index.ts'),
  },
  {
    id: 'descent',
    name: 'DESCENT',
    tagline: 'No instruments. The world turns, not you.',
    arrows: '← → rotate · ↑ thrust · ↓ survey',
    space: 'HARD BURN',
    accent: '#ffb000',
    modes: [
      { id: 'standard', name: 'EXPEDITION', description: 'One fuel budget. Land as deep as you dare.' },
      { id: 'daily', name: 'DAILY', description: "Today's caverns, the same for everyone." },
    ],
    touchKeys: ['left', 'right', 'up', 'down', 'space'],
    actionLabel: 'BURN',
    touchLayout: 'split',
    touchLabels: { primary: 'THRUST', secondary: 'BURN', tertiary: 'SURVEY' },
    briefing: {
      story: 'A survey drone descending through a chain of caves, lit only by its own lamp. Each landing takes you one cavern deeper, and the roof comes down as you go.',
      goal: 'Land softly and upright on a pad. Every successful landing opens a deeper, tighter cavern.',
      ends: 'You touch down off-pad, too fast or too tilted; you hit the ceiling at speed; or your tanks run dry.',
      scoring: [
        'A landing pays 500 × pad value × run multiplier × softness × (1 + fuel remaining).',
        'Pads are worth ×1, ×3 and ×8. The ×8 sits in a chasm between two spires.',
        'Softness is how slowly you touched down — a gentle landing is worth several times a hard one.',
        'A perfect landing — almost stopped, almost level — permanently adds 1 to your run multiplier.',
      ],
      controls: [
        { keys: '← →', touchKeys: '◀ ▶', action: 'Rotate. There is no damping, so stopping a spin means turning back against it.', hold: true },
        { keys: '↑', touchKeys: 'THRUST', action: 'Main engine. Pushes whichever way the drone is pointing, and burns fuel.', hold: true },
        { keys: 'SPACE', touchKeys: 'BURN', action: 'Hard burn — roughly double thrust for triple the fuel.', hold: true },
        { keys: '↓', touchKeys: 'SURVEY', action: 'Zoom out to see the whole cavern and choose your pad.', hold: true },
      ],
      tip: 'A landing returns fuel in proportion to how well you flew it, and returns less of it the deeper you go. Fuel, not the cave, is what ends the run.',
    },
    load: () => import('../games/descent/index.ts'),
  },
  {
    id: 'lumen',
    name: 'LUMEN',
    tagline: 'Light rises from the well. Catch it before it leaves.',
    arrows: '← → crawl the rim · ↑ dive · ↓ gather',
    space: 'BLOOM',
    accent: '#00fff2',
    modes: [
      { id: 'standard', name: 'THE WELL', description: 'Keep the tunnel lit for as long as you can.' },
    ],
    touchKeys: ['left', 'right', 'up', 'down', 'space'],
    actionLabel: 'BLOOM',
    briefing: {
      story: 'You crawl the rim of a deep well. Motes of light rise out of it, and any that crest the rim escape and the tunnel dims. The richest motes sink instead of rising.',
      goal: 'Catch motes before they escape, and clear waves. The first wave needs 12; each wave after needs four more.',
      ends: 'Your light reaches zero. It drains slowly all the time, and every mote that escapes costs 4 more.',
      scoring: [
        'Rising mote: 100 × multiplier. Deep mote: 400 × multiplier.',
        'Dissolving a spire: 150 × multiplier.',
        'Clearing a wave: 1000 × multiplier × (1 + spires dissolved that wave).',
        'The multiplier is 1 + (deep motes caught ÷ 5). Letting a mote escape halves it rather than erasing it.',
      ],
      controls: [
        { keys: '← →', touchKeys: '◀ ▶', action: 'Crawl around the rim.', hold: true },
        { keys: 'SPACE', touchKeys: 'BLOOM', action: 'Bloom to catch anything in reach. Tap for a narrow, deep bloom; hold for a wide, shallow one.' },
        { keys: '↑', touchKeys: '▲', action: 'Dive into the well after deep motes. Costs 2 light, and tall spires block it.' },
        { keys: '↓', touchKeys: '▼', action: 'Hold to gather, dragging deep motes up toward you. One charge per wave.', hold: true },
      ],
      tip: 'Deep motes are worth four times a rising one and are the only thing that raises your multiplier — but reaching them costs the light you are trying to keep.',
    },
    load: () => import('../games/lumen/index.ts'),
  },
  {
    id: 'glassworks',
    name: 'GLASSWORKS',
    tagline: 'A table that rebuilds itself beneath the ball.',
    arrows: '← → flippers · ↑ ↓ divert',
    space: 'plunger, then NUDGE',
    accent: '#ff5ce1',
    modes: [
      { id: 'standard', name: 'THREE BALLS', description: 'Complete missions. Survive the rebuilds.' },
    ],
    touchKeys: ['left', 'right', 'up', 'down', 'space'],
    actionLabel: 'PLUNGE',
    briefing: {
      story: 'A pinball table made of glass. Complete a mission and it tears its own interior down and builds a different one — the thing a real table can never do.',
      goal: 'Hit all three lit targets to complete a mission and trigger a rebuild. Then do it again on the new table.',
      ends: 'You lose all three balls. A ball is safe for the first 15 seconds after launch — it returns to the plunger instead of draining.',
      scoring: [
        'Bumpers: 1,500. Slingshots: 250. Targets: 25,000 each.',
        'Completing a mission pays a 1,000,000 jackpot, plus 250,000 for every mission already finished.',
        'During multiball the jackpot is 5,000,000 instead.',
        'Multiball unlocks on the third mission and stays for the rest of the game.',
      ],
      controls: [
        { keys: '← →', touchKeys: '◀ ▶', action: 'Left and right flippers.', hold: true },
        { keys: 'SPACE', touchKeys: 'PLUNGE', action: 'Hold to charge the plunger and launch. Once in play, tap it to nudge the table.', hold: true },
        { keys: '↑ ↓', touchKeys: '▲ ▼', action: 'Raise or drop the diverter to steer the ball into a different lane. Two-second cooldown.' },
      ],
      tip: 'Nudging shoves the ball but fills a tilt meter. Fill it and the flippers lock for four seconds, which usually costs you the ball.',
    },
    load: () => import('../games/glassworks/index.ts'),
  },
  {
    id: 'ballast',
    name: 'BALLAST',
    tagline: 'The stone is where the money is.',
    arrows: '—  (this one needs no arrows)',
    space: 'FLIP gravity',
    accent: '#7cf5c0',
    modes: [
      { id: 'standard', name: 'DESCENT', description: 'Sink. Ride the masonry. Do not touch it.' },
    ],
    touchKeys: ['space'],
    actionLabel: 'FLIP',
    briefing: {
      story: 'A diving bell sinking through a drowned cathedral. Gravity pulls you sideways into one wall, and the only thing you can do is choose which wall.',
      goal: 'Sink as deep as you can while riding as close to the masonry as you dare.',
      ends: 'You touch the stone. That is the only way to lose.',
      scoring: [
        'Every metre banks 1 point, wherever you are.',
        'Flying close to stone banks far more, scaled by how close you are and by your multiplier.',
        'The multiplier climbs only inside the earning band near a wall. The middle of the shaft earns almost nothing.',
        'Flipping resets the multiplier to ×1 — that is what a flip costs.',
      ],
      controls: [
        { keys: 'SPACE / click', touchKeys: 'TAP ANYWHERE', action: 'Flip which wall gravity pulls you toward. Gravity accelerates, so a flip takes time to bite.' },
      ],
      tip: 'Two flips inside about 150ms count as one, so the multiplier survives. It is a tight window, and it lets you adjust your line without paying for it.',
    },
    load: () => import('../games/ballast/index.ts'),
  },
]

export function findGame(id: string): GameDefinition | undefined {
  return GAMES.find((game) => game.id === id)
}
