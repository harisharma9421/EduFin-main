// Feature: domestic-track-mvp, Property 3: classifyDataset partitions input set
//
// Validates: Requirements 4.5, 4.7
//
// For any dataset (subset of `domesticUniversities`) and any profile, the
// union of the four bucket arrays equals the input dataset (id-set equality)
// AND the four arrays are pairwise disjoint by record `id`. Additionally:
//   - When the profile has no populated exam scores at all, every record
//     lands in `Out_Of_Range` (Req 4.5).
//   - Concrete examples confirm the threshold thresholds against known mock
//     records (a JEE_Advanced IIT and a CAT IIM).

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { classifyDataset } from '../../src/lib/domesticPredictor'
import { domesticUniversities } from '../../src/lib/mock-data'
import type { ReservationCategory } from '../../src/lib/types'

const RESERVATION_CATEGORIES: ReservationCategory[] = [
  'General',
  'OBC-NCL',
  'EWS',
  'SC',
  'ST',
  'PwD',
]

// Generator: a profile with each scoring field independently either present
// or undefined, plus an optional reservation category.
const profileArb = fc.record({
  jeeAdvancedRank: fc.option(fc.integer({ min: 1, max: 500_000 }), { nil: undefined }),
  gateRank: fc.option(fc.integer({ min: 1, max: 500_000 }), { nil: undefined }),
  catPercentile: fc.option(
    fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    { nil: undefined },
  ),
  reservationCategory: fc.option(fc.constantFrom(...RESERVATION_CATEGORIES), {
    nil: undefined,
  }),
})

// Generator: any subset of domesticUniversities (including empty), as a
// deduplicated array preserving the dataset's id uniqueness invariant.
const datasetArb = fc
  .subarray(domesticUniversities, { minLength: 0, maxLength: domesticUniversities.length })

describe('Property 3: classifyDataset partitions input set', () => {
  it('(a) partition completeness: union(buckets) == dataset and pairwise disjoint by id', () => {
    fc.assert(
      fc.property(profileArb, datasetArb, (profile, dataset) => {
        const out = classifyDataset(profile, dataset)
        const inputIds = dataset.map((r) => r.id).sort()
        const bucketIds = [
          ...out.Reach,
          ...out.Match,
          ...out.Safety,
          ...out.Out_Of_Range,
        ]
          .map((r) => r.id)
          .sort()

        // Multiset / id-set equality.
        if (inputIds.length !== bucketIds.length) return false
        for (let i = 0; i < inputIds.length; i++) {
          if (inputIds[i] !== bucketIds[i]) return false
        }

        // Pairwise disjoint by id.
        const seen = new Set<string>()
        for (const r of [
          ...out.Reach,
          ...out.Match,
          ...out.Safety,
          ...out.Out_Of_Range,
        ]) {
          if (seen.has(r.id)) return false
          seen.add(r.id)
        }
        return true
      }),
      { numRuns: 100 },
    )
  })

  it('(b) Out_Of_Range fallback: a profile with no exam scores classifies every record as Out_Of_Range', () => {
    fc.assert(
      fc.property(
        datasetArb,
        fc.option(fc.constantFrom(...RESERVATION_CATEGORIES), { nil: undefined }),
        (dataset, reservationCategory) => {
          const out = classifyDataset(
            {
              jeeAdvancedRank: undefined,
              gateRank: undefined,
              catPercentile: undefined,
              reservationCategory,
            },
            dataset,
          )
          if (out.Reach.length !== 0) return false
          if (out.Match.length !== 0) return false
          if (out.Safety.length !== 0) return false
          return out.Out_Of_Range.length === dataset.length
        },
      ),
      { numRuns: 100 },
    )
  })

  it('(c) concrete example — JEE_Advanced IIT Bombay CSE: a strong rank lands in Safety', () => {
    const iitb = domesticUniversities.find((r) => r.id === 'iitb-cse')
    expect(iitb).toBeDefined()
    if (!iitb) return
    // closingRank.General = 68; user rank 30 ≤ 68 * 0.70 → Safety.
    const out = classifyDataset(
      { jeeAdvancedRank: 30, reservationCategory: 'General' },
      [iitb],
    )
    expect(out.Safety.map((r) => r.id)).toEqual(['iitb-cse'])
    expect(out.Reach).toEqual([])
    expect(out.Match).toEqual([])
    expect(out.Out_Of_Range).toEqual([])
  })

  it('(c) concrete example — CAT IIM Ahmedabad PGP: a high percentile lands in Safety', () => {
    const iimA = domesticUniversities.find((r) => r.id === 'iim-a-pgp')
    expect(iimA).toBeDefined()
    if (!iimA) return
    // closingPct.General is around 99.5; we need user >= closingPct + 5,
    // which is impossible at the General cutoff — so use SC where the cutoff
    // is well below the +5 ceiling.
    const out = classifyDataset(
      { catPercentile: 99.9, reservationCategory: 'SC' },
      [iimA],
    )
    expect(out.Safety.map((r) => r.id)).toEqual(['iim-a-pgp'])
    expect(out.Reach).toEqual([])
    expect(out.Match).toEqual([])
    expect(out.Out_Of_Range).toEqual([])
  })
})
