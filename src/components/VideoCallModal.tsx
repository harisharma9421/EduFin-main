import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, Video, Mic, MicOff, VideoOff, PhoneOff, PhoneCall, Maximize, Minimize } from 'lucide-react'

type CallState = 'idle' | 'calling' | 'incoming' | 'connected'

export default function VideoCallModal({ 
  callState, 
  onAccept, 
  onDecline,
  onEnd,
  userName,
  isAudioOnly = false,
  isCaller = false,
  sendWebRTCSignal,
  webRTCSignals
}: { 
  callState: CallState
  onAccept: () => void
  onDecline: () => void
  onEnd: () => void
  userName: string
  isAudioOnly?: boolean
  isCaller?: boolean
  sendWebRTCSignal: (payload: any) => void
  webRTCSignals: any[]
}) {
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(isAudioOnly)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hasRemote, setHasRemote] = useState(false)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  // Buffer remote signals that arrive before the peer connection is ready
  // (e.g. a flurry of ICE candidates landing while getUserMedia is resolving).
  // They are drained inside handleSignaling once pcRef.current exists.
  const pendingSignalsRef = useRef<any[]>([])
  const seenSignalsRef = useRef<Set<string>>(new Set())
  const remoteDescSetRef = useRef(false)

  // Timer
  useEffect(() => {
    let interval: any
    if (callState === 'connected') {
      interval = setInterval(() => setDuration(d => d + 1), 1000)
    } else {
      setDuration(0)
    }
    return () => clearInterval(interval)
  }, [callState])

  // WebRTC Initialization
  useEffect(() => {
    if (callState === 'connected') {
      // Reset per-call state so a second call in the same session starts clean.
      pendingSignalsRef.current = []
      seenSignalsRef.current = new Set()
      remoteDescSetRef.current = false
      setHasRemote(false)
      startWebRTC()
    } else {
      cleanupWebRTC()
    }
    return () => cleanupWebRTC()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState])

  // Handle every incoming WebRTC signal. The parent passes an append-only
  // queue (1 SDP + many ICE per negotiation). We process every entry we
  // haven't seen yet, dedupe (a message may appear in both the realtime feed
  // and the bootstrap fetch), and BUFFER anything that arrives before the
  // local PC is ready instead of discarding it.
  useEffect(() => {
    if (!Array.isArray(webRTCSignals) || callState !== 'connected') return

    for (const sig of webRTCSignals) {
      if (!sig || (sig.type !== 'SDP' && sig.type !== 'ICE')) continue

      const fingerprint = sig._id ?? JSON.stringify(sig)
      if (seenSignalsRef.current.has(fingerprint)) continue
      seenSignalsRef.current.add(fingerprint)

      if (!pcRef.current) {
        pendingSignalsRef.current.push(sig)
        continue
      }
      handleSignaling(sig)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webRTCSignals, callState])

  const drainPendingSignals = async () => {
    const queue = pendingSignalsRef.current
    pendingSignalsRef.current = []
    for (const sig of queue) {
      // eslint-disable-next-line no-await-in-loop
      await handleSignaling(sig)
    }
  }

  const startWebRTC = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: !isAudioOnly,
        audio: true
      })
      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
        // Some browsers (Safari) need an explicit play() to start preview
        localVideoRef.current.play().catch(() => {})
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]
      })
      pcRef.current = pc

      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0] || new MediaStream([event.track])
        if (remoteVideoRef.current) {
          if (remoteVideoRef.current.srcObject !== remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream
            // Explicit play() — required by Safari and helpful elsewhere.
            remoteVideoRef.current.play().catch(() => {})
          }
        }
        setHasRemote(true)
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWebRTCSignal({ type: 'ICE', candidate: event.candidate.toJSON() })
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          console.warn('[WebRTC] connection failed')
        }
      }

      if (isCaller) {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        sendWebRTCSignal({ type: 'SDP', sdp: pc.localDescription })
      }

      // Anything that arrived while we were awaiting getUserMedia /
      // setLocalDescription is processed now in arrival order.
      await drainPendingSignals()
    } catch (err) {
      console.error('Error starting WebRTC:', err)
    }
  }

  const handleSignaling = async (signal: any) => {
    const pc = pcRef.current
    if (!pc) {
      pendingSignalsRef.current.push(signal)
      return
    }

    try {
      if (signal.type === 'SDP' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
        remoteDescSetRef.current = true
        if (signal.sdp.type === 'offer') {
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          sendWebRTCSignal({ type: 'SDP', sdp: pc.localDescription })
        }
        // ICE candidates that arrived before the remote SDP was applied
        // can be added now.
        await drainPendingSignals()
      } else if (signal.type === 'ICE' && signal.candidate) {
        if (!remoteDescSetRef.current) {
          // Wait until setRemoteDescription has been called.
          pendingSignalsRef.current.push(signal)
          return
        }
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
      }
    } catch (err) {
      console.error('Error handling WebRTC signal:', err)
    }
  }

  const cleanupWebRTC = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (pcRef.current) {
      pcRef.current.close()
    }
    localStreamRef.current = null
    pcRef.current = null
    pendingSignalsRef.current = []
    seenSignalsRef.current = new Set()
    remoteDescSetRef.current = false
    setHasRemote(false)
  }

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
      }
    }
  }

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoOff(!videoTrack.enabled)
      }
    }
  }

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  if (callState === 'idle') return null

  // If connected, show Native WebRTC Video Room
  if (callState === 'connected') {
    return (
      <div className={`fixed inset-0 z-[100] bg-black flex flex-col ${isFullscreen ? '' : 'sm:p-4'}`}>
        <div className={`flex-1 relative flex flex-col bg-[#111b21] ${isFullscreen ? '' : 'sm:rounded-3xl'} overflow-hidden shadow-2xl`}>
          
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-20 flex justify-between items-start pointer-events-none">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-white">
                <div className="font-semibold">{isAudioOnly ? 'Secure Audio Call' : 'Secure Video Call'}</div>
                <div className="text-sm text-gray-300">with {userName} • {formatDuration(duration)}</div>
              </div>
            </div>
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="pointer-events-auto p-2 hover:bg-white/10 rounded-full text-white transition-colors">
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>

          {/* Video Grid */}
          <div className="flex-1 relative w-full h-full flex items-center justify-center bg-[#0b141a]">
            {isAudioOnly ? (
              <div className="flex flex-col items-center">
                <div className="w-32 h-32 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/50 mb-6">
                  <Phone className="w-12 h-12 text-indigo-400" />
                </div>
                <h3 className="text-xl text-white font-medium">{userName}</h3>
              </div>
            ) : (
              <>
                {/* Remote Video (Full Screen) */}
                <video 
                  ref={remoteVideoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />

                {/* Connecting placeholder while we wait for the remote track */}
                {!hasRemote && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0b141a]/90 text-white pointer-events-none">
                    <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                      <Video className="w-10 h-10 text-white/40" />
                    </div>
                    <p className="text-sm text-gray-300">Connecting to {userName}…</p>
                  </div>
                )}

                {/* Local Video (Floating Picture-in-Picture) */}
                <motion.div 
                  drag
                  dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                  className="absolute bottom-24 right-4 w-32 sm:w-48 aspect-[3/4] bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-white/10 cursor-move z-10"
                >
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  {isVideoOff && (
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                      <VideoOff className="w-6 h-6 text-white/50" />
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </div>

          {/* Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-center items-center gap-6 z-20">
            <button onClick={toggleMute} className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}>
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            {!isAudioOnly && (
              <button onClick={toggleVideo} className={`p-4 rounded-full transition-colors ${isVideoOff ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}>
                {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
              </button>
            )}
            <button onClick={onEnd} className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-transform hover:scale-105 shadow-lg shadow-red-500/20">
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>

        </div>
      </div>
    )
  }

  // Ringing/Incoming State
  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
          className="w-full max-w-md bg-[#111b21] rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-500/10 rounded-full blur-[80px]" />
          <div className="p-10 flex flex-col items-center relative z-10">
            <div className="relative mb-6 mt-4">
              <img src={`https://ui-avatars.com/api/?name=${userName}&size=200`} alt={userName} className="w-32 h-32 rounded-full border-4 border-[#202c33] shadow-xl relative z-10" />
              {(callState === 'calling' || callState === 'incoming') && (
                <>
                  <motion.div animate={{ scale: [1, 1.4], opacity: [0.5, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }} className="absolute inset-0 border-4 border-indigo-500 rounded-full" />
                  <motion.div animate={{ scale: [1, 1.8], opacity: [0.3, 0] }} transition={{ repeat: Infinity, duration: 2, delay: 0.4, ease: "easeOut" }} className="absolute inset-0 border-4 border-indigo-400 rounded-full" />
                </>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{userName}</h2>
            <p className="text-indigo-400 font-medium tracking-wide">
              {callState === 'calling' ? 'Calling...' : 'Incoming Secure Call...'}
            </p>
            <div className="flex items-center gap-8 mt-12 mb-4">
              {callState === 'incoming' ? (
                <>
                  <button onClick={onDecline} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-transform hover:scale-105 shadow-lg shadow-red-500/30">
                    <PhoneOff className="w-7 h-7" />
                  </button>
                  <button onClick={onAccept} className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white hover:bg-emerald-600 transition-transform hover:scale-105 shadow-lg shadow-emerald-500/30">
                    <PhoneCall className="w-7 h-7" />
                  </button>
                </>
              ) : (
                <button onClick={onEnd} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-transform hover:scale-105 shadow-lg shadow-red-500/30">
                  <PhoneOff className="w-7 h-7" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
