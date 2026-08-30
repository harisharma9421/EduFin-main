// Feature: domestic-track-mvp, Property 2: classifyRecord is monotone in rank/percentile
//
// Validates: Requirements 4.2, 4.3, 4.4
//
// For any domestic university record `r` and any reservation category `c`:
//   - JEE_Advanced / GATE: improving the user's rank (lowering it; lower is
//     better) cannot move the bucket toward a worse classification, where
//     bucket order is `Safety > Match > Reach > Out_Of_Range`.
//   - CAT: improving the user's percentile (raising it; higher is better)
//     cannot move the bucket toward a worse classification.
//
// We assert the property at three layers:
//   (a) `bucketByRank` directly, over generated (closing, user, delta) tuples.
//   (b) `bucketByPercentile` directly, over generated (closing, user, delta)
//       tuples.
//   (c) End-to-end via `classifyRecord`, picking real records from
//       `domesticUniversities` so the `examType`-routing logic is exercised
//       alongside the threshold logic.

import { describe, it } from 'vitest'
import fc from 'fast-check'

import {
  BUCKET_ORDER,
  bucketByPercentile,
  bucketByRank,
  classifyRecord,
} from '../../src/lib/domesticPredictor'
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

describe('Property 2: classifyRecord is monotone in rank/percentile', () => {
  it('(a) bucketByRank: lowering the rank (improvement) never worsens the bucket', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50_000 }), // closing
        fc.integer({ min: 1, max: 100_000 }), // user1 (worse rank)
        fc.integer({ min: 0, max: 50_000 }), // delta improvement (>=0)
        (closing, user1, delta) => {
          const user2 = Math.max(1, user1 - delta) // user2 is better-or-equal
          const b1 = bucketByRank(user1, closing)
          const b2 = bucketByRank(user2, closing)
          return BUCKET_ORDER[b2] >= BUCKET_ORDER[b1]
        },
      ),
      { numRuns: 200 },
    )
  })

  it('(b) bucketByPercentile: raising the percentile (improvement) never worsens the bucket', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }), // closingPct
        fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }), // user1 (lower)
        fc.float({ min: 0, max: 50, noNaN: true, noDefaultInfinity: true }), // delta (>=0)
        (closing, user1, delta) => {
          const user2 = Math.min(100, user1 + delta) // user2 is better-or-equal
          const b1 = bucketByPercentile(user1, closing)
          const b2 = bucketByPercentile(user2, closing)
          return BUCKET_ORDER[b2] >= BUCKET_ORDER[b1]
        },
      ),
      { numRuns: 200 },
    )
  })

  it('(c) classifyRecord: end-to-end monotonicity over real domestic universities', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...domesticUniversities),
        fc.constantFrom(...RESERVATION_CATEGORIES),
        // Worse value: JEE/GATE rank or CAT percentile (lower).
        fc.integer({ min: 1, max: 200_000 }),
        // Improvement delta (>=0).
        fc.integer({ min: 0, max: 200_000 }),
        (record, cat, baseValue, delta) => {
          if (record.examType === 'CAT') {
            // CAT: percentile in [0, 100]; higher is better.
            const pctWorse = (baseValue % 101) // 0..100
            const pctBetter = Math.min(100, pctWorse + (delta % 101))
            const b1 = classifyRecord(
              { catPercentile: pctWorse, reservationCategory: cat },
              record,
            ).bucket
            const b2 = classifyRecord(
              { catPercentile: pctBetter, reservationCategory: cat },
              record,
            ).bucket
            return BUCKET_ORDER[b2] >= BUCKET_ORDER[b1]
          }
          // JEE_Advanced or GATE: rank is positive integer; lower is better.
          const rankWorse = baseValue
          const rankBetter = Math.max(1, rankWorse - delta)
          if (record.examType === 'JEE_Advanced') {
            const b1 = classifyRecord(
              { jeeAdvancedRank: rankWorse, reservationCategory: cat },
              record,
            ).bucket
            const b2 = classifyRecord(
              { jeeAdvancedRank: rankBetter, reservationCategory: cat },
              record,
            ).bucket
            return BUCKET_ORDER[b2] >= BUCKET_ORDER[b1]
          }
          // GATE
          const b1 = classifyRecord(
            { gateRank: rankWorse, reservationCategory: cat },
            record,
          ).bucket
          const b2 = classifyRecord(
            { gateRank: rankBetter, reservationCategory: cat },
            record,
          ).bucket
          return BUCKET_ORDER[b2] >= BUCKET_ORDER[b1]
        },
      ),
      { numRuns: 200 },
    )
  })
})
