'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardList, Search, CheckCircle, Circle, ChevronDown, ChevronUp,
  Loader2, BookOpen, FileText, GraduationCap, DollarSign, Globe,
  Shield, AlertCircle, Clock, Sparkles, ExternalLink, RotateCcw, Info, PlayCircle
} from 'lucide-react'

interface Step {
  id: string
  title: string
  description: string
  category: string
  priority: string
  estimatedTime: string
}

interface Guide {
  universityName: string
  program: string
  country: string
  applicationUrl?: string
  deadline?: string
  steps: Step[]
  requirements?: Record<string, string>
  tips?: string[]
  estimatedCostINR?: string
  applicationFee?: string
  videos?: {
    title: string
    link: string
    snippet: string
    imageUrl: string
    channel: string
  }[]
}

interface SavedGuide {
  guide: Guide
  completedSteps: string[]
  createdAt: string
  lastUpdated: string
}

const STORAGE_KEY = 'edufinai-form-guides'

const categoryIcons: Record<string, typeof BookOpen> = {
  research: Search,
  documents: FileText,
  tests: BookOpen,
  application: ClipboardList,
  financial: DollarSign,
  visa: Shield,
}

const priorityColors: Record<string, string> = {
  critical: '#ef4444',
  important: '#f59e0b',
  recommended: '#10b981',
}

const countries = [
  'United States', 'United Kingdom', 'Canada', 'Germany', 'Australia',
  'France', 'Netherlands', 'Switzerland', 'Singapore', 'Japan',
  'South Korea', 'New Zealand', 'Ireland', 'Sweden', 'Denmark',
  'Norway', 'Finland', 'Austria', 'Belgium', 'Italy',
  'Spain', 'Portugal', 'Czech Republic', 'Poland', 'Hungary',
  'China', 'Hong Kong', 'Taiwan', 'Malaysia', 'Thailand',
  'UAE', 'Saudi Arabia', 'Qatar', 'Russia', 'Turkey',
  'South Africa', 'Brazil', 'Mexico', 'Argentina', 'Chile',
  'India', 'Philippines', 'Vietnam', 'Indonesia', 'Israel',
  'Greece', 'Croatia', 'Romania', 'Bulgaria', 'Estonia',
  'Latvia', 'Lithuania', 'Slovakia', 'Slovenia', 'Luxembourg',
  'Malta', 'Cyprus', 'Iceland', 'Liechtenstein', 'Monaco',
  'Bahrain', 'Kuwait', 'Oman', 'Jordan', 'Lebanon',
  'Egypt', 'Morocco', 'Tunisia', 'Kenya', 'Nigeria',
  'Ghana', 'Tanzania', 'Uganda', 'Ethiopia', 'Rwanda',
  'Colombia', 'Peru', 'Ecuador', 'Uruguay', 'Paraguay',
  'Costa Rica', 'Panama', 'Dominican Republic', 'Jamaica', 'Trinidad',
  'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Myanmar',
  'Cambodia', 'Laos', 'Mongolia', 'Kazakhstan', 'Uzbekistan',
  'Georgia', 'Armenia', 'Azerbaijan', 'Serbia', 'Bosnia',
  'Montenegro', 'North Macedonia', 'Albania', 'Moldova', 'Ukraine',
  'Belarus', 'Fiji', 'Papua New Guinea', 'Samoa', 'Tonga',
].sort()

const degrees = [
  'MS Computer Science', 'MS Data Science', 'MS AI/ML', 'MS Electrical Engineering',
  'MS Mechanical Engineering', 'MS Civil Engineering', 'MS Chemical Engineering',
  'MS Biomedical Engineering', 'MS Information Systems', 'MS Cybersecurity',
  'MS Finance', 'MS Business Analytics', 'MS Economics', 'MS Statistics',
  'MS Mathematics', 'MS Physics', 'MS Chemistry', 'MS Biology',
  'MBA', 'MBA (Finance)', 'MBA (Marketing)', 'MBA (Operations)',
  'PhD Computer Science', 'PhD Engineering', 'PhD Business', 'PhD Sciences',
  'MFA', 'MA Education', 'MA Psychology', 'MPH (Public Health)',
  'LLM (Law)', 'MArch (Architecture)', 'MS Environmental Science',
  'MS Robotics', 'MS Biotechnology', 'MS Pharmaceutical Sciences',
  'MS Supply Chain', 'MS Human Resources', 'MS Hospitality Management',
  'Other',
]

function getSavedGuides(): Record<string, SavedGuide> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch { return {} }
}

function saveGuide(key: string, data: SavedGuide) {
  const guides = getSavedGuides()
  guides[key] = data
  localStorage.setItem(STORAGE_KEY, JSON.stringify(guides))
}

function getGuideKey(uni: string, program: string, country: string) {
  return `${uni.toLowerCase().trim()}_${program.toLowerCase().trim()}_${country.toLowerCase().trim()}`
}

export default function FormGuide() {
  const [universityName, setUniversityName] = useState('')
  const [selectedProgram, setSelectedProgram] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentGuide, setCurrentGuide] = useState<SavedGuide | null>(null)
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const [savedGuidesList, setSavedGuidesList] = useState<Array<{ key: string; guide: SavedGuide }>>([])
  const [showSaved, setShowSaved] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)

  useEffect(() => {
    const guides = getSavedGuides()
    const list = Object.entries(guides).map(([key, guide]) => ({ key, guide }))
    setSavedGuidesList(list)
  }, [currentGuide])

  const filteredCountries = countries.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  )

  const fetchGuide = useCallback(async () => {
    if (!universityName.trim() || !selectedProgram || !selectedCountry) {
      setError('Please fill in all fields')
      return
    }

    const key = getGuideKey(universityName, selectedProgram, selectedCountry)
    const saved = getSavedGuides()[key]
    if (saved) {
      setCurrentGuide(saved)
      setError('')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admission-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universityName: universityName.trim(),
          program: selectedProgram,
          country: selectedCountry,
        }),
      })

      if (!res.ok) throw new Error('Failed to fetch guide')
      const data = await res.json()

      if (data.guide) {
        const newGuide: SavedGuide = {
          guide: data.guide,
          completedSteps: [],
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        }
        saveGuide(key, newGuide)
        setCurrentGuide(newGuide)
      }
    } catch {
      setError('Failed to generate guide. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [universityName, selectedProgram, selectedCountry])

  const toggleStep = (stepId: string) => {
    if (!currentGuide) return
    const key = getGuideKey(
      currentGuide.guide.universityName || universityName,
      currentGuide.guide.program || selectedProgram,
      currentGuide.guide.country || selectedCountry
    )
    const completed = currentGuide.completedSteps.includes(stepId)
      ? currentGuide.completedSteps.filter(s => s !== stepId)
      : [...currentGuide.completedSteps, stepId]

    const updated = { ...currentGuide, completedSteps: completed, lastUpdated: new Date().toISOString() }
    saveGuide(key, updated)
    setCurrentGuide(updated)
  }

  const loadSavedGuide = (saved: SavedGuide) => {
    setCurrentGuide(saved)
    setUniversityName(saved.guide.universityName || '')
    setSelectedProgram(saved.guide.program || '')
    setSelectedCountry(saved.guide.country || '')
    setShowSaved(false)
  }

  const progress = currentGuide
    ? Math.round((currentGuide.completedSteps.length / (currentGuide.guide.steps?.length || 1)) * 100)
    : 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          <ClipboardList className="w-6 h-6" style={{ color: 'var(--primary)' }} />
          Application Form Guide & Tracker
        </h2>
        <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>
          Search any university — get a step-by-step admission checklist with AI-powered guidance.
        </p>
      </div>

      {/* Search Form */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium block mb-1" style={{ color: 'var(--foreground)' }}>University Name</label>
            <input
              className="input-field"
              placeholder="e.g. Stanford University"
              defaultValue={universityName}
              onChange={(e: any) => setUniversityName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1" style={{ color: 'var(--foreground)' }}>Program / Degree</label>
            <select className="input-field" value={selectedProgram}
              onChange={e => setSelectedProgram(e.target.value)}>
              <option value="">Select program</option>
              {degrees.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="relative">
            <label className="text-sm font-medium block mb-1" style={{ color: 'var(--foreground)' }}>Country</label>
            <input className="input-field" placeholder="Search country..."
              value={countrySearch || selectedCountry}
              onChange={e => { setCountrySearch(e.target.value); setSelectedCountry(''); setShowCountryDropdown(true) }}
              onFocus={() => setShowCountryDropdown(true)} />
            {showCountryDropdown && filteredCountries.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {filteredCountries.slice(0, 20).map(c => (
                  <button key={c} className="w-full text-left px-3 py-2 text-sm hover:opacity-80 transition-all"
                    style={{ color: 'var(--foreground-secondary)' }}
                    onClick={() => { setSelectedCountry(c); setCountrySearch(''); setShowCountryDropdown(false) }}>
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={fetchGuide} disabled={loading}
            className="btn-primary flex items-center justify-center gap-2 flex-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Searching & Analyzing...' : 'Generate Admission Guide'}
          </button>
          {savedGuidesList.length > 0 && (
            <button onClick={() => setShowSaved(!showSaved)}
              className="btn-secondary flex items-center justify-center gap-2">
              <ClipboardList className="w-4 h-4" />
              My Saved Guides ({savedGuidesList.length})
            </button>
          )}
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm" style={{ color: 'var(--danger)' }}>
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
      </div>

      {/* Saved Guides List */}
      <AnimatePresence>
        {showSaved && savedGuidesList.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="space-y-2">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Saved Guides</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedGuidesList.map(({ key, guide: saved }) => {
                const p = Math.round((saved.completedSteps.length / (saved.guide.steps?.length || 1)) * 100)
                return (
                  <button key={key} onClick={() => loadSavedGuide(saved)}
                    className="card text-left hover:border-[var(--primary)] transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                          {saved.guide.universityName}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                          {saved.guide.program} • {saved.guide.country}
                        </div>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 rounded-full"
                        style={{ background: p === 100 ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.12)',
                          color: p === 100 ? 'var(--success)' : 'var(--primary-light)' }}>
                        {p}%
                      </span>
                    </div>
                    <div className="progress-bar mt-2">
                      <div className="progress-bar-fill" style={{ width: `${p}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {loading && (
        <div className="card text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: 'var(--primary)' }} />
          <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Searching university admission forms...
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
            Analyzing requirements with AI — this may take 10-15 seconds
          </div>
        </div>
      )}

      {/* Guide Content */}
      {currentGuide && !loading && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Progress Header */}
          <div className="card card-gradient">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                  <GraduationCap className="w-5 h-5 inline mr-2" style={{ color: 'var(--primary-light)' }} />
                  {currentGuide.guide.universityName}
                </h3>
                <div className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                  {currentGuide.guide.program} • {currentGuide.guide.country}
                </div>
                {currentGuide.guide.deadline && (
                  <div className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                    <Clock className="w-3 h-3" /> Deadline: {currentGuide.guide.deadline}
                  </div>
                )}
              </div>
              <div className="text-center sm:text-right">
                <div className="text-3xl font-extrabold" style={{ color: progress === 100 ? 'var(--success)' : 'var(--primary-light)' }}>
                  {progress}%
                </div>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  {currentGuide.completedSteps.length}/{currentGuide.guide.steps?.length || 0} steps done
                </div>
              </div>
            </div>
            <div className="progress-bar mt-3" style={{ height: 8 }}>
              <div className="progress-bar-fill" style={{
                width: `${progress}%`,
                background: progress === 100 ? 'var(--success)' : undefined,
                transition: 'width 0.5s ease'
              }} />
            </div>
          </div>

          {/* Requirements Summary */}
          {currentGuide.guide.requirements && Object.keys(currentGuide.guide.requirements).length > 0 && (
            <div className="card">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                <Info className="w-4 h-4" style={{ color: 'var(--info)' }} /> Requirements
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(currentGuide.guide.requirements).map(([key, val]) => (
                  val && val !== 'N/A' && (
                    <div key={key} className="p-2 rounded-lg" style={{ background: 'var(--background-secondary)' }}>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{val}</div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Steps Checklist */}
          <div className="space-y-2">
            {(currentGuide.guide.steps || []).map((step, i) => {
              const isCompleted = currentGuide.completedSteps.includes(step.id)
              const isExpanded = expandedStep === step.id
              const Icon = categoryIcons[step.category] || ClipboardList
              return (
                <motion.div key={step.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card" style={{
                    padding: '0.75rem 1rem',
                    borderColor: isCompleted ? 'rgba(16,185,129,0.3)' : undefined,
                    background: isCompleted ? 'rgba(16,185,129,0.03)' : undefined,
                  }}>
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleStep(step.id)} className="mt-0.5 flex-shrink-0">
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" style={{ color: 'var(--success)' }} />
                      ) : (
                        <Circle className="w-5 h-5" style={{ color: 'var(--foreground-muted)' }} />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: priorityColors[step.priority] || 'var(--foreground-muted)' }} />
                        <span className={`text-sm font-medium ${isCompleted ? 'line-through' : ''}`}
                          style={{ color: isCompleted ? 'var(--foreground-muted)' : 'var(--foreground)' }}>
                          {step.title}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: `${priorityColors[step.priority] || '#6366f1'}15`,
                            color: priorityColors[step.priority] || '#6366f1'
                          }}>
                          {step.priority}
                        </span>
                        {step.estimatedTime && (
                          <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--foreground-muted)' }}>
                            <Clock className="w-3 h-3" /> {step.estimatedTime}
                          </span>
                        )}
                      </div>
                      <button onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                        className="flex items-center gap-1 text-xs mt-1"
                        style={{ color: 'var(--primary-light)' }}>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? 'Hide details' : 'View details'}
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--foreground-secondary)' }}>
                              {step.description}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Tips */}
          {currentGuide.guide.tips && currentGuide.guide.tips.length > 0 && (
            <div className="card" style={{ background: 'rgba(99,102,241,0.04)', borderColor: 'rgba(99,102,241,0.15)' }}>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Pro Tips
              </h4>
              <ul className="space-y-2">
                {currentGuide.guide.tips.map((tip, i) => (
                  <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--foreground-secondary)' }}>
                    <span style={{ color: 'var(--accent)' }}>•</span> {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Application Link & Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentGuide.guide.applicationUrl && (
              <a href={currentGuide.guide.applicationUrl} target="_blank" rel="noopener noreferrer"
                className="card flex items-center gap-3 hover:border-[var(--primary)]">
                <ExternalLink className="w-5 h-5" style={{ color: 'var(--primary-light)' }} />
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Application Portal</div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Open official application</div>
                </div>
              </a>
            )}
            {currentGuide.guide.estimatedCostINR && (
              <div className="card flex items-center gap-3">
                <DollarSign className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Estimated Cost</div>
                  <div className="text-xs" style={{ color: 'var(--accent)' }}>{currentGuide.guide.estimatedCostINR}</div>
                </div>
              </div>
            )}
          </div>

          {/* Helpful Video Guides */}
          {currentGuide.guide.videos && currentGuide.guide.videos.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                <PlayCircle className="w-5 h-5" style={{ color: '#ef4444' }} /> Helpful Video Guides
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentGuide.guide.videos.map((video, i) => (
                  <a key={i} href={video.link} target="_blank" rel="noopener noreferrer"
                    className="card flex gap-3 hover:border-[#ef4444] transition-all p-3 group bg-black/10">
                    <div className="relative w-24 h-16 rounded overflow-hidden flex-shrink-0 bg-black/20">
                      {video.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={video.imageUrl} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <PlayCircle className="w-6 h-6 text-white/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlayCircle className="w-6 h-6 text-white drop-shadow-md" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="text-xs font-semibold line-clamp-2" style={{ color: 'var(--foreground)' }}>
                        {video.title}
                      </div>
                      <div className="text-[10px] mt-1 text-red-500/80 font-medium truncate">
                        {video.channel || 'YouTube'}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Reset */}
          <button onClick={() => setCurrentGuide(null)}
            className="btn-secondary flex items-center gap-2 text-sm mt-4">
            <RotateCcw className="w-4 h-4" /> Search Another University
          </button>
        </motion.div>
      )}
    </div>
  )
}
