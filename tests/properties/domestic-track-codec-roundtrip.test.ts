// Feature: domestic-track-mvp, Property 6: contentInterest codec round-trip
//
// Validates: Requirements 14.1, 14.2, 14.3
//
// For any partial `StudentProfile` carrying a `contentInterest` array of
// strings and any subset of the 10 new domestic fields, the codec satisfies:
//
//   1. Legacy decode: `decodeContentInterest(string[])` returns the array
//      verbatim with an empty `domesticMeta`.
//   2. Garbage decode: `decodeContentInterest(<unknown shape>)` returns
//      `{ contentInterest: [], domesticMeta: {} }`.
//   3. Round-trip: `decodeContentInterest(encodeContentInterest(profile))`
//      restores `contentInterest` element-wise and every defined domestic
//      field; undefined input fields stay undefined after decode.
//   4. Idempotence on legacy: decoding a legacy `string[]` and then
//      decoding the re-encoded payload yields the same logical pair.

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  decodeContentInterest,
  encodeContentInterest,
} from '../../src/lib/contentInterestCodec'
import type { StudentProfile } from '../../src/lib/types'

// ─── Generators ───────────────────────────────────────────────────────────

const reservationArb = fc.constantFrom(
  'General',
  'OBC-NCL',
  'EWS',
  'SC',
  'ST',
  'PwD',
) as fc.Arbitrary<NonNullable<StudentProfile['reservationCategory']>>

const trackArb = fc.constantFrom('abroad', 'domestic', 'both') as fc.Arbitrary<
  NonNullable<StudentProfile['track']>
>

const currentYear = new Date().getFullYear()

// Build a partial StudentProfile carrying only the codec-relevant fields.
// Each domestic field is `fc.option(...)` so the generator covers both the
// "present" and "undefined" cases on every run.
const profileArb: fc.Arbitrary<Partial<StudentProfile>> = fc.record({
  contentInterest: fc.array(fc.string(), { maxLength: 10 }),
  track: fc.option(trackArb, { nil: undefined }),
  jeeAdvancedRank: fc.option(fc.integer({ min: 1, max: 5_000_000 }), {
    nil: undefined,
  }),
  gateScore: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
  gateScoreYear: fc.option(
    fc.integer({ min: currentYear - 4, max: currentYear }),
    { nil: undefined },
  ),
  gateRank: fc.option(fc.integer({ min: 1, max: 200_000 }), {
    nil: undefined,
  }),
  catPercentile: fc.option(
    fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
    { nil: undefined },
  ),
  reservationCategory: fc.option(reservationArb, { nil: undefined }),
  homeState: fc.option(fc.string({ maxLength: 32 }), { nil: undefined }),
  targetInstituteId: fc.option(fc.string({ maxLength: 32 }), {
    nil: undefined,
  }),
  domesticExamScoreMissing: fc.option(fc.boolean(), { nil: undefined }),
})

const DOMESTIC_FIELDS = [
  'track',
  'jeeAdvancedRank',
  'gateScore',
  'gateScoreYear',
  'gateRank',
  'catPercentile',
  'reservationCategory',
  'homeState',
  'targetInstituteId',
  'domesticExamScoreMissing',
] as const

// `undefined`-vs-missing equivalence helper. Two values are "equal" if they
// are strictly equal OR both are nullish. Used to compare per-field round-trip
// results where the encoder strips undefineds.
function fieldsEqual<T>(a: T | undefined, b: T | undefined): boolean {
  if (a === b) return true
  if (a == null && b == null) return true
  return false
}

// ─── Property 6 ───────────────────────────────────────────────────────────

describe('Property 6: contentInterest codec round-trip', () => {
  it('legacy decode: any string[] decodes to itself with empty domesticMeta', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 20 }), (arr) => {
        const out = decodeContentInterest(arr)
        return (
          out.contentInterest.length === arr.length &&
          out.contentInterest.every((s, i) => s === arr[i]) &&
          Object.keys(out.domesticMeta).length === 0
        )
      }),
      { numRuns: 100 },
    )
  })

  it('unknown-shape decode: garbage values yield empty payload', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.integer(),
          fc.boolean(),
          fc.string(),
          // Plain object missing the v:2 discriminator.
          fc.record({ tags: fc.array(fc.string()) }),
          // Object with the wrong version.
          fc.record({ v: fc.constant(1), tags: fc.array(fc.string()) }),
        ),
        (raw) => {
          const out = decodeContentInterest(raw)
          return (
            out.contentInterest.length === 0 &&
            Object.keys(out.domesticMeta).length === 0
          )
        },
      ),
      { numRuns: 100 },
    )
  })

  it('encode → decode round-trip preserves contentInterest and every domestic field', () => {
    fc.assert(
      fc.property(profileArb, (profile) => {
        // Snapshot to verify encode is non-mutating.
        const snapshot = JSON.parse(JSON.stringify(profile)) as Partial<StudentProfile>

        const encoded = encodeContentInterest(profile)
        const decoded = decodeContentInterest(encoded)

        // Encode must not mutate the input.
        if (JSON.stringify(profile) !== JSON.stringify(snapshot)) {
          return false
        }

        // contentInterest round-trips element-wise; default to [] when absent.
        const expectedTags = profile.contentInterest ?? []
        if (decoded.contentInterest.length !== expectedTags.length) return false
        for (let i = 0; i < expectedTags.length; i++) {
          if (decoded.contentInterest[i] !== expectedTags[i]) return false
        }

        // Each of the 10 domestic fields round-trips (or stays undefined).
        for (const key of DOMESTIC_FIELDS) {
          const before = profile[key]
          const after = decoded.domesticMeta[key]
          if (!fieldsEqual(before as unknown, after as unknown)) {
            return false
          }
        }

        return true
      }),
      { numRuns: 200 },
    )
  })

  it('idempotence on legacy: decode(encode(decode(legacy))) equals decode(legacy)', () => {
    const legacy = ['Loans', 'ROI', 'Career Tips']
    const once = decodeContentInterest(legacy)
    const reEncoded = encodeContentInterest({ contentInterest: once.contentInterest })
    const twice = decodeContentInterest(reEncoded)
    expect(twice).toEqual(once)
  })
})
