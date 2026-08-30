// Feature: domestic-track-mvp, Property 9: sidebar visibility per track
//
// Validates: Requirements 7.1, 7.2, 7.3, 7.4
//
// `isItemVisible(page, track)` and `filterNavSections(sections, track)` decide
// which sidebar entries to render given the user's derived track. The four
// track-specific pages partition cleanly:
//
//   visa-simulator   / currency-risk / ai-journey / roi-calculator /
//   loan-center                                              => abroad-only
//   domestic-admission-predictor  / domestic-loan-center     => domestic-only
//
// All other pages are unconditionally visible. When `track === 'both'` the
// user sees every nav item. Empty sections are dropped from the result.

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  filterNavSections,
  isItemVisible,
  type NavSection,
} from '@/lib/navVisibility'
import type { PageType } from '@/lib/types'

const TRACKS = ['abroad', 'domestic', 'both'] as const
type Track = (typeof TRACKS)[number]

describe('Property 9: sidebar visibility per track', () => {
  // ── (a) isItemVisible truth table for the four special pages × 3 tracks ──
  describe('(a) isItemVisible truth table for the four special pages', () => {
    it('visa-simulator: visible for abroad and both, hidden for domestic', () => {
      expect(isItemVisible('visa-simulator', 'abroad')).toBe(true)
      expect(isItemVisible('visa-simulator', 'domestic')).toBe(false)
      expect(isItemVisible('visa-simulator', 'both')).toBe(true)
    })

    it('currency-risk: visible for abroad and both, hidden for domestic', () => {
      expect(isItemVisible('currency-risk', 'abroad')).toBe(true)
      expect(isItemVisible('currency-risk', 'domestic')).toBe(false)
      expect(isItemVisible('currency-risk', 'both')).toBe(true)
    })

    it('ai-journey / roi-calculator / loan-center: visible for abroad and both, hidden for domestic', () => {
      for (const page of ['ai-journey', 'roi-calculator', 'loan-center'] as const) {
        expect(isItemVisible(page, 'abroad')).toBe(true)
        expect(isItemVisible(page, 'domestic')).toBe(false)
        expect(isItemVisible(page, 'both')).toBe(true)
      }
    })

    it('domestic-admission-predictor: hidden for abroad, visible for domestic and both', () => {
      expect(isItemVisible('domestic-admission-predictor', 'abroad')).toBe(false)
      expect(isItemVisible('domestic-admission-predictor', 'domestic')).toBe(true)
      expect(isItemVisible('domestic-admission-predictor', 'both')).toBe(true)
    })

    it('domestic-loan-center: hidden for abroad, visible for domestic and both', () => {
      expect(isItemVisible('domestic-loan-center', 'abroad')).toBe(false)
      expect(isItemVisible('domestic-loan-center', 'domestic')).toBe(true)
      expect(isItemVisible('domestic-loan-center', 'both')).toBe(true)
    })
  })

  // ── (b) Non-special pages are visible regardless of track ───────────────
  it('(b) non-special pages are visible for every track', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PageType>(
          'dashboard',
          'profile',
          'sop-copilot',
          'emi-calculator',
        ),
        fc.constantFrom<Track>(...TRACKS),
        (page, track) => isItemVisible(page, track) === true,
      ),
      { numRuns: 200 },
    )
  })

  // ── (c) filterNavSections per-track filtering on a fabricated input ─────
  describe('(c) filterNavSections on a fabricated section list', () => {
    const fixture: NavSection<string>[] = [
      {
        label: 'Evaluate',
        items: [
          { icon: 'target', label: 'Admission Predictor', page: 'admission-predictor' },
          { icon: 'target', label: 'Domestic Predictor', page: 'domestic-admission-predictor' },
          { icon: 'globe', label: 'Currency Risk', page: 'currency-risk' },
          { icon: 'user', label: 'Profile', page: 'profile' },
        ],
      },
      {
        label: 'Finance',
        items: [
          { icon: 'shield', label: 'Visa Simulator', page: 'visa-simulator' },
          { icon: 'cash', label: 'Domestic Loan Center', page: 'domestic-loan-center' },
        ],
      },
    ]

    it("track='abroad': drops domestic-only items, keeps abroad-only items", () => {
      const out = filterNavSections(fixture, 'abroad')
      // Both sections survive because each retains at least one item.
      expect(out).toHaveLength(2)

      const evaluate = out.find((s) => s.label === 'Evaluate')!
      expect(evaluate.items.map((i) => i.page)).toEqual([
        'admission-predictor',
        'currency-risk',
        'profile',
      ])

      const finance = out.find((s) => s.label === 'Finance')!
      expect(finance.items.map((i) => i.page)).toEqual(['visa-simulator'])
    })

    it("track='domestic': drops abroad-only items, keeps domestic-only items", () => {
      const out = filterNavSections(fixture, 'domestic')
      expect(out).toHaveLength(2)

      const evaluate = out.find((s) => s.label === 'Evaluate')!
      expect(evaluate.items.map((i) => i.page)).toEqual([
        'admission-predictor',
        'domestic-admission-predictor',
        'profile',
      ])

      const finance = out.find((s) => s.label === 'Finance')!
      expect(finance.items.map((i) => i.page)).toEqual(['domestic-loan-center'])
    })

    it("track='both': keeps every item across every section", () => {
      const out = filterNavSections(fixture, 'both')
      expect(out).toHaveLength(2)

      const evaluate = out.find((s) => s.label === 'Evaluate')!
      expect(evaluate.items.map((i) => i.page)).toEqual([
        'admission-predictor',
        'domestic-admission-predictor',
        'currency-risk',
        'profile',
      ])

      const finance = out.find((s) => s.label === 'Finance')!
      expect(finance.items.map((i) => i.page)).toEqual([
        'visa-simulator',
        'domestic-loan-center',
      ])
    })
  })

  // ── (d) Sections whose items are all filtered out are dropped ──────────
  it('(d) drops sections that become empty after filtering', () => {
    const sections: NavSection<string>[] = [
      {
        label: 'Survives',
        items: [
          { icon: 'i', label: 'Profile', page: 'profile' },
        ],
      },
      {
        label: 'AbroadOnly',
        items: [
          { icon: 'i', label: 'Visa Simulator', page: 'visa-simulator' },
          { icon: 'i', label: 'Currency Risk', page: 'currency-risk' },
        ],
      },
      {
        label: 'DomesticOnly',
        items: [
          { icon: 'i', label: 'Domestic Predictor', page: 'domestic-admission-predictor' },
          { icon: 'i', label: 'Domestic Loan Center', page: 'domestic-loan-center' },
        ],
      },
    ]

    const abroad = filterNavSections(sections, 'abroad')
    expect(abroad.map((s) => s.label)).toEqual(['Survives', 'AbroadOnly'])

    const domestic = filterNavSections(sections, 'domestic')
    expect(domestic.map((s) => s.label)).toEqual(['Survives', 'DomesticOnly'])
  })

  // ── (e) Order preservation: filtered items retain their original order ──
  it('(e) preserves the original order of items within each section', () => {
    const pageArb: fc.Arbitrary<PageType> = fc.constantFrom<PageType>(
      'dashboard',
      'profile',
      'sop-copilot',
      'roi-calculator',
      'visa-simulator',
      'currency-risk',
      'domestic-admission-predictor',
      'domestic-loan-center',
    )

    const itemArb = fc.record({
      icon: fc.constant('icon'),
      label: fc.string(),
      page: pageArb,
    })

    const sectionArb = fc.record({
      label: fc.string({ minLength: 1, maxLength: 20 }),
      items: fc.array(itemArb, { minLength: 0, maxLength: 8 }),
    })

    const sectionsArb = fc.array(sectionArb, { minLength: 0, maxLength: 6 })

    fc.assert(
      fc.property(
        sectionsArb,
        fc.constantFrom<Track>(...TRACKS),
        (sections, track) => {
          const out = filterNavSections(sections, track)

          // Every output section must non-empty.
          if (out.some((s) => s.items.length === 0)) return false

          // Build a map from section label to its original index list of pages
          // for the items that survive the filter, in original order.
          // Because `sectionArb` may produce duplicate labels we match by the
          // order of surviving sections in the input rather than by label.
          const expectedSurvivingSections = sections
            .map((s) => ({
              ...s,
              items: s.items.filter((i) => isItemVisible(i.page, track)),
            }))
            .filter((s) => s.items.length > 0)

          if (out.length !== expectedSurvivingSections.length) return false

          for (let i = 0; i < out.length; i++) {
            const got = out[i].items.map((it) => it.page)
            const want = expectedSurvivingSections[i].items.map((it) => it.page)
            if (got.length !== want.length) return false
            for (let j = 0; j < got.length; j++) {
              if (got[j] !== want[j]) return false
            }
          }

          return true
        },
      ),
      { numRuns: 200 },
    )
  })
})
