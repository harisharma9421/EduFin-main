// Domestic Admission Predictor — pure classification helpers.
//
// Source of truth:
//   - .kiro/specs/domestic-track-mvp/requirements.md → Req 4 (predictor
//     classification thresholds, reservation-category fallback, sort order,
//     Out_Of_Range fallback).
//   - .kiro/specs/domestic-track-mvp/design.md → "Predictor classification
//     (pseudocode)".
//
// All exported functions are PURE: no I/O, no Date, no Math.random, no React,
// no Zustand. They consume only the bits of `StudentProfile` they need via
// `Pick<StudentProfile, ...>` so they can be tested without constructing a
// full profile.
//
// Convention reminders:
//   - JEE_Advanced and GATE: lower rank is better. A user rank at or below
//     `closingRank * 0.70` is `Safety`; at or below `closingRank * 1.10` is
//     `Match`; otherwise `Reach`.
//   - CAT: higher percentile is better. A user percentile at least 5 points
//     above the closing percentile is `Safety`; within 5 points (inclusive)
//     is `Match`; more than 5 points below is `Reach`.

import type {
  DomesticUniversity,
  ReachMatchSafetyBucket,
  ReservationCategory,
  StudentProfile,
} from './types'

/**
 * Total ordering on the four buckets. Higher = better admission outlook.
 * Used by the property-based monotonicity test (Property 2) and by the
 * predictor UI to surface the best bucket first.
 */
export const BUCKET_ORDER: Record<ReachMatchSafetyBucket, number> = {
  Safety: 3,
  Match: 2,
  Reach: 1,
  Out_Of_Range: 0,
}

export interface ClassificationResult {
  bucket: ReachMatchSafetyBucket
  /** True iff `profile.reservationCategory` was missing and we fell back to General. */
  usedFallbackCategory: boolean
}

export interface ClassifiedDataset {
  Reach: DomesticUniversity[]
  Match: DomesticUniversity[]
  Safety: DomesticUniversity[]
  Out_Of_Range: DomesticUniversity[]
  /** True iff `profile.reservationCategory` was missing at classification time. */
  usedFallbackCategory: boolean
}

/**
 * JEE_Advanced / GATE rank thresholds. Lower rank is better.
 *
 * Req 4.2:
 *   userRank <= closingRank * 0.70 → 'Safety'
 *   userRank <= closingRank * 1.10 → 'Match'
 *   else                            → 'Reach'
 */
export function bucketByRank(
  userRank: number,
  closingRank: number,
): ReachMatchSafetyBucket {
  if (userRank <= closingRank * 0.7) return 'Safety'
  if (userRank <= closingRank * 1.1) return 'Match'
  return 'Reach'
}

/**
 * CAT percentile thresholds. Higher percentile is better.
 *
 * Req 4.4:
 *   userPct >= closingPct + 5 → 'Safety'
 *   userPct >= closingPct - 5 → 'Match'   (inclusive 5-point window)
 *   else                       → 'Reach'
 */
export function bucketByPercentile(
  userPct: number,
  closingPct: number,
): ReachMatchSafetyBucket {
  if (userPct >= closingPct + 5) return 'Safety'
  if (userPct >= closingPct - 5) return 'Match'
  return 'Reach'
}

/**
 * Profile fields the predictor reads. Narrowed via `Pick` so callers can
 * construct minimal test fixtures.
 */
export type PredictorProfile = Pick<
  StudentProfile,
  'jeeAdvancedRank' | 'gateRank' | 'catPercentile' | 'reservationCategory'
>

/**
 * Classifies a single domestic-university record against a profile.
 *
 * Behavior:
 *   - Missing `reservationCategory` falls back to `'General'` and the result
 *     reports `usedFallbackCategory: true` (Req 4.6).
 *   - Missing exam score for the record's `examType` returns `'Out_Of_Range'`
 *     (Req 4.5).
 *   - Otherwise delegates to `bucketByRank` (JEE_Advanced / GATE) or
 *     `bucketByPercentile` (CAT) per Req 4.2–4.4.
 */
export function classifyRecord(
  profile: PredictorProfile,
  record: DomesticUniversity,
): ClassificationResult {
  const cat: ReservationCategory = profile.reservationCategory ?? 'General'
  const usedFallbackCategory = !profile.reservationCategory
  const closing = record.closingRanks[cat]

  switch (record.examType) {
    case 'JEE_Advanced': {
      if (profile.jeeAdvancedRank == null) {
        return { bucket: 'Out_Of_Range', usedFallbackCategory }
      }
      return {
        bucket: bucketByRank(profile.jeeAdvancedRank, closing),
        usedFallbackCategory,
      }
    }
    case 'GATE': {
      if (profile.gateRank == null) {
        return { bucket: 'Out_Of_Range', usedFallbackCategory }
      }
      return {
        bucket: bucketByRank(profile.gateRank, closing),
        usedFallbackCategory,
      }
    }
    case 'CAT': {
      if (profile.catPercentile == null) {
        return { bucket: 'Out_Of_Range', usedFallbackCategory }
      }
      return {
        bucket: bucketByPercentile(profile.catPercentile, closing),
        usedFallbackCategory,
      }
    }
    default:
      // Exhaustiveness guard: any future ExamType lands here until handled.
      return { bucket: 'Out_Of_Range', usedFallbackCategory }
  }
}

/**
 * Per-bucket sort order from Req 4.7:
 *   - For JEE_Advanced and GATE records: ascending `closingRanks[cat]`
 *     (lowest closing rank = most selective = first).
 *   - For CAT records: descending `closingRanks[cat]` (highest closing
 *     percentile = most selective = first).
 *
 * Records in the same bucket may mix exam types in principle (different
 * institutes can land in the same Reach/Match/Safety tier). The comparator
 * groups by exam type first so the per-exam ordering is preserved.
 */
function compareInBucket(
  a: DomesticUniversity,
  b: DomesticUniversity,
  cat: ReservationCategory,
): number {
  if (a.examType !== b.examType) {
    // Stable group order: alphabetical on examType keeps the comparator a
    // total order so `Array.prototype.sort` stays well-defined.
    return a.examType < b.examType ? -1 : 1
  }
  const closingA = a.closingRanks[cat]
  const closingB = b.closingRanks[cat]
  if (a.examType === 'CAT') {
    // Higher percentile first.
    return closingB - closingA
  }
  // Lower rank first.
  return closingA - closingB
}

/**
 * Classifies an entire dataset and groups records by bucket.
 *
 * Properties (verified by `tests/properties/domestic-track-predictor-*`):
 *   - Partition completeness: every input record appears in exactly one
 *     bucket; the disjoint union of the four buckets equals `dataset`.
 *   - Out_Of_Range fallback: when no exam score is present, every record
 *     lands in `Out_Of_Range` (Req 4.5).
 */
export function classifyDataset(
  profile: PredictorProfile,
  dataset: DomesticUniversity[],
): ClassifiedDataset {
  const cat: ReservationCategory = profile.reservationCategory ?? 'General'
  const usedFallbackCategory = !profile.reservationCategory

  const result: ClassifiedDataset = {
    Reach: [],
    Match: [],
    Safety: [],
    Out_Of_Range: [],
    usedFallbackCategory,
  }

  for (const record of dataset) {
    const { bucket } = classifyRecord(profile, record)
    result[bucket].push(record)
  }

  // Sort within each non-OOR bucket per Req 4.7.
  result.Reach.sort((a, b) => compareInBucket(a, b, cat))
  result.Match.sort((a, b) => compareInBucket(a, b, cat))
  result.Safety.sort((a, b) => compareInBucket(a, b, cat))

  return result
}
