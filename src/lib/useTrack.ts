// Source of truth for the derived `track` value across GradPilot.
// Per requirements.md (Req 1) and design.md ("useTrack() Hook Contract").
//
// `deriveTrack` is a pure function:
//   - 'Abroad'           -> 'abroad'
//   - 'Domestic (India)' -> 'domestic'
//   - 'Both'             -> 'both'
//   - undefined / null / '' -> 'abroad' (defaulted, with one console.warn in browser)
//   - any other non-empty string -> 'abroad' (silent fallback per Req 1.8)
//
// `useTrack` is a Zustand selector hook that reads `profile.studyGoal` from
// the canonical app store and runs it through `deriveTrack`.

import { useAppStore } from './store'

export type { Track } from './types'
import type { Track } from './types'

export function deriveTrack(studyGoal: string | null | undefined): Track {
  if (studyGoal === undefined || studyGoal === null || studyGoal === '') {
    if (typeof window !== 'undefined') {
      console.warn('[useTrack] studyGoal missing; defaulting track=abroad')
    }
    return 'abroad'
  }
  switch (studyGoal) {
    case 'Abroad':
      return 'abroad'
    case 'Domestic (India)':
      return 'domestic'
    case 'Both':
      return 'both'
    default:
      // Unknown non-empty values default silently per Req 1.8.
      return 'abroad'
  }
}

export function useTrack(): Track {
  return useAppStore((s) => deriveTrack(s.profile.studyGoal))
}
