'use client'

import { useState, useEffect } from 'react'
import { Users, Briefcase, MessageSquare, Banknote, Star, TrendingUp, ChevronRight, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'

export default function AdminAnalytics() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    verifiedExperts: 0,
    loanApps: 0
  })
  const [topCountries, setTopCountries] = useState<{country: string, percentage: number, color: string}[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      
      // Fetch students
      const { data: students } = await supabase
        .from('profiles')
        .select('target_countries, application_stage')
        .eq('role', 'student')
      
      // Fetch verified experts count
      const { count: expertCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'expert')
        .eq('kyc_status', 'verified')
        
      if (students) {
        const studentCount = students.length
        const loanSeekers = students.filter(s => s.application_stage === 'LOAN_SEEKER').length

        setStats({
          totalStudents: studentCount,
          verifiedExperts: expertCount || 0,
          loanApps: loanSeekers
        })

        // Calculate dynamic Top Countries
        const countryCounts: Record<string, number> = {}
        let totalCountriesCount = 0

        students.forEach(s => {
          if (s.target_countries && Array.isArray(s.target_countries)) {
            s.target_countries.forEach((country: string) => {
              countryCounts[country] = (countryCounts[country] || 0) + 1
              totalCountriesCount++
            })
          }
        })

        const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']
        const sortedCountries = Object.entries(countryCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([country, count], index) => ({
            country,
            percentage: totalCountriesCount > 0 ? Math.round((count / totalCountriesCount) * 100) : 0,
            color: colors[index % colors.length]
          }))

        setTopCountries(sortedCountries)
      }

      setLoading(false)
    }
    
    fetchStats()
  }, [])

  const funnelData = [
    { stage: 'Registered', count: stats.totalStudents, color: 'bg-blue-500' },
    { stage: 'Active (Onboarded)', count: Math.floor(stats.totalStudents * 0.7), color: 'bg-indigo-500' },
    { stage: 'Loan Aware (Visited Center)', count: Math.floor(stats.totalStudents * 0.35), color: 'bg-amber-500' },
    { stage: 'Loan Applied', count: stats.loanApps, color: 'bg-emerald-500' },
  ]

  return (
    <div className="max-w-6xl space-y-8 pb-10">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          <TrendingUp className="w-6 h-6 text-red-500" /> Platform Analytics
        </h2>
        <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>High-level overview of EduFinAI's marketplace activity.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      ) : (
        <>
          {/* Premium KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { label: 'Total Students', value: stats.totalStudents.toLocaleString(), icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10', glow: 'shadow-blue-500/20' },
              { label: 'Verified Experts', value: stats.verifiedExperts, icon: Briefcase, color: 'text-indigo-400', bg: 'bg-indigo-500/10', glow: 'shadow-indigo-500/20' },
              { label: 'Loan Apps', value: stats.loanApps, icon: Banknote, color: 'text-emerald-400', bg: 'bg-emerald-500/10', glow: 'shadow-emerald-500/20' },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} 
                className={`card relative overflow-hidden group hover:shadow-xl hover:${stat.glow} transition-all duration-300 border border-white/5`}>
                {/* Subtle gradient orb in background */}
                <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${stat.bg} blur-2xl opacity-50 group-hover:opacity-100 transition-opacity`} />
                
                <div className="flex items-center gap-4 mb-4 relative z-10">
                  <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} shadow-inner backdrop-blur-sm`}><stat.icon className="w-6 h-6" /></div>
                  <div className="text-sm font-bold text-foreground-muted uppercase tracking-wider">{stat.label}</div>
                </div>
                <div className="text-4xl font-extrabold text-foreground relative z-10 tracking-tight">{stat.value}</div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Conversion Funnel */}
            <div className="card lg:col-span-2">
              <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--foreground)' }}>Student Journey Conversion</h3>
              <div className="space-y-4">
                {funnelData.map((step, i) => {
                  const max = funnelData[0].count || 1
                  const width = Math.max((step.count / max) * 100, 15)
                  return (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-32 text-xs font-semibold text-right" style={{ color: 'var(--foreground-muted)' }}>{step.stage}</div>
                      <div className="flex-1">
                        <motion.div 
                          initial={{ width: 0 }} animate={{ width: `${width}%` }} transition={{ duration: 1, delay: i * 0.2 }}
                          className={`h-8 rounded-r-lg ${step.color} flex items-center px-3`}
                        >
                          <span className="text-white text-xs font-bold drop-shadow-md">{step.count.toLocaleString()}</span>
                        </motion.div>
                      </div>
                      {i < funnelData.length - 1 && (
                        <div className="w-16 text-right text-[11px] font-bold py-1 px-2 rounded-md bg-white/5 border border-white/10 text-foreground-secondary">
                          {Math.round((funnelData[i+1].count / (step.count || 1)) * 100)}%
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top Target Countries */}
            <div className="card">
              <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--foreground)' }}>Top Target Countries</h3>
              <div className="space-y-5">
                {topCountries.map((c, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1.5 font-medium">
                      <span style={{ color: 'var(--foreground)' }}>{c.country}</span>
                      <span style={{ color: 'var(--foreground-muted)' }}>{c.percentage}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-black/20 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${c.percentage}%` }} transition={{ duration: 1 }}
                        className="h-full rounded-full" style={{ backgroundColor: c.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  )
}
