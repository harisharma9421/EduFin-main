import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { StudentProfile } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatINR(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`
  }
  return `₹${amount.toLocaleString('en-IN')}`
}

export function formatUSD(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`
}

export function calculateEMI(principal: number, rate: number, tenure: number): number {
  const monthlyRate = rate / 12 / 100
  const n = tenure * 12
  if (monthlyRate === 0) return principal / n
  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
  return Math.round(emi)
}

export function parseBudgetToLakhs(budgetStr?: string): number {
  if (!budgetStr) return 0
  if (budgetStr.includes('Below 20L')) return 15
  if (budgetStr.includes('20L – 40L')) return 30
  if (budgetStr.includes('40L – 60L')) return 50
  if (budgetStr.includes('60L – 80L')) return 70
  if (budgetStr.includes('80L+')) return 90
  return 0
}

export function parseNumber(val: string | number | undefined | null, fallback = 0): number {
  if (typeof val === 'number') return val
  if (!val) return fallback
  const parsed = parseFloat(val)
  return isNaN(parsed) ? fallback : parsed
}

export function calculateDreamScore(profile: Partial<StudentProfile>): number {
  // Parse legacy or new schema
  const cgpa = parseNumber(profile.cgpa) || parseNumber(profile.undergradCgpa)
  const greScore = parseNumber(profile.greScore) || parseNumber(profile.greScoreStr)
  const ieltsScore = parseNumber(profile.ieltsScore)
  const workExpYears = parseNumber(profile.workExpYears) || parseNumber(profile.yearsExperience)
  
  const sopComplete = profile.sopComplete || profile.docSop === 'Ready'
  const lorCount = parseNumber(profile.lorCount) || (profile.docLors === 'Ready' ? 3 : profile.docLors === 'In Progress' ? 1 : 0)
  const researchPapers = parseNumber(profile.researchPapers) || (profile.hasResearchPapers === 'Yes' ? 1 : 0)
  const extracurriculars = parseNumber(profile.extracurriculars) || (profile.extracurricularRoles ? 2 : 0)
  
  const loanEligible = profile.loanEligible || profile.fundingSource === 'Education Loan' || true // default positive
  const savingsLakhs = parseNumber(profile.savingsLakhs) || 5 // default buffer
  const coBorrowerIncome = parseNumber(profile.coBorrowerIncome) || (profile.coApplicantStr === 'Yes' ? 1000000 : 0)
  
  const universitiesFinalized = parseNumber(profile.universitiesFinalized) || (profile.targetUniversitiesList?.length || 0)
  const applicationsSubmitted = parseNumber(profile.applicationsSubmitted) || (profile.applicationStage === 'Applications in Progress' ? 2 : 0)
  const visaDocsReady = profile.visaDocsReady || profile.docVisa === 'Ready'

  // Academic Score (30%)
  const normalizedCGPA = Math.min(cgpa / 10, 1)
  const normalizedGRE = Math.min(greScore / 340, 1)
  const normalizedIELTS = Math.min(ieltsScore / 9, 1)
  const academicScore = normalizedCGPA * 0.4 + normalizedGRE * 0.4 + normalizedIELTS * 0.2

  // Financial Score (25%)
  const loanEligibility = loanEligible ? 1 : 0
  const savingsBuffer = Math.min(savingsLakhs / 20, 1)
  const coBorrowerScore = Math.min(coBorrowerIncome / 1500000, 1)
  const financialScore = loanEligibility * 0.5 + savingsBuffer * 0.3 + coBorrowerScore * 0.2

  // Profile Strength (25%)
  const sopScore = sopComplete ? 1 : 0
  const lorScore = Math.min(lorCount / 3, 1)
  const workExpScore = Math.min(workExpYears / 5, 1)
  const researchScore = Math.min(researchPapers / 3, 1)
  const extraScore = Math.min(extracurriculars / 5, 1)
  const profileStrength = sopScore * 0.3 + lorScore * 0.3 + workExpScore * 0.2 + researchScore * 0.1 + extraScore * 0.1

  // Application Progress (20%)
  const uniProgress = Math.min(universitiesFinalized / 5, 1)
  const appProgress = Math.min(applicationsSubmitted / 5, 1)
  const visaProgress = visaDocsReady ? 1 : 0
  const applicationProgress = uniProgress * 0.3 + appProgress * 0.5 + visaProgress * 0.2

  const totalScore = (
    academicScore * 0.30 +
    financialScore * 0.25 +
    profileStrength * 0.25 +
    applicationProgress * 0.20
  ) * 1000

  return Math.round(totalScore)
}

export function getAdmissionProbability(
  cgpaInput: number | string | undefined,
  greScoreInput: number | string | undefined,
  universityRanking: number
): { probability: number; category: 'reach' | 'match' | 'safety' } {
  const cgpa = parseNumber(cgpaInput, 7)
  const greScore = parseNumber(greScoreInput, 300)
  let score = 0
  
  // CGPA component (max 40)
  score += (cgpa / 10) * 40
  
  // GRE component (max 40)
  score += (greScore / 340) * 40
  
  // University ranking adjustment (max 20)
  if (universityRanking <= 20) score -= 15
  else if (universityRanking <= 50) score -= 8
  else if (universityRanking <= 100) score -= 3
  else score += 5
  
  // Normalize to 0-100
  const probability = Math.max(5, Math.min(95, score + 10))
  
  let category: 'reach' | 'match' | 'safety'
  if (probability < 35) category = 'reach'
  else if (probability < 65) category = 'match'
  else category = 'safety'
  
  return { probability: Math.round(probability), category }
}

export function getLoanEligibility(
  cgpa: number,
  familyIncome: number,
  hasCollateral: boolean,
  universityRanking: number,
  loanAmount: number
): {
  eligible: boolean
  maxAmount: number
  interestRate: number
  nbfc: string
  reason: string
}[] {
  const results = []
  
  // Avanse Rules
  const avanseMaxWithCollateral = hasCollateral ? 7500000 : 4000000
  const avanseRate = hasCollateral ? 10.5 : 12.5
  results.push({
    eligible: cgpa >= 6.0 && loanAmount <= avanseMaxWithCollateral,
    maxAmount: avanseMaxWithCollateral,
    interestRate: avanseRate,
    nbfc: 'Avanse Financial',
    reason: cgpa < 6.0 ? 'Minimum CGPA 6.0 required' : 'Eligible based on profile'
  })
  
  // Auxilo Rules
  const auxiloMax = hasCollateral ? 10000000 : 5000000
  const auxiloRate = hasCollateral ? 10.0 : 12.0
  results.push({
    eligible: cgpa >= 5.5 && familyIncome >= 300000,
    maxAmount: auxiloMax,
    interestRate: auxiloRate,
    nbfc: 'Auxilo Finserve',
    reason: cgpa < 5.5 ? 'Minimum CGPA 5.5 required' : familyIncome < 300000 ? 'Minimum family income ₹3L required' : 'Eligible based on profile'
  })
  
  // HDFC Credila Rules
  const hdfcMax = hasCollateral ? 10000000 : 3500000
  const hdfcRate = universityRanking <= 50 ? 9.5 : hasCollateral ? 10.5 : 13.0
  results.push({
    eligible: cgpa >= 6.5 && universityRanking <= 200,
    maxAmount: hdfcMax,
    interestRate: hdfcRate,
    nbfc: 'HDFC Credila',
    reason: cgpa < 6.5 ? 'Minimum CGPA 6.5 required' : universityRanking > 200 ? 'University must be in top 200' : 'Eligible based on profile'
  })
  
  // MPOWER (US/Canada only, no collateral needed)
  results.push({
    eligible: cgpa >= 6.0,
    maxAmount: 5000000,
    interestRate: 13.5,
    nbfc: 'MPOWER Financing',
    reason: cgpa < 6.0 ? 'Minimum CGPA 6.0 required' : 'No collateral/co-signer needed (US/Canada only)'
  })
  
  return results
}
