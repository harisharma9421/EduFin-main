'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  GraduationCap,
  Newspaper,
  Loader2,
  Sparkles,
  Award,
  RotateCcw,
  Download,
  FileText,
  ExternalLink,
  Mic,
  MicOff,
  PhoneOff,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '@/lib/store'
import { downloadHTMLReport, downloadPDFReport, type InterviewReport } from '@/lib/interviewReport'

type InterviewType = 'visa' | 'university'
type CallStatus = 'idle' | 'connecting' | 'live' | 'ending' | 'ended'

interface NewsItem {
  title: string
  link: string
  snippet?: string
  source?: string
  date?: string
}

interface TranscriptLine {
  role: 'assistant' | 'user'
  text: string
  ts: number
}

const COUNTRY_OPTIONS = [
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'Ireland',
  'Singapore',
  'Netherlands',
  'France',
]

export default function InterviewPrep() {
  const { profile } = useAppStore()

  // ---- track + country ----
  const [interviewType, setInterviewType] = useState<InterviewType>('visa')
  const [country, setCountry] = useState<string>(
    (profile.targetCountries && profile.targetCountries[0]) ||
      (Array.isArray(profile.targetCountry) ? profile.targetCountry[0] : '') ||
      'United States',
  )

  // ---- live news ----
  const [news, setNews] = useState<NewsItem[]>([])
  const [loadingNews, setLoadingNews] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingNews(true)
    const q =
      interviewType === 'visa'
        ? `${country} student visa F-1 interview slots updates Indian students 2026`
        : `${country} university admission interview tips Indian students 2026`
    fetch(`/api/news?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setNews(Array.isArray(d?.news) ? d.news.slice(0, 5) : [])
      })
      .catch(() => !cancelled && setNews([]))
      .finally(() => !cancelled && setLoadingNews(false))
    return () => {
      cancelled = true
    }
  }, [country, interviewType])

  // ---- vapi call ----
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [muted, setMuted] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [scoring, setScoring] = useState(false)
  const [report, setReport] = useState<InterviewReport | null>(null)
  const callStartRef = useRef<number>(0)
  const [elapsed, setElapsed] = useState(0)
  const vapiRef = useRef<any>(null)

  // Tick the elapsed timer while the call is live.
  useEffect(() => {
    if (callStatus !== 'live') return
    callStartRef.current = Date.now()
    const id = setInterval(() => setElapsed(Math.round((Date.now() - callStartRef.current) / 1000)), 500)
    return () => clearInterval(id)
  }, [callStatus])

  const profileForApi = useMemo(
    () => ({
      name: profile.name,
      undergrad_cgpa: profile.undergradCgpa,
      target_field: profile.targetField,
      target_degree: profile.targetDegree,
      target_countries: profile.targetCountries || profile.targetCountry,
      intake_target: profile.intakeTarget,
      years_experience: profile.yearsExperience,
      gre_score: (profile as any).gre_score,
      gmat_score: (profile as any).gmat_score,
      ielts_score: profile.ieltsScore,
      toefl_score: profile.toeflScore,
      target_university:
        (profile.dreamUniversities || [])[0] || (profile.targetUniversitiesList || [])[0] || '',
      funding_source: profile.fundingSource,
    }),
    [profile],
  )

  const startCall = async () => {
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY
    const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID
    if (!publicKey || !assistantId) {
      toast.error('Vapi keys missing — set NEXT_PUBLIC_VAPI_PUBLIC_KEY and NEXT_PUBLIC_VAPI_ASSISTANT_ID')
      return
    }

    setCallStatus('connecting')
    setReport(null)
    setTranscript([])

    try {
      // Lazy-load the SDK so the rest of the dashboard doesn't ship it.
      const { default: Vapi } = await import('@vapi-ai/web')
      const vapi = new Vapi(publicKey)
      vapiRef.current = vapi

      // Wire events. The SDK emits 'message' for transcript fragments,
      // 'call-start'/'call-end' for lifecycle, 'error' on anything bad.
      vapi.on('call-start', () => {
        setCallStatus('live')
        callStartRef.current = Date.now()
      })
      vapi.on('call-end', () => {
        setCallStatus('ended')
      })
      vapi.on('error', (e: any) => {
        console.error('[vapi] error', e)
        toast.error(e?.errorMsg || e?.message || 'Voice call failed')
        setCallStatus('idle')
      })
      vapi.on('message', (msg: any) => {
        if (msg?.type === 'transcript' && msg?.transcript) {
          // We only commit "final" transcripts so the UI doesn't churn on
          // every partial. 'role' is "assistant" or "user".
          if (msg.transcriptType === 'final') {
            setTranscript((prev) => [
              ...prev,
              { role: msg.role === 'assistant' ? 'assistant' : 'user', text: msg.transcript, ts: Date.now() },
            ])
          }
        }
      })

      // Start the call against the prebuilt assistant. We pass profile
      // values via Vapi's `assistantOverrides.variableValues` so the
      // system prompt's {{studentName}}, {{program}}, etc. are filled in.
      await vapi.start(assistantId, {
        variableValues: {
          studentName: profile.name || 'the candidate',
          university: profileForApi.target_university || `a ${country} university`,
          program: profile.targetField || profile.targetDegree || 'a graduate program',
          startDate: profile.intakeTarget || 'the upcoming intake',
          fundingSource: profile.fundingSource || 'self-funded with family support',
          country,
        },
      })
    } catch (e: any) {
      console.error('[vapi] start failed', e)
      toast.error(e?.message || 'Could not start the voice interview')
      setCallStatus('idle')
    }
  }

  const toggleMute = () => {
    if (!vapiRef.current) return
    const next = !muted
    try {
      vapiRef.current.setMuted(next)
      setMuted(next)
    } catch {
      /* ignore */
    }
  }

  const endCall = async () => {
    setCallStatus('ending')
    try {
      vapiRef.current?.stop()
    } catch {
      /* ignore */
    }
  }

  const restart = () => {
    try {
      vapiRef.current?.stop()
    } catch {
      /* ignore */
    }
    vapiRef.current = null
    setCallStatus('idle')
    setTranscript([])
    setReport(null)
    setMuted(false)
    setElapsed(0)
  }

  // After the call ends, if we have any user lines, score the transcript.
  useEffect(() => {
    if (callStatus !== 'ended') return
    if (report) return
    const userLines = transcript.filter((t) => t.role === 'user').length
    if (userLines === 0) return

    let cancelled = false
    setScoring(true)
    ;(async () => {
      try {
        // Pair each assistant question with the user's reply that follows.
        const qa: { q: string; a: string }[] = []
        let pendingQ = ''
        for (const line of transcript) {
          if (line.role === 'assistant') pendingQ = pendingQ ? `${pendingQ} ${line.text}` : line.text
          else if (line.role === 'user' && pendingQ) {
            qa.push({ q: pendingQ.trim(), a: line.text.trim() })
            pendingQ = ''
          }
        }
        if (pendingQ && qa.length === 0) qa.push({ q: pendingQ.trim(), a: '' })

        const res = await fetch('/api/interview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'score',
            interviewType,
            country,
            profile: profileForApi,
            qa: qa.length ? qa : transcript.map((t) => ({ q: t.role, a: t.text })),
          }),
        })
        const d = await res.json()
        if (cancelled) return
        if (d?.report) setReport(d.report as InterviewReport)
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message || 'Could not score the interview')
      } finally {
        if (!cancelled) setScoring(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus])

  const fmtElapsed = useMemo(() => {
    const m = Math.floor(elapsed / 60)
    const s = elapsed % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }, [elapsed])

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-6">
      {/* HERO */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden border"
        style={{
          borderColor: 'var(--border)',
          background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.85))',
          color: '#f8fafc',
        }}
      >
        <div
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-25 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)' }}
        />
        <div className="relative p-6 sm:p-8">
          <div className="text-[11px] uppercase tracking-widest font-bold" style={{ color: '#fcd34d' }}>
            Interview Prep
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">
            Practice with a real-time AI interviewer.
          </h1>
          <p className="text-sm mt-2 opacity-90 max-w-2xl">
            Pick a track — visa or university — and hop into a live voice room. We score the
            conversation when you hang up and hand you a professional report you can save as
            HTML or print to PDF.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <div
              className="inline-flex p-1 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              {(['visa', 'university'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setInterviewType(t)
                    if (callStatus !== 'idle') restart()
                  }}
                  disabled={callStatus !== 'idle'}
                  className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  style={{
                    background: interviewType === t ? '#f59e0b' : 'transparent',
                    color: interviewType === t ? '#0f172a' : '#e2e8f0',
                  }}
                >
                  {t === 'visa' ? <ShieldCheck className="w-3.5 h-3.5" /> : <GraduationCap className="w-3.5 h-3.5" />}
                  {t === 'visa' ? 'Visa interview' : 'University interview'}
                </button>
              ))}
            </div>

            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value)
                if (callStatus !== 'idle') restart()
              }}
              disabled={callStatus !== 'idle'}
              className="rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#f8fafc',
              }}
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c} value={c} style={{ color: '#0f172a' }}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      {/* NEWS STRIP */}
      <Card title={`Live updates · ${country}`} icon={Newspaper}>
        {loadingNews ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : news.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            No interview-related news found. Try another country.
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {news.map((n, i) => (
              <li key={i}>
                <a
                  href={n.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 rounded-xl p-3 transition-all"
                  style={{
                    background: 'var(--background-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(245,158,11,0.10)', color: '#d97706' }}
                  >
                    <Newspaper className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm leading-snug line-clamp-2" style={{ color: 'var(--foreground)' }}>
                      {n.title}
                    </div>
                    <div className="text-[11px] mt-1 truncate" style={{ color: 'var(--foreground-muted)' }}>
                      {n.source ||
                        (() => {
                          try {
                            return new URL(n.link).hostname
                          } catch {
                            return ''
                          }
                        })()}
                      {n.date ? ` · ${n.date}` : ''}
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* MAIN: idle / call / report */}
      <AnimatePresence mode="wait">
        {callStatus === 'idle' && !report && (
          <motion.div key="setup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card
              title={interviewType === 'visa' ? `${country} F-1 visa mock interview` : `${country} university mock interview`}
              icon={interviewType === 'visa' ? ShieldCheck : GraduationCap}
            >
              <p className="text-sm mb-4" style={{ color: 'var(--foreground-secondary)' }}>
                Click <span className="font-semibold">Start interview</span> and we'll connect
                you to <span className="font-semibold">Arjuna</span>, our AI interviewer. The
                conversation is over voice — speak as you would to a real consular officer or
                admissions panel.
                {interviewType === 'visa'
                  ? ' Be specific about your funding, ties to India, and post-study plans.'
                  : ' Be specific about your motivation, projects, and fit with the program.'}
              </p>
              <ul className="text-xs grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
                {[
                  ['Mic access', 'Allow microphone when prompted.'],
                  ['Quiet room', 'Background noise hurts transcription.'],
                  ['Speak naturally', 'Long, specific answers score higher.'],
                ].map(([h, b]) => (
                  <li
                    key={h}
                    className="rounded-xl p-3"
                    style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}
                  >
                    <div className="font-bold mb-0.5" style={{ color: 'var(--foreground)' }}>
                      {h}
                    </div>
                    <div style={{ color: 'var(--foreground-muted)' }}>{b}</div>
                  </li>
                ))}
              </ul>
              <button onClick={startCall} className="btn-primary inline-flex items-center gap-2">
                <PhoneCall className="w-4 h-4" />
                Start interview
              </button>
            </Card>
          </motion.div>
        )}

        {(callStatus === 'connecting' || callStatus === 'live' || callStatus === 'ending') && (
          <motion.div key="room" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card
              title="Interview Room"
              icon={Mic}
              right={
                <span
                  className="text-[11px] uppercase tracking-widest font-bold"
                  style={{ color: callStatus === 'live' ? '#10b981' : '#f59e0b' }}
                >
                  {callStatus === 'connecting'
                    ? '● Connecting'
                    : callStatus === 'live'
                    ? `● Live · ${fmtElapsed}`
                    : '● Ending'}
                </span>
              }
            >
              {/* Caller card */}
              <div
                className="rounded-2xl p-6 flex flex-col items-center text-center mb-4"
                style={{ background: '#0f172a', color: '#f8fafc' }}
              >
                <div className="relative mb-3">
                  <motion.div
                    animate={{
                      scale: callStatus === 'live' ? [1, 1.08, 1] : 1,
                      opacity: callStatus === 'live' ? [0.7, 1, 0.7] : 0.85,
                    }}
                    transition={{ repeat: Infinity, duration: 1.4 }}
                    className="w-24 h-24 rounded-full flex items-center justify-center"
                    style={{
                      background:
                        callStatus === 'live'
                          ? 'radial-gradient(circle, #f59e0b 0%, rgba(245,158,11,0.0) 70%)'
                          : 'rgba(245,158,11,0.18)',
                    }}
                  >
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold"
                      style={{ background: '#f59e0b', color: '#0f172a' }}
                    >
                      A
                    </div>
                  </motion.div>
                </div>
                <div className="font-bold text-lg">Arjuna</div>
                <div className="text-xs opacity-75">
                  AI {interviewType === 'visa' ? 'Visa Officer' : 'Admissions Interviewer'} · {country}
                </div>

                <div className="flex items-center gap-3 mt-5">
                  <button
                    onClick={toggleMute}
                    disabled={callStatus !== 'live'}
                    className="w-12 h-12 rounded-full flex items-center justify-center disabled:opacity-50"
                    style={{
                      background: muted ? '#dc2626' : 'rgba(255,255,255,0.10)',
                      color: '#f8fafc',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                    title={muted ? 'Unmute' : 'Mute'}
                  >
                    {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={endCall}
                    className="px-4 h-12 rounded-full flex items-center gap-2 font-semibold"
                    style={{ background: '#dc2626', color: '#f8fafc' }}
                  >
                    <PhoneOff className="w-4 h-4" /> End interview
                  </button>
                </div>
              </div>

              {/* Live transcript */}
              <div
                className="rounded-xl p-3 max-h-80 overflow-y-auto"
                style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}
              >
                {transcript.length === 0 ? (
                  <div className="py-6 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>
                    {callStatus === 'connecting'
                      ? 'Connecting to Arjuna…'
                      : 'Arjuna will start in a moment. Speak when you hear the question.'}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {transcript.map((line, i) => (
                      <li key={i} className={`flex ${line.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className="max-w-[80%] rounded-2xl px-3 py-2 text-sm"
                          style={{
                            background: line.role === 'user' ? '#f59e0b' : 'var(--surface)',
                            color: line.role === 'user' ? '#0f172a' : 'var(--foreground)',
                            border: line.role === 'assistant' ? '1px solid var(--border)' : 'none',
                          }}
                        >
                          <div
                            className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                            style={{ color: line.role === 'user' ? '#78350f' : 'var(--foreground-muted)' }}
                          >
                            {line.role === 'user' ? 'You' : 'Arjuna'}
                          </div>
                          {line.text}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {callStatus === 'ended' && (scoring || !report) && (
          <motion.div key="scoring" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card title="Scoring your interview" icon={Sparkles}>
              <div className="py-8 flex flex-col items-center gap-3">
                {scoring ? (
                  <>
                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                    <div className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                      Analysing the conversation and grading every answer…
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-7 h-7" style={{ color: '#f59e0b' }} />
                    <div className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                      The call ended before we caught any answers. Click below to try again.
                    </div>
                    <button onClick={restart} className="btn-secondary text-sm inline-flex items-center gap-2 mt-2">
                      <RotateCcw className="w-4 h-4" /> Restart
                    </button>
                  </>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {report && (
          <motion.div key="report" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card
              title="Your interview report"
              icon={Award}
              right={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      downloadHTMLReport({
                        studentName: profile.name || 'Student',
                        interviewType,
                        country,
                        university: profileForApi.target_university,
                        program: profile.targetField || profile.targetDegree,
                        date: new Date().toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        }),
                        report,
                      })
                    }
                    className="btn-secondary text-xs inline-flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> HTML
                  </button>
                  <button
                    onClick={() =>
                      downloadPDFReport({
                        studentName: profile.name || 'Student',
                        interviewType,
                        country,
                        university: profileForApi.target_university,
                        program: profile.targetField || profile.targetDegree,
                        date: new Date().toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        }),
                        report,
                      })
                    }
                    className="btn-secondary text-xs inline-flex items-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5" /> PDF
                  </button>
                  <button onClick={restart} className="btn-secondary text-xs inline-flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5" /> Restart
                  </button>
                </div>
              }
            >
              {/* Headline + verdict */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                <div className="card text-center" style={{ background: 'var(--background-secondary)' }}>
                  <div className="text-[11px] uppercase tracking-widest font-bold" style={{ color: 'var(--foreground-muted)' }}>
                    Overall
                  </div>
                  <div className="text-4xl font-bold mt-1" style={{ color: '#0f172a' }}>
                    {Math.round(report.overallScore)}
                    <span className="text-base text-foreground-muted">/100</span>
                  </div>
                  <div className="text-xs font-semibold mt-1" style={{ color: '#b45309' }}>
                    Grade {report.grade}
                  </div>
                </div>
                <div className="md:col-span-2 card" style={{ background: 'var(--background-secondary)' }}>
                  <div className="text-[11px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--foreground-muted)' }}>
                    Verdict
                  </div>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                    {report.summary}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-5">
                {(['clarity', 'confidence', 'relevance', 'depth', 'intent'] as const).map((k) => {
                  const v = (report.rubric as any)[k] as number
                  return (
                    <div key={k} className="grid grid-cols-[110px_1fr_50px] gap-3 items-center">
                      <div className="text-[11px] uppercase tracking-widest font-bold" style={{ color: 'var(--foreground-muted)' }}>
                        {k}
                      </div>
                      <div className="h-2 rounded-full" style={{ background: 'var(--background-secondary)' }}>
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0, v))}%`,
                            background: v >= 80 ? '#0f766e' : v >= 60 ? '#a16207' : '#b91c1c',
                          }}
                        />
                      </div>
                      <div
                        className="text-xs font-bold text-right"
                        style={{ color: v >= 80 ? '#0f766e' : v >= 60 ? '#a16207' : '#b91c1c' }}
                      >
                        {Math.round(v)}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                <Pill title="Strengths" items={report.strengths} accent="#047857" />
                <Pill title="Weaknesses" items={report.weaknesses} accent="#b91c1c" />
                {report.redFlags?.length ? <Pill title="Red flags" items={report.redFlags} accent="#b45309" /> : null}
                {report.nextSteps?.length ? <Pill title="Next steps" items={report.nextSteps} accent="#1d4ed8" /> : null}
              </div>

              <div className="space-y-3">
                {report.perAnswer.map((qa, i) => {
                  const color = qa.score >= 80 ? '#0f766e' : qa.score >= 60 ? '#a16207' : '#b91c1c'
                  return (
                    <div key={i} className="card" style={{ background: 'var(--background-secondary)' }}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="font-semibold text-sm flex-1" style={{ color: 'var(--foreground)' }}>
                          {i + 1}. {qa.q}
                        </div>
                        <div
                          className="px-2.5 py-1 rounded-full text-xs font-bold text-white flex-shrink-0"
                          style={{ background: color }}
                        >
                          {Math.round(qa.score)}
                        </div>
                      </div>
                      <div
                        className="text-sm pl-3 border-l-2"
                        style={{
                          color: 'var(--foreground-secondary)',
                          borderColor: 'var(--border)',
                        }}
                      >
                        {qa.a || '— no answer recorded —'}
                      </div>
                      <div className="text-sm mt-2" style={{ color: 'var(--foreground)' }}>
                        <span className="font-bold" style={{ color: '#b45309' }}>
                          Feedback:
                        </span>{' '}
                        {qa.feedback}
                      </div>
                      {qa.improvedAnswer && (
                        <div
                          className="rounded-lg p-3 mt-2 text-sm"
                          style={{
                            background: 'rgba(245,158,11,0.10)',
                            border: '1px solid rgba(245,158,11,0.25)',
                            color: 'var(--foreground)',
                          }}
                        >
                          <span className="font-bold" style={{ color: '#b45309' }}>
                            Suggested answer:
                          </span>{' '}
                          {qa.improvedAnswer}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Acknowledgement */}
              <div
                className="rounded-xl p-3 mt-5 inline-flex items-center gap-2 text-xs"
                style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46' }}
              >
                <CheckCircle2 className="w-4 h-4" /> Report ready. Save it as HTML or PDF using the buttons above.
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Card({
  title,
  icon: Icon,
  children,
  right,
}: {
  title: string
  icon: any
  children: any
  right?: any
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.10)', color: '#b45309' }}
          >
            <Icon className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
            {title}
          </h2>
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function Pill({ title, items, accent }: { title: string; items?: string[]; accent: string }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: 'var(--background-secondary)',
        borderLeft: `4px solid ${accent}`,
        border: '1px solid var(--border)',
      }}
    >
      <div className="text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: 'var(--foreground-muted)' }}>
        {title}
      </div>
      <ul className="text-sm space-y-1" style={{ color: 'var(--foreground)' }}>
        {(items && items.length ? items : ['—']).map((s, i) => (
          <li key={i} className="flex items-start gap-2">
            <span style={{ color: accent }}>•</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
