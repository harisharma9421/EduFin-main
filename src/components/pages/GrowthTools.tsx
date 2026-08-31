'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { 
  PenTool, Mail, Search, Send, FileText, 
  Code, Copy, Check, Loader2, Sparkles,
  Globe, Share2
} from 'lucide-react'

export default function GrowthTools() {
  const { profile } = useAppStore()
  const [activeTab, setActiveTab] = useState<'blog' | 'newsletter'>('blog')
  const [topic, setTopic] = useState('How to get US student visa in 2025')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generateBlog = async () => {
    setLoading(true)
    setResult(null)
    try {
      // 1. Simulate Serper search
      const searchRes = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: topic })
      })
      const searchData = await searchRes.json()
      
      // 2. Use Groq to write blog
      const groqRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Write a 1200-word SEO optimized blog post about "${topic}" using these search results as context: ${JSON.stringify(searchData.results)}. 
          Format with clean HTML using H2, H3 tags, bullet points, and a professional CTA at the end for EduFinAI.`,
          profile: { name: 'Admin' },
          conversationHistory: []
        })
      })

      const reader = groqRes.body?.getReader()
      const decoder = new TextDecoder()
      let content = ''
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          content += decoder.decode(value, { stream: true })
        }
      }
      setResult(content)
    } catch (e) {
      setResult('Error generating blog post. Please try again.')
    }
    setLoading(false)
  }

  const generateNewsletter = async () => {
    setLoading(true)
    setResult(null)
    try {
      const groqRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Write a weekly personalized newsletter for a student named ${profile.name} who wants to study ${profile.targetProgram} in ${profile.targetCountry.join(', ')}. 
          Include a friendly mentor-like intro, one upcoming deadline, a loan tip for ${profile.budgetLakhs}L budget, and one relevant scholarship. 
          Format as clean HTML for an email template.`,
          profile,
          conversationHistory: []
        })
      })

      const reader = groqRes.body?.getReader()
      const decoder = new TextDecoder()
      let content = ''
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          content += decoder.decode(value, { stream: true })
        }
      }
      setResult(content)
    } catch (e) {
      setResult('Error generating newsletter. Please try again.')
    }
    setLoading(false)
  }

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          <Sparkles className="w-6 h-6" style={{ color: 'var(--primary)' }} />
          AI Content Engine
        </h2>
        <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>Automated blog and newsletter generation for student acquisition.</p>
      </div>

      <div className="flex gap-2 p-1 bg-[#161725] rounded-xl w-fit border border-white/5">
        <button onClick={() => { setActiveTab('blog'); setResult(null) }}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'blog' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-white/30 hover:text-white/50'}`}>
          <div className="flex items-center gap-2"><PenTool className="w-4 h-4" /> Blog Generator</div>
        </button>
        <button onClick={() => { setActiveTab('newsletter'); setResult(null) }}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'newsletter' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-white/30 hover:text-white/50'}`}>
          <div className="flex items-center gap-2"><Mail className="w-4 h-4" /> Newsletter Builder</div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Side */}
        <div className="space-y-4">
          <div className="card space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/30 uppercase tracking-widest">
                {activeTab === 'blog' ? 'Blog Topic' : 'Newsletter Focus'}
              </label>
              {activeTab === 'blog' ? (
                <input className="input-field" placeholder="Enter blog topic..." value={topic} onChange={e => setTopic(e.target.value)} />
              ) : (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground-muted)]">Target Country:</span>
                    <span className="text-[var(--foreground)]">{profile.targetCountry.join(', ') || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground-muted)]">Program:</span>
                    <span className="text-[var(--foreground)]">{profile.targetProgram || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground-muted)]">Budget:</span>
                    <span className="text-[var(--foreground)]">₹{profile.budgetLakhs}L</span>
                  </div>
                </div>
              )}
            </div>
            <button onClick={activeTab === 'blog' ? generateBlog : generateNewsletter} disabled={loading}
              className="btn-primary w-full py-4 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading ? 'Generating Content...' : activeTab === 'blog' ? 'Write SEO Blog' : 'Build Personalized Newsletter'}
            </button>
          </div>

          <div className="card">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              <Globe className="w-4 h-4 text-indigo-400" /> Search Context
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground-muted)' }}>
              Our AI content engine uses real-time search data from Serper API to ensure all generated content is up-to-date and SEO-friendly.
            </p>
          </div>
        </div>

        {/* Output Side */}
        <div className="space-y-4">
          <div className="card min-h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
              <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Generated Output</h3>
              {result && (
                <div className="flex gap-2">
                  <button onClick={copyToClipboard} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {!result && !loading ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-20">
                  <FileText className="w-16 h-16 mb-4" />
                  <p className="text-sm">Content will appear here after generation</p>
                </div>
              ) : result ? (
                <div className="prose prose-invert prose-sm max-w-none" style={{ color: 'var(--foreground-secondary)' }}
                  dangerouslySetInnerHTML={{ __html: result.replace(/```html|```/g, '') }} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-10 space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-sm text-indigo-400 animate-pulse">Groq LLM is composing your content...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
