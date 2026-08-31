'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { Brain, Sparkles, TrendingUp, MapPin, DollarSign, ChevronRight } from 'lucide-react'

const careerPaths = [
  {
    title: 'AI / Machine Learning Engineer',
    icon: '🤖',
    description: 'Build intelligent systems and models that learn from data',
    countries: ['US', 'Canada', 'UK'],
    avgSalary: '$145,000',
    growth: '+35% (5yr)',
    skills: ['Python', 'TensorFlow', 'NLP', 'Deep Learning'],
    universities: ['Stanford', 'CMU', 'MIT', 'UofT', 'ETH Zurich'],
    color: '#6366f1',
  },
  {
    title: 'Product Manager (Tech)',
    icon: '📱',
    description: 'Lead product strategy and execution at tech companies',
    countries: ['US', 'UK', 'Singapore'],
    avgSalary: '$135,000',
    growth: '+25% (5yr)',
    skills: ['Product Strategy', 'Analytics', 'UX', 'Agile'],
    universities: ['Stanford', 'MIT Sloan', 'ISB', 'Oxford'],
    color: '#06b6d4',
  },
  {
    title: 'Management Consultant',
    icon: '📊',
    description: 'Advise Fortune 500 companies on strategy and operations',
    countries: ['US', 'UK', 'India'],
    avgSalary: '$120,000',
    growth: '+18% (5yr)',
    skills: ['Strategy', 'Financial Analysis', 'Leadership', 'Communication'],
    universities: ['IIM-A', 'ISB', 'London Business School', 'INSEAD'],
    color: '#f59e0b',
  },
  {
    title: 'Data Scientist',
    icon: '📈',
    description: 'Extract insights from complex datasets to drive decisions',
    countries: ['US', 'Canada', 'Germany'],
    avgSalary: '$125,000',
    growth: '+30% (5yr)',
    skills: ['Statistics', 'Python', 'SQL', 'Visualization'],
    universities: ['Georgia Tech', 'UIUC', 'UC Berkeley', 'UBC'],
    color: '#10b981',
  },
  {
    title: 'Quantitative Analyst',
    icon: '💹',
    description: 'Apply mathematical models to financial markets',
    countries: ['US', 'UK', 'Singapore'],
    avgSalary: '$180,000',
    growth: '+22% (5yr)',
    skills: ['Mathematics', 'C++', 'Stochastic Calculus', 'Risk Modeling'],
    universities: ['MIT', 'Princeton', 'Imperial College', 'CMU'],
    color: '#ec4899',
  },
  {
    title: 'Cybersecurity Engineer',
    icon: '🔒',
    description: 'Protect organizations from digital threats and attacks',
    countries: ['US', 'UK', 'Australia'],
    avgSalary: '$115,000',
    growth: '+28% (5yr)',
    skills: ['Network Security', 'Penetration Testing', 'Cloud Security', 'Forensics'],
    universities: ['Georgia Tech', 'CMU', 'Purdue', 'UNSW'],
    color: '#8b5cf6',
  },
]

export default function CareerNavigator() {
  const { profile } = useAppStore()
  const [selectedPath, setSelectedPath] = useState<number | null>(null)
  const [aiInsight, setAiInsight] = useState('')
  const [loading, setLoading] = useState(false)

  const generateInsight = (pathIndex: number) => {
    setLoading(true)
    setSelectedPath(pathIndex)
    const path = careerPaths[pathIndex]
    // Simulated AI response
    setTimeout(() => {
      setAiInsight(
        `Based on your profile (${profile.currentDegree} from ${profile.currentUniversity || 'your university'}, CGPA: ${profile.cgpa}, ${profile.workExpYears}yr exp), **${path.title}** is a ${profile.cgpa >= 8 ? 'strong' : 'good'} fit for you.\n\n` +
        `**Why this works:**\n` +
        `• Your ${profile.careerInterest || 'technical'} interest aligns well with this path\n` +
        `• ${profile.targetCountry.length > 0 ? profile.targetCountry.join(', ') : 'US, Canada'} has strong demand for this role\n` +
        `• Expected salary: ${path.avgSalary}/year → ROI breakeven in ~${profile.budgetLakhs > 40 ? '3-4' : '2-3'} years\n\n` +
        `**Recommended universities:** ${path.universities.slice(0, 3).join(', ')}\n\n` +
        `**Next step:** Start with GRE prep if not done, then shortlist 5 universities across Reach/Match/Safety tiers.`
      )
      setLoading(false)
    }, 1500)
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Brain className="w-6 h-6" style={{ color: 'var(--primary)' }} />
          AI Career Navigator
        </h2>
        <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>
          Discover the best career paths based on your profile, interests, and market trends.
        </p>
      </div>

      {/* Career Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {careerPaths.map((path, i) => (
          <motion.div key={path.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => generateInsight(i)}
            className={`card glass cursor-pointer transition-all ${selectedPath === i ? 'ring-2' : ''}`}
            style={{
              borderColor: selectedPath === i ? path.color : undefined,
              boxShadow: selectedPath === i ? `0 0 20px ${path.color}30` : undefined
            }}>
            <div className="text-3xl mb-3">{path.icon}</div>
            <h3 className="text-lg font-semibold text-white mb-1">{path.title}</h3>
            <p className="text-xs mb-3" style={{ color: 'var(--foreground-secondary)' }}>{path.description}</p>
            
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-3 h-3" style={{ color: 'var(--success)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--success)' }}>{path.avgSalary}</span>
              <TrendingUp className="w-3 h-3 ml-2" style={{ color: 'var(--accent)' }} />
              <span className="text-xs" style={{ color: 'var(--accent)' }}>{path.growth}</span>
            </div>

            <div className="flex items-center gap-1 mb-3">
              <MapPin className="w-3 h-3" style={{ color: 'var(--foreground-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{path.countries.join(', ')}</span>
            </div>

            <div className="flex flex-wrap gap-1">
              {path.skills.map(s => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: `${path.color}15`, color: path.color }}>{s}</span>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--primary-light)' }}>
              Get AI Analysis <ChevronRight className="w-3 h-3" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* AI Insight Panel */}
      {(selectedPath !== null || loading) && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="card card-gradient">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <span className="font-semibold text-white">AI Career Analysis</span>
          </div>
          {loading ? (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
              <span style={{ color: 'var(--foreground-secondary)' }}>Analyzing your profile...</span>
            </div>
          ) : (
            <div className="text-sm whitespace-pre-line" style={{ color: 'var(--foreground-secondary)', lineHeight: 1.7 }}>
              {aiInsight}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
