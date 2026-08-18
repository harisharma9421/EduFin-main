'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import {
  Calendar, CheckCircle, Circle, Loader2, Sparkles,
  ChevronDown, ChevronUp, BookOpen, Target, FileText,
  DollarSign, Shield, Plane, RefreshCw
} from 'lucide-react'

const TIMELINE_KEY = 'edufinai-timeline'

interface Milestone {
  id: string; title: string; description: string
  phase: string; weekNumber: number; completed: boolean
}

interface TimelineData {
  milestones: Milestone[]
  targetIntake: string
  generatedAt: string
}

const phaseConfig: Record<string, { icon: typeof BookOpen; color: string }> = {
  'Test Prep': { icon: BookOpen, color: '#6366f1' },
  'University Research': { icon: Target, color: '#06b6d4' },
  'Application Prep': { icon: FileText, color: '#ec4899' },
  'Applications': { icon: Target, color: '#f59e0b' },
  'Financial Planning': { icon: DollarSign, color: '#10b981' },
  'Visa & Pre-departure': { icon: Shield, color: '#8b5cf6' },
}

function loadTimeline(): TimelineData | null {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(TIMELINE_KEY) || 'null') } catch { return null }
}

export default function TimelinePage({ embedded = false }: { embedded?: boolean } = {}) {
  const { profile, addXP } = useAppStore()
  const [timeline, setTimeline] = useState<TimelineData | null>(loadTimeline)
  const [loading, setLoading] = useState(false)
  const [targetIntake, setTargetIntake] = useState('Sep 2026')
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null)

  const generateTimeline = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Generate a detailed week-by-week study abroad application timeline for me. My target intake is ${targetIntake}. Today is ${new Date().toLocaleDateString()}.

Return ONLY a JSON array of milestones with this exact format (no markdown, no explanation):
[{"id":"m1","title":"Start GRE Prep","description":"Begin with Quant section...","phase":"Test Prep","weekNumber":1},...]

Use these 6 phases in order: "Test Prep", "University Research", "Application Prep", "Applications", "Financial Planning", "Visa & Pre-departure".
Generate 15-20 milestones spread across all phases. Make descriptions specific and actionable (2-3 sentences each).`,
          profile: {
            name: profile.name, cgpa: profile.cgpa, greScore: profile.greScore,
            ieltsScore: profile.ieltsScore, targetCountry: profile.targetCountry,
            targetProgram: profile.targetProgram, budgetLakhs: profile.budgetLakhs,
            sopComplete: profile.sopComplete, workExpYears: profile.workExpYears,
          },
          conversationHistory: [],
        }),
      })

      if (!res.ok) throw new Error('Failed')
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')
      const decoder = new TextDecoder()
      let content = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
      }

      // Parse JSON from response
      let milestones: Milestone[] = []
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          milestones = JSON.parse(jsonMatch[0]).map((m: Milestone) => ({ ...m, completed: false }))
        }
      } catch {
        // Fallback milestones
        milestones = [
          { id: 'm1', title: 'Start Test Prep', description: 'Begin preparing for GRE/GMAT and IELTS/TOEFL.', phase: 'Test Prep', weekNumber: 1, completed: false },
          { id: 'm2', title: 'Take Practice Tests', description: 'Take 2 full-length practice tests to gauge baseline.', phase: 'Test Prep', weekNumber: 4, completed: false },
          { id: 'm3', title: 'Shortlist Universities', description: 'Research and shortlist 8-10 universities.', phase: 'University Research', weekNumber: 8, completed: false },
          { id: 'm4', title: 'Draft SOP', description: 'Write first draft of Statement of Purpose.', phase: 'Application Prep', weekNumber: 12, completed: false },
          { id: 'm5', title: 'Request LORs', description: 'Request Letters of Recommendation from professors.', phase: 'Application Prep', weekNumber: 14, completed: false },
          { id: 'm6', title: 'Submit Applications', description: 'Submit applications to all shortlisted universities.', phase: 'Applications', weekNumber: 20, completed: false },
          { id: 'm7', title: 'Apply for Loans', description: 'Start education loan application process.', phase: 'Financial Planning', weekNumber: 24, completed: false },
          { id: 'm8', title: 'Visa Application', description: 'Apply for student visa after receiving admits.', phase: 'Visa & Pre-departure', weekNumber: 30, completed: false },
        ]
      }

      const data: TimelineData = { milestones, targetIntake, generatedAt: new Date().toISOString() }
      localStorage.setItem(TIMELINE_KEY, JSON.stringify(data))
      setTimeline(data)
      addXP(30)
    } catch (e) {
      console.error('Timeline error:', e)
    }
    setLoading(false)
  }

  const toggleMilestone = (id: string) => {
    if (!timeline) return
    const updated = {
      ...timeline,
      milestones: timeline.milestones.map(m => m.id === id ? { ...m, completed: !m.completed } : m)
    }
    localStorage.setItem(TIMELINE_KEY, JSON.stringify(updated))
    setTimeline(updated)
  }

  const phases = timeline ? [...new Set(timeline.milestones.map(m => m.phase))] : []
  const progress = timeline ? Math.round((timeline.milestones.filter(m => m.completed).length / timeline.milestones.length) * 100) : 0

  return (
    <div className="max-w-5xl space-y-6">
      {!embedded && (
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <Calendar className="w-6 h-6" style={{ color: 'var(--primary)' }} />
            Application Timeline
          </h2>
          <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>
            AI-generated personalized week-by-week plan for your study abroad journey.
          </p>
        </div>
      )}

      {!timeline ? (
        <div className="card text-center py-12">
          <Calendar className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--primary)' }} />
          <div className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Generate Your Timeline</div>
          <p className="text-sm mb-4 max-w-md mx-auto" style={{ color: 'var(--foreground-secondary)' }}>
            AI will create a personalized plan based on your profile and target intake.
          </p>
          <div className="flex items-center justify-center gap-3 mb-6">
            <label className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>Target Intake:</label>
            <select className="input-field" style={{ width: 'auto' }} value={targetIntake} onChange={e => setTargetIntake(e.target.value)}>
              <option>Jan 2026</option><option>Sep 2026</option><option>Jan 2027</option><option>Sep 2027</option>
            </select>
          </div>
          <button onClick={generateTimeline} disabled={loading} className="btn-primary flex items-center gap-2 mx-auto">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Generating...' : 'Generate Timeline'}
          </button>
        </div>
      ) : (
        <>
          {/* Progress */}
          <div className="card card-gradient">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Overall Progress</span>
                <span className="text-xs ml-2" style={{ color: 'var(--foreground-muted)' }}>Target: {timeline.targetIntake}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold" style={{ color: progress === 100 ? 'var(--success)' : 'var(--primary-light)' }}>{progress}%</span>
                <button onClick={generateTimeline} className="btn-secondary text-xs flex items-center gap-1 py-1 px-2">
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </button>
              </div>
            </div>
            <div className="progress-bar" style={{ height: 8 }}>
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Phase Bars */}
          <div className="flex gap-1 overflow-x-auto pb-2">
            {phases.map(p => {
              const cfg = phaseConfig[p] || { icon: Calendar, color: '#6366f1' }
              const phaseMilestones = timeline.milestones.filter(m => m.phase === p)
              const phaseProgress = Math.round((phaseMilestones.filter(m => m.completed).length / phaseMilestones.length) * 100)
              return (
                <button key={p} onClick={() => setExpandedPhase(expandedPhase === p ? null : p)}
                  className="flex-1 min-w-[120px] p-2 rounded-lg text-center transition-all"
                  style={{ background: `${cfg.color}10`, border: `1px solid ${expandedPhase === p ? cfg.color : `${cfg.color}20`}` }}>
                  <div className="text-[10px] font-semibold" style={{ color: cfg.color }}>{p}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>{phaseProgress}%</div>
                </button>
              )
            })}
          </div>

          {/* Milestones */}
          <div className="space-y-3">
            {phases.map(phase => {
              const cfg = phaseConfig[phase] || { icon: Calendar, color: '#6366f1' }
              const Icon = cfg.icon
              const phaseMilestones = timeline.milestones.filter(m => m.phase === phase)
              const isOpen = expandedPhase === null || expandedPhase === phase

              return (
                <div key={phase}>
                  <button onClick={() => setExpandedPhase(expandedPhase === phase ? null : phase)}
                    className="w-full flex items-center gap-2 p-3 rounded-lg transition-all"
                    style={{ background: `${cfg.color}08`, border: `1px solid ${cfg.color}20` }}>
                    <Icon className="w-5 h-5" style={{ color: cfg.color }} />
                    <span className="text-sm font-semibold flex-1 text-left" style={{ color: cfg.color }}>{phase}</span>
                    <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      {phaseMilestones.filter(m => m.completed).length}/{phaseMilestones.length}
                    </span>
                    {isOpen ? <ChevronUp className="w-4 h-4" style={{ color: cfg.color }} /> : <ChevronDown className="w-4 h-4" style={{ color: cfg.color }} />}
                  </button>
                  {isOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-4 mt-2 space-y-2">
                      {phaseMilestones.map(m => (
                        <div key={m.id} className="card flex items-start gap-3" style={{ padding: '0.75rem 1rem',
                          borderColor: m.completed ? 'rgba(16,185,129,0.3)' : undefined,
                          background: m.completed ? 'rgba(16,185,129,0.03)' : undefined
                        }}>
                          <button onClick={() => toggleMilestone(m.id)} className="mt-0.5">
                            {m.completed ? <CheckCircle className="w-5 h-5" style={{ color: 'var(--success)' }} /> :
                              <Circle className="w-5 h-5" style={{ color: 'var(--foreground-muted)' }} />}
                          </button>
                          <div className="flex-1">
                            <div className={`text-sm font-medium ${m.completed ? 'line-through' : ''}`}
                              style={{ color: m.completed ? 'var(--foreground-muted)' : 'var(--foreground)' }}>
                              {m.title}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>{m.description}</div>
                            <span className="text-[10px] mt-1 inline-block px-2 py-0.5 rounded-full"
                              style={{ background: `${cfg.color}15`, color: cfg.color }}>
                              Week {m.weekNumber}
                            </span>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
