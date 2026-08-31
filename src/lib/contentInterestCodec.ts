// Round-trip codec for the Supabase `profiles.content_interest jsonb` column.
//
// Per requirements.md (Req 14: persistence without schema migration) and
// design.md ("Persistence Mapping" + "Codec contract"), the legacy column
// stored a free-text `string[]` of content tags. This codec extends that
// contract to a discriminated `{ v: 2, tags, domesticMeta }` shape that
// also carries the new domestic-track fields, while still accepting the
// legacy `string[]` shape on read.
//
// The codec is PURE: no I/O, no Date, no Math.random, no console.
// `encodeContentInterest` MUST NOT mutate the input profile.

import type {
  StudentProfile,
  Track,
  ReservationCategory,
  EntranceExamEntry,
} from './types'

export interface ContentInterestPayload {
  v: 2
  tags: string[]
  domesticMeta?: {
    track?: Track
    jeeAdvancedRank?: number
    gateScore?: number
    gateScoreYear?: number
    gateRank?: number
    catPercentile?: number
    reservationCategory?: ReservationCategory
    homeState?: string
    targetInstituteId?: string
    domesticExamScoreMissing?: boolean
    entranceExams?: EntranceExamEntry[]
  }
}

type DomesticMeta = NonNullable<ContentInterestPayload['domesticMeta']>

// Field list kept verbatim from design.md "Persistence Mapping".
// Casing is exact: `OBC-NCL` and `PwD` are values, not keys here.
const DOMESTIC_META_KEYS = [
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
  'entranceExams',
] as const satisfies ReadonlyArray<keyof DomesticMeta>

/**
 * Encode a partial `StudentProfile` into the v2 `content_interest` payload.
 *
 * - `tags` defaults to `[]` when `profile.contentInterest` is undefined.
 * - Every `undefined` domestic field is stripped so the encoded payload is
 *   the canonical "minimum" representation. When all 10 domestic fields are
 *   undefined the `domesticMeta` key is omitted entirely.
 * - The input `profile` argument is read but never mutated.
 */
export function encodeContentInterest(
  profile: Partial<StudentProfile>,
): ContentInterestPayload {
  const meta: DomesticMeta = {}
  for (const key of DOMESTIC_META_KEYS) {
    const value = profile[key]
    if (value !== undefined) {
      // Assign through a record cast so each key keeps its declared type
      // without forcing a full Record<keyof DomesticMeta, ...> annotation.
      ;(meta as Record<string, unknown>)[key] = value
    }
  }
  const payload: ContentInterestPayload = {
    v: 2,
    tags: profile.contentInterest ?? [],
  }
  if (Object.keys(meta).length > 0) {
    payload.domesticMeta = meta
  }
  return payload
}

/**
 * Decode a raw `content_interest` value into a `(contentInterest, domesticMeta)`
 * pair. Three branches per design.md:
 *
 *   a. Legacy v1: `Array.isArray(raw)` → `{ contentInterest: raw, domesticMeta: {} }`.
 *   b. New v2:    object with `v === 2` → `{ contentInterest: tags ?? [], domesticMeta: meta ?? {} }`.
 *   c. Anything else (null, undefined, primitives, unknown shapes)
 *      → `{ contentInterest: [], domesticMeta: {} }`.
 *
 * `domesticMeta` is ALWAYS a (possibly-empty) object — never undefined.
 */
export function decodeContentInterest(raw: unknown): {
  contentInterest: string[]
  domesticMeta: DomesticMeta
} {
  if (Array.isArray(raw)) {
    return { contentInterest: raw as string[], domesticMeta: {} }
  }
  if (
    raw !== null &&
    typeof raw === 'object' &&
    (raw as { v?: unknown }).v === 2
  ) {
    const obj = raw as ContentInterestPayload
    return {
      contentInterest: obj.tags ?? [],
      domesticMeta: obj.domesticMeta ?? {},
    }
  }
  return { contentInterest: [], domesticMeta: {} }
}
