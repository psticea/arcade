# Word Fall

A fast-paced typing game where words fall from the sky — type them before they reach the bottom to make them explode. Words get longer and faster as you survive.

## How to Play

1. Words fall from the top of the screen
2. Type a word to target it — matched characters glow cyan
3. Complete the word to trigger a neon particle explosion
4. Build combos by typing consecutive words without missing
5. You have 3 lives — each word that reaches the bottom costs one

## Scoring

- **Base points**: word length × 10
- **Combo multiplier**: consecutive words boost your score (up to ×6)
- **Level bonus**: higher difficulty tiers multiply all points
- **Miss penalty**: combo resets + small score deduction

## Difficulty

Every 30 seconds the difficulty increases:

| Level | Tier | Word Length | Speed |
|-------|------|-------------|-------|
| 0 | EASY | 3–4 chars | Slow |
| 1 | MEDIUM | 4–6 chars | Medium |
| 2 | HARD | 5–8 chars | Fast |
| 3+ | EXPERT | 7–10 chars | Very Fast |

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run tests |

## Tech Stack

- React 19 + TypeScript
- Vite
- HTML Canvas for rendering
- Vitest for testing
