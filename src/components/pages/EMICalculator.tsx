'use client'

// ─────────────────────────────────────────────────────────────────────────────
// LOAN INTELLIGENCE ENGINE
// Replaces the original EMI Calculator. Pulls the user's actual profile,
// fetches live salary + tuition data (Gemini + Serper) with 24h localStorage
// caching, and lets the user explore conservative/smart/full coverage plans
// with rich what-if scenarios. Design tokens (colors, fonts, surfaces) are
// reused exactly as defined globally — no theming changes.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { formatINR, calculateEMI as calcEMI } from '@/lib/utils'
import { countries as RAW_COUNTRIES } from 'countries-list'
import {
  budgetToINR, buildScenarios, calculate80ESaving, calculateROIScore, computeEMI,
  courseDurationYears, detectCountry, detectCourse, detectUniversity, FX, FX_USD_INR,
  personalizedRate, readCache, writeCache,
} from '@/lib/loanIntel'
import {
  Calculator, Sparkles, Share2, Edit, AlertCircle, ExternalLink, Loader2, Lightbulb,
  CheckCircle, TrendingUp, MapPin, GraduationCap, Calendar, Wallet, Star, ShieldCheck,
  Clock, BadgeCheck, ArrowRight, Download, Copy, Globe2, Info, Table as TableIcon, BarChart3,
  FileText, ChevronDown, Search as SearchIcon, X,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Line, ComposedChart, ReferenceLine,
} from 'recharts'
import { downloadHTMLReport, downloadPDFReport, type EMIReportInput } from '@/lib/emiReport'

// ─────────────────────────────────────────────────────────────────────────────
// Local types for fetched intel
// ─────────────────────────────────────────────────────────────────────────────
interface SalaryIntel { min: number; avg: number; top: number; currency: string }
interface CountryIntel {
  avgSalaryLocal: number; avgSalaryINR: number; currency: string
  visaSummary: string; recommendedMaxLoanINR: number; recommendedReason: string
  risks: string[]; moneyTip: string
}
interface TuitionIntel {
  tuitionUSD: number; tuitionINR: number; source: string; sourceUrl: string; note: string
}

// Country flag emojis for the share card / hero strip.
const COUNTRY_FLAGS: Record<string, string> = {
  USA: '🇺🇸', UK: '🇬🇧', CANADA: '🇨🇦', AUSTRALIA: '🇦🇺', GERMANY: '🇩🇪',
  IRELAND: '🇮🇪', SINGAPORE: '🇸🇬', NETHERLANDS: '🇳🇱', FRANCE: '🇫🇷', NEWZEALAND: '🇳🇿',
}
const flagOf = (country: string) => COUNTRY_FLAGS[String(country || '').toUpperCase().replace(/\s+/g, '')] || '🌍'

// Strip protocol + path so we render only the domain name as the source pill.
function hostFrom(input: string): string {
  if (!input) return ''
  if (input.startsWith('http')) {
    try { return new URL(input).hostname.replace(/^www\./, '') } catch { return input }
  }
  // Already a domain or human label like "mastersinai.org" / "Estimate".
  return input.replace(/^www\./, '')
}

// Cheap skeleton block that matches the existing surface tokens.
const Skeleton = ({ h = 16, w = '100%' }: { h?: number; w?: string | number }) => (
  <div className="rounded-md animate-pulse" style={{ height: h, width: w as any, background: 'var(--background-secondary)' }} />
)

// ── Country options for the picker (250+ from countries-list, sorted A→Z) ──
interface CountryOption { code: string; name: string; currency: string }
const COUNTRY_OPTIONS: CountryOption[] = Object.entries(RAW_COUNTRIES)
  .map(([code, info]) => ({
    code,
    name: (info as any).name as string,
    currency: ((info as any).currency?.[0] || 'USD') as string,
  }))
  .filter((c) => c.currency && c.currency.length === 3)
  .sort((a, b) => a.name.localeCompare(b.name))

const findCountryByName = (name?: string): CountryOption | undefined => {
  if (!name) return undefined
  const n = name.trim().toLowerCase()
  return COUNTRY_OPTIONS.find((c) => c.name.toLowerCase() === n || c.code.toLowerCase() === n)
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function LoanIntelligenceEngine() {
  const { profile, setCurrentPage } = useAppStore()

  // Profile-derived defaults
  const profileCountryName = useMemo(() => detectCountry(profile), [profile])
  const initialCountry =
    findCountryByName(profileCountryName) ||
    findCountryByName('USA') ||
    COUNTRY_OPTIONS[0]
  // `countryOpt` = what's selected in the dropdown (preview).
  // `appliedCountry` = what the page actually computes against — only changes
  // when the user clicks "Calculate" so we don't burn API quota mid-typing.
  const [countryOpt, setCountryOpt] = useState<CountryOption>(initialCountry)
  const [appliedCountry, setAppliedCountry] = useState<CountryOption>(initialCountry)
  const country = appliedCountry.name
  const dirtyCountry = countryOpt.code !== appliedCountry.code
  const course = useMemo(() => detectCourse(profile), [profile])
  const university = useMemo(() => detectUniversity(profile), [profile])
  const duration = useMemo(() => courseDurationYears(profile), [profile])
  const intake = profile.intakeTarget || 'Fall 2026'
  const familyIncome = profile.familyIncomeStr || 'Not set'

  // ── Live intel state ──────────────────────────────────────────────────────
  const [salary, setSalary] = useState<SalaryIntel | null>(null)
  const [salaryLoading, setSalaryLoading] = useState(true)
  const [salarySource, setSalarySource] = useState<'gemini' | 'fallback' | ''>('')

  const [tuition, setTuition] = useState<TuitionIntel | null>(null)
  const [tuitionLoading, setTuitionLoading] = useState(true)
  const [tuitionSource, setTuitionSource] = useState<'serper' | 'fallback' | ''>('')

  const [countryIntel, setCountryIntel] = useState<CountryIntel | null>(null)
  const [countryLoading, setCountryLoading] = useState(true)

  // Fires the three live calls in parallel; localStorage caches them for 24h.
  useEffect(() => {
    let cancelled = false

    // Reset all three to loading + null first so we never render stale data
    // from the previous country while the new fetch is in flight.
    setSalary(null); setSalarySource(''); setSalaryLoading(true)
    setTuition(null); setTuitionSource(''); setTuitionLoading(true)
    setCountryIntel(null); setCountryLoading(true)

    const cacheSalary = `salary.${country}.${course}`
    const cacheTuition = `tuition.${country}.${university}.${course}`
    const cacheCountry = `country.${country}.${course}`

    const cachedSalary = readCache<{ data: SalaryIntel; source: 'gemini' | 'fallback' }>(cacheSalary)
    const cachedTuition = readCache<{ data: TuitionIntel; source: 'serper' | 'fallback' }>(cacheTuition)
    const cachedCountry = readCache<{ data: CountryIntel; source: string }>(cacheCountry)

    if (cachedSalary) { setSalary(cachedSalary.data); setSalarySource(cachedSalary.source); setSalaryLoading(false) }
    if (cachedTuition) { setTuition(cachedTuition.data); setTuitionSource(cachedTuition.source); setTuitionLoading(false) }
    if (cachedCountry) { setCountryIntel(cachedCountry.data); setCountryLoading(false) }

    if (!cachedSalary) {
      fetch('/api/loan-intel/salary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ course, country }) })
        .then(r => r.json()).then(j => {
          if (cancelled) return
          if (j?.data) {
            setSalary(j.data); setSalarySource(j.source)
            writeCache(cacheSalary, { data: j.data, source: j.source })
          }
          setSalaryLoading(false)
        }).catch(() => { if (!cancelled) setSalaryLoading(false) })
    }

    if (!cachedTuition) {
      fetch('/api/loan-intel/tuition', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ university, course, country }) })
        .then(r => r.json()).then(j => {
          if (cancelled) return
          if (j?.data) {
            setTuition(j.data); setTuitionSource(j.source)
            writeCache(cacheTuition, { data: j.data, source: j.source })
          }
          setTuitionLoading(false)
        }).catch(() => { if (!cancelled) setTuitionLoading(false) })
    }

    if (!cachedCountry) {
      const loanGuess = budgetToINR(profile) || 4000000
      fetch('/api/loan-intel/country', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country, course, loanAmountINR: loanGuess }) })
        .then(r => r.json()).then(j => {
          if (cancelled) return
          if (j?.data) {
            setCountryIntel(j.data)
            writeCache(cacheCountry, { data: j.data, source: j.source })
          }
          setCountryLoading(false)
        }).catch(() => { if (!cancelled) setCountryLoading(false) })
    }
    return () => { cancelled = true }
  }, [country, course, university, profile])

  // ── Cost & scenarios (computed from live data when present) ───────────────
  // Both tuition and living come from /api/cost-of-study (AI-grounded for the
  // selected country / college). We keep them in state so changing country
  // re-fetches and the 3 scenario cards re-derive automatically.
  const [tuitionPerYearINR, setTuitionPerYearINR] = useState<number>(
    tuition?.tuitionINR || (budgetToINR(profile) ? budgetToINR(profile) / Math.max(1, duration) : 35000 * FX_USD_INR),
  )
  const [livingPerYearINR, setLivingPerYearINR] = useState<number>(1200000)
  const [costsLoading, setCostsLoading] = useState(false)

  // Live FX cache. Always pre-fetch USD→INR up front because it powers the
  // tuition/living conversion below; salary currency rates are pulled lazily.
  const [liveFx, setLiveFx] = useState<Record<string, number>>({})
  useEffect(() => {
    fetch(`/api/forex?from=USD&to=INR`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.rate && isFinite(j.rate) && j.rate > 0) {
          setLiveFx((prev) => ({ ...prev, USD: j.rate }))
        }
      })
      .catch(() => {})
  }, [])

  // Re-fetch live tuition + living whenever country / university / course changes.
  useEffect(() => {
    let cancelled = false
    setCostsLoading(true)
    fetch('/api/cost-of-study', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        university,
        country,
        program: course,
        durationYears: duration,
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        const t = Number(j?.tuitionPerYearUSD)
        const l = Number(j?.livingPerYearUSD)
        const usdInr = liveFx['USD'] || FX_USD_INR
        if (isFinite(t) && t >= 0) setTuitionPerYearINR(Math.round(t * usdInr))
        if (isFinite(l) && l >= 0) setLivingPerYearINR(Math.round(l * usdInr))
      })
      .catch(() => {})
      .finally(() => !cancelled && setCostsLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, university, course, duration, liveFx['USD']])

  const totalProgrammeCostINR = (tuitionPerYearINR + livingPerYearINR) * duration
  const totalProgrammeCostLakhs = totalProgrammeCostINR / 100000

  const scenarios = useMemo(() => buildScenarios(totalProgrammeCostLakhs), [totalProgrammeCostLakhs])

  // ── Selected plan + sliders ───────────────────────────────────────────────
  const [selectedPlan, setSelectedPlan] = useState<'conservative' | 'smart' | 'full'>('smart')
  const initialPrincipalLakhs = scenarios[selectedPlan].loanLakhs

  const [principalLakhs, setPrincipalLakhs] = useState(initialPrincipalLakhs)
  const [ratePct, setRatePct] = useState(personalizedRate(profile))
  const [tenureYears, setTenureYears] = useState(10)
  const [moratoriumMonths, setMoratoriumMonths] = useState(Math.min(duration * 12 + 6, 24))
  const [prepayLakhs, setPrepayLakhs] = useState(0)
  const [scholarshipLakhs, setScholarshipLakhs] = useState(0)
  const [partTimeMonthly, setPartTimeMonthly] = useState(0)

  // When the user picks a different scenario card, push that plan into the sliders.
  const applyPlan = (k: 'conservative' | 'smart' | 'full') => {
    setSelectedPlan(k)
    setPrincipalLakhs(scenarios[k].loanLakhs)
  }

  // Re-apply the currently-selected scenario whenever the underlying
  // programme cost changes (country switch, AI cost refresh, etc.).
  useEffect(() => {
    setPrincipalLakhs(scenarios[selectedPlan].loanLakhs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuitionPerYearINR, livingPerYearINR, duration])

  // ── Calculations ──────────────────────────────────────────────────────────
  const loan = useMemo(() => computeEMI({
    principalLakhs, ratePct, tenureYears, moratoriumMonths, prepayLakhs, scholarshipLakhs,
  }), [principalLakhs, ratePct, tenureYears, moratoriumMonths, prepayLakhs, scholarshipLakhs])

  // Lazy salary-currency FX fetch (USD already prefetched above for tuition).
  useEffect(() => {
    const cur = salary?.currency
    if (!cur) return
    if (liveFx[cur]) return
    fetch(`/api/forex?from=${cur}&to=INR`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.rate && isFinite(j.rate) && j.rate > 0) {
          setLiveFx((prev) => ({ ...prev, [cur]: j.rate }))
        }
      })
      .catch(() => {})
  }, [salary?.currency, liveFx])

  const fxRate =
    (salary?.currency && liveFx[salary.currency]) ||
    FX[salary?.currency || 'USD'] ||
    FX_USD_INR
  const salaryAvgINRYear = (salary?.avg || 0) * fxRate
  const salaryMinINRYear = (salary?.min || 0) * fxRate
  const salaryTopINRYear = (salary?.top || 0) * fxRate
  const salaryMonthlyINR = salaryAvgINRYear / 12

  // Adjust effective EMI for part-time income (lowers burden ratio used in gauge).
  const effectiveEMIBurdenINR = Math.max(0, loan.emi - partTimeMonthly)
  const burdenPctAvg = salaryMonthlyINR > 0 ? (effectiveEMIBurdenINR / salaryMonthlyINR) * 100 : 0
  const burdenPctMin = salaryMonthlyINR > 0 ? (effectiveEMIBurdenINR / (salaryMinINRYear / 12)) * 100 : 0
  const burdenPctTop = salaryMonthlyINR > 0 ? (effectiveEMIBurdenINR / (salaryTopINRYear / 12)) * 100 : 0

  const annualInterest = Math.round(loan.totalInterest / Math.max(1, loan.payoffYear))

  // ── Share card state ──────────────────────────────────────────────────────
  const [showShare, setShowShare] = useState(false)
  const shareCardRef = useRef<HTMLDivElement>(null)

  // ── Profile completeness hint ─────────────────────────────────────────────
  const missingFields: string[] = []
  if (!university) missingFields.push('Target University')
  if (!country) missingFields.push('Target Country')
  if (!profile.intakeTarget) missingFields.push('Target Intake')
  if (!profile.familyIncomeStr) missingFields.push('Family Income')

  // ── 80E tax calculator state ──────────────────────────────────────────────
  const [taxBracket, setTaxBracket] = useState<20 | 30>(30)
  const taxSaving = calculate80ESaving(annualInterest, taxBracket)

  // ── Yearly chart toggle ───────────────────────────────────────────────────
  const [chartView, setChartView] = useState<'chart' | 'table'>('chart')

  // ── Report payload (HTML / PDF download) ─────────────────────────────────
  const buildReportPayload = (): EMIReportInput => {
    const taxBracketPct = taxBracket
    return {
      studentName: profile.name || 'Student',
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      university: university || '',
      country,
      city: '',
      program: course,
      durationYears: duration,
      intake,
      currencyCode: 'INR',
      totalCostStr: formatINR(totalProgrammeCostINR),
      loanAmountStr: `₹${principalLakhs}L`,
      emiStr: formatINR(loan.emi),
      totalRepaymentStr: formatINR(loan.totalPaid),
      totalInterestStr: formatINR(loan.totalInterest),
      scholarshipStr: formatINR(scholarshipLakhs * 100000),
      preStudySavingsStr: formatINR((profile.savingsLakhs || 0) * 100000),
      payoffYear: loan.payoffYear,
      moratoriumMonths,
      ratePct,
      tenureYears,

      salaryAvgStr: formatINR(salaryAvgINRYear),
      salaryMinStr: formatINR(salaryMinINRYear),
      salaryTopStr: formatINR(salaryTopINRYear),
      burdenPctAvg,
      burdenPctMin,
      burdenPctTop,

      visaSummary: countryIntel?.visaSummary || '',
      recommendedMaxLoanStr: countryIntel ? formatINR(countryIntel.recommendedMaxLoanINR) : '—',
      recommendedReason: countryIntel?.recommendedReason || '',
      moneyTip: countryIntel?.moneyTip || '',
      risks: countryIntel?.risks || [],

      yearly: loan.yearly,

      plans: livePlans.map((p) => ({
        name: p.name,
        provider: p.provider,
        providerType: p.providerType,
        rate: `${p.rateMinPct}–${p.rateMaxPct}%`,
        maxLoanStr: p.maxLoanINR > 0 ? formatINR(p.maxLoanINR) : '—',
        tenureYears: p.tenureYears,
        collateral: p.collateral,
        moratoriumMonths: p.moratoriumMonths,
        features: p.features,
        fitReason: p.fitReason,
        applyUrl: p.applyUrl,
        sourceHost: p.sourceHost,
      })),

      annualInterestStr: formatINR(annualInterest),
      taxBracketPct,
      taxSavingStr: formatINR(taxSaving),
      tuitionSourceHost: tuition?.sourceUrl ? hostFrom(tuition.sourceUrl) : tuition?.source ? hostFrom(tuition.source) : undefined,
    }
  }

  // ── Live loan plans (Serper-driven) ──────────────────────────────────────
  interface LivePlan {
    name: string
    provider: string
    providerType: string
    rateMinPct: number
    rateMaxPct: number
    maxLoanINR: number
    tenureYears: number
    collateral: 'Required' | 'Optional' | 'None'
    moratoriumMonths: number
    processingFee: string
    features: string[]
    fitReason: string
    applyUrl: string
    sourceUrl: string
    sourceHost: string
  }
  const [livePlans, setLivePlans] = useState<LivePlan[]>([])

  return (
    <div className="max-w-7xl space-y-6">
      {/* ───── SECTION 1: HERO HEADER ───── */}
      <div className="card card-gradient">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              <Calculator className="w-6 h-6" style={{ color: 'var(--primary)' }} />
              Loan Intelligence Engine
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              Your complete financial picture — powered by AI, personalized to your profile.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary flex items-center gap-2 text-sm"
              onClick={() => downloadHTMLReport(buildReportPayload())}
            >
              <Download className="w-4 h-4" /> HTML
            </button>
            <button
              className="btn-secondary flex items-center gap-2 text-sm"
              onClick={() => downloadPDFReport(buildReportPayload())}
            >
              <FileText className="w-4 h-4" /> PDF
            </button>
            <button
              className="btn-secondary flex items-center gap-2 text-sm"
              onClick={() => {
                // Triggers a refetch by clearing the cache keys and re-mounting effects.
                ['salary', 'tuition', 'country'].forEach(k => {
                  Object.keys(localStorage).filter(key => key.startsWith(`gradpilot.loanIntel.${k}.`)).forEach(key => localStorage.removeItem(key))
                })
                window.location.reload()
              }}
            >
              <Sparkles className="w-4 h-4" /> Refresh AI
            </button>
            <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => setShowShare(true)}>
              <Share2 className="w-4 h-4" /> Share My Plan
            </button>
          </div>
        </div>
      </div>

      {/* ───── SECTION 1b: COUNTRY PICKER (250+) ───── */}
      <div className="card" style={{ position: 'relative', zIndex: 60, overflow: 'visible' }}>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Globe2 className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
            Choose your destination — {COUNTRY_OPTIONS.length}+ countries
          </h3>
          <span className="ml-auto text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
            Pick a country, then hit calculate. Everything below re-runs for that country only.
          </span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <CountryPicker selected={countryOpt} onChange={setCountryOpt} options={COUNTRY_OPTIONS} />
          </div>
          <button
            type="button"
            onClick={() => {
              // Wipe the 24h loan-intel cache so we never show stale tuition,
              // salary, or country-intel from a previous country selection.
              try {
                Object.keys(localStorage)
                  .filter((k) => k.startsWith('gradpilot.loanIntel.'))
                  .forEach((k) => localStorage.removeItem(k))
              } catch {}
              setAppliedCountry(countryOpt)
            }}
            disabled={!dirtyCountry}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
            style={{ minHeight: 40 }}
          >
            <Calculator className="w-4 h-4" />
            {dirtyCountry ? `Calculate for ${countryOpt.name}` : `Calculated for ${appliedCountry.name}`}
          </button>
        </div>
        {dirtyCountry && (
          <p
            className="text-[11px] mt-2 flex items-center gap-1"
            style={{ color: 'var(--warning)' }}
          >
            <AlertCircle className="w-3 h-3" />
            Country changed — click <strong>Calculate</strong> to refresh tuition, salary, and loan
            plans.
          </p>
        )}
      </div>

      {/* ───── SECTION 2: PROFILE STRIP ───── */}
      <div className="card" style={{ padding: '0.85rem 1.1rem' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <Chip icon={<GraduationCap className="w-3.5 h-3.5" />} label="University" value={university || '—'} />
          <Chip icon={<MapPin className="w-3.5 h-3.5" />} label="Country" value={`${flagOf(country)} ${country}`} />
          <Chip icon={<Clock className="w-3.5 h-3.5" />} label="Duration" value={`${duration} yrs`} />
          <Chip icon={<Calendar className="w-3.5 h-3.5" />} label="Intake" value={intake} />
          <Chip icon={<Wallet className="w-3.5 h-3.5" />} label="Family Income" value={familyIncome} />
          <button onClick={() => setCurrentPage('profile')}
            className="ml-auto text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-1 transition-all"
            style={{ background: 'var(--background-secondary)', color: 'var(--foreground-secondary)', border: '1px solid var(--border)' }}>
            <Edit className="w-3 h-3" /> Edit
          </button>
        </div>
        {missingFields.length > 0 && (
          <p className="text-xs mt-2 flex items-center gap-1" style={{ color: 'var(--warning)' }}>
            <AlertCircle className="w-3 h-3" /> Complete your profile for better accuracy ({missingFields.join(', ')}) →
          </p>
        )}
      </div>

      {/* ───── SECTION 3: THREE SCENARIO CARDS ───── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['conservative', 'smart', 'full'] as const).map((k) => {
          const s = scenarios[k]
          const e = computeEMI({ principalLakhs: s.loanLakhs, ratePct, tenureYears, moratoriumMonths })
          const isRec = k === 'smart'
          const selected = selectedPlan === k
          return (
            <motion.div key={k} whileHover={{ y: -2 }} transition={{ duration: 0.2 }}
              className="card" style={{
                borderColor: selected ? 'var(--primary)' : isRec ? 'rgba(99,102,241,0.35)' : 'var(--border)',
                boxShadow: selected ? '0 0 0 2px rgba(99,102,241,0.18)' : isRec ? 'var(--shadow-glow)' : 'none',
                background: selected ? 'rgba(99,102,241,0.04)' : 'var(--surface)',
              }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>{k === 'conservative' ? 'Conservative' : k === 'smart' ? 'Smart' : 'Full Coverage'}</span>
                {isRec && <span className="badge badge-primary"><Star className="w-3 h-3 mr-1" /> Recommended</span>}
              </div>
              <p className="text-sm mb-3" style={{ color: 'var(--foreground-secondary)' }}>{s.label}</p>
              <div className="text-3xl font-extrabold mb-1" style={{ color: 'var(--foreground)' }}>₹{s.loanLakhs}L</div>
              <p className="text-xs mb-4" style={{ color: 'var(--foreground-muted)' }}>{k === 'conservative' ? '70% of programme cost' : k === 'smart' ? '90% of programme cost' : '100% tuition + living'}</p>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <Stat label="EMI" value={formatINR(e.emi)} />
                <Stat label="Total Pay" value={formatINR(e.totalPaid)} />
                <Stat label="Payoff Yr" value={`Y${e.payoffYear}`} />
              </div>

              <button onClick={() => applyPlan(k)}
                className={selected ? 'btn-primary w-full text-sm' : 'btn-secondary w-full text-sm'}>
                {selected ? '✓ Selected' : 'Select This Plan'}
              </button>
            </motion.div>
          )
        })}
      </div>

      {/* ───── SECTION 4: ADJUSTMENT SLIDERS (secondary) ───── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <Sparkles className="w-4 h-4" style={{ color: 'var(--primary)' }} /> Fine-tune Your Plan
          </h3>
          <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Profile auto-fills these — adjust as needed.</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Slider label="Loan Amount" value={`₹${principalLakhs}L`} min={5} max={100} step={1} v={principalLakhs} onChange={setPrincipalLakhs} />
          <Slider label="Interest Rate" value={`${ratePct}%`} min={8} max={16} step={0.1} v={ratePct} onChange={setRatePct} />
          <Slider label="Tenure" value={`${tenureYears} yrs`} min={5} max={15} step={1} v={tenureYears} onChange={setTenureYears} />
          <Slider label="Moratorium" value={`${moratoriumMonths} mo`} min={0} max={36} step={1} v={moratoriumMonths} onChange={setMoratoriumMonths} />
          <Slider label="Prepay (Y3)" value={`₹${prepayLakhs}L`} min={0} max={20} step={1} v={prepayLakhs} onChange={setPrepayLakhs} />
          <Slider label="Scholarship" value={`₹${scholarshipLakhs}L`} min={0} max={30} step={1} v={scholarshipLakhs} onChange={setScholarshipLakhs} />
          <Slider label="Part-time Income / mo" value={formatINR(partTimeMonthly)} min={0} max={100000} step={1000} v={partTimeMonthly} onChange={setPartTimeMonthly} />
        </div>
      </div>

      {/* ───── SECTION 5: SALARY VS EMI INTELLIGENCE ───── */}
      <div className="card card-gradient">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <TrendingUp className="w-5 h-5" style={{ color: 'var(--success)' }} /> Salary vs EMI Intelligence
          </h3>
          {salarySource && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded" style={{ background: 'var(--background-secondary)', color: 'var(--foreground-muted)' }}>
              {salarySource === 'gemini' ? 'Live AI estimate' : 'Estimate'}
            </span>
          )}
        </div>

        {salaryLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton h={180} /><Skeleton h={180} /><Skeleton h={180} />
          </div>
        ) : !salary || salary.avg <= 0 ? (
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            Live salary data unavailable for {country}. Try changing the country or refresh the AI analysis.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gauge */}
            <div className="flex flex-col items-center justify-center">
              <BurdenGauge percent={burdenPctAvg} />
              <p className="text-sm text-center mt-2" style={{ color: 'var(--foreground-secondary)' }}>
                Your <strong style={{ color: 'var(--foreground)' }}>{formatINR(loan.emi)}</strong> EMI = <strong style={{ color: 'var(--primary-light)' }}>{burdenPctAvg.toFixed(1)}%</strong> of your expected <strong style={{ color: 'var(--foreground)' }}>{formatINR(salaryMonthlyINR)}</strong> monthly salary
              </p>
            </div>

            {/* Three salary scenarios */}
            <div className="lg:col-span-2 space-y-3">
              <SalaryRow label="Minimum Salary" amount={salaryMinINRYear} burden={burdenPctMin} />
              <SalaryRow label="Average Salary" amount={salaryAvgINRYear} burden={burdenPctAvg} highlight />
              <SalaryRow label="Top 25% Salary" amount={salaryTopINRYear} burden={burdenPctTop} />
              <p className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
                Salary range from {salary?.currency} → INR @ ~{fxRate}. Comfortable: &lt;20% · Manageable: 20–35% · Caution: &gt;35%
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ───── SECTION 6: COUNTRY INTELLIGENCE ───── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <Globe2 className="w-5 h-5" style={{ color: 'var(--info)' }} /> {flagOf(country)} {country} Intelligence
          </h3>
        </div>
        {countryLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton h={140} /><Skeleton h={140} />
          </div>
        ) : countryIntel ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--foreground-muted)' }}>Average Starting Salary</p>
              <p className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                {countryIntel.currency} {countryIntel.avgSalaryLocal.toLocaleString()} <span className="text-sm font-normal" style={{ color: 'var(--foreground-muted)' }}>(~{formatINR(countryIntel.avgSalaryINR)})</span>
              </p>
              <p className="text-xs mt-3 mb-1" style={{ color: 'var(--foreground-muted)' }}>Visa Situation</p>
              <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>{countryIntel.visaSummary}</p>
            </div>
            <div className="p-4 rounded-lg" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--foreground-muted)' }}>AI Recommended Max Loan</p>
              <p className="text-xl font-bold" style={{ color: 'var(--success)' }}>{formatINR(countryIntel.recommendedMaxLoanINR)}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--foreground-secondary)' }}>{countryIntel.recommendedReason}</p>
              <p className="text-xs mt-3 mb-1 flex items-center gap-1" style={{ color: 'var(--foreground-muted)' }}>
                <Lightbulb className="w-3 h-3" /> Money-saving tip
              </p>
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{countryIntel.moneyTip}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs mb-2" style={{ color: 'var(--foreground-muted)' }}>Top financial risks</p>
              <div className="flex flex-wrap gap-2">
                {countryIntel.risks.map((r, i) => (
                  <span key={i} className="text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1"
                    style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <AlertCircle className="w-3 h-3" /> {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            Live country intel for {country} couldn&apos;t load right now. Try the Refresh AI button.
          </p>
        )}
      </div>

      {/* ───── SECTION 7: WHAT-IF GRID ───── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WhatIfCard title="What if I get a scholarship?" hint={`Saves ₹${scholarshipLakhs}L from principal · New loan: ₹${Math.max(0, principalLakhs - scholarshipLakhs)}L`}>
          <Slider label="Scholarship" value={`₹${scholarshipLakhs}L`} min={0} max={30} step={1} v={scholarshipLakhs} onChange={setScholarshipLakhs} compact />
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Stat label="New EMI" value={formatINR(loan.emi)} />
            <Stat label="Money Saved" value={formatINR(scholarshipLakhs * 100000)} />
          </div>
        </WhatIfCard>

        <WhatIfCard title="What if I work part-time?" hint={`Reduces monthly burden by ${formatINR(partTimeMonthly)}`}>
          <Slider label="Part-time / mo" value={formatINR(partTimeMonthly)} min={0} max={80000} step={1000} v={partTimeMonthly} onChange={setPartTimeMonthly} compact />
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Stat label="Effective EMI" value={formatINR(effectiveEMIBurdenINR)} />
            <Stat label="Burden vs avg" value={`${burdenPctAvg.toFixed(1)}%`} />
          </div>
        </WhatIfCard>

        <WhatIfCard title="What if I prepay early?" hint={prepayLakhs > 0 ? `You save ${formatINR(loan.interestSavedFromPrepay)} by prepaying ₹${prepayLakhs}L in Year 3` : 'Move the slider to see savings.'} highlight={prepayLakhs > 0}>
          <Slider label="Prepay in Year 3" value={`₹${prepayLakhs}L`} min={0} max={20} step={1} v={prepayLakhs} onChange={setPrepayLakhs} compact />
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Stat label="Interest Saved" value={formatINR(loan.interestSavedFromPrepay)} good />
            <Stat label="Months Cut" value={`${loan.monthsSavedFromPrepay} mo`} good />
          </div>
        </WhatIfCard>

        <SwitchCountryCard
          baseCountry={country} baseProgramCostINR={totalProgrammeCostINR} baseLoanLakhs={principalLakhs}
          baseEMI={loan.emi} baseSalaryAvgINR={salaryAvgINRYear}
        />
      </div>

      {/* ───── SECTION 8: YEARLY BREAKUP ───── */}
      <div className="card">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>How your loan winds down each year</h3>
          <div className="flex items-center gap-1 p-1 rounded-md" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
            <button onClick={() => setChartView('chart')}
              className="text-xs px-3 py-1 rounded flex items-center gap-1"
              style={{ background: chartView === 'chart' ? 'var(--surface)' : 'transparent', color: chartView === 'chart' ? 'var(--foreground)' : 'var(--foreground-muted)' }}>
              <BarChart3 className="w-3 h-3" /> Chart
            </button>
            <button onClick={() => setChartView('table')}
              className="text-xs px-3 py-1 rounded flex items-center gap-1"
              style={{ background: chartView === 'table' ? 'var(--surface)' : 'transparent', color: chartView === 'table' ? 'var(--foreground)' : 'var(--foreground-muted)' }}>
              <TableIcon className="w-3 h-3" /> Table
            </button>
          </div>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--foreground-muted)' }}>
          Each bar is one EMI year. Indigo = principal you cleared, red = interest paid to the bank. The amber line is the outstanding balance still due — it has to reach zero by the last year.
        </p>

        {chartView === 'chart' ? (
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={loan.yearly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="year" tick={{ fill: 'var(--foreground-secondary)', fontSize: 12 }} />
              <YAxis yAxisId="left" tickFormatter={v => formatINR(Number(v))} tick={{ fill: 'var(--foreground-secondary)', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v => formatINR(Number(v))} tick={{ fill: 'var(--foreground-secondary)', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--foreground)' }}
                formatter={(v: any, name: any) => [
                  formatINR(Number(v)),
                  name === 'principal' ? 'Principal cleared' :
                  name === 'interest' ? 'Interest paid' :
                  name === 'remaining' ? 'Outstanding balance' :
                  String(name ?? ''),
                ]} />
              {moratoriumMonths >= 12 && <ReferenceLine yAxisId="left" x={`Y${Math.ceil(moratoriumMonths / 12)}`} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: 'Moratorium ends', fill: 'var(--warning)', fontSize: 10, position: 'top' }} />}
              {prepayLakhs > 0 && <ReferenceLine yAxisId="left" x="Y3" stroke="var(--success)" strokeDasharray="4 4" label={{ value: 'Prepay here', fill: 'var(--success)', fontSize: 10, position: 'top' }} />}
              <Bar yAxisId="left" dataKey="principal" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} name="Principal cleared" />
              <Bar yAxisId="left" dataKey="interest" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="Interest paid" />
              <Line yAxisId="right" type="monotone" dataKey="remaining" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} name="Outstanding balance" />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left py-2 text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Year</th>
                  <th className="text-right py-2 text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Principal</th>
                  <th className="text-right py-2 text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Interest</th>
                  <th className="text-right py-2 text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Cum. Interest</th>
                  <th className="text-right py-2 text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {loan.yearly.map((y) => (
                  <tr key={y.year} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-2" style={{ color: 'var(--foreground)' }}>{y.year}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--primary-light)' }}>{formatINR(y.principal)}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--danger)' }}>{formatINR(y.interest)}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--accent)' }}>{formatINR(y.cumInterest)}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--foreground-secondary)' }}>{formatINR(y.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-2 rounded-md flex items-start gap-2" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
            <span className="w-2.5 h-2.5 rounded-sm mt-1" style={{ background: '#6366f1' }} />
            <span style={{ color: 'var(--foreground-secondary)' }}><strong style={{ color: 'var(--foreground)' }}>Principal cleared.</strong> Money that actually pays down what you borrowed. Bigger is better.</span>
          </div>
          <div className="p-2 rounded-md flex items-start gap-2" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
            <span className="w-2.5 h-2.5 rounded-sm mt-1" style={{ background: '#ef4444' }} />
            <span style={{ color: 'var(--foreground-secondary)' }}><strong style={{ color: 'var(--foreground)' }}>Interest paid.</strong> The bank&apos;s cut. Higher in early years, falls as principal shrinks.</span>
          </div>
          <div className="p-2 rounded-md flex items-start gap-2" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
            <span className="w-2.5 h-2.5 rounded-sm mt-1" style={{ background: '#f59e0b' }} />
            <span style={{ color: 'var(--foreground-secondary)' }}><strong style={{ color: 'var(--foreground)' }}>Outstanding balance.</strong> What&apos;s still owed at year-end. Should hit ₹0 at the last bar.</span>
          </div>
        </div>
      </div>

      {/* ───── SECTION 9: PERSONALIZED LOAN MATCH ───── */}
      <PoonawallaMatch profile={profile} principalLakhs={principalLakhs} ratePct={ratePct} country={country} />

      {/* ───── SECTION 9b: LIVE LOAN PLANS (Serper + AI-extracted) ───── */}
      <LivePlansCard
        country={country}
        university={university}
        field={course}
        cgpa={profile.undergradCgpa || profile.cgpa}
        loanNeededLakhs={principalLakhs}
        collateral={profile.collateralAvailableStr || (profile.collateralType !== 'none' ? 'Yes' : 'No')}
        coApplicant={profile.coApplicantStr || (profile.hasCoApplicant ? 'Yes' : 'No')}
        familyIncomeStr={profile.familyIncomeStr}
        onLoaded={setLivePlans}
      />

      {/* ───── SECTION 11: 80E TAX BENEFIT ───── */}
      <div className="card">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.1)' }}>
            <ShieldCheck className="w-5 h-5" style={{ color: 'var(--success)' }} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)' }}>Section 80E Tax Benefit</h3>
            <p className="text-xs mb-3" style={{ color: 'var(--foreground-secondary)' }}>
              Interest paid on education loans is fully deductible from taxable income under Section 80E.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs" style={{ color: 'var(--foreground-secondary)' }}>
                Annual interest: <strong style={{ color: 'var(--foreground)' }}>{formatINR(annualInterest)}</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Tax bracket:</span>
                <select className="input-field text-xs" style={{ width: 80, padding: '0.4rem 0.6rem' }} value={taxBracket} onChange={(e) => setTaxBracket(parseInt(e.target.value) as 20 | 30)}>
                  <option value={20}>20%</option>
                  <option value={30}>30%</option>
                </select>
              </div>
              <div className="text-sm font-bold ml-auto" style={{ color: 'var(--success)' }}>
                You save {formatINR(taxSaving)} in taxes annually
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tuition source footer */}
      {tuition && (
        <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--foreground-muted)' }}>
          <Info className="w-3 h-3" /> Tuition: {tuitionSource === 'serper' ? 'Live data from' : 'Profile-based estimate'}{' '}
          {tuitionSource === 'serper' ? hostFrom(tuition.source) : ''}
          {tuition.sourceUrl && (
            <a href={tuition.sourceUrl} target="_blank" rel="noopener noreferrer" className="loan-link inline-flex items-center gap-1 ml-1">
              source <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </p>
      )}

      {/* Share modal */}
      <AnimatePresence>
        {showShare && (
          <ShareModal
            cardRef={shareCardRef}
            onClose={() => setShowShare(false)}
            profile={profile}
            country={country}
            university={university}
            tuitionINR={tuitionPerYearINR * duration}
            livingINR={livingPerYearINR * duration}
            loanLakhs={principalLakhs}
            emi={loan.emi}
            salaryAnnualINR={salaryAvgINRYear}
            payoffYear={loan.payoffYear}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS — kept in this file to avoid breaking unrelated pages
// ─────────────────────────────────────────────────────────────────────────────

function Chip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md"
      style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)', color: 'var(--foreground-secondary)' }}>
      <span style={{ color: 'var(--primary-light)' }}>{icon}</span>
      <span style={{ color: 'var(--foreground-muted)' }}>{label}:</span>
      <strong style={{ color: 'var(--foreground)' }}>{value}</strong>
    </span>
  )
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="p-2 rounded-md text-center" style={{ background: 'var(--background-secondary)' }}>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>{label}</div>
      <div className="text-sm font-bold" style={{ color: good ? 'var(--success)' : 'var(--foreground)' }}>{value}</div>
    </div>
  )
}

function Slider({ label, value, min, max, step, v, onChange, compact }: {
  label: string; value: string; min: number; max: number; step: number;
  v: number; onChange: (n: number) => void; compact?: boolean
}) {
  return (
    <div className={compact ? '' : 'card'} style={compact ? {} : undefined}>
      <label className="text-xs font-medium block mb-1.5 flex items-center justify-between" style={{ color: 'var(--foreground-secondary)' }}>
        <span>{label}</span>
        <span className="font-bold" style={{ color: 'var(--primary-light)' }}>{value}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  )
}

function BurdenGauge({ percent }: { percent: number }) {
  const pct = Math.max(0, Math.min(100, percent))
  // Color zones: <20 success, 20-35 warning, >35 danger
  const color = pct < 20 ? 'var(--success)' : pct < 35 ? 'var(--warning)' : 'var(--danger)'
  const label = pct < 20 ? 'Comfortable Zone' : pct < 35 ? 'Manageable Zone' : 'Caution Zone'
  // Half-doughnut gauge using SVG arcs
  const r = 80
  const circ = Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <div className="relative w-[220px] h-[140px]">
      <svg viewBox="0 0 200 120" className="w-full h-full">
        <path d={`M 20 110 A ${r} ${r} 0 0 1 180 110`} fill="none" stroke="var(--background-secondary)" strokeWidth="14" strokeLinecap="round" />
        <path d={`M 20 110 A ${r} ${r} 0 0 1 180 110`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="absolute inset-x-0 bottom-2 flex flex-col items-center">
        <span className="text-3xl font-extrabold" style={{ color }}>{pct.toFixed(1)}%</span>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
      </div>
    </div>
  )
}

function SalaryRow({ label, amount, burden, highlight }: { label: string; amount: number; burden: number; highlight?: boolean }) {
  const color = burden < 20 ? 'var(--success)' : burden < 35 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div className="flex items-center justify-between p-3 rounded-lg" style={{
      background: highlight ? 'rgba(99,102,241,0.06)' : 'var(--background-secondary)',
      border: highlight ? '1px solid rgba(99,102,241,0.25)' : '1px solid var(--border)',
    }}>
      <div>
        <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{label} (annual)</div>
        <div className="text-base font-bold" style={{ color: 'var(--foreground)' }}>{formatINR(amount)}</div>
      </div>
      <div className="text-right">
        <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>EMI burden</div>
        <div className="text-base font-bold" style={{ color }}>{burden.toFixed(1)}%</div>
      </div>
    </div>
  )
}

function WhatIfCard({ title, hint, highlight, children }: {
  title: string; hint: string; highlight?: boolean; children: React.ReactNode
}) {
  return (
    <div className="card" style={{ borderColor: highlight ? 'rgba(16,185,129,0.35)' : undefined, background: highlight ? 'rgba(16,185,129,0.04)' : undefined }}>
      <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)' }}>{title}</h4>
      <p className="text-xs mb-3" style={{ color: 'var(--foreground-secondary)' }}>{hint}</p>
      {children}
    </div>
  )
}

function SwitchCountryCard({ baseCountry, baseProgramCostINR, baseLoanLakhs, baseEMI, baseSalaryAvgINR }: {
  baseCountry: string; baseProgramCostINR: number; baseLoanLakhs: number; baseEMI: number; baseSalaryAvgINR: number
}) {
  const [alt, setAlt] = useState<string>('Germany')
  const altCountries = ['USA', 'UK', 'Canada', 'Australia', 'Germany', 'Ireland', 'Singapore', 'Netherlands', 'France', 'New Zealand', 'Japan']
    .filter((c) => c.toUpperCase() !== baseCountry.toUpperCase())

  const [altCostINR, setAltCostINR] = useState<number | null>(null)
  const [altSalaryINR, setAltSalaryINR] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  // Re-fetch when alt country changes — real numbers, no multiplier hacks.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setAltCostINR(null)
    setAltSalaryINR(null)
    Promise.all([
      fetch('/api/cost-of-study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: alt, program: "Master's", durationYears: 2 }),
      }).then((r) => r.json()),
      fetch('/api/loan-intel/salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: alt, course: "Master's" }),
      }).then((r) => r.json()),
      fetch('/api/forex?from=USD&to=INR').then((r) => r.json()),
    ])
      .then(([costJ, salJ, fxJ]) => {
        if (cancelled) return
        const usdInr = Number(fxJ?.rate) || FX_USD_INR
        const tuition = Number(costJ?.tuitionPerYearUSD) || 0
        const living = Number(costJ?.livingPerYearUSD) || 0
        // Total programme cost: 2-year default for the comparison.
        const totalCostINR = (tuition + living) * 2 * usdInr
        setAltCostINR(Math.round(totalCostINR))

        // Convert salary average to INR using its native currency.
        const salaryAvg = Number(salJ?.data?.avg) || 0
        const salaryCur = (salJ?.data?.currency || 'USD') as string
        const fxToInr = (FX as Record<string, number>)[salaryCur] || usdInr
        setAltSalaryINR(Math.round(salaryAvg * fxToInr))
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [alt])

  const altLoanINR = altCostINR ? Math.round(altCostINR * 0.9) : 0
  const altEMI = altLoanINR > 0 ? calcEMI(altLoanINR, 11, 10) : 0

  return (
    <div className="card">
      <h4 className="text-sm font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
        <Globe2 className="w-4 h-4" style={{ color: 'var(--info)' }} /> What if I switch countries?
      </h4>
      <p className="text-xs mb-3" style={{ color: 'var(--foreground-secondary)' }}>
        Compare {flagOf(baseCountry)} {baseCountry} with another option. Numbers re-pulled live for the country you pick.
      </p>
      <select className="input-field text-sm mb-3" value={alt} onChange={(e) => setAlt(e.target.value)}>
        {altCountries.map((c) => (
          <option key={c} value={c}>
            {flagOf(c)} {c}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <CompareCol
          title={`${flagOf(baseCountry)} ${baseCountry}`}
          cost={baseProgramCostINR}
          loan={baseLoanLakhs * 100000}
          emi={baseEMI}
          salary={baseSalaryAvgINR}
        />
        {loading || altCostINR === null || altSalaryINR === null ? (
          <div className="p-2 rounded-md flex items-center justify-center" style={{ background: 'var(--background-secondary)', border: '1px solid rgba(6,182,212,0.3)' }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--info)' }} />
            <span className="text-[11px] ml-1.5" style={{ color: 'var(--foreground-muted)' }}>Pulling live numbers…</span>
          </div>
        ) : (
          <CompareCol
            title={`${flagOf(alt)} ${alt}`}
            cost={altCostINR}
            loan={altLoanINR}
            emi={altEMI}
            salary={altSalaryINR}
            alt
          />
        )}
      </div>
    </div>
  )
}

function CompareCol({ title, cost, loan, emi, salary, alt }: { title: string; cost: number; loan: number; emi: number; salary: number; alt?: boolean }) {
  return (
    <div className="p-2 rounded-md" style={{ background: 'var(--background-secondary)', border: alt ? '1px solid rgba(6,182,212,0.3)' : '1px solid var(--border)' }}>
      <div className="font-bold mb-1.5" style={{ color: 'var(--foreground)' }}>{title}</div>
      <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Cost</span><strong style={{ color: 'var(--foreground)' }}>{formatINR(cost)}</strong></div>
      <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Loan</span><strong style={{ color: 'var(--foreground)' }}>{formatINR(loan)}</strong></div>
      <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>EMI</span><strong style={{ color: 'var(--accent)' }}>{formatINR(emi)}</strong></div>
      <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Salary</span><strong style={{ color: 'var(--success)' }}>{formatINR(salary)}</strong></div>
    </div>
  )
}

function PoonawallaMatch({ profile, principalLakhs, ratePct, country }: { profile: any; principalLakhs: number; ratePct: number; country: string }) {
  const collateralNeeded = profile.collateralAvailableStr === 'Yes' ? false : principalLakhs > 25
  const moratoriumMonths = 12
  const processingTime = '72 hours'

  return (
    <div className="card card-gradient">
      <div className="flex items-center gap-2 mb-3">
        <BadgeCheck className="w-5 h-5" style={{ color: 'var(--primary)' }} />
        <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>Your Personalized Loan Match</h3>
        <span className="badge badge-success ml-auto">Pre-qualified</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Loan Amount" value={`₹${principalLakhs}L`} />
        <Stat label="Your Rate" value={`${ratePct}% p.a.`} />
        <Stat label="Collateral" value={collateralNeeded ? 'Required' : 'Not Needed'} />
        <Stat label="Moratorium" value={`${moratoriumMonths} mo`} />
      </div>

      <div className="flex flex-wrap gap-2">
        <TrustBadge icon={<ShieldCheck className="w-3 h-3" />} text="No Hidden Charges" />
        <TrustBadge icon={<Sparkles className="w-3 h-3" />} text="100% Digital Process" />
        <TrustBadge icon={<Clock className="w-3 h-3" />} text={`Approval in ${processingTime}`} />
      </div>
    </div>
  )
}

function TrustBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5"
      style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)', color: 'var(--foreground-secondary)' }}>
      <span style={{ color: 'var(--success)' }}>{icon}</span> {text}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNTRY PICKER — searchable, scrollable, 250+ countries
// ─────────────────────────────────────────────────────────────────────────────
function CountryPicker({
  selected,
  onChange,
  options,
}: {
  selected: CountryOption
  onChange: (c: CountryOption) => void
  options: CountryOption[]
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return options
    return options.filter(
      (c) => c.name.toLowerCase().includes(s) || c.currency.toLowerCase().includes(s),
    )
  }, [options, q])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input-field flex items-center justify-between w-full"
      >
        <span style={{ color: 'var(--foreground)' }}>
          {flagOf(selected.name)} {selected.name}{' '}
          <span style={{ color: 'var(--foreground-muted)' }}>({selected.currency})</span>
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 200 }}
          />
          <div
            className="absolute mt-1 w-full rounded-lg shadow-lg"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              maxHeight: 360,
              overflow: 'hidden',
              zIndex: 210,
            }}
          >
            <div
              className="p-2 sticky top-0"
              style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
            >
              <div className="relative">
                <SearchIcon
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: 'var(--foreground-muted)' }}
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search 250+ countries…"
                  autoFocus
                  className="input-field pl-10 pr-9 text-sm"
                />
                {q && (
                  <button
                    onClick={() => setQ('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5" style={{ color: 'var(--foreground-muted)' }} />
                  </button>
                )}
              </div>
            </div>
            <div style={{ maxHeight: 290, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div className="p-3 text-xs text-center" style={{ color: 'var(--foreground-muted)' }}>
                  No matches
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => {
                      onChange(c)
                      setOpen(false)
                      setQ('')
                    }}
                    className="w-full text-left px-3 py-2 text-sm flex items-center justify-between"
                    style={{
                      background:
                        c.code === selected.code ? 'var(--primary-light)' : 'transparent',
                      color: c.code === selected.code ? 'white' : 'var(--foreground)',
                    }}
                  >
                    <span>
                      {flagOf(c.name)} {c.name}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{
                        color:
                          c.code === selected.code
                            ? 'rgba(255,255,255,0.85)'
                            : 'var(--foreground-muted)',
                      }}
                    >
                      {c.currency}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE LOAN PLANS — Serper + AI structured extraction. The page passes the
// resolved profile + country and we fetch up to 6 lender plans matching the
// student's destination. Source attribution shows only the cleaned hostname.
// ─────────────────────────────────────────────────────────────────────────────
function LivePlansCard({
  country, university, field, cgpa, loanNeededLakhs, collateral, coApplicant, familyIncomeStr, onLoaded,
}: {
  country: string
  university: string
  field: string
  cgpa: string | number | undefined
  loanNeededLakhs: number
  collateral: string
  coApplicant: string
  familyIncomeStr?: string
  onLoaded: (plans: any[]) => void
}) {
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [sourceHost, setSourceHost] = useState('')
  const [search, setSearch] = useState('')

  const fetchPlans = (q?: string) => {
    setLoading(true)
    fetch('/api/emi-loan-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country,
        university,
        field,
        cgpa,
        loanNeededLakhs,
        collateral,
        coApplicant,
        familyIncomeStr,
        userQuery: q ?? search,
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        const list = Array.isArray(j?.plans) ? j.plans : []
        setPlans(list)
        onLoaded(list)
        setSourceHost(
          j?.source &&
            !['fallback', 'no-key', 'serper-empty', 'gemini-empty', 'gemini-error'].includes(j.source)
            ? j.source
            : '',
        )
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPlans()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, university, field, loanNeededLakhs, collateral])

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <BadgeCheck className="w-5 h-5" style={{ color: 'var(--primary)' }} />
        <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
          Live loan plans for {flagOf(country)} {country}
        </h3>
        {sourceHost && (
          <span
            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded ml-auto"
            style={{ background: 'var(--background-secondary)', color: 'var(--foreground-muted)' }}
          >
            via {sourceHost}
          </span>
        )}
      </div>
      <form
        className="flex items-stretch gap-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault()
          fetchPlans(search)
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Refine — e.g. "no collateral under 12% rate" or "Prodigy Finance"'
          className="input-field flex-1 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50 whitespace-nowrap"
          style={{ minWidth: 110 }}
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
            </>
          ) : (
            <>
              <SearchIcon className="w-3.5 h-3.5" /> Search
            </>
          )}
        </button>
      </form>

      {loading && plans.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Skeleton h={140} /><Skeleton h={140} />
        </div>
      ) : plans.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          No live plans matched. Try widening the search.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {plans.map((p, i) => (
            <div key={`${p.applyUrl}-${i}`} className="p-3 rounded-lg" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate" style={{ color: 'var(--foreground)' }}>{p.name}</div>
                  <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{p.provider} · {p.providerType}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground-secondary)' }}>{p.sourceHost}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                <div><div style={{ color: 'var(--foreground-muted)' }}>Rate</div><div className="font-bold" style={{ color: 'var(--accent)' }}>{p.rateMinPct}–{p.rateMaxPct}%</div></div>
                <div><div style={{ color: 'var(--foreground-muted)' }}>Tenure</div><div className="font-bold" style={{ color: 'var(--foreground)' }}>{p.tenureYears}y</div></div>
                <div><div style={{ color: 'var(--foreground-muted)' }}>Max</div><div className="font-bold" style={{ color: 'var(--foreground)' }}>{p.maxLoanINR ? `₹${(p.maxLoanINR / 100000).toFixed(0)}L` : '—'}</div></div>
                <div><div style={{ color: 'var(--foreground-muted)' }}>Collateral</div><div className="font-bold" style={{ color: 'var(--foreground)' }}>{p.collateral}</div></div>
                <div><div style={{ color: 'var(--foreground-muted)' }}>Moratorium</div><div className="font-bold" style={{ color: 'var(--foreground)' }}>{p.moratoriumMonths}mo</div></div>
                <div><div style={{ color: 'var(--foreground-muted)' }}>Fees</div><div className="font-bold truncate" style={{ color: 'var(--foreground)' }}>{p.processingFee || '—'}</div></div>
              </div>
              {p.fitReason && <p className="text-xs mt-2" style={{ color: 'var(--foreground-secondary)' }}>{p.fitReason}</p>}
              {p.features?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.features.slice(0, 4).map((f: string) => (
                    <span key={f} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--surface)', color: 'var(--foreground-secondary)', border: '1px solid var(--border)' }}>{f}</span>
                  ))}
                </div>
              )}
              <a href={p.applyUrl} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs inline-flex items-center gap-1 mt-3">
                Apply <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


function ShareModal(props: {
  cardRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  profile: any
  country: string
  university: string
  tuitionINR: number
  livingINR: number
  loanLakhs: number
  emi: number
  salaryAnnualINR: number
  payoffYear: number
}) {
  const { onClose, profile, country, university, tuitionINR, livingINR, loanLakhs, emi, salaryAnnualINR, payoffYear } = props
  const totalInvestmentINR = tuitionINR + livingINR
  const totalLoanRepaidINR = emi * 12 * payoffYear
  const roi = calculateROIScore(salaryAnnualINR, totalLoanRepaidINR)
  const url = typeof window !== 'undefined' ? window.location.origin : 'https://gradpilot.app'
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}&color=6366F1&bgcolor=141425`

  const shareText = `My EduFinAI Plan: ${university || country} · Loan ₹${loanLakhs}L · EMI ${formatINR(emi)} · ROI ${roi}/10`

  const copyLink = () => {
    navigator.clipboard.writeText(`${shareText}\n${url}`)
  }

  const downloadPNG = async () => {
    // Lightweight DOM-to-image fallback using SVG foreignObject if html2canvas
    // is unavailable in the host project. We snapshot the rendered card's HTML.
    const node = document.getElementById('share-card-render')
    if (!node) return
    const w = node.offsetWidth || 480
    const h = node.offsetHeight || 600
    const xml = new XMLSerializer().serializeToString(node)
    const html = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${xml}</div></foreignObject></svg>`
    const blob = new Blob([html], { type: 'image/svg+xml;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `EduFinAI-Plan-${(profile?.name || 'student').replace(/\s+/g, '-')}.svg`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ y: 20, scale: 0.95 }} animate={{ y: 0, scale: 1 }}
        className="relative max-w-md w-full"
        onClick={(e) => e.stopPropagation()}>

        {/* The actual card the user shares */}
        <div id="share-card-render" className="rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)', fontFamily: 'inherit' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-bold tracking-widest opacity-90">EDUFINAI · STUDY PLAN</div>
            <Star className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold mb-1">{profile.name || 'Student'}</div>
          <div className="text-sm opacity-90 mb-4">{flagOf(country)} {university || country}</div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <div className="text-[10px] opacity-80 uppercase">Total Investment</div>
              <div className="text-lg font-bold">{formatINR(totalInvestmentINR)}</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <div className="text-[10px] opacity-80 uppercase">Loan</div>
              <div className="text-lg font-bold">₹{loanLakhs}L</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <div className="text-[10px] opacity-80 uppercase">Monthly EMI</div>
              <div className="text-lg font-bold">{formatINR(emi)}</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <div className="text-[10px] opacity-80 uppercase">Expected Salary</div>
              <div className="text-lg font-bold">{formatINR(salaryAnnualINR)}/yr</div>
            </div>
          </div>

          <div className="rounded-xl p-3 mb-4 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <div>
              <div className="text-[10px] opacity-80 uppercase">ROI Score</div>
              <div className="text-3xl font-extrabold">{roi}<span className="text-lg opacity-70">/10</span></div>
            </div>
            <div className="text-right">
              <div className="text-[10px] opacity-80 uppercase">Payoff Year</div>
              <div className="text-2xl font-extrabold">Y{payoffYear}</div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-[10px] opacity-90">Powered by EduFinAI</div>
            <img src={qr} alt="qr" className="w-12 h-12 rounded" />
          </div>
        </div>

        {/* Action bar */}
        <div className="mt-3 card flex flex-wrap items-center gap-2">
          <button onClick={downloadPNG} className="btn-primary text-xs flex items-center gap-1"><Download className="w-3 h-3" /> Download</button>
          <button onClick={copyLink} className="btn-secondary text-xs flex items-center gap-1"><Copy className="w-3 h-3" /> Copy Link</button>
          <a target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + url)}`} className="btn-secondary text-xs">WhatsApp</a>
          <a target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} className="btn-secondary text-xs">LinkedIn</a>
          <a target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText + ' ' + url)}`} className="btn-secondary text-xs">X</a>
          <button onClick={onClose} className="text-xs ml-auto px-3 py-2" style={{ color: 'var(--foreground-muted)' }}>Close</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
