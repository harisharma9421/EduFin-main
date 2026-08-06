// Pure validation helpers for Onboarding Step 5 — Domestic Track MVP.
//
// Per requirements.md (Req 3.5, 3.6, 3.7, 3.8) and design.md
// ("Onboarding Step 5 Changes"). These helpers are React-free and have no
// I/O so they can be exercised by property tests without mounting the
// onboarding component.
//
//   - `validateStep5` checks numeric bounds for the four Indian-exam fields
//     (jeeAdvancedRank, gateRank, catPercentile, gateScoreYear). Every
//     field is OPTIONAL: when undefined it does not contribute an error.
//   - `computeDomesticExamScoreMissing` returns true iff the active track
//     wants at least one Indian-exam score AND none of the three primary
//     score fields (jeeAdvancedRank, gateScore, catPercentile) is present.

import type { ReservationCategory, StudentProfile, Track } from './types'

export type { ReservationCategory } from './types'

export interface Step5Input {
  jeeAdvancedRank?: number
  gateRank?: number
  gateScore?: number
  gateScoreYear?: number
  catPercentile?: number
  reservationCategory?: ReservationCategory
  homeState?: string
}

export interface Step5ValidationResult {
  ok: boolean
  errors: Record<string, string>
}

/**
 * Validate the four numeric Step 5 fields.
 *
 * Bounds (Req 3.5–3.7):
 *   - jeeAdvancedRank, gateRank: must be a finite positive number.
 *   - catPercentile: must be a finite number in the inclusive range [0, 100].
 *   - gateScoreYear: must be a finite integer in [currentYear - 4, currentYear].
 *
 * `currentYear` is injected for deterministic tests; defaults to the host
 * clock when omitted.
 */
export function validateStep5(
  input: Step5Input,
  currentYear?: number,
): Step5ValidationResult {
  const year = currentYear ?? new Date().getFullYear()
  const errors: Record<string, string> = {}

  if (input.jeeAdvancedRank !== undefined) {
    if (!Number.isFinite(input.jeeAdvancedRank) || input.jeeAdvancedRank <= 0) {
      errors.jeeAdvancedRank = 'JEE Advanced rank must be a positive number'
    }
  }

  if (input.gateRank !== undefined) {
    if (!Number.isFinite(input.gateRank) || input.gateRank <= 0) {
      errors.gateRank = 'GATE rank must be a positive number'
    }
  }

  if (input.catPercentile !== undefined) {
    if (
      !Number.isFinite(input.catPercentile) ||
      input.catPercentile < 0 ||
      input.catPercentile > 100
    ) {
      errors.catPercentile = 'CAT percentile must be between 0 and 100'
    }
  }

  if (input.gateScoreYear !== undefined) {
    if (
      !Number.isFinite(input.gateScoreYear) ||
      input.gateScoreYear < year - 4 ||
      input.gateScoreYear > year
    ) {
      errors.gateScoreYear = `GATE score year must be between ${year - 4} and ${year}`
    }
  }

  return { ok: Object.keys(errors).length === 0, errors }
}

/**
 * Per Req 3.8 and design "domesticExamScoreMissing flow":
 * returns true iff the active track expects at least one Indian-exam score
 * AND none of jeeAdvancedRank, gateScore, catPercentile is present.
 *
 * For `track === 'abroad'` the flag is always false because no Indian-exam
 * score is required.
 */
export function computeDomesticExamScoreMissing(
  track: Track,
  localData: Pick<
    StudentProfile,
    'jeeAdvancedRank' | 'gateScore' | 'catPercentile'
  >,
): boolean {
  if (track !== 'domestic' && track !== 'both') return false
  return (
    localData.jeeAdvancedRank == null &&
    localData.gateScore == null &&
    localData.catPercentile == null
  )
}
