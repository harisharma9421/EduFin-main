// Feature: domestic-track-mvp, Property 13: EMI delta with CSIS is non-negative
//
// Validates: Requirements 9.3, 9.4, 9.5
//
// `effectiveEmi(principal, ratePct, tenureMonths, csisOn, csisEligible, moratoriumMonths)`
// is the helper consumed by `EMICalculator.tsx`'s "With CSIS / Without CSIS"
// dual-column display. Property 13 nails down four invariants:
//
//   (a) When the user is CSIS-eligible, turning the toggle ON can only LOWER
//       the EMI vs. OFF — the delta `off - on` is always >= 0 (Req 9.3).
//   (b) When the user is NOT CSIS-eligible, the toggle is a no-op: ON and
//       OFF produce identical EMIs (Req 9.4).
//   (c) When the toggle is OFF, the function bypasses the subsidy regardless
//       of eligibility — output equals the plain amortizing `computeEmi`
//       (Req 9.5 abroad-track parity).
//   (d) The concrete delta matches the closed-form simple-interest formula
//       on the moratorium period spread across the full tenure.
//
// All tests are PURE: no React, no Zustand, no DOM.

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { computeCsisSavings, computeEmi, effectiveEmi } from '../../src/lib/csis'

describe('Property 13: EMI delta under CSIS is non-negative', () => {
  it('(a) eligible: turning CSIS ON never increases the EMI vs. OFF', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1_000), max: Math.fround(10_000_000), noNaN: true }),
        fc.float({ min: Math.fround(0.5), max: Math.fround(20), noNaN: true }),
        fc.integer({ min: 12, max: 240 }),
        fc.integer({ min: 0, max: 60 }),
        (p, r, t, m) => {
          const off = effectiveEmi(p, r, t, false, true, m)
          const on = effectiveEmi(p, r, t, true, true, m)
          // Float arithmetic tolerance for the inequality.
          return Number.isFinite(off) && Number.isFinite(on) && off + 1e-6 >= on
        },
      ),
      { numRuns: 200 },
    )
  })

  it('(b) ineligible: toggle ON equals toggle OFF (no subsidy applied)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1_000), max: Math.fround(10_000_000), noNaN: true }),
        fc.float({ min: Math.fround(0.5), max: Math.fround(20), noNaN: true }),
        fc.integer({ min: 12, max: 240 }),
        fc.integer({ min: 0, max: 60 }),
        (p, r, t, m) => {
          const on = effectiveEmi(p, r, t, true, false, m)
          const off = effectiveEmi(p, r, t, false, false, m)
          return on === off
        },
      ),
      { numRuns: 100 },
    )
  })

  it('(c) toggle OFF bypasses the subsidy: output equals plain computeEmi', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1_000), max: Math.fround(10_000_000), noNaN: true }),
        fc.float({ min: Math.fround(0.5), max: Math.fround(20), noNaN: true }),
        fc.integer({ min: 12, max: 240 }),
        fc.integer({ min: 0, max: 60 }),
        (p, r, t, m) => {
          // csisOn=false ignores csisEligible; both branches must match
          // the plain amortizing EMI.
          const eligibleOff = effectiveEmi(p, r, t, false, true, m)
          const ineligibleOff = effectiveEmi(p, r, t, false, false, m)
          const base = computeEmi(p, r, t)
          return eligibleOff === base && ineligibleOff === base
        },
      ),
      { numRuns: 100 },
    )
  })

  it('(d) concrete delta matches simple-interest moratorium / tenure', () => {
    const principal = 1_000_000
    const ratePct = 10
    const tenureMonths = 120
    const moratoriumMonths = 12

    const off = effectiveEmi(principal, ratePct, tenureMonths, false, true, moratoriumMonths)
    const on = effectiveEmi(principal, ratePct, tenureMonths, true, true, moratoriumMonths)

    // Closed-form: simple-interest savings spread evenly across the tenure.
    const savings = computeCsisSavings(true, principal, ratePct, moratoriumMonths)
    const expectedDelta = savings / tenureMonths

    expect(off - on).toBeCloseTo(expectedDelta, 6)
    // Sanity: savings === 1_000_000 * 0.10 * (12/12) = 100_000 → 833.33/mo.
    expect(savings).toBeCloseTo(100_000, 6)
    expect(expectedDelta).toBeCloseTo(833.3333333, 4)
  })
})
