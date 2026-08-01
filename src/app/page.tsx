'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import LandingPage from '@/components/LandingPage'
import OnboardingFlow from '@/components/OnboardingFlow'
import DashboardLayout from '@/components/DashboardLayout'
import ExpertLayout from '@/components/ExpertLayout'
import AdminLayout from '@/components/AdminLayout'
import AuthPage from '@/components/AuthPage'
import { createClient } from '@/lib/supabase/client'
import { useNetworkStore } from '@/lib/networkStore'
import { decodeContentInterest } from '@/lib/contentInterestCodec'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const { currentPage, isOnboarded, user, setUser, setCurrentPage, updateProfile, setOnboarded, profile } = useAppStore()
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    useNetworkStore.getState().seedMockData()
    const supabase = createClient()
    
    const fetchProfile = async (userId: string) => {
      try {
        setIsInitializing(true)
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
        if (data && !error) {
          // Decode the content_interest jsonb column. Accepts both the legacy
          // `string[]` shape and the new `{ v: 2, tags, domesticMeta }` payload
          // (see src/lib/contentInterestCodec.ts and design.md "Persistence Mapping").
          const { contentInterest, domesticMeta } = decodeContentInterest(data.content_interest)
          // Map snake_case to camelCase
          updateProfile({
            id: data.id,
            name: data.name || '',
            mobile: data.mobile || '',
            dob: data.dob || '',
            gender: data.gender || '',
            city: data.city || '',
            state: data.state || '',
            educationLevel: data.education_level || '',
            tenthMarks: data.tenth_marks || '',
            twelfthMarks: data.twelfth_marks || '',
            twelfthStream: data.twelfth_stream || '',
            undergradCollege: data.undergrad_college || '',
            undergradDegree: data.undergrad_degree || '',
            undergradSpecialization: data.undergrad_specialization || '',
            undergradCgpa: data.undergrad_cgpa || '',
            undergradGradYear: data.undergrad_grad_year || '',
            hasBacklogs: data.backlogs || '',
            hasResearchPapers: data.research_papers || '',
            internshipsCount: data.internships || '',
            extracurricularRoles: data.extracurriculars || '',
            isWorkingProfessional: data.is_working_professional || '',
            companyName: data.company_name || '',
            industry: data.industry || '',
            jobRole: data.job_role || '',
            yearsExperience: data.years_experience || '',
            currentCtc: data.current_ctc || '',
            careerGap: data.career_gap || '',
            studyGoal: data.study_goal || '',
            targetCountries: data.target_countries || [],
            targetDegree: data.target_degree || '',
            targetField: data.target_field || '',
            intakeTarget: data.intake_target || '',
            applicationStage: data.application_stage || '',
            greStatus: data.gre_status || '',
            greScoreStr: data.gre_score || '',
            gmatStatus: data.gmat_status || '',
            gmatScoreStr: data.gmat_score || '',
            ieltsStatus: data.ielts_status || '',
            ieltsScore: data.ielts_score ? parseInt(data.ielts_score) : 0,
            toeflStatus: data.toefl_status || '',
            toeflScore: data.toefl_score ? parseInt(data.toefl_score) : 0,
            gateStatus: data.gate_status || '',
            gateScoreStr: data.gate_score || '',
            catStatus: data.cat_status || '',
            catScoreStr: data.cat_score || '',
            neetStatus: data.neet_status || '',
            examNextDate: data.exam_next_date || '',
            dreamUniversities: data.dream_universities || [],
            targetUniversitiesList: data.target_universities || [],
            safeUniversities: data.safe_universities || [],
            preferenceFactors: data.preference_factors || [],
            universityResearchStage: data.university_research_stage || '',
            fundingSource: data.funding_source || '',
            expectedBudgetStr: data.expected_budget || '',
            loanEstimateStr: data.loan_estimate || '',
            collateralAvailableStr: data.collateral_available || '',
            familyIncomeStr: data.family_income || '',
            coApplicantStr: data.co_applicant || '',
            creditScoreStr: data.credit_score || '',
            docPassport: data.doc_passport || '',
            docTranscripts: data.doc_transcripts || '',
            docLors: data.doc_lors || '',
            docSop: data.doc_sop || '',
            docResume: data.doc_resume || '',
            docBankStatements: data.doc_bank_statements || '',
            docVisa: data.doc_visa || '',
            preferredLanguage: data.preferred_language || '',
            notificationPreference: data.notification_preference || '',
            contentInterest,
            hearAboutUs: data.hear_about_us || '',
            referralCode: data.referral_code || '',
            isOnboarded: data.is_onboarded || false,
            role: data.role || 'student',
            
            // Expert Fields
            kycStatus: data.kyc_status,
            kycRejectionReason: data.kyc_rejection_reason,
            kycDocuments: data.kyc_documents,
            expertSpecializations: data.expert_specializations,
            expertCountries: data.expert_countries,
            bio: data.bio,
            linkedinUrl: data.linkedin_url,
            rating: data.rating,
            studentsHelped: data.students_helped,
            sessionRate: data.session_rate,
            earningsThisMonth: data.earnings_this_month,

            // Domestic Track MVP fields decoded from content_interest.domesticMeta.
            // Spread last so any future renames in the codec flow through without
            // a manual mapping table here. Per design.md "Persistence Mapping",
            // domesticMeta keys are already camelCase and align 1:1 with StudentProfile.
            ...domesticMeta,
          })
          setOnboarded(data.is_onboarded || false)
        }
      } catch (err) {
        console.error("Failed to fetch profile", err)
      } finally {
        setIsInitializing(false)
      }
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const state = useAppStore.getState()
      // Protect the mock Admin & Agent bypass session from being overwritten
      if ((state.profile.role === 'admin' && state.user?.id === 'mock-admin-id') || 
          (state.profile.role === 'expert' && state.user?.id === 'mock-agent-id')) {
        setIsInitializing(false)
        return
      }

      setUser(session?.user ?? null)
      if (session?.user) {
        updateProfile({ id: session.user.id })
        fetchProfile(session.user.id).then(() => setIsInitializing(false))
      } else {
        setIsInitializing(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const state = useAppStore.getState()
      if ((state.profile.role === 'admin' && state.user?.id === 'mock-admin-id') || 
          (state.profile.role === 'expert' && state.user?.id === 'mock-agent-id')) {
        return
      }

      setUser(session?.user ?? null)
      if (session?.user) {
        if (currentPage === 'landing') {
          setCurrentPage('onboarding')
        }
        updateProfile({ id: session.user.id })
        fetchProfile(session.user.id)
      } else {
        // Handle logout cleanup if needed
      }
    })

    return () => subscription.unsubscribe()
  }, [setUser, currentPage, setCurrentPage, updateProfile, setOnboarded])

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // Show landing page
  if (currentPage === 'landing' && !user) {
    return <LandingPage />
  }

  // Force auth if not logged in and not on landing
  if (!user) {
    return <AuthPage />
  }

  // Show onboarding if not completed (Only for students)
  if ((currentPage === 'onboarding' || (!isOnboarded && currentPage !== 'landing')) && profile.role !== 'admin' && profile.role !== 'expert') {
    return <OnboardingFlow />
  }

  // Show dashboard based on role
  if (profile.role === 'admin') {
    return <AdminLayout />
  }

  if (profile.role === 'expert') {
    return <ExpertLayout />
  }

  return <DashboardLayout />
}
