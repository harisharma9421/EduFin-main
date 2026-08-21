'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Star, ShieldCheck, Clock, Lock, CheckCircle, GraduationCap, MapPin, Briefcase, Loader2, MessageSquare } from 'lucide-react'
import { useNetworkStore } from '@/lib/networkStore'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function ExpertDirectory() {
  const { createChatSession } = useNetworkStore()
  const { profile, setCurrentPage } = useAppStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSpec, setFilterSpec] = useState('')
  const [experts, setExperts] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    const fetchExpertsAndSessions = async () => {
      setLoading(true)
      
      const [expertsRes, sessionsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'expert'),
        supabase.from('chat_sessions').select('*').eq('student_id', profile.id)
      ])
      
      if (expertsRes.data && !expertsRes.error) {
        setExperts(expertsRes.data)
      }
      
      if (sessionsRes.data && !sessionsRes.error) {
        setSessions(sessionsRes.data)
      }
      
      setLoading(false)
    }

    if (profile.id) {
      fetchExpertsAndSessions()
    }
  }, [profile.id])

  const filteredExperts = experts.filter(e => {
    const matchesSearch = (e.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (e.expert_countries || []).some((c: string) => c.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesSpec = filterSpec ? (e.expert_specializations || []).includes(filterSpec) : true
    return matchesSearch && matchesSpec
  })

  const handleConnect = async (expertId: string) => {
    if (!profile.id) return

    const existingSession = sessions.find(s => s.expert_id === expertId)

    if (existingSession) {
      // Already accepted -> open chat
      if (existingSession.status === 'active') {
        setCurrentPage('user-expert-chat')
        return
      }
      // Still waiting on expert
      if (existingSession.status === 'pending') {
        toast('Request is still pending', { icon: '⏳' })
        return
      }
      // Previously rejected (or cancelled) -> reopen by flipping status back to pending
      if (existingSession.status === 'rejected' || existingSession.status === 'cancelled') {
        const { data, error } = await supabase
          .from('chat_sessions')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', existingSession.id)
          .select()
          .single()

        if (error) {
          toast.error('Failed to resend request: ' + error.message)
        } else if (data) {
          setSessions(prev => prev.map(s => (s.id === data.id ? data : s)))
          toast.success('Connection request sent again!')
        }
        return
      }
    }

    // No prior session -> create a fresh one
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        student_id: profile.id,
        expert_id: expertId,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      toast.error('Failed to send request: ' + error.message)
    } else if (data) {
      setSessions(prev => [...prev, data])
      toast.success('Connection request sent!')
    }
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          <Briefcase className="w-6 h-6 text-primary" /> Expert Network
        </h2>
        <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>
          Connect with verified advisors, former admission officers, and career coaches.
        </p>
      </div>

      {/* Filters */}
      <div className="card grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <input
            type="text"
            placeholder="Search by name or country..."
            className="input-field pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div>
          <select 
            className="input-field" 
            value={filterSpec} 
            onChange={(e) => setFilterSpec(e.target.value)}
          >
            <option value="">All Specializations</option>
            <option value="Visa Expert">Visa Expert</option>
            <option value="SOP Specialist">SOP Specialist</option>
            <option value="Loan Advisor">Loan Advisor</option>
            <option value="University Counselor">University Counselor</option>
            <option value="Career Coach">Career Coach</option>
          </select>
        </div>
      </div>

      {/* Expert Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 flex items-center justify-center text-foreground-muted">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : filteredExperts.map((expert, idx) => {
          const isVerified = expert.kyc_status === 'verified'

          return (
            <motion.div 
              key={expert.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`card flex flex-col ${!isVerified ? 'opacity-70 grayscale-[0.5]' : 'hover:border-[var(--primary)] transition-colors'}`}
            >
              <div className="flex items-start gap-4 mb-4">
                <img 
                  src={expert.avatar_url || `https://ui-avatars.com/api/?name=${expert.name || 'Expert'}&background=random`} 
                  alt={expert.name || 'Expert'} 
                  className="w-16 h-16 rounded-full object-cover border-2 border-primary/20"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold truncate flex items-center gap-1" style={{ color: 'var(--foreground)' }}>
                    {expert.name || 'Unnamed Agent'}
                    {isVerified && <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                  </h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {expert.expert_specializations?.map((spec: string) => (
                      <span key={spec} className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-500/10 text-indigo-400">
                        {spec}
                      </span>
                    ))}
                    {(!expert.expert_specializations || expert.expert_specializations.length === 0) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-500/10 text-gray-400">
                        General Advisor
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-sm line-clamp-2 mb-4 flex-1" style={{ color: 'var(--foreground-secondary)' }}>
                {expert.bio || 'No bio provided.'}
              </p>

              <div className="grid grid-cols-2 gap-y-2 text-xs mb-4 p-3 rounded-lg bg-black/10 border border-white/5">
                <div className="flex items-center gap-1.5" style={{ color: 'var(--foreground-muted)' }}>
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="truncate">{expert.expert_countries?.join(', ') || 'Global'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-500 font-medium">
                  <Star className="w-3.5 h-3.5 fill-amber-500" />
                  {expert.rating?.toFixed(1) || '0.0'} ({expert.students_helped || 0} students)
                </div>
                <div className="flex items-center gap-1.5" style={{ color: 'var(--foreground-muted)' }}>
                  <Clock className="w-3.5 h-3.5" />
                  Usually replies in {expert.response_time_hrs || 24} hrs
                </div>
                <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />
                  ₹{expert.session_rate || 1000}/session
                </div>
              </div>

              {(() => {
                const session = sessions.find(s => s.expert_id === expert.id)
                const isPending = session?.status === 'pending'
                const isActive = session?.status === 'active'
                const isRejected = session?.status === 'rejected'

                return (
                  <button 
                    onClick={() => handleConnect(expert.id as string)}
                    disabled={!isVerified || isPending}
                    className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all ${
                      isActive 
                        ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20'
                        : isPending
                        ? 'bg-amber-500/20 text-amber-500 cursor-wait border border-amber-500/30'
                        : isRejected
                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                        : isVerified 
                        ? 'bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/20' 
                        : 'bg-white/5 text-foreground-muted cursor-not-allowed'
                    }`}
                  >
                    {!isVerified ? (
                      <><Lock className="w-4 h-4" /> Verification Pending</>
                    ) : isActive ? (
                      <><MessageSquare className="w-4 h-4" /> Message</>
                    ) : isPending ? (
                      <><Clock className="w-4 h-4" /> Request Pending</>
                    ) : isRejected ? (
                      <>Request again</>
                    ) : (
                      <>Connect with {(expert.name || 'Expert').split(' ')[0]}</>
                    )}
                  </button>
                )
              })()}
            </motion.div>
          )
        })}

        {!loading && filteredExperts.length === 0 && (
          <div className="col-span-full py-12 text-center text-foreground-muted">
            <Search className="w-8 h-8 mx-auto mb-3 opacity-20" />
            No experts found in the database.
          </div>
        )}
      </div>
    </div>
  )
}
