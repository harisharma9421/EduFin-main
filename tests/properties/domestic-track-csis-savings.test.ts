// Feature: domestic-track-mvp, Property 5: CSIS savings monotone in inputs and zero when ineligible
//
// Validates: Requirements 6.3, 6.4, 6.8, 6.9
//
// `computeCsisSavings(eligible, principal, rate, months)` satisfies:
//   1. When `eligible === false`, the result is exactly 0 regardless of the
//      other (non-negative) inputs (Req 6.4).
//   2. When `eligible === true` AND any one of (principal, rate, months) is
//      zero, the result is exactly 0 (Req 6.9).
//   3. When `eligible === true`, the result is component-wise monotone
//      non-decreasing in (principal, rate, months) (Req 6.3).
//   4. A negative input on any axis yields `NaN` (Req 6.8 defense-in-depth).

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { computeCsisSavings } from '../../src/lib/csis'

describe('Property 5: CSIS savings monotonicity + zero on ineligible', () => {
  it('zero on ineligible: any non-negative inputs yield exactly 0', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0), max: Math.fround(1e8), noNaN: true }),
        fc.float({ min: Math.fround(0), max: Math.fround(30), noNaN: true }),
        fc.integer({ min: 0, max: 60 }),
        (p, r, m) => computeCsisSavings(false, p, r, m) === 0,
      ),
      { numRuns: 200 },
    )
  })

  it('zero when eligible but any factor is zero', () => {
    expect(computeCsisSavings(true, 0, 10, 12)).toBe(0)
    expect(computeCsisSavings(true, 1_000_000, 0, 12)).toBe(0)
    expect(computeCsisSavings(true, 1_000_000, 10, 0)).toBe(0)
  })

  it('component-wise monotone non-decreasing when eligible', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.float({ min: Math.fround(0), max: Math.fround(1e8), noNaN: true }),
          fc.float({ min: Math.fround(0), max: Math.fround(30), noNaN: true }),
          fc.integer({ min: 0, max: 60 }),
          fc.float({ min: Math.fround(0), max: Math.fround(1e8), noNaN: true }),
          fc.float({ min: Math.fround(0), max: Math.fround(30), noNaN: true }),
          fc.integer({ min: 0, max: 60 }),
        ),
        ([p1, r1, m1, dp, dr, dm]) => {
          const a = computeCsisSavings(true, p1, r1, m1)
          const b = computeCsisSavings(true, p1 + dp, r1 + dr, m1 + dm)
          // Float arithmetic tolerance for the inequality.
          return Number.isFinite(a) && Number.isFinite(b) && b + 1e-6 >= a
        },
      ),
      { numRuns: 200 },
    )
  })

  it('negative input on any axis yields NaN', () => {
    expect(Number.isNaN(computeCsisSavings(true, -1, 10, 12))).toBe(true)
    expect(Number.isNaN(computeCsisSavings(true, 1_000_000, -1, 12))).toBe(true)
    expect(Number.isNaN(computeCsisSavings(true, 1_000_000, 10, -1))).toBe(true)
    // Negative input takes precedence over the eligibility short-circuit so
    // the calculator surfaces the validation error instead of silently
    // returning 0.
    expect(Number.isNaN(computeCsisSavings(false, -1, 10, 12))).toBe(true)
  })
})
