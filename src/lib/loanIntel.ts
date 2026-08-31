// Loan Intelligence Engine — shared helpers for the EMI / Loan Intelligence
// page. Centralizes: 24h localStorage caching, EMI math, profile-derived
// defaults, and currency utilities. No UI here.

import { calculateEMI as baseEMI } from './utils'
import type { StudentProfile } from './types'

export const FX_USD_INR = 83
export const FX: Record<string, number> = {
  USD: 83, GBP: 105, EUR: 90, CAD: 61, AUD: 55, SGD: 62, NZD: 51, INR: 1,
}

const CACHE_PREFIX = 'gradpilot.loanIntel.'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

// 24h localStorage cache so repeat AI/Serper calls don't burn quota during demos.
export function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { t: number; v: T }
    if (!parsed.t || Date.now() - parsed.t > CACHE_TTL_MS) return null
    return parsed.v
  } catch {
    return null
  }
}

export function writeCache<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }))
  } catch { /* ignore */ }
}

// ─── EMI Math ────────────────────────────────────────────────────────────────

export interface EMIInputs {
  principalLakhs: number
  ratePct: number
  tenureYears: number
  moratoriumMonths?: number
  prepayLakhs?: number          // Lump-sum prepayment in Year 3
  scholarshipLakhs?: number     // Reduces principal directly
  partTimeIncomeMonthly?: number
}

export interface EMIResult {
  emi: number              // Monthly INR
  totalPaid: number        // Total INR paid over term
  totalInterest: number
  effectivePrincipal: number
  payoffYear: number       // Calendar offset from year 1
  yearly: { year: string; principal: number; interest: number; cumInterest: number; remaining: number }[]
  interestSavedFromPrepay: number
  monthsSavedFromPrepay: number
}

// Computes EMI taking moratorium (interest accrues but no payment), prepayment
// in year 3 and scholarship into account. Total-paid accumulates only the
// EMIs actually paid until balance is cleared, plus accrued moratorium interest.
export function computeEMI(inp: EMIInputs): EMIResult {
  const scholarship = (inp.scholarshipLakhs || 0) * 100000
  const principal = Math.max(0, inp.principalLakhs * 100000 - scholarship)
  const r = inp.ratePct
  const n = inp.tenureYears
  const moratoriumMonths = Math.max(0, Math.min(inp.moratoriumMonths || 0, n * 12 - 1))
  const prepay = (inp.prepayLakhs || 0) * 100000

  // During moratorium, simple interest accrues and is capitalized — added to
  // the principal at the start of repayment. We only EMI on the post-moratorium
  // months so total cost stays realistic for an Indian education loan.
  const accruedDuringMoratorium = principal * (r / 100) * (moratoriumMonths / 12)
  const effectivePrincipal = principal + accruedDuringMoratorium

  const repaymentMonths = Math.max(1, n * 12 - moratoriumMonths)
  const baseMonthly = principal > 0 ? baseEMI(effectivePrincipal, r, repaymentMonths / 12) : 0

  // Yearly schedule — simulates moratorium years (interest only) then EMI years.
  const yearly: EMIResult['yearly'] = []
  let remaining = effectivePrincipal
  let cumInterest = accruedDuringMoratorium
  let totalPaid = 0
  let monthsSaved = 0
  let interestSaved = 0
  let monthsElapsed = 0
  const maxMonths = n * 12

  for (let y = 1; y <= n + 5 && remaining > 0.5 && monthsElapsed < maxMonths; y++) {
    let yearlyInterest = 0
    let yearlyPrincipal = 0
    for (let m = 0; m < 12 && remaining > 0.5 && monthsElapsed < maxMonths; m++) {
      const inMoratorium = monthsElapsed < moratoriumMonths
      monthsElapsed++
      const monthInt = remaining * (r / 1200)
      if (inMoratorium) {
        // Interest already capitalized into effectivePrincipal — skip extra accrual.
        continue
      }
      const monthPrin = Math.max(0, baseMonthly - monthInt)
      const appliedPrin = Math.min(monthPrin, remaining)
      yearlyInterest += monthInt
      yearlyPrincipal += appliedPrin
      remaining = Math.max(0, remaining - appliedPrin)
      totalPaid += monthInt + appliedPrin // i.e. one EMI; equals baseMonthly until final partial month
    }

    // Year-3 (3 calendar years after disbursement, i.e. accounting for moratorium)
    // prepayment — knock principal down and shorten effective tenure.
    if (y === 3 && prepay > 0 && remaining > 0.5) {
      const knock = Math.min(prepay, remaining)
      yearlyPrincipal += knock
      remaining -= knock
      totalPaid += knock
      // Rough estimate of interest saved & months shortened by prepaying.
      interestSaved = Math.round(knock * (r / 100) * Math.max(0, n - y) * 0.5)
      monthsSaved = Math.round((knock / Math.max(1, baseMonthly)) * 0.7)
    }

    cumInterest += yearlyInterest
    yearly.push({
      year: `Y${y}`,
      principal: Math.round(yearlyPrincipal),
      interest: Math.round(yearlyInterest),
      cumInterest: Math.round(cumInterest),
      remaining: Math.round(remaining),
    })
    if (remaining <= 0.5) break
  }

  return {
    emi: Math.round(baseMonthly),
    totalPaid: Math.round(totalPaid + accruedDuringMoratorium), // includes capitalized moratorium interest
    totalInterest: Math.round(Math.max(0, cumInterest)),
    effectivePrincipal: Math.round(effectivePrincipal),
    payoffYear: yearly.length,
    yearly,
    interestSavedFromPrepay: interestSaved,
    monthsSavedFromPrepay: monthsSaved,
  }
}

// ─── Profile-derived defaults ────────────────────────────────────────────────

export function detectCountry(profile: StudentProfile): string {
  const list = profile.targetCountries || profile.targetCountry
  if (Array.isArray(list) && list.length) return String(list[0])
  return 'USA'
}

export function detectCourse(profile: StudentProfile): string {
  return profile.targetField || profile.targetDegree || profile.targetProgram || 'Master\'s'
}

export function detectUniversity(profile: StudentProfile): string {
  if (profile.dreamUniversities?.length) return profile.dreamUniversities[0]
  if (profile.targetUniversitiesList?.length) return profile.targetUniversitiesList[0]
  return ''
}

// Maps the budget bracket text to a numeric INR value used as a sanity
// signal alongside live-fetched tuition.
export function budgetToINR(profile: StudentProfile): number {
  const s = profile.expectedBudgetStr || ''
  if (s.includes('Below 20L')) return 1500000
  if (s.includes('20L – 40L')) return 3000000
  if (s.includes('40L – 60L')) return 5000000
  if (s.includes('60L – 80L')) return 7000000
  if (s.includes('80L+')) return 9000000
  if (profile.budgetLakhs) return profile.budgetLakhs * 100000
  return 0
}

// Course duration heuristic — most master's programs are ~2 years,
// MBA/PG abroad ~2, UK 1, certain professional degrees 1.5.
export function courseDurationYears(profile: StudentProfile): number {
  const deg = (profile.targetDegree || '').toLowerCase()
  const country = detectCountry(profile).toUpperCase()
  if (country === 'UK') return 1
  if (deg.includes('phd')) return 4
  if (deg.includes('mim')) return 1
  return 2
}

export interface ScenarioPlans {
  conservative: { loanLakhs: number; label: string }
  smart:        { loanLakhs: number; label: string }
  full:         { loanLakhs: number; label: string }
}

// Three loan scenarios derived from estimated total cost (tuition + living).
export function buildScenarios(totalProgrammeCostLakhs: number): ScenarioPlans {
  const total = Math.max(5, totalProgrammeCostLakhs)
  return {
    conservative: { loanLakhs: Math.round(total * 0.7), label: 'Minimum Borrowing' },
    smart:        { loanLakhs: Math.round(total * 0.9), label: 'Recommended' },
    full:         { loanLakhs: Math.round(total),       label: 'Full Coverage' },
  }
}

// Calculates a simple, defensible "ROI" score out of 10 for the share card.
// Higher salary vs total loan repayment = higher score. Capped at 10.
export function calculateROIScore(annualSalaryINR: number, totalLoanRepaidINR: number): number {
  if (!annualSalaryINR || !totalLoanRepaidINR) return 0
  const ratio = annualSalaryINR / totalLoanRepaidINR
  // ratio 0.2 → 4, 0.4 → 7, 0.6+ → 9-10
  return Math.max(1, Math.min(10, Math.round(ratio * 16)))
}

// Tax saving under Section 80E — full interest deductible from taxable income.
export function calculate80ESaving(annualInterestINR: number, taxBracketPct: number): number {
  return Math.round(annualInterestINR * (taxBracketPct / 100))
}

// Personalized rate based on profile signals — same logic as Loan Apply page,
// kept here to avoid coupling and so the page is self-contained.
export function personalizedRate(profile: StudentProfile): number {
  const cgpa = parseFloat(String(profile.undergradCgpa || profile.cgpa || 7))
  const income = profile.coBorrowerIncome || (profile.coApplicantStr === 'Yes' ? 1000000 : 0)
  const collateral = profile.collateralAvailableStr === 'Yes'
  let rate = 12
  if (cgpa >= 8.5) rate -= 1.5
  else if (cgpa >= 7.5) rate -= 0.7
  if (income >= 1500000) rate -= 0.7
  else if (income >= 800000) rate -= 0.3
  if (collateral) rate -= 1.2
  return Math.max(8.5, Math.min(14, +rate.toFixed(1)))
}
