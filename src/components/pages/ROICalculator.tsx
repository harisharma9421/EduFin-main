'use client'

// ROI Calculator — profile-aware, AI-grounded, math-pure, two-side currency toggle.
// ----------------------------------------------------------------------------
// • Pulls every default from the user's profile (city, country, target uni,
//   CGPA, loan, scholarship, savings).
// • Live FX via /api/forex with a refresh button next to the rate.
// • College match via /api/college-lookup → Google Places (the user's target
//   uni + selected country), then sent to /api/roi-analysis (AI) which returns
//   salary distribution + risk + alternatives. The user-facing copy never
//   mentions the underlying AI provider.
// • Eight smart KPIs, an explained 3-scenario chart, EMI schedule + donut,
//   alternatives table, scholarships from /api/scholarships (Serper).

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { calculateEMI, parseNumber } from '@/lib/utils'
import { countries as RAW_COUNTRIES } from 'countries-list'
import {
  TrendingUp,
  DollarSign,
  Calendar,
  ArrowUpRight,
  ArrowLeftRight,
  Loader2,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  Search as SearchIcon,
  X,
  Download,
  FileText,
  ExternalLink,
  RefreshCw,
  MapPin,
  Info,
  Building2,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from 'recharts'
import {
  downloadHTMLReport,
  downloadPDFReport,
  type ROIReportInput,
} from '@/lib/roiReport'

// ── Country / currency picker data ──────────────────────────────────────────
interface CountryOption {
  code: string
  name: string
  currency: string
}
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
  const normalized = name.trim().toLowerCase()
  return COUNTRY_OPTIONS.find(
    (c) => c.name.toLowerCase() === normalized || c.code.toLowerCase() === normalized,
  )
}

const CURRENCY_PREFIX: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  SGD: 'S$',
  JPY: '¥',
  CHF: 'CHF ',
  HKD: 'HK$',
  AED: 'AED ',
  NZD: 'NZ$',
}

function fmt(amount: number, currency: string): string {
  if (!isFinite(amount)) return '—'
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(Math.round(amount))
  const prefix = CURRENCY_PREFIX[currency] ?? `${currency} `
  if (currency === 'INR') {
    if (abs >= 1_00_00_000) return `${sign}${prefix}${(abs / 1_00_00_000).toFixed(2)}Cr`
    if (abs >= 1_00_000) return `${sign}${prefix}${(abs / 1_00_000).toFixed(2)}L`
    return `${sign}${prefix}${abs.toLocaleString('en-IN')}`
  }
  if (abs >= 1_000_000) return `${sign}${prefix}${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}${prefix}${(abs / 1_000).toFixed(1)}K`
  return `${sign}${prefix}${abs.toLocaleString('en-US')}`
}

function emiSchedule(
  principal: number,
  ratePct: number,
  tenureYears: number,
): { year: number; principal: number; interest: number; balance: number }[] {
  if (principal <= 0 || ratePct <= 0 || tenureYears <= 0) return []
  const r = ratePct / 12 / 100
  const n = tenureYears * 12
  const monthlyEmi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  let balance = principal
  const rows: { year: number; principal: number; interest: number; balance: number }[] = []
  for (let y = 1; y <= Math.min(tenureYears, 10); y++) {
    let yearPrincipal = 0
    let yearInterest = 0
    for (let m = 0; m < 12; m++) {
      const interest = balance * r
      const principalPaid = monthlyEmi - interest
      yearPrincipal += principalPaid
      yearInterest += interest
      balance -= principalPaid
    }
    rows.push({
      year: y,
      principal: Math.round(yearPrincipal),
      interest: Math.round(yearInterest),
      balance: Math.max(0, Math.round(balance)),
    })
  }
  return rows
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ROICalculator({
  embedded = false,
}: { embedded?: boolean } = {}) {
  const { profile } = useAppStore()

  // Initial countries from profile.
  const initialFrom = findCountryByName('India') || COUNTRY_OPTIONS[0]
  const profileCountryName = (profile as any)?.targetCountries?.[0] || profile?.targetCountry?.[0]
  const initialTo =
    findCountryByName(profileCountryName) || findCountryByName('USA') || COUNTRY_OPTIONS[0]

  const [fromCountry, setFromCountry] = useState<CountryOption>(initialFrom)
  const [toCountry, setToCountry] = useState<CountryOption>(initialTo)

  // FX rate for display currency. Always queried whenever the pair changes.
  const fxPair = `${fromCountry.currency}->${toCountry.currency}`
  const [fxRate, setFxRate] = useState(1)
  const [fxSource, setFxSource] = useState<string>('')
  const [fxLoading, setFxLoading] = useState(false)
  const [fxStamp, setFxStamp] = useState<string>('')

  const fetchFx = (force = false) => {
    setFxLoading(true)
    fetch(`/api/forex?from=${fromCountry.currency}&to=${toCountry.currency}${force ? `&t=${Date.now()}` : ''}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.rate && isFinite(j.rate) && j.rate > 0) {
          setFxRate(j.rate)
          setFxSource(j.source || '')
          setFxStamp(new Date().toLocaleTimeString())
        }
      })
      .catch(() => {})
      .finally(() => setFxLoading(false))
  }

  useEffect(() => {
    fetchFx(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxPair])

  // We always need USD->INR as a stable conversion anchor for math.
  const [usdInrRate, setUsdInrRate] = useState(83)
  useEffect(() => {
    let cancelled = false
    fetch('/api/forex?from=USD&to=INR')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j?.rate && isFinite(j.rate) && j.rate > 0) setUsdInrRate(j.rate)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const swapCountries = () => {
    setFromCountry(toCountry)
    setToCountry(fromCountry)
  }

  const displayCurrency = toCountry.currency

  // ── Profile-driven defaults ───────────────────────────────────────────────
  const profileTargetUni =
    (profile as any)?.targetUniversitiesList?.[0] ||
    (profile as any)?.dreamUniversities?.[0] ||
    profile?.currentUniversity ||
    ''
  const profileField = (profile as any)?.targetField || profile?.targetProgram || 'Computer Science'
  const profileDegree = (profile as any)?.targetDegree || 'MS'

  const [collegeName, setCollegeName] = useState<string>(profileTargetUni || '')
  const [collegeAddress, setCollegeAddress] = useState<string>('')
  const [collegeCity, setCollegeCity] = useState<string>('')
  const [collegeLoading, setCollegeLoading] = useState(false)
  const [collegeSource, setCollegeSource] = useState<string>('')
  const [collegeHintInput, setCollegeHintInput] = useState<string>(profileTargetUni || '')

  const [program, setProgram] = useState(profileField)
  const [duration, setDuration] = useState<number>(2)
  const [tuitionPerYearUSD, setTuitionPerYearUSD] = useState<number>(45000)
  const [livingPerYearUSD, setLivingPerYearUSD] = useState<number>(18000)
  const [costsLoading, setCostsLoading] = useState(false)
  const [costsSource, setCostsSource] = useState<'auto' | 'manual' | ''>('')
  const [costsNote, setCostsNote] = useState<string>('')

  const [loanAmountINR, setLoanAmountINR] = useState<number>(
    (parseNumber(profile.loanEstimateStr, 0) || profile.budgetLakhs || 50) * 100000,
  )
  const [interestRate, setInterestRate] = useState<number>(11)
  const [loanTenure, setLoanTenure] = useState<number>(10)

  const [scholarshipINR, setScholarshipINR] = useState<number>(0)
  const [preStudySavingsINR, setPreStudySavingsINR] = useState<number>(
    (profile.savingsLakhs || 5) * 100000,
  )
  const [salaryGrowthPct, setSalaryGrowthPct] = useState<number>(7)

  // ── College lookup (Google Places) ────────────────────────────────────────
  // Match record returned by /api/college-lookup
  type CollegeMatch = {
    name: string
    formatted_address?: string
    city?: string
    place_id?: string
    lat?: number | null
    lng?: number | null
  }
  const [collegeSuggestions, setCollegeSuggestions] = useState<CollegeMatch[]>([])
  const [collegeRecs, setCollegeRecs] = useState<CollegeMatch[]>([])
  const [showCollegeDropdown, setShowCollegeDropdown] = useState(false)
  const [collegeAcLoading, setCollegeAcLoading] = useState(false)
  const collegeAbortRef = useRef<AbortController | null>(null)
  const collegeDebounceRef = useRef<number | null>(null)

  // Pick a specific suggestion or recommendation — closes the dropdown.
  const pickCollege = (m: CollegeMatch) => {
    setCollegeName(m.name)
    setCollegeAddress(m.formatted_address || '')
    setCollegeCity(m.city || '')
    setCollegeSource('google-places')
    setCollegeHintInput(m.name)
    setShowCollegeDropdown(false)
  }

  // Fire a country-restricted autocomplete request as the user types.
  const fetchCollegeSuggestions = (q: string) => {
    if (collegeAbortRef.current) collegeAbortRef.current.abort()
    if (!q || q.trim().length < 2) {
      setCollegeSuggestions([])
      setCollegeAcLoading(false)
      return
    }
    const ac = new AbortController()
    collegeAbortRef.current = ac
    setCollegeAcLoading(true)
    fetch('/api/college-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        mode: 'autocomplete',
        query: q.trim(),
        country: toCountry.name,
        countryCode: toCountry.code,
        field: profileField,
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (ac.signal.aborted) return
        const matches: CollegeMatch[] = Array.isArray(j?.matches) ? j.matches : []
        setCollegeSuggestions(matches)
      })
      .catch(() => {
        if (!ac.signal.aborted) setCollegeSuggestions([])
      })
      .finally(() => {
        if (!ac.signal.aborted) setCollegeAcLoading(false)
      })
  }

  // Country-aware recommendations to surface BEFORE the user types — these
  // are the universities that best match the student's profile in the
  // currently-selected destination country.
  const fetchCollegeRecommendations = () => {
    fetch('/api/college-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'recommend',
        country: toCountry.name,
        countryCode: toCountry.code,
        field: profileField,
        degree: profileDegree,
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        const matches: CollegeMatch[] = Array.isArray(j?.matches) ? j.matches : []
        setCollegeRecs(matches)
      })
      .catch(() => setCollegeRecs([]))
  }

  // Debounced typeahead — kicks off on every keystroke.
  const onCollegeHintChange = (val: string) => {
    setCollegeHintInput(val)
    setShowCollegeDropdown(true)
    if (collegeDebounceRef.current) {
      window.clearTimeout(collegeDebounceRef.current)
    }
    collegeDebounceRef.current = window.setTimeout(() => {
      fetchCollegeSuggestions(val)
    }, 220)
  }

  // Single-shot lookup (kept for the manual "Update" button + initial load).
  const lookupCollege = (hint: string) => {
    setCollegeLoading(true)
    fetch('/api/college-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'lookup',
        hint,
        country: toCountry.name,
        countryCode: toCountry.code,
        degree: profileDegree,
        field: profileField,
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.match?.name) {
          setCollegeName(j.match.name)
          setCollegeAddress(j.match.formatted_address || '')
          setCollegeCity(j.match.city || '')
          setCollegeSource(j.source || '')
        }
      })
      .catch(() => {})
      .finally(() => setCollegeLoading(false))
  }

  // Auto-lookup + refresh recommendations whenever destination country changes.
  useEffect(() => {
    lookupCollege(collegeHintInput || profileTargetUni || profileField)
    fetchCollegeRecommendations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toCountry.code])

  // ── Cost of study (tuition + living) — AI-driven, country/college aware ──
  const fetchCosts = async () => {
    setCostsLoading(true)
    try {
      const res = await fetch('/api/cost-of-study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university: collegeName,
          country: toCountry.name,
          city: collegeCity,
          program,
          durationYears: duration,
        }),
      })
      const j = await res.json()
      const tuition = Number(j?.tuitionPerYearUSD)
      const living = Number(j?.livingPerYearUSD)
      if (isFinite(tuition) && tuition >= 0) setTuitionPerYearUSD(Math.round(tuition))
      if (isFinite(living) && living >= 0) setLivingPerYearUSD(Math.round(living))
      setCostsSource('auto')
      setCostsNote(j?.notes || '')
    } catch {
      // silent — keep whatever values we already have
    } finally {
      setCostsLoading(false)
    }
  }

  // Auto-fetch costs whenever the resolved college / country / program changes.
  useEffect(() => {
    if (!collegeName) return
    fetchCosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collegeName, toCountry.code, program])

  // ── Derived costs / EMI ──────────────────────────────────────────────────
  // All math is done in INR for stability, then formatted into the display currency.
  const totalCostINR = useMemo(() => {
    const tuition = tuitionPerYearUSD * duration * usdInrRate
    const living = livingPerYearUSD * duration * usdInrRate
    const adjusted = tuition + living - scholarshipINR - preStudySavingsINR
    return Math.max(0, Math.round(adjusted))
  }, [tuitionPerYearUSD, livingPerYearUSD, duration, scholarshipINR, preStudySavingsINR, usdInrRate])

  const monthlyEMIINR = useMemo(
    () => calculateEMI(loanAmountINR, interestRate, loanTenure),
    [loanAmountINR, interestRate, loanTenure],
  )
  const totalRepaymentINR = monthlyEMIINR * loanTenure * 12
  const totalInterestINR = Math.max(0, totalRepaymentINR - loanAmountINR)

  const emiTable = useMemo(
    () => emiSchedule(loanAmountINR, interestRate, loanTenure),
    [loanAmountINR, interestRate, loanTenure],
  )

  // ── AI analysis ───────────────────────────────────────────────────────────
  interface AnalysisData {
    salaryRange: { p25USD: number; medianUSD: number; p75USD: number }
    placementRatePct: number
    indiaSalaryUSD: number
    salaryGrowthPct: number
    riskRating: 'Low' | 'Medium' | 'High'
    narrative: string
    alternatives: {
      name: string
      country: string
      expectedSalaryUSDMedian: number
      totalCostUSD: number
      breakevenYears: number
    }[]
  }

  const [aiData, setAiData] = useState<AnalysisData | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const runAnalysis = async () => {
    if (!collegeName) return
    setAiLoading(true)
    setAiError('')
    try {
      const totalCostUSD = (totalCostINR + scholarshipINR + preStudySavingsINR) / usdInrRate
      const r = await fetch('/api/roi-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university: collegeName,
          country: toCountry.name,
          city: collegeCity,
          program,
          field: profileField,
          durationYears: duration,
          totalCostUSD: Math.round(totalCostUSD),
          loanAmountUSD: Math.round(loanAmountINR / usdInrRate),
          interestRatePct: interestRate,
          loanTenureYears: loanTenure,
          scholarshipUSD: Math.round(scholarshipINR / usdInrRate),
          preStudySavingsUSD: Math.round(preStudySavingsINR / usdInrRate),
          studentCgpa: profile.undergradCgpa || profile.cgpa,
          workExperienceYears: profile.yearsExperience || profile.workExpYears,
        }),
      })
      const j = await r.json()
      if (j?.data) {
        setAiData(j.data as AnalysisData)
        if (j.data.salaryGrowthPct) setSalaryGrowthPct(j.data.salaryGrowthPct)
      } else if (j?.error) {
        setAiError(j.error)
      }
    } catch (e: any) {
      setAiError(e?.message || 'Failed to analyse')
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    runAnalysis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collegeName, program, duration, toCountry.code])

  // ── Scholarships (Serper) ────────────────────────────────────────────────
  interface ScholarshipResult {
    name: string
    provider: string
    amount: string
    deadline: string
    fitReason: string
    applyUrl: string
    sourceUrl: string
  }
  const [scholarships, setScholarships] = useState<ScholarshipResult[]>([])
  const [schLoading, setSchLoading] = useState(false)

  useEffect(() => {
    if (!collegeName) return
    let cancelled = false
    setSchLoading(true)
    fetch('/api/scholarships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        university: collegeName,
        country: toCountry.name,
        field: profileField,
        degree: profileDegree,
        cgpa: profile.undergradCgpa || profile.cgpa,
        familyIncomeINR:
          (profile as any)?.familyAnnualIncomeINR ||
          parseNumber(profile.familyIncomeStr || '', 0),
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        setScholarships(Array.isArray(j?.options) ? j.options : [])
      })
      .catch(() => {})
      .finally(() => !cancelled && setSchLoading(false))
    return () => {
      cancelled = true
    }
  }, [collegeName, toCountry.code, program, profile, profileField, profileDegree])

  // ── Three-scenario projected NET cumulative wealth (INR) ─────────────────
  // Definition for the chart:
  //   Y0..Yduration = sunk cost (negative). After graduation, we add salary
  //   per year (compounded by salaryGrowthPct) and subtract annual EMI for
  //   the loan tenure. Three lines show P25 / median / P75 trajectories.
  const scenarios = useMemo(() => {
    if (!aiData) return [] as { year: number; pessimistic: number; realistic: number; optimistic: number }[]
    const sunk = -(totalCostINR + scholarshipINR + preStudySavingsINR)
    const annualEMIINR = monthlyEMIINR * 12
    const p25 = aiData.salaryRange.p25USD * usdInrRate
    const median = aiData.salaryRange.medianUSD * usdInrRate
    const p75 = aiData.salaryRange.p75USD * usdInrRate

    let cumP = sunk,
      cumR = sunk,
      cumO = sunk
    const points: { year: number; pessimistic: number; realistic: number; optimistic: number }[] = []
    for (let y = 0; y <= 10; y++) {
      if (y > duration) {
        const yrsWorking = y - duration
        const growth = Math.pow(1 + salaryGrowthPct / 100, yrsWorking - 1)
        const annualEmiAtY = yrsWorking <= loanTenure ? annualEMIINR : 0
        cumP += p25 * growth - annualEmiAtY
        cumR += median * growth - annualEmiAtY
        cumO += p75 * growth - annualEmiAtY
      }
      points.push({
        year: y,
        pessimistic: Math.round(cumP),
        realistic: Math.round(cumR),
        optimistic: Math.round(cumO),
      })
    }
    return points
  }, [
    aiData,
    totalCostINR,
    scholarshipINR,
    preStudySavingsINR,
    monthlyEMIINR,
    duration,
    salaryGrowthPct,
    loanTenure,
    usdInrRate,
  ])

  const breakevenYear = useMemo(() => {
    const idx = scenarios.findIndex((s) => s.realistic > 0)
    return idx > 0 ? idx : null
  }, [scenarios])

  const npv10yr = scenarios.length > 0 ? scenarios[scenarios.length - 1].realistic : 0

  const lifetimePremiumINR = useMemo(() => {
    if (!aiData) return 0
    const median = aiData.salaryRange.medianUSD * usdInrRate
    const india = aiData.indiaSalaryUSD * usdInrRate
    let totalAbroad = 0
    let totalIndia = 0
    for (let y = 1; y <= 30; y++) {
      totalAbroad += median * Math.pow(1 + salaryGrowthPct / 100, y - 1)
      totalIndia += india * Math.pow(1 + 0.06, y - 1)
    }
    return Math.round(totalAbroad - totalIndia)
  }, [aiData, salaryGrowthPct, usdInrRate])

  const effectiveRoiPct = useMemo(() => {
    if (totalCostINR <= 0) return 0
    return (npv10yr / totalCostINR) * 100 || 0
  }, [npv10yr, totalCostINR])

  const monthlyIncomeINR = aiData ? (aiData.salaryRange.p25USD * usdInrRate) / 12 : 0
  const debtToIncomePct = monthlyIncomeINR > 0 ? (monthlyEMIINR / monthlyIncomeINR) * 100 : 0

  // INR -> display currency
  const inrToDisplay = (v: number) => {
    if (displayCurrency === 'INR') return v
    if (displayCurrency === 'USD') return v / usdInrRate
    if (fromCountry.currency === 'INR') return v * fxRate
    // Chain via USD: INR -> USD -> destination
    const usd = v / usdInrRate
    if (fromCountry.currency === 'USD') return usd * fxRate
    return usd // best-effort fallback
  }
  const dC = (v: number) => fmt(inrToDisplay(v), displayCurrency)

  const riskColor =
    aiData?.riskRating === 'Low'
      ? 'var(--success)'
      : aiData?.riskRating === 'High'
      ? 'var(--danger)'
      : 'var(--warning)'

  // ── PDF/HTML download payload ────────────────────────────────────────────
  const reportInput = (): ROIReportInput => ({
    studentName: profile.name || 'Student',
    date: new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    university: collegeName,
    country: toCountry.name,
    city: collegeCity,
    program,
    durationYears: duration,
    currencyCode: displayCurrency,
    totalCostStr: dC(totalCostINR),
    loanRepaymentStr: dC(totalRepaymentINR),
    monthlyEMIStr: dC(monthlyEMIINR),
    totalInterestStr: dC(totalInterestINR),
    scholarshipStr: dC(scholarshipINR),
    preStudySavingsStr: dC(preStudySavingsINR),
    breakevenYears: breakevenYear,
    npv10yrStr: dC(npv10yr),
    lifetimePremiumStr: dC(lifetimePremiumINR),
    effectiveRoiPct,
    debtToIncomePct,
    salaryP25Str: aiData ? dC(aiData.salaryRange.p25USD * usdInrRate) : '—',
    salaryMedianStr: aiData ? dC(aiData.salaryRange.medianUSD * usdInrRate) : '—',
    salaryP75Str: aiData ? dC(aiData.salaryRange.p75USD * usdInrRate) : '—',
    placementRatePct: aiData?.placementRatePct || 0,
    indiaSalaryStr: aiData ? dC(aiData.indiaSalaryUSD * usdInrRate) : '—',
    riskRating: aiData?.riskRating || 'Medium',
    geminiNarrative: aiData?.narrative || 'Live analysis unavailable; using estimates.',
    scenarios: scenarios.map((s) => ({
      year: s.year,
      pessimistic: inrToDisplay(s.pessimistic),
      realistic: inrToDisplay(s.realistic),
      optimistic: inrToDisplay(s.optimistic),
    })),
    emiSchedule: emiTable.map((r) => ({
      year: r.year,
      principal: inrToDisplay(r.principal),
      interest: inrToDisplay(r.interest),
      balance: inrToDisplay(r.balance),
    })),
    alternatives: (aiData?.alternatives || []).slice(0, 2).map((a) => ({
      name: a.name,
      country: a.country,
      expectedSalaryStr: dC(a.expectedSalaryUSDMedian * usdInrRate),
      totalCostStr: dC(a.totalCostUSD * usdInrRate),
      breakevenYears: a.breakevenYears,
    })),
    scholarships: scholarships.slice(0, 6).map((s) => ({
      name: s.name,
      provider: s.provider,
      amount: s.amount,
      deadline: s.deadline,
      applyUrl: s.applyUrl,
    })),
  })

  // Donut data
  const donutData = [
    { name: 'Principal', value: loanAmountINR },
    { name: 'Interest', value: totalInterestINR },
  ]
  const donutColors = ['#6366f1', 'rgba(99,102,241,0.25)']

  return (
    <div className="max-w-7xl space-y-6">
      {!embedded && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              className="text-2xl font-bold flex items-center gap-2"
              style={{ color: 'var(--foreground)' }}
            >
              <TrendingUp className="w-6 h-6" style={{ color: 'var(--success)' }} />
              ROI Calculator
            </h2>
            <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>
              Profile-aware financial picture · live FX · AI salary grounding · math, no simulation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadHTMLReport(reportInput())}
              className="btn-secondary text-xs flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> HTML
            </button>
            <button
              onClick={() => downloadPDFReport(reportInput())}
              className="btn-primary text-xs flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
      )}

      {/* Currency toggle — high z-index parent so the chip dropdown can escape */}
      <div className="card" style={{ position: 'relative', zIndex: 60, overflow: 'visible' }}>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <ArrowLeftRight className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
            Currency converter — {COUNTRY_OPTIONS.length}+ countries
          </h3>
          <div
            className="ml-auto text-xs flex items-center gap-2 flex-wrap"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {fxLoading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" /> Live rate…
              </>
            ) : (
              <>
                <span style={{ color: 'var(--foreground)' }}>
                  1 {fromCountry.currency} ={' '}
                  <strong style={{ color: 'var(--accent)' }}>
                    {fxRate.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                  </strong>{' '}
                  {toCountry.currency}
                </span>
                {fxStamp && (
                  <>
                    <span>·</span>
                    <span>updated {fxStamp}</span>
                  </>
                )}
                <button
                  onClick={() => fetchFx(true)}
                  title="Refresh FX"
                  className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded-md"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <CountryPicker
            label="From"
            selected={fromCountry}
            onChange={setFromCountry}
            options={COUNTRY_OPTIONS}
          />
          <button
            type="button"
            onClick={swapCountries}
            className="btn-secondary self-center md:self-end h-10 px-3"
            title="Swap countries"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
          <CountryPicker
            label="To"
            selected={toCountry}
            onChange={setToCountry}
            options={COUNTRY_OPTIONS}
          />
        </div>
        <p
          className="text-[11px] mt-2"
          style={{ color: 'var(--foreground-muted)' }}
        >
          Rates pulled live from open FX feeds with an AI-backed fallback. Click refresh to fetch
          again. All numbers below are auto-converted as you change either side.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inputs */}
        <div className="space-y-4" style={{ position: 'relative', zIndex: 1 }}>
          <div className="card">
            <label
              className="text-xs uppercase tracking-widest font-bold block mb-2"
              style={{ color: 'var(--foreground-muted)' }}
            >
              College
            </label>
            <div className="flex gap-2" style={{ position: 'relative' }}>
              <input
                className="input-field flex-1"
                placeholder={`Search a college in ${toCountry.name}…`}
                value={collegeHintInput}
                onChange={(e) => onCollegeHintChange(e.target.value)}
                onFocus={() => setShowCollegeDropdown(true)}
                onBlur={() => {
                  // Delay so a click on a suggestion registers before the dropdown closes.
                  setTimeout(() => setShowCollegeDropdown(false), 180)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (collegeSuggestions.length > 0) {
                      pickCollege(collegeSuggestions[0])
                    } else {
                      lookupCollege(collegeHintInput)
                    }
                  } else if (e.key === 'Escape') {
                    setShowCollegeDropdown(false)
                  }
                }}
              />
              <button
                onClick={() => lookupCollege(collegeHintInput)}
                disabled={collegeLoading}
                className="btn-primary text-xs flex items-center gap-1 disabled:opacity-50"
              >
                {collegeLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <SearchIcon className="w-3.5 h-3.5" />
                )}
                Find
              </button>

              {showCollegeDropdown &&
                (collegeAcLoading ||
                  collegeSuggestions.length > 0 ||
                  collegeRecs.length > 0) && (
                  <div
                    className="absolute left-0 right-0 mt-1 max-h-72 overflow-auto rounded-lg shadow-lg z-50"
                    style={{
                      top: '100%',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {collegeAcLoading && (
                      <div
                        className="px-3 py-2 text-xs flex items-center gap-2"
                        style={{ color: 'var(--foreground-muted)' }}
                      >
                        <Loader2 className="w-3 h-3 animate-spin" /> Searching universities in {toCountry.name}…
                      </div>
                    )}
                    {!collegeAcLoading && collegeSuggestions.length > 0 && (
                      <div>
                        <div
                          className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold"
                          style={{
                            color: 'var(--foreground-muted)',
                            background: 'var(--background-secondary)',
                          }}
                        >
                          Matches in {toCountry.name}
                        </div>
                        {collegeSuggestions.map((m) => (
                          <button
                            key={`s-${m.place_id || m.name}`}
                            type="button"
                            onClick={() => pickCollege(m)}
                            className="w-full text-left px-3 py-2 text-xs flex items-start gap-2 hover:bg-[var(--background-secondary)] transition-colors"
                          >
                            <Building2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                            <span className="flex-1 min-w-0">
                              <span className="block font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                                {m.name}
                              </span>
                              {m.formatted_address && (
                                <span className="block truncate" style={{ color: 'var(--foreground-muted)' }}>
                                  {m.formatted_address}
                                </span>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {!collegeAcLoading &&
                      collegeSuggestions.length === 0 &&
                      collegeRecs.length > 0 && (
                        <div>
                          <div
                            className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5"
                            style={{
                              color: 'var(--foreground-muted)',
                              background: 'var(--background-secondary)',
                            }}
                          >
                            <Sparkles className="w-3 h-3" style={{ color: 'var(--accent)' }} />
                            Recommended for your {profileField} profile in {toCountry.name}
                          </div>
                          {collegeRecs.map((m) => (
                            <button
                              key={`r-${m.place_id || m.name}`}
                              type="button"
                              onClick={() => pickCollege(m)}
                              className="w-full text-left px-3 py-2 text-xs flex items-start gap-2 hover:bg-[var(--background-secondary)] transition-colors"
                            >
                              <Building2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                              <span className="flex-1 min-w-0">
                                <span className="block font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                                  {m.name}
                                </span>
                                {m.formatted_address && (
                                  <span className="block truncate" style={{ color: 'var(--foreground-muted)' }}>
                                    {m.formatted_address}
                                  </span>
                                )}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                )}
            </div>
            {collegeName && (
              <div
                className="mt-2 p-2 rounded-md text-xs"
                style={{
                  background: 'var(--background-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <div className="font-bold" style={{ color: 'var(--foreground)' }}>
                  {collegeName}
                </div>
                {collegeAddress && (
                  <div
                    className="flex items-start gap-1 mt-0.5"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{collegeAddress}</span>
                  </div>
                )}
                <div
                  className="text-[10px] mt-1"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  Source: {collegeSource || 'profile'}
                </div>
              </div>
            )}

            <label
              className="text-xs uppercase tracking-widest font-bold block mt-3 mb-2"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Program
            </label>
            <input
              className="input-field"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
            />
          </div>

          <div className="card">
            <label
              className="text-xs uppercase tracking-widest font-bold block mb-2"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Course duration: <span style={{ color: 'var(--accent)' }}>{duration} yr</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className="flex-1 py-1.5 text-xs rounded-md font-semibold"
                  style={{
                    background: duration === d ? 'var(--primary-light)' : 'var(--surface)',
                    color: duration === d ? 'white' : 'var(--foreground-secondary)',
                    border: `1px solid ${duration === d ? 'var(--primary-light)' : 'var(--border)'}`,
                  }}
                >
                  {d}-yr
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mt-4 mb-2">
              <label
                className="text-xs uppercase tracking-widest font-bold"
                style={{ color: 'var(--foreground-muted)' }}
              >
                Tuition / yr (USD): <span style={{ color: 'var(--foreground)' }}>{fmt(tuitionPerYearUSD, 'USD')}</span>
              </label>
              <span className="flex items-center gap-1.5">
                {costsLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--foreground-muted)' }} />
                ) : costsSource === 'auto' ? (
                  <span
                    className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--primary-light)' }}
                    title={costsNote || 'AI-suggested for this college and country'}
                  >
                    Auto
                  </span>
                ) : costsSource === 'manual' ? (
                  <span
                    className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--warning)' }}
                  >
                    Manual
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={fetchCosts}
                  disabled={costsLoading}
                  title="Refresh suggested costs"
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md disabled:opacity-50"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </span>
            </div>
            <input
              type="number"
              className="input-field"
              value={tuitionPerYearUSD}
              onChange={(e) => {
                setTuitionPerYearUSD(Math.max(0, Number(e.target.value)))
                setCostsSource('manual')
              }}
            />

            <label
              className="text-xs uppercase tracking-widest font-bold block mt-4 mb-2"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Living cost / yr (USD): <span style={{ color: 'var(--foreground)' }}>{fmt(livingPerYearUSD, 'USD')}</span>
            </label>
            <input
              type="number"
              className="input-field"
              value={livingPerYearUSD}
              onChange={(e) => {
                setLivingPerYearUSD(Math.max(0, Number(e.target.value)))
                setCostsSource('manual')
              }}
            />
            {costsNote && costsSource === 'auto' && (
              <p
                className="text-[11px] mt-1.5"
                style={{ color: 'var(--foreground-muted)' }}
              >
                {costsNote}
              </p>
            )}
          </div>

          <div className="card">
            <label
              className="text-xs uppercase tracking-widest font-bold block mb-2"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Loan amount (₹L): <span style={{ color: 'var(--accent)' }}>₹{(loanAmountINR / 100000).toFixed(0)}L</span>
            </label>
            <input
              type="range"
              min="0"
              max="120"
              value={loanAmountINR / 100000}
              onChange={(e) => setLoanAmountINR(Number(e.target.value) * 100000)}
              className="w-full"
            />

            <label
              className="text-xs uppercase tracking-widest font-bold block mt-3 mb-2"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Interest rate: <span style={{ color: 'var(--accent)' }}>{interestRate}%</span>
            </label>
            <input
              type="range"
              min="6"
              max="16"
              step="0.25"
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              className="w-full"
            />

            <label
              className="text-xs uppercase tracking-widest font-bold block mt-3 mb-2"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Tenure: <span style={{ color: 'var(--accent)' }}>{loanTenure} yr</span>
            </label>
            <input
              type="range"
              min="3"
              max="15"
              value={loanTenure}
              onChange={(e) => setLoanTenure(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="card">
            <label
              className="text-xs uppercase tracking-widest font-bold block mb-2"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Scholarship deduction (₹L)
            </label>
            <input
              type="number"
              className="input-field"
              value={scholarshipINR / 100000}
              onChange={(e) => setScholarshipINR(Math.max(0, Number(e.target.value) * 100000))}
            />

            <label
              className="text-xs uppercase tracking-widest font-bold block mt-3 mb-2"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Pre-study savings (₹L)
            </label>
            <input
              type="number"
              className="input-field"
              value={preStudySavingsINR / 100000}
              onChange={(e) => setPreStudySavingsINR(Math.max(0, Number(e.target.value) * 100000))}
            />

            <label
              className="text-xs uppercase tracking-widest font-bold block mt-3 mb-2"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Salary growth rate (suggested {aiData?.salaryGrowthPct ?? '—'}%):{' '}
              <span style={{ color: 'var(--accent)' }}>{salaryGrowthPct}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="15"
              step="0.5"
              value={salaryGrowthPct}
              onChange={(e) => setSalaryGrowthPct(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* 8 KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI
              icon={<DollarSign className="w-4 h-4" />}
              label="Total Cost of Education"
              value={dC(totalCostINR)}
              tone="default"
            />
            <KPI
              icon={<DollarSign className="w-4 h-4" />}
              label="Loan Repayment"
              value={dC(totalRepaymentINR)}
              tone="default"
            />
            <KPI
              icon={<Calendar className="w-4 h-4" />}
              label="Monthly EMI"
              value={dC(monthlyEMIINR)}
              tone="default"
            />
            <KPI
              icon={<ArrowUpRight className="w-4 h-4" />}
              label="Breakeven"
              value={breakevenYear ? `Year ${breakevenYear}` : '> 10 yrs'}
              tone="success"
            />
            <KPI
              icon={<TrendingUp className="w-4 h-4" />}
              label="10-yr Net Position"
              value={dC(npv10yr)}
              tone={npv10yr > 0 ? 'success' : 'danger'}
            />
            <KPI
              icon={<Sparkles className="w-4 h-4" />}
              label="Lifetime Premium vs India"
              value={dC(lifetimePremiumINR)}
              tone="success"
            />
            <KPI
              icon={<TrendingUp className="w-4 h-4" />}
              label="Effective ROI"
              value={`${effectiveRoiPct.toFixed(1)}%`}
              tone={effectiveRoiPct > 0 ? 'success' : 'danger'}
            />
            <KPI
              icon={<ShieldCheck className="w-4 h-4" />}
              label="Debt-to-Income"
              value={`${debtToIncomePct.toFixed(0)}%`}
              tone={debtToIncomePct > 45 ? 'danger' : debtToIncomePct > 25 ? 'warning' : 'success'}
            />
          </div>

          {/* AI insight */}
          <div
            className="card"
            style={{
              background: 'rgba(99,102,241,0.04)',
              borderColor: 'rgba(99,102,241,0.25)',
            }}
          >
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5" style={{ color: 'var(--primary)' }} />
              <div className="flex-1">
                <div
                  className="text-xs uppercase tracking-widest font-bold flex items-center gap-2 mb-1.5"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  AI ROI Analysis
                  {aiData && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                      style={{ background: `${riskColor}22`, color: riskColor }}
                    >
                      {aiData.riskRating} risk
                    </span>
                  )}
                </div>
                {aiLoading ? (
                  <div
                    className="text-sm flex items-center gap-2"
                    style={{ color: 'var(--foreground-secondary)' }}
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing salary range, placement rate, and risk…
                  </div>
                ) : aiError ? (
                  <p className="text-sm" style={{ color: 'var(--danger)' }}>
                    {aiError}
                  </p>
                ) : aiData ? (
                  <>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: 'var(--foreground-secondary)' }}
                    >
                      {aiData.narrative}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                      <MiniStat
                        label="P25 salary"
                        value={dC(aiData.salaryRange.p25USD * usdInrRate)}
                      />
                      <MiniStat
                        label="Median salary"
                        value={dC(aiData.salaryRange.medianUSD * usdInrRate)}
                      />
                      <MiniStat
                        label="P75 salary"
                        value={dC(aiData.salaryRange.p75USD * usdInrRate)}
                      />
                      <MiniStat
                        label="Placement"
                        value={`${aiData.placementRatePct.toFixed(0)}%`}
                      />
                    </div>
                  </>
                ) : (
                  <p
                    className="text-sm"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    Pick a college above to start the analysis.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Scenario chart — explained */}
          <div className="card" style={{ padding: '1rem' }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div
                  className="text-sm font-medium"
                  style={{ color: 'var(--foreground)' }}
                >
                  Net wealth trajectory — 3 income scenarios
                </div>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  Net = cumulative post-graduation salary minus total cost of education and EMIs.
                </p>
              </div>
              <span
                className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md"
                style={{
                  background: 'var(--background-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground-muted)',
                }}
              >
                <Info className="w-3 h-3" /> {displayCurrency} on Y-axis · zero line = breakeven
              </span>
            </div>
            {scenarios.length === 0 ? (
              <div
                className="py-12 text-center text-sm"
                style={{ color: 'var(--foreground-muted)' }}
              >
                Waiting for the salary baseline…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart
                  data={scenarios.map((s) => ({
                    year: `Y${s.year}`,
                    Pessimistic: inrToDisplay(s.pessimistic),
                    Realistic: inrToDisplay(s.realistic),
                    Optimistic: inrToDisplay(s.optimistic),
                  }))}
                >
                  <defs>
                    <linearGradient id="optGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="medGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="pesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" />
                  <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(v) => fmt(Number(v), displayCurrency)}
                  />
                  <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" label={{ value: 'Breakeven', fill: '#94a3b8', fontSize: 11, position: 'right' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                    }}
                    formatter={(v) => fmt(Number(v), displayCurrency)}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="Optimistic"
                    stroke="#10b981"
                    fill="url(#optGrad)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="Realistic"
                    stroke="#6366f1"
                    fill="url(#medGrad)"
                    strokeWidth={2.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="Pessimistic"
                    stroke="#ef4444"
                    fill="url(#pesGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
            <div
              className="mt-3 p-3 rounded-md text-xs leading-relaxed"
              style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}
            >
              <strong style={{ color: 'var(--foreground)' }}>How to read this chart:</strong>{' '}
              <span style={{ color: 'var(--foreground-secondary)' }}>
                Years 0–{duration} are your study period — net wealth dips to{' '}
                <strong>{dC(totalCostINR)}</strong> in the negative because tuition + living are paid
                without income. After graduation, salary kicks in and slowly pays the cost back.
                The three coloured bands show outcomes if you land at the bottom 25% (
                <span style={{ color: 'var(--danger)' }}>Pessimistic</span>), middle (
                <span style={{ color: 'var(--primary-light)' }}>Realistic</span>), or top 25% (
                <span style={{ color: 'var(--success)' }}>Optimistic</span>) of starting salaries
                for grads of {collegeName || 'this program'}. The dotted line at zero is the
                breakeven point — when you've earned back what you spent. Crossing it sooner is
                better.
              </span>
            </div>
          </div>

          {/* EMI schedule + donut */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <div
                className="text-sm font-medium mb-2"
                style={{ color: 'var(--foreground)' }}
              >
                Loan repayment — first 5 years
              </div>
              <p
                className="text-xs mb-2"
                style={{ color: 'var(--foreground-muted)' }}
              >
                How much of each EMI year goes to paying down the principal vs interest, plus the
                outstanding balance at year-end.
              </p>
              {emiTable.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  No active loan.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ color: 'var(--foreground-muted)' }}>
                        <th className="text-left py-1">Year</th>
                        <th className="text-right py-1">Principal</th>
                        <th className="text-right py-1">Interest</th>
                        <th className="text-right py-1">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emiTable.slice(0, 5).map((r) => (
                        <tr key={r.year} style={{ borderTop: '1px solid var(--border)' }}>
                          <td className="py-1.5">{r.year}</td>
                          <td className="py-1.5 text-right">{dC(r.principal)}</td>
                          <td className="py-1.5 text-right">{dC(r.interest)}</td>
                          <td className="py-1.5 text-right">{dC(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <div
                className="text-sm font-medium mb-2"
                style={{ color: 'var(--foreground)' }}
              >
                Principal vs Interest split
              </div>
              <p
                className="text-xs mb-2"
                style={{ color: 'var(--foreground-muted)' }}
              >
                Of every rupee you pay back, this is how much goes to the bank as interest vs
                clearing the original loan. A bigger interest slice means a longer/costlier loan.
              </p>
              {loanAmountINR <= 0 ? (
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  No active loan.
                </p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {donutData.map((_, i) => (
                          <Cell key={i} fill={donutColors[i]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => fmt(inrToDisplay(Number(v)), displayCurrency)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="text-xs space-y-1.5">
                    <div>
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1.5"
                        style={{ background: donutColors[0] }}
                      />
                      Principal — {dC(loanAmountINR)}
                    </div>
                    <div>
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1.5"
                        style={{ background: donutColors[1] }}
                      />
                      Interest — {dC(totalInterestINR)}
                    </div>
                    <div className="pt-1.5" style={{ color: 'var(--foreground-muted)' }}>
                      Total repayment{' '}
                      <strong style={{ color: 'var(--foreground)' }}>
                        {dC(totalRepaymentINR)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Alternatives table */}
          {aiData && aiData.alternatives.length > 0 && (
            <div className="card">
              <div
                className="text-sm font-medium mb-1 flex items-center gap-2"
                style={{ color: 'var(--foreground)' }}
              >
                <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                Alternative colleges with similar / better ROI
              </div>
              <p
                className="text-xs mb-3"
                style={{ color: 'var(--foreground-muted)' }}
              >
                Same field, comparable rank — but with a faster breakeven. Useful when shortlisting.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead style={{ color: 'var(--foreground-muted)' }}>
                    <tr>
                      <th className="text-left py-1">College</th>
                      <th className="text-left py-1">Country</th>
                      <th className="text-right py-1">Total Cost</th>
                      <th className="text-right py-1">Median Salary</th>
                      <th className="text-right py-1">Breakeven</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      style={{
                        background: 'rgba(99,102,241,0.06)',
                        borderTop: '1px solid var(--border)',
                      }}
                    >
                      <td className="py-1.5">
                        <strong style={{ color: 'var(--foreground)' }}>{collegeName}</strong>{' '}
                        <span style={{ color: 'var(--accent)' }}>(your pick)</span>
                      </td>
                      <td className="py-1.5">{toCountry.name}</td>
                      <td className="py-1.5 text-right">{dC(totalCostINR)}</td>
                      <td className="py-1.5 text-right">
                        {dC(aiData.salaryRange.medianUSD * usdInrRate)}
                      </td>
                      <td className="py-1.5 text-right">
                        {breakevenYear ? `Year ${breakevenYear}` : '> 10 yrs'}
                      </td>
                    </tr>
                    {aiData.alternatives.slice(0, 2).map((a, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="py-1.5">{a.name}</td>
                        <td className="py-1.5">{a.country}</td>
                        <td className="py-1.5 text-right">{dC(a.totalCostUSD * usdInrRate)}</td>
                        <td className="py-1.5 text-right">
                          {dC(a.expectedSalaryUSDMedian * usdInrRate)}
                        </td>
                        <td className="py-1.5 text-right">Year {a.breakevenYears}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Scholarships */}
          <div className="card">
            <div
              className="text-sm font-medium mb-1 flex items-center gap-2"
              style={{ color: 'var(--foreground)' }}
            >
              <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              Scholarships matched to your profile
              {schLoading && <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" />}
            </div>
            <p
              className="text-xs mb-3"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Live web results filtered for grants/fellowships open to Indian students for {profileField} in {toCountry.name}.
            </p>
            {scholarships.length === 0 && !schLoading ? (
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                No scholarships found yet — change country or program to broaden the search.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {scholarships.map((s, i) => (
                  <motion.div
                    key={`${s.applyUrl}-${i}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 6) * 0.04 }}
                    className="p-3 rounded-lg"
                    style={{
                      background: 'var(--background-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                      {s.name}
                    </div>
                    <div
                      className="text-[11px] mt-0.5"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      {s.provider} · {s.amount} · {s.deadline}
                    </div>
                    <div
                      className="text-xs mt-1.5 leading-snug"
                      style={{ color: 'var(--foreground-secondary)' }}
                    >
                      {s.fitReason}
                    </div>
                    <a
                      href={s.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs mt-2 inline-flex items-center gap-1"
                      style={{ color: 'var(--primary-light)' }}
                    >
                      Apply <ExternalLink className="w-3 h-3" />
                    </a>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Subcomponents ───────────────────────────────────────────────────────────
function KPI({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'default' | 'success' | 'warning' | 'danger'
}) {
  const color =
    tone === 'success'
      ? 'var(--success)'
      : tone === 'danger'
      ? 'var(--danger)'
      : tone === 'warning'
      ? 'var(--warning)'
      : 'var(--foreground)'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="stat-card"
    >
      <div
        className="flex items-center gap-1.5 mb-1"
        style={{ color: 'var(--foreground-muted)' }}
      >
        {icon}
        <div className="text-[10px] uppercase tracking-widest font-bold">{label}</div>
      </div>
      <div className="text-base font-bold" style={{ color }}>
        {value}
      </div>
    </motion.div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="p-2 rounded-md"
      style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}
    >
      <div
        className="text-[10px] uppercase tracking-wider"
        style={{ color: 'var(--foreground-muted)' }}
      >
        {label}
      </div>
      <div className="text-xs font-bold mt-0.5" style={{ color: 'var(--foreground)' }}>
        {value}
      </div>
    </div>
  )
}

// ── Country picker — searchable, scrollable, 200+ countries ─────────────────
function CountryPicker({
  label,
  selected,
  onChange,
  options,
}: {
  label: string
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
    <div className="flex-1 relative">
      <label
        className="text-xs uppercase tracking-widest font-bold block mb-1.5"
        style={{ color: 'var(--foreground-muted)' }}
      >
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input-field flex items-center justify-between w-full"
      >
        <span style={{ color: 'var(--foreground)' }}>
          {selected.name}{' '}
          <span style={{ color: 'var(--foreground-muted)' }}>({selected.currency})</span>
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <>
          {/* Click-away catcher */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 200 }}
          />
          <div
            className="absolute mt-1 w-full rounded-lg shadow-lg"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              maxHeight: 320,
              overflow: 'hidden',
              zIndex: 210,
            }}
          >
            <div
              className="p-2 sticky top-0"
              style={{
                background: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div className="relative">
                <SearchIcon
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: 'var(--foreground-muted)' }}
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search 200+ countries…"
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
            <div style={{ maxHeight: 250, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div
                  className="p-3 text-xs text-center"
                  style={{ color: 'var(--foreground-muted)' }}
                >
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
                    <span>{c.name}</span>
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
