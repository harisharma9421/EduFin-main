'use client'

// Loan Center — live, profile-personalized education loan discovery.
// All options are fetched in real-time via Serper + Gemini using the student's
// CGPA, target country/university and computed loan need. There is no
// hardcoded NBFC list; cards only render once real data has arrived.

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { useJourneyStore } from '@/lib/journeyStore'
import { formatINR, parseNumber, parseBudgetToLakhs } from '@/lib/utils'
import {
  DollarSign, Award, Shield, ExternalLink, Globe, ArrowRight, CheckCircle2,
  Loader2, Search, Building2, Star,
} from 'lucide-react'

interface LoanOption {
  name: string
  provider: string
  providerType?: string
  summary: string
  fitReason?: string
  interestRate: string
  maxLoanINR?: number
  tenure?: string
  collateral?: string
  processingFee?: string
  moratorium?: string
  features?: string[]
  applyUrl?: string
  sourceUrl?: string
  sourceName?: string
  eligible?: boolean
  eligibilityNote?: string
}

const SkeletonCard = () => (
  <div className="card animate-pulse" style={{ borderColor: 'var(--border)' }}>
    <div className="flex gap-4">
      <div className="w-14 h-14 rounded-xl" style={{ background: 'var(--background-secondary)' }} />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 rounded" style={{ background: 'var(--background-secondary)' }} />
        <div className="h-3 w-1/2 rounded" style={{ background: 'var(--background-secondary)' }} />
        <div className="grid grid-cols-4 gap-3 mt-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded" style={{ background: 'var(--background-secondary)' }} />
          ))}
        </div>
      </div>
    </div>
  </div>
)

export default function LoanCenter({ embedded = false }: { embedded?: boolean } = {}) {
  const { profile } = useAppStore()
  const decisionState = useJourneyStore.getState()

  const [options, setOptions] = useState<LoanOption[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  // Compute loan need from the new schema first, fall back to legacy.
  const budgetLakhs = parseBudgetToLakhs(profile.expectedBudgetStr) || profile.budgetLakhs || 0
  const savingsLakhs = parseNumber(profile.savingsLakhs, 0)
  const loanNeededLakhs = Math.max(0, budgetLakhs - savingsLakhs)
  const cgpaDisplay = profile.undergradCgpa || (profile.cgpa ? String(profile.cgpa) : 'N/A')

  const fetchOptions = useCallback(async (query?: string) => {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/loan-intel/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileData: {
            ...profile,
            budgetLakhs,
            savingsLakhs,
            cgpa: profile.cgpa || parseFloat(profile.undergradCgpa || '0'),
          },
          decisionState,
          userQuery: (query ?? searchTerm).trim(),
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setOptions((json.options || []) as LoanOption[])
    } catch (e: any) {
      setErr(e?.message || 'Could not load live loan options. Please try again.')
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [profile, budgetLakhs, savingsLakhs, searchTerm])

  useEffect(() => {
    fetchOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const eligibleCount = options ? options.filter((o) => o.eligible !== false).length : 0
  const total = options?.length || 0
  const targetCountry =
    (profile.targetCountries && profile.targetCountries[0]) ||
    (Array.isArray(profile.targetCountry) ? profile.targetCountry[0] : '') ||
    'your destination'

  return (
    <div className="max-w-6xl space-y-6">
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              <DollarSign className="w-6 h-6" style={{ color: 'var(--accent)' }} />
              Education Loan Center
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              Live loan options matched to your profile — fetched in real time, ranked by fit.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              fetchOptions(searchTerm)
            }}
            className="flex items-center gap-2 w-full sm:w-auto sm:max-w-xl"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--foreground-muted)' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder='e.g. "no collateral loans for MS in Germany under ₹40L"'
                className="input-field pl-10 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-secondary flex items-center gap-2 text-sm whitespace-nowrap"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Searching…' : searchTerm.trim() ? 'Search' : 'Refresh'}
            </button>
          </form>
        </div>
      )}

      {/* Profile Summary */}
      <div className="card" style={{ background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.15)' }}>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
          <div>
            <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>CGPA</div>
            <div className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{cgpaDisplay}/10</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Country</div>
            <div className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{targetCountry || 'Not set'}</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Budget</div>
            <div className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>₹{budgetLakhs}L</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Loan Needed</div>
            <div className="text-xl font-bold" style={{ color: 'var(--accent)' }}>₹{loanNeededLakhs}L</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Live Matches</div>
            <div className="text-xl font-bold" style={{ color: 'var(--success)' }}>
              {loading ? '…' : `${eligibleCount}/${total}`}
            </div>
          </div>
        </div>
      </div>

      {/* Loading state — skeleton cards while live data arrives */}
      {loading && (
        <div className="space-y-4">
          <div className="text-xs flex items-center gap-2" style={{ color: 'var(--foreground-muted)' }}>
            <Loader2 className="w-3 h-3 animate-spin" />
            Searching live loan products for your profile…
          </div>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Error state */}
      {!loading && err && (
        <div className="card text-center py-8">
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{err}</p>
          <button onClick={() => fetchOptions()} className="btn-primary mt-4 text-sm">Retry</button>
        </div>
      )}

      {/* Empty (no results found) state */}
      {!loading && !err && options && options.length === 0 && (
        <div className="card text-center py-8">
          <Search className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--foreground-muted)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>No live loan results yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
            Complete your target country and budget in your profile, then refresh.
          </p>
          <button onClick={() => fetchOptions()} className="btn-primary mt-4 text-sm">Search Again</button>
        </div>
      )}

      {/* Live results */}
      {!loading && options && options.length > 0 && (
        <div className="space-y-4">
          {options.map((nbfc, i) => {
            const eligible = nbfc.eligible !== false
            const isBest = i === 0 && eligible
            const initial = (nbfc.provider || nbfc.name || '?').charAt(0).toUpperCase()
            return (
              <motion.div
                key={`${nbfc.name}-${i}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="card relative overflow-hidden"
              >
                {isBest && (
                  <div
                    className="absolute top-0 right-0 px-3 py-1 text-[10px] font-bold rounded-bl-lg flex items-center gap-1"
                    style={{ background: 'var(--success)', color: 'white' }}
                  >
                    <Award className="w-3 h-3" /> BEST MATCH
                  </div>
                )}

                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Left: Identity */}
                  <div className="flex items-start gap-4 lg:w-72">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0"
                      style={{
                        background: 'rgba(99,102,241,0.1)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        color: 'var(--primary-light)',
                      }}
                    >
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{nbfc.name}</div>
                      <div className="text-xs flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
                        <Building2 className="w-3 h-3" />
                        {nbfc.provider}
                        {nbfc.providerType ? ` · ${nbfc.providerType}` : ''}
                      </div>
                      <div className="flex items-center gap-1 mt-1.5">
                        {eligible ? (
                          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--success)' }}>
                            <CheckCircle2 className="w-3 h-3" /> Eligible
                          </span>
                        ) : (
                          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                            <Star className="w-3 h-3" /> Worth checking
                          </span>
                        )}
                      </div>
                      {nbfc.summary && (
                        <p className="text-xs mt-1.5" style={{ color: 'var(--foreground-secondary)' }}>{nbfc.summary}</p>
                      )}
                    </div>
                  </div>

                  {/* Middle: Stats */}
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>Interest</div>
                      <div className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{nbfc.interestRate || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>Max Loan</div>
                      <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                        {nbfc.maxLoanINR ? formatINR(nbfc.maxLoanINR) : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>Tenure</div>
                      <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{nbfc.tenure || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>Collateral</div>
                      <div className="text-xs" style={{ color: 'var(--foreground-secondary)' }}>{nbfc.collateral || '—'}</div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:w-44 flex-shrink-0">
                    {nbfc.applyUrl && (
                      <a href={nbfc.applyUrl} target="_blank" rel="noopener noreferrer"
                        className="btn-primary text-sm flex items-center justify-center gap-2 py-2 flex-1">
                        Apply Now <ArrowRight className="w-4 h-4" />
                      </a>
                    )}
                    {nbfc.sourceUrl && nbfc.sourceUrl !== nbfc.applyUrl && (
                      <a href={nbfc.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="btn-secondary text-xs flex items-center justify-center gap-1 py-2 flex-1">
                        <Globe className="w-3 h-3" /> Source{nbfc.sourceName ? ` · ${nbfc.sourceName}` : ''}
                      </a>
                    )}
                  </div>
                </div>

                {/* Fit reason */}
                {nbfc.fitReason && (
                  <div className="mt-3 text-xs p-2.5 rounded-lg flex items-start gap-2"
                    style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                    <Star className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: 'var(--primary-light)' }} />
                    <span style={{ color: 'var(--foreground-secondary)' }}>
                      <strong style={{ color: 'var(--foreground)' }}>Why this fits you: </strong>{nbfc.fitReason}
                    </span>
                  </div>
                )}

                {/* Features */}
                {nbfc.features && nbfc.features.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {nbfc.features.map((f, idx) => (
                      <span key={idx} className="text-[10px] px-2 py-1 rounded-full"
                        style={{
                          background: 'var(--background-secondary)',
                          color: 'var(--foreground-secondary)',
                          border: '1px solid var(--border)',
                        }}>
                        ✓ {f}
                      </span>
                    ))}
                  </div>
                )}

                {/* Extra fee/moratorium row when present */}
                {(nbfc.processingFee || nbfc.moratorium) && (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    {nbfc.processingFee && (
                      <div>
                        <span style={{ color: 'var(--foreground-muted)' }}>Processing: </span>
                        <strong style={{ color: 'var(--foreground)' }}>{nbfc.processingFee}</strong>
                      </div>
                    )}
                    {nbfc.moratorium && (
                      <div>
                        <span style={{ color: 'var(--foreground-muted)' }}>Moratorium: </span>
                        <strong style={{ color: 'var(--foreground)' }}>{nbfc.moratorium}</strong>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}

          <p className="text-[11px] text-center pt-2" style={{ color: 'var(--foreground-muted)' }}>
            <Shield className="inline w-3 h-3 mr-1" />
            Live results powered by Google Search · Always verify rates and apply links on the official source.
          </p>
        </div>
      )}
    </div>
  )
}
