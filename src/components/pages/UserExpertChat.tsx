'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send, Paperclip, Mic, Video, Phone, Check, CheckCheck, 
  FileText, ArrowLeft, Bot, Loader2, UserSquare2, StopCircle
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import VideoCallModal from '@/components/VideoCallModal'

type CallState = 'idle' | 'calling' | 'incoming' | 'connected'

export default function UserExpertChat() {
  const { profile, setCurrentPage } = useAppStore()
  const supabase = createClient()
  
  const [sessions, setSessions] = useState<any[]>([])
  const [activeSession, setActiveSession] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Call States
  const [callState, setCallState] = useState<CallState>('idle')
  const [isAudioOnly, setIsAudioOnly] = useState(false)
  // WebRTC negotiation produces 1 SDP + many ICE candidates in quick
  // succession. A single state slot would drop intermediate signals (React
  // overwrites before the modal processes them), so we accumulate them in an
  // append-only queue. The modal dedupes/processes unseen entries.
  const [webRTCSignals, setWebRTCSignals] = useState<any[]>([])
  const pushSignal = (sig: any) =>
    setWebRTCSignals((prev) => [...prev, { ...sig, _id: `${Date.now()}-${Math.random()}` }])
  // Stable "am I the caller?" flag. Must persist across the
  // calling/incoming → connected transition (both peers are 'connected' once
  // the call starts, so it can't be derived from callState).
  const [isCaller, setIsCaller] = useState(false)
  
  // Voice Note States
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<any>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Heartbeat: write our last_seen every 30s while this page is mounted, plus
  // on tab visibility changes so an idle user still shows Online to the
  // other side. Without this, presence only refreshed on keystrokes.
  useEffect(() => {
    if (!profile?.id) return

    const beat = () =>
      supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', profile.id)
        .then()

    beat()
    const interval = setInterval(beat, 30_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') beat()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [profile?.id])

  // 1. Fetch active sessions
  useEffect(() => {
    if (!profile.id) return

    const fetchSessions = async () => {
      setLoading(true)
      const roleColumn = profile.role === 'expert' ? 'expert_id' : 'student_id'
      const otherRole = profile.role === 'expert' ? 'student' : 'expert'
      
      const { data, error } = await supabase
        .from('chat_sessions')
        .select(`
          id, status, created_at,
          other_user:profiles!chat_sessions_${otherRole}_id_fkey(*)
        `)
        .eq(roleColumn, profile.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (data && data.length > 0) {
        setSessions(data)
        if (!activeSession) setActiveSession(data[0])
      }
      setLoading(false)
    }

    fetchSessions()
  }, [profile.id])

  // 2. Fetch messages & subscribe to realtime
  useEffect(() => {
    if (!activeSession) return

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', activeSession.id)
        .order('created_at', { ascending: true })
      
      if (data) {
        // Process signals that might have been missed if page was refreshed
        const signals = data.filter(m => m.document_name === 'call_signal')
        if (signals.length > 0) {
          const lastSignal = signals[signals.length - 1]
          if (lastSignal.sender_id !== profile.id && new Date(lastSignal.created_at).getTime() > Date.now() - 60000) {
            try {
              const sigData = JSON.parse(lastSignal.content)
              if (sigData.type === 'OFFER') {
                setIsAudioOnly(sigData.audioOnly)
                setIsCaller(false)
                setCallState('incoming')
                pushSignal(sigData)
              } else if (sigData.type === 'ACCEPT') {
                setCallState('connected')
                pushSignal(sigData)
              }
            } catch (e) {}
          }
        }
        
        setMessages(data.filter(m => m.document_name !== 'call_signal'))
      }
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }

    fetchMessages()

    const channel = supabase.channel(`chat_${activeSession.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `session_id=eq.${activeSession.id}`
      }, (payload) => {
        const newMsg = payload.new
        
        // Handle Call Signals encoded in messages
        if (newMsg.document_name === 'call_signal' && newMsg.sender_id !== profile.id) {
          try {
            const signal = JSON.parse(newMsg.content)
            if (signal.type === 'OFFER') {
              setIsAudioOnly(signal.audioOnly)
              setIsCaller(false)
              setCallState('incoming')
              pushSignal(signal)
            } else if (signal.type === 'ACCEPT') {
              setCallState('connected')
              pushSignal(signal)
            } else if (signal.type === 'DECLINE' || signal.type === 'END') {
              setCallState('idle')
              setWebRTCSignals([])
            } else if (signal.type === 'SDP' || signal.type === 'ICE') {
              pushSignal(signal)
            }
          } catch (e) {}
          return // Do not add signal messages to the UI state
        }

        // Only add normal messages to UI
        if (newMsg.document_name !== 'call_signal') {
          setMessages(prev => [...prev, newMsg])
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeSession?.id])

  // Realtime presence: subscribe to UPDATEs on the active chat partner's
  // profile row and re-render so the Online/Last seen label flips live.
  useEffect(() => {
    const otherId = activeSession?.other_user?.id
    if (!otherId) return

    const channel = supabase
      .channel(`presence_${otherId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${otherId}` },
        (payload) => {
          const fresh = payload.new as any
          // Patch the active session and the sidebar list with the new presence.
          setActiveSession((prev: any) =>
            prev && prev.other_user?.id === otherId
              ? {
                  ...prev,
                  other_user: {
                    ...prev.other_user,
                    last_seen: fresh.last_seen,
                    status: fresh.status,
                  },
                }
              : prev,
          )
          setSessions((prev) =>
            prev.map((s) =>
              s.other_user?.id === otherId
                ? {
                    ...s,
                    other_user: { ...s.other_user, last_seen: fresh.last_seen, status: fresh.status },
                  }
                : s,
            ),
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeSession?.other_user?.id])

  // Re-render the Online/Last seen text every minute even when nothing else
  // changes, so "Last seen 2 mins ago" doesn't go stale on a quiet chat.
  const [, setPresenceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setPresenceTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // Broadcast Call Signals via DB Inserts
  const sendSignal = async (signalData: any) => {
    await supabase.from('chat_messages').insert({
      session_id: activeSession.id,
      sender_id: profile.id,
      document_name: 'call_signal',
      content: JSON.stringify(signalData)
    })
  }

  const handleStartCall = async (audioOnly: boolean) => {
    setIsAudioOnly(audioOnly)
    setIsCaller(true)
    setWebRTCSignals([])
    setCallState('calling')
    await sendSignal({ type: 'OFFER', audioOnly })
  }

  const handleAcceptCall = async () => {
    setIsCaller(false)
    setCallState('connected')
    await sendSignal({ type: 'ACCEPT' })
  }

  const handleEndCall = async () => {
    setCallState('idle')
    setWebRTCSignals([])
    await sendSignal({ type: 'END' })
  }

  const handleDeclineCall = async () => {
    setCallState('idle')
    setWebRTCSignals([])
    await sendSignal({ type: 'DECLINE' })
  }

  // Voice Notes
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        await uploadVoiceNote(audioBlob)
      }
      
      mediaRecorderRef.current.start()
      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch (err) {
      toast.error('Microphone access denied')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      clearInterval(timerRef.current)
    }
  }

  const uploadVoiceNote = async (blob: Blob) => {
    setUploading(true)
    const fileName = `voice_${Date.now()}.webm`
    const filePath = `${activeSession.id}/${fileName}`
    
    try {
      const { error } = await supabase.storage.from('chat_attachments').upload(filePath, blob)
      if (error) throw error
      
      const { data: { publicUrl } } = supabase.storage.from('chat_attachments').getPublicUrl(filePath)
      
      await supabase.from('chat_messages').insert({
        session_id: activeSession.id,
        sender_id: profile.id,
        content: '🎤 Voice message',
        document_url: publicUrl,
        document_name: 'audio' // Identifier for audio rendering
      })
    } catch (err) {
      toast.error('Failed to send voice note')
    }
    setUploading(false)
  }

  // File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeSession) return

    setUploading(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
    const filePath = `${activeSession.id}/${fileName}`

    try {
      const { error: uploadError } = await supabase.storage.from('chat_attachments').upload(filePath, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('chat_attachments').getPublicUrl(filePath)
      await supabase.from('chat_messages').insert({
        session_id: activeSession.id,
        sender_id: profile.id,
        content: `Shared a document: ${file.name}`,
        document_url: publicUrl,
        document_name: file.name
      })
      toast.success('Document shared')
    } catch (err: any) {
      toast.error('Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputText.trim() || !activeSession || sending) return

    setSending(true)
    await supabase.from('chat_messages').insert({
      session_id: activeSession.id,
      sender_id: profile.id,
      content: inputText.trim()
    })
    setInputText('')
    setSending(false)
  }

  const handleSendProfileInfo = async () => {
    if (!activeSession || sending) return
    setSending(true)
    const profileData = `
📊 **Student Profile Summary**
- **Target Degree:** ${profile.targetDegree || 'Not specified'}
- **Target Countries:** ${(profile.targetCountry || []).join(', ') || 'Not specified'}
- **Current Stage:** ${profile.journeyStage || 'Exploring'}
- **Budget:** ₹${profile.budgetLakhs || 0} Lakhs
- **Loan Eligible:** ${profile.loanEligible ? 'Yes' : 'No'}
- **Academic Score:** ${profile.cgpa ? profile.cgpa + ' CGPA' : 'N/A'}
    `.trim()
    await supabase.from('chat_messages').insert({ session_id: activeSession.id, sender_id: profile.id, content: profileData })
    toast.success('Profile info sent!')
    setSending(false)
  }

  if (loading) return <div className="flex-1 flex items-center justify-center bg-[#0b141a]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

  const formatTime = (isoString: string) => new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  
  // Presence is now driven by the explicit `profiles.status` column written
  // by usePresence. last_seen is only used as a fallback for old rows.
  const getPresenceText = (lastSeen: string | undefined, status?: string) => {
    if (status === 'online') return 'Online'
    if (status === 'offline') {
      if (!lastSeen) return 'Offline'
      return `Last seen ${new Date(lastSeen).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    }
    if (!lastSeen) return 'Offline'
    const diff = Date.now() - new Date(lastSeen).getTime()
    if (diff < 5 * 60 * 1000) return 'Online'
    return `Last seen ${new Date(lastSeen).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
  }

  return (
    <div data-chat-theme="invert" className="flex h-[calc(100vh-8rem)] max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-2xl border chat-shell" style={{ borderColor: 'var(--chat-border)' }}>
      
      {/* Sidebar - Chat List */}
      <div className="w-80 border-r flex flex-col hidden md:flex chat-strip" style={{ borderColor: 'var(--chat-border)' }}>
        <div className="p-4 chat-elevated font-bold text-lg flex items-center gap-3 border-b" style={{ borderColor: 'var(--chat-border)' }}>
          <button onClick={() => setCurrentPage('dashboard')} className="p-1 hover:bg-black/10 rounded-full chat-fg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          My Chats
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {sessions.length === 0 ? (
            <div className="p-4 text-center chat-fg-muted text-sm mt-4">
              No active chats. 
              <br/><br/>
              <button onClick={() => setCurrentPage('expert-directory')} className="px-4 py-2 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold hover:bg-indigo-500/30">
                Find an Expert
              </button>
            </div>
          ) : sessions.map(chat => {
            const otherUser = chat.other_user || { name: 'User' }
            const isActive = activeSession?.id === chat.id
            const presence = getPresenceText(otherUser.last_seen, otherUser.status)
            
            return (
              <button key={chat.id} onClick={() => setActiveSession(chat)}
                className={`w-full flex items-center gap-3 p-3 border-b chat-divider hover:opacity-90 transition-colors ${isActive ? 'chat-tile-active' : ''}`}>
                <img src={otherUser.avatar_url || `https://ui-avatars.com/api/?name=${otherUser.name}`} className="w-12 h-12 rounded-full" alt="" />
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold chat-fg truncate">{otherUser.name || 'Unnamed User'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs truncate w-4/5 font-medium flex items-center gap-1 ${presence === 'Online' ? 'text-emerald-500' : 'chat-fg-subtle'}`}>
                      {presence === 'Online' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />} {presence}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      {activeSession ? (
        <div className="flex-1 flex flex-col relative" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'cover', backgroundBlendMode: 'overlay', backgroundColor: 'var(--chat-overlay)' }}>
          
          <div className="flex items-center justify-between p-3 chat-elevated">
            <div className="flex items-center gap-3">
              <button onClick={() => setCurrentPage('dashboard')} className="md:hidden p-2 hover:bg-black/10 rounded-full chat-fg-muted">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <img src={activeSession.other_user?.avatar_url || `https://ui-avatars.com/api/?name=${activeSession.other_user?.name}`} alt="" className="w-10 h-10 rounded-full" />
              <div>
                <div className="font-semibold chat-fg">{activeSession.other_user?.name || 'User'}</div>
                {(() => {
                  const text = getPresenceText(activeSession.other_user?.last_seen, activeSession.other_user?.status)
                  const online = text === 'Online'
                  return (
                    <div className={`text-xs font-medium flex items-center gap-1.5 ${online ? 'text-emerald-500' : 'chat-fg-subtle'}`}>
                      {online && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />}
                      {text}
                    </div>
                  )
                })()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSendProfileInfo} disabled={sending} className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 text-xs font-bold transition-colors border border-indigo-500/30">
                <UserSquare2 className="w-4 h-4" /> Send My Info
              </button>
              <button onClick={() => handleStartCall(false)} className="p-2 hover:bg-black/10 rounded-full chat-fg-muted transition-colors">
                <Video className="w-5 h-5" />
              </button>
              <button onClick={() => handleStartCall(true)} className="p-2 hover:bg-black/10 rounded-full chat-fg-muted transition-colors">
                <Phone className="w-4 h-4" />
              </button>
            </div>
          </div>

          <VideoCallModal 
            callState={callState} 
            onAccept={handleAcceptCall} 
            onDecline={handleDeclineCall}
            onEnd={handleEndCall}
            userName={activeSession.other_user?.name || 'Expert'}
            isAudioOnly={isAudioOnly}
            isCaller={isCaller}
            sendWebRTCSignal={sendSignal}
            webRTCSignals={webRTCSignals}
          />

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {messages.length === 0 && (
              <div className="text-center p-4 rounded-lg text-sm max-w-xs mx-auto chat-elevated">
                This is the start of your secure chat. Messages and documents are end-to-end encrypted.
              </div>
            )}
            
            {messages.map((msg, i) => {
              const isMine = msg.sender_id === profile.id
              
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  key={msg.id} 
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] sm:max-w-[70%] rounded-lg p-2 px-3 shadow-sm relative group ${
                    isMine ? 'chat-bubble-outgoing' : 'chat-bubble-incoming'
                  }`} style={{ borderTopRightRadius: isMine ? '0' : '0.5rem', borderTopLeftRadius: !isMine ? '0' : '0.5rem' }}>
                    
                    {msg.document_url && msg.document_name === 'audio' ? (
                      <div className="mb-2">
                        <audio controls className="h-10 w-full max-w-[250px] outline-none">
                          <source src={msg.document_url} type="audio/webm" />
                        </audio>
                      </div>
                    ) : msg.document_url ? (
                      <a href={msg.document_url} target="_blank" rel="noopener noreferrer" 
                         className="flex items-center gap-3 bg-black/10 p-2 rounded-md mb-2 hover:bg-black/20 transition-colors">
                        <div className="p-2 bg-red-500/20 rounded text-red-400"><FileText className="w-5 h-5" /></div>
                        <div className="text-sm truncate pr-4">{msg.document_name}</div>
                      </a>
                    ) : null}
                    
                    <div className="text-[14.5px] leading-relaxed whitespace-pre-wrap font-sans">{msg.content}</div>
                    
                    <div className="flex items-center justify-end gap-1 mt-1 -mr-1">
                      <span className="text-[10px] opacity-60">{formatTime(msg.created_at)}</span>
                      {isMine && (msg.is_read ? <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" /> : <Check className="w-3.5 h-3.5 opacity-60" />)}
                    </div>
                  </div>
                </motion.div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="p-3 flex items-center gap-2 chat-elevated">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
            <button type="button" disabled={uploading || isRecording} onClick={() => fileInputRef.current?.click()} className="p-3 chat-fg-muted hover:chat-fg hover:bg-black/5 rounded-full transition-colors disabled:opacity-50">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
            </button>
            <div className="flex-1 chat-input rounded-xl flex items-center px-4 py-2 overflow-hidden">
              {isRecording ? (
                <div className="flex-1 flex items-center gap-3 text-red-400 animate-pulse font-medium">
                  <Mic className="w-5 h-5" /> Recording... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                </div>
              ) : (
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a message..."
                  className="w-full bg-transparent outline-none chat-fg text-[15px]"
                />
              )}
            </div>
            {inputText.trim() ? (
              <button type="submit" disabled={sending} className="p-3 bg-[#00a884] text-white rounded-full hover:bg-[#008f6f] transition-colors shadow-lg">
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 -ml-1" />}
              </button>
            ) : isRecording ? (
              <button type="button" onClick={stopRecording} className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20">
                <StopCircle className="w-5 h-5" />
              </button>
            ) : (
              <button type="button" onClick={startRecording} className="p-3 text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-full transition-colors">
                <Mic className="w-5 h-5" />
              </button>
            )}
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0b141a] text-gray-400">
          <Bot className="w-12 h-12 mb-4 opacity-20" />
          <p>Select a chat from the sidebar to start messaging.</p>
        </div>
      )}
    </div>
  )
}
