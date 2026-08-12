'use client'

import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { universities } from '@/lib/mock-data'
import { getAdmissionProbability } from '@/lib/utils'
import { Target, Search, Filter } from 'lucide-react'
import { useState, useMemo } from 'react'

export default function AdmissionPredictor({ embedded = false }: { embedded?: boolean } = {}) {
  const { profile } = useAppStore()
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('all')

  const results = useMemo(() => {
    return universities
      .filter(u => {
        if (countryFilter !== 'all' && u.country !== countryFilter) return false
        if (search && !u.name.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .map(u => ({
        ...u,
        admission: getAdmissionProbability(profile.cgpa, profile.greScore, u.ranking)
      }))
      .sort((a, b) => b.admission.probability - a.admission.probability)
  }, [profile.cgpa, profile.greScore, search, countryFilter])

  const reach = results.filter(r => r.admission.category === 'reach')
  const match = results.filter(r => r.admission.category === 'match')
  const safety = results.filter(r => r.admission.category === 'safety')

  const countries = [...new Set(universities.map(u => u.country))]

  return (
    <div className="max-w-6xl space-y-6">
      {!embedded && (
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6" style={{ color: 'var(--accent)' }} />
            Admission Probability Predictor
          </h2>
          <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>
            Your profile: CGPA {profile.cgpa}/10, GRE {profile.greScore || 'N/A'}. See where you stand at each university.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--foreground-muted)' }} />
          <input className="input-field pl-10" placeholder="Search universities..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{ color: 'var(--foreground-muted)' }} />
          <select className="input-field" style={{ width: 'auto' }} value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}>
            <option value="all">All Countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card text-center">
          <div className="text-2xl font-bold" style={{ color: '#ef4444' }}>{reach.length}</div>
          <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Reach</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{match.length}</div>
          <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Match</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold" style={{ color: '#10b981' }}>{safety.length}</div>
          <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Safety</div>
        </div>
      </div>

      {/* University List */}
      <div className="space-y-3">
        {results.map((u, i) => (
          <motion.div key={u.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="card glass glass-hover flex flex-col sm:flex-row sm:items-center gap-4" style={{ padding: '1rem 1.25rem' }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-white">{u.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--primary-light)' }}>#{u.ranking}</span>
              </div>
              <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                {u.city}, {u.country} • {u.program} • ${u.tuitionUSD.toLocaleString()}/yr
              </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <div className="text-lg font-bold" style={{
                  color: u.admission.category === 'safety' ? '#10b981' : u.admission.category === 'match' ? '#f59e0b' : '#ef4444'
                }}>{u.admission.probability}%</div>
                <span className={`tag-${u.admission.category}`}>{u.admission.category}</span>
              </div>
              <div className="w-24">
                <div className="progress-bar">
                  <div className="h-full rounded-full transition-all duration-700" style={{
                    width: `${u.admission.probability}%`,
                    background: u.admission.category === 'safety' ? '#10b981' : u.admission.category === 'match' ? '#f59e0b' : '#ef4444'
                  }} />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
