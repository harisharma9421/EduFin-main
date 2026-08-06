'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import {
  User, GraduationCap, Briefcase, Globe,
  BookOpen, Building, Wallet, FileText, Settings,
  ChevronRight, ChevronLeft, Loader2, Sparkles, Check, LogOut, MapPin, Crosshair
} from 'lucide-react'
import { countries } from 'countries-list'
import type { StudentProfile } from '@/lib/types'
import { calculateDreamScore } from '@/lib/utils'
import { useTrack } from '@/lib/useTrack'
import { encodeContentInterest } from '@/lib/contentInterestCodec'
import EntranceExamPicker from '@/components/EntranceExamPicker'
import {
  validateStep5,
  computeDomesticExamScoreMissing,
  type ReservationCategory,
} from '@/lib/onboardingValidation'

const STEPS = [
  { id: 1, title: 'Identity', icon: User },
  { id: 2, title: 'Academics', icon: GraduationCap },
  { id: 3, title: 'Work Exp', icon: Briefcase },
  { id: 4, title: 'Destination', icon: Globe },
  { id: 5, title: 'Exams', icon: BookOpen },
  { id: 6, title: 'Universities', icon: Building },
  { id: 7, title: 'Financials', icon: Wallet },
  { id: 8, title: 'Documents', icon: FileText },
  { id: 9, title: 'Preferences', icon: Settings },
]

const allCountries = Object.values(countries).map(c => c.name).sort()

// Define Input outside the main component so React doesn't unmount it on every keystroke
const Input = ({ label, field, type = "text", placeholder = "", options = [] as string[], allowCustom = false, localData, updateLocal }: any) => {
  const listId = `${field}-options`
  
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-foreground-secondary mb-1">{label}</label>
      {options.length > 0 && !allowCustom ? (
        <select 
          className="input-field" 
          value={localData[field as keyof StudentProfile] as string || ''}
          onChange={(e) => updateLocal(field, e.target.value)}
        >
          <option value="">Select...</option>
          {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <>
          <input 
            type={type} 
            list={allowCustom && options.length > 0 ? listId : undefined}
            placeholder={placeholder}
            className="input-field"
            value={localData[field as keyof StudentProfile] as string || ''}
            onChange={(e) => updateLocal(field, e.target.value)}
          />
          {allowCustom && options.length > 0 && (
            <datalist id={listId}>
              {options.map((o: string) => <option key={o} value={o} />)}
            </datalist>
          )}
        </>
      )}
    </div>
  )
}

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

// Single global loader so we never inject the script twice across renders.
let googleMapsScriptPromise: Promise<void> | null = null
const loadGoogleMapsScript = (key: string | undefined): Promise<void> => {
  if (typeof window === 'undefined' || !key) return Promise.resolve()
  if ((window as any).google?.maps?.places) return Promise.resolve()
  if (googleMapsScriptPromise) return googleMapsScriptPromise

  googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps="1"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google Maps script failed to load')))
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?libraries=places&key=${key}`
    script.async = true
    script.defer = true
    script.dataset.googleMaps = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Maps script failed to load'))
    document.head.appendChild(script)
  })

  return googleMapsScriptPromise
}

// Mount-safe replacement for `usePlacesWidget`. Loads the Google Maps script
// once, attaches `Autocomplete` only after the input is in the DOM and the
// component is still mounted, and tears down cleanly. Eliminates the
// "Input ref must be HTMLInputElement" race that fires when the onboarding
// step unmounts before the script resolves.
function useGooglePlaces(
  onPlaceSelected: (place: any) => void,
  options?: { types?: string[]; fields?: string[] },
) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const autocompleteRef = useRef<any>(null)
  const types = options?.types ?? ['(cities)']
  const fields = options?.fields ?? ['address_components', 'formatted_address', 'name', 'geometry']
  // Stable key so the effect re-runs only if the configured types actually change.
  const typesKey = types.join(',')

  useEffect(() => {
    let cancelled = false
    let listener: any = null

    loadGoogleMapsScript(GOOGLE_MAPS_KEY)
      .then(() => {
        if (cancelled) return
        const w = window as any
        if (!w.google?.maps?.places) return
        if (!(inputRef.current instanceof HTMLInputElement)) return

        autocompleteRef.current = new w.google.maps.places.Autocomplete(inputRef.current, {
          types,
          fields,
        })
        listener = autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace()
          if (place) onPlaceSelectedRef.current(place)
        })
      })
      .catch(() => {
        // Silent fall-through: free-text input still works without autocomplete.
      })

    return () => {
      cancelled = true
      if (listener?.remove) listener.remove()
      autocompleteRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typesKey])

  // Always read the latest callback without retriggering the effect.
  const onPlaceSelectedRef = useRef(onPlaceSelected)
  useEffect(() => {
    onPlaceSelectedRef.current = onPlaceSelected
  }, [onPlaceSelected])

  return inputRef
}

// Extracts city + state from a Google place's address components.
const parsePlace = (place: any): { city: string; state: string; label: string } => {
  let city = ''
  let state = ''
  place?.address_components?.forEach((c: any) => {
    if (c.types.includes('locality')) city = c.long_name
    if (!city && c.types.includes('administrative_area_level_2')) city = c.long_name
    if (c.types.includes('administrative_area_level_1')) state = c.long_name
  })
  const label = place?.formatted_address || place?.name || [city, state].filter(Boolean).join(', ')
  return { city, state, label }
}

// Real Google Places autocomplete input. Shows live suggestions as the user
// types (powered by usePlacesWidget) and supports an optional "use current
// location" button that reverse-geocodes the device GPS coordinates.
const PlacesAutocomplete = ({
  label, field, placeholder, types = ['(cities)'], localData, updateLocal, onPlaceSelected, enableCurrentLocation = false,
}: any) => {
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')

  const handlePlace = useCallback((place: any) => {
    onPlaceSelected?.(place)
  }, [onPlaceSelected])

  const ref = useGooglePlaces(handlePlace)

  const useCurrentLocation = () => {
    setLocError('')
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported on this device.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_KEY}`
          )
          const data = await res.json()
          const result = data.results?.[0]
          if (result) {
            onPlaceSelected?.(result)
            if (ref.current) ref.current.value = result.formatted_address || ''
          } else {
            setLocError('Could not determine your location. Please type it instead.')
          }
        } catch {
          setLocError('Could not fetch your location. Please type it instead.')
        } finally {
          setLocating(false)
        }
      },
      () => {
        setLocError('Location permission denied. Please type your city instead.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-foreground-secondary mb-1 flex items-center gap-1">
        <MapPin className="w-3.5 h-3.5" /> {label}
      </label>
      <div className="flex gap-2">
        <input
          ref={ref as any}
          className="input-field flex-1"
          placeholder={placeholder}
          defaultValue={localData[field] || ''}
          onChange={(e) => updateLocal(field, e.target.value)}
        />
        {enableCurrentLocation && (
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            title="Use my current location"
            className="btn-secondary px-3 flex items-center justify-center"
          >
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
          </button>
        )}
      </div>
      {localData[field] && !locError && (
        <p className="text-xs text-success mt-1 flex items-center gap-1"><Check className="w-3 h-3" /> {localData[field]}</p>
      )}
      {locError && <p className="text-xs text-danger mt-1">{locError}</p>}
      {!GOOGLE_MAPS_KEY && <p className="text-xs text-foreground-muted mt-1">Type your location (autocomplete unavailable)</p>}
    </div>
  )
}

const MultiAutocomplete = ({ label, field, placeholder, localData, updateLocal }: any) => {
  const list: string[] = localData[field as keyof StudentProfile] as string[] || []
  const inputId = `multi-auto-${field}`

  const handleAdd = (placeName: string) => {
    const name = placeName.trim()
    if (!name) return
    if (!list.includes(name)) {
      updateLocal(field, [...list, name])
    }
  }

  const handleRemove = (item: string) => {
    updateLocal(field, list.filter(i => i !== item))
  }

  // Google Places autocomplete tuned for universities/colleges. When the user
  // picks a suggestion we add its name as a chip and clear the input. The
  // input element is reached via the ref returned by the hook.
  const inputElRef = useRef<HTMLInputElement | null>(null)
  const handlePlace = useCallback(
    (place: any) => {
      const name = (place?.name || place?.formatted_address || '').trim()
      if (!name) return
      updateLocal(
        field,
        list.includes(name) ? list : [...list, name],
      )
      if (inputElRef.current) inputElRef.current.value = ''
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, field],
  )

  const placesRef = useGooglePlaces(handlePlace, { types: ['university'] })
  // Keep our own handle to the same input node the hook attaches to.
  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      inputElRef.current = node
      ;(placesRef as any).current = node
    },
    [placesRef],
  )

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-foreground-secondary mb-1">{label}</label>
        <input
          id={inputId}
          ref={setRefs}
          type="text"
          className="input-field"
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd((e.target as HTMLInputElement).value)
              ;(e.target as HTMLInputElement).value = ''
            }
          }}
        />
      {!GOOGLE_MAPS_KEY && (
        <p className="text-xs text-foreground-muted mt-1">
          Type a name and press Enter (live suggestions unavailable)
        </p>
      )}
      {list.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {list.map(item => (
            <span key={item} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
              {item}
              <button 
                type="button"
                onClick={(e) => { e.preventDefault(); handleRemove(item); }} 
                className="hover:text-primary-dark ml-1 font-bold"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OnboardingFlow() {
  const { profile, updateProfile, setOnboarded, setCurrentPage, user, setUser, targetOnboardingStep, setTargetOnboardingStep } = useAppStore()
  const track = useTrack()
  const [currentStep, setCurrentStep] = useState(targetOnboardingStep || 1)
  const [loading, setLoading] = useState(false)
  const [localData, setLocalData] = useState<Partial<StudentProfile>>({ ...profile })
  const [step5Errors, setStep5Errors] = useState<Record<string, string>>({})

  const supabase = createClient()

  useEffect(() => {
    if (targetOnboardingStep) {
      setTargetOnboardingStep(null)
    }
  }, [targetOnboardingStep, setTargetOnboardingStep])

  const syncToDatabase = async (profileData: Partial<StudentProfile>, isFinal = false) => {
    if (!user) return
    try {
      const dbPayload = {
        name: profileData.name,
        mobile: profileData.mobile,
        dob: profileData.dob || null,
        gender: profileData.gender,
        city: profileData.city,
        state: profileData.state,
        education_level: profileData.educationLevel,
        
        tenth_marks: profileData.tenthMarks,
        twelfth_marks: profileData.twelfthMarks,
        twelfth_stream: profileData.twelfthStream,
        undergrad_college: profileData.undergradCollege,
        undergrad_degree: profileData.undergradDegree,
        undergrad_specialization: profileData.undergradSpecialization,
        undergrad_cgpa: profileData.undergradCgpa,
        undergrad_grad_year: profileData.undergradGradYear,
        backlogs: profileData.hasBacklogs,
        research_papers: profileData.hasResearchPapers,
        internships: profileData.internshipsCount,
        extracurriculars: profileData.extracurricularRoles,
        
        is_working_professional: profileData.isWorkingProfessional,
        company_name: profileData.companyName,
        industry: profileData.industry,
        job_role: profileData.jobRole,
        years_experience: profileData.yearsExperience,
        current_ctc: profileData.currentCtc,
        career_gap: profileData.careerGap,
        
        study_goal: profileData.studyGoal,
        target_countries: profileData.targetCountries || [],
        target_degree: profileData.targetDegree,
        target_field: profileData.targetField,
        intake_target: profileData.intakeTarget,
        application_stage: profileData.applicationStage,
        
        gre_status: profileData.greStatus,
        gre_score: profileData.greScoreStr,
        gmat_status: profileData.gmatStatus,
        gmat_score: profileData.gmatScoreStr,
        ielts_status: profileData.ieltsStatus,
        ielts_score: profileData.ieltsScore?.toString() || '',
        toefl_status: profileData.toeflStatus,
        toefl_score: profileData.toeflScore?.toString() || '',
        gate_status: profileData.gateStatus,
        gate_score: profileData.gateScoreStr,
        cat_status: profileData.catStatus,
        cat_score: profileData.catScoreStr,
        neet_status: profileData.neetStatus,
        exam_next_date: profileData.examNextDate || null,
        
        dream_universities: profileData.dreamUniversities || [],
        target_universities: profileData.targetUniversitiesList || [],
        safe_universities: profileData.safeUniversities || [],
        preference_factors: profileData.preferenceFactors || [],
        university_research_stage: profileData.universityResearchStage,
        
        funding_source: profileData.fundingSource,
        expected_budget: profileData.expectedBudgetStr,
        loan_estimate: profileData.loanEstimateStr,
        collateral_available: profileData.collateralAvailableStr,
        family_income: profileData.familyIncomeStr,
        co_applicant: profileData.coApplicantStr,
        credit_score: profileData.creditScoreStr,
        
        doc_passport: profileData.docPassport,
        doc_transcripts: profileData.docTranscripts,
        doc_lors: profileData.docLors,
        doc_sop: profileData.docSop,
        doc_resume: profileData.docResume,
        doc_bank_statements: profileData.docBankStatements,
        doc_visa: profileData.docVisa,
        
        preferred_language: profileData.preferredLanguage,
        notification_preference: profileData.notificationPreference,
        content_interest: encodeContentInterest({
          contentInterest: profileData.contentInterest,
          track: profileData.track,
          jeeAdvancedRank: profileData.jeeAdvancedRank,
          gateScore: profileData.gateScore,
          gateScoreYear: profileData.gateScoreYear,
          gateRank: profileData.gateRank,
          catPercentile: profileData.catPercentile,
          reservationCategory: profileData.reservationCategory,
          homeState: profileData.homeState,
          targetInstituteId: profileData.targetInstituteId,
          domesticExamScoreMissing: profileData.domesticExamScoreMissing,
          entranceExams: profileData.entranceExams,
        }),
        hear_about_us: profileData.hearAboutUs,
        referral_code: profileData.referralCode,
        is_onboarded: isFinal ? true : !!profileData.isOnboarded
      }

      const { error } = await supabase
        .from('profiles')
        .update(dbPayload)
        .eq('id', user.id)

      if (error) console.error("Supabase Save Error:", error)
    } catch (e) {
      console.error(e)
    }
  }

  const handleNext = () => {
    if (currentStep === 5) {
      const result = validateStep5({
        jeeAdvancedRank: localData.jeeAdvancedRank,
        gateRank: localData.gateRank,
        gateScore: localData.gateScore,
        gateScoreYear: localData.gateScoreYear,
        catPercentile: localData.catPercentile,
        reservationCategory: localData.reservationCategory,
        homeState: localData.homeState,
      })
      if (!result.ok) {
        setStep5Errors(result.errors)
        return
      }
      setStep5Errors({})
      const flag = computeDomesticExamScoreMissing(track, {
        jeeAdvancedRank: localData.jeeAdvancedRank,
        gateScore: localData.gateScore,
        catPercentile: localData.catPercentile,
      })
      updateLocal('domesticExamScoreMissing', flag)
      syncToDatabase({ ...localData, domesticExamScoreMissing: flag }, false)
      if (currentStep < 9) setCurrentStep(s => s + 1)
      else finishOnboarding()
      return
    }
    syncToDatabase(localData, false)
    if (currentStep < 9) {
      setCurrentStep(s => s + 1)
    } else {
      finishOnboarding()
    }
  }

  const handleSkip = () => {
    syncToDatabase(localData, false)
    if (currentStep < 9) setCurrentStep(s => s + 1)
    else finishOnboarding()
  }

  const handlePrev = () => {
    syncToDatabase(localData, false)
    if (currentStep > 1) setCurrentStep(s => s - 1)
  }

  const handleLogout = async () => {
    setLoading(true)
    const supabase = createClient()
    if (user?.id) {
      try {
        await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, status: 'offline' }),
          keepalive: true,
        })
      } catch {}
    }
    await supabase.auth.signOut()
    setUser(null)
    setCurrentPage('landing')
    setLoading(false)
  }

  const updateLocal = (field: keyof StudentProfile, value: any) => {
    setLocalData(prev => ({ ...prev, [field]: value }))
    updateProfile({ [field]: value })
  }

  const finishOnboarding = async () => {
    setLoading(true)
    
    // Auto calculate some fields for legacy support
    const dreamScore = calculateDreamScore(localData as StudentProfile)
    const updatedProfile = { ...localData, dreamScore, isOnboarded: true }
    
    await syncToDatabase(updatedProfile, true)
    
    updateProfile(updatedProfile)
    setOnboarded(true)
    setCurrentPage('dashboard')
    setLoading(false)
  }

  // Pre-bind common props to save repetitive typing in renderStep
  const boundInput = (props: any) => <Input {...props} localData={localData} updateLocal={updateLocal} />
  const boundMultiAuto = (props: any) => <MultiAutocomplete {...props} localData={localData} updateLocal={updateLocal} />

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><User /> Basic Identity</h2>
            {boundInput({ label: "Full Name", field: "name" })}
            {boundInput({ label: "Mobile Number", field: "mobile" })}
            {boundInput({ label: "Date of Birth", field: "dob", type: "date" })}
            {boundInput({ label: "Gender", field: "gender", options: ['Male', 'Female', 'Other'] })}
            
            <PlacesAutocomplete
              label="City / Location"
              field="city"
              placeholder="Search your city..."
              types={['(cities)']}
              enableCurrentLocation
              localData={localData}
              updateLocal={updateLocal}
              onPlaceSelected={(place: any) => {
                const { city, state, label } = parsePlace(place)
                updateLocal('city', city || label)
                if (state) updateLocal('state', state)
              }}
            />
            
            {boundInput({ label: "Current Education Level", field: "educationLevel", options: ['Undergraduate', 'Graduate', 'Working Professional'] })}
          </div>
        )
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><GraduationCap /> Academic Background</h2>
            <div className="grid grid-cols-2 gap-4">
              {boundInput({ label: "10th Percentage / CGPA", field: "tenthMarks" })}
              {boundInput({ label: "12th Percentage / CGPA", field: "twelfthMarks" })}
            </div>
            {boundInput({ label: "12th Stream", field: "twelfthStream", options: ['Science', 'Commerce', 'Arts'] })}
            
            <PlacesAutocomplete
              label="Undergraduate College"
              field="undergradCollege"
              placeholder="Search your college or university..."
              types={['establishment']}
              localData={localData}
              updateLocal={updateLocal}
              onPlaceSelected={(place: any) => {
                updateLocal('undergradCollege', place.name || place.formatted_address || '')
              }}
            />

            {boundInput({ 
              label: "Degree (e.g. B.Tech)", 
              field: "undergradDegree", 
              options: ['B.Tech', 'B.E.', 'B.Sc', 'BBA', 'B.Com', 'BA', 'B.Arch', 'MBBS'], 
              allowCustom: true 
            })}
            {boundInput({ 
              label: "Specialization / Major", 
              field: "undergradSpecialization", 
              options: ['Computer Science', 'Information Technology', 'Data Science', 'Mechanical', 'Electrical', 'Electronics & Comm.', 'Civil', 'Finance', 'Marketing', 'Business Analytics'], 
              allowCustom: true 
            })}
            {boundInput({ label: "Current CGPA / Percentage", field: "undergradCgpa" })}
            {boundInput({ 
              label: "Graduation Year", 
              field: "undergradGradYear", 
              type: "number", 
              options: ['2023', '2024', '2025', '2026', '2027', '2028'], 
              allowCustom: true 
            })}
            {boundInput({ label: "Any Backlogs?", field: "hasBacklogs", options: ['Yes', 'No', 'Cleared'] })}
            {boundInput({ label: "Research Papers / Publications?", field: "hasResearchPapers", options: ['Yes', 'No'] })}
            {boundInput({ label: "Internships Count", field: "internshipsCount", type: "number" })}
            {boundInput({ label: "Extracurriculars / Leadership", field: "extracurricularRoles" })}
          </div>
        )
      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Briefcase /> Work Experience</h2>
            {boundInput({ label: "Are you a Working Professional?", field: "isWorkingProfessional", options: ['Yes', 'No'] })}
            {localData.isWorkingProfessional === 'Yes' && (
              <div className="space-y-4 pl-4 border-l-2 border-primary/20 mt-4">
                {boundInput({ label: "Company Name", field: "companyName" })}
                {boundInput({ label: "Industry / Domain", field: "industry" })}
                {boundInput({ label: "Job Role / Designation", field: "jobRole" })}
                {boundInput({ label: "Years of Experience", field: "yearsExperience", type: "number" })}
                {boundInput({ label: "Current Annual CTC (₹)", field: "currentCtc" })}
                {boundInput({ label: "Any Career Gap?", field: "careerGap", options: ['No', 'Yes'] })}
              </div>
            )}
          </div>
        )
      case 4:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Globe /> Target Destination</h2>
            {boundInput({ label: "Study Goal", field: "studyGoal", options: ['Abroad', 'Domestic (India)', 'Both'] })}
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground-secondary mb-1">Target Countries (Multi-select)</label>
              <select 
                multiple
                className="input-field min-h-[120px]"
                value={localData.targetCountries || []}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions, option => option.value)
                  updateLocal('targetCountries', opts)
                  // Legacy sync
                  updateLocal('targetCountry', opts)
                }}
              >
                <option value="USA">USA 🇺🇸</option>
                <option value="UK">UK 🇬🇧</option>
                <option value="Canada">Canada 🇨🇦</option>
                <option value="Australia">Australia 🇦🇺</option>
                <option value="Germany">Germany 🇩🇪</option>
                <option value="Ireland">Ireland 🇮🇪</option>
                <option value="Singapore">Singapore 🇸🇬</option>
                <option value="Netherlands">Netherlands 🇳🇱</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {boundInput({ label: "Target Degree", field: "targetDegree", options: ['MS / M.Tech', 'MBA / PGDM', 'MIM', 'MPH', 'MFA', 'LLM', 'PhD'] })}
            {boundInput({ label: "Target Field / Domain", field: "targetField", options: ['Computer Science / AI', 'Business / Finance', 'Engineering', 'Life Sciences', 'Design', 'Other'] })}
            {boundInput({ label: "Intake Target", field: "intakeTarget", options: ['Fall 2025', 'Spring 2026', 'Fall 2026', 'Still Deciding'] })}
            {boundInput({ label: "Application Stage", field: "applicationStage", options: ['Just Exploring', 'Shortlisting Universities', 'Appearing for Exams', 'Applications in Progress', 'Admits Received'] })}
          </div>
        )
      case 5:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><BookOpen /> Exam Profile</h2>
            {(track === 'abroad' || track === 'both') && (
              <>
                {boundInput({ label: "GRE Status", field: "greStatus", options: ['Appeared', 'Planning', 'Not Required', 'NA'] })}
                {localData.greStatus === 'Appeared' && boundInput({ label: "GRE Score", field: "greScoreStr" })}

                {boundInput({ label: "GMAT Status", field: "gmatStatus", options: ['Appeared', 'Planning', 'Not Required', 'NA'] })}
                {localData.gmatStatus === 'Appeared' && boundInput({ label: "GMAT Score", field: "gmatScoreStr" })}

                {boundInput({ label: "IELTS Status", field: "ieltsStatus", options: ['Appeared', 'Planning', 'NA'] })}
                {localData.ieltsStatus === 'Appeared' && boundInput({ label: "IELTS Score", field: "ieltsScore" })}

                {boundInput({ label: "TOEFL Status", field: "toeflStatus", options: ['Appeared', 'Planning', 'NA'] })}
                {localData.toeflStatus === 'Appeared' && boundInput({ label: "TOEFL Score", field: "toeflScore" })}

                {boundInput({ label: "Next Planned Exam Date", field: "examNextDate", type: "date" })}
              </>
            )}

            {(track === 'domestic' || track === 'both') && (
              <div className="mt-6 pt-6 border-t border-border space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BookOpen className="w-5 h-5" /> Indian Exams (Domestic Track)
                </h3>

                <EntranceExamPicker
                  value={localData.entranceExams || []}
                  onChange={(next) => updateLocal('entranceExams', next)}
                />

                <div className="mb-4">
                  <label className="block text-sm font-medium text-foreground-secondary mb-1">Reservation Category</label>
                  <select
                    className="input-field"
                    value={localData.reservationCategory ?? ''}
                    onChange={(e) => updateLocal('reservationCategory', e.target.value === '' ? undefined : (e.target.value as ReservationCategory))}
                  >
                    <option value="">Select...</option>
                    <option value="General">General</option>
                    <option value="OBC-NCL">OBC-NCL</option>
                    <option value="EWS">EWS</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                    <option value="PwD">PwD</option>
                  </select>
                  {step5Errors.reservationCategory && (
                    <p className="text-danger text-xs mt-1">{step5Errors.reservationCategory}</p>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-foreground-secondary mb-1">Home State</label>
                  <input
                    type="text"
                    className="input-field"
                    value={localData.homeState ?? ''}
                    onChange={(e) => updateLocal('homeState', e.target.value)}
                  />
                  {step5Errors.homeState && (
                    <p className="text-danger text-xs mt-1">{step5Errors.homeState}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      case 6:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Building /> University Preferences</h2>
            {boundMultiAuto({ label: "Dream Universities (e.g., MIT, Stanford)", field: "dreamUniversities", placeholder: "Search and select..." })}
            {boundMultiAuto({ label: "Realistic Target Universities", field: "targetUniversitiesList", placeholder: "Search and select..." })}
            {boundMultiAuto({ label: "Safe Universities", field: "safeUniversities", placeholder: "Search and select..." })}
            
            {boundInput({ label: "Top Preference Factor", field: "topPreferenceFactor", options: ['Ranking', 'ROI / Salary', 'Location', 'Scholarships', 'Curriculum', 'Alumni'] })}
            {boundInput({ label: "University Research Stage", field: "universityResearchStage", options: ['Haven\'t started', 'Casually browsing', 'Shortlist ready', 'Already applied'] })}
          </div>
        )
      case 7:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Wallet /> Financial Profile</h2>
            {boundInput({ label: "Who is funding your education?", field: "fundingSource", options: ['Self / Family', 'Education Loan', 'Scholarship', 'Mix of above'] })}
            {boundInput({ label: "Expected Total Budget (₹)", field: "expectedBudgetStr", options: ['Below 20L', '20L – 40L', '40L – 60L', '60L – 80L', '80L+'] })}
            {boundInput({ label: "Loan Requirement Estimate (₹)", field: "loanEstimateStr" })}
            {boundInput({ label: "Collateral Available?", field: "collateralAvailableStr", options: ['Yes', 'No', 'Not Sure'] })}
            {boundInput({ label: "Annual Family Income (₹)", field: "familyIncomeStr", options: ['Below 3L', '3L – 6L', '6L – 10L', '10L – 20L', '20L+'] })}
            {boundInput({ label: "Co-applicant Available?", field: "coApplicantStr", options: ['Yes', 'No'] })}
            {boundInput({ label: "Credit Score", field: "creditScoreStr", options: ['Below 650', '650–750', '750+', 'Don\'t know'] })}
          </div>
        )
      case 8:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><FileText /> Documents Status</h2>
            {boundInput({ label: "Passport", field: "docPassport", options: ['Ready', 'In Progress', 'Not Started'] })}
            {boundInput({ label: "Transcripts", field: "docTranscripts", options: ['Ready', 'In Progress', 'Not Started'] })}
            {boundInput({ label: "LORs", field: "docLors", options: ['Ready', 'In Progress', 'Not Started'] })}
            {boundInput({ label: "SOP", field: "docSop", options: ['Ready', 'In Progress', 'Not Started'] })}
            {boundInput({ label: "Resume/CV", field: "docResume", options: ['Ready', 'In Progress', 'Not Started'] })}
            {boundInput({ label: "Bank Statements", field: "docBankStatements", options: ['Ready', 'In Progress', 'Not Started'] })}
            {boundInput({ label: "Visa", field: "docVisa", options: ['Ready', 'In Progress', 'Not Started', 'NA'] })}
          </div>
        )
      case 9:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Settings /> Preferences & Personalization</h2>
            {boundInput({ label: "Preferred Language", field: "preferredLanguage", options: ['English', 'Hindi', 'Regional'] })}
            {boundInput({ label: "Notification Preference", field: "notificationPreference", options: ['WhatsApp', 'Email', 'App'] })}
            {boundInput({ label: "How did you hear about us?", field: "hearAboutUs", options: ['Instagram', 'YouTube', 'Friend', 'College', 'Other'] })}
            {boundInput({ label: "Referral Code (if any)", field: "referralCode" })}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute inset-0 bg-grid z-0 opacity-50" />
      <div className="glow-orb bg-primary" style={{ top: '-10%', left: '-10%', width: '40vw', height: '40vw' }} />
      <div className="glow-orb bg-secondary" style={{ bottom: '-10%', right: '-10%', width: '30vw', height: '30vw' }} />

      <div className="w-full max-w-3xl z-10">
        <div className="mb-8 flex flex-col items-center">
          <div className="text-primary mb-2">
            <Sparkles className="w-10 h-10 animate-pulse-glow" />
          </div>
          <h1 className="text-3xl font-bold text-center">Let's personalize your journey</h1>
          <p className="text-foreground-secondary mt-2">Step {currentStep} of 9</p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-surface rounded-full h-2 mb-8 overflow-hidden">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${(currentStep / 9) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Step Icons */}
        <div className="flex justify-between mb-8 overflow-x-auto pb-4 hide-scrollbar">
          {STEPS.map((step) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isPast = currentStep > step.id
            return (
              <div 
                key={step.id} 
                className={`flex flex-col items-center min-w-[60px] cursor-pointer ${isActive ? 'text-primary' : isPast ? 'text-success' : 'text-foreground-muted'}`}
                onClick={() => { if(isPast) setCurrentStep(step.id) }}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 mb-1 transition-all ${
                  isActive ? 'border-primary bg-primary/10' : 
                  isPast ? 'border-success bg-success/10' : 'border-border bg-surface'
                }`}>
                  {isPast ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className="text-xs font-medium hidden sm:block text-center">{step.title}</span>
              </div>
            )
          })}
        </div>

        {/* Form Container */}
        <div className="card p-6 sm:p-8 relative min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center mt-12 pt-6 border-t border-border">
            {currentStep === 1 ? (
              <button
                onClick={handleLogout}
                disabled={loading}
                className="btn-secondary flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            ) : (
              <button
                onClick={handlePrev}
                disabled={loading}
                className="btn-secondary flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            
            <div className="flex items-center gap-3">
              {currentStep > 1 && (
                <button
                  onClick={handleSkip}
                  disabled={loading}
                  className="text-foreground-secondary hover:text-foreground transition-colors text-sm px-4"
                >
                  Skip for now
                </button>
              )}
              
              <button
                onClick={handleNext}
                disabled={loading || (currentStep === 1 && !localData.name)} // Require Name
                className="btn-primary flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {currentStep === 9 ? 'Complete Setup' : 'Continue'} 
                {!loading && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
