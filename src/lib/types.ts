export interface StudentProfile {
  id?: string
  name: string
  email?: string
  
  // Legacy fields (kept for backward compatibility with other components)
  cgpa: number
  greScore: number
  gmatScore?: number
  ieltsScore: number
  toeflScore?: number
  workExpYears: number
  targetCountry: string[]
  targetProgram: string
  budgetLakhs: number
  currentDegree: string
  currentUniversity: string
  researchPapers: number
  extracurriculars: number
  sopComplete: boolean
  lorCount: number
  loanEligible: boolean
  savingsLakhs: number
  coBorrowerIncome: number
  universitiesFinalized: number
  applicationsSubmitted: number
  visaDocsReady: boolean
  dreamScore: number
  streakDays: number
  xpPoints: number
  badges: string[]
  careerInterest?: string
  yearOfStudy?: number
  backlogs?: number
  targetIntake?: string
  familyIncome?: number
  hasCoApplicant?: boolean
  collateralType?: 'property' | 'FD' | 'none'
  existingLoans?: number
  priority?: 'placement' | 'research' | 'cost' | 'ranking'
  journeyStage: 'EXPLORER' | 'RESEARCHER' | 'APPLICANT' | 'LOAN_SEEKER' | 'SUBMITTED'

  // Roles & Permissions
  role?: 'student' | 'expert' | 'admin'

  // EXPERT SPECIFIC FIELDS
  expertSpecializations?: string[]
  expertCountries?: string[]
  kycStatus?: 'pending' | 'verified' | 'rejected'
  kycRejectionReason?: string
  rating?: number
  studentsHelped?: number
  responseTimeHrs?: number
  earningsThisMonth?: number
  sessionRate?: number
  linkedinUrl?: string
  bio?: string
  kycDocuments?: { type: string, url: string, name: string }[]
  avatar?: string

  // NEW ONBOARDING FIELDS
  mobile?: string
  dob?: string
  gender?: string
  city?: string
  state?: string
  educationLevel?: string
  
  // Step 2
  tenthMarks?: string
  twelfthMarks?: string
  twelfthStream?: string
  undergradCollege?: string
  undergradDegree?: string
  undergradSpecialization?: string
  undergradCgpa?: string
  undergradGradYear?: string
  hasBacklogs?: string
  hasResearchPapers?: string
  internshipsCount?: string
  extracurricularRoles?: string
  
  // Step 3
  isWorkingProfessional?: string
  companyName?: string
  industry?: string
  jobRole?: string
  yearsExperience?: string
  currentCtc?: string
  careerGap?: string
  
  // Step 4
  studyGoal?: string
  targetCountries?: string[]
  targetDegree?: string
  targetField?: string
  intakeTarget?: string
  applicationStage?: string
  
  // Step 5
  greStatus?: string
  greScoreStr?: string
  gmatStatus?: string
  gmatScoreStr?: string
  ieltsStatus?: string
  toeflStatus?: string
  gateStatus?: string
  gateScoreStr?: string
  catStatus?: string
  catScoreStr?: string
  neetStatus?: string
  examNextDate?: string
  
  // Step 6
  dreamUniversities?: string[]
  targetUniversitiesList?: string[]
  safeUniversities?: string[]
  preferenceFactors?: string[]
  topPreferenceFactor?: string
  universityResearchStage?: string
  
  // Step 7
  fundingSource?: string
  expectedBudgetStr?: string
  loanEstimateStr?: string
  collateralAvailableStr?: string
  familyIncomeStr?: string
  coApplicantStr?: string
  creditScoreStr?: string
  
  // Step 8
  docPassport?: string
  docTranscripts?: string
  docLors?: string
  docSop?: string
  docResume?: string
  docBankStatements?: string
  docVisa?: string
  
  // Step 9
  preferredLanguage?: string
  notificationPreference?: string
  contentInterest?: string[]
  hearAboutUs?: string
  referralCode?: string
  isOnboarded?: boolean
  created_at?: string

  // ───────── Domestic Track MVP additions (additive only) ─────────
  // Derived study-path indicator. Persisted via the content_interest jsonb codec.
  track?: Track

  // Onboarding Step 5 — Indian-exam inputs (numeric forms used by the predictor).
  // These coexist with the existing string-bucket fields (e.g. gateScoreStr) and do not replace them.
  jeeAdvancedRank?: number
  gateScore?: number
  gateScoreYear?: number
  gateRank?: number
  catPercentile?: number
  reservationCategory?: ReservationCategory
  homeState?: string

  // Selected target institute id from the Domestic Admission Predictor.
  targetInstituteId?: string

  // Set true when the user is on the domestic/both track but has not entered any Indian-exam score.
  domesticExamScoreMissing?: boolean

  // Numeric family income in INR for the domestic loan engine and CSIS calculator.
  // Coexists with the existing string-bucket field `familyIncomeStr`.
  familyAnnualIncomeINR?: number

  // Indian entrance exams selected during onboarding (Gemini-assisted picker).
  // National + state-level Medical / Engineering exams with the student's
  // marks and rank. Persisted via the content_interest jsonb codec.
  entranceExams?: EntranceExamEntry[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Indian entrance exam picker (onboarding Step 5)
// ─────────────────────────────────────────────────────────────────────────────

export type EntranceExamStream = 'Medical' | 'Engineering'

/** "National" or a specific Indian state / union territory name. */
export type EntranceExamRegion = string

/** A single exam the student has appeared for, with their result. */
export interface EntranceExamEntry {
  /** Stable client-generated id used as the React key and for removal. */
  id: string
  stream: EntranceExamStream
  /** 'National' or the state/UT name selected in the region dropdown. */
  region: EntranceExamRegion
  /** Exam short name, e.g. "JEE Main", "NEET UG", "MHT CET". */
  examName: string
  /** Free-text marks / score (e.g. percentile, raw marks). */
  marks?: string
  /** Free-text rank (e.g. AIR, category rank). */
  rank?: string
}

/** One exam option returned by the Gemini-backed `/api/entrance-exams` route. */
export interface EntranceExamOption {
  name: string
  fullName: string
  conductingBody: string
  level: 'National' | 'State'
}

/**
 * A single college recommendation returned by the Gemini-backed
 * `/api/domestic-colleges` route. Derived from the Indian exam(s) the student
 * appeared for (national or state level), with a branch-wise cutoff for the
 * student's reservation category and an admission-chance classification based
 * on the rank / marks they entered during onboarding.
 */
export interface DomesticCollegeResult {
  /** Stable id for React keys / selection (client- or route-generated). */
  id: string
  name: string
  city: string
  state: string
  /** Branch / program, e.g. "Computer Science", "MBBS". */
  branch: string
  /** Institute category, e.g. "IIT", "NIT", "IIIT", "AIIMS", "Govt Medical". */
  collegeType: string
  /** Exam this recommendation is keyed to, e.g. "JEE Advanced", "NEET UG". */
  examName: string
  stream: EntranceExamStream
  /** Human-readable closing cutoff for the student's category. */
  cutoffLabel: string
  /** Numeric closing cutoff value for the student's category (rank or percentile). */
  closingRank: number | null
  /**
   * Whether `closingRank` is a rank (lower = more selective, e.g. JEE/NEET/most
   * state CETs) or a percentile (higher = more selective, e.g. MHT CET).
   */
  cutoffType?: 'rank' | 'percentile'
  /**
   * National desirability / quality score in [0, 100] (higher = better college
   * for this branch). This is comparable ACROSS exams (rank-based national
   * exams and percentile-based state exams), so a combined list can be ranked
   * by genuine college quality rather than by incomparable raw cutoffs.
   */
  qualityScore?: number
  /** Human-readable annual fees. */
  feesLabel: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Domestic College Detail — rich stats shown when a student opens a college
// from the Domestic Admission Predictor. Fetched from `/api/college-detail`
// (Gemini-backed) with a graceful fallback. All figures are AI-estimated and
// flagged as such in the UI.
// ─────────────────────────────────────────────────────────────────────────────

/** Placement statistics for a single year of a branch/program. */
export interface PlacementYearStat {
  /** Placement year, e.g. "2025" or "2024-25". */
  year: string
  /** Percentage of students placed (0–100). */
  placementRate: number
  /** Average annual package in LPA (lakhs per annum). */
  avgPackageLPA: number
  /** Median annual package in LPA. */
  medianPackageLPA: number
  /** Highest annual package in LPA. */
  highestPackageLPA: number
  /** Notable recruiters for this branch in this year. */
  topRecruiters: string[]
}

/** Year-wise placement statistics for a single branch/program at a college. */
export interface BranchPlacementStat {
  branch: string
  /** One entry per placement year, most recent first. */
  years: PlacementYearStat[]
}

/** A single student review of the college. */
export interface CollegeReview {
  author: string
  /** Overall rating out of 5. */
  rating: number
  /** Graduating batch year or "Current student". */
  batch: string
  branch: string
  pros: string
  cons: string
  comment: string
  /** Link to the source review (e.g. Glassdoor / Shiksha) when available. */
  sourceUrl?: string
}

/** One year of a branch's curriculum outline. */
export interface CurriculumYear {
  year: string
  subjects: string[]
}

/** Curriculum for a single branch. */
export interface BranchCurriculum {
  branch: string
  durationYears: number
  degree: string
  years: CurriculumYear[]
}

/** Campus / facilities information. */
export interface CampusInfo {
  established: number | null
  campusSizeAcres: number | null
  hostelAvailable: boolean
  facilities: string[]
  accreditation: string[]
  nirfRank: number | null
  location: string
  summary: string
}

/** Full college detail payload returned by `/api/college-detail`. */
export interface DomesticCollegeDetailData {
  name: string
  city: string
  state: string
  collegeType: string
  /** One-line description / overview of the college. */
  overview: string
  /** Overall rating out of 5 (aggregate of reviews). */
  overallRating: number
  /** Per-branch placement statistics (user picks which to view). */
  placements: BranchPlacementStat[]
  /** Per-branch curriculum outlines (user picks which to view). */
  curricula: BranchCurriculum[]
  /** Student reviews. */
  reviews: CollegeReview[]
  /** Campus / facilities information. */
  campus: CampusInfo
  /** Key quick-stat highlights (label/value pairs). */
  quickStats: { label: string; value: string }[]
}

/**
 * A single real education-loan product for the selected domestic college,
 * fetched live via Serper + Gemini from `/api/domestic-loans`. URLs are taken
 * verbatim from search results (never invented).
 */
export interface DomesticLoanResult {
  /** Loan product name, e.g. "SBI Scholar Loan". */
  name: string
  /** Lender, e.g. "State Bank of India". */
  provider: string
  /** Lender category: Bank, NBFC, Govt Scheme, etc. */
  providerType: string
  /** Short factual summary of the product. */
  summary: string
  /** Why this product fits the selected college / profile. */
  fitReason: string
  /** Human-readable interest rate band, e.g. "8.5% – 11.0% p.a.". */
  interestRate: string
  /** Maximum loan amount in INR. */
  maxLoanINR: number
  /** Human-readable tenure, e.g. "Up to 15 years". */
  tenure: string
  /** Collateral note. */
  collateral: string
  /** Processing fee note. */
  processingFee: string
  /** Moratorium note. */
  moratorium: string
  /** Notable features / benefits. */
  features: string[]
  /** Official apply URL (verbatim from search results). */
  applyUrl: string
  /** Source URL the data was grounded in. */
  sourceUrl: string
  /** Source hostname for display. */
  sourceName: string
  /** Whether this product is specifically tied to / better for this college. */
  collegeSpecific: boolean
}

export interface University {
  id: string
  name: string
  country: string
  city: string
  ranking: number
  avgGRE: number
  avgCGPA: number
  tuitionUSD: number
  program: string
  acceptanceRate: number
  logoUrl?: string
  description: string
  avgSalaryUSD: number
  programDuration: number
}

export interface LoanOffer {
  nbfc: string
  eligible: boolean
  maxAmount: number
  interestRate: number
  processingFee: number
  moratoriumMonths: number
  prepaymentPenalty: string
  reason: string
  logo?: string
  bestFor?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface ChatMessageAttachment {
  type: 'document' | 'image' | 'audio'
  url: string
  name: string
}

export interface ExpertMessage {
  id: string
  chatId: string
  senderId: string
  senderRole: 'student' | 'expert' | 'system'
  content: string
  timestamp: string
  isRead: boolean
  attachments?: ChatMessageAttachment[]
}

export interface ExpertChatSession {
  id: string
  studentId: string
  expertId: string
  lastMessageAt: string
  status: 'active' | 'closed'
}

export interface CareerPath {
  title: string
  description: string
  countries: string[]
  avgSalaryUSD: number
  growthRate: string
  universities: University[]
  skills: string[]
  icon: string
}

export interface Scholarship {
  id: string
  name: string
  provider: string
  amount: number
  currency: string
  country: string
  deadline: string
  eligibility: string
  matchScore: number
  field: string
  type: 'Merit' | 'Need' | 'Research' | 'Diversity'
}

export interface SuccessStory {
  id: string
  anonymizedName: string
  backgroundUniversity: string
  cgpa: number
  greScore: number
  workExp: number
  targetUniversity: string
  targetCountry: string
  program: string
  loanAmount: number
  nbfc: string
  currentSalaryUSD: number
  yearOfAdmission: number
  avatar: string
}

export interface Professor {
  id: string
  name: string
  university: string
  department: string
  researchAreas: string[]
  email: string
  hIndex: number
  recentPapers: string[]
  photoUrl?: string
}

export type PageType = 
  | 'landing' 
  | 'onboarding' 
  | 'dashboard' 
  | 'career-navigator' 
  | 'roi-calculator' 
  | 'admission-predictor' 
  | 'college-match'
  | 'loan-center' 
  | 'emi-calculator' 
  | 'sop-copilot' 
  | 'visa-simulator' 
  | 'mentor-chat'
  | 'scholarship-hunter'
  | 'professor-match'
  | 'clone-journey'
  | 'ai-journey'
  | 'currency-risk'
  | 'living-cost'
  | 'news'
  | 'form-guide'
  | 'timeline'
  | 'interview-prep'
  | 'referrals'
  | 'gamification'
  | 'document-vault'
  | 'growth-tools'
  | 'profile'
  | 'extension'
  
  // User Expert Network
  | 'expert-directory'
  | 'user-expert-chat'

  // Expert Dashboard
  | 'expert-home'
  | 'expert-students'
  | 'expert-chat'
  | 'expert-kyc'
  | 'expert-earnings'

  // Admin Dashboard
  | 'admin-analytics'
  | 'admin-kyc'
  | 'admin-users'
  | 'admin-experts'

  // Domestic Track MVP
  | 'domestic-admission-predictor'
  | 'domestic-loan-center'
  | 'domestic-college-detail'

// Loan Application types
export type LoanAppStep = 'eligibility' | 'documents' | 'form' | 'tracking'

export interface LoanDocument {
  id: string
  name: string
  category: 'kyc' | 'academic' | 'financial' | 'admission'
  required: boolean
  status: 'pending' | 'uploaded' | 'verified' | 'not-required'
  tip: string
}

export interface LoanApplication {
  id: string
  step: LoanAppStep
  eligibilityScore: number
  maxLoanAmount: number
  minLoanAmount: number
  interestRateMin: number
  interestRateMax: number
  selectedLender: string
  documents: LoanDocument[]
  formData: Record<string, string>
  formStrength: number
  status: 'draft' | 'submitted' | 'review' | 'verified' | 'assessment' | 'sanctioned'
  submittedAt?: string
  createdAt: string
}

// Gamification types
export type UserLevel = 'Explorer' | 'Aspirant' | 'Contender' | 'Scholar' | 'Champion'

export interface XPEvent {
  id: string
  action: string
  points: number
  timestamp: string
}

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'urgent'
  read: boolean
  timestamp: string
  actionPage?: PageType
}

export interface ReferralData {
  code: string
  referrals: { name: string; joinedAt: string; onboarded: boolean }[]
  coins: number
  tier: 'Bronze' | 'Silver' | 'Gold'
}

export interface TimelineMilestone {
  id: string
  title: string
  description: string
  phase: string
  weekNumber: number
  completed: boolean
  dueDate: string
}

export interface EventLog {
  id: string
  userId: string
  event: string
  metadata: Record<string, any>
  timestamp: string}

export type DecisionPhase = 
  | 'PHASE_1_PROFILE'
  | 'PHASE_2_COUNTRY'
  | 'PHASE_3_UNIVERSITY'
  | 'PHASE_4_ADMISSION'
  | 'PHASE_5_COST'
  | 'PHASE_6_AFFORDABILITY'
  | 'PHASE_7_LOAN'
  | 'PHASE_8_DOCUMENTS'
  | 'PHASE_9_DOC_ACQUISITION'
  | 'PHASE_10_REVIEWS'
  | 'PHASE_11_ROADMAP'

export interface DecisionEngineState {
  currentPhase: DecisionPhase
  answeredPhases: DecisionPhase[]
  
  // Phase 1
  profileAnalysis?: {
    academicScore: number
    financialScore: number
    admissionReadinessScore: number
    reasoning?: string
    summary?: string
    academicPoints?: string[]
    financialPoints?: string[]
    admissionPoints?: string[]
  }
  
  // Phase 2
  countryDecision?: {
    recommendedCountries: {
      countryName: string
      matchScore: number
      whyRecommended: string | string[]
      whyNotRecommended?: string
      considerations?: string[]
      expectedCost: string
      postStudyWork: string
      jobMarket: number
      visaDifficulty: string
    }[]
  }
  selectedCountry?: string
  
  // Phase 3
  universityMatch?: {
    bestMatchUniversities: {
      id: string
      name: string
      country: string
      admissionChance: number
      ranking: number
      tuition: number
      livingCost: number
      roi: number
      scholarshipAvailability: string
      whyRecommended: string | string[]
    }[]
  }
  selectedUniversity?: string
  
  // Phase 4
  admissionChance?: {
    currentChance: number
    chanceBreakdown?: string
    breakdownPoints?: string[]
    positiveFactors: string[]
    negativeFactors: string[]
    missingRequirements: string[]
    improvedChanceAfterRecs: number
  }
  
  // Phase 5
  totalCost?: {
    tuition: number
    living: number
    insurance: number
    visa: number
    travel: number
    miscellaneous: number
    totalCost: number
    yearlyCost: number
    monthlyCost: number
  }
  
  // Phase 6
  affordability?: {
    canAfford: boolean
    fundingGap: number
    selfFundingCapacity: number
    savingsContribution: number
    familyContribution: number
    reasoning?: string
    reasoningPoints?: string[]
  }
  
  // Phase 7
  loanEngine?: {
    loanAmountRequired: number
    emi: number
    interest: number
    recommendedLenders: string[]
    notes?: string[]
  }
  
  // Phase 8
  documentReadiness?: {
    requiredDocuments: string[]
    available: string[]
    missing: string[]
    pending: string[]
  }
  
  // Phase 9
  documentAcquisition?: {
    guides: {
      documentName: string
      steps: string[]
    }[]
  }
  
  // Phase 10
  reviewIntelligence?: {
    pros: string[]
    cons: string[]
    placementInsights: string
    housingInsights: string
    studentSatisfaction: string
    sentimentScore: number
  }
  
  // Phase 11
  actionRoadmap?: {
    immediateActions: string[]
    day7Plan: string[]
    day30Plan: string[]
    day60Plan: string[]
    day90Plan: string[]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Domestic Track MVP — shared types
// Source of truth: .kiro/specs/domestic-track-mvp/design.md → "Data Models".
// These are additive; nothing above this section was removed or renamed.
// ─────────────────────────────────────────────────────────────────────────────

export type Track = 'abroad' | 'domestic' | 'both'

export type ReservationCategory =
  | 'General'
  | 'OBC-NCL'
  | 'EWS'
  | 'SC'
  | 'ST'
  | 'PwD'

export type ExamType = 'JEE_Advanced' | 'GATE' | 'CAT'

export type ReachMatchSafetyBucket = 'Reach' | 'Match' | 'Safety' | 'Out_Of_Range'

export interface DomesticUniversity {
  id: string
  name: string
  location: string
  examType: ExamType
  /** Annual tuition in INR (positive integer). */
  tuitionINR: number
  /** Average domestic placement CTC in INR (positive integer). */
  avgDomesticPlacementCtcINR: number
  /** Non-negative integer seat counts per reservation category. */
  seatMatrix: Record<ReservationCategory, number>
  /**
   * Closing thresholds per reservation category.
   * For `JEE_Advanced` and `GATE` records this is the closing rank (positive integer).
   * For `CAT` records this is the closing percentile in the inclusive range 0–100.
   */
  closingRanks: Record<ReservationCategory, number>
  isNotifiedForCSIS: boolean
}

export interface DomesticLoanCriteria {
  /** When true, target institute id must be in the premier institute list. */
  premierInstituteRequired?: boolean
  /** When true, the profile must have a co-applicant available. */
  coApplicantRequired?: boolean
  /** When true, the profile must have collateral available. */
  collateralRequired?: boolean
  /** Inclusive upper bound on familyAnnualIncomeINR for eligibility. */
  maxFamilyAnnualIncomeINR?: number
}

export interface DomesticLoanProduct {
  id: string
  bankName: string
  productName: string
  interestRateMin: number
  interestRateMax: number
  maxLoanINR: number
  moratoriumMonths: number
  criteria: DomesticLoanCriteria
  notes?: string
}

export type LoanEligibility =
  | 'Eligible'
  | 'Not_Eligible'
  | 'Conditionally_Eligible'

export interface IndianScholarship {
  id: string
  name: string
  provider: string
  amount: number
  currency: 'INR'
  country: 'India'
  deadline: string
  eligibility: string
  matchScore: number
  field: string
  type: 'Merit' | 'Need' | 'Research' | 'Diversity'
}
