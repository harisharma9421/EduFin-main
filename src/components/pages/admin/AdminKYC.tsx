'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, Search, FileText, CheckCircle, XCircle, Clock, X, ExternalLink, ChevronRight, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function AdminKYC() {
  const supabase = createClient()
  
  const [experts, setExperts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedExpert, setSelectedExpert] = useState<any | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchExperts = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').eq('role', 'expert')
    
    if (error) {
      toast.error('Failed to fetch experts')
    } else if (data) {
      setExperts(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchExperts()
  }, [])

  const filteredExperts = experts.filter(e => {
    const matchesFilter = filter === 'all' ? true : e.kyc_status === filter
    const matchesSearch = (e.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (e.expert_specializations || []).some((s: string) => s.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesFilter && matchesSearch
  })

  const handleApprove = async () => {
    if (!selectedExpert) return
    setActionLoading(true)
    
    try {
      const res = await fetch('/api/admin/expert-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', expertId: selectedExpert.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to approve expert')
      
      const updatedRow = { ...selectedExpert, kyc_status: 'verified', kyc_rejection_reason: null }
      toast.success('Agent verified successfully')
      setSelectedExpert(null)
      setExperts(prev => prev.map(e => e.id === updatedRow.id ? updatedRow : e))
    } catch (err: any) {
      toast.error('Failed to verify expert: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedExpert || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    setActionLoading(true)
    
    try {
      const res = await fetch('/api/admin/expert-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', expertId: selectedExpert.id, reason: rejectReason })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reject expert')
      
      const updatedRow = { ...selectedExpert, kyc_status: 'rejected', kyc_rejection_reason: rejectReason }
      toast.success('Application rejected')
      setSelectedExpert(null)
      setShowRejectInput(false)
      setRejectReason('')
      setExperts(prev => prev.map(e => e.id === updatedRow.id ? updatedRow : e))
    } catch (err: any) {
      toast.error('Failed to reject expert: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (e?: React.MouseEvent, expertId?: string) => {
    if (e) e.stopPropagation()
    const idToDelete = expertId || selectedExpert?.id
    if (!idToDelete) return
    if (!confirm('Are you sure you want to permanently DELETE this test user? This will completely remove them from the database.')) return
    setActionLoading(true)
    
    try {
      const res = await fetch('/api/admin/expert-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', expertId: idToDelete })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete expert')
      
      toast.success('Application deleted')
      if (selectedExpert?.id === idToDelete) {
        setSelectedExpert(null)
      }
      setExperts(prev => prev.filter(e => e.id !== idToDelete))
    } catch (err: any) {
      toast.error('Failed to delete application: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleOpenDoc = (doc: any) => {
    if (doc.url) {
      window.open(doc.url, '_blank');
      toast.success(`Opened ${doc.name}`);
    } else {
      toast.error('Document URL not found');
    }
  }

  const StatusBadge = ({ status }: { status: string | undefined }) => {
    switch (status) {
      case 'verified': return <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500"><CheckCircle className="w-3 h-3" /> Verified</span>
      case 'rejected': return <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-500/10 text-red-500"><XCircle className="w-3 h-3" /> Rejected</span>
      case 'unsubmitted': return <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-500"><Clock className="w-3 h-3" /> Unsubmitted</span>
      case 'pending':
      default: return <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500"><Clock className="w-3 h-3" /> {status || 'Pending'}</span>
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <ShieldCheck className="w-6 h-6 text-red-500" /> KYC Management
          </h2>
          <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>Review and verify agent credentials from the database.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <input type="text" placeholder="Search agents..." className="input-field pl-10 w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <select className="input-field w-32" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        
        {/* Table Area */}
        <div className={`card flex-1 flex flex-col min-h-0 p-0 overflow-hidden ${selectedExpert ? 'hidden lg:flex' : 'flex'}`}>
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#202c33] sticky top-0 z-10">
                <tr className="text-foreground-muted">
                  <th className="px-6 py-4 font-semibold">Agent Name</th>
                  <th className="px-6 py-4 font-semibold">Specialization</th>
                  <th className="px-6 py-4 font-semibold">Documents</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                   <tr><td colSpan={5} className="px-6 py-12 text-center text-foreground-muted"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Fetching real KYC data...</td></tr>
                ) : filteredExperts.map(expert => (
                  <tr key={expert.id} 
                    onClick={() => { setSelectedExpert(expert); setShowRejectInput(false); setRejectReason(''); }}
                    className={`hover:bg-white/5 cursor-pointer transition-colors ${selectedExpert?.id === expert.id ? 'bg-red-500/10' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={expert.avatar_url || `https://ui-avatars.com/api/?name=${expert.name || 'Agent'}`} className="w-8 h-8 rounded-full" alt="" />
                        <div>
                          <div className="font-bold text-foreground">{expert.name || 'Unnamed Agent'}</div>
                          <div className="text-[10px] text-foreground-muted">{expert.email || 'No email provided'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-foreground-secondary">{expert.expert_specializations?.[0] || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
                        <FileText className="w-4 h-4" /> {expert.kyc_documents?.length || 0} files
                      </div>
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={expert.kyc_status} /></td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={(e) => handleDelete(e, expert.id)} className="p-1.5 text-foreground-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete Application">
                          <XCircle className="w-4 h-4" />
                        </button>
                        <button className="text-red-400 hover:text-red-300 font-medium text-xs flex items-center gap-1">
                          Review <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filteredExperts.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-foreground-muted">No KYC applications found in database.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Viewer */}
        <AnimatePresence>
          {selectedExpert && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 400, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              className="flex-shrink-0 card flex flex-col p-0 overflow-hidden bg-[#111b21] border-l-4 border-red-500">
              
              <div className="p-4 border-b border-border flex items-center justify-between bg-[#202c33]">
                <h3 className="font-bold text-foreground">Review Application</h3>
                <button onClick={() => setSelectedExpert(null)} className="p-1 hover:bg-white/10 rounded-lg text-foreground-muted transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                
                {/* Profile Info */}
                <div className="flex items-start gap-4">
                  <img src={selectedExpert.avatar_url || `https://ui-avatars.com/api/?name=${selectedExpert.name || 'Agent'}`} className="w-16 h-16 rounded-xl object-cover" alt="" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-lg text-foreground">{selectedExpert.name || 'Unnamed'}</h4>
                        <StatusBadge status={selectedExpert.kyc_status} />
                      </div>
                      <button onClick={handleDelete} className="p-2 text-foreground-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete Application">
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                    {selectedExpert.linkedin_url && (
                      <a href={selectedExpert.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline mt-2 flex items-center gap-1">
                        LinkedIn Profile <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                <div>
                  <h5 className="text-xs uppercase tracking-wider text-foreground-muted font-bold mb-1">Bio</h5>
                  <p className="text-sm text-foreground-secondary">{selectedExpert.bio || 'No bio provided'}</p>
                </div>

                <div>
                  <h5 className="text-xs uppercase tracking-wider text-foreground-muted font-bold mb-2">Documents Received</h5>
                  <div className="space-y-3">
                    {selectedExpert.kyc_documents?.map((doc: any, i: number) => (
                      <div 
                        key={i} 
                        onClick={() => handleOpenDoc(doc)}
                        className="p-3 rounded-lg border border-white/10 bg-black/20 flex items-center justify-between hover:border-red-500/30 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-500/10 text-red-400 rounded"><FileText className="w-5 h-5" /></div>
                          <div>
                            <div className="text-sm font-medium text-foreground">{doc.type}</div>
                            <div className="text-[10px] text-foreground-muted">{doc.name}</div>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-foreground-muted group-hover:text-red-400" />
                      </div>
                    )) || (
                      <div className="text-sm text-foreground-muted">No documents uploaded.</div>
                    )}
                  </div>
                </div>

              </div>

              {/* Actions Footer */}
              {selectedExpert.kyc_status === 'pending' && (
                <div className="p-5 border-t border-border bg-[#202c33]">
                  {showRejectInput ? (
                    <div className="space-y-3">
                      <textarea className="input-field text-sm min-h-[80px]" placeholder="Explain why this application is being rejected..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                      <div className="flex gap-2">
                        <button onClick={() => setShowRejectInput(false)} className="btn-secondary flex-1 text-xs">Cancel</button>
                        <button onClick={handleReject} disabled={actionLoading} className="btn-primary bg-red-500 hover:bg-red-600 border-none flex-1 text-xs flex items-center justify-center gap-2">
                          {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />} Confirm Rejection
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button onClick={() => setShowRejectInput(true)} className="flex-1 py-2.5 rounded-lg font-bold text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">Reject</button>
                      <button onClick={handleApprove} disabled={actionLoading} className="flex-1 py-2.5 flex items-center justify-center gap-2 rounded-lg font-bold text-sm bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all">
                        {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />} Approve & Verify
                      </button>
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
