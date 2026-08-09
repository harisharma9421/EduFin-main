'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { UserPlus, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import toast from 'react-hot-toast'

export default function ExpertRequests() {
  const { profile } = useAppStore()
  const supabase = createClient()
  
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchRequests = async () => {
    if (!profile.id) return
    setLoading(true)
    
    // Fetch pending sessions and join with profiles table to get student details
    const { data, error } = await supabase
      .from('chat_sessions')
      .select(`
        id,
        status,
        created_at,
        student:profiles!chat_sessions_student_id_fkey(*)
      `)
      .eq('expert_id', profile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setRequests(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchRequests()
  }, [profile.id])

  const handleAction = async (sessionId: string, action: 'active' | 'rejected') => {
    setActionLoading(sessionId)
    const { error } = await supabase
      .from('chat_sessions')
      .update({ status: action, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      
    if (error) {
      toast.error('Action failed: ' + error.message)
    } else {
      toast.success(action === 'active' ? 'Request accepted!' : 'Request declined.')
      setRequests(prev => prev.filter(req => req.id !== sessionId))
    }
    setActionLoading(null)
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6 pb-10">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2 text-foreground">
          <UserPlus className="w-6 h-6 text-primary" /> Connection Requests
        </h2>
        <p className="mt-1 text-foreground-secondary">
          Students who want to connect with you for mentorship.
        </p>
      </div>

      <div className="space-y-4">
        {requests.length === 0 ? (
          <div className="card text-center py-12 text-foreground-muted border-dashed">
            <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>You have no pending connection requests.</p>
          </div>
        ) : (
          requests.map((req, idx) => (
            <motion.div 
              key={req.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="card flex flex-col md:flex-row gap-4 items-center"
            >
              <img 
                src={req.student.avatar_url || `https://ui-avatars.com/api/?name=${req.student.name || 'Student'}&background=random`} 
                alt="Avatar" 
                className="w-16 h-16 rounded-full border border-white/10" 
              />
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-lg font-bold text-foreground">{req.student.name || 'Unnamed Student'}</h3>
                <p className="text-sm text-foreground-muted">Requested on {new Date(req.created_at).toLocaleDateString()}</p>
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                    {req.student.target_degree || 'Unknown Degree'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">
                    {req.student.application_stage || 'Exploring'}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
                <button 
                  onClick={() => handleAction(req.id, 'active')}
                  disabled={actionLoading === req.id}
                  className="flex-1 md:flex-none px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 border border-emerald-500/20"
                >
                  {actionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Accept
                </button>
                <button 
                  onClick={() => handleAction(req.id, 'rejected')}
                  disabled={actionLoading === req.id}
                  className="flex-1 md:flex-none px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 border border-red-500/20"
                >
                  <XCircle className="w-4 h-4" /> Decline
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
