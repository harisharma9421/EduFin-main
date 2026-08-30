// Feature: domestic-track-mvp, Property 1: deriveTrack totality
//
// Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.7, 1.8
//
// For any string, null, or undefined input, deriveTrack returns exactly one
// value in {'abroad', 'domestic', 'both'}. Canonical onboarding strings
// ('Abroad', 'Domestic (India)', 'Both') map to their respective track values;
// missing/empty inputs and any other non-canonical string default to 'abroad'.

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { deriveTrack } from '../../src/lib/useTrack'

describe('Property 1: deriveTrack totality', () => {
  it('totality: every input maps to one of three Track values', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.constant(undefined),
          fc.constant(null),
          fc.constantFrom('Abroad', 'Domestic (India)', 'Both'),
        ),
        (g) => {
          const r = deriveTrack(g as string | null | undefined)
          return r === 'abroad' || r === 'domestic' || r === 'both'
        },
      ),
      { numRuns: 200 },
    )
  })

  it("canonical mapping: 'Abroad' -> 'abroad', 'Domestic (India)' -> 'domestic', 'Both' -> 'both'", () => {
    expect(deriveTrack('Abroad')).toBe('abroad')
    expect(deriveTrack('Domestic (India)')).toBe('domestic')
    expect(deriveTrack('Both')).toBe('both')
  })

  it("missing/empty defaults to 'abroad'", () => {
    expect(deriveTrack(undefined)).toBe('abroad')
    expect(deriveTrack(null)).toBe('abroad')
    expect(deriveTrack('')).toBe('abroad')
  })

  it("unknown non-empty strings default to 'abroad'", () => {
    fc.assert(
      fc.property(
        fc
          .string()
          .filter(
            (s) =>
              s !== '' &&
              s !== 'Abroad' &&
              s !== 'Domestic (India)' &&
              s !== 'Both',
          ),
        (s) => deriveTrack(s) === 'abroad',
      ),
      { numRuns: 100 },
    )
  })
})
