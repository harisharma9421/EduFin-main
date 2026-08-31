'use client'

import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useJourneyStore } from '@/lib/journeyStore'
import { useAppStore } from '@/lib/store'
import { Loader2, ArrowRight, RotateCcw, CheckCircle2, FileDown, FileText } from 'lucide-react'
import DecisionEngine from '../AIEducationJourney/DecisionEngine'
import { downloadHTMLReport, downloadPDFReport } from '@/lib/journeyReport'
import type { DecisionPhase, DecisionEngineState } from '@/lib/types'

const PHASE_ORDER: DecisionPhase[] = [
  'PHASE_1_PROFILE',
  'PHASE_2_COUNTRY',
  'PHASE_3_UNIVERSITY',
  'PHASE_4_ADMISSION',
  'PHASE_5_COST',
  'PHASE_6_AFFORDABILITY',
  'PHASE_7_LOAN',
  'PHASE_8_DOCUMENTS',
  'PHASE_9_DOC_ACQUISITION',
  'PHASE_10_REVIEWS',
  'PHASE_11_ROADMAP'
]

const STATE_KEYS: Record<DecisionPhase, keyof DecisionEngineState> = {
  PHASE_1_PROFILE: 'profileAnalysis',
  PHASE_2_COUNTRY: 'countryDecision',
  PHASE_3_UNIVERSITY: 'universityMatch',
  PHASE_4_ADMISSION: 'admissionChance',
  PHASE_5_COST: 'totalCost',
  PHASE_6_AFFORDABILITY: 'affordability',
  PHASE_7_LOAN: 'loanEngine',
  PHASE_8_DOCUMENTS: 'documentReadiness',
  PHASE_9_DOC_ACQUISITION: 'documentAcquisition',
  PHASE_10_REVIEWS: 'reviewIntelligence',
  PHASE_11_ROADMAP: 'actionRoadmap'
}

export default function AIEducationJourney() {
  const { 
    currentPhase, 
    answeredPhases, 
    advancePhase, 
    setPhaseData, 
    isLoading, 
    setLoading, 
    resetJourney,
    selectedCountry,
    selectedUniversity,
    affordability,
    documentReadiness
  } = useJourneyStore()
  
  const { profile } = useAppStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when a new phase is added
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [answeredPhases, isLoading])

  // Automatically fetch Phase 1 if empty
  useEffect(() => {
    if (answeredPhases.length === 0 && !isLoading && currentPhase === 'PHASE_1_PROFILE') {
      handleNextPhase('PHASE_1_PROFILE')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getNextPhase = (current: DecisionPhase): DecisionPhase | null => {
    const currentIndex = PHASE_ORDER.indexOf(current)
    if (currentIndex >= PHASE_ORDER.length - 1) return null

    let nextPhase = PHASE_ORDER[currentIndex + 1]

    const state = useJourneyStore.getState()

    // Conditional Logic: Skip Loan Phase if affordable
    if (current === 'PHASE_6_AFFORDABILITY' && state.affordability?.canAfford) {
      nextPhase = 'PHASE_8_DOCUMENTS' // Skip PHASE_7_LOAN
    }

    // Conditional Logic: Skip Doc Acquisition if no missing docs
    if (current === 'PHASE_8_DOCUMENTS' && state.documentReadiness?.missing?.length === 0) {
      nextPhase = 'PHASE_10_REVIEWS' // Skip PHASE_9_DOC_ACQUISITION
    }

    return nextPhase
  }

  const handleNextPhase = async (phaseToFetch: DecisionPhase) => {
    // Validate selection requirements
    if (phaseToFetch === 'PHASE_3_UNIVERSITY' && !selectedCountry && currentPhase !== 'PHASE_3_UNIVERSITY') {
      alert("Please select a country to continue.")
      return
    }
    if (phaseToFetch === 'PHASE_4_ADMISSION' && !selectedUniversity && currentPhase !== 'PHASE_4_ADMISSION') {
      alert("Please select a university to continue.")
      return
    }

    setLoading(true)
    try {
      const decisionState = useJourneyStore.getState()
      
      const res = await fetch('/api/ai-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phase: phaseToFetch, 
          profileData: profile,
          decisionState
        })
      })
      const result = await res.json()

      if (result.error) {
        throw new Error(result.error)
      }

      if (result.data) {
        const stateKey = STATE_KEYS[phaseToFetch]
        setPhaseData(stateKey, result.data)
        advancePhase(phaseToFetch)

        // Pre-compute the next logical phase to set it as currentPhase for the next click
        const next = getNextPhase(phaseToFetch)
        if (next) {
          useJourneyStore.setState({ currentPhase: next })
        }
      }
    } catch (e) {
      console.error(e)
      alert("AI failed to process this step. Using fallback data.")
    } finally {
      setLoading(false)
    }
  }

  const isComplete = answeredPhases.includes('PHASE_11_ROADMAP')
  const disableNext = isLoading || isComplete

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="text-xl">🌟</span> AI Decision Engine
            </h1>
            <p className="text-sm text-foreground-muted">Your personalized AI Study Abroad Consultant</p>
          </div>
          <button 
            onClick={resetJourney}
            className="flex items-center gap-2 text-sm text-foreground-muted hover:text-destructive transition-colors"
          >
            <RotateCcw className="w-4 h-4"/> Reset
          </button>
        </div>
      </div>

      {/* Main Chat/Engine Container */}
      <div className="flex-1 overflow-y-auto px-3 md:px-6 pt-3 md:pt-4">
        <DecisionEngine />
        
        {/* Loading Indicator */}
        {isLoading && (
          <div className="max-w-4xl mx-auto flex justify-start mb-8">
            <div className="bg-surface border border-border px-6 py-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <p className="text-foreground-muted text-sm animate-pulse">AI is analyzing your profile...</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-20" />
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t border-border p-4 md:pl-64 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            {!isComplete && !isLoading && answeredPhases.length > 0 && (
              <p className="text-sm text-foreground-muted truncate">
                Next: <strong className="text-foreground">{currentPhase.replace(/PHASE_\d+_/, '').replace('_', ' ')}</strong>
              </p>
            )}
            {isComplete && <p className="text-sm text-success font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Journey Complete — download your report</p>}
          </div>

          {isComplete ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => downloadPDFReport(profile, useJourneyStore.getState())}
                className="btn-primary px-5 py-3 rounded-full flex items-center gap-2 shadow-lg"
              >
                <FileDown className="w-4 h-4" /> <span className="hidden sm:inline">Download</span> PDF
              </button>
              <button
                onClick={() => downloadHTMLReport(profile, useJourneyStore.getState())}
                className="btn-secondary px-5 py-3 rounded-full flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> <span className="hidden sm:inline">Download</span> HTML
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleNextPhase(currentPhase)}
              disabled={disableNext}
              className="btn-primary px-8 py-3 rounded-full flex items-center gap-2 shadow-lg hover:shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin"/> Processing...</>
              ) : (
                <>Ask AI <ArrowRight className="w-4 h-4"/></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
