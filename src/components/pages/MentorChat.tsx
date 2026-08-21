'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { MessageCircle, Send, Bot, User, Sparkles, Trash2, Loader2 } from 'lucide-react'

const quickPrompts = [
  "Which universities should I target with my profile?",
  "How do I improve my Dream Score?",
  "What's the best loan option for studying in the US?",
  "Help me plan my application timeline for Fall 2026",
  "What GRE score do I need for CMU CS?",
  "Compare studying in US vs Canada for CS",
]

export default function MentorChat() {
  const { profile, chatMessages, addChatMessage, clearChat } = useAppStore()
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages, streamingContent])

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || isTyping) return

    addChatMessage({ id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() })
    setInput('')
    setIsTyping(true)
    setStreamingContent('')

    try {
      const conversationHistory = chatMessages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          profile: {
            name: profile.name,
            cgpa: profile.cgpa,
            greScore: profile.greScore,
            ieltsScore: profile.ieltsScore,
            workExpYears: profile.workExpYears,
            targetCountry: profile.targetCountry,
            targetProgram: profile.targetProgram,
            budgetLakhs: profile.budgetLakhs,
            savingsLakhs: profile.savingsLakhs,
            currentDegree: profile.currentDegree,
            currentUniversity: profile.currentUniversity,
            dreamScore: profile.dreamScore,
            careerInterest: profile.careerInterest,
          },
          conversationHistory,
        }),
      })

      if (!res.ok) throw new Error('API error')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullContent += chunk
        setStreamingContent(fullContent)
      }

      addChatMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullContent,
        timestamp: new Date(),
      })
      setStreamingContent('')
    } catch (error) {
      console.error('Chat error:', error)
      addChatMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      })
    }
    setIsTyping(false)
  }

  return (
    <div className="max-w-4xl h-[calc(100vh-160px)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <MessageCircle className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            AI Mentor Chat
          </h2>
          <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
            Your AI-powered study abroad advisor — real-time intelligent responses.
          </p>
        </div>
        {chatMessages.length > 0 && (
          <button onClick={clearChat} className="btn-secondary text-xs flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 card" style={{ padding: '1rem' }}>
        {chatMessages.length === 0 && !streamingContent && (
          <div className="text-center py-12">
            <Bot className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--foreground-muted)' }} />
            <div className="text-lg font-medium mb-2" style={{ color: 'var(--foreground)' }}>Hi {profile.name || 'there'}! 👋</div>
            <p className="text-sm mb-6" style={{ color: 'var(--foreground-secondary)' }}>
              I&apos;m your AI mentor. Ask me anything about studying abroad, loans, SOPs, or career planning.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {quickPrompts.map(p => (
                <button key={p} onClick={() => sendMessage(p)}
                  className="text-xs px-3 py-2 rounded-lg transition-all hover:border-[var(--primary)]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground-secondary)' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg) => (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--gradient-primary)' }}>
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
              <div className="text-sm whitespace-pre-line">{msg.content}</div>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--gradient-warm)' }}>
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </motion.div>
        ))}

        {/* Streaming content */}
        {streamingContent && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--gradient-primary)' }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="chat-bubble-ai">
              <div className="text-sm whitespace-pre-line">{streamingContent}</div>
            </div>
          </div>
        )}

        {isTyping && !streamingContent && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="chat-bubble-ai">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--primary)' }} />
                <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <input className="input-field flex-1" placeholder="Ask your AI mentor anything..."
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()} disabled={isTyping} />
        <button onClick={() => sendMessage()} className="btn-primary flex items-center gap-2" disabled={!input.trim() || isTyping}>
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
