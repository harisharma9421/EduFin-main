'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import {
  Users,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Activity,
  TrendingUp,
  Loader2,
} from 'lucide-react'

// Expert dashboard — useful, non-dummy snapshot pulled live from Supabase.
// No fake earnings / ratings. Numbers stay in sync as new chats and messages
// arrive.

interface SessionRow {
  id: string
  status: 'active' | 'closed'
  created_at: string
  updated_at: string
  student_id: string
  student: { id: string; name?: string; email?: string } | null
}

interface MessageRow {
  id: string
  session_id: string
  sender_id: string
  content: string
  created_at: string
  is_read: boolean | null
  document_name?: string | null
}

interface RecentStudent {
  sessionId: string
  studentId: string
  name: string
  status: 'active' | 'closed'
  lastMessageAt: string
  lastSnippet: string
  unread: boolean
}

export default function ExpertHome() {
  const { profile, setCurrentPage } = useAppStore()
  const supabase = createClient()

  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(true)

  // Initial load + realtime subscriptions on chat_sessions and chat_messages.
  useEffect(() => {
    if (!profile.id) return
    let cancelled = false

    const load = async () => {
      setLoading(true)

      const { data: sessionRows } = await supabase
        .from('chat_sessions')
        .select(
          `id, status, created_at, updated_at, student_id,
           student:profiles!chat_sessions_student_id_fkey(id, name, email)`,
        )
        .eq('expert_id', profile.id)
        .order('updated_at', { ascending: false })

      if (cancelled) return

      const ses: SessionRow[] = (sessionRows as any[] | null) || []
      setSessions(ses)

      if (ses.length === 0) {
        setMessages([])
        setLoading(false)
        return
      }

      const sessionIds = ses.map((s) => s.id)
      const { data: msgRows } = await supabase
        .from('chat_messages')
        .select(
          'id, session_id, sender_id, content, created_at, is_read, document_name',
        )
        .in('session_id', sessionIds)
        .neq('document_name', 'call_signal')
        .order('created_at', { ascending: false })
        .limit(500)

      if (cancelled) return
      setMessages(((msgRows as any[] | null) || []) as MessageRow[])
      setLoading(false)
    }

    load()

    const sessionChannel = supabase
      .channel(`expert-home-sessions-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_sessions',
          filter: `expert_id=eq.${profile.id}`,
        },
        () => load(),
      )
      .subscribe()

    const messageChannel = supabase
      .channel(`expert-home-messages-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages' },
        () => load(),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(sessionChannel)
      supabase.removeChannel(messageChannel)
    }
  }, [profile.id, supabase])

  // ── Derived metrics ───────────────────────────────────────────────────────
  const myExpertId = profile.id

  const activeChats = useMemo(
    () => sessions.filter((s) => s.status === 'active').length,
    [sessions],
  )
  const closedChats = useMemo(
    () => sessions.filter((s) => s.status === 'closed').length,
    [sessions],
  )

  const studentMsgsTotal = useMemo(
    () => messages.filter((m) => m.sender_id !== myExpertId).length,
    [messages, myExpertId],
  )
  const studentMsgsUnread = useMemo(
    () =>
      messages.filter(
        (m) => m.sender_id !== myExpertId && m.is_read === false,
      ).length,
    [messages, myExpertId],
  )
  const expertMsgsSent = useMemo(
    () => messages.filter((m) => m.sender_id === myExpertId).length,
    [messages, myExpertId],
  )

  const responseRate =
    studentMsgsTotal === 0
      ? 0
      : Math.min(100, Math.round((expertMsgsSent / studentMsgsTotal) * 100))

  // Recent students — most-recent activity first.
  const recentStudents: RecentStudent[] = useMemo(() => {
    return sessions
      .slice(0, 5)
      .map((s) => {
        const sessionMessages = messages
          .filter((m) => m.session_id === s.id)
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          )
        const lastMsg = sessionMessages[0]
        const unread = sessionMessages.some(
          (m) => m.sender_id !== myExpertId && m.is_read === false,
        )
        return {
          sessionId: s.id,
          studentId: s.student_id,
          name: s.student?.name || 'Student',
          status: s.status,
          lastMessageAt: lastMsg?.created_at || s.updated_at || s.created_at,
          lastSnippet: (lastMsg?.content || '').slice(0, 80),
          unread,
        }
      })
  }, [sessions, messages, myExpertId])

  const kycVerified = profile.kycStatus === 'verified'

  return (
    <div className="max-w-5xl space-y-6">
      {/* KYC banner */}
      {!kycVerified && (
        <div className="card border-amber-500/30 bg-amber-500/5 flex items-start gap-4">
          <div className="p-3 bg-amber-500/10 rounded-full text-amber-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-amber-500">KYC Verification Pending</h3>
            <p
              className="text-sm mt-1"
              style={{ color: 'var(--foreground-secondary)' }}
            >
              Your profile is currently hidden from students. Complete KYC to start receiving chat requests.
            </p>
            <button
              onClick={() => setCurrentPage('expert-kyc')}
              className="mt-3 text-sm font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1"
            >
              Complete KYC <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Hero */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Welcome back, {profile.name?.split(' ')[0] || 'Expert'}
        </h2>
        <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>
          Live snapshot of your student network — updates automatically as new chats and messages arrive.
        </p>
      </div>

      {/* Live KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          icon={<Users className="w-5 h-5" />}
          tone="indigo"
          loading={loading}
          label="Connected students"
          value={sessions.length.toString()}
          sub={`${activeChats} active · ${closedChats} closed`}
        />
        <Stat
          icon={<MessageSquare className="w-5 h-5" />}
          tone={studentMsgsUnread > 0 ? 'emerald' : 'slate'}
          loading={loading}
          label="Pending replies"
          value={studentMsgsUnread.toString()}
          sub={
            studentMsgsUnread > 0
              ? 'New messages waiting'
              : 'You\u2019re all caught up'
          }
          actionLabel={studentMsgsUnread > 0 ? 'Reply now \u2192' : undefined}
          onAction={() => setCurrentPage('expert-chat')}
        />
        <Stat
          icon={<TrendingUp className="w-5 h-5" />}
          tone="violet"
          loading={loading}
          label="Response rate"
          value={`${responseRate}%`}
          sub={`${expertMsgsSent} replies / ${studentMsgsTotal} student msgs`}
        />
        <Stat
          icon={kycVerified ? <ShieldCheck className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
          tone={kycVerified ? 'emerald' : 'amber'}
          loading={false}
          label="KYC status"
          value={kycVerified ? 'Verified' : profile.kycStatus || 'Pending'}
          sub={
            kycVerified
              ? 'Your profile is visible to students'
              : 'Complete KYC to go live'
          }
          actionLabel={kycVerified ? undefined : 'Open KYC \u2192'}
          onAction={() => setCurrentPage('expert-kyc')}
        />
      </div>

      {/* Recent students */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-base font-bold flex items-center gap-2"
            style={{ color: 'var(--foreground)' }}
          >
            <Activity className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            Recent students
          </h3>
          <button
            onClick={() => setCurrentPage('expert-students')}
            className="text-xs font-medium"
            style={{ color: 'var(--primary-light)' }}
          >
            View all \u2192
          </button>
        </div>

        {loading && recentStudents.length === 0 ? (
          <div
            className="text-sm py-6 text-center flex items-center gap-2 justify-center"
            style={{ color: 'var(--foreground-muted)' }}
          >
            <Loader2 className="w-4 h-4 animate-spin" /> Loading students\u2026
          </div>
        ) : recentStudents.length === 0 ? (
          <div
            className="text-sm py-6 text-center"
            style={{ color: 'var(--foreground-muted)' }}
          >
            No students yet. Once a student starts a chat with you, they\u2019ll
            appear here automatically.
          </div>
        ) : (
          <div className="space-y-2">
            {recentStudents.map((s) => (
              <div
                key={s.sessionId}
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{
                  background: 'var(--background-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: 'var(--gradient-primary)', color: 'white' }}
                >
                  {s.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-medium text-sm truncate"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {s.name}
                    </span>
                    {s.unread && (
                      <span
                        className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success)' }}
                      >
                        New
                      </span>
                    )}
                    <span
                      className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                      style={{
                        background:
                          s.status === 'active'
                            ? 'rgba(99,102,241,0.12)'
                            : 'var(--surface)',
                        color:
                          s.status === 'active'
                            ? 'var(--primary-light)'
                            : 'var(--foreground-muted)',
                      }}
                    >
                      {s.status}
                    </span>
                  </div>
                  {s.lastSnippet && (
                    <div
                      className="text-xs truncate mt-0.5"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      {s.lastSnippet}
                    </div>
                  )}
                </div>
                <div
                  className="text-[11px] whitespace-nowrap"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  {timeAgo(s.lastMessageAt)}
                </div>
                <button
                  onClick={() => setCurrentPage('expert-chat')}
                  className="text-xs font-medium ml-1"
                  style={{ color: 'var(--primary-light)' }}
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tips */}
      <div
        className="card"
        style={{
          background: 'rgba(99,102,241,0.04)',
          borderColor: 'rgba(99,102,241,0.2)',
        }}
      >
        <div
          className="text-sm font-bold mb-2 flex items-center gap-2"
          style={{ color: 'var(--foreground)' }}
        >
          <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--success)' }} />
          Tips to grow your impact
        </div>
        <ul
          className="text-xs space-y-1.5 list-disc pl-5"
          style={{ color: 'var(--foreground-secondary)' }}
        >
          <li>Reply to new student messages within a few hours \u2014 fast responders earn the most repeat sessions.</li>
          <li>Keep your KYC and specialisations up to date so the platform can match you to the right students.</li>
          <li>Use the chat to share concrete checklists, deadlines, and links rather than long text walls.</li>
        </ul>
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  sub,
  tone,
  loading,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone: 'indigo' | 'emerald' | 'violet' | 'amber' | 'slate'
  loading?: boolean
  actionLabel?: string
  onAction?: () => void
}) {
  const toneMap = {
    indigo: { bg: 'rgba(99,102,241,0.10)', fg: '#818cf8' },
    emerald: { bg: 'rgba(16,185,129,0.10)', fg: '#10b981' },
    violet: { bg: 'rgba(139,92,246,0.10)', fg: '#a78bfa' },
    amber: { bg: 'rgba(245,158,11,0.10)', fg: '#f59e0b' },
    slate: { bg: 'rgba(148,163,184,0.12)', fg: '#94a3b8' },
  }[tone]
  return (
    <div className="card" style={{ padding: '1rem 1.1rem' }}>
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="p-1.5 rounded-md"
          style={{ background: toneMap.bg, color: toneMap.fg }}
        >
          {icon}
        </div>
        <div
          className="text-xs font-medium"
          style={{ color: 'var(--foreground-secondary)' }}
        >
          {label}
        </div>
      </div>
      {loading ? (
        <div
          className="text-2xl font-bold flex items-center gap-1.5"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : (
        <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          {value}
        </div>
      )}
      {sub && (
        <div
          className="text-[11px] mt-1"
          style={{ color: 'var(--foreground-muted)' }}
        >
          {sub}
        </div>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="text-[11px] font-medium mt-2"
          style={{ color: 'var(--primary-light)' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

function timeAgo(iso: string): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return ''
  if (ms < 60_000) return 'just now'
  if (ms < 60 * 60_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 24 * 60 * 60_000) return `${Math.floor(ms / (60 * 60_000))}h ago`
  if (ms < 7 * 24 * 60 * 60_000) return `${Math.floor(ms / (24 * 60 * 60_000))}d ago`
  return new Date(iso).toLocaleDateString()
}
