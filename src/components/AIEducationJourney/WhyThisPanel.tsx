'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, X, Loader2 } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, Tooltip, CartesianGrid } from 'recharts'
import { useAppStore } from '@/lib/store'
import { useJourneyStore } from '@/lib/journeyStore'

interface ExplainResult {
  summary: string
  points: string[]
  factors: { name: string; weight: number; impact: string }[]
}

// Render markdown-style **bold** within an otherwise plain string.
function Bold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} style={{ color: 'var(--foreground)' }}>{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  )
}

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']

export default function WhyThisPanel({ phase, phaseResult }: { phase: string; phaseResult: any }) {
  const { profile } = useAppStore()
  const decisionState = useJourneyStore.getState()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ExplainResult | null>(null)
  const [err, setErr] = useState('')

  const handleOpen = async () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (data) return
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/ai-journey/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase, profileData: profile, decisionState, phaseResult }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json.data)
    } catch (e: any) {
      setErr(e?.message || 'Could not load explanation.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={handleOpen}
        className="text-xs font-semibold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all"
        style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)', color: 'var(--foreground-secondary)' }}
      >
        {open ? <X className="w-3.5 h-3.5" /> : <HelpCircle className="w-3.5 h-3.5" />}
        {open ? 'Hide explanation' : 'Why this?'}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-lg" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
              {loading && (
                <p className="text-sm flex items-center gap-2" style={{ color: 'var(--foreground-secondary)' }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> AI is reading your profile...
                </p>
              )}
              {err && <p className="text-sm" style={{ color: 'var(--danger)' }}>{err}</p>}
              {data && (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground-secondary)' }}>
                    <Bold text={data.summary} />
                  </p>
                  {!!data.points?.length && (
                    <ul className="space-y-1.5">
                      {data.points.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                          <span className="mt-[7px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--primary)' }} />
                          <span><Bold text={p} /></span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!!data.factors?.length && (
                    <div className="rounded-lg p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--foreground-muted)' }}>Factor weights</p>
                      <ResponsiveContainer width="100%" height={Math.max(140, data.factors.length * 30)}>
                        <BarChart data={data.factors} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <CartesianGrid horizontal={false} stroke="var(--border)" />
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--foreground-secondary)', fontSize: 11 }} />
                          <YAxis type="category" dataKey="name" tick={{ fill: 'var(--foreground-secondary)', fontSize: 11 }} width={110} />
                          <Tooltip
                            cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--foreground)' }}
                            formatter={(v: any, _n: any, ctx: any) => [`${v} · ${ctx.payload.impact}`, ctx.payload.name]}
                          />
                          <Bar dataKey="weight" radius={[0, 4, 4, 0]} barSize={16}>
                            {data.factors.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
