'use client'

// Scholarship Hunter — live, profile-aware scholarship discovery.
// ----------------------------------------------------------------------------
// Auto-pulls scholarship cards from /api/scholarships using the student's
// profile defaults (target country, field, degree, CGPA, family income).
// Free-text search submits a fresh server-side query; local filter narrows
// the already-fetched cards without an extra API call.

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { parseNumber } from '@/lib/utils'
import { countries as RAW_COUNTRIES } from 'countries-list'
import {
  Award,
  Sparkles,
  ExternalLink,
  Loader2,
  Calendar,
  Globe,
  Search,
  RefreshCw,
  Filter,
  ChevronDown,
  X,
  Building2,
} from 'lucide-react'

interface ScholarshipResult {
  name: string
  provider: string
  amount: string
  deadline: string
  fitReason: string
  applyUrl: string
  sourceUrl: string
}

interface CountryOption {
  code: string
  name: string
}
const COUNTRY_OPTIONS: CountryOption[] = Object.entries(RAW_COUNTRIES)
  .map(([code, info]) => ({ code, name: (info as any).name as string }))
  .sort((a, b) => a.name.localeCompare(b.name))

const findCountryByName = (name?: string): CountryOption | undefined => {
  if (!name) return undefined
  const n = name.trim().toLowerCase()
  return COUNTRY_OPTIONS.find(
    (c) => c.name.toLowerCase() === n || c.code.toLowerCase() === n,
  )
}

const FIELD_OPTIONS = [
  'Computer Science',
  'Data Science',
  'Engineering',
  'Business',
  'Finance',
  'Economics',
  'Medicine',
  'Public Health',
  'Law',
  'Arts',
  'Design',
  'Architecture',
]
const DEGREE_OPTIONS = ['MS', 'MBA', 'MIM', 'MA', 'MPH', 'M.Arch', 'LLM', 'MFA', 'PhD']

export default function ScholarshipHunter({
  embedded = false,
}: { embedded?: boolean } = {}) {
  const { profile, setCurrentPage } = useAppStore()

  // Profile-derived defaults
  const profileCountryName =
    (profile as any)?.targetCountries?.[0] || profile?.targetCountry?.[0] || 'USA'
  const profileFieldName =
    (profile as any)?.targetField || profile?.targetProgram || 'Computer Science'
  const profileDegreeName = (profile as any)?.targetDegree || 'MS'

  const [country, setCountry] = useState<CountryOption>(
    findCountryByName(profileCountryName) || findCountryByName('USA') || COUNTRY_OPTIONS[0],
  )
  const [field, setField] = useState<string>(profileFieldName)
  const [degree, setDegree] = useState<string>(profileDegreeName)
  const [localFilter, setLocalFilter] = useState('')

  const [results, setResults] = useState<ScholarshipResult[]>([])
  const [loading, setLoading] = useState(false)
  // Local filter applies on top of fetched results.
  // The free-text search box below also drives a server-side query.
  const [serverQuery, setServerQuery] = useState('')

  const cgpa = profile.undergradCgpa || profile.cgpa
  const familyIncomeINR =
    (profile as any)?.familyAnnualIncomeINR ||
    parseNumber(profile.familyIncomeStr || '', 0)

  const fetchScholarships = async (query?: string) => {
    setLoading(true)
    try {
      const r = await fetch('/api/scholarships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: country.name,
          field,
          degree,
          cgpa,
          familyIncomeINR,
          count: 12,
          userQuery: (query ?? serverQuery).trim() || undefined,
        }),
      })
      const j = await r.json()
      const list: ScholarshipResult[] = Array.isArray(j?.options) ? j.options : []
      setResults(list)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch on mount and when filters change. We deliberately exclude
  // serverQuery from the dep list — the user submits that explicitly.
  useEffect(() => {
    fetchScholarships()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country.code, field, degree])

  const filtered = useMemo(() => {
    const q = localFilter.trim().toLowerCase()
    if (!q) return results
    return results.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.provider.toLowerCase().includes(q) ||
        r.fitReason.toLowerCase().includes(q),
    )
  }, [results, localFilter])

  const isDomestic = country.name.toLowerCase() === 'india'

  return (
    <div className="max-w-7xl space-y-6">
      {!embedded && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2
              className="text-2xl font-bold flex items-center gap-2"
              style={{ color: 'var(--foreground)' }}
            >
              <Award className="w-6 h-6" style={{ color: 'var(--accent)' }} />
              Scholarship Hunter
            </h2>
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--foreground-secondary)' }}
            >
              Live scholarship cards matched to your profile in {country.name}.
              {isDomestic
                ? ' Switch to a foreign country above to plan your study-abroad funding.'
                : ''}
            </p>
          </div>
          <button
            onClick={() => fetchScholarships()}
            disabled={loading}
            className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ position: 'relative', zIndex: 60, overflow: 'visible' }}>
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
            Match my profile
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <CountryPicker
            label="Destination country"
            selected={country}
            onChange={setCountry}
            options={COUNTRY_OPTIONS}
          />
          <PillSelect label="Field of study" value={field} options={FIELD_OPTIONS} onChange={setField} />
          <PillSelect label="Degree" value={degree} options={DEGREE_OPTIONS} onChange={setDegree} />
        </div>

        {/* Server-side scholarship search by user input */}
        <form
          className="mt-3 relative"
          onSubmit={(e) => {
            e.preventDefault()
            fetchScholarships(serverQuery)
          }}
        >
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--foreground-muted)' }}
          />
          <input
            value={serverQuery}
            onChange={(e) => setServerQuery(e.target.value)}
            placeholder='Search scholarships e.g. "merit-based for women in STEM" or "fully funded PhD"'
            className="input-field pl-10 pr-28 text-sm"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {serverQuery && (
              <button
                type="button"
                onClick={() => {
                  setServerQuery('')
                  fetchScholarships('')
                }}
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
              type="submit"
              disabled={loading}
              className="btn-primary text-xs flex items-center gap-1 disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5" /> Search
            </button>
          </div>
        </form>

        {/* Local filter on already-fetched results — no API call */}
        <div className="mt-3 relative">
          <Filter
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--foreground-muted)' }}
          />
          <input
            value={localFilter}
            onChange={(e) => setLocalFilter(e.target.value)}
            placeholder="Filter results below (name, provider, eligibility)…"
            className="input-field pl-10 pr-9 text-sm"
          />
          {localFilter && (
            <button
              type="button"
              onClick={() => setLocalFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5" style={{ color: 'var(--foreground-muted)' }} />
            </button>
          )}
        </div>
      </div>

      {/* India notice — pivot to foreign plans */}
      {isDomestic && (
        <div
          className="card flex flex-col md:flex-row gap-3 md:items-center md:justify-between"
          style={{
            background: 'rgba(245,158,11,0.06)',
            borderColor: 'rgba(245,158,11,0.25)',
          }}
        >
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 mt-0.5" style={{ color: 'var(--warning)' }} />
            <div>
              <div
                className="text-sm font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                Planning to study abroad from India?
              </div>
              <p
                className="text-xs mt-1 leading-relaxed"
                style={{ color: 'var(--foreground-secondary)' }}
              >
                Switch the destination above to USA, Canada, UK, Germany, or any other country to
                see scholarships open to Indian applicants for foreign master's/PhD programs. You
                can also map your scores to specific colleges or estimate the financial picture
                using the calculators.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['USA', 'Canada', 'UK', 'Germany', 'Australia'].map((cn) => {
              const c = findCountryByName(cn)
              if (!c) return null
              return (
                <button
                  key={cn}
                  onClick={() => setCountry(c)}
                  className="text-xs font-medium px-3 py-1.5 rounded-full"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                  }}
                >
                  {cn}
                </button>
              )
            })}
            <button
              onClick={() => setCurrentPage('college-match')}
              className="btn-primary text-xs"
            >
              College Match →
            </button>
            <button
              onClick={() => setCurrentPage('roi-calculator')}
              className="btn-secondary text-xs"
            >
              ROI Calculator →
            </button>
          </div>
        </div>
      )}

      {/* Results grid */}
      {loading && results.length === 0 ? (
        <div className="card flex items-center gap-2 justify-center py-10">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--primary)' }} />
          <span className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
            Scanning live scholarship pages for {field} in {country.name}…
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-10">
          <Search className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--foreground-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--foreground)' }}>
            No scholarships matched.
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
            Try a different country, field, or clear the search filter.
          </p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s, i) => (
              <motion.div
                key={`${s.applyUrl}-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 11) * 0.04 }}
                className="card flex flex-col gap-2"
                style={{ padding: '1.1rem 1.25rem' }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.12)' }}
                  >
                    <Award className="w-5 h-5" style={{ color: 'var(--primary-light)' }} />
                  </div>
                  <div className="min-w-0">
                    <div
                      className="font-bold text-sm truncate"
                      style={{ color: 'var(--foreground)' }}
                      title={s.name}
                    >
                      {s.name}
                    </div>
                    <div
                      className="text-[11px] mt-0.5 flex items-center gap-1 truncate"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      <Building2 className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{s.provider}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-1">
                  {s.amount && s.amount !== '—' && (
                    <span
                      className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full"
                      style={{
                        background: 'rgba(16,185,129,0.12)',
                        color: 'var(--success)',
                      }}
                    >
                      {s.amount}
                    </span>
                  )}
                  {s.deadline && s.deadline !== '—' && (
                    <span
                      className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full inline-flex items-center gap-1"
                      style={{
                        background: 'var(--background-secondary)',
                        color: 'var(--foreground-secondary)',
                      }}
                    >
                      <Calendar className="w-2.5 h-2.5" /> {s.deadline}
                    </span>
                  )}
                  <span
                    className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full inline-flex items-center gap-1"
                    style={{
                      background: 'var(--background-secondary)',
                      color: 'var(--foreground-secondary)',
                    }}
                  >
                    <Globe className="w-2.5 h-2.5" /> {country.name}
                  </span>
                </div>

                <p
                  className="text-xs leading-relaxed mt-1"
                  style={{ color: 'var(--foreground-secondary)' }}
                >
                  {s.fitReason}
                </p>

                <div className="flex items-center gap-2 mt-auto pt-2">
                  <a
                    href={s.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary text-xs flex items-center gap-1"
                  >
                    Apply <ExternalLink className="w-3 h-3" />
                  </a>
                  {s.sourceUrl && s.sourceUrl !== s.applyUrl && (
                    <a
                      href={s.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs flex items-center gap-1"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      Source <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}

// ── Subcomponents ───────────────────────────────────────────────────────────
function PillSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <label
        className="text-[10px] uppercase tracking-widest font-bold block mb-1.5"
        style={{ color: 'var(--foreground-muted)' }}
      >
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input-field flex items-center justify-between w-full"
      >
        <span style={{ color: 'var(--foreground)' }}>{value}</span>
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
              maxHeight: 280,
              overflowY: 'auto',
              zIndex: 210,
            }}
          >
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt)
                  setOpen(false)
                }}
                className="w-full text-left px-3 py-2 text-sm"
                style={{
                  background: opt === value ? 'var(--primary-light)' : 'transparent',
                  color: opt === value ? 'white' : 'var(--foreground)',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

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
    return options.filter((c) => c.name.toLowerCase().includes(s))
  }, [options, q])

  return (
    <div className="relative">
      <label
        className="text-[10px] uppercase tracking-widest font-bold block mb-1.5"
        style={{ color: 'var(--foreground-muted)' }}
      >
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input-field flex items-center justify-between w-full"
      >
        <span style={{ color: 'var(--foreground)' }}>{selected.name}</span>
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
                <Search
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
                    className="w-full text-left px-3 py-2 text-sm"
                    style={{
                      background:
                        c.code === selected.code ? 'var(--primary-light)' : 'transparent',
                      color: c.code === selected.code ? 'white' : 'var(--foreground)',
                    }}
                  >
                    {c.name}
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
