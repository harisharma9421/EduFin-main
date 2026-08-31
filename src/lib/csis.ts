// Central Sector Interest Subsidy (CSIS) eligibility and savings.
//
// Source of truth:
//   - .kiro/specs/domestic-track-mvp/requirements.md → Req 6 (CSIS preview)
//   - .kiro/specs/domestic-track-mvp/requirements.md → Req 9 (EMI calculator
//     CSIS toggle; consumed via `effectiveEmi`)
//   - .kiro/specs/domestic-track-mvp/design.md → "CSIS Calculator (pseudocode)"
//     and "EMI Calculator Domestic Presets and CSIS Toggle"
//
// All four exported functions are PURE: no I/O, no Date, no Math.random, no
// React, no Zustand. The eligibility helper depends only on the two input
// arguments and a default-to-`false` reasoning when either is missing.

/** Inclusive description of the eligibility outcome. */
export type CsisReason =
  | 'ok'
  | 'income' // failing condition: income at or above threshold
  | 'institute' // failing condition: institute not notified for CSIS
  | 'both' // failing both conditions
  | 'missing-income'
  | 'missing-institute'

export interface CsisEligibilityResult {
  eligible: boolean
  reason: CsisReason
}

/**
 * Annual family-income ceiling for CSIS eligibility, in INR.
 * Per Req 6.2 the comparison is strict less-than: a value equal to the
 * ceiling is NOT eligible.
 */
export const CSIS_INCOME_CEILING_INR = 450_000

/**
 * Determines CSIS eligibility from the two inputs the calculator can see.
 *
 * Returns a result object — `eligible: false` is paired with a structured
 * `reason` so the UI banner can identify the failing condition (Req 6.4) or
 * the missing input (Req 6.6, 6.7).
 *
 * Missing-input precedence: when both inputs are missing the result is
 * `'missing-income'`, mirroring the order in which the calculator collects
 * data (income from the profile first, then the institute lookup).
 */
export function computeCsisEligible(
  familyAnnualIncomeINR: number | undefined,
  isNotifiedForCSIS: boolean | undefined,
): CsisEligibilityResult {
  if (familyAnnualIncomeINR == null) {
    return { eligible: false, reason: 'missing-income' }
  }
  if (isNotifiedForCSIS == null) {
    return { eligible: false, reason: 'missing-institute' }
  }

  const incomeOk = familyAnnualIncomeINR < CSIS_INCOME_CEILING_INR

  if (incomeOk && isNotifiedForCSIS) {
    return { eligible: true, reason: 'ok' }
  }
  if (!incomeOk && !isNotifiedForCSIS) {
    return { eligible: false, reason: 'both' }
  }
  if (!incomeOk) {
    return { eligible: false, reason: 'income' }
  }
  // incomeOk && !isNotifiedForCSIS
  return { eligible: false, reason: 'institute' }
}

/**
 * Computes the moratorium-period interest savings under CSIS as simple
 * interest on the principal at the supplied annual rate over the supplied
 * moratorium in months. Returns 0 whenever `eligible === false`, regardless
 * of the other inputs (Req 6.4).
 *
 * Defense-in-depth: a negative principal, rate, or moratorium yields `NaN`
 * so callers can surface an inline validation error (Req 6.8) without
 * silently producing a positive savings figure.
 */
export function computeCsisSavings(
  eligible: boolean,
  principalINR: number,
  annualRatePct: number,
  moratoriumMonths: number,
): number {
  if (principalINR < 0 || annualRatePct < 0 || moratoriumMonths < 0) {
    return Number.NaN
  }
  if (!eligible) {
    return 0
  }
  // Simple interest over the moratorium period.
  // Zero for any factor naturally yields zero (Req 6.9).
  return principalINR * (annualRatePct / 100) * (moratoriumMonths / 12)
}

/**
 * Standard amortizing-EMI formula. `annualRatePct` is the annual interest
 * rate as a percentage (e.g. 9.5 means 9.5 % per annum). `tenureMonths` is
 * the number of monthly installments.
 *
 * - When the rate is exactly zero, returns the principal divided evenly
 *   across the tenure.
 * - When the tenure is non-positive, returns `NaN` (cannot amortize over
 *   zero or negative installments).
 */
export function computeEmi(
  principalINR: number,
  annualRatePct: number,
  tenureMonths: number,
): number {
  if (tenureMonths <= 0) {
    return Number.NaN
  }
  const r = annualRatePct / 12 / 100
  if (r === 0) {
    return principalINR / tenureMonths
  }
  const factor = Math.pow(1 + r, tenureMonths)
  return (principalINR * r * factor) / (factor - 1)
}

/**
 * EMI under the CSIS toggle, used by `EMICalculator` (Task 15).
 *
 * Per design.md "EMI Calculator Domestic Presets and CSIS Toggle", the CSIS
 * subsidy excludes the moratorium-period interest from the principal-plus-
 * interest base. We model the per-month effect as the base EMI minus the
 * subsidy spread evenly across the post-moratorium repayment period. The
 * delta is clamped at zero so the result is never negative.
 *
 * When the toggle is off, or the user is not eligible, the helper returns
 * the base EMI unchanged (Req 9.4).
 */
export function effectiveEmi(
  principalINR: number,
  annualRatePct: number,
  tenureMonths: number,
  csisOn: boolean,
  csisEligible: boolean,
  moratoriumMonths: number,
): number {
  const baseEmi = computeEmi(principalINR, annualRatePct, tenureMonths)
  if (!csisOn || !csisEligible) {
    return baseEmi
  }
  const subsidy = computeCsisSavings(
    true,
    principalINR,
    annualRatePct,
    moratoriumMonths,
  )
  if (!Number.isFinite(baseEmi) || !Number.isFinite(subsidy)) {
    return baseEmi
  }
  return Math.max(0, baseEmi - subsidy / tenureMonths)
}
