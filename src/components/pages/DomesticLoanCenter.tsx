'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Domestic Loan Center
//
// Source of truth:
//   - .kiro/specs/domestic-track-mvp/requirements.md → Req 5 (loan tri-state),
//     Req 16 (module isolation: net-new file; no edits to LoanCenter.tsx).
//   - .kiro/specs/domestic-track-mvp/design.md → "Components and Interfaces"
//     row for DomesticLoanCenter and the Error Handling rows for loan.
//
// Note: The CSIS Preview side panel and the static eligibility list have been
// removed per the latest product direction. The page is now a thin shell
// around the live, college-specific Serper + Gemini loan discovery API.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  ArrowRight,
  Loader2,
  Sparkles,
  ExternalLink,
  Star,
  Search,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { formatINR } from '@/lib/utils'
import type { DomesticLoanResult } from '@/lib/types'

// ───────────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────────

export default function DomesticLoanCenter({
  embedded = false,
}: { embedded?: boolean } = {}) {
  const profile = useAppStore((s) => s.profile)
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)
  const setTargetOnboardingStep = useAppStore(
    (s) => s.setTargetOnboardingStep,
  )
  const selectedCollege = useAppStore((s) => s.selectedCollege)

  // ── Live, college-specific loan discovery (Serper + Gemini) ───────────────
  const [liveLoans, setLiveLoans] = useState<DomesticLoanResult[]>([])
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState('')
  const [liveSource, setLiveSource] = useState<'serper+gemini' | 'empty' | ''>('')

  const collegeIncome =
    profile.familyAnnualIncomeINR != null
      ? formatINR(profile.familyAnnualIncomeINR)
      : profile.familyIncomeStr || ''
  const collegeCoApplicant = profile.coApplicantStr ?? (profile.hasCoApplicant ? 'Yes' : '')
  const collegeCollateral =
    profile.collateralAvailableStr ?? (profile.collateralType && profile.collateralType !== 'none' ? 'Yes' : 'No')

  const selectedCollegeKey = selectedCollege
    ? `${selectedCollege.name}|${selectedCollege.city}|${selectedCollege.branch}`
    : ''

  const [searchTerm, setSearchTerm] = useState('')

  const runLoanSearch = async (query?: string) => {
    setLiveLoading(true)
    setLiveError('')
    try {
      const res = await fetch('/api/domestic-loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          college: selectedCollege
            ? {
                name: selectedCollege.name,
                city: selectedCollege.city,
                state: selectedCollege.state,
                collegeType: selectedCollege.collegeType,
                branch: selectedCollege.branch,
              }
            : null,
          familyIncome: collegeIncome,
          coApplicant: collegeCoApplicant,
          collateral: collegeCollateral,
          // Profile signals so default load is personalised.
          profile: {
            name: profile.name,
            city: profile.city,
            state: profile.state,
            twelfthMarks: profile.twelfthMarks,
            undergrad_cgpa: profile.undergradCgpa,
            entranceExams: profile.entranceExams,
            jee_score: (profile as any).jee_score,
            cet_score: (profile as any).cet_score,
            neet_score: (profile as any).neet_score,
            cat_score: (profile as any).cat_score,
            gate_score: (profile as any).gate_score,
            target_field: profile.targetField,
            target_degree: profile.targetDegree,
          },
          userQuery: (query ?? searchTerm).trim(),
        }),
      })
      if (!res.ok) throw new Error('Failed to load loans')
      const data = await res.json()
      const list: DomesticLoanResult[] = Array.isArray(data.options) ? data.options : []
      setLiveLoans(list)
      setLiveSource(list.length > 0 ? 'serper+gemini' : 'empty')
      if (list.length === 0) setLiveError('No live loan products matched. Try a different search.')
    } catch {
      setLiveError('Could not load live loans. Try again in a moment.')
    } finally {
      setLiveLoading(false)
    }
  }

  useEffect(() => {
    runLoanSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCollegeKey])

  // CSIS preview removed per latest product direction.

  const goOnboardingStep = (step: number | null) => {
    if (step != null) setTargetOnboardingStep(step)
    setCurrentPage('onboarding')
  }

  // ── Profile summary tile values ──────────────────────────────────────────
  const familyIncomeDisplay =
    profile.familyAnnualIncomeINR != null
      ? formatINR(profile.familyAnnualIncomeINR)
      : profile.familyIncomeStr || 'Not set'
  const coApplicantDisplay = profile.coApplicantStr ?? 'Not set'
  const collateralDisplay = profile.collateralAvailableStr ?? 'Not set'
  const targetInstituteDisplay =
    selectedCollege?.name ?? 'Not set'

  return (
    <div className="max-w-6xl space-y-6">
      {/* ── 1. Header ──────────────────────────────────────────────────── */}
      {!embedded && (
        <div>
          <h2
            className="text-2xl font-bold flex items-center gap-2"
            style={{ color: 'var(--foreground)' }}
          >
            <DollarSign
              className="w-6 h-6"
              style={{ color: 'var(--accent)' }}
            />
            Domestic Loan Center
          </h2>
          <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>
            Live, college-specific Indian education loan options powered by Serper + Gemini.
          </p>
        </div>
      )}

      {/* ── 2. Profile summary tiles ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div
            className="text-xs"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Family income
          </div>
          <div
            className="text-lg font-bold mt-1"
            style={{ color: 'var(--foreground)' }}
          >
            {familyIncomeDisplay}
          </div>
          <button
            type="button"
            onClick={() => goOnboardingStep(7)}
            className="loan-link text-xs mt-2 inline-flex items-center gap-1"
          >
            Edit <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="stat-card">
          <div
            className="text-xs"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Co-applicant
          </div>
          <div
            className="text-lg font-bold mt-1"
            style={{ color: 'var(--foreground)' }}
          >
            {coApplicantDisplay}
          </div>
          <button
            type="button"
            onClick={() => goOnboardingStep(7)}
            className="loan-link text-xs mt-2 inline-flex items-center gap-1"
          >
            Edit <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="stat-card">
          <div
            className="text-xs"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Collateral
          </div>
          <div
            className="text-lg font-bold mt-1"
            style={{ color: 'var(--foreground)' }}
          >
            {collateralDisplay}
          </div>
          <button
            type="button"
            onClick={() => goOnboardingStep(7)}
            className="loan-link text-xs mt-2 inline-flex items-center gap-1"
          >
            Edit <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="stat-card">
          <div
            className="text-xs"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Target institute
          </div>
          <div
            className="text-lg font-bold mt-1 truncate"
            style={{ color: 'var(--foreground)' }}
            title={targetInstituteDisplay}
          >
            {targetInstituteDisplay}
          </div>
          <button
            type="button"
            onClick={() => setCurrentPage('domestic-admission-predictor')}
            className="loan-link text-xs mt-2 inline-flex items-center gap-1"
          >
            Pick <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── 2b. Live loans (Serper + Gemini) — search-driven, always shown ─ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div
            className="text-base font-semibold flex items-center gap-2"
            style={{ color: 'var(--foreground)' }}
          >
            <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            {selectedCollege ? `Loans for ${selectedCollege.name}` : 'Live education-loan options'}
          </div>
          {liveLoading && (
            <span
              className="inline-flex items-center gap-2 text-xs"
              style={{ color: 'var(--foreground-secondary)' }}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching live loan options...
            </span>
          )}
          {!liveLoading && liveSource === 'serper+gemini' && (
            <span className="badge badge-primary inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Live web data
            </span>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            runLoanSearch(searchTerm)
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--foreground-muted)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder='e.g. "no collateral education loan for IIT students under ₹15L"'
              className="input-field pl-10 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={liveLoading}
            className="btn-secondary inline-flex items-center gap-2 text-sm whitespace-nowrap"
          >
            {liveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {liveLoading ? 'Searching…' : searchTerm.trim() ? 'Search' : 'Refresh'}
          </button>
        </form>

        {liveError && !liveLoading && (
          <div
            className="text-xs"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {liveError}
          </div>
        )}

        {!liveLoading &&
          liveLoans.map((loan, i) => (
            <motion.div
              key={`${loan.applyUrl}-${i}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.04 }}
                className="card glass glass-hover"
              >
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="lg:w-64 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-semibold"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {loan.name}
                      </span>
                      {loan.collegeSpecific && (
                        <span className="badge badge-success inline-flex items-center gap-1">
                          <Star className="w-3 h-3" /> For this college
                        </span>
                      )}
                    </div>
                    <div
                      className="text-xs mt-0.5"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      {loan.provider} · {loan.providerType}
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <div className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
                        Interest rate
                      </div>
                      <div className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
                        {loan.interestRate}
                      </div>
                    </div>
                    {loan.maxLoanINR > 0 && (
                      <div>
                        <div className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
                          Max loan
                        </div>
                        <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                          {formatINR(loan.maxLoanINR)}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
                        Moratorium
                      </div>
                      <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                        {loan.moratorium}
                      </div>
                    </div>
                  </div>
                </div>

                {loan.fitReason && (
                  <div
                    className="text-xs mt-3"
                    style={{ color: 'var(--foreground-secondary)' }}
                  >
                    {loan.fitReason}
                  </div>
                )}

                {loan.features.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {loan.features.slice(0, 6).map((f) => (
                      <span key={f} className="badge badge-primary">
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <a
                    href={loan.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary inline-flex items-center gap-1 text-xs"
                  >
                    Apply <ExternalLink className="w-3 h-3" />
                  </a>
                  {loan.sourceName && (
                    <a
                      href={loan.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="loan-link inline-flex items-center gap-1 text-xs"
                    >
                      Source: {loan.sourceName}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
      </div>

      {/* ── 3. Standard eligibility list intentionally removed.
              The live, college-specific loan list above (powered by
              Serper + Gemini) is now the only loan results panel.
              CSIS Preview also removed per latest product direction.
        ──────────────────────────────────────────────────────────────── */}
    </div>
  )
}
