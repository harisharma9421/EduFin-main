'use client'

// College Match — score-aware shortlist generator (CSV-backed, AI-searchable)
// ----------------------------------------------------------------------------
// • Reads /api/college-match (10K+ programs from public/data/universities.csv).
// • Filters use chip toggles (no native multi-select dropdowns).
// • Country chips are pre-seeded from profile.targetCountry on first mount.
// • Programs that need an exam the student has not yet taken are still
//   shown — flagged as Reach with a "needs IELTS/TOEFL" pill — so the page
//   never goes empty just because the student is mid-onboarding.
// • Free-text query is converted into structured filters by Gemini.

import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatINR, parseNumber } from '@/lib/utils'
import {
  GraduationCap,
  Filter,
  MapPin,
  Building2,
  Sparkles,
  Loader2,
  BookOpen,
  ChevronRight,
  AlertCircle,
  ChevronLeft,
  Search,
  Database,
  X,
} from 'lucide-react'

// ── Result types — flat columns coming from the API ─────────────────────────
interface MatchRow {
  id: string
  university_name: string
  short_name: string
  country: string
  country_code: string
  city: string
  state_province: string
  tier: string
  qs_ranking_2025: number
  course_name: string
  course_short: string
  course_category: string
  degree_type: string
  duration_years: number
  admission_category: string
  bucket: 'Guaranteed' | 'Probable' | 'Reach'
  gap: number
  missingExams: string[]

  gre_required: boolean; gre_min: number
  gmat_required: boolean; gmat_min: number
  ielts_required: boolean; ielts_min: number
  toefl_required: boolean; toefl_min: number
  gate_required: boolean; gate_min: number
  cat_required: boolean; cat_min_pct: number
  cgpa_min: number; cgpa_avg: number

  this_year_cutoff_cgpa: number
  last_year_cutoff_cgpa: number

  acceptance_pct: number
  total_cost_inr: number
  avg_salary_inr: number
  scholarship_available: boolean
  scholarship_max_pct: number
  collateral_required: boolean
}

interface MatchResponse {
  total: number
  page: number
  pageSize: number
  bucketCounts: Record<string, number>
  countryCounts: Record<string, number>
  datasetSize: number
  aiFiltersApplied: Record<string, unknown>
  results: MatchRow[]
}

// ── Profile → exams + scores ────────────────────────────────────────────────
function deriveStudentScores(profile: any) {
  const exams: string[] = []
  const scores: Record<string, number> = {}

  const cgpa = parseNumber(profile.undergradCgpa, 0) || parseNumber(profile.cgpa, 0)
  if (cgpa > 0) scores.CGPA = cgpa

  if (profile.greStatus === 'Appeared') {
    const v = parseNumber(profile.greScoreStr, 0) || parseNumber(profile.greScore, 0)
    if (v > 0) {
      exams.push('GRE')
      scores.GRE = v
    }
  }
  if (profile.gmatStatus === 'Appeared') {
    const v = parseNumber(profile.gmatScoreStr, 0) || parseNumber(profile.gmatScore, 0)
    if (v > 0) {
      exams.push('GMAT')
      scores.GMAT = v
    }
  }
  if (profile.ieltsStatus === 'Appeared') {
    const v = parseNumber(profile.ieltsScore, 0)
    if (v > 0) {
      exams.push('IELTS')
      scores.IELTS = v
    }
  }
  if (profile.toeflStatus === 'Appeared') {
    const v = parseNumber(profile.toeflScore, 0)
    if (v > 0) {
      exams.push('TOEFL')
      scores.TOEFL = v
    }
  }
  if (profile.gateStatus === 'Appeared') {
    const v = parseNumber(profile.gateScoreStr, 0)
    if (v > 0) {
      exams.push('GATE')
      scores.GATE = v
    }
  }
  if (profile.catStatus === 'Appeared') {
    const v = parseNumber(profile.catScoreStr, 0)
    if (v > 0) {
      exams.push('CAT')
      scores.CAT = v
    }
  }
  if (profile.neetStatus === 'Appeared') exams.push('NEET_PG')
  return { exams, scores }
}

// Default lists for chip rows. Country list comes from API once first
// response lands (we sort by row count desc).
const BRANCH_OPTIONS = ['Technology', 'Business', 'Science', 'Medicine', 'Arts', 'Design', 'Law']
const DEGREE_OPTIONS = ['MS', 'MBA', 'MIM', 'MA', 'MPH', 'M.Arch', 'LLM', 'MFA']

// ── Small UI helpers ────────────────────────────────────────────────────────
const BucketChip = ({ bucket }: { bucket: MatchRow['bucket'] }) => {
  const tone =
    bucket === 'Guaranteed'
      ? { bg: 'rgba(16,185,129,0.12)', fg: 'var(--success)' }
      : bucket === 'Probable'
      ? { bg: 'rgba(245,158,11,0.12)', fg: 'var(--warning)' }
      : { bg: 'rgba(239,68,68,0.12)', fg: 'var(--danger)' }
  return (
    <span
      className="text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {bucket}
    </span>
  )
}

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span
    className="text-[10px] px-2 py-1 rounded-full"
    style={{
      background: 'var(--background-secondary)',
      color: 'var(--foreground-secondary)',
      border: '1px solid var(--border)',
    }}
  >
    {children}
  </span>
)

const Stat = ({ label, value, good }: { label: string; value: string; good?: boolean }) => (
  <div className="p-2 rounded-md" style={{ background: 'var(--background-secondary)' }}>
    <div
      className="text-[10px] uppercase tracking-wider"
      style={{ color: 'var(--foreground-muted)' }}
    >
      {label}
    </div>
    <div
      className="text-xs font-bold mt-0.5"
      style={{ color: good ? 'var(--success)' : 'var(--foreground)' }}
    >
      {value}
    </div>
  </div>
)

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium px-3 py-1.5 rounded-full transition-all"
      style={{
        background: active ? 'var(--primary-light)' : 'var(--surface)',
        color: active ? 'white' : 'var(--foreground-secondary)',
        border: `1px solid ${active ? 'var(--primary-light)' : 'var(--border)'}`,
      }}
    >
      {children}
    </button>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function CollegeMatch() {
  const { profile, setCurrentPage } = useAppStore()
  const studentInfo = useMemo(() => deriveStudentScores(profile), [profile])

  // Filter state
  const [countries, setCountries] = useState<string[]>([])
  const [seededCountries, setSeededCountries] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [degrees, setDegrees] = useState<string[]>([])
  const [bucket, setBucket] = useState<'all' | 'Guaranteed' | 'Probable' | 'Reach'>('all')
  const [budgetLakhs, setBudgetLakhs] = useState<number>(200)
  const [page, setPage] = useState(1)
  const [aiQuery, setAiQuery] = useState('')
  const [aiSubmitted, setAiSubmitted] = useState('')
  const PAGE_SIZE = 24

  const [data, setData] = useState<MatchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // Pre-seed country chips from profile.targetCountry on first mount.
  useEffect(() => {
    if (seededCountries) return
    const fromProfile = (profile as any)?.targetCountry
    if (Array.isArray(fromProfile) && fromProfile.length > 0) {
      setCountries(fromProfile.filter(Boolean) as string[])
    }
    setSeededCountries(true)
  }, [profile, seededCountries])

  // Fetch matches whenever filters change.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr('')
    fetch('/api/college-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentExams: studentInfo.exams,
        studentScores: studentInfo.scores,
        countries,
        categories,
        degrees,
        bucket,
        budgetINR: budgetLakhs * 100000,
        page,
        pageSize: PAGE_SIZE,
        aiQuery: aiSubmitted || undefined,
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.error) setErr(j.error)
        else setData(j)
      })
      .catch((e) => !cancelled && setErr(e?.message || 'Failed'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [studentInfo, countries, categories, degrees, bucket, budgetLakhs, page, aiSubmitted])

  useEffect(() => {
    setPage(1)
  }, [countries, categories, degrees, bucket, budgetLakhs, aiSubmitted])

  // Country chips — sorted by program count desc, capped to a clean row.
  const countryOptions = useMemo(() => {
    if (!data?.countryCounts) return [] as { code: string; count: number }[]
    return Object.entries(data.countryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({ code, count }))
  }, [data])

  const submitAi = () => setAiSubmitted(aiQuery.trim())
  const clearAi = () => {
    setAiQuery('')
    setAiSubmitted('')
  }
  const toggle = (list: string[], value: string, setter: (v: string[]) => void) => {
    if (list.includes(value)) setter(list.filter((x) => x !== value))
    else setter([...list, value])
  }
  const clearFilters = () => {
    setCountries([])
    setCategories([])
    setDegrees([])
    setBucket('all')
    setBudgetLakhs(200)
  }

  return (
    <div className="max-w-7xl space-y-6">
      {/* Hero */}
      <div className="card card-gradient">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2
              className="text-2xl font-bold flex items-center gap-2"
              style={{ color: 'var(--foreground)' }}
            >
              <GraduationCap className="w-6 h-6" style={{ color: 'var(--primary)' }} />
              College Match
            </h2>
            <p
              className="mt-1 text-sm flex items-center gap-2"
              style={{ color: 'var(--foreground-secondary)' }}
            >
              <Database className="w-3 h-3" />
              {data?.datasetSize?.toLocaleString() || '10,000+'} programs · cutoffs mapped against your scores · pick countries & branches with one tap.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {studentInfo.scores.CGPA ? (
              <Pill>
                CGPA{' '}
                <strong style={{ color: 'var(--foreground)' }}>{studentInfo.scores.CGPA}</strong>
              </Pill>
            ) : null}
            {studentInfo.scores.GRE ? (
              <Pill>
                GRE <strong style={{ color: 'var(--foreground)' }}>{studentInfo.scores.GRE}</strong>
              </Pill>
            ) : null}
            {studentInfo.scores.GMAT ? (
              <Pill>
                GMAT{' '}
                <strong style={{ color: 'var(--foreground)' }}>{studentInfo.scores.GMAT}</strong>
              </Pill>
            ) : null}
            {studentInfo.scores.IELTS ? (
              <Pill>
                IELTS{' '}
                <strong style={{ color: 'var(--foreground)' }}>{studentInfo.scores.IELTS}</strong>
              </Pill>
            ) : null}
            {studentInfo.scores.TOEFL ? (
              <Pill>
                TOEFL{' '}
                <strong style={{ color: 'var(--foreground)' }}>{studentInfo.scores.TOEFL}</strong>
              </Pill>
            ) : null}
            {studentInfo.scores.GATE ? (
              <Pill>
                GATE{' '}
                <strong style={{ color: 'var(--foreground)' }}>{studentInfo.scores.GATE}</strong>
              </Pill>
            ) : null}
            {studentInfo.scores.CAT ? (
              <Pill>
                CAT{' '}
                <strong style={{ color: 'var(--foreground)' }}>{studentInfo.scores.CAT}%</strong>
              </Pill>
            ) : null}
            {studentInfo.exams.length === 0 && (
              <button
                onClick={() => setCurrentPage('profile')}
                className="text-xs underline"
                style={{ color: 'var(--accent)' }}
              >
                Add an exam score →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AI search */}
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
            Ask in plain English
          </h3>
          <span
            className="text-xs ml-auto"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Powered by Gemini · turns your prompt into filters
          </span>
        </div>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--foreground-muted)' }}
          />
          <input
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitAi()}
            placeholder='e.g. "MS in AI in Canada under ₹50L, only safer matches"'
            className="input-field pl-10 pr-28"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {aiSubmitted && (
              <button
                onClick={clearAi}
                className="text-xs px-2 py-1 rounded-md"
                style={{
                  background: 'var(--surface)',
                  color: 'var(--foreground-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                Clear
              </button>
            )}
            <button
              onClick={submitAi}
              disabled={!aiQuery.trim() || loading}
              className="btn-primary text-xs flex items-center gap-1 disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5" /> Ask
            </button>
          </div>
        </div>
        {aiSubmitted && data?.aiFiltersApplied && (
          <p
            className="text-xs mt-2"
            style={{ color: 'var(--foreground-muted)' }}
          >
            AI applied:{' '}
            <strong>
              {Object.entries(data.aiFiltersApplied)
                .filter(([, v]) => v && (Array.isArray(v) ? (v as unknown[]).length : true))
                .map(([k, v]) => `${k}=${Array.isArray(v) ? (v as string[]).join(',') : v}`)
                .join(' · ') || 'no filters'}
            </strong>
          </p>
        )}
      </div>

      {/* Bucket toggle bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(
          [
            { key: 'all', label: 'All Matches', accent: 'var(--primary)' },
            { key: 'Guaranteed', label: 'Guaranteed', accent: 'var(--success)' },
            { key: 'Probable', label: 'Probable', accent: 'var(--warning)' },
            { key: 'Reach', label: 'Reach', accent: 'var(--danger)' },
          ] as const
        ).map((b) => {
          const count =
            b.key === 'all' ? data?.total || 0 : data?.bucketCounts?.[b.key] || 0
          const active = bucket === b.key
          return (
            <button
              key={b.key}
              onClick={() => setBucket(b.key)}
              className="card text-left flex items-center justify-between"
              style={{
                borderColor: active ? b.accent : 'var(--border)',
                background: active ? 'rgba(99,102,241,0.04)' : 'var(--surface)',
                boxShadow: active ? `0 0 0 2px ${b.accent}30` : 'none',
              }}
            >
              <div>
                <div
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: b.accent }}
                >
                  {b.label}
                </div>
                <div
                  className="text-2xl font-extrabold mt-1"
                  style={{ color: 'var(--foreground)' }}
                >
                  {count}
                </div>
              </div>
              {active && <ChevronRight className="w-5 h-5" style={{ color: b.accent }} />}
            </button>
          )
        })}
      </div>

      {/* Filters — chip rows */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
            Filters
          </h3>
          {(countries.length > 0 ||
            categories.length > 0 ||
            degrees.length > 0 ||
            bucket !== 'all') && (
            <button
              onClick={clearFilters}
              className="ml-auto text-xs flex items-center gap-1 underline"
              style={{ color: 'var(--foreground-muted)' }}
            >
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>

        {/* Country */}
        <div>
          <div
            className="text-[10px] uppercase tracking-widest font-bold mb-2"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Country
          </div>
          <div className="flex flex-wrap gap-1.5">
            {countryOptions.length === 0 ? (
              <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Loading countries…
              </span>
            ) : (
              countryOptions.map((c) => (
                <ToggleChip
                  key={c.code}
                  active={countries.includes(c.code)}
                  onClick={() => toggle(countries, c.code, setCountries)}
                >
                  {c.code} <span className="opacity-70">({c.count})</span>
                </ToggleChip>
              ))
            )}
          </div>
        </div>

        {/* Branch */}
        <div>
          <div
            className="text-[10px] uppercase tracking-widest font-bold mb-2"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Branch
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BRANCH_OPTIONS.map((b) => (
              <ToggleChip
                key={b}
                active={categories.includes(b)}
                onClick={() => toggle(categories, b, setCategories)}
              >
                {b}
              </ToggleChip>
            ))}
          </div>
        </div>

        {/* Degree */}
        <div>
          <div
            className="text-[10px] uppercase tracking-widest font-bold mb-2"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Degree
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DEGREE_OPTIONS.map((d) => (
              <ToggleChip
                key={d}
                active={degrees.includes(d)}
                onClick={() => toggle(degrees, d, setDegrees)}
              >
                {d}
              </ToggleChip>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div>
          <div
            className="text-[10px] uppercase tracking-widest font-bold mb-2 flex items-center justify-between"
            style={{ color: 'var(--foreground-muted)' }}
          >
            <span>Budget</span>
            <span style={{ color: 'var(--accent)' }}>≤ ₹{budgetLakhs}L</span>
          </div>
          <input
            type="range"
            min="10"
            max="300"
            value={budgetLakhs}
            onChange={(e) => setBudgetLakhs(+e.target.value)}
            className="w-full"
          />
          <div
            className="flex justify-between text-[10px] mt-1"
            style={{ color: 'var(--foreground-muted)' }}
          >
            <span>₹10L</span>
            <span>₹3Cr</span>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="card flex items-center gap-2 justify-center py-10">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--primary)' }} />
          <span
            className="text-sm"
            style={{ color: 'var(--foreground-secondary)' }}
          >
            Mapping you to colleges…
          </span>
        </div>
      ) : err ? (
        <div className="card text-center py-8">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--danger)' }} />
          <p className="text-sm" style={{ color: 'var(--danger)' }}>
            {err}
          </p>
        </div>
      ) : !data || data.results.length === 0 ? (
        <div className="card text-center py-8">
          <Search className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--foreground-muted)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            No matches with current filters
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
            Try unselecting a country, picking a different branch, or raising the budget slider.
          </p>
          <button
            onClick={clearFilters}
            className="btn-secondary text-xs mt-3"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.results.map((row) => (
              <div
                key={row.id}
                className="card flex flex-col gap-3"
                style={{ padding: '1.1rem 1.25rem' }}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      className="font-bold text-sm flex items-center gap-1.5 truncate"
                      style={{ color: 'var(--foreground)' }}
                    >
                      <Building2
                        className="w-3.5 h-3.5 flex-shrink-0"
                        style={{ color: 'var(--primary-light)' }}
                      />
                      {row.university_name}
                    </div>
                    <div
                      className="text-xs mt-0.5 flex items-center gap-2 flex-wrap"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {row.city}, {row.country}
                      </span>
                      <span>·</span>
                      <span>QS #{row.qs_ranking_2025 < 999 ? row.qs_ranking_2025 : '—'}</span>
                    </div>
                  </div>
                  <BucketChip bucket={row.bucket} />
                </div>

                {/* Course */}
                <div
                  className="text-xs px-2.5 py-1.5 rounded-md flex items-center gap-1.5"
                  style={{
                    background: 'var(--background-secondary)',
                    color: 'var(--foreground-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <BookOpen className="w-3 h-3" style={{ color: 'var(--primary-light)' }} />
                  <strong style={{ color: 'var(--foreground)' }}>{row.course_name}</strong>
                  <span className="ml-auto">
                    {row.duration_years}y · {row.degree_type}
                  </span>
                </div>

                {/* Missing exams banner (if any) */}
                {row.missingExams && row.missingExams.length > 0 && (
                  <div
                    className="text-[11px] px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2"
                    style={{
                      background: 'rgba(245,158,11,0.08)',
                      color: 'var(--warning)',
                      border: '1px solid rgba(245,158,11,0.2)',
                    }}
                  >
                    <span>
                      Needs <strong>{row.missingExams.join(', ')}</strong> to qualify
                    </span>
                    <button
                      onClick={() => setCurrentPage('profile')}
                      className="text-[10px] underline whitespace-nowrap"
                    >
                      Add score
                    </button>
                  </div>
                )}

                {/* Cutoffs trend */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-md" style={{ background: 'var(--background-secondary)' }}>
                    <div
                      className="text-[10px] uppercase tracking-wider"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      2026 cutoff CGPA
                    </div>
                    <div
                      className="font-bold mt-0.5"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {row.this_year_cutoff_cgpa}
                    </div>
                  </div>
                  <div className="p-2 rounded-md" style={{ background: 'var(--background-secondary)' }}>
                    <div
                      className="text-[10px] uppercase tracking-wider"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      2025 cutoff CGPA
                    </div>
                    <div
                      className="font-bold mt-0.5"
                      style={{ color: 'var(--foreground-secondary)' }}
                    >
                      {row.last_year_cutoff_cgpa}
                      <span
                        className="text-[10px] ml-1"
                        style={{
                          color:
                            row.this_year_cutoff_cgpa >= row.last_year_cutoff_cgpa
                              ? 'var(--danger)'
                              : 'var(--success)',
                        }}
                      >
                        {row.this_year_cutoff_cgpa >= row.last_year_cutoff_cgpa ? '↑' : '↓'}
                      </span>
                    </div>
                  </div>
                </div>

                <ScoreRequirements row={row} scores={studentInfo.scores} />

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Total Cost" value={formatINR(row.total_cost_inr)} />
                  <Stat label="Avg Salary" value={formatINR(row.avg_salary_inr)} good />
                  <Stat label="Acceptance" value={`${row.acceptance_pct}%`} />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Pill>{row.course_category}</Pill>
                  <Pill>Tier {row.tier.replace('T', '')}</Pill>
                  {row.collateral_required && <Pill>Collateral needed</Pill>}
                  {row.scholarship_available && (
                    <Pill>Scholarship up to {row.scholarship_max_pct}%</Pill>
                  )}
                </div>
              </div>
            ))}
          </div>

          {data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span
                className="text-xs"
                style={{ color: 'var(--foreground-muted)' }}
              >
                Page {page} of {Math.ceil(data.total / PAGE_SIZE)} ·{' '}
                {data.total.toLocaleString()} matches
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * PAGE_SIZE >= data.total}
                className="btn-secondary text-sm flex items-center gap-1 disabled:opacity-40"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ScoreRequirements({
  row,
  scores,
}: {
  row: MatchRow
  scores: Record<string, number>
}) {
  const items: { exam: string; required: string; you: string; ok: boolean }[] = []

  if (row.gre_required && scores.GRE) {
    const ok = scores.GRE >= row.gre_min
    items.push({ exam: 'GRE', required: `≥${row.gre_min}`, you: `${scores.GRE}`, ok })
  }
  if (row.gmat_required && scores.GMAT) {
    const ok = scores.GMAT >= row.gmat_min
    items.push({ exam: 'GMAT', required: `≥${row.gmat_min}`, you: `${scores.GMAT}`, ok })
  }
  if (row.ielts_required && scores.IELTS) {
    const ok = scores.IELTS >= row.ielts_min
    items.push({ exam: 'IELTS', required: `≥${row.ielts_min}`, you: `${scores.IELTS}`, ok })
  }
  if (row.toefl_required && scores.TOEFL) {
    const ok = scores.TOEFL >= row.toefl_min
    items.push({ exam: 'TOEFL', required: `≥${row.toefl_min}`, you: `${scores.TOEFL}`, ok })
  }
  if (row.gate_required && scores.GATE) {
    const ok = scores.GATE >= row.gate_min
    items.push({ exam: 'GATE', required: `≥${row.gate_min}`, you: `${scores.GATE}`, ok })
  }
  if (row.cat_required && scores.CAT) {
    const ok = scores.CAT >= row.cat_min_pct
    items.push({ exam: 'CAT', required: `≥${row.cat_min_pct}%`, you: `${scores.CAT}%`, ok })
  }
  if (scores.CGPA && row.cgpa_min > 0) {
    const ok = scores.CGPA >= row.cgpa_min
    items.push({ exam: 'CGPA', required: `≥${row.cgpa_min}`, you: `${scores.CGPA}`, ok })
  }

  if (items.length === 0) return null

  return (
    <div className="grid gap-1">
      {items.map((it) => (
        <div
          key={it.exam}
          className="flex items-center justify-between text-xs px-2.5 py-1 rounded-md"
          style={{
            background: it.ok ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${it.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}
        >
          <span style={{ color: 'var(--foreground-secondary)' }}>{it.exam}</span>
          <span style={{ color: 'var(--foreground-muted)' }}>req {it.required}</span>
          <span
            style={{ color: it.ok ? 'var(--success)' : 'var(--danger)' }}
          >
            you {it.you} {it.ok ? '✓' : '✗'}
          </span>
        </div>
      ))}
    </div>
  )
}
