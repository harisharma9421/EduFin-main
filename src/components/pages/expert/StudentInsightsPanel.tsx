'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Send, Bot, User, BarChart2, Loader2, Sparkles, BookOpen, GraduationCap, MapPin, DollarSign, Target, Trash2 } from 'lucide-react'
import { StudentProfile } from '@/lib/types'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import toast from 'react-hot-toast'

interface StudentInsightsPanelProps {
  student: StudentProfile
  onClose: () => void
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function StudentInsightsPanel({ student, onClose }: StudentInsightsPanelProps) {
  const [messages, setMessages] = useState<{role: 'user' | 'bot', content: string, graph?: any}[]>([
    { role: 'bot', content: `Hi! I'm the AI Analyst for ${student.name}. I can analyze their profile, predict admission chances, or plot their scores!` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (text: string = input) => {
    if (!text.trim() || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const res = await fetch('/api/student-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, student })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch')
      
      setMessages(prev => [...prev, { role: 'bot', content: data.response, graph: data.graph }])
    } catch (err: any) {
      toast.error(err.message)
      setMessages(prev => [...prev, { role: 'bot', content: 'Sorry, I encountered an error analyzing the data.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleClearChat = () => {
    setMessages([{ role: 'bot', content: `Hi! I'm the AI Analyst for ${student.name}. I can analyze their profile, predict admission chances, or plot their scores!` }])
  }

  const renderGraph = (graph: any) => {
    if (!graph || !graph.data || graph.data.length === 0) return null
    
    if (graph.type === 'area' || graph.type === 'bar' || graph.type === 'line') {
      return (
        <div className="h-56 w-full mt-4 bg-background rounded-xl p-3 border border-border shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={graph.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey={graph.xAxisKey} tick={{ fontSize: 11, fill: 'var(--foreground-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--foreground-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }} 
                itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
              />
              <Area type="monotone" dataKey={graph.dataKey} stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )
    }
    
    if (graph.type === 'pie') {
      return (
        <div className="h-56 w-full mt-4 bg-background rounded-xl p-3 border border-border flex items-center justify-center shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={graph.data} dataKey={graph.dataKey} nameKey={graph.xAxisKey} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="none">
                {graph.data.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )
    }
    
    return null
  }

  // Filter out empty cards
  const cgpa = student.cgpa || student.undergradCgpa
  const gre = student.greScore || student.gmatScore
  const budget = student.budgetLakhs && student.budgetLakhs !== 0 ? student.budgetLakhs + ' Lakhs' : null
  const program = student.targetProgram
  const destinations = student.targetCountry && student.targetCountry.length > 0 ? student.targetCountry : null

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      className="fixed inset-y-0 right-0 w-full max-w-2xl bg-background border-l border-border shadow-2xl z-50 flex flex-col"
    >
      <div className="p-4 border-b border-border flex justify-between items-center bg-card">
        <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
          <BarChart2 className="w-5 h-5 text-primary" /> Student Insights
        </h2>
        <button 
          onClick={onClose} 
          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors font-bold text-sm flex items-center gap-1"
          title="Close Panel"
        >
          <X className="w-4 h-4" /> Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-gray-50/50">
        
        {/* Dynamic Dashboard Grid - Only shows if data exists */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          {cgpa && (
            <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
              <div className="text-xs text-foreground-muted uppercase tracking-wider font-bold mb-1 flex items-center gap-1"><BookOpen className="w-3 h-3"/> CGPA</div>
              <div className="text-2xl font-bold text-foreground">{cgpa}</div>
            </div>
          )}
          
          {gre && (
            <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
              <div className="text-xs text-foreground-muted uppercase tracking-wider font-bold mb-1 flex items-center gap-1"><Target className="w-3 h-3"/> GRE/GMAT</div>
              <div className="text-2xl font-bold text-foreground">{gre}</div>
            </div>
          )}
          
          {budget && (
            <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
              <div className="text-xs text-foreground-muted uppercase tracking-wider font-bold mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3"/> Budget</div>
              <div className="text-2xl font-bold text-foreground">₹{budget}L</div>
            </div>
          )}
          
          {(program || destinations) && (
            <div className="bg-card p-4 rounded-xl border border-border shadow-sm sm:col-span-3 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
               {program && (
                 <div>
                   <div className="text-xs text-foreground-muted uppercase tracking-wider font-bold mb-1 flex items-center gap-1"><GraduationCap className="w-3 h-3"/> Target Program</div>
                   <div className="text-sm font-bold text-foreground">{program}</div>
                 </div>
               )}
               {destinations && (
                 <div className="sm:text-right">
                   <div className="text-xs text-foreground-muted uppercase tracking-wider font-bold mb-1 flex items-center sm:justify-end gap-1"><MapPin className="w-3 h-3"/> Destinations</div>
                   <div className="text-sm font-bold text-foreground">{destinations.join(', ')}</div>
                 </div>
               )}
            </div>
          )}
        </div>

        {/* AI Chat Area - Clean solid colors, no glass effect */}
        <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col h-[550px] overflow-hidden">
          <div className="p-3 border-b border-border bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-bold text-sm text-foreground">AI Profile Analyst</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleClearChat} className="p-1.5 text-foreground-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors" title="Clear Chat">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="p-1.5 text-foreground-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors" title="Close Analyst">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-white">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-primary' : 'bg-gray-100 border border-border'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-gray-600" />}
                </div>
                <div className={`max-w-[85%] rounded-2xl p-3.5 text-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-sm shadow-sm' : 'bg-gray-50 text-foreground border border-border rounded-tl-sm'}`}>
                  <p className="leading-relaxed">{msg.content}</p>
                  {msg.graph && renderGraph(msg.graph)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 border border-border flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-gray-600" />
                </div>
                <div className="bg-gray-50 border border-border rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t border-border bg-gray-50">
            {/* Quick Suggestions */}
            {messages.length <= 1 && !loading && (
              <div className="flex flex-wrap gap-2 mb-3">
                <button onClick={() => handleSend("Analyze Profile Strengths")} className="text-[11px] bg-white border border-border px-3 py-1.5 rounded-full text-foreground hover:bg-gray-100 transition-colors shadow-sm font-medium">
                  Analyze Profile Strengths
                </button>
                <button onClick={() => handleSend("Predict Admission Chances")} className="text-[11px] bg-white border border-border px-3 py-1.5 rounded-full text-foreground hover:bg-gray-100 transition-colors shadow-sm font-medium">
                  Predict Admission Chances
                </button>
                <button onClick={() => handleSend("Suggest Universities")} className="text-[11px] bg-white border border-border px-3 py-1.5 rounded-full text-foreground hover:bg-gray-100 transition-colors shadow-sm font-medium">
                  Suggest Universities
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 bg-white border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
                placeholder="Ask a question or request a graph..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <button 
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="bg-primary hover:bg-blue-600 text-white p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  )
}
