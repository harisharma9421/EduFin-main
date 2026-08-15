'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { Shield, Send, CheckCircle, User, Bot, Loader2 } from 'lucide-react'

const countries = [
  { id: 'US', name: 'US F-1 Visa', flag: '🇺🇸' },
  { id: 'UK', name: 'UK Student Visa', flag: '🇬🇧' },
  { id: 'Canada', name: 'Canada Study Permit', flag: '🇨🇦' },
  { id: 'Schengen', name: 'Schengen Student', flag: '🇪🇺' },
]

const visaQuestions: Record<string, string[]> = {
  US: [
    "Why do you want to study in the United States?",
    "Which university have you been accepted to and what program?",
    "How will you finance your education?",
    "What are your plans after completing your degree?",
    "Do you have any relatives in the United States?",
    "Why did you choose this particular university?",
    "What is your current occupation?",
    "Have you traveled abroad before?",
    "What is your CGPA and GRE score?",
    "How does this program align with your career goals?",
  ],
  UK: [
    "Why have you chosen to study in the UK?",
    "Tell me about your course and university.",
    "How are you funding your studies?",
    "What are your plans after your course ends?",
    "Do you have family in the UK?",
    "Why not study this course in your home country?",
    "Where will you be living during your studies?",
    "Have you visited the UK before?",
    "What is your English language proficiency?",
    "How long is your course?",
  ],
  Canada: [
    "Why do you want to study in Canada?",
    "Tell me about your program and institution.",
    "How will you pay for your education and living expenses?",
    "What will you do after completing your studies?",
    "Do you have any ties to Canada?",
    "Have you looked at similar programs in India?",
    "Where will you live in Canada?",
    "What is your academic background?",
    "Do you plan to work while studying?",
    "Why should we believe you will return to India?",
  ],
  Schengen: [
    "Why did you choose this country for your studies?",
    "Describe your study program.",
    "How will you finance your stay?",
    "What are your plans after graduation?",
    "Do you have contacts in Europe?",
    "What is your accommodation arrangement?",
    "Have you applied to universities in other countries?",
    "What language will your courses be in?",
    "Do you have travel insurance?",
    "When does your program start and end?",
  ],
}

export default function VisaSimulator() {
  const { profile, addXP, addBadge } = useAppStore()
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [answer, setAnswer] = useState('')
  const [conversation, setConversation] = useState<{ role: 'officer' | 'student'; text: string; feedback?: string; suggestion?: string; score?: number }[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const [evaluating, setEvaluating] = useState(false)

  const startInterview = (country: string) => {
    setSelectedCountry(country)
    setCurrentQ(0)
    setConversation([{ role: 'officer', text: visaQuestions[country][0] }])
    setIsComplete(false)
  }

  const submitAnswer = async () => {
    if (!answer.trim() || !selectedCountry || evaluating) return
    const questions = visaQuestions[selectedCountry]
    setEvaluating(true)

    let score = 5
    let feedback = ''
    let suggestion = ''

    try {
      const res = await fetch('/api/visa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: selectedCountry,
          question: questions[currentQ],
          answer: answer,
          profile: {
            currentUniversity: profile.currentUniversity,
            targetProgram: profile.targetProgram,
            cgpa: profile.cgpa,
          },
          questionNumber: currentQ + 1,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        score = data.score
        feedback = data.feedback
        suggestion = data.suggestion
      }
    } catch {
      // Fallback scoring
      const wordCount = answer.trim().split(/\s+/).length
      score = wordCount < 10 ? 3 : wordCount > 100 ? 6 : 7
      feedback = wordCount < 10 ? 'Too brief. Elaborate more.' : 'Decent answer.'
    }

    const newConversation = [
      ...conversation,
      { role: 'student' as const, text: answer, score, feedback, suggestion },
    ]

    if (currentQ + 1 < questions.length) {
      newConversation.push({ role: 'officer' as const, text: questions[currentQ + 1] })
      setCurrentQ(currentQ + 1)
    } else {
      setIsComplete(true)
      addXP(100)
      addBadge('Visa Ready')
    }

    setConversation(newConversation)
    setAnswer('')
    setEvaluating(false)
  }

  const overallScore = conversation.filter(c => c.score).reduce((a, c) => a + (c.score || 0), 0) /
    Math.max(1, conversation.filter(c => c.score).length)

  if (!selectedCountry) {
    return (
      <div className="max-w-4xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <Shield className="w-6 h-6" style={{ color: 'var(--primary)' }} />
            Visa Interview Simulator
          </h2>
          <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>
            Practice with an AI visa officer. Real-time scoring and feedback.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {countries.map(c => (
            <motion.button key={c.id} onClick={() => startInterview(c.id)}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="card glass glass-hover text-left">
              <div className="text-4xl mb-3">{c.flag}</div>
              <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{c.name}</div>
              <div className="text-sm mt-1" style={{ color: 'var(--foreground-secondary)' }}>
                10 questions • AI-powered scoring • Real-time tips
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          <Shield className="w-5 h-5" style={{ color: 'var(--primary)' }} />
          {countries.find(c => c.id === selectedCountry)?.flag} {countries.find(c => c.id === selectedCountry)?.name}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Q{currentQ + 1}/10</span>
          <button onClick={() => { setSelectedCountry(null); setConversation([]) }}
            className="btn-secondary text-xs">Exit</button>
        </div>
      </div>

      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${((currentQ + (isComplete ? 1 : 0)) / 10) * 100}%` }} />
      </div>

      <div className="card space-y-4 max-h-[500px] overflow-y-auto" style={{ padding: '1.5rem' }}>
        <AnimatePresence>
          {conversation.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className={`flex gap-3 ${msg.role === 'student' ? 'justify-end' : ''}`}>
                {msg.role === 'officer' && (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(239,68,68,0.15)' }}>
                    <Bot className="w-4 h-4" style={{ color: '#ef4444' }} />
                  </div>
                )}
                <div className={msg.role === 'officer' ? 'chat-bubble-ai' : 'chat-bubble-user'}>
                  <div className="text-sm">{msg.text}</div>
                </div>
                {msg.role === 'student' && (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--gradient-primary)' }}>
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              {msg.feedback && (
                <div className="ml-11 mt-2 p-3 rounded-lg text-xs space-y-1"
                  style={{
                    background: (msg.score || 0) >= 7 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${(msg.score || 0) >= 7 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    color: 'var(--foreground-secondary)'
                  }}>
                  <div>{msg.feedback}</div>
                  {msg.suggestion && <div style={{ color: 'var(--info)' }}>💡 {msg.suggestion}</div>}
                  <span className="font-bold" style={{
                    color: (msg.score || 0) >= 7 ? '#10b981' : (msg.score || 0) >= 5 ? '#f59e0b' : '#ef4444'
                  }}>{msg.score}/10</span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {!isComplete ? (
        <div className="flex gap-3">
          <input className="input-field flex-1" placeholder="Type your answer..."
            value={answer} onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitAnswer()} disabled={evaluating} />
          <button onClick={submitAnswer} className="btn-primary flex items-center gap-2" disabled={evaluating || !answer.trim()}>
            {evaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {evaluating ? 'Evaluating...' : 'Answer'}
          </button>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card card-gradient text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--success)' }} />
          <div className="text-xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Interview Complete! 🎉</div>
          <div className="text-3xl font-bold mb-3" style={{
            color: overallScore >= 7 ? '#10b981' : overallScore >= 5 ? '#f59e0b' : '#ef4444'
          }}>{overallScore.toFixed(1)}/10</div>
          <p className="text-sm mb-4" style={{ color: 'var(--foreground-secondary)' }}>
            {overallScore >= 7 ? 'Great performance! You are well-prepared for your visa interview.' :
             overallScore >= 5 ? 'Good effort! Practice the flagged questions for improvement.' :
             'Keep practicing! Focus on clearer, more detailed responses.'}
          </p>
          <div className="badge badge-success">+100 XP • Visa Ready Badge Earned!</div>
        </motion.div>
      )}
    </div>
  )
}
