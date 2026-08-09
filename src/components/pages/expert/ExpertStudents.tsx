'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, MapPin, GraduationCap, Clock, MessageSquare, Users, BarChart2, Loader2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import StudentInsightsPanel from './StudentInsightsPanel'
import type { StudentProfile } from '@/lib/types'

type StudentCard = {
  chatId: string
  student: any                  // raw profile row (snake_case)
  lastMessage?: {
    content: string
    senderId: string
    isMine: boolean
    createdAt: string
  } | null
}

// Map a Supabase profile row to the StudentProfile shape that
// StudentInsightsPanel and the rest of the app expects.
const toStudentProfile = (row: any): StudentProfile =>
  ({
    id: row.id,
    name: row.name || 'Unnamed Student',
    email: row.email,
    role: 'student',
    avatar: row.avatar_url,
    targetCountry: row.target_countries || [],
    targetProgram: row.target_degree || '',
    targetField: row.target_field,
    journeyStage: row.journey_stage || 'EXPLORER',
    cgpa: parseFloat(row.undergrad_cgpa) || 0,
    greScore: parseInt(row.gre_score) || 0,
    ieltsScore: parseFloat(row.ielts_score) || 0,
    workExpYears: parseInt(row.years_experience) || 0,
    budgetLakhs: parseInt(row.expected_budget) || 0,
    currentDegree: row.target_degree || '',
    currentUniversity: row.undergrad_college || '',
    intakeTarget: row.intake_target,
    applicationStage: row.application_stage,
    bio: row.bio,
  } as unknown as StudentProfile)

export default function ExpertStudents() {
  const { profile, setCurrentPage } = useAppStore()
  const supabase = createClient()

  const [cards, setCards] = useState<StudentCard[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null)

  // Load every active chat for this expert plus the most recent message in
  // each one, so My Students lists exactly the people we've actually talked
  // to.
  useEffect(() => {
    if (!profile.id) return
    let cancelled = false

    const load = async () => {
      setLoading(true)

      const { data: sessionRows, error } = await supabase
        .from('chat_sessions')
        .select(
          `
          id,
          status,
          created_at,
          student:profiles!chat_sessions_student_id_fkey(*)
          `,
        )
        .eq('expert_id', profile.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error || !sessionRows || cancelled) {
        if (!cancelled) {
          setCards([])
          setLoading(false)
        }
        return
      }

      // Pull the most recent non-signal message per session in parallel.
      const results = await Promise.all(
        sessionRows.map(async (row: any) => {
          const { data: lastMsgRows } = await supabase
            .from('chat_messages')
            .select('content, sender_id, created_at, document_name')
            .eq('session_id', row.id)
            .neq('document_name', 'call_signal')
            .order('created_at', { ascending: false })
            .limit(1)

          const lastRow = lastMsgRows?.[0]
          return {
            chatId: row.id,
            student: row.student,
            lastMessage: lastRow
              ? {
                  content: lastRow.content,
                  senderId: lastRow.sender_id,
                  isMine: lastRow.sender_id === profile.id,
                  createdAt: lastRow.created_at,
                }
              : null,
          } as StudentCard
        }),
      )

      if (!cancelled) {
        setCards(results)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [profile.id])

  const filteredCards = cards.filter((c) => {
    const name = (c.student?.name || '').toLowerCase()
    const program = (c.student?.target_degree || '').toLowerCase()
    const term = searchTerm.toLowerCase()
    return name.includes(term) || program.includes(term)
  })

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'EXPLORER':
        return 'text-blue-400 bg-blue-400/10'
      case 'RESEARCHER':
        return 'text-indigo-400 bg-indigo-400/10'
      case 'APPLICANT':
        return 'text-amber-400 bg-amber-400/10'
      case 'LOAN_SEEKER':
        return 'text-emerald-400 bg-emerald-400/10'
      default:
        return 'text-gray-400 bg-gray-400/10'
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          My Students
        </h2>
        <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>
          Students you've connected with — sorted by most recent activity.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
        <input
          type="text"
          placeholder="Search students by name or program..."
          className="input-field pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center text-foreground-muted">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map((item, idx) => {
            const stu = item.student || {}
            const journeyStage = stu.journey_stage || 'EXPLORER'
            const targetCountries: string[] = stu.target_countries || []
            const targetDegree: string = stu.target_degree || 'Not set'
            const avatar =
              stu.avatar_url ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(stu.name || 'Student')}&background=random`

            return (
              <motion.div
                key={item.chatId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="card flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <img src={avatar} alt="" className="w-10 h-10 rounded-full" />
                    <div>
                      <h3 className="font-bold text-foreground">{stu.name || 'Unnamed Student'}</h3>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getStageColor(
                          journeyStage,
                        )}`}
                      >
                        {String(journeyStage).replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4 flex-1">
                  <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                    <MapPin className="w-3.5 h-3.5" />
                    {targetCountries.length ? targetCountries.join(', ') : 'Not set'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                    <GraduationCap className="w-3.5 h-3.5" /> {targetDegree}
                  </div>
                </div>

                {item.lastMessage && (
                  <div className="p-2 rounded bg-black/10 border border-white/5 mb-4">
                    <div className="text-[10px] text-foreground-muted mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Last message ·{' '}
                      {new Date(item.lastMessage.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="text-xs text-foreground-secondary line-clamp-1">
                      {item.lastMessage.isMine ? 'You: ' : ''}
                      {item.lastMessage.content}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedStudent(toStudentProfile(stu))}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-none"
                  >
                    <BarChart2 className="w-4 h-4" /> Insights
                  </button>
                  <button
                    onClick={() => setCurrentPage('expert-chat')}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm"
                  >
                    <MessageSquare className="w-4 h-4" /> Chat
                  </button>
                </div>
              </motion.div>
            )
          })}

          {filteredCards.length === 0 && (
            <div className="col-span-full py-12 text-center text-foreground-muted">
              <Users className="w-8 h-8 mx-auto mb-3 opacity-20" />
              {cards.length === 0
                ? "You haven't accepted any student requests yet."
                : 'No students match that search.'}
            </div>
          )}
        </div>
      )}

      {selectedStudent && (
        <StudentInsightsPanel student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      )}
    </div>
  )
}
