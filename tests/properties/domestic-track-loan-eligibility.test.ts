// Feature: domestic-track-mvp, Property 7: loan eligibility tri-state derivation
//
// Validates: Requirements 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9
//
// `evaluateLoanProduct(profile, product)` returns one of three statuses:
//   - 'Eligible'                — every required criterion passes
//   - 'Not_Eligible'            — at least one required criterion has a
//                                 present input that fails its predicate
//   - 'Conditionally_Eligible'  — at least one required criterion's input
//                                 is missing AND no present input has failed
//
// Truth table (mutually exclusive & exhaustive):
//   unmatched.length > 0                                 → Not_Eligible
//   unmatched.length === 0 && missing.length > 0         → Conditionally_Eligible
//   unmatched.length === 0 && missing.length === 0       → Eligible

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  domesticLoanProducts,
  evaluateLoanProduct,
  parseFamilyIncome,
} from '../../src/lib/domesticLoan'
import { domesticUniversities } from '../../src/lib/mock-data'

const STATUSES = ['Eligible', 'Not_Eligible', 'Conditionally_Eligible'] as const

const FAMILY_INCOME_BUCKETS = [
  'Below 3L',
  '3L – 6L',
  '6L – 10L',
  '10L – 20L',
  '20L+',
] as const

const REAL_INSTITUTE_IDS = domesticUniversities.map((u) => u.id)

// Generator: partial profile with each input field independently either
// undefined or a generated value. `targetInstituteId` mixes valid mock-data
// ids with arbitrary strings so we exercise both the premier-list hit and
// miss paths.
const profileArb = fc.record({
  familyAnnualIncomeINR: fc.option(
    fc.integer({ min: 0, max: 5_000_000 }),
    { nil: undefined },
  ),
  familyIncomeStr: fc.option(fc.constantFrom(...FAMILY_INCOME_BUCKETS), {
    nil: undefined,
  }),
  coApplicantStr: fc.option(fc.constantFrom('Yes', 'No'), { nil: undefined }),
  collateralAvailableStr: fc.option(
    fc.constantFrom('Yes', 'No', 'Not Sure'),
    { nil: undefined },
  ),
  targetInstituteId: fc.option(
    fc.oneof(fc.constantFrom(...REAL_INSTITUTE_IDS), fc.string()),
    { nil: undefined },
  ),
})

describe('Property 7: loan eligibility tri-state derivation', () => {
  it('(a) tri-state exclusivity and exhaustiveness across all (product, profile) pairs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...domesticLoanProducts),
        profileArb,
        (product, profile) => {
          const out = evaluateLoanProduct(profile, product)

          // Exhaustiveness: status is one of the three.
          if (!STATUSES.includes(out.status)) return false

          // Truth-table consistency.
          if (out.unmatched.length > 0) {
            return out.status === 'Not_Eligible'
          }
          if (out.missing.length > 0) {
            return out.status === 'Conditionally_Eligible'
          }
          return out.status === 'Eligible'
        },
      ),
      { numRuns: 200 },
    )
  })

  // ── Concrete examples: SBI Scholar (premierInstituteRequired) ──────────
  describe('(b) SBI Scholar — premierInstituteRequired', () => {
    const sbi = domesticLoanProducts.find((p) => p.id === 'sbi-scholar')!

    it('Eligible when targetInstituteId is in the premier list (isb-pgp)', () => {
      const out = evaluateLoanProduct({ targetInstituteId: 'isb-pgp' }, sbi)
      expect(out.status).toBe('Eligible')
      expect(out.matched).toEqual(['Premier institute target'])
      expect(out.unmatched).toEqual([])
      expect(out.missing).toEqual([])
    })

    it('Not_Eligible when targetInstituteId is not in the premier list (nit-calicut-cse)', () => {
      const out = evaluateLoanProduct(
        { targetInstituteId: 'nit-calicut-cse' },
        sbi,
      )
      expect(out.status).toBe('Not_Eligible')
      expect(out.unmatched).toEqual(['Premier institute target'])
      expect(out.matched).toEqual([])
      expect(out.missing).toEqual([])
    })

    it('Conditionally_Eligible when targetInstituteId is missing', () => {
      const out = evaluateLoanProduct({}, sbi)
      expect(out.status).toBe('Conditionally_Eligible')
      expect(out.missing).toEqual(['Premier institute target'])
      expect(out.matched).toEqual([])
      expect(out.unmatched).toEqual([])
    })
  })

  // ── Concrete examples: Vidya Lakshmi (maxFamilyAnnualIncomeINR=450_000) ─
  describe('(c) Vidya Lakshmi — maxFamilyAnnualIncomeINR = 450_000', () => {
    const vl = domesticLoanProducts.find((p) => p.id === 'vidya-lakshmi')!

    it('Eligible at familyAnnualIncomeINR = 300_000', () => {
      const out = evaluateLoanProduct(
        { familyAnnualIncomeINR: 300_000 },
        vl,
      )
      expect(out.status).toBe('Eligible')
    })

    it('Not_Eligible at familyAnnualIncomeINR = 600_000', () => {
      const out = evaluateLoanProduct(
        { familyAnnualIncomeINR: 600_000 },
        vl,
      )
      expect(out.status).toBe('Not_Eligible')
    })

    it('Conditionally_Eligible when both income inputs are undefined', () => {
      const out = evaluateLoanProduct({}, vl)
      expect(out.status).toBe('Conditionally_Eligible')
    })
  })

  // ── Concrete examples: PNB Saraswati (collateral AND co-applicant) ─────
  describe('(d) PNB Saraswati — collateralRequired AND coApplicantRequired', () => {
    const pnb = domesticLoanProducts.find((p) => p.id === 'pnb-saraswati')!

    it('Eligible when both collateral and co-applicant are Yes', () => {
      const out = evaluateLoanProduct(
        { coApplicantStr: 'Yes', collateralAvailableStr: 'Yes' },
        pnb,
      )
      expect(out.status).toBe('Eligible')
      expect(out.matched).toEqual(
        expect.arrayContaining(['Co-applicant', 'Collateral']),
      )
    })

    it('Not_Eligible when one is No', () => {
      const out = evaluateLoanProduct(
        { coApplicantStr: 'Yes', collateralAvailableStr: 'No' },
        pnb,
      )
      expect(out.status).toBe('Not_Eligible')
    })

    it('Conditionally_Eligible when one is Yes and the other is undefined', () => {
      const out = evaluateLoanProduct(
        { coApplicantStr: 'Yes' },
        pnb,
      )
      expect(out.status).toBe('Conditionally_Eligible')
      expect(out.missing).toEqual(['Collateral'])
    })

    it('Conditionally_Eligible when both are undefined', () => {
      const out = evaluateLoanProduct({}, pnb)
      expect(out.status).toBe('Conditionally_Eligible')
      expect(out.missing).toEqual(
        expect.arrayContaining(['Co-applicant', 'Collateral']),
      )
    })
  })

  // ── parseFamilyIncome unit tests ───────────────────────────────────────
  describe('(e) parseFamilyIncome', () => {
    it('returns the conservative upper bound for each onboarding bucket', () => {
      expect(parseFamilyIncome('Below 3L')).toBe(300_000)
      expect(parseFamilyIncome('3L – 6L')).toBe(600_000)
      expect(parseFamilyIncome('6L – 10L')).toBe(1_000_000)
      expect(parseFamilyIncome('10L – 20L')).toBe(2_000_000)
      expect(parseFamilyIncome('20L+')).toBe(5_000_000)
    })

    it('returns numeric input as-is', () => {
      expect(parseFamilyIncome(450_000)).toBe(450_000)
      expect(parseFamilyIncome(0)).toBe(0)
    })

    it('returns undefined for null and undefined', () => {
      expect(parseFamilyIncome(undefined)).toBeUndefined()
      expect(parseFamilyIncome(null)).toBeUndefined()
    })

    it('parses arbitrary numeric strings (with currency markers and commas)', () => {
      expect(parseFamilyIncome('450000')).toBe(450_000)
      expect(parseFamilyIncome('₹3,00,000')).toBe(300_000)
    })

    it('parses lakh-suffixed strings by multiplying by 1e5', () => {
      expect(parseFamilyIncome('4.5L')).toBe(450_000)
      expect(parseFamilyIncome('4.5l')).toBe(450_000)
      expect(parseFamilyIncome('10L')).toBe(1_000_000)
    })

    it('returns undefined for unparseable strings', () => {
      expect(parseFamilyIncome('')).toBeUndefined()
      expect(parseFamilyIncome('not a number')).toBeUndefined()
      expect(parseFamilyIncome('.')).toBeUndefined()
    })
  })
})
