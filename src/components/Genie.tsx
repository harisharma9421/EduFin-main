'use client'

// Genie — global floating AI assistant (chat-only, no navigation).
// ----------------------------------------------------------------------------
// Mounted once at the bottom-right of every page inside DashboardLayout.
// Every assistant reply may include:
//   • markdown text (bold/italic/links/lists)
//   • cards: kpis | table | bar | line | stacked (year EMI) | donut
//   • downloads: HTML reports (rendered as inline buttons; click → save .html
//     and also offer "Save as PDF" via window.print)
//   • web link cards from Serper-backed search
// We never navigate the user away.

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Send,
  Trash2,
  Loader2,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Download,
  FileText,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
} from 'recharts'
import { useAppStore } from '@/lib/store'

// ── Card / download types (must match the API schema) ──────────────────────
type CardKind = 'kpis' | 'table' | 'bar' | 'line' | 'stacked' | 'donut'

interface GenieCard {
  type: CardKind
  title?: string
  explanation?: string
  data?: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' | 'default' }[]
  headers?: string[]
  rows?: string[][]
  series?: { name?: string; value?: number; x?: string; y?: number }[]
  slices?: { name: string; value: number }[]
  breakdown?: { x: string; principal: number; interest: number }[]
}

interface GenieDownload {
  label: string
  html: string
}

interface GenieMsg {
  role: 'user' | 'assistant'
  content: string
  cards?: GenieCard[]
  downloads?: GenieDownload[]
  web?: { title: string; link: string; snippet: string }[]
  ts: number
}

interface GenieResponse {
  reply: string
  cards?: GenieCard[]
  downloads?: GenieDownload[]
  web?: { title: string; link: string; snippet: string }[]
  error?: string
}

const STORAGE_KEY = 'gradpilot.genie.chat.v2'

export default function Genie() {
  const { profile, currentPage } = useAppStore()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<GenieMsg[]>([])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const profileSnapshotRef = useRef<any>(null)

  // Hydrate chat history.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setMessages(parsed)
      }
    } catch {}
  }, [])

  // Persist (cap at 40 messages).
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)))
    } catch {}
  }, [messages])

  // Snapshot profile on first open so subsequent profile edits don't leak.
  useEffect(() => {
    if (open && !profileSnapshotRef.current) {
      profileSnapshotRef.current = profile
    }
  }, [open, profile])

  // Auto-scroll to latest bubble.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading, open])

  const refreshProfile = () => {
    profileSnapshotRef.current = profile
  }

  const clearChat = () => {
    setMessages([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const next: GenieMsg = { role: 'user', content: text, ts: Date.now() }
    setMessages((prev) => [...prev, next])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/genie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          profile: profileSnapshotRef.current || profile,
          history: messages.slice(-12),
          currentPage,
        }),
      })
      const j = (await res.json()) as GenieResponse
      const reply = j?.reply || "I couldn't answer that. Try again?"
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: reply,
          cards: Array.isArray(j?.cards) ? j.cards : [],
          downloads: Array.isArray(j?.downloads) ? j.downloads : [],
          web: Array.isArray(j?.web) ? j.web : [],
          ts: Date.now(),
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Network error talking to me. Try once more.', ts: Date.now() },
      ])
    } finally {
      setLoading(false)
    }
  }

  const greeting = useMemo(() => {
    const name = (profile?.name || '').split(' ')[0] || 'there'
    return `Hi ${name}! I'm **Genie** — your study-abroad assistant. Ask me anything: shortlist colleges, run your AI journey, calculate ROI, find scholarships, compare loans. I'll keep all the answers, charts, and downloadable reports right here in the chat.`
  }, [profile?.name])

  const quickPrompts = [
    'Run my AI journey end-to-end',
    'Match me with US universities',
    'Find scholarships for my profile',
    'Calculate my ROI for MIT MS CS',
    'Show me current education loan rates for India → Canada',
    'Generate a downloadable EMI report',
  ]

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={open ? 'Close Genie' : 'Open Genie'}
        className="fixed z-[180] bottom-5 right-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
        style={{
          background: 'var(--gradient-primary)',
          boxShadow: '0 8px 30px rgba(99,102,241,0.45), 0 4px 12px rgba(0,0,0,0.25)',
        }}
      >
        {open ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <img
            src="/genie-logo.png"
            alt="Genie"
            className="w-9 h-9 rounded-full object-cover"
            style={{ background: '#fff' }}
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="fixed z-[181] bottom-24 right-5 flex flex-col"
            style={{
              width: 'min(96vw, 460px)',
              height: 'min(80vh, 720px)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 18,
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
            }}
          >
            {/* Header */}
            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{
                borderBottom: '1px solid var(--border)',
                background:
                  'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(6,182,212,0.08))',
              }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden"
                style={{ background: '#fff' }}
              >
                <img src="/genie-logo.png" alt="Genie" className="w-9 h-9 object-cover" />
              </div>
              <div className="min-w-0">
                <div
                  className="text-sm font-bold flex items-center gap-1.5"
                  style={{ color: 'var(--foreground)' }}
                >
                  Genie
                  <Sparkles className="w-3 h-3" style={{ color: 'var(--accent)' }} />
                </div>
                <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
                  Your study-abroad assistant — answers stay in chat
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={refreshProfile}
                  title="Refresh profile snapshot"
                  className="w-8 h-8 rounded-md flex items-center justify-center"
                  style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}
                >
                  <RefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--foreground-secondary)' }} />
                </button>
                <button
                  onClick={clearChat}
                  title="Clear chat"
                  className="w-8 h-8 rounded-md flex items-center justify-center"
                  style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--danger)' }} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  title="Close"
                  className="w-8 h-8 rounded-md flex items-center justify-center"
                  style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}
                >
                  <X className="w-3.5 h-3.5" style={{ color: 'var(--foreground-secondary)' }} />
                </button>
              </div>
            </div>

            {/* Profile snapshot prompt (one-tap) */}
            {!profileSnapshotRef.current && (
              <div
                className="mx-4 mt-3 p-2.5 rounded-md flex items-center justify-between gap-2 text-xs"
                style={{
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  color: 'var(--foreground-secondary)',
                }}
              >
                <span>
                  Tap{' '}
                  <strong style={{ color: 'var(--primary-light)' }}>Use my profile</strong>{' '}
                  so I can tailor every answer to your scores, target country, and budget.
                </span>
                <button
                  onClick={refreshProfile}
                  className="btn-primary text-[11px] whitespace-nowrap"
                  style={{ padding: '4px 10px' }}
                >
                  Use my profile
                </button>
              </div>
            )}

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <>
                  <Bubble role="assistant" content={greeting} />
                  <div className="flex flex-wrap gap-1.5 ml-9">
                    {quickPrompts.map((q) => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="text-[11px] px-2.5 py-1.5 rounded-full"
                        style={{
                          background: 'var(--background-secondary)',
                          border: '1px solid var(--border)',
                          color: 'var(--foreground-secondary)',
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {messages.map((m, i) => (
                <div key={`${m.ts}-${i}`}>
                  <Bubble role={m.role} content={m.content} />

                  {m.role === 'assistant' && m.cards && m.cards.some(cardHasPayload) && (
                    <div className="mt-2 ml-9 space-y-3">
                      {m.cards.filter(cardHasPayload).map((c, j) => (
                        <CardRender key={j} card={c} />
                      ))}
                    </div>
                  )}

                  {m.role === 'assistant' && m.downloads && m.downloads.length > 0 && (
                    <div className="mt-2 ml-9 space-y-2">
                      <div
                        className="text-[10px] uppercase tracking-widest font-bold mb-0.5"
                        style={{ color: 'var(--foreground-muted)' }}
                      >
                        Saveable reports
                      </div>
                      {m.downloads.map((d, j) => (
                        <DownloadRow key={j} item={d} />
                      ))}
                    </div>
                  )}

                  {m.role === 'assistant' && m.web && m.web.length > 0 && (
                    <div className="mt-2 ml-9 space-y-1.5">
                      {m.web.slice(0, 6).map((w, j) => (
                        <a
                          key={`${w.link}-${j}`}
                          href={w.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-2 rounded-md"
                          style={{
                            background: 'var(--background-secondary)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <div
                            className="text-[12px] font-semibold flex items-center gap-1"
                            style={{ color: 'var(--foreground)' }}
                          >
                            {w.title}
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </div>
                          <div
                            className="text-[10px] truncate"
                            style={{ color: 'var(--foreground-muted)' }}
                          >
                            {hostOf(w.link)}
                          </div>
                          {w.snippet && (
                            <div
                              className="text-[11px] mt-0.5 leading-snug"
                              style={{ color: 'var(--foreground-secondary)' }}
                            >
                              {w.snippet}
                            </div>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div
                  className="flex items-center gap-2 ml-1"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-xs">Genie is thinking…</span>
                </div>
              )}
            </div>

            {/* Composer */}
            <div
              className="px-3 py-3 flex items-center gap-2"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Ask Genie anything…"
                disabled={loading}
                className="input-field flex-1 text-sm"
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="btn-primary text-sm disabled:opacity-50"
                style={{ padding: '0.55rem 0.85rem' }}
                title="Send"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ── Bubble + tiny markdown renderer ─────────────────────────────────────────
function Bubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user'
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{ background: '#fff' }}
        >
          <img src="/genie-logo.png" alt="" className="w-7 h-7 object-cover" />
        </div>
      )}
      <div
        className="text-sm leading-relaxed rounded-2xl px-3 py-2"
        style={{
          background: isUser ? 'var(--primary-light)' : 'var(--background-secondary)',
          color: isUser ? '#fff' : 'var(--foreground)',
          maxWidth: '85%',
          border: isUser ? 'none' : '1px solid var(--border)',
        }}
      >
        <Markdown text={content} />
      </div>
    </div>
  )
}

// ── Card rendering ──────────────────────────────────────────────────────────
function CardRender({ card }: { card: GenieCard }) {
  // Belt-and-braces: if the model emits a card with no usable payload we
  // refuse to render an empty panel.
  if (!cardHasPayload(card)) return null

  const wrap: React.CSSProperties = {
    background: 'var(--background-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 12,
  }
  const titleEl = card.title ? (
    <div className="text-xs font-bold mb-1" style={{ color: 'var(--foreground)' }}>
      {card.title}
    </div>
  ) : null
  const expEl = card.explanation ? (
    <div
      className="text-[11px] mb-2 leading-snug"
      style={{ color: 'var(--foreground-muted)' }}
    >
      {card.explanation}
    </div>
  ) : null

  if (card.type === 'kpis') {
    const items = card.data || []
    return (
      <div style={wrap}>
        {titleEl}
        {expEl}
        <div className="grid grid-cols-2 gap-2">
          {items.map((it, i) => (
            <div
              key={i}
              className="p-2 rounded-md"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div
                className="text-[10px] uppercase tracking-wider"
                style={{ color: 'var(--foreground-muted)' }}
              >
                {it.label}
              </div>
              <div
                className="text-sm font-bold"
                style={{
                  color:
                    it.tone === 'good'
                      ? 'var(--success)'
                      : it.tone === 'warn'
                      ? 'var(--warning)'
                      : it.tone === 'bad'
                      ? 'var(--danger)'
                      : 'var(--foreground)',
                }}
              >
                {it.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (card.type === 'table') {
    return (
      <div style={wrap}>
        {titleEl}
        {expEl}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: 'var(--foreground-muted)' }}>
                {(card.headers || []).map((h, i) => (
                  <th key={i} className="text-left py-1 pr-2 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(card.rows || []).map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  {r.map((c, j) => (
                    <td key={j} className="py-1.5 pr-2 align-top" style={{ color: 'var(--foreground)' }}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (card.type === 'bar') {
    const data = (card.series || []).map((s) => ({
      name: s.name || '',
      value: Number(s.value) || 0,
    }))
    return (
      <div style={wrap}>
        {titleEl}
        {expEl}
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fill: 'var(--foreground-muted)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'var(--foreground-muted)', fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (card.type === 'line') {
    const data = (card.series || []).map((s) => ({
      x: s.x || s.name || '',
      y: Number(s.y ?? s.value) || 0,
    }))
    return (
      <div style={wrap}>
        {titleEl}
        {expEl}
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="x" tick={{ fill: 'var(--foreground-muted)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'var(--foreground-muted)', fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line type="monotone" dataKey="y" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (card.type === 'stacked') {
    const data = (card.breakdown || []).map((b) => ({
      x: b.x,
      principal: Number(b.principal) || 0,
      interest: Number(b.interest) || 0,
    }))
    return (
      <div style={wrap}>
        {titleEl}
        {expEl}
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="x" tick={{ fill: 'var(--foreground-muted)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'var(--foreground-muted)', fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="principal" stackId="a" fill="#6366f1" name="Principal" />
            <Bar dataKey="interest" stackId="a" fill="#ef4444" name="Interest" />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex gap-3 text-[10px] mt-1" style={{ color: 'var(--foreground-muted)' }}>
          <span>
            <span
              className="inline-block w-2 h-2 rounded-sm mr-1 align-middle"
              style={{ background: '#6366f1' }}
            />
            Principal
          </span>
          <span>
            <span
              className="inline-block w-2 h-2 rounded-sm mr-1 align-middle"
              style={{ background: '#ef4444' }}
            />
            Interest
          </span>
        </div>
      </div>
    )
  }

  if (card.type === 'donut') {
    const data = (card.slices || []).map((s) => ({
      name: s.name,
      value: Number(s.value) || 0,
    }))
    const colors = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#06b6d4']
    return (
      <div style={wrap}>
        {titleEl}
        {expEl}
        <div className="flex items-center gap-2">
          <ResponsiveContainer width="50%" height={150}>
            <PieChart>
              <Pie data={data} innerRadius={36} outerRadius={60} paddingAngle={2} dataKey="value">
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-[11px] space-y-1">
            {data.map((d, i) => (
              <div key={i} style={{ color: 'var(--foreground-secondary)' }}>
                <span
                  className="inline-block w-2 h-2 rounded-sm mr-1 align-middle"
                  style={{ background: colors[i % colors.length] }}
                />
                {d.name}: <strong style={{ color: 'var(--foreground)' }}>{d.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ── Inline download row (HTML save + Print-as-PDF) ──────────────────────────
function DownloadRow({ item }: { item: GenieDownload }) {
  const saveHTML = () => {
    const blob = new Blob([item.html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `genie-${slug(item.label)}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  const printPDF = () => {
    const win = window.open('', '_blank')
    if (!win) {
      alert('Allow pop-ups to print this report as PDF.')
      return
    }
    win.document.write(item.html)
    win.document.close()
    setTimeout(() => win.print(), 350)
  }
  return (
    <div
      className="p-2.5 rounded-md flex items-center justify-between gap-2"
      style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}
    >
      <div className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
        {item.label}
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={saveHTML}
          className="btn-secondary text-[11px] flex items-center gap-1"
          style={{ padding: '4px 8px' }}
        >
          <Download className="w-3 h-3" /> HTML
        </button>
        <button
          onClick={printPDF}
          className="btn-primary text-[11px] flex items-center gap-1"
          style={{ padding: '4px 8px' }}
        >
          <FileText className="w-3 h-3" /> PDF
        </button>
      </div>
    </div>
  )
}

// ── Markdown ────────────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function inlineMd(s: string): string {
  let out = escapeHtml(s)
  out = out.replace(
    /\[([^\]]+)\]\((https?:[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--primary-light); text-decoration: underline;">$1</a>',
  )
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|\W)\*([^*]+)\*(?=\W|$)/g, '$1<em>$2</em>')
  out = out.replace(
    /`([^`]+)`/g,
    '<code style="background: rgba(0,0,0,0.18); padding: 1px 4px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 0.85em;">$1</code>',
  )
  return out
}
function Markdown({ text }: { text: string }) {
  const lines = (text || '').split('\n')
  const blocks: { type: 'p' | 'ul' | 'ol' | 'h'; level?: number; items?: string[]; content?: string }[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      blocks.push({ type: 'h', level: heading[1].length, content: heading[2] })
      i++
      continue
    }
    if (line.match(/^\s*[-*]\s+/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^\s*[-*]\s+/)) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }
    if (line.match(/^\s*\d+\.\s+/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^\s*\d+\.\s+/)) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    const buf: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^\s*[-*]\s+/) &&
      !lines[i].match(/^\s*\d+\.\s+/) &&
      !lines[i].match(/^#{1,3}\s+/)
    ) {
      buf.push(lines[i])
      i++
    }
    blocks.push({ type: 'p', content: buf.join(' ') })
  }
  return (
    <div className="space-y-1.5">
      {blocks.map((b, idx) => {
        if (b.type === 'h') {
          const Tag = (`h${b.level || 3}`) as 'h1' | 'h2' | 'h3'
          return (
            <Tag
              key={idx}
              className="font-bold mt-1"
              dangerouslySetInnerHTML={{ __html: inlineMd(b.content || '') }}
            />
          )
        }
        if (b.type === 'ul') {
          return (
            <ul key={idx} className="list-disc pl-5 space-y-0.5">
              {(b.items || []).map((it, j) => (
                <li key={j} dangerouslySetInnerHTML={{ __html: inlineMd(it) }} />
              ))}
            </ul>
          )
        }
        if (b.type === 'ol') {
          return (
            <ol key={idx} className="list-decimal pl-5 space-y-0.5">
              {(b.items || []).map((it, j) => (
                <li key={j} dangerouslySetInnerHTML={{ __html: inlineMd(it) }} />
              ))}
            </ol>
          )
        }
        return <p key={idx} dangerouslySetInnerHTML={{ __html: inlineMd(b.content || '') }} />
      })}
    </div>
  )
}

function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return u
  }
}
function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function cardHasPayload(c: GenieCard): boolean {
  if (!c || !c.type) return false
  switch (c.type) {
    case 'kpis':
      return Array.isArray(c.data) && c.data.length >= 2
    case 'table':
      return (
        Array.isArray(c.headers) &&
        c.headers.length >= 2 &&
        Array.isArray(c.rows) &&
        c.rows.length >= 1
      )
    case 'bar':
    case 'line':
      return Array.isArray(c.series) && c.series.length >= 3
    case 'stacked':
      return Array.isArray(c.breakdown) && c.breakdown.length >= 3
    case 'donut':
      return Array.isArray(c.slices) && c.slices.length >= 2
    default:
      return false
  }
}
