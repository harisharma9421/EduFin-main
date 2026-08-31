// Domestic Loan Center — pure eligibility helpers.
//
// Source of truth:
//   - .kiro/specs/domestic-track-mvp/requirements.md → Req 5 (loan eligibility
//     tri-state, premier-institute / co-applicant / collateral / income gating).
//   - .kiro/specs/domestic-track-mvp/design.md → "Loan eligibility (pseudocode)"
//     and "Domestic Loan Product criteria objects".
//
// All exported functions are PURE: no I/O, no Date, no Math.random, no React,
// no Zustand. They consume only the bits of `StudentProfile` they need via
// `Pick<StudentProfile, ...>` so they can be tested without constructing a
// full profile.
//
// Tri-state derivation (Req 5.7-5.9):
//   1. Any required criterion fails its predicate          → 'Not_Eligible'
//   2. Else any required criterion's input is missing      → 'Conditionally_Eligible'
//   3. Else (all required criteria pass)                   → 'Eligible'
//
// A product with NO required criteria short-circuits to 'Eligible' with
// empty matched / unmatched / missing arrays.

import { premierInstituteList } from './mock-data'
import type {
  DomesticLoanCriteria,
  DomesticLoanProduct,
  LoanEligibility,
  StudentProfile,
} from './types'

// ───────────────────────────────────────────────────────────────────────────
// Family-income parser
// ───────────────────────────────────────────────────────────────────────────

/**
 * Bucket-string → conservative upper-bound INR mapping used by the loan
 * eligibility engine. The onboarding form persists `familyIncomeStr` as one
 * of these five tokens (see `OnboardingFlow.tsx` Step 7); the loan engine
 * needs a numeric ceiling to compare against `criteria.maxFamilyAnnualIncomeINR`.
 *
 * Using the upper bound keeps the comparison conservative: a user who picked
 * '3L – 6L' is treated as having ₹6L, so a loan with a ₹4.5L ceiling will
 * mark the user `Not_Eligible` rather than falsely `Eligible`.
 */
const FAMILY_INCOME_BUCKETS: Record<string, number> = {
  'Below 3L': 300_000,
  '3L – 6L': 600_000,
  '6L – 10L': 1_000_000,
  '10L – 20L': 2_000_000,
  '20L+': 5_000_000,
}

/**
 * Parses a family-income value into INR rupees.
 *
 *   - `undefined` / `null` / unparseable → `undefined` (NEVER `NaN`)
 *   - `number`                            → returned as-is
 *   - one of the five bucket strings      → conservative upper bound (see
 *                                            `FAMILY_INCOME_BUCKETS`)
 *   - free-text numeric strings such as `'450000'`, `'4.5L'`, `'₹3,00,000'`
 *     are stripped of non-digit / non-dot characters and `Number(...)`-parsed.
 *     A trailing `L` or `l` (case-insensitive) multiplies the result by 1e5.
 */
export function parseFamilyIncome(
  value: string | number | undefined | null,
): number | undefined {
  if (value == null) return undefined
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }

  // Exact bucket match first — these strings contain en-dashes that the
  // generic numeric path below would otherwise mangle.
  if (Object.prototype.hasOwnProperty.call(FAMILY_INCOME_BUCKETS, value)) {
    return FAMILY_INCOME_BUCKETS[value]
  }

  // Detect a `L` / `l` lakh suffix BEFORE stripping it.
  const hasLakhSuffix = /[lL]/.test(value)

  // Strip everything that is not a digit or a decimal point.
  const stripped = value.replace(/[^0-9.]/g, '')
  if (stripped === '' || stripped === '.') return undefined

  const n = Number(stripped)
  if (!Number.isFinite(n)) return undefined

  return hasLakhSuffix ? n * 100_000 : n
}

// ───────────────────────────────────────────────────────────────────────────
// Loan product catalog
// ───────────────────────────────────────────────────────────────────────────

/**
 * The seven domestic loan products defined in design.md. Criteria booleans
 * encode the gating conditions evaluated by `evaluateLoanProduct`.
 *
 * Verbatim copy of "Domestic Loan Product criteria objects" from design.md;
 * any change here must be mirrored in the design document.
 */
export const domesticLoanProducts: DomesticLoanProduct[] = [
  {
    id: 'sbi-scholar',
    bankName: 'SBI',
    productName: 'SBI Scholar Loan',
    interestRateMin: 8.55,
    interestRateMax: 10.05,
    maxLoanINR: 4_000_000,
    moratoriumMonths: 12,
    criteria: { premierInstituteRequired: true },
    notes: 'Concessional rate for AA/A/B/C tier institutes',
  },
  {
    id: 'bob-vidya',
    bankName: 'Bank of Baroda',
    productName: 'Baroda Vidya',
    interestRateMin: 8.85,
    interestRateMax: 11.15,
    maxLoanINR: 7_500_000,
    moratoriumMonths: 12,
    criteria: { coApplicantRequired: true },
  },
  {
    id: 'canara-vidya-turant',
    bankName: 'Canara Bank',
    productName: 'Vidya Turant',
    interestRateMin: 9.25,
    interestRateMax: 11.5,
    maxLoanINR: 4_000_000,
    moratoriumMonths: 12,
    criteria: { coApplicantRequired: true },
  },
  {
    id: 'pnb-saraswati',
    bankName: 'PNB',
    productName: 'PNB Saraswati',
    interestRateMin: 9.0,
    interestRateMax: 11.5,
    maxLoanINR: 1_000_000,
    moratoriumMonths: 12,
    criteria: { collateralRequired: true, coApplicantRequired: true },
  },
  {
    id: 'hdfc-credila-domestic',
    bankName: 'HDFC Credila',
    productName: 'HDFC Credila Domestic',
    interestRateMin: 10.5,
    interestRateMax: 13.5,
    maxLoanINR: 4_000_000,
    moratoriumMonths: 12,
    criteria: { coApplicantRequired: true },
  },
  {
    id: 'avanse-domestic',
    bankName: 'Avanse',
    productName: 'Avanse Domestic',
    interestRateMin: 11.0,
    interestRateMax: 14.0,
    maxLoanINR: 5_000_000,
    moratoriumMonths: 6,
    criteria: { coApplicantRequired: true },
  },
  {
    id: 'vidya-lakshmi',
    bankName: 'Govt of India',
    productName: 'Vidya Lakshmi Portal',
    interestRateMin: 8.55,
    interestRateMax: 11.5,
    maxLoanINR: 1_000_000,
    moratoriumMonths: 12,
    criteria: { maxFamilyAnnualIncomeINR: 450_000 },
    notes:
      'Routes to multiple PSU banks; CSIS-eligible when income < ₹4.5L and institute is notified.',
  },
]

// ───────────────────────────────────────────────────────────────────────────
// Eligibility evaluator
// ───────────────────────────────────────────────────────────────────────────

/**
 * Per-criterion verdict during evaluation. Aggregated into the tri-state
 * status by the caller.
 */
type Verdict = 'pass' | 'fail' | 'missing'

/** Profile fields the loan engine reads. Narrowed via `Pick`. */
export type LoanEvalProfile = Pick<
  StudentProfile,
  | 'familyAnnualIncomeINR'
  | 'familyIncomeStr'
  | 'coApplicantStr'
  | 'collateralAvailableStr'
  | 'targetInstituteId'
>

export interface LoanEvaluationResult {
  status: LoanEligibility
  /** Human-readable labels for criteria that passed. */
  matched: string[]
  /** Human-readable labels for criteria that failed. */
  unmatched: string[]
  /** Human-readable labels for criteria whose input is missing. */
  missing: string[]
}

/**
 * Format the income ceiling label used by the loan UI, e.g.
 * `Family income ≤ ₹450,000`. Uses Indian-locale grouping to match the rest
 * of the app's monetary copy.
 */
function incomeCeilingLabel(ceiling: number): string {
  return `Family income ≤ ₹${ceiling.toLocaleString('en-IN')}`
}

/**
 * Evaluates a profile against a single loan product's criteria DSL.
 *
 * Truth table (Req 5.7-5.9):
 *   - any 'fail'                   → 'Not_Eligible'
 *   - no 'fail' & any 'missing'    → 'Conditionally_Eligible'
 *   - all 'pass' (or no criteria)  → 'Eligible'
 *
 * Mutually exclusive and exhaustive over all (profile, product) pairs.
 */
export function evaluateLoanProduct(
  profile: LoanEvalProfile,
  product: DomesticLoanProduct,
): LoanEvaluationResult {
  const matched: string[] = []
  const unmatched: string[] = []
  const missing: string[] = []

  const c: DomesticLoanCriteria = product.criteria

  // ── Premier institute ─────────────────────────────────────────────────
  if (c.premierInstituteRequired === true) {
    const label = 'Premier institute target'
    const verdict = checkPremierInstitute(profile.targetInstituteId)
    routeVerdict(verdict, label, matched, unmatched, missing)
  }

  // ── Co-applicant ──────────────────────────────────────────────────────
  if (c.coApplicantRequired === true) {
    const label = 'Co-applicant'
    const verdict = checkYesNo(profile.coApplicantStr)
    routeVerdict(verdict, label, matched, unmatched, missing)
  }

  // ── Collateral ────────────────────────────────────────────────────────
  if (c.collateralRequired === true) {
    const label = 'Collateral'
    const verdict = checkYesNo(profile.collateralAvailableStr)
    routeVerdict(verdict, label, matched, unmatched, missing)
  }

  // ── Family-income ceiling ─────────────────────────────────────────────
  if (c.maxFamilyAnnualIncomeINR != null) {
    const label = incomeCeilingLabel(c.maxFamilyAnnualIncomeINR)
    const incomeNum =
      profile.familyAnnualIncomeINR ?? parseFamilyIncome(profile.familyIncomeStr)
    let verdict: Verdict
    if (incomeNum == null) {
      verdict = 'missing'
    } else if (incomeNum <= c.maxFamilyAnnualIncomeINR) {
      verdict = 'pass'
    } else {
      verdict = 'fail'
    }
    routeVerdict(verdict, label, matched, unmatched, missing)
  }

  // ── Aggregate to tri-state ────────────────────────────────────────────
  let status: LoanEligibility
  if (unmatched.length > 0) {
    status = 'Not_Eligible'
  } else if (missing.length > 0) {
    status = 'Conditionally_Eligible'
  } else {
    status = 'Eligible'
  }

  return { status, matched, unmatched, missing }
}

// ───────────────────────────────────────────────────────────────────────────
// Internal verdict helpers
// ───────────────────────────────────────────────────────────────────────────

function checkPremierInstitute(targetInstituteId: string | undefined): Verdict {
  if (targetInstituteId == null) return 'missing'
  return premierInstituteList.includes(targetInstituteId) ? 'pass' : 'fail'
}

function checkYesNo(value: string | undefined): Verdict {
  if (value == null || value === '') return 'missing'
  return value === 'Yes' ? 'pass' : 'fail'
}

function routeVerdict(
  verdict: Verdict,
  label: string,
  matched: string[],
  unmatched: string[],
  missing: string[],
): void {
  if (verdict === 'pass') matched.push(label)
  else if (verdict === 'fail') unmatched.push(label)
  else missing.push(label)
}
