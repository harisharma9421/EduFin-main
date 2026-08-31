'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Banknote, Award, ExternalLink, Loader2, Search } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useJourneyStore } from '@/lib/journeyStore'

interface Option {
  name: string
  provider: string
  summary: string
  fitReason: string
  interestOrAmount: string
  tenureOrDeadline: string
  applyUrl: string
  sourceUrl: string
}

// Toggle between Loan options and Scholarships. Both pull live links from
// the Serper-grounded /api/ai-journey/loan-options route and pick the 3 best
// matches for the student's profile + selected university.
export default function LoanScholarship() {
  const { profile } = useAppStore()
  const [mode, setMode] = useState<'loan' | 'scholarship'>('loan')
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<Option[]>([])
  const [err, setErr] = useState('')

  const fetchOptions = useCallback(async (m: 'loan' | 'scholarship') => {
    setLoading(true); setErr(''); setOptions([])
    try {
      const decisionState = useJourneyStore.getState()
      const res = await fetch('/api/ai-journey/loan-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: m, profileData: profile, decisionState }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setOptions((json.options || []).slice(0, 3))
    } catch (e: any) {
      setErr(e?.message || 'Could not load options.')
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => { fetchOptions(mode) }, [mode, fetchOptions])

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
        <button
          onClick={() => setMode('loan')}
          className="px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-1.5"
          style={{
            background: mode === 'loan' ? 'var(--surface)' : 'transparent',
            color: mode === 'loan' ? 'var(--foreground)' : 'var(--foreground-muted)',
            boxShadow: mode === 'loan' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <Banknote className="w-4 h-4" /> Loans
        </button>
        <button
          onClick={() => setMode('scholarship')}
          className="px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-1.5"
          style={{
            background: mode === 'scholarship' ? 'var(--surface)' : 'transparent',
            color: mode === 'scholarship' ? 'var(--foreground)' : 'var(--foreground-muted)',
            boxShadow: mode === 'scholarship' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <Award className="w-4 h-4" /> Scholarships
        </button>
        <button
          onClick={() => fetchOptions(mode)}
          disabled={loading}
          title="Refresh"
          className="ml-2 px-3 py-2 text-sm rounded-md transition-all flex items-center gap-1.5"
          style={{ color: 'var(--foreground-muted)' }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="p-4 text-sm flex items-center gap-2" style={{ color: 'var(--foreground-secondary)' }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          Searching live {mode === 'loan' ? 'loan' : 'scholarship'} options for your profile...
        </div>
      )}

      {/* Error */}
      {err && !loading && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{err}</p>
      )}

      {/* Results */}
      <AnimatePresence>
        {!loading && options.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {options.map((o, i) => (
              <div key={i} className="p-4 rounded-xl flex flex-col gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{o.name}</h4>
                  <span className="badge badge-primary">{mode === 'loan' ? 'Loan' : 'Grant'}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{o.provider}</p>
                <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>{o.summary}</p>
                <div className="space-y-1 text-xs mt-1">
                  <div className="flex justify-between gap-2"><span style={{ color: 'var(--foreground-muted)' }}>{mode === 'loan' ? 'Interest' : 'Amount'}</span><b style={{ color: 'var(--foreground)' }}>{o.interestOrAmount}</b></div>
                  <div className="flex justify-between gap-2"><span style={{ color: 'var(--foreground-muted)' }}>{mode === 'loan' ? 'Tenure' : 'Deadline'}</span><b style={{ color: 'var(--foreground)' }}>{o.tenureOrDeadline}</b></div>
                </div>
                {o.fitReason && (
                  <p className="text-xs p-2 rounded-md" style={{ background: 'var(--background-secondary)', color: 'var(--foreground-secondary)' }}>
                    <span style={{ color: 'var(--success)' }}>✓ Fit: </span>{o.fitReason}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-auto pt-2">
                  {o.applyUrl && (
                    <a href={o.applyUrl} target="_blank" rel="noopener noreferrer"
                      className="btn-primary flex-1 text-xs flex items-center justify-center gap-1 py-2">
                      Apply Now <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {o.sourceUrl && o.sourceUrl !== o.applyUrl && (
                    <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-2 rounded-lg" style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
                      Source
                    </a>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
        Live results powered by Google Search · Always verify rates / deadlines on the official source.
      </p>
    </div>
  )
}
