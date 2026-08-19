import { describe, it, expect } from 'vitest'
import { createRng, dailySeed, hashSeed, splitmix32, sfc32 } from '../lib/prng.ts'

describe('prng', () => {
  it('produces identical streams for identical seeds', () => {
    const a = createRng(12345)
    const b = createRng(12345)
    const left = Array.from({ length: 64 }, () => a.next())
    const right = Array.from({ length: 64 }, () => b.next())
    expect(left).toEqual(right)
  })

  it('produces different streams for different seeds', () => {
    const a = createRng(1)
    const b = createRng(2)
    const left = Array.from({ length: 32 }, () => a.next())
    const right = Array.from({ length: 32 }, () => b.next())
    expect(left).not.toEqual(right)
  })

  it('stays within [0,1)', () => {
    const rng = createRng(99)
    for (let i = 0; i < 5000; i++) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('int() respects inclusive bounds', () => {
    const rng = createRng(7)
    const seen = new Set<number>()
    for (let i = 0; i < 3000; i++) {
      const value = rng.int(3, 6)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(3)
      expect(value).toBeLessThanOrEqual(6)
      seen.add(value)
    }
    expect(seen).toEqual(new Set([3, 4, 5, 6]))
  })

  it('range() respects bounds', () => {
    const rng = createRng(11)
    for (let i = 0; i < 2000; i++) {
      const value = rng.range(-5, 5)
      expect(value).toBeGreaterThanOrEqual(-5)
      expect(value).toBeLessThan(5)
    }
  })

  it('distributes roughly uniformly', () => {
    const rng = createRng(4242)
    const buckets = new Array(10).fill(0)
    const samples = 100000
    for (let i = 0; i < samples; i++) buckets[Math.floor(rng.next() * 10)] += 1
    for (const count of buckets) {
      expect(count).toBeGreaterThan(samples / 10 * 0.9)
      expect(count).toBeLessThan(samples / 10 * 1.1)
    }
  })

  it('hashSeed is stable and differentiates strings', () => {
    expect(hashSeed('arcade')).toBe(hashSeed('arcade'))
    expect(hashSeed('arcade')).not.toBe(hashSeed('arcada'))
  })

  it('dailySeed is stable within a day and changes across days', () => {
    const monday = new Date('2026-08-17T04:00:00Z')
    const mondayLater = new Date('2026-08-17T23:30:00Z')
    const tuesday = new Date('2026-08-18T04:00:00Z')
    expect(dailySeed(monday)).toBe(dailySeed(mondayLater))
    expect(dailySeed(monday)).not.toBe(dailySeed(tuesday))
  })

  it('splitmix32 and sfc32 are deterministic', () => {
    const s1 = splitmix32(42)
    const s2 = splitmix32(42)
    expect([s1(), s1(), s1()]).toEqual([s2(), s2(), s2()])

    const f1 = sfc32(1, 2, 3, 4)
    const f2 = sfc32(1, 2, 3, 4)
    expect([f1(), f1(), f1()]).toEqual([f2(), f2(), f2()])
  })
})
