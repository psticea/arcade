import type { GameDefinition } from '../lib/types.ts'

/**
 * The cabinet line-up.
 *
 * Every game is loaded dynamically so the shell stays small and a game's code
 * only downloads when someone chooses to play it.
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
    load: () => import('../games/coil/index.ts'),
  },
  {
    id: 'descent',
    name: 'DESCENT',
    tagline: 'No instruments. The world turns, not you.',
    arrows: 'â† â†’ rotate Â· â†‘ thrust Â· â†“ survey',
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
    load: () => import('../games/descent/index.ts'),
  },
  {
    id: 'lumen',
    name: 'LUMEN',
    tagline: 'Light rises from the well. Catch it before it leaves.',
    arrows: 'â† â†’ crawl the rim Â· â†‘ dive Â· â†“ gather',
    space: 'BLOOM',
    accent: '#00fff2',
    modes: [
      { id: 'standard', name: 'THE WELL', description: 'Keep the tunnel lit for as long as you can.' },
    ],
    touchKeys: ['left', 'right', 'up', 'down', 'space'],
    actionLabel: 'BLOOM',
    load: () => import('../games/lumen/index.ts'),
  },
  {
    id: 'glassworks',
    name: 'GLASSWORKS',
    tagline: 'A table that rebuilds itself beneath the ball.',
    arrows: 'â† â†’ flippers Â· â†‘ â†“ divert',
    space: 'plunger, then NUDGE',
    accent: '#ff5ce1',
    modes: [
      { id: 'standard', name: 'THREE BALLS', description: 'Complete missions. Survive the rebuilds.' },
    ],
    touchKeys: ['left', 'right', 'up', 'down', 'space'],
    actionLabel: 'PLUNGE',
    load: () => import('../games/glassworks/index.ts'),
  },
  {
    id: 'ballast',
    name: 'BALLAST',
    tagline: 'The stone is where the money is.',
    arrows: 'â€”  (this one needs no arrows)',
    space: 'FLIP gravity',
    accent: '#7cf5c0',
    modes: [
      { id: 'standard', name: 'DESCENT', description: 'Sink. Ride the masonry. Do not touch it.' },
    ],
    touchKeys: ['space'],
    actionLabel: 'FLIP',
    load: () => import('../games/ballast/index.ts'),
  },
]

export function findGame(id: string): GameDefinition | undefined {
  return GAMES.find((game) => game.id === id)
}
