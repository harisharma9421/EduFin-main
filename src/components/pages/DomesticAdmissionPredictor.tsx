'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Domestic Admission Predictor
//
// Source of truth:
//   - .kiro/specs/domestic-track-mvp/requirements.md → Req 4 (predictor),
//     Req 16 (module isolation: net-new file; no edits to AdmissionPredictor.tsx).
//
// Behavior:
//   - Drives off the Indian entrance exams the student selected during
//     onboarding (`profile.entranceExams`), which capture stream
//     (Medical / Engineering) and region (National / state level).
//   - The student picks ONE specific branch (the branch dropdown has no
//     "All branches" option). The `/api/domestic-colleges` route then returns
//     up to 50 REAL colleges that offer that branch through the student's
//     exam(s), ranked best-first by closing cutoff (percentile high→low or
//     rank low→high, per `cutoffType`).
//   - An optional city filter narrows the fetch to a single city (still up to
//     50 colleges within that city, or fewer if the city has fewer).
//
// Conventions:
//   - Client Component (Zustand selector + local state).
//   - Theme: only existing utility classes and `var(--*)` tokens. No hex literals.
//   - Does NOT import `AdmissionPredictor.tsx` (Req 16).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Target,
  Search,
  Filter,
  AlertCircle,
  Check,
  Loader2,
  Sparkles,
  MapPin,
  Hash,
  Award,
  BarChart3,
  Download,
  DollarSign,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import type { DomesticCollegeResult, EntranceExamStream } from '@/lib/types'

const ALL_CITIES = '__all_cities__'

// Branch options offered per stream. The student must pick exactly one — there
// is intentionally no "All branches" choice.
const BRANCH_OPTIONS: Record<EntranceExamStream, string[]> = {
  Engineering: [
    'Computer Science',
    'Information Technology',
    'Computer Engineering',
    'Electronics & Communication',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Chemical Engineering',
    'Artificial Intelligence & ML',
    'AI & Data Science',
  ],
  Medical: ['MBBS', 'BDS', 'BAMS', 'BHMS', 'B.Sc Nursing'],
}

export default function DomesticAdmissionPredictor({
  embedded = false,
}: { embedded?: boolean } = {}) {
  const profile = useAppStore((s) => s.profile)
  const updateProfile = useAppStore((s) => s.updateProfile)
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)
  const setSelectedCollege = useAppStore((s) => s.setSelectedCollege)

  const exams = useMemo(() => profile.entranceExams ?? [], [profile.entranceExams])
  const category = profile.reservationCategory ?? 'General'
  const hasExams = exams.length > 0

  const stream: EntranceExamStream = useMemo(
    () => (exams.some((e) => e.stream === 'Medical') ? 'Medical' : 'Engineering'),
    [exams],
  )
  const branchOptions = BRANCH_OPTIONS[stream]

  const [colleges, setColleges] = useState<DomesticCollegeResult[]>([])
  const [cityOptions, setCityOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState<'gemini' | 'fallback' | ''>('')

  // Filters / selection
  const [search, setSearch] = useState('')
  const [branch, setBranch] = useState<string>(branchOptions[0])
  const [cityFilter, setCityFilter] = useState<string>(ALL_CITIES)

  // Keep the selected branch valid when the stream (and thus options) changes.
  useEffect(() => {
    if (!branchOptions.includes(branch)) {
      setBranch(branchOptions[0])
      setCityFilter(ALL_CITIES)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream])

  const examsKey = useMemo(
    () =>
      JSON.stringify(
        exams.map((e) => [e.examName, e.stream, e.region, e.rank, e.marks]),
      ),
    [exams],
  )

  // Fetch whenever exams, category, the chosen branch, or the city changes.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (exams.length === 0 || !branch) {
        setColleges([])
        return
      }
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/domestic-colleges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exams: exams.map((e) => ({
              examName: e.examName,
              stream: e.stream,
              region: e.region,
              rank: e.rank,
              marks: e.marks,
            })),
            reservationCategory: category,
            branch,
            city: cityFilter === ALL_CITIES ? '' : cityFilter,
          }),
        })
        if (!res.ok) throw new Error('Failed to load colleges')
        const data = await res.json()
        if (cancelled) return
        const list: DomesticCollegeResult[] = Array.isArray(data.colleges)
          ? data.colleges
          : []
        setColleges(list)
        setSource(data.source === 'gemini' ? 'gemini' : 'fallback')
        // Only refresh the city dropdown from a broad (all-cities) fetch, so the
        // list of cities doesn't collapse when a single city is selected.
        if (cityFilter === ALL_CITIES) {
          setCityOptions(
            Array.from(new Set(list.map((c) => c.city).filter(Boolean))).sort(),
          )
        }
        if (list.length === 0)
          setError('No colleges found for this branch / city.')
      } catch {
        if (!cancelled) setError('Could not load colleges. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examsKey, category, branch, cityFilter])

  // Client-side search only (city + branch are server-driven).
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return colleges
    return colleges.filter((c) => c.name.toLowerCase().includes(needle))
  }, [colleges, search])

  // Export the currently-shown ranked list to a CSV file.
  const downloadCSV = () => {
    if (filtered.length === 0) return
    const headers = [
      'Rank',
      'College',
      'Branch',
      'College Type',
      'City',
      'State',
      'Exam',
      'Closing Cutoff',
      'Cutoff Type',
      'Fees',
    ]
    // Quote/escape a field per RFC 4180 (wrap in quotes, double inner quotes).
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = filtered.map((c, i) =>
      [
        i + 1,
        c.name,
        c.branch,
        c.collegeType,
        c.city,
        c.state,
        c.examName,
        c.closingRank ?? c.cutoffLabel,
        c.cutoffType ?? '',
        c.feesLabel,
      ]
        .map(esc)
        .join(','),
    )
    const csv = [headers.join(','), ...rows].join('\n')
    // Prepend BOM so Excel reads UTF-8 (₹ etc.) correctly.
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safeBranch = branch.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    const safeCity =
      cityFilter === ALL_CITIES ? 'all-cities' : cityFilter.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    a.href = url
    a.download = `colleges-${safeBranch}-${safeCity}-${category}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-6xl space-y-6">
      {!embedded && (
        <div>
          <h2
            className="text-2xl font-bold flex items-center gap-2"
            style={{ color: 'var(--foreground)' }}
          >
            <Target className="w-6 h-6" style={{ color: 'var(--accent)' }} />
            Domestic Admission Predictor
          </h2>
          <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>
            {hasExams ? (
              <>
                Based on {exams.map((e) => e.examName).join(', ')} · Category:{' '}
                {category} · Branch: {branch}
              </>
            ) : (
              <>Add your Indian entrance exams in onboarding Step 5 to begin.</>
            )}
          </p>
        </div>
      )}

      {/* Your entered exam scores & ranks (from onboarding Step 5) */}
      {hasExams && (
        <div className="card glass" style={{ padding: '0.875rem 1rem' }}>
          <div
            className="text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Your entered scores
          </div>
          <div className="flex flex-wrap gap-2">
            {exams.map((e) => {
              const hasRank = !!(e.rank && e.rank.trim())
              const hasMarks = !!(e.marks && e.marks.trim())
              return (
                <div
                  key={e.id}
                  className="inline-flex items-center gap-2 rounded-lg"
                  style={{
                    padding: '0.4rem 0.7rem',
                    background: 'var(--background-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span
                    className="text-sm font-semibold"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {e.examName}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    {e.stream} · {e.region}
                  </span>
                  {hasRank && (
                    <span
                      className="inline-flex items-center gap-1 text-xs"
                      style={{ color: 'var(--foreground-secondary)' }}
                    >
                      <Hash className="w-3 h-3" style={{ color: 'var(--accent)' }} />
                      Rank: <strong style={{ color: 'var(--foreground)' }}>{e.rank}</strong>
                    </span>
                  )}
                  {hasMarks && (
                    <span
                      className="inline-flex items-center gap-1 text-xs"
                      style={{ color: 'var(--foreground-secondary)' }}
                    >
                      <Award className="w-3 h-3" style={{ color: 'var(--accent)' }} />
                      Score: <strong style={{ color: 'var(--foreground)' }}>{e.marks}</strong>
                    </span>
                  )}
                  {!hasRank && !hasMarks && (
                    <span
                      className="text-xs"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      No rank / score entered
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* No exams entered → deep link to onboarding */}
      {!hasExams && (
        <div
          className="card glass flex items-start gap-3"
          style={{
            padding: '0.875rem 1rem',
            borderColor: 'var(--warning)',
            background: 'rgba(245, 158, 11, 0.08)',
          }}
        >
          <AlertCircle
            className="w-5 h-5 flex-shrink-0 mt-0.5"
            style={{ color: 'var(--warning)' }}
          />
          <div className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
            We couldn&apos;t find any exams on your profile. Add the Indian
            entrance exams you appeared for (e.g. JEE, NEET, a state CET) in
            onboarding Step 5, and we&apos;ll fetch matching colleges with
            branch-wise cutoffs.
          </div>
        </div>
      )}

      {/* Branch (required) + city (optional) selectors + search */}
      {hasExams && (
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--foreground-muted)' }}
            />
            <input
              className="input-field pl-10"
              placeholder="Search colleges..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Branch — required, no "All branches" option */}
          <div className="flex items-center gap-2">
            <Filter
              className="w-4 h-4"
              style={{ color: 'var(--foreground-muted)' }}
            />
            <select
              className="input-field"
              style={{ width: 'auto' }}
              value={branch}
              onChange={(e) => {
                setBranch(e.target.value)
                setCityFilter(ALL_CITIES)
              }}
              aria-label="Branch"
            >
              {branchOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* City — optional, narrows the fetch to one city */}
          {cityOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <MapPin
                className="w-4 h-4"
                style={{ color: 'var(--foreground-muted)' }}
              />
              <select
                className="input-field"
                style={{ width: 'auto' }}
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                aria-label="City"
              >
                <option value={ALL_CITIES}>All cities</option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Source badge + loading / error states */}
      {hasExams && (
        <div className="flex items-center gap-2 flex-wrap">
          {loading && (
            <span
              className="inline-flex items-center gap-2 text-sm"
              style={{ color: 'var(--foreground-secondary)' }}
            >
              <Loader2 className="w-4 h-4 animate-spin" /> Fetching {branch}{' '}
              colleges
              {cityFilter !== ALL_CITIES ? ` in ${cityFilter}` : ''}...
            </span>
          )}
          {!loading && source === 'gemini' && (
            <span className="badge badge-primary inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> AI-fetched
            </span>
          )}
          {!loading && source === 'fallback' && (
            <span className="badge badge-warning">offline list</span>
          )}
          {error && <span className="text-danger text-xs">{error}</span>}
        </div>
      )}

      {/* Summary tiles */}
      {hasExams && colleges.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card text-center">
            <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
              {filtered.length}
            </div>
            <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              Colleges{filtered.length !== colleges.length ? ` of ${colleges.length}` : ''}
            </div>
          </div>
          <div className="stat-card text-center">
            <div
              className="text-2xl font-bold"
              style={{ color: 'var(--foreground)' }}
            >
              {cityFilter === ALL_CITIES ? cityOptions.length : 1}
            </div>
            <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              {cityFilter === ALL_CITIES ? 'Cities' : 'City'}
            </div>
          </div>
          <div className="stat-card text-center">
            <div
              className="text-sm font-bold truncate"
              style={{ color: 'var(--foreground)' }}
              title={branch}
            >
              {branch}
            </div>
            <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              Branch
            </div>
          </div>
        </div>
      )}

      {/* Result list — ranked best-first by closing cutoff */}
      {hasExams && filtered.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--foreground-muted)' }}
            >
              {branch} · ranked by closing cutoff ({category})
              {cityFilter !== ALL_CITIES ? ` · ${cityFilter}` : ''}
            </span>
            <button
              type="button"
              onClick={downloadCSV}
              className="btn-secondary inline-flex items-center gap-1 text-xs"
            >
              <Download className="w-3.5 h-3.5" /> Download CSV
            </button>
          </div>

          {filtered.map((record, i) => {
            const isSelected = profile.targetInstituteId === record.id
            const openDetail = () => {
              setSelectedCollege(record)
              setCurrentPage('domestic-college-detail')
            }
            const openLoans = () => {
              // Make this college the loan target and hand it to the loan
              // center, which fetches real college-specific loans from it.
              setSelectedCollege(record)
              updateProfile({ targetInstituteId: record.id })
              setCurrentPage('domestic-loan-center')
            }
            return (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i, 12) * 0.03 }}
                onClick={openDetail}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openDetail()
                  }
                }}
                className="card glass glass-hover flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer"
                style={{ padding: '1rem 1.25rem' }}
              >
                {/* Rank number within the ascending list */}
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-lg font-bold"
                  style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    background: 'var(--background-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--accent)',
                  }}
                >
                  {i + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {record.name}
                    </span>
                    <span className="badge badge-primary">{record.branch}</span>
                    {record.collegeType && (
                      <span className="badge badge-success">
                        {record.collegeType}
                      </span>
                    )}
                    {isSelected && (
                      <span
                        className="inline-flex items-center gap-1 text-xs"
                        style={{ color: 'var(--success)' }}
                      >
                        <Check className="w-3.5 h-3.5" /> Selected
                      </span>
                    )}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    {[record.city, record.state].filter(Boolean).join(', ')} ·{' '}
                    {record.examName} · {record.feesLabel}
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <div
                      className="text-sm font-bold"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {record.cutoffLabel}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      closing for your category
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openDetail()
                      }}
                      className="btn-secondary inline-flex items-center gap-1"
                    >
                      <BarChart3 className="w-4 h-4" /> View details
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openLoans()
                      }}
                      className="btn-secondary inline-flex items-center gap-1"
                    >
                      <DollarSign className="w-4 h-4" /> View loans
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedCollege(record)
                        updateProfile({ targetInstituteId: record.id })
                      }}
                      className={isSelected ? 'btn-primary' : 'btn-secondary'}
                      aria-pressed={isSelected}
                    >
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1">
                          <Check className="w-4 h-4" /> Selected
                        </span>
                      ) : (
                        'Select'
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
