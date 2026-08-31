'use client'

import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { successStories } from '@/lib/mock-data'
import { formatINR } from '@/lib/utils'
import { Users, ArrowRight, TrendingUp, GraduationCap, DollarSign, Building } from 'lucide-react'

export default function CloneJourney() {
  const { profile } = useAppStore()

  // Find similar students
  const similarities = successStories.map(s => {
    let score = 0
    score += Math.max(0, 100 - Math.abs(s.cgpa - profile.cgpa) * 30)
    score += Math.max(0, 100 - Math.abs(s.greScore - profile.greScore) * 0.5)
    score += Math.max(0, 100 - Math.abs(s.workExp - profile.workExpYears) * 20)
    if (profile.targetCountry.includes(s.targetCountry)) score += 50
    return { ...s, similarity: Math.min(99, Math.round(score / 3.5)) }
  }).sort((a, b) => b.similarity - a.similarity)

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="w-6 h-6" style={{ color: 'var(--info)' }} />
          Clone My Journey
        </h2>
        <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>
          Find students with YOUR profile who got in. See their exact path — universities, loans, salaries.
        </p>
      </div>

      {/* Your Profile Summary */}
      <div className="card" style={{ background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.15)' }}>
        <div className="text-xs mb-2" style={{ color: 'var(--foreground-muted)' }}>YOUR PROFILE</div>
        <div className="flex flex-wrap gap-3">
          <span className="badge badge-primary">CGPA: {profile.cgpa}</span>
          <span className="badge badge-primary">GRE: {profile.greScore || 'N/A'}</span>
          <span className="badge badge-primary">{profile.workExpYears}yr exp</span>
          <span className="badge badge-primary">{profile.targetCountry.join(', ') || 'Any country'}</span>
        </div>
      </div>

      {/* Success Stories */}
      <div className="space-y-4">
        {similarities.slice(0, 6).map((story, i) => (
          <motion.div key={story.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="card glass glass-hover">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Avatar + Similarity */}
              <div className="flex items-center gap-4 md:w-48">
                <div className="text-4xl">{story.avatar}</div>
                <div>
                  <div className="text-sm font-semibold text-white">{story.anonymizedName}</div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{story.backgroundUniversity}</div>
                  <div className="mt-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: story.similarity >= 80 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        color: story.similarity >= 80 ? '#10b981' : '#f59e0b'
                      }}>
                      {story.similarity}% similar
                    </span>
                  </div>
                </div>
              </div>

              {/* Journey Path */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--foreground-secondary)' }}>
                    <GraduationCap className="w-3 h-3" /> CGPA: {story.cgpa}
                  </div>
                  <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--foreground-secondary)' }}>
                    GRE: {story.greScore}
                  </div>
                  <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--foreground-secondary)' }}>
                    {story.workExp}yr exp
                  </div>
                </div>

                {/* Journey visualization */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="px-3 py-2 rounded-lg text-xs text-center" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                    <div style={{ color: 'var(--foreground-muted)' }}>From</div>
                    <div className="font-semibold text-white">{story.backgroundUniversity}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                  <div className="px-3 py-2 rounded-lg text-xs text-center" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <div style={{ color: 'var(--foreground-muted)' }}>Admitted to</div>
                    <div className="font-semibold" style={{ color: 'var(--primary-light)' }}>{story.targetUniversity}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--success)' }} />
                  <div className="px-3 py-2 rounded-lg text-xs text-center" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <div style={{ color: 'var(--foreground-muted)' }}>Now earning</div>
                    <div className="font-semibold" style={{ color: 'var(--success)' }}>${story.currentSalaryUSD.toLocaleString()}/yr</div>
                  </div>
                </div>
              </div>

              {/* Loan Info */}
              <div className="md:w-40 text-right">
                <div className="flex items-center gap-1 justify-end text-xs mb-1" style={{ color: 'var(--foreground-muted)' }}>
                  <DollarSign className="w-3 h-3" /> Loan
                </div>
                <div className="text-sm font-bold text-white">{formatINR(story.loanAmount)}</div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>via {story.nbfc}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>Class of {story.yearOfAdmission}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
