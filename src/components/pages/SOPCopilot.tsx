'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { BookOpen, Sparkles, Download, RefreshCw, Star, Loader2 } from 'lucide-react'

const modes = [
  { id: 'professional', label: 'Professional', desc: 'Formal, structured, achievement-focused' },
  { id: 'storytelling', label: 'Storytelling', desc: 'Narrative-driven, personal, engaging' },
  { id: 'technical', label: 'Technical', desc: 'Research-focused, methodology-driven' },
]

export default function SOPCopilot() {
  const { profile, addXP, addBadge } = useAppStore()
  const [mode, setMode] = useState('professional')
  const [bulletPoints, setBulletPoints] = useState('')
  const [sopDraft, setSopDraft] = useState('')
  const [scores, setScores] = useState<{ name: string; score: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  const generateSOP = async () => {
    if (!bulletPoints.trim()) return
    setLoading(true)

    try {
      const res = await fetch('/api/sop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulletPoints,
          mode,
          profile: {
            name: profile.name,
            currentDegree: profile.currentDegree,
            currentUniversity: profile.currentUniversity,
            cgpa: profile.cgpa,
            greScore: profile.greScore,
            workExpYears: profile.workExpYears,
            targetProgram: profile.targetProgram,
            careerInterest: profile.careerInterest,
          },
        }),
      })

      if (!res.ok) throw new Error('API error')

      const data = await res.json()
      setSopDraft(data.sop)
      setScores([
        { name: 'Clarity', score: data.scores.clarity },
        { name: 'Motivation', score: data.scores.motivation },
        { name: 'University Fit', score: data.scores.universityFit },
        { name: 'Originality', score: data.scores.originality },
        { name: 'Grammar', score: data.scores.grammar },
      ])
      setGenerated(true)
      addXP(50)
      addBadge('First SOP Draft')
    } catch (error) {
      console.error('SOP error:', error)
      setSopDraft('Failed to generate SOP. Please check your API key and try again.')
      setGenerated(true)
    }
    setLoading(false)
  }

  const downloadSOP = () => {
    const blob = new Blob([sopDraft], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SOP_${profile.name?.replace(/\s+/g, '_') || 'draft'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          <BookOpen className="w-6 h-6" style={{ color: 'var(--accent)' }} />
          SOP Co-Pilot
        </h2>
        <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>
          AI writes your Statement of Purpose using advanced language models. Real AI, not templates.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <div className="space-y-4">
          <div className="card">
            <div className="text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>Writing Mode</div>
            <div className="grid grid-cols-3 gap-2">
              {modes.map(m => (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className="p-3 rounded-xl text-left transition-all"
                  style={{
                    background: mode === m.id ? 'rgba(99,102,241,0.15)' : 'var(--background)',
                    border: `1px solid ${mode === m.id ? 'var(--primary)' : 'var(--border)'}`,
                  }}>
                  <div className="text-xs font-semibold" style={{ color: mode === m.id ? 'var(--primary-light)' : 'var(--foreground)' }}>{m.label}</div>
                  <div className="text-[10px] mt-1" style={{ color: 'var(--foreground-muted)' }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Your Key Points</div>
            <p className="text-xs mb-3" style={{ color: 'var(--foreground-muted)' }}>
              Enter your achievements, experiences, and goals — one per line.
            </p>
            <textarea className="input-field" rows={8} placeholder={
              "e.g.\nLed a team of 5 in building an ML-based fraud detection system\nPublished paper on NLP at IEEE conference\nInternship at Google India — worked on search quality\nPassionate about AI applications in healthcare\nWant to specialize in NLP and conversational AI"
            } value={bulletPoints} onChange={e => setBulletPoints(e.target.value)} />
          </div>

          <button onClick={generateSOP} disabled={loading || !bulletPoints.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating with AI...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate SOP Draft</>
            )}
          </button>
        </div>

        {/* Output */}
        <div className="space-y-4">
          {generated ? (
            <>
              {scores.length > 0 && (
                <div className="card card-gradient">
                  <div className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                    <Star className="w-4 h-4" style={{ color: 'var(--accent)' }} /> AI Quality Score
                  </div>
                  <div className="space-y-2">
                    {scores.map(s => (
                      <div key={s.name} className="flex items-center gap-3">
                        <span className="text-xs w-24" style={{ color: 'var(--foreground-secondary)' }}>{s.name}</span>
                        <div className="flex-1 progress-bar">
                          <div className="h-full rounded-full transition-all duration-1000" style={{
                            width: `${s.score}%`,
                            background: s.score >= 80 ? '#10b981' : s.score >= 60 ? '#f59e0b' : '#ef4444'
                          }} />
                        </div>
                        <span className="text-xs font-bold w-8 text-right" style={{
                          color: s.score >= 80 ? '#10b981' : s.score >= 60 ? '#f59e0b' : '#ef4444'
                        }}>{s.score}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-center">
                    <span className="text-2xl font-bold" style={{
                      background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                    }}>{Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length)}/100</span>
                  </div>
                </div>
              )}

              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Generated Draft</span>
                  <div className="flex gap-2">
                    <button onClick={generateSOP} className="btn-secondary text-xs flex items-center gap-1 py-1 px-2">
                      <RefreshCw className="w-3 h-3" /> Refine
                    </button>
                    <button onClick={downloadSOP} className="btn-secondary text-xs flex items-center gap-1 py-1 px-2">
                      <Download className="w-3 h-3" /> Export
                    </button>
                  </div>
                </div>
                <div className="text-sm whitespace-pre-line leading-relaxed p-4 rounded-lg max-h-80 overflow-y-auto"
                  style={{ background: 'var(--background)', color: 'var(--foreground-secondary)' }}>
                  {sopDraft}
                </div>
              </div>
            </>
          ) : (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="w-12 h-12 mb-4" style={{ color: 'var(--foreground-muted)' }} />
              <div className="text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
                Enter your bullet points and click Generate to see your AI-crafted SOP
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
