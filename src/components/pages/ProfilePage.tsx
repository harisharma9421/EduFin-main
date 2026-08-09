'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Briefcase,
  Globe2,
  BookOpen,
  Wallet,
  FileText,
  Settings,
  Target,
  Edit3,
  Save,
  X,
  Loader2,
  Building,
  CalendarDays,
  Award,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useTrack } from '@/lib/useTrack'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// Maps the column name in Supabase profiles to a friendly label, the input
// type, and (optionally) the dropdown options. The order here is the order
// they're rendered inside each section.
type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'multi'
interface Field {
  key: string
  label: string
  type?: FieldType
  options?: string[]
  full?: boolean        // span both columns
  readOnly?: boolean    // not editable (auth-managed values like email)
  prefix?: string
  suffix?: string
}

const SECTIONS: { title: string; icon: any; fields: Field[] }[] = [
  {
    title: 'Identity',
    icon: UserIcon,
    fields: [
      { key: 'name', label: 'Full Name' },
      { key: 'email', label: 'Email', readOnly: true },
      { key: 'mobile', label: 'Mobile' },
      { key: 'dob', label: 'Date of Birth', type: 'date' },
      { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'] },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'education_level', label: 'Current Education Level', type: 'select', options: ['Undergraduate', 'Graduate', 'Working Professional'] },
    ],
  },
  {
    title: 'Academic Background',
    icon: GraduationCap,
    fields: [
      { key: 'tenth_marks', label: '10th Marks (%/CGPA)' },
      { key: 'twelfth_marks', label: '12th Marks (%/CGPA)' },
      { key: 'twelfth_stream', label: '12th Stream', type: 'select', options: ['Science', 'Commerce', 'Arts'] },
      { key: 'undergrad_college', label: 'Undergraduate College', full: true },
      { key: 'undergrad_degree', label: 'Degree' },
      { key: 'undergrad_specialization', label: 'Specialization' },
      { key: 'undergrad_cgpa', label: 'Undergraduate CGPA / %' },
      { key: 'undergrad_grad_year', label: 'Graduation Year', type: 'number' },
      { key: 'backlogs', label: 'Backlogs', type: 'select', options: ['Yes', 'No', 'Cleared'] },
      { key: 'research_papers', label: 'Research Papers', type: 'select', options: ['Yes', 'No'] },
      { key: 'internships', label: 'Internships', type: 'number' },
      { key: 'extracurriculars', label: 'Extracurriculars / Leadership' },
    ],
  },
  {
    title: 'Work Experience',
    icon: Briefcase,
    fields: [
      { key: 'is_working_professional', label: 'Working Professional', type: 'select', options: ['Yes', 'No'] },
      { key: 'company_name', label: 'Company' },
      { key: 'industry', label: 'Industry' },
      { key: 'job_role', label: 'Role / Designation' },
      { key: 'years_experience', label: 'Years of Experience', type: 'number' },
      { key: 'current_ctc', label: 'Current CTC (₹)' },
      { key: 'career_gap', label: 'Career Gap', type: 'select', options: ['No', 'Yes'] },
    ],
  },
  {
    title: 'Target Destination',
    icon: Globe2,
    fields: [
      { key: 'study_goal', label: 'Study Goal', type: 'select', options: ['Abroad', 'Domestic (India)', 'Both'] },
      { key: 'target_countries', label: 'Target Countries', type: 'multi' },
      { key: 'target_degree', label: 'Target Degree', type: 'select', options: ['MS / M.Tech', 'MBA / PGDM', 'MIM', 'MPH', 'MFA', 'LLM', 'PhD'] },
      { key: 'target_field', label: 'Target Field', type: 'select', options: ['Computer Science / AI', 'Business / Finance', 'Engineering', 'Life Sciences', 'Design', 'Other'] },
      { key: 'intake_target', label: 'Intake Target', type: 'select', options: ['Fall 2025', 'Spring 2026', 'Fall 2026', 'Still Deciding'] },
      { key: 'application_stage', label: 'Application Stage', type: 'select', options: ['Just Exploring', 'Shortlisting Universities', 'Appearing for Exams', 'Applications in Progress', 'Admits Received'] },
    ],
  },
  {
    title: 'Exam Profile',
    icon: BookOpen,
    fields: [
      { key: 'gre_status', label: 'GRE Status', type: 'select', options: ['Appeared', 'Planning', 'Not Required', 'NA'] },
      { key: 'gre_score', label: 'GRE Score' },
      { key: 'gmat_status', label: 'GMAT Status', type: 'select', options: ['Appeared', 'Planning', 'Not Required', 'NA'] },
      { key: 'gmat_score', label: 'GMAT Score' },
      { key: 'ielts_status', label: 'IELTS Status', type: 'select', options: ['Appeared', 'Planning', 'NA'] },
      { key: 'ielts_score', label: 'IELTS Score' },
      { key: 'toefl_status', label: 'TOEFL Status', type: 'select', options: ['Appeared', 'Planning', 'NA'] },
      { key: 'toefl_score', label: 'TOEFL Score' },
      { key: 'exam_next_date', label: 'Next Exam Date', type: 'date' },
    ],
  },
  {
    title: 'Universities',
    icon: Building,
    fields: [
      { key: 'dream_universities', label: 'Dream Universities', type: 'multi' },
      { key: 'target_universities', label: 'Realistic Target', type: 'multi' },
      { key: 'safe_universities', label: 'Safe Universities', type: 'multi' },
      { key: 'university_research_stage', label: 'Research Stage', type: 'select', options: ["Haven't started", 'Casually browsing', 'Shortlist ready', 'Already applied'] },
    ],
  },
  {
    title: 'Financials',
    icon: Wallet,
    fields: [
      { key: 'funding_source', label: 'Funding Source', type: 'select', options: ['Self / Family', 'Education Loan', 'Scholarship', 'Mix of above'] },
      { key: 'expected_budget', label: 'Expected Budget', type: 'select', options: ['Below 20L', '20L – 40L', '40L – 60L', '60L – 80L', '80L+'] },
      { key: 'loan_estimate', label: 'Loan Estimate (₹)' },
      { key: 'collateral_available', label: 'Collateral Available', type: 'select', options: ['Yes', 'No', 'Not Sure'] },
      { key: 'family_income', label: 'Family Income', type: 'select', options: ['Below 3L', '3L – 6L', '6L – 10L', '10L – 20L', '20L+'] },
      { key: 'co_applicant', label: 'Co-applicant', type: 'select', options: ['Yes', 'No'] },
      { key: 'credit_score', label: 'Credit Score', type: 'select', options: ['Below 650', '650–750', '750+', "Don't know"] },
    ],
  },
  {
    title: 'Documents',
    icon: FileText,
    fields: [
      { key: 'doc_passport', label: 'Passport', type: 'select', options: ['Ready', 'In Progress', 'Not Started'] },
      { key: 'doc_transcripts', label: 'Transcripts', type: 'select', options: ['Ready', 'In Progress', 'Not Started'] },
      { key: 'doc_lors', label: 'LORs', type: 'select', options: ['Ready', 'In Progress', 'Not Started'] },
      { key: 'doc_sop', label: 'SOP', type: 'select', options: ['Ready', 'In Progress', 'Not Started'] },
      { key: 'doc_resume', label: 'Resume / CV', type: 'select', options: ['Ready', 'In Progress', 'Not Started'] },
      { key: 'doc_bank_statements', label: 'Bank Statements', type: 'select', options: ['Ready', 'In Progress', 'Not Started'] },
      { key: 'doc_visa', label: 'Visa', type: 'select', options: ['Ready', 'In Progress', 'Not Started', 'NA'] },
    ],
  },
  {
    title: 'Preferences',
    icon: Settings,
    fields: [
      { key: 'preferred_language', label: 'Preferred Language', type: 'select', options: ['English', 'Hindi', 'Regional'] },
      { key: 'notification_preference', label: 'Notification Preference', type: 'select', options: ['WhatsApp', 'Email', 'App'] },
      { key: 'hear_about_us', label: 'How did you hear about us?', type: 'select', options: ['Instagram', 'YouTube', 'Friend', 'College', 'Other'] },
      { key: 'referral_code', label: 'Referral Code' },
    ],
  },
]

const SECTION_KEYS = SECTIONS.flatMap((s) => s.fields.map((f) => f.key))

export default function ProfilePage() {
  const { user, profile, updateProfile, setCurrentPage, setTargetOnboardingStep } = useAppStore()
  const track = useTrack()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [row, setRow] = useState<Record<string, any> | null>(null)
  const [draft, setDraft] = useState<Record<string, any>>({})

  // Initial load from Supabase
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (cancelled) return
      if (error) {
        console.error('[ProfilePage] load error:', error)
        toast.error('Could not load profile')
      } else if (data) {
        setRow(data)
        setDraft(data)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const startEdit = () => {
    if (!row) return
    setDraft(row)
    setEditing(true)
  }

  // Re-open the original multi-step onboarding flow so the user edits their
  // profile through the exact same form they filled at signup. The flow reads
  // from the hydrated `profile` store and writes back to Supabase on save, so
  // any updates are persisted and reflected here on return. We do NOT clear
  // the onboarded flag — page.tsx renders the flow whenever currentPage is
  // 'onboarding', so the user can never get stranded mid-edit.
  const openOnboardingEditor = () => {
    setTargetOnboardingStep(1)
    setCurrentPage('onboarding')
  }
  const cancelEdit = () => {
    if (row) setDraft(row)
    setEditing(false)
  }

  // Build the diff: only send columns that actually changed (and only the
  // ones we manage in SECTION_KEYS — never leak other columns).
  const handleSave = async () => {
    if (!user?.id || !row) return
    const payload: Record<string, any> = {}
    for (const key of SECTION_KEYS) {
      const next = draft[key]
      const prev = row[key]
      if (JSON.stringify(next ?? null) !== JSON.stringify(prev ?? null)) {
        payload[key] = next ?? null
      }
    }
    if (Object.keys(payload).length === 0) {
      setEditing(false)
      toast('Nothing to save', { icon: '✨' })
      return
    }

    setSaving(true)
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.id)
      .select()
      .single()
    setSaving(false)

    if (error) {
      console.error('[ProfilePage] save error:', error)
      toast.error('Save failed: ' + error.message)
      return
    }
    if (data) {
      setRow(data)
      setDraft(data)
      // Mirror the camelCase store fields for the rest of the app.
      updateProfile({
        name: data.name,
        mobile: data.mobile,
        city: data.city,
        state: data.state,
        targetCountry: data.target_countries,
        targetDegree: data.target_degree,
      })
    }
    setEditing(false)
    toast.success('Profile updated')
  }

  // Display helpers
  const fmtValue = (key: string, value: any) => {
    if (value === null || value === undefined || value === '') return '—'
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
    return String(value)
  }

  // Compute completeness based on the SECTION_KEYS fields the user has filled.
  const completeness = useMemo(() => {
    if (!row) return 0
    let total = 0
    let filled = 0
    for (const key of SECTION_KEYS) {
      if (key === 'email' || key === 'referral_code') continue
      total++
      const v = row[key]
      if (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '') {
        filled++
      }
    }
    return Math.round((filled / Math.max(1, total)) * 100)
  }, [row])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!row) {
    return (
      <div className="max-w-2xl mx-auto card p-8 text-center">
        <p className="text-foreground-secondary">No profile found yet.</p>
      </div>
    )
  }

  const initial = (row.name || row.email || '?').toString().trim().charAt(0).toUpperCase()

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6">
      {/* HERO */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative rounded-3xl overflow-hidden border border-border"
        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(6,182,212,0.06))' }}
      >
        <div className="absolute inset-0 pointer-events-none bg-grid opacity-50" />
        <div className="relative p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
            {row.avatar_url ? (
              <img
                src={row.avatar_url}
                alt=""
                className="w-full h-full rounded-2xl object-cover border-2 border-primary/30"
              />
            ) : (
              <div
                className="w-full h-full rounded-2xl flex items-center justify-center text-3xl font-bold text-white"
                style={{ background: 'var(--gradient-primary)' }}
              >
                {initial}
              </div>
            )}
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
              style={{ background: 'var(--surface)', color: 'var(--primary-light)', border: '1px solid var(--border)' }}
            >
              {row.role || 'Student'}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
              {row.name || 'Unnamed Student'}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              {row.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {row.email}
                </span>
              )}
              {row.mobile && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> {row.mobile}
                </span>
              )}
              {row.city && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {[row.city, row.state].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {row.target_degree && (
                <span className="badge badge-primary text-xs">
                  <Target className="w-3 h-3 mr-1" /> {row.target_degree}
                </span>
              )}
              {row.target_field && (
                <span className="badge badge-primary text-xs">
                  <BookOpen className="w-3 h-3 mr-1" /> {row.target_field}
                </span>
              )}
              {Array.isArray(row.target_countries) && row.target_countries.length > 0 && (
                <span className="badge badge-primary text-xs">
                  <Globe2 className="w-3 h-3 mr-1" /> {row.target_countries.join(', ')}
                </span>
              )}
              {row.intake_target && (
                <span className="badge badge-primary text-xs">
                  <CalendarDays className="w-3 h-3 mr-1" /> {row.intake_target}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 w-full md:w-auto">
            <div
              className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <Award className="w-4 h-4 text-primary" />
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--foreground-muted)' }}>
                  Profile completeness
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--background-secondary)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${completeness}%`, background: 'var(--gradient-primary)' }}
                    />
                  </div>
                  <span className="text-xs font-bold" style={{ color: 'var(--primary-light)' }}>
                    {completeness}%
                  </span>
                </div>
              </div>
            </div>

            {!editing ? (
              <button onClick={openOnboardingEditor} className="btn-primary inline-flex items-center justify-center gap-2">
                <Edit3 className="w-4 h-4" /> Edit profile
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={cancelEdit} disabled={saving} className="btn-secondary flex-1 inline-flex items-center justify-center gap-2">
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 inline-flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* SECTIONS */}
      {SECTIONS.map((section, idx) => {
        // Track-aware filtering. The abroad standardized tests (GRE/GMAT/IELTS/
        // TOEFL) only make sense for abroad / both. The domestic exams are no
        // longer static columns — they come from the dynamically-fetched
        // `entranceExams` the student picked in onboarding — so we render those
        // separately below for domestic / both.
        let fields = section.fields
        const isExamSection = section.title === 'Exam Profile'
        if (isExamSection && track === 'domestic') {
          // Domestic-only: drop the abroad tests; keep only the next-exam date.
          fields = section.fields.filter((f) => f.key === 'exam_next_date')
        }

        const domesticExams = profile.entranceExams ?? []
        const showDomesticExams =
          isExamSection && (track === 'domestic' || track === 'both')

        return (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: idx * 0.04 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-5 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--primary-light)' }}
            >
              <section.icon className="w-4 h-4" />
            </div>
            <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>
              {section.title}
            </h2>
          </div>

          {fields.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {fields.map((field) => (
                <FieldRow
                  key={field.key}
                  field={field}
                  value={editing ? draft[field.key] : row[field.key]}
                  editing={editing}
                  onChange={(v) => setDraft((d) => ({ ...d, [field.key]: v }))}
                  fmt={fmtValue}
                />
              ))}
            </div>
          )}

          {/* Dynamically-fetched Indian entrance exams (domestic / both). */}
          {showDomesticExams && (
            <div className={fields.length > 0 ? 'mt-5 pt-5 border-t' : ''} style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--foreground-muted)' }}>
                Indian Entrance Exams
              </div>
              {domesticExams.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  No Indian exams added yet. Use &ldquo;Edit profile&rdquo; to add the exams you appeared for.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {domesticExams.map((e) => (
                    <div
                      key={e.id}
                      className="rounded-lg p-3"
                      style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                          {e.examName}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                          {e.stream} · {e.region}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs" style={{ color: 'var(--foreground-secondary)' }}>
                        {e.rank && e.rank.trim() && (
                          <span>Rank: <strong style={{ color: 'var(--foreground)' }}>{e.rank}</strong></span>
                        )}
                        {e.marks && e.marks.trim() && (
                          <span>Score: <strong style={{ color: 'var(--foreground)' }}>{e.marks}</strong></span>
                        )}
                        {!(e.rank && e.rank.trim()) && !(e.marks && e.marks.trim()) && (
                          <span style={{ color: 'var(--foreground-muted)' }}>No rank / score entered</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
        )
      })}
    </div>
  )
}

function FieldRow({
  field,
  value,
  editing,
  onChange,
  fmt,
}: {
  field: Field
  value: any
  editing: boolean
  onChange: (v: any) => void
  fmt: (key: string, value: any) => string
}) {
  const wrapClass = field.full ? 'md:col-span-2' : ''
  const readOnly = field.readOnly === true

  return (
    <div className={wrapClass}>
      <label className="block text-[11px] uppercase tracking-widest font-bold mb-1" style={{ color: 'var(--foreground-muted)' }}>
        {field.label}
      </label>
      {!editing || readOnly ? (
        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          {fmt(field.key, value)}
        </p>
      ) : field.type === 'select' && field.options ? (
        <select
          className="input-field"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— select —</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : field.type === 'multi' ? (
        <input
          className="input-field"
          placeholder="Comma-separated values"
          value={Array.isArray(value) ? value.join(', ') : (value ?? '')}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
      ) : field.type === 'textarea' ? (
        <textarea
          className="input-field min-h-[80px]"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="input-field"
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
