import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DecisionEngineState, DecisionPhase } from './types'

export interface JourneyState extends DecisionEngineState {
  isLoading: boolean
  
  // Actions
  setPhaseData: <K extends keyof DecisionEngineState>(key: K, data: DecisionEngineState[K]) => void
  advancePhase: (nextPhase: DecisionPhase) => void
  setSelectedCountry: (country: string) => void
  setSelectedUniversity: (university: string) => void
  setLoading: (loading: boolean) => void
  resetJourney: () => void
}

const initialState: DecisionEngineState = {
  currentPhase: 'PHASE_1_PROFILE',
  answeredPhases: [],
}

export const useJourneyStore = create<JourneyState>()(
  persist(
    (set) => ({
      ...initialState,
      isLoading: false,
      
      setPhaseData: (key, data) => set((state) => ({ [key]: data } as any)),
      
      advancePhase: (nextPhase) => set((state) => ({
        currentPhase: nextPhase,
        answeredPhases: state.answeredPhases.includes(state.currentPhase) 
          ? state.answeredPhases 
          : [...state.answeredPhases, state.currentPhase]
      })),
      
      setSelectedCountry: (country) => set({ selectedCountry: country }),
      setSelectedUniversity: (university) => set({ selectedUniversity: university }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      resetJourney: () => set({ ...initialState, isLoading: false }),
    }),
    {
      name: 'ai-decision-engine-storage',
    }
  )
)
