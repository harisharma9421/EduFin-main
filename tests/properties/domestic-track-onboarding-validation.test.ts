// Feature: domestic-track-mvp, Property 11: Step 5 validation; Property 12: domesticExamScoreMissing flag
//
// Validates: Requirements 3.5, 3.6, 3.7, 3.8
//
// Property 11 (Step 5 validation): for any numeric input, validateStep5
// rejects exactly the inputs whose values violate the documented bounds:
//   - jeeAdvancedRank, gateRank present and <= 0  -> rejected
//   - catPercentile present and outside [0, 100]  -> rejected
//   - gateScoreYear present and outside [currentYear - 4, currentYear] -> rejected
//   - empty input (all fields undefined)          -> accepted
//
// Property 12 (domesticExamScoreMissing flag): the flag is true iff the
// active track is 'domestic' or 'both' AND every primary score field
// (jeeAdvancedRank, gateScore, catPercentile) is undefined.

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  computeDomesticExamScoreMissing,
  validateStep5,
} from '../../src/lib/onboardingValidation'
import type { Track } from '../../src/lib/types'

const FIXED_YEAR = 2025

describe('Property 11: Step 5 validation', () => {
  it('empty input is always accepted with no errors', () => {
    const result = validateStep5({}, FIXED_YEAR)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('rejects non-positive JEE Advanced rank', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 0 }), (rank) => {
        const r = validateStep5({ jeeAdvancedRank: rank }, FIXED_YEAR)
        return r.ok === false && typeof r.errors.jeeAdvancedRank === 'string'
      }),
      { numRuns: 100 },
    )
  })

  it('accepts positive JEE Advanced rank when other fields are undefined', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), (rank) => {
        const r = validateStep5({ jeeAdvancedRank: rank }, FIXED_YEAR)
        return r.ok === true && r.errors.jeeAdvancedRank === undefined
      }),
      { numRuns: 100 },
    )
  })

  it('rejects non-positive GATE rank', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 0 }), (rank) => {
        const r = validateStep5({ gateRank: rank }, FIXED_YEAR)
        return r.ok === false && typeof r.errors.gateRank === 'string'
      }),
      { numRuns: 100 },
    )
  })

  it('accepts positive GATE rank when other fields are undefined', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), (rank) => {
        const r = validateStep5({ gateRank: rank }, FIXED_YEAR)
        return r.ok === true && r.errors.gateRank === undefined
      }),
      { numRuns: 100 },
    )
  })

  it('CAT percentile is rejected iff outside [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.float({
          min: -50,
          max: 200,
          noNaN: true,
          noDefaultInfinity: true,
        }),
        (v) => {
          const r = validateStep5({ catPercentile: v }, FIXED_YEAR)
          const shouldReject = v < 0 || v > 100
          return shouldReject
            ? r.ok === false && typeof r.errors.catPercentile === 'string'
            : r.ok === true && r.errors.catPercentile === undefined
        },
      ),
      { numRuns: 200 },
    )
  })

  it('GATE score year is accepted iff in [currentYear - 4, currentYear]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2000, max: 2100 }), (year) => {
        const r = validateStep5({ gateScoreYear: year }, FIXED_YEAR)
        const inWindow = year >= FIXED_YEAR - 4 && year <= FIXED_YEAR
        return inWindow
          ? r.ok === true && r.errors.gateScoreYear === undefined
          : r.ok === false && typeof r.errors.gateScoreYear === 'string'
      }),
      { numRuns: 200 },
    )
  })
})

describe('Property 12: domesticExamScoreMissing flag', () => {
  const optionalNumber = fc.option(fc.integer({ min: 1, max: 1_000_000 }), {
    nil: undefined,
  })

  it("returns false for track='abroad' regardless of scores", () => {
    fc.assert(
      fc.property(
        optionalNumber,
        optionalNumber,
        optionalNumber,
        (jee, gate, cat) => {
          const result = computeDomesticExamScoreMissing('abroad', {
            jeeAdvancedRank: jee,
            gateScore: gate,
            catPercentile: cat,
          })
          return result === false
        },
      ),
      { numRuns: 100 },
    )
  })

  it("returns true iff every primary score is undefined for track='domestic' | 'both'", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Track>('domestic', 'both'),
        optionalNumber,
        optionalNumber,
        optionalNumber,
        (track, jee, gate, cat) => {
          const result = computeDomesticExamScoreMissing(track, {
            jeeAdvancedRank: jee,
            gateScore: gate,
            catPercentile: cat,
          })
          const expected =
            jee === undefined && gate === undefined && cat === undefined
          return result === expected
        },
      ),
      { numRuns: 200 },
    )
  })
})
