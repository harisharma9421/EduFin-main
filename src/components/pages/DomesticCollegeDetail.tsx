'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Domestic College Detail
//
// Opened when the student clicks "Select / View" on a college in the Domestic
// Admission Predictor. Shows rich, branch-selectable statistics fetched from
// the Gemini-backed `/api/college-detail` route:
//   - Overview + quick stats + overall rating
//   - Placements (user picks which branch's data to view)
//   - Curriculum (user picks which branch)
//   - Student reviews
//   - Campus / facilities info
//
// Conventions:
//   - Client Component (Zustand selector + local state).
//   - Theme: only existing utility classes and `var(--*)` tokens. No hex literals.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Star,
  Briefcase,
  BookOpen,
  MessageSquare,
  Building2,
  TrendingUp,
  Users,
  MapPin,
  Award,
  Check,
  Link as LinkIcon,
  ExternalLink,
  Download,
  FileText,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { useAppStore } from '@/lib/store'
import type { DomesticCollegeDetailData, EntranceExamStream } from '@/lib/types'
import { downloadHTMLReport, downloadPDFReport } from '@/lib/domesticReport'

type TabKey = 'overview' | 'placements' | 'curriculum' | 'reviews' | 'campus'

const TABS: { key: TabKey; label: string; icon: typeof Briefcase }[] = [
  { key: 'overview', label: 'Overview', icon: TrendingUp },
  { key: 'placements', label: 'Placements', icon: Briefcase },
  { key: 'curriculum', label: 'Curriculum', icon: BookOpen },
  { key: 'reviews', label: 'Reviews', icon: MessageSquare },
  { key: 'campus', label: 'Campus', icon: Building2 },
]

// Small star-rating renderer (out of 5).
function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating)
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className="w-4 h-4"
          style={{
            color: i < full ? 'var(--warning)' : 'var(--border)',
            fill: i < full ? 'var(--warning)' : 'transparent',
          }}
        />
      ))}
    </span>
  )
}

export default function DomesticCollegeDetail() {
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)
  const selectedCollege = useAppStore((s) => s.selectedCollege)
  const profile = useAppStore((s) => s.profile)
  const updateProfile = useAppStore((s) => s.updateProfile)

  const stream: EntranceExamStream =
    selectedCollege?.stream === 'Medical' ? 'Medical' : 'Engineering'

  const [detail, setDetail] = useState<DomesticCollegeDetailData | null>(null)
  const [sources, setSources] = useState<{ name: string; url: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState<'serper+gemini' | 'gemini' | 'fallback' | ''>('')
  const [tab, setTab] = useState<TabKey>('overview')

  // Branch selectors (independent for placements & curriculum).
  const [placementBranch, setPlacementBranch] = useState('')
  const [placementYear, setPlacementYear] = useState('')
  const [curriculumBranch, setCurriculumBranch] = useState('')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!selectedCollege) return
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/college-detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: selectedCollege.name,
            city: selectedCollege.city,
            state: selectedCollege.state,
            collegeType: selectedCollege.collegeType,
            branch: selectedCollege.branch,
            stream: selectedCollege.stream,
          }),
        })
        if (!res.ok) throw new Error('Failed to load college detail')
        const data = await res.json()
        if (cancelled) return
        const d: DomesticCollegeDetailData = data.detail
        setDetail(d)
        setSource(
          data.source === 'serper+gemini'
            ? 'serper+gemini'
            : data.source === 'gemini'
              ? 'gemini'
              : 'fallback',
        )
        setSources(Array.isArray(data.sources) ? data.sources : [])
        // Default the branch selectors to the branch the student came in on,
        // falling back to the first available.
        const pick = (list: { branch: string }[]) => {
          const match = list.find(
            (x) => x.branch.toLowerCase() === selectedCollege.branch.toLowerCase(),
          )
          return match?.branch ?? list[0]?.branch ?? ''
        }
        setPlacementBranch(pick(d.placements))
        setCurriculumBranch(pick(d.curricula))
      } catch {
        if (!cancelled) setError('Could not load college details. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [selectedCollege])

  const activePlacement = useMemo(
    () => detail?.placements.find((p) => p.branch === placementBranch) ?? detail?.placements[0],
    [detail, placementBranch],
  )
  // Years available for the active branch (most recent first).
  const placementYears = useMemo(
    () => activePlacement?.years ?? [],
    [activePlacement],
  )
  // Default to the most recent year whenever the branch (and thus its years) changes.
  useEffect(() => {
    if (placementYears.length > 0) {
      setPlacementYear((prev) =>
        placementYears.some((y) => y.year === prev) ? prev : placementYears[0].year,
      )
    }
  }, [placementYears])
  const activeYearStat = useMemo(
    () => placementYears.find((y) => y.year === placementYear) ?? placementYears[0],
    [placementYears, placementYear],
  )
  const activeCurriculum = useMemo(
    () => detail?.curricula.find((c) => c.branch === curriculumBranch) ?? detail?.curricula[0],
    [detail, curriculumBranch],
  )

  // No college in context → guide the user back.
  if (!selectedCollege) {
    return (
      <div className="max-w-3xl space-y-4">
        <button
          type="button"
          onClick={() => setCurrentPage('domestic-admission-predictor')}
          className="btn-secondary inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to predictor
        </button>
        <div className="card glass" style={{ padding: '1.25rem' }}>
          <p style={{ color: 'var(--foreground-secondary)' }}>
            Pick a college from the Domestic Admission Predictor to see its detailed
            placement, curriculum, reviews and campus stats.
          </p>
        </div>
      </div>
    )
  }

  const isSelected = profile.targetInstituteId === selectedCollege.id
  const isMedical = stream === 'Medical'

  return (
    <div className="max-w-6xl space-y-6">
      {/* Back + header */}
      <div>
        <button
          type="button"
          onClick={() => setCurrentPage('domestic-admission-predictor')}
          className="btn-secondary inline-flex items-center gap-1 text-sm mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to predictor
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h2
              className="text-2xl font-bold flex items-center gap-2 flex-wrap"
              style={{ color: 'var(--foreground)' }}
            >
              {selectedCollege.name}
            </h2>
            <div
              className="mt-1 text-sm flex items-center gap-2 flex-wrap"
              style={{ color: 'var(--foreground-secondary)' }}
            >
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {[selectedCollege.city, selectedCollege.state].filter(Boolean).join(', ')}
              </span>
              {selectedCollege.collegeType && (
                <span className="badge badge-success">{selectedCollege.collegeType}</span>
              )}
              <span className="badge badge-primary">{selectedCollege.branch}</span>
              {detail && (
                <span className="inline-flex items-center gap-1">
                  <Stars rating={detail.overallRating} />
                  <span className="text-xs">{detail.overallRating.toFixed(1)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => downloadHTMLReport(profile, selectedCollege, detail)}
              className="btn-secondary inline-flex items-center gap-1.5 text-sm"
              title="Download an interactive HTML report"
            >
              <Download className="w-4 h-4" /> HTML
            </button>
            <button
              type="button"
              onClick={() => downloadPDFReport(profile, selectedCollege, detail)}
              className="btn-secondary inline-flex items-center gap-1.5 text-sm"
              title="Open a print-ready PDF report"
            >
              <FileText className="w-4 h-4" /> PDF
            </button>
            <button
              type="button"
              onClick={() => updateProfile({ targetInstituteId: selectedCollege.id })}
              className={isSelected ? 'btn-primary' : 'btn-secondary'}
              aria-pressed={isSelected}
            >
              {isSelected ? (
                <span className="inline-flex items-center gap-1">
                  <Check className="w-4 h-4" /> Selected as target
                </span>
              ) : (
                'Set as target institute'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* AI source badge */}
      <div className="flex items-center gap-2 flex-wrap">
        {loading && (
          <span
            className="inline-flex items-center gap-2 text-sm"
            style={{ color: 'var(--foreground-secondary)' }}
          >
            <Loader2 className="w-4 h-4 animate-spin" /> Fetching detailed stats for{' '}
            {selectedCollege.name}...
          </span>
        )}
        {!loading && source === 'serper+gemini' && (
          <span className="badge badge-primary inline-flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Live web data (Google + AI)
          </span>
        )}
        {!loading && source === 'gemini' && (
          <span className="badge badge-primary inline-flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> AI-generated insights
          </span>
        )}
        {!loading && source === 'fallback' && (
          <span className="badge badge-warning">estimated (offline)</span>
        )}
        {error && <span className="text-danger text-xs">{error}</span>}
      </div>

      {/* Source attribution links (real-data provenance) */}
      {!loading && sources.length > 0 && (
        <div
          className="flex items-center gap-2 flex-wrap text-xs"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <span className="inline-flex items-center gap-1">
            <LinkIcon className="w-3 h-3" /> Sourced from:
          </span>
          {sources.map((s, i) => (
            <a
              key={`${s.url}-${i}`}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="loan-link inline-flex items-center gap-1"
            >
              {s.name || 'source'}
              <ExternalLink className="w-3 h-3" />
            </a>
          ))}
        </div>
      )}

      {!loading && detail && (
        <>
          {/* Quick stats */}
          {detail.quickStats.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {detail.quickStats.slice(0, 4).map((s) => (
                <div key={s.label} className="stat-card text-center">
                  <div className="text-lg font-bold" style={{ color: 'var(--accent)' }}>
                    {s.value}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap border-b" style={{ borderColor: 'var(--border)' }}>
            {TABS.map((t) => {
              const Icon = t.icon
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 -mb-px border-b-2 transition-colors"
                  style={{
                    color: active ? 'var(--accent)' : 'var(--foreground-secondary)',
                    borderColor: active ? 'var(--accent)' : 'transparent',
                  }}
                >
                  <Icon className="w-4 h-4" /> {t.label}
                </button>
              )
            })}
          </div>

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="card glass" style={{ padding: '1.25rem' }}>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground-secondary)' }}>
                  {detail.overview}
                </p>
              </div>
              {detail.quickStats.length > 0 && (
                <div className="card glass" style={{ padding: '1.25rem' }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {detail.quickStats.map((s) => (
                      <div key={s.label} className="flex items-center justify-between text-sm">
                        <span style={{ color: 'var(--foreground-muted)' }}>{s.label}</span>
                        <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                          {s.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Placements (branch-selectable) ── */}
          {tab === 'placements' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {detail.placements.length === 0 ? (
                <div className="card glass" style={{ padding: '1.25rem' }}>
                  <p style={{ color: 'var(--foreground-secondary)' }}>
                    Placement data is not available for this college.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        Branch:
                      </span>
                      <select
                        className="input-field"
                        style={{ width: 'auto' }}
                        value={placementBranch}
                        onChange={(e) => setPlacementBranch(e.target.value)}
                        aria-label="Placement branch"
                      >
                        {detail.placements.map((p) => (
                          <option key={p.branch} value={p.branch}>
                            {p.branch}
                          </option>
                        ))}
                      </select>
                    </div>

                    {placementYears.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                          Year:
                        </span>
                        <select
                          className="input-field"
                          style={{ width: 'auto' }}
                          value={placementYear}
                          onChange={(e) => setPlacementYear(e.target.value)}
                          aria-label="Placement year"
                        >
                          {placementYears.map((y) => (
                            <option key={y.year} value={y.year}>
                              {y.year}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {activeYearStat && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="stat-card text-center">
                          <div className="text-2xl font-bold" style={{ color: 'var(--success)' }}>
                            {activeYearStat.placementRate}%
                          </div>
                          <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                            Placed ({activeYearStat.year})
                          </div>
                        </div>
                        {!isMedical && (
                          <>
                            <div className="stat-card text-center">
                              <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
                                ₹{activeYearStat.avgPackageLPA}L
                              </div>
                              <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                Avg package
                              </div>
                            </div>
                            <div className="stat-card text-center">
                              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                                ₹{activeYearStat.medianPackageLPA}L
                              </div>
                              <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                Median
                              </div>
                            </div>
                            <div className="stat-card text-center">
                              <div className="text-2xl font-bold" style={{ color: 'var(--warning)' }}>
                                ₹{activeYearStat.highestPackageLPA}L
                              </div>
                              <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                Highest
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Year-on-year placement trend for this branch */}
                      {!isMedical && placementYears.length > 1 && (
                        <div className="card glass" style={{ padding: '1.25rem' }}>
                          <div
                            className="text-sm font-medium mb-3"
                            style={{ color: 'var(--foreground)' }}
                          >
                            Year-on-year package trend (LPA) · {placementBranch}
                          </div>
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart
                              data={[...placementYears]
                                .slice()
                                .reverse()
                                .map((y) => ({
                                  year: y.year,
                                  Average: y.avgPackageLPA,
                                  Median: y.medianPackageLPA,
                                  Highest: y.highestPackageLPA,
                                }))}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                              <XAxis dataKey="year" tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }} />
                              <YAxis tick={{ fill: 'var(--foreground-muted)', fontSize: 11 }} />
                              <Tooltip
                                contentStyle={{
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 8,
                                }}
                                formatter={(v, n) => [`₹${v}L`, n as string]}
                              />
                              <Legend wrapperStyle={{ fontSize: 12 }} />
                              <Bar dataKey="Average" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Median" fill="var(--foreground-muted)" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Highest" fill="var(--warning)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Placement-rate trend */}
                      {placementYears.length > 1 && (
                        <div className="card glass" style={{ padding: '1.25rem' }}>
                          <div
                            className="text-sm font-medium mb-3"
                            style={{ color: 'var(--foreground)' }}
                          >
                            Placement rate trend (%)
                          </div>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart
                              data={[...placementYears]
                                .slice()
                                .reverse()
                                .map((y) => ({ year: y.year, rate: y.placementRate }))}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                              <XAxis dataKey="year" tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }} />
                              <YAxis domain={[0, 100]} tick={{ fill: 'var(--foreground-muted)', fontSize: 11 }} />
                              <Tooltip
                                contentStyle={{
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 8,
                                }}
                                formatter={(v) => [`${v}%`, 'Placed']}
                              />
                              <Bar dataKey="rate" fill="var(--success)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {activeYearStat.topRecruiters.length > 0 && (
                        <div className="card glass" style={{ padding: '1.25rem' }}>
                          <div
                            className="text-sm font-medium mb-3 inline-flex items-center gap-1.5"
                            style={{ color: 'var(--foreground)' }}
                          >
                            <Briefcase className="w-4 h-4" />
                            {isMedical ? 'Career paths / hospitals' : 'Top recruiters'} ({activeYearStat.year})
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {activeYearStat.topRecruiters.map((r) => (
                              <span key={r} className="badge badge-primary">
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ── Curriculum (branch-selectable) ── */}
          {tab === 'curriculum' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {detail.curricula.length === 0 ? (
                <div className="card glass" style={{ padding: '1.25rem' }}>
                  <p style={{ color: 'var(--foreground-secondary)' }}>
                    Curriculum data is not available for this college.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      Choose branch:
                    </span>
                    <select
                      className="input-field"
                      style={{ width: 'auto' }}
                      value={curriculumBranch}
                      onChange={(e) => setCurriculumBranch(e.target.value)}
                      aria-label="Curriculum branch"
                    >
                      {detail.curricula.map((c) => (
                        <option key={c.branch} value={c.branch}>
                          {c.branch}
                        </option>
                      ))}
                    </select>
                  </div>

                  {activeCurriculum && (
                    <div className="card glass" style={{ padding: '1.25rem' }}>
                      <div
                        className="text-sm mb-4"
                        style={{ color: 'var(--foreground-secondary)' }}
                      >
                        <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                          {activeCurriculum.degree}
                        </span>{' '}
                        · {activeCurriculum.durationYears} years
                      </div>
                      <div className="space-y-4">
                        {activeCurriculum.years.map((y) => (
                          <div key={y.year}>
                            <div
                              className="text-xs font-semibold uppercase tracking-wide mb-2"
                              style={{ color: 'var(--accent)' }}
                            >
                              {y.year}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {y.subjects.map((s, i) => (
                                <span
                                  key={`${y.year}-${i}`}
                                  className="text-xs rounded-md"
                                  style={{
                                    padding: '0.3rem 0.6rem',
                                    background: 'var(--background-secondary)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--foreground-secondary)',
                                  }}
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ── Reviews ── */}
          {tab === 'reviews' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {detail.reviews.length === 0 ? (
                <div className="card glass" style={{ padding: '1.25rem' }}>
                  <p style={{ color: 'var(--foreground-secondary)' }}>
                    No student reviews available yet.
                  </p>
                </div>
              ) : (
                detail.reviews.map((r, i) => (
                  <div key={i} className="card glass" style={{ padding: '1.1rem 1.25rem' }}>
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" style={{ color: 'var(--foreground-muted)' }} />
                        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                          {r.author}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                          {[r.branch, r.batch].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      <Stars rating={r.rating} />
                    </div>
                    {r.comment && (
                      <p className="text-sm mb-2" style={{ color: 'var(--foreground-secondary)' }}>
                        {r.comment}
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {r.pros && (
                        <div style={{ color: 'var(--success)' }}>
                          <strong>+ Pros:</strong>{' '}
                          <span style={{ color: 'var(--foreground-secondary)' }}>{r.pros}</span>
                        </div>
                      )}
                      {r.cons && (
                        <div style={{ color: 'var(--danger)' }}>
                          <strong>− Cons:</strong>{' '}
                          <span style={{ color: 'var(--foreground-secondary)' }}>{r.cons}</span>
                        </div>
                      )}
                    </div>
                    {r.sourceUrl && (
                      <a
                        href={r.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="loan-link inline-flex items-center gap-1 text-xs mt-2"
                      >
                        View source
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </motion.div>
          )}

          {/* ── Campus ── */}
          {tab === 'campus' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="card glass" style={{ padding: '1.25rem' }}>
                <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--foreground-secondary)' }}>
                  {detail.campus.summary}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  {detail.campus.established != null && (
                    <div>
                      <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Established</div>
                      <div className="font-semibold" style={{ color: 'var(--foreground)' }}>
                        {detail.campus.established}
                      </div>
                    </div>
                  )}
                  {detail.campus.campusSizeAcres != null && (
                    <div>
                      <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Campus size</div>
                      <div className="font-semibold" style={{ color: 'var(--foreground)' }}>
                        {detail.campus.campusSizeAcres} acres
                      </div>
                    </div>
                  )}
                  {detail.campus.nirfRank != null && (
                    <div>
                      <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>NIRF rank</div>
                      <div className="font-semibold" style={{ color: 'var(--foreground)' }}>
                        #{detail.campus.nirfRank}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Hostel</div>
                    <div className="font-semibold" style={{ color: 'var(--foreground)' }}>
                      {detail.campus.hostelAvailable ? 'Available' : 'Not available'}
                    </div>
                  </div>
                  {detail.campus.location && (
                    <div>
                      <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Location</div>
                      <div className="font-semibold" style={{ color: 'var(--foreground)' }}>
                        {detail.campus.location}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {detail.campus.facilities.length > 0 && (
                <div className="card glass" style={{ padding: '1.25rem' }}>
                  <div
                    className="text-sm font-medium mb-3 inline-flex items-center gap-1.5"
                    style={{ color: 'var(--foreground)' }}
                  >
                    <Building2 className="w-4 h-4" /> Facilities
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detail.campus.facilities.map((f) => (
                      <span key={f} className="badge badge-success">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {detail.campus.accreditation.length > 0 && (
                <div className="card glass" style={{ padding: '1.25rem' }}>
                  <div
                    className="text-sm font-medium mb-3 inline-flex items-center gap-1.5"
                    style={{ color: 'var(--foreground)' }}
                  >
                    <Award className="w-4 h-4" /> Accreditation
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detail.campus.accreditation.map((a) => (
                      <span key={a} className="badge badge-primary">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
