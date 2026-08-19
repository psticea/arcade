/**
 * High scores in `localStorage`. Nothing leaves the device.
 *
 * Scores are keyed by game and mode so COIL's 60-second sprint and its endless
 * run keep separate boards.
 */

export interface ScoreEntry {
  initials: string
  score: number
  date: string
}

const STORAGE_KEY = 'arcade.scores.v1'
const MAX_ENTRIES = 8

type ScoreTable = Record<string, ScoreEntry[]>

function boardKey(gameId: string, modeId: string): string {
  return `${gameId}:${modeId}`
}

function readTable(storage: Storage): ScoreTable {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as ScoreTable
  } catch {
    return {}
  }
}

function writeTable(storage: Storage, table: ScoreTable): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(table))
  } catch {
    // Storage can be unavailable in private mode; scores are best-effort.
  }
}

export function getScores(storage: Storage, gameId: string, modeId: string): ScoreEntry[] {
  const table = readTable(storage)
  return table[boardKey(gameId, modeId)] ?? []
}

export function getBestScore(storage: Storage, gameId: string, modeId: string): number {
  return getScores(storage, gameId, modeId)[0]?.score ?? 0
}

/** True when this score would make the board — used to decide whether to ask for initials. */
export function qualifies(storage: Storage, gameId: string, modeId: string, score: number): boolean {
  if (score <= 0) return false
  const entries = getScores(storage, gameId, modeId)
  if (entries.length < MAX_ENTRIES) return true
  const lowest = entries[entries.length - 1]
  return lowest === undefined || score > lowest.score
}

export function submitScore(
  storage: Storage,
  gameId: string,
  modeId: string,
  entry: ScoreEntry,
): ScoreEntry[] {
  const table = readTable(storage)
  const key = boardKey(gameId, modeId)
  const entries = [...(table[key] ?? []), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES)
  table[key] = entries
  writeTable(storage, table)
  return entries
}
