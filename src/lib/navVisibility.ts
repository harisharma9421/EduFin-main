// Sidebar visibility helper for the Domestic Track MVP.
//
// Source of truth: requirements.md (Req 7) and design.md ("Sidebar and PageType
// Wiring"). The sidebar shows / hides four track-specific pages depending on
// the user's derived `track`:
//
//   visa-simulator            -> abroad-only (hidden when track === 'domestic')
//   currency-risk             -> abroad-only (hidden when track === 'domestic')
//   ai-journey                -> abroad-only (hidden when track === 'domestic')
//   roi-calculator            -> abroad-only (hidden when track === 'domestic')
//   loan-center               -> abroad-only (hidden when track === 'domestic')
//   domestic-admission-predictor -> domestic-only (hidden when track === 'abroad')
//   domestic-loan-center      -> domestic-only (hidden when track === 'abroad')
//
// All other pages are always visible. When `track === 'both'` the user sees
// every nav item. This module contains pure functions only — no React, no
// Zustand — so it can be exercised by property tests without a DOM.

import type { PageType } from './types'
import type { Track } from './useTrack'

// Pages that only make sense for an abroad applicant. Hidden when the user is
// on the domestic-only track. (Currency Risk / Visa are abroad concepts; the
// AI Education Journey, ROI Calculator and Loan Center are abroad-oriented and
// have domestic counterparts where relevant.)
const ABROAD_ONLY_PAGES: PageType[] = [
  'visa-simulator',
  'currency-risk',
  'ai-journey',
  'roi-calculator',
  'loan-center',
]

const DOMESTIC_ONLY_PAGES: PageType[] = [
  'domestic-admission-predictor',
  'domestic-loan-center',
]

export function isItemVisible(page: PageType, track: Track): boolean {
  if (track === 'abroad') {
    return !DOMESTIC_ONLY_PAGES.includes(page)
  }
  if (track === 'domestic') {
    return !ABROAD_ONLY_PAGES.includes(page)
  }
  return true
}

export interface NavItem<I = unknown> {
  icon: I
  label: string
  page: PageType
}

export interface NavSection<I = unknown> {
  label: string
  items: NavItem<I>[]
}

export function filterNavSections<I>(
  sections: NavSection<I>[],
  track: Track,
): NavSection<I>[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isItemVisible(item.page, track)),
    }))
    .filter((section) => section.items.length > 0)
}
