// Feature: domestic-track-mvp, Property 4: CSIS eligibility AND
//
// Validates: Requirements 6.2, 6.4, 6.6, 6.7
//
// `computeCsisEligible(familyAnnualIncomeINR, isNotifiedForCSIS)` returns
// `eligible === true` if and only if BOTH:
//   1. familyAnnualIncomeINR < 450_000 (strict, per Req 6.2)
//   2. isNotifiedForCSIS === true
//
// When either input is missing the result is ineligible with a structured
// reason. When both inputs are present and at least one fails, the reason
// classifies the failing condition (`'income'`, `'institute'`, or `'both'`).

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  CSIS_INCOME_CEILING_INR,
  computeCsisEligible,
} from '../../src/lib/csis'

describe('Property 4: CSIS eligibility is conjunction of income < ceiling AND isNotifiedForCSIS', () => {
  it('AND truth-table over the income×notified domain', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5_000_000 }),
        fc.boolean(),
        (income, isNotified) => {
          const out = computeCsisEligible(income, isNotified)
          const expected = income < CSIS_INCOME_CEILING_INR && isNotified
          if (out.eligible !== expected) return false
          if (expected) return out.reason === 'ok'
          // Ineligible when both inputs are present should never report a
          // "missing-*" reason.
          return out.reason !== 'missing-income' && out.reason !== 'missing-institute'
        },
      ),
      { numRuns: 200 },
    )
  })

  it('boundary cases at the ₹4.5 lakh ceiling (strict <)', () => {
    // Both notified=true and notified=false to cover both axes.
    expect(computeCsisEligible(0, true)).toEqual({ eligible: true, reason: 'ok' })
    expect(computeCsisEligible(449_999, true)).toEqual({ eligible: true, reason: 'ok' })
    // Strict less-than: 450_000 itself is NOT eligible.
    expect(computeCsisEligible(450_000, true)).toEqual({ eligible: false, reason: 'income' })
    expect(computeCsisEligible(450_001, true)).toEqual({ eligible: false, reason: 'income' })

    expect(computeCsisEligible(0, false)).toEqual({ eligible: false, reason: 'institute' })
    expect(computeCsisEligible(449_999, false)).toEqual({ eligible: false, reason: 'institute' })
    expect(computeCsisEligible(450_000, false)).toEqual({ eligible: false, reason: 'both' })
    expect(computeCsisEligible(450_001, false)).toEqual({ eligible: false, reason: 'both' })
  })

  it('missing-income reason: undefined income → reason=missing-income regardless of notified', () => {
    expect(computeCsisEligible(undefined, true)).toEqual({
      eligible: false,
      reason: 'missing-income',
    })
    expect(computeCsisEligible(undefined, false)).toEqual({
      eligible: false,
      reason: 'missing-income',
    })
  })

  it('missing-institute reason: undefined notified flag with present income', () => {
    expect(computeCsisEligible(100_000, undefined)).toEqual({
      eligible: false,
      reason: 'missing-institute',
    })
    expect(computeCsisEligible(500_000, undefined)).toEqual({
      eligible: false,
      reason: 'missing-institute',
    })
  })

  it('missing-income takes precedence when both inputs are missing', () => {
    expect(computeCsisEligible(undefined, undefined)).toEqual({
      eligible: false,
      reason: 'missing-income',
    })
  })

  it('failing-reason classification: income/institute/both', () => {
    // Only income fails.
    expect(computeCsisEligible(600_000, true).reason).toBe('income')
    // Only institute fails.
    expect(computeCsisEligible(100_000, false).reason).toBe('institute')
    // Both fail.
    expect(computeCsisEligible(600_000, false).reason).toBe('both')
  })
})
