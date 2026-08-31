import type { StudentProfile } from './types'

// ─── Field Definitions ───────────────────────────────────────────────

export interface MissingField {
  key: string
  label: string
  reason: string
  section: keyof ProfileScoreResult['sections']
}

export interface SectionScore {
  score: number
  max: number
  filled: number
  total: number
  missing: MissingField[]
}

export interface ProfileScoreResult {
  totalScore: number
  sections: {
    identity: SectionScore
    academics: SectionScore
    workExp: SectionScore
    destination: SectionScore
    exams: SectionScore
    universities: SectionScore
    financials: SectionScore
    documents: SectionScore
    preferences: SectionScore
  }
  missingFields: MissingField[]
}

// ─── Helpers ─────────────────────────────────────────────────────────

function hasValue(val: unknown): boolean {
  if (val === undefined || val === null || val === '') return false
  if (typeof val === 'number') return val > 0
  if (Array.isArray(val)) return val.length > 0
  if (typeof val === 'string') return val.trim().length > 0
  return true
}

// ─── 9-Step Journey Definition ───────────────────────────────────────

type SectionDefinition = {
  weight: number
  fields: { key: keyof StudentProfile; label: string; reason: string }[]
}

const SECTION_DEFS: Record<keyof ProfileScoreResult['sections'], SectionDefinition> = {
  identity: {
    weight: 10,
    fields: [
      { key: 'name', label: 'Full Name', reason: 'Basic identity setup.' },
      { key: 'mobile', label: 'Mobile Number', reason: 'For account security and updates.' },
      { key: 'dob', label: 'Date of Birth', reason: 'Required for age-specific university criteria.' },
      { key: 'city', label: 'City', reason: 'Helps us find local events and experts.' },
    ]
  },
  academics: {
    weight: 15,
    fields: [
      { key: 'undergradCollege', label: 'Undergraduate College', reason: 'Needed for academic pedigree analysis.' },
      { key: 'undergradDegree', label: 'Degree', reason: 'To verify eligibility for Master\'s programs.' },
      { key: 'undergradSpecialization', label: 'Specialization', reason: 'Aligns with your future target field.' },
      { key: 'undergradCgpa', label: 'CGPA', reason: 'Crucial for admission probability predictions.' },
      { key: 'undergradGradYear', label: 'Graduation Year', reason: 'To calculate career gaps or work experience.' },
    ]
  },
  workExp: {
    weight: 10,
    fields: [
      { key: 'isWorkingProfessional', label: 'Working Professional Status', reason: 'Determines if we need to account for work experience.' },
    ]
  },
  destination: {
    weight: 10,
    fields: [
      { key: 'studyGoal', label: 'Study Goal', reason: 'Are you looking abroad or domestic?' },
      { key: 'targetCountries', label: 'Target Countries', reason: 'To filter universities and visa rules.' },
      { key: 'targetDegree', label: 'Target Degree', reason: 'To find the right programs (MS, MBA, etc).' },
      { key: 'targetField', label: 'Target Field', reason: 'To match you with department-specific rankings.' },
      { key: 'intakeTarget', label: 'Intake Target', reason: 'To map out your application timeline.' },
    ]
  },
  exams: {
    weight: 10,
    fields: [
      { key: 'greStatus', label: 'GRE Status', reason: 'To determine if test prep is required.' },
      { key: 'ieltsStatus', label: 'English Proficiency Status', reason: 'Required for international admissions.' },
    ]
  },
  universities: {
    weight: 10,
    fields: [
      { key: 'topPreferenceFactor', label: 'Top Preference Factor', reason: 'To rank universities according to what you value most.' },
      { key: 'universityResearchStage', label: 'Research Stage', reason: 'To provide the right level of guidance.' },
    ]
  },
  financials: {
    weight: 15,
    fields: [
      { key: 'fundingSource', label: 'Funding Source', reason: 'To recommend loans vs scholarships.' },
      { key: 'expectedBudgetStr', label: 'Expected Budget', reason: 'To match you with affordable countries.' },
      { key: 'loanEstimateStr', label: 'Loan Estimate', reason: 'To connect you with the right financial partners.' },
      { key: 'familyIncomeStr', label: 'Family Income', reason: 'For scholarship eligibility.' },
    ]
  },
  documents: {
    weight: 15,
    fields: [
      { key: 'docPassport', label: 'Passport Status', reason: 'Required for any international application.' },
      { key: 'docTranscripts', label: 'Transcripts Status', reason: 'Needed for university evaluations.' },
      { key: 'docSop', label: 'SOP Status', reason: 'To track essay progress.' },
      { key: 'docResume', label: 'Resume Status', reason: 'Crucial for applications and experts.' },
    ]
  },
  preferences: {
    weight: 5,
    fields: [
      { key: 'preferredLanguage', label: 'Preferred Language', reason: 'For communication preferences.' },
      { key: 'notificationPreference', label: 'Notification Preference', reason: 'To keep you updated.' },
    ]
  }
}

// ─── Main Calculator ─────────────────────────────────────────────────

export function calculateProfileScore(profile: StudentProfile): ProfileScoreResult {
  let totalScore = 0
  const sections: any = {}
  const allMissing: MissingField[] = []

  for (const [secKeyStr, def] of Object.entries(SECTION_DEFS)) {
    const secKey = secKeyStr as keyof ProfileScoreResult['sections']
    let filled = 0
    let total = def.fields.length
    const missing: MissingField[] = []

    for (const field of def.fields) {
      if (hasValue(profile[field.key])) {
        filled++
      } else {
        missing.push({ key: field.key as string, label: field.label, reason: field.reason, section: secKey })
      }
    }

    // Special logic for Work Exp (if working professional is yes, expect more fields)
    if (secKey === 'workExp' && profile.isWorkingProfessional === 'Yes') {
      const extraFields: { key: keyof StudentProfile; label: string; reason: string }[] = [
        { key: 'companyName', label: 'Company Name', reason: 'To analyze employment prestige.' },
        { key: 'yearsExperience', label: 'Years of Experience', reason: 'For MBA and specialized MS requirements.' }
      ]
      total += extraFields.length
      for (const field of extraFields) {
        if (hasValue(profile[field.key])) {
          filled++
        } else {
          missing.push({ key: field.key as string, label: field.label, reason: field.reason, section: secKey })
        }
      }
    }

    const score = total > 0 ? Math.round((filled / total) * def.weight) : def.weight
    totalScore += score

    sections[secKey] = {
      score,
      max: def.weight,
      filled,
      total,
      missing
    }
    allMissing.push(...missing)
  }

  // Ensure capping at 100
  totalScore = Math.min(100, totalScore)

  return {
    totalScore,
    sections,
    missingFields: allMissing,
  } as ProfileScoreResult
}

// ─── Legacy-compatible wrapper ───────────────────────────────────────

export function calculateProfileCompleteness(profile: StudentProfile): number {
  return calculateProfileScore(profile).totalScore
}
