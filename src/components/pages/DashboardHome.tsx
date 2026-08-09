'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import {
  Globe2,
  MapPin,
  Newspaper,
  Award,
  ExternalLink,
  Loader2,
  Target,
  GraduationCap,
  DollarSign,
  BookOpen,
  Wallet,
  ArrowRight,
  Sparkles,
  Puzzle,
  Calendar,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { PageType } from '@/lib/types'

type Track = 'abroad' | 'india'

interface NewsItem {
  title: string
  link: string
  snippet?: string
  source?: string
  date?: string
}

interface ScholarshipItem {
  name: string
  provider: string
  summary?: string
  fitReason?: string
  interestOrAmount?: string
  tenureOrDeadline?: string
  applyUrl?: string
  sourceUrl?: string
}

const TRACK_KEY = 'gradpilot:dashboard-track'

export default function DashboardHome() {
  const { profile, user, setCurrentPage } = useAppStore()
  const supabase = createClient()

  // ---- profile (live from supabase) ----
  const [row, setRow] = useState<any | null>(null)
  const [loadingRow, setLoadingRow] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (cancelled) return
      setRow(data || null)
      setLoadingRow(false)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  // ---- track switcher (persisted) ----
  const inferDefault = (): Track => {
    const goal = (row?.study_goal || profile.studyGoal || '').toString().toLowerCase()
    if (goal.includes('domestic') || goal.includes('india')) return 'india'
    return 'abroad'
  }
  const [track, setTrack] = useState<Track>(() => {
    if (typeof window === 'undefined') return 'abroad'
    return (localStorage.getItem(TRACK_KEY) as Track) || 'abroad'
  })
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(TRACK_KEY, track)
  }, [track])
  // Once row arrives, gently default to whichever side matches the profile
  // unless the user has already picked.
  useEffect(() => {
    if (typeof window === 'undefined' || !row) return
    if (!localStorage.getItem(TRACK_KEY)) setTrack(inferDefault())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row])

  const r = row || {}
  const name = r.name || profile.name || 'Student'
  const targetCountries: string[] = r.target_countries || profile.targetCountries || []
  const targetState = r.state || profile.state || ''
  const targetField = r.target_field || profile.targetField || ''
  const targetDegree = r.target_degree || profile.targetDegree || ''
  const intake = r.intake_target || profile.intakeTarget || ''
  const cgpa = r.undergrad_cgpa || profile.undergradCgpa || ''

  // pull whatever exam scores are present (we have many flavours)
  const examScores: { name: string; score: string }[] = [
    { name: 'GRE', score: r.gre_score },
    { name: 'GMAT', score: r.gmat_score },
    { name: 'IELTS', score: r.ielts_score },
    { name: 'TOEFL', score: r.toefl_score },
    { name: 'GATE', score: r.gate_score },
    { name: 'CAT', score: r.cat_score },
    { name: 'JEE', score: r.jee_score },
    { name: 'NEET', score: r.neet_score },
    { name: 'CET', score: r.cet_score },
  ].filter((e) => e.score && String(e.score).trim() !== '' && String(e.score) !== '0')

  // ---- live news ----
  const [news, setNews] = useState<NewsItem[]>([])
  const [loadingNews, setLoadingNews] = useState(false)

  useEffect(() => {
    if (loadingRow) return
    let cancelled = false
    setLoadingNews(true)
    const q =
      track === 'abroad'
        ? `${targetCountries[0] || 'study abroad'} ${targetField || 'university'} admission scholarship Indian students 2026`
        : `${targetState || 'India'} ${targetField || 'engineering'} college admission scholarship 2026 cutoff`
    fetch('/api/news?q=' + encodeURIComponent(q))
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setNews(Array.isArray(d?.news) ? d.news.slice(0, 6) : [])
      })
      .catch(() => {
        if (!cancelled) setNews([])
      })
      .finally(() => {
        if (!cancelled) setLoadingNews(false)
      })
    return () => {
      cancelled = true
    }
  }, [track, loadingRow, targetCountries.join(','), targetField, targetState])

  // ---- scholarships ----
  const [scholarships, setScholarships] = useState<ScholarshipItem[]>([])
  const [loadingScholarships, setLoadingScholarships] = useState(false)

  useEffect(() => {
    if (loadingRow) return
    let cancelled = false
    setLoadingScholarships(true)
    fetch('/api/ai-journey/loan-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'scholarship',
        profileData: {
          undergrad_cgpa: cgpa,
          target_field: targetField,
          target_countries: targetCountries,
          state: targetState,
          target_degree: targetDegree,
        },
        decisionState: {
          selectedCountry: track === 'india' ? 'India' : targetCountries[0] || '',
        },
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setScholarships(Array.isArray(d?.options) ? d.options.slice(0, 3) : [])
      })
      .catch(() => {
        if (!cancelled) setScholarships([])
      })
      .finally(() => {
        if (!cancelled) setLoadingScholarships(false)
      })
    return () => {
      cancelled = true
    }
  }, [track, loadingRow, targetCountries.join(','), targetField, targetState])

  const goAbroadActions: { label: string; icon: any; page: PageType }[] = [
    { label: 'Find universities', icon: Target, page: 'admission-predictor' },
    { label: 'College match', icon: GraduationCap, page: 'college-match' },
    { label: 'Loan center', icon: DollarSign, page: 'loan-center' },
    { label: 'EMI calculator', icon: Wallet, page: 'emi-calculator' },
    { label: 'AI journey', icon: Sparkles, page: 'ai-journey' },
    { label: 'Browser extension', icon: Puzzle, page: 'extension' },
  ]

  const goIndiaActions: { label: string; icon: any; page: PageType }[] = [
    { label: 'India predictor', icon: Target, page: 'domestic-admission-predictor' },
    { label: 'College match', icon: GraduationCap, page: 'college-match' },
    { label: 'Domestic loans', icon: DollarSign, page: 'domestic-loan-center' },
    { label: 'EMI calculator', icon: Wallet, page: 'emi-calculator' },
    { label: 'Scholarships', icon: Award, page: 'scholarship-hunter' },
    { label: 'Browser extension', icon: Puzzle, page: 'extension' },
  ]

  const actions = track === 'abroad' ? goAbroadActions : goIndiaActions

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-6">
      {/* HERO */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative rounded-3xl overflow-hidden border"
        style={{
          borderColor: 'var(--border)',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(6,182,212,0.06))',
        }}
      >
        <div className="absolute inset-0 pointer-events-none bg-grid opacity-50" />
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
                Welcome back, {name.split(' ')[0]}.
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--foreground-secondary)' }}>
                Pick a track and we'll line up the right colleges, scholarships, and updates for you.
              </p>
            </div>
            <TrackSwitcher track={track} onChange={setTrack} />
          </div>

          {/* Personal snapshot strip */}
          <AnimatePresence mode="wait">
            <motion.div
              key={track}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              <Stat label={track === 'abroad' ? 'Target country' : 'Home state'} value={track === 'abroad' ? targetCountries[0] || '—' : targetState || '—'} icon={track === 'abroad' ? Globe2 : MapPin} />
              <Stat label="Target degree" value={targetDegree || '—'} icon={GraduationCap} />
              <Stat label="Field of interest" value={targetField || '—'} icon={BookOpen} />
              <Stat label="Intake" value={intake || '—'} icon={Calendar} />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column: actions + scores */}
        <div className="lg:col-span-1 space-y-5">
          <Card title="Quick actions" icon={ArrowRight}>
            <div className="grid grid-cols-2 gap-2">
              {actions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => setCurrentPage(a.page)}
                  className="group flex items-center gap-2 rounded-xl px-3 py-3 text-left transition-all"
                  style={{
                    background: 'var(--background-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--primary-light)' }}
                  >
                    <a.icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--foreground)' }}>
                    {a.label}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </Card>

          <Card title="Your test scores" icon={Award}>
            {examScores.length === 0 ? (
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                No exam scores yet.
                <button
                  onClick={() => setCurrentPage('profile')}
                  className="ml-1 text-primary-light underline"
                >
                  Add them in Profile
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {examScores.map((e) => (
                  <div
                    key={e.name}
                    className="rounded-lg px-3 py-2"
                    style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}
                  >
                    <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--foreground-muted)' }}>
                      {e.name}
                    </div>
                    <div className="text-base font-bold" style={{ color: 'var(--primary-light)' }}>
                      {e.score}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {cgpa && (
              <div className="mt-3 text-xs" style={{ color: 'var(--foreground-secondary)' }}>
                Undergrad CGPA: <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{cgpa}</span>
              </div>
            )}
          </Card>
        </div>

        {/* Center column: news */}
        <div className="lg:col-span-2 space-y-5">
          <Card
            title={track === 'abroad' ? 'News for your destinations' : 'Updates from your region'}
            icon={Newspaper}
            right={
              <button onClick={() => setCurrentPage('news')} className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--primary-light)' }}>
                See all <ArrowRight className="w-3 h-3" />
              </button>
            }
          >
            {loadingNews ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : news.length === 0 ? (
              <div className="text-sm py-3" style={{ color: 'var(--foreground-muted)' }}>
                No news right now. Check back later.
              </div>
            ) : (
              <ul className="space-y-3">
                {news.map((n, i) => (
                  <li key={i}>
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-3 rounded-xl p-3 transition-all"
                      style={{
                        background: 'var(--background-secondary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(6,182,212,0.10)', color: 'var(--secondary-light)' }}
                      >
                        <Newspaper className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm leading-snug line-clamp-2" style={{ color: 'var(--foreground)' }}>
                          {n.title}
                        </div>
                        <div className="text-xs mt-1 truncate" style={{ color: 'var(--foreground-muted)' }}>
                          {n.source || new URL(n.link).hostname} {n.date ? `· ${n.date}` : ''}
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* SCHOLARSHIPS */}
      <Card
        title={track === 'abroad' ? 'Scholarships matching your profile' : 'Indian scholarships & schemes'}
        icon={Award}
        right={
          <button
            onClick={() => setCurrentPage('scholarship-hunter')}
            className="text-xs font-semibold flex items-center gap-1"
            style={{ color: 'var(--primary-light)' }}
          >
            Open hunter <ArrowRight className="w-3 h-3" />
          </button>
        }
      >
        {loadingScholarships ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : scholarships.length === 0 ? (
          <div className="text-sm py-3" style={{ color: 'var(--foreground-muted)' }}>
            We couldn't fetch live scholarships right now. Open the Scholarships page to browse them.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {scholarships.map((s, i) => (
              <a
                key={i}
                href={s.applyUrl || s.sourceUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="card flex flex-col gap-2 hover:border-primary transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(245,158,11,0.10)', color: 'var(--accent-light)' }}
                  >
                    <Award className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm leading-tight" style={{ color: 'var(--foreground)' }}>
                      {s.name}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
                      {s.provider}
                    </div>
                  </div>
                </div>
                {s.summary && (
                  <p className="text-xs" style={{ color: 'var(--foreground-secondary)' }}>
                    {s.summary}
                  </p>
                )}
                <div className="flex items-center justify-between mt-auto pt-2">
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--accent-light)' }}>
                    {s.interestOrAmount || '—'}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
                    {s.tenureOrDeadline || ''}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </Card>

      {/* CTA: extension */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card-gradient card flex flex-col sm:flex-row items-center gap-4 p-6"
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white"
          style={{ background: 'var(--gradient-primary)' }}
        >
          <Puzzle className="w-7 h-7" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="font-bold" style={{ color: 'var(--foreground)' }}>
            Auto-fill any application form with the EduPilot extension
          </h3>
          <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
            Maps your profile to any university/loan portal in one click. Voice typo guard included.
          </p>
        </div>
        <button
          onClick={() => setCurrentPage('extension')}
          className="btn-primary inline-flex items-center gap-2 whitespace-nowrap"
        >
          Get it now <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  )
}

// ---------- helpers ----------

function TrackSwitcher({ track, onChange }: { track: Track; onChange: (t: Track) => void }) {
  return (
    <div
      className="inline-flex p-1 rounded-2xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {(['abroad', 'india'] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          style={{
            background: track === t ? 'var(--gradient-primary)' : 'transparent',
            color: track === t ? 'white' : 'var(--foreground-secondary)',
          }}
        >
          {t === 'abroad' ? <Globe2 className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
          {t === 'abroad' ? 'Study Abroad' : 'Study in India'}
        </button>
      ))}
    </div>
  )
}

function Card({
  title,
  icon: Icon,
  children,
  right,
}: {
  title: string
  icon: any
  children: any
  right?: any
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--primary-light)' }}
          >
            <Icon className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
            {title}
          </h2>
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--foreground-muted)' }}>
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-sm font-bold mt-1 truncate" style={{ color: 'var(--foreground)' }}>
        {value}
      </div>
    </div>
  )
}
