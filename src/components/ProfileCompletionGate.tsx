'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { calculateProfileScore, type ProfileScoreResult, type MissingField } from '@/lib/profileCompleteness'
import {
  GraduationCap, Briefcase, Wallet, BookOpen, User, Globe, Building, FileText, Settings,
  AlertTriangle, ChevronRight, Sparkles, ShieldCheck, ArrowRight
} from 'lucide-react'

// ─── Section Ring Component ──────────────────────────────────────────

const SECTION_META: Record<string, { label: string, icon: any, gradient: string[] }> = {
  identity: { label: 'Identity', icon: User, gradient: ['#3b82f6', '#60a5fa'] },
  academics: { label: 'Academics', icon: GraduationCap, gradient: ['#6366f1', '#818cf8'] },
  workExp: { label: 'Work Exp', icon: Briefcase, gradient: ['#8b5cf6', '#a78bfa'] },
  destination: { label: 'Destination', icon: Globe, gradient: ['#06b6d4', '#22d3ee'] },
  exams: { label: 'Exams', icon: BookOpen, gradient: ['#f59e0b', '#fbbf24'] },
  universities: { label: 'Universities', icon: Building, gradient: ['#f43f5e', '#fb7185'] },
  financials: { label: 'Financials', icon: Wallet, gradient: ['#10b981', '#34d399'] },
  documents: { label: 'Documents', icon: FileText, gradient: ['#f97316', '#fb923c'] },
  preferences: { label: 'Preferences', icon: Settings, gradient: ['#64748b', '#94a3b8'] },
}

const SECTION_STEP_MAP: Record<string, number> = {
  identity: 1,
  academics: 2,
  workExp: 3,
  destination: 4,
  exams: 5,
  universities: 6,
  financials: 7,
  documents: 8,
  preferences: 9,
}

function SectionRing({ sectionKey, section, onClick }: { sectionKey: keyof typeof SECTION_META; section: ProfileScoreResult['sections'][keyof ProfileScoreResult['sections']], onClick?: () => void }) {
  const meta = SECTION_META[sectionKey]
  const Icon = meta.icon
  const pct = section.max > 0 ? (section.score / section.max) * 100 : 0
  const circumference = 2 * Math.PI * 36 // r=36
  const offset = circumference - (pct / 100) * circumference
  const isFull = section.missing.length === 0

  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${onClick ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : ''}`}
      style={{
        background: isFull ? `${meta.gradient[0]}08` : 'var(--surface)',
        borderColor: isFull ? `${meta.gradient[0]}30` : 'var(--border)',
      }}
    >
      {/* Mini ring */}
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="40" cy="40" r="36" fill="none" stroke="var(--background-secondary)" strokeWidth="5" />
          <motion.circle
            cx="40" cy="40" r="36" fill="none"
            stroke={`url(#grad-${sectionKey})`}
            strokeWidth="5" strokeLinecap="round"
            initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
          />
          <defs>
            <linearGradient id={`grad-${sectionKey}`}>
              <stop offset="0%" stopColor={meta.gradient[0]} />
              <stop offset="100%" stopColor={meta.gradient[1]} />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold" style={{ color: meta.gradient[0] }}>{section.score}</span>
          <span className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>/{section.max}</span>
        </div>
      </div>

      {/* Label */}
      <div className="flex items-center gap-1.5">
        <Icon className="w-4 h-4" style={{ color: meta.gradient[0] }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{meta.label}</span>
      </div>

      {/* Status */}
      {isFull ? (
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${meta.gradient[0]}15`, color: meta.gradient[0] }}>
          ✓ Complete
        </span>
      ) : (
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)' }}>
          {section.missing.length} missing
        </span>
      )}
    </motion.div>
  )
}

// ─── Missing Field Row ───────────────────────────────────────────────

function MissingFieldRow({ field, index, onClick }: { field: MissingField; index: number, onClick?: () => void }) {
  const sectionColor = SECTION_META[field.section].gradient[0]

  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 + index * 0.05 }}
      className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${onClick ? 'cursor-pointer hover:bg-white/5 hover:border-opacity-50' : ''}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: `${sectionColor}12`, border: `1px solid ${sectionColor}25` }}
      >
        <AlertTriangle className="w-4 h-4" style={{ color: sectionColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{field.label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>{field.reason}</p>
      </div>
      <div
        className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shrink-0 mt-1"
        style={{ background: `${sectionColor}10`, color: sectionColor }}
      >
        {field.section}
      </div>
    </motion.div>
  )
}

// ─── Main Gate Component ─────────────────────────────────────────────

export default function ProfileCompletionGate() {
  const { profile, setCurrentPage, setTargetOnboardingStep } = useAppStore()

  const result = useMemo(() => calculateProfileScore(profile), [profile])

  const handleGoToStep = (stepNumber: number) => {
    setTargetOnboardingStep(stepNumber)
    setCurrentPage('onboarding')
  }

  const handleCompleteProfile = () => {
    if (result.missingFields.length > 0) {
      const firstMissingSection = result.missingFields[0].section
      const targetStep = SECTION_STEP_MAP[firstMissingSection as string] || 1
      handleGoToStep(targetStep)
    } else {
      handleGoToStep(1)
    }
  }

  const mainCircumference = 2 * Math.PI * 85
  const mainOffset = mainCircumference - (result.totalScore / 100) * mainCircumference

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center relative overflow-hidden px-4">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid z-0 opacity-30" />
      <div className="glow-orb bg-primary" style={{ top: '-15%', left: '-10%', width: '35vw', height: '35vw' }} />
      <div className="glow-orb bg-secondary" style={{ bottom: '-10%', right: '-10%', width: '25vw', height: '25vw' }} />
      <div className="glow-orb" style={{ top: '50%', left: '50%', width: '20vw', height: '20vw', background: '#f59e0b', transform: 'translate(-50%, -50%)' }} />

      <div className="relative z-10 w-full max-w-3xl space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3 relative z-10"
        >
          <div className="inline-flex items-center justify-center p-3 rounded-full mb-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <ShieldCheck className="w-8 h-8" style={{ color: 'var(--primary)' }} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: 'var(--foreground)' }}>
            AI Education <span style={{ color: 'transparent', WebkitBackgroundClip: 'text', backgroundImage: 'var(--gradient-primary)' }}>Journey</span>
          </h2>
          <p className="text-sm sm:text-base max-w-xl mx-auto" style={{ color: 'var(--foreground-muted)' }}>
            To unlock your personalized AI Study Abroad Consultant, we need to understand you better. 
            A complete profile is required to generate accurate university recommendations, admission predictions, and financial roadmaps.
          </p>
        </motion.div>

        {/* Main Score Ring */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 120 }}
          className="flex justify-center"
        >
          <div className="relative w-44 h-44 sm:w-52 sm:h-52">
            <svg viewBox="0 0 200 200" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="100" cy="100" r="85" fill="none" stroke="var(--background-secondary)" strokeWidth="10" />
              <motion.circle
                cx="100" cy="100" r="85" fill="none"
                stroke="url(#gateGrad)"
                strokeWidth="10" strokeLinecap="round"
                initial={{ strokeDasharray: mainCircumference, strokeDashoffset: mainCircumference }}
                animate={{ strokeDashoffset: mainOffset }}
                transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
              />
              <defs>
                <linearGradient id="gateGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--primary)" />
                  <stop offset="50%" stopColor="var(--secondary)" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl sm:text-5xl font-extrabold" style={{ color: 'var(--primary-light)' }}>
                {result.totalScore}
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                / 100%
              </span>
              <span className="text-[10px] font-semibold mt-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)' }}>
                Needs ≥ 80%
              </span>
            </div>
          </div>
        </motion.div>

        {/* Section Rings Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3"
        >
          {Object.keys(SECTION_META).map((key) => {
            const section = result.sections[key as keyof typeof result.sections]
            const isFull = section.missing.length === 0
            return (
              <SectionRing 
                key={key} 
                sectionKey={key as keyof typeof SECTION_META} 
                section={section} 
                onClick={!isFull ? () => handleGoToStep(SECTION_STEP_MAP[key]) : undefined}
              />
            )
          })}
        </motion.div>

        {/* Missing Fields */}
        {result.missingFields.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="space-y-3"
          >
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--warning)' }} />
              Missing Information ({result.missingFields.length} field{result.missingFields.length > 1 ? 's' : ''})
            </h3>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {result.missingFields.map((field, i) => (
                <MissingFieldRow 
                  key={field.key} 
                  field={field} 
                  index={i} 
                  onClick={() => handleGoToStep(SECTION_STEP_MAP[field.section as string])}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center pt-2"
        >
          <button
            onClick={handleCompleteProfile}
            className="btn-primary flex items-center gap-2 text-base px-8 py-3.5 shadow-lg"
            style={{ boxShadow: '0 0 30px rgba(99,102,241,0.3)' }}
          >
            <Sparkles className="w-5 h-5" />
            Complete Profile
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>

        <p className="text-center text-xs" style={{ color: 'var(--foreground-muted)' }}>
          This is an intelligent preparation step — your data powers every AI recommendation.
        </p>
      </div>
    </div>
  )
}
