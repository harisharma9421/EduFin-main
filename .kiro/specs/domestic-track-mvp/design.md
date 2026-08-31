# Design Document

## Overview

The Domestic Track MVP layers a derived `track` field, a `useTrack()` selector hook, an Indian universities dataset, two new pages (Domestic Admission Predictor and Domestic Loan Center), a CSIS eligibility preview, and six targeted edits to existing pages on top of the current GradPilot codebase. The work is purely additive at the type level and the file system level — no Supabase migration, no edits to `AdmissionPredictor.tsx` or `LoanCenter.tsx`, no changes to the abroad-only Visa Simulator or Currency Risk pages, and no removal of any existing field on `StudentProfile`.

The single source of truth for the derived track is the `useTrack()` hook in `src/lib/useTrack.ts`. Every track-aware surface (sidebar, ROI Calculator, EMI Calculator, SOP Co-Pilot, Scholarship Hunter, Nudge Engine, the two new pages) reads through that hook so the existing abroad flow remains untouched when the user keeps `studyGoal === 'Abroad'`.

Persistence reuses the existing `content_interest jsonb` column on the `profiles` table. That column is currently only used to store an array of free-text content tags from Onboarding Step 9; we extend its shape to a discriminated object that carries both the legacy `tags` array and a `domesticMeta` object holding the new domestic fields. Because Postgres `jsonb` is schemaless and RLS already permits the user to read/write their own row, no migration is required and no other consumer (`AdminAnalytics`, `AdminUsers`, `ExpertDirectory`) depends on the legacy shape. A defensive decoder in `app/page.tsx` accepts both the legacy array shape and the new object shape.

The MVP must coexist with the abroad flow without regressing it (Requirement 13). Track derivation defaults to `'abroad'` for missing or unrecognized study goals (Requirements 1.7 and 1.8), so any pre-MVP user who hydrates their store gets the exact same UI as before until they explicitly choose a domestic or both option in onboarding.

## Architecture

### Component and Data Flow Diagram

```mermaid
flowchart TD
  subgraph Persistence
    SB[(Supabase profiles<br/>content_interest jsonb)]
  end

  subgraph Hydration["Hydration: app/page.tsx"]
    H1[fetchProfile reads row]
    H2[decodeContentInterest<br/>splits tags vs domesticMeta]
    H3[updateProfile writes camelCase<br/>fields onto Zustand store]
  end

  subgraph Store["Zustand store (src/lib/store.ts)"]
    PROF[StudentProfile<br/>+ track, jeeAdvancedRank, gateScore, ...]
    PERSIST[persist middleware<br/>edufinai-storage<br/>partialize includes profile]
  end

  subgraph Selector["useTrack() (src/lib/useTrack.ts)"]
    HOOK[deriveTrack(studyGoal)<br/>returns 'abroad' | 'domestic' | 'both']
  end

  subgraph Onboarding["OnboardingFlow.tsx"]
    O1[Step 4: studyGoal]
    O2[Step 5: Indian-exam inputs<br/>gated by useTrack()]
    O3[syncToDatabase<br/>encodeContentInterest before write]
  end

  subgraph DomesticPages["New pages (track-aware)"]
    DP[DomesticAdmissionPredictor]
    DL[DomesticLoanCenter]
    CS[CSIS Calculator<br/>embedded in DL or as side panel]
  end

  subgraph ExistingPages["Existing pages (track-tweaked)"]
    SB1[DashboardLayout sidebar]
    R[ROICalculator]
    E[EMICalculator]
    SO[SOPCopilot]
    SH[ScholarshipHunter]
    N[NudgeEngine]
  end

  subgraph MockData["src/lib/mock-data.ts"]
    DUD[domesticUniversities]
    PIL[premierInstituteList]
    LP[domesticLoanProducts]
    IS[indianScholarships]
  end

  SB --> H1 --> H2 --> H3 --> PROF
  PROF --> PERSIST --> PROF
  PROF --> HOOK
  HOOK --> O2
  HOOK --> SB1
  HOOK --> DP
  HOOK --> DL
  HOOK --> R
  HOOK --> E
  HOOK --> SO
  HOOK --> SH
  HOOK --> N
  O1 --> PROF
  O2 --> PROF
  PROF --> O3 --> SB
  DUD --> DP
  DUD --> DL
  DUD --> CS
  PIL --> DL
  LP --> DL
  IS --> SH
```

### Read and Write Patterns

- Read on hydration: `app/page.tsx` calls `supabase.from('profiles').select('*')`, decodes the `content_interest` JSON into `{ tags, domesticMeta }`, and dispatches `updateProfile({ contentInterest, track, jeeAdvancedRank, ... })`.
- Write on each onboarding step: `OnboardingFlow.tsx` calls `syncToDatabase` which encodes the new fields into `content_interest` before the existing `update` call. No new HTTP calls are added; the existing single `update` carries the new payload.
- Local persistence: the Zustand `persist` middleware already serializes `profile` into `localStorage` under `edufinai-storage`. Adding new fields onto `StudentProfile` does not require any change to `partialize` because `profile` is already enumerated there.

### Module Isolation Boundaries

- `DomesticAdmissionPredictor.tsx` and `DomesticLoanCenter.tsx` are net-new files. They read from the store and the new mock data; they do not import `AdmissionPredictor.tsx` or `LoanCenter.tsx`.
- `useTrack.ts` is the only allowed reader of `studyGoal` for track derivation. Other consumers must call the hook.
- The CSIS preview is implemented as a small subtree inside `DomesticLoanCenter.tsx` (and reused by `EMICalculator.tsx` via a shared pure function `computeCsisSavings` exported from `src/lib/csis.ts`) so that CSIS lives in one canonical place.

## Components and Interfaces

### New Files

| Path | Purpose |
| --- | --- |
| `src/lib/useTrack.ts` | `useTrack()` hook + `deriveTrack(studyGoal)` pure function |
| `src/lib/csis.ts` | `computeCsisEligible`, `computeCsisSavings` pure functions |
| `src/lib/domesticPredictor.ts` | `classifyRecord`, `classifyDataset` pure functions |
| `src/lib/domesticLoan.ts` | `evaluateLoanProduct`, `domesticLoanProducts` definitions |
| `src/lib/contentInterestCodec.ts` | `encodeContentInterest`, `decodeContentInterest` round-trip codec for the `content_interest` JSON column |
| `src/components/pages/DomesticAdmissionPredictor.tsx` | New page component |
| `src/components/pages/DomesticLoanCenter.tsx` | New page component |

### Modified Files

| Path | Modification |
| --- | --- |
| `src/lib/types.ts` | Add new fields to `StudentProfile`; add `'domestic-admission-predictor'` and `'domestic-loan-center'` to `PageType` union; add new domestic types |
| `src/lib/store.ts` | Add new field defaults to `defaultProfile`; no other change needed (persist already covers `profile`) |
| `src/lib/mock-data.ts` | Add `domesticUniversities`, `premierInstituteList`, `indianScholarships` arrays |
| `src/components/OnboardingFlow.tsx` | Step 5 conditional Indian-exam inputs; `encodeContentInterest` in `syncToDatabase` |
| `src/components/DashboardLayout.tsx` | Track-aware `navSections`; new entries in `PageContent` switch |
| `src/components/NudgeEngine.tsx` | Add three domestic nudges with 7-day cooldown |
| `src/components/pages/ROICalculator.tsx` | INR/USD currency switch with track-driven default |
| `src/components/pages/EMICalculator.tsx` | Domestic interest-rate range; CSIS toggle gated by track |
| `src/components/pages/SOPCopilot.tsx` | Title relabel; track-partitioned example list |
| `src/components/pages/ScholarshipHunter.tsx` | Track-driven default currency filter |
| `src/app/page.tsx` | `decodeContentInterest` on hydration; map new fields to camelCase |

### Files Explicitly Not Modified

- `src/components/pages/AdmissionPredictor.tsx`
- `src/components/pages/LoanCenter.tsx`
- `src/components/pages/VisaSimulator.tsx`
- `src/components/pages/CurrencyRisk.tsx`
- Any Supabase migration file under `supabase/migrations/`

### useTrack() Hook Contract

```ts
// src/lib/useTrack.ts
import { useAppStore } from './store'

export type Track = 'abroad' | 'domestic' | 'both'

export function deriveTrack(studyGoal: string | undefined | null): Track {
  if (studyGoal === undefined || studyGoal === null || studyGoal === '') {
    if (typeof window !== 'undefined') {
      console.warn('[useTrack] studyGoal missing; defaulting track=abroad')
    }
    return 'abroad'
  }
  switch (studyGoal) {
    case 'Abroad': return 'abroad'
    case 'Domestic (India)': return 'domestic'
    case 'Both': return 'both'
    default: return 'abroad' // unknown non-empty values default silently per Req 1.8
  }
}

export function useTrack(): Track {
  return useAppStore((s) => deriveTrack(s.profile.studyGoal))
}
```

The console warning fires exactly once per missing-goal hydration path because `deriveTrack` is invoked from a Zustand selector that React memoizes. We accept the small risk of a duplicate warning across re-renders; the cost is one extra console line. The warning is gated on `typeof window !== 'undefined'` to avoid SSR noise.

## Data Models

### StudentProfile additions

```ts
// Appended to the existing StudentProfile interface in src/lib/types.ts
export type Track = 'abroad' | 'domestic' | 'both'
export type ReservationCategory = 'General' | 'OBC-NCL' | 'EWS' | 'SC' | 'ST' | 'PwD'
export type ExamType = 'JEE_Advanced' | 'GATE' | 'CAT'
export type ReachMatchSafetyBucket = 'Reach' | 'Match' | 'Safety' | 'Out_Of_Range'

export interface StudentProfile {
  // ...existing fields preserved verbatim...

  // Derived track (persisted as part of content_interest.domesticMeta)
  track?: Track

  // Step 5 Indian-exam inputs
  jeeAdvancedRank?: number
  gateScore?: number
  gateScoreYear?: number
  gateRank?: number
  catPercentile?: number
  reservationCategory?: ReservationCategory
  homeState?: string

  // Predictor selection
  targetInstituteId?: string

  // Onboarding bookkeeping
  domesticExamScoreMissing?: boolean
}
```

Defaults in `defaultProfile`:
- `track`: omitted (derived on read).
- All other new fields: omitted; treated as `undefined` until the user fills them.

### Domestic dataset types

```ts
export interface DomesticUniversity {
  id: string
  name: string
  location: string
  examType: ExamType
  tuitionINR: number                       // positive integer rupees
  avgDomesticPlacementCtcINR: number       // positive integer rupees
  seatMatrix: Record<ReservationCategory, number>     // non-negative ints
  closingRanks: Record<ReservationCategory, number>   // ranks for JEE/GATE, percentile (0-100) for CAT
  isNotifiedForCSIS: boolean
}

export interface DomesticLoanProduct {
  id: string
  bankName: string
  productName: string
  interestRateMin: number
  interestRateMax: number
  maxLoanINR: number
  moratoriumMonths: number
  criteria: DomesticLoanCriteria
  notes?: string
}

export interface DomesticLoanCriteria {
  premierInstituteRequired?: boolean       // true => target must be in premierInstituteList
  coApplicantRequired?: boolean            // true => coApplicantStr must be 'Yes'
  collateralRequired?: boolean             // true => collateralAvailableStr must be 'Yes'
  maxFamilyAnnualIncomeINR?: number        // ceiling => familyAnnualIncomeINR must be <= ceiling
}

export type LoanEligibility = 'Eligible' | 'Not_Eligible' | 'Conditionally_Eligible'

export interface IndianScholarship {
  id: string
  name: string
  provider: string
  amount: number          // INR
  currency: 'INR'         // discriminator
  country: 'India'
  deadline: string        // ISO date
  eligibility: string
  matchScore: number
  field: string
  type: 'Merit' | 'Need' | 'Research' | 'Diversity'
}
```

### PageType union additions

```ts
export type PageType =
  | 'landing' | 'onboarding' | 'dashboard'
  // ...existing pages...
  | 'domestic-admission-predictor'
  | 'domestic-loan-center'
```

### Sample Domestic_Universities_Dataset records

```ts
// JEE_Advanced example
{
  id: 'iitb-cse',
  name: 'IIT Bombay — CSE',
  location: 'Mumbai, Maharashtra',
  examType: 'JEE_Advanced',
  tuitionINR: 250000,
  avgDomesticPlacementCtcINR: 2500000,
  seatMatrix: { General: 60, 'OBC-NCL': 32, EWS: 12, SC: 18, ST: 9, PwD: 3 },
  closingRanks: { General: 68, 'OBC-NCL': 45, EWS: 39, SC: 28, ST: 12, PwD: 15 },
  isNotifiedForCSIS: true,
},

// GATE example
{
  id: 'iisc-mtech-cse',
  name: 'IISc Bengaluru — M.Tech CSE',
  location: 'Bengaluru, Karnataka',
  examType: 'GATE',
  tuitionINR: 50000,
  avgDomesticPlacementCtcINR: 3000000,
  seatMatrix: { General: 12, 'OBC-NCL': 6, EWS: 3, SC: 3, ST: 2, PwD: 1 },
  closingRanks: { General: 45, 'OBC-NCL': 120, EWS: 85, SC: 320, ST: 410, PwD: 250 },
  isNotifiedForCSIS: true,
},

// CAT example (closingRanks values are percentiles 0-100)
{
  id: 'iim-a-pgp',
  name: 'IIM Ahmedabad — PGP',
  location: 'Ahmedabad, Gujarat',
  examType: 'CAT',
  tuitionINR: 2500000,
  avgDomesticPlacementCtcINR: 3400000,
  seatMatrix: { General: 200, 'OBC-NCL': 108, EWS: 40, SC: 60, ST: 30, PwD: 12 },
  closingRanks: { General: 99.5, 'OBC-NCL': 96.0, EWS: 97.5, SC: 80.0, ST: 65.0, PwD: 60.0 },
  isNotifiedForCSIS: false,
},
```

The Premier_Institute_List is a string array of institute ids covering the IITs, top NITs (Trichy, Warangal, Surathkal), top IIITs (Hyderabad, Bangalore), the older IIMs (A/B/C/L/I/K), ISB, and BITS Pilani:

```ts
export const premierInstituteList: string[] = [
  'iitb-cse', 'iitd-cse', 'iitm-cse', 'iitkgp-cse', 'iitk-cse', 'iitr-cse',
  'iisc-mtech-cse',
  'nit-trichy-cse', 'nit-warangal-cse', 'nit-surathkal-cse',
  'iiit-hyderabad-cse', 'iiit-bangalore-cse',
  'iim-a-pgp', 'iim-b-pgp', 'iim-c-pgp', 'iim-l-pgp', 'iim-i-pgp', 'iim-k-pgp',
  'isb-pgp',
  'bits-pilani-cse',
]
```

### Domestic Loan Product criteria objects

```ts
export const domesticLoanProducts: DomesticLoanProduct[] = [
  {
    id: 'sbi-scholar', bankName: 'SBI', productName: 'SBI Scholar Loan',
    interestRateMin: 8.55, interestRateMax: 10.05, maxLoanINR: 4000000, moratoriumMonths: 12,
    criteria: { premierInstituteRequired: true },
    notes: 'Concessional rate for AA/A/B/C tier institutes',
  },
  {
    id: 'bob-vidya', bankName: 'Bank of Baroda', productName: 'Baroda Vidya',
    interestRateMin: 8.85, interestRateMax: 11.15, maxLoanINR: 7500000, moratoriumMonths: 12,
    criteria: { coApplicantRequired: true },
  },
  {
    id: 'canara-vidya-turant', bankName: 'Canara Bank', productName: 'Vidya Turant',
    interestRateMin: 9.25, interestRateMax: 11.50, maxLoanINR: 4000000, moratoriumMonths: 12,
    criteria: { coApplicantRequired: true },
  },
  {
    id: 'pnb-saraswati', bankName: 'PNB', productName: 'PNB Saraswati',
    interestRateMin: 9.00, interestRateMax: 11.50, maxLoanINR: 1000000, moratoriumMonths: 12,
    criteria: { collateralRequired: true, coApplicantRequired: true },
  },
  {
    id: 'hdfc-credila-domestic', bankName: 'HDFC Credila', productName: 'HDFC Credila Domestic',
    interestRateMin: 10.50, interestRateMax: 13.50, maxLoanINR: 4000000, moratoriumMonths: 12,
    criteria: { coApplicantRequired: true },
  },
  {
    id: 'avanse-domestic', bankName: 'Avanse', productName: 'Avanse Domestic',
    interestRateMin: 11.00, interestRateMax: 14.00, maxLoanINR: 5000000, moratoriumMonths: 6,
    criteria: { coApplicantRequired: true },
  },
  {
    id: 'vidya-lakshmi', bankName: 'Govt of India', productName: 'Vidya Lakshmi Portal',
    interestRateMin: 8.55, interestRateMax: 11.50, maxLoanINR: 1000000, moratoriumMonths: 12,
    criteria: { maxFamilyAnnualIncomeINR: 450000 },
    notes: 'Routes to multiple PSU banks; CSIS-eligible when income < ₹4.5L and institute is notified.',
  },
]
```

### Persistence Mapping (Requirement 14)

The `profiles` table has six existing JSONB columns: `target_countries`, `dream_universities`, `target_universities`, `safe_universities`, `preference_factors`, `content_interest`. All except `content_interest` are semantically committed to specific domains and have meaningful UI consumers. `content_interest` currently holds a free-text array from Onboarding Step 9 ("Loans, ROI, Career Tips...") that no other component reads programmatically.

Mapping:

| New StudentProfile field | Persisted in | Shape after upgrade |
| --- | --- | --- |
| `track` | `content_interest -> domesticMeta.track` | `'abroad' \| 'domestic' \| 'both'` |
| `jeeAdvancedRank` | `content_interest -> domesticMeta.jeeAdvancedRank` | number |
| `gateScore` | `content_interest -> domesticMeta.gateScore` | number |
| `gateScoreYear` | `content_interest -> domesticMeta.gateScoreYear` | number |
| `gateRank` | `content_interest -> domesticMeta.gateRank` | number |
| `catPercentile` | `content_interest -> domesticMeta.catPercentile` | number |
| `reservationCategory` | `content_interest -> domesticMeta.reservationCategory` | `ReservationCategory` |
| `homeState` | `content_interest -> domesticMeta.homeState` | string |
| `targetInstituteId` | `content_interest -> domesticMeta.targetInstituteId` | string |
| `domesticExamScoreMissing` | `content_interest -> domesticMeta.domesticExamScoreMissing` | boolean |

Codec contract:

```ts
// src/lib/contentInterestCodec.ts
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
  }
}

export function encodeContentInterest(profile: Partial<StudentProfile>): ContentInterestPayload {
  return {
    v: 2,
    tags: profile.contentInterest ?? [],
    domesticMeta: {
      track: profile.track,
      jeeAdvancedRank: profile.jeeAdvancedRank,
      gateScore: profile.gateScore,
      gateScoreYear: profile.gateScoreYear,
      gateRank: profile.gateRank,
      catPercentile: profile.catPercentile,
      reservationCategory: profile.reservationCategory,
      homeState: profile.homeState,
      targetInstituteId: profile.targetInstituteId,
      domesticExamScoreMissing: profile.domesticExamScoreMissing,
    },
  }
}

export function decodeContentInterest(raw: unknown): {
  contentInterest: string[]
  domesticMeta: ContentInterestPayload['domesticMeta']
} {
  // Legacy v1 shape: bare string[] (Onboarding Step 9 originally wrote this)
  if (Array.isArray(raw)) {
    return { contentInterest: raw as string[], domesticMeta: {} }
  }
  // New v2 shape: { v: 2, tags, domesticMeta }
  if (raw && typeof raw === 'object' && (raw as any).v === 2) {
    const obj = raw as ContentInterestPayload
    return { contentInterest: obj.tags ?? [], domesticMeta: obj.domesticMeta ?? {} }
  }
  // Unknown shape: degrade gracefully to empty
  return { contentInterest: [], domesticMeta: {} }
}
```

The codec is intentionally a pure round-trip pair. Encode-then-decode of any well-formed profile must return an equivalent (`tags`, `domesticMeta`) pair (Property 6 below).

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

PBT is appropriate for this MVP because most of the new logic — track derivation, predictor classification, loan eligibility, CSIS savings, the persistence codec, the scholarship filter — is **pure**, with clear input and output and large input spaces where 100+ iterations expose edge cases that a handful of examples would miss. The UI shells around these functions are not PBT targets and are covered separately under Testing Strategy.

All properties below will live as fast-check tests under `tests/properties/domestic-track-*.test.ts`. Each test is configured for a minimum of 100 iterations and is tagged `Feature: domestic-track-mvp, Property N: <title>`.

### Property 1: deriveTrack totality and default-to-abroad

*For any* string, `null`, or `undefined` value supplied as `studyGoal`, `deriveTrack(studyGoal)` returns exactly one value in `{ 'abroad', 'domestic', 'both' }`, with `'Abroad'` mapping to `'abroad'`, `'Domestic (India)'` mapping to `'domestic'`, `'Both'` mapping to `'both'`, and every other input (including empty string, `null`, `undefined`, and any unknown non-canonical string) mapping to `'abroad'`.

- Function under test: `deriveTrack` in `src/lib/useTrack.ts`.
- Generators: `fc.oneof(fc.string(), fc.constant(undefined), fc.constant(null), fc.constantFrom('Abroad', 'Domestic (India)', 'Both'))`.
- Pre-condition: none.
- Post-condition: result ∈ {'abroad', 'domestic', 'both'}; canonical mapping holds; unknown strings ⇒ `'abroad'`.
- Shrinking: fast-check shrinks toward the empty string and the lexicographically smallest unknown string; for canonical inputs it surfaces them directly.
- File: `tests/properties/domestic-track-derive.test.ts`.
- **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.7, 1.8**

### Property 2: Predictor classification monotonicity

*For any* domestic university record `r`, any reservation category `c`, and any two user ranks `rankA <= rankB` (lower is better in JEE/GATE) — or any two user percentiles `pctA >= pctB` (higher is better in CAT) — the predictor's bucket for `rankA` is at least as good as the bucket for `rankB`, where bucket order is `Safety > Match > Reach > Out_Of_Range`.

- Function under test: `classifyRecord(profile, record)` in `src/lib/domesticPredictor.ts`.
- Generators: arbitrary records from `domesticUniversities`; arbitrary positive integers for ranks; arbitrary 0–100 floats for percentiles.
- Pre-condition: profile has the relevant exam score populated and `reservationCategory` set.
- Post-condition: `bucketRank(classify(rankA)) >= bucketRank(classify(rankB))`.
- Shrinking: shrink toward the smallest pair of ranks straddling the 70 % and 110 % thresholds.
- File: `tests/properties/domestic-track-predictor-monotone.test.ts`.
- **Validates: Requirements 4.2, 4.3, 4.4**

### Property 3: Predictor classification partition

*For any* dataset of domestic university records and any profile, `classifyDataset` partitions the dataset into the four buckets `{ Reach, Match, Safety, Out_Of_Range }` such that every input record appears in exactly one bucket and the disjoint union of the four buckets equals the input dataset; further, when the profile has no populated score matching a record's `examType`, that record lands in `Out_Of_Range`.

- Function under test: `classifyDataset(profile, dataset)`.
- Generators: arbitrary subsets of `domesticUniversities`; arbitrary profiles including the all-blank-scores profile.
- Pre-condition: none.
- Post-condition: `Reach ∪ Match ∪ Safety ∪ Out_Of_Range == dataset` (set equality); pairwise disjoint.
- Shrinking: shrink toward singleton datasets and minimal profiles.
- File: `tests/properties/domestic-track-predictor-partition.test.ts`.
- **Validates: Requirements 4.5, 4.7**

### Property 4: CSIS eligibility is a pure AND of the two clauses

*For any* `(familyAnnualIncomeINR, isNotifiedForCSIS)` pair where the income is a non-negative integer and `isNotifiedForCSIS` is a boolean, `computeCsisEligible(income, isNotified)` returns `true` if and only if `income < 450000` AND `isNotified === true`.

- Function under test: `computeCsisEligible` in `src/lib/csis.ts`.
- Generators: `fc.integer({ min: 0, max: 5_000_000 })` × `fc.boolean()`.
- Pre-condition: income is non-negative.
- Post-condition: equality with `(income < 450000) && isNotified`.
- Shrinking: shrink toward income = 0, 449_999, 450_000, 450_001 boundary cases.
- File: `tests/properties/domestic-track-csis-eligibility.test.ts`.
- **Validates: Requirements 6.2**

### Property 5: CSIS savings is monotonic non-decreasing in inputs when eligible, and zero when ineligible

*For any* eligible CSIS scenario and any pair `(principal, rate, months)` and `(principal', rate', months')` where each component of the second triple is greater than or equal to the corresponding component of the first, `computeCsisSavings` returns a value at least as large for the second triple as for the first. *For any* ineligible scenario, `computeCsisSavings` returns exactly `0`. *For any* eligible scenario where any one of `principal`, `rate`, or `months` equals zero, `computeCsisSavings` returns exactly `0`.

- Function under test: `computeCsisSavings(eligible, principal, rate, months)`.
- Generators: `fc.boolean()` for eligible; non-negative numbers for principal/rate/months; pairs constructed by component-wise increment.
- Pre-condition: all numeric inputs non-negative.
- Post-condition: monotonicity gated by eligibility; zero when ineligible; zero when eligible but any factor is zero.
- Shrinking: shrink toward `(0, 0, 0)` and the eligibility flip.
- File: `tests/properties/domestic-track-csis-savings.test.ts`.
- **Validates: Requirements 6.3, 6.4, 6.9**

### Property 6: Profile round-trip through the content_interest codec

*For any* `StudentProfile` sub-record carrying a `contentInterest` array of strings and any subset of the new domestic fields, `decodeContentInterest(encodeContentInterest(profile))` returns a `(contentInterest, domesticMeta)` pair that, when re-projected onto a `StudentProfile`, equals the original sub-record (modulo `undefined`-vs-omitted equivalence).

- Function under test: `encodeContentInterest` and `decodeContentInterest` in `src/lib/contentInterestCodec.ts`.
- Generators: `fc.record({ contentInterest: fc.array(fc.string()), track: fc.option(fc.constantFrom('abroad','domestic','both')), jeeAdvancedRank: fc.option(fc.integer({min: 1, max: 5_000_000})), ... })`.
- Pre-condition: every numeric field, when present, is non-negative; `reservationCategory`, when present, is a valid enum value.
- Post-condition: decode∘encode is the identity on the projected sub-record.
- Shrinking: fast-check shrinks toward empty arrays and `undefined` field values.
- File: `tests/properties/domestic-track-codec-roundtrip.test.ts`.
- **Validates: Requirements 14.1, 14.2, 14.3**

### Property 7: Loan eligibility tri-state

*For any* `DomesticLoanProduct` and any `StudentProfile`, `evaluateLoanProduct(product, profile)` returns:
- `Eligible` iff every required criterion in `product.criteria` has a present input on the profile AND every present input satisfies its predicate;
- `Not_Eligible` iff at least one required criterion has a present input on the profile that fails its predicate;
- `Conditionally_Eligible` iff at least one required criterion's input is missing on the profile AND no present input has failed its predicate.

The three results are mutually exclusive and exhaustive over all `(product, profile)` pairs.

- Function under test: `evaluateLoanProduct` in `src/lib/domesticLoan.ts`.
- Generators: arbitrary `DomesticLoanProduct` (cross product of optional criteria) × arbitrary partial profiles.
- Pre-condition: none.
- Post-condition: the result matches the truth-table reference implementation; exclusivity check.
- Shrinking: shrink toward minimal criteria sets and minimal profiles.
- File: `tests/properties/domestic-track-loan-eligibility.test.ts`.
- **Validates: Requirements 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9**

### Property 8: Scholarship currency filter idempotence and track-driven default

*For any* array of scholarships and any track, `filterScholarshipsByCurrency(filterScholarshipsByCurrency(xs, track), track) == filterScholarshipsByCurrency(xs, track)` (idempotence). *For any* track value `'domestic'`, the filter returns only records with `currency === 'INR'`. *For any* track value `'abroad'`, the filter returns only records with `currency !== 'INR'`. *For any* explicit `currency` override, the filter respects the override regardless of track.

- Function under test: `filterScholarshipsByCurrency(scholarships, track, override?)` (new helper inside `ScholarshipHunter.tsx` or a sibling pure module).
- Generators: arbitrary arrays of scholarship records with `currency ∈ {'INR', 'USD', 'GBP', 'EUR', 'AUD'}`; arbitrary tracks.
- Pre-condition: none.
- Post-condition: idempotence; per-track default subset; override respected.
- Shrinking: shrink toward singleton arrays.
- File: `tests/properties/domestic-track-scholarship-filter.test.ts`.
- **Validates: Requirements 11.3, 11.4, 11.5, 11.6**

### Property 9: Sidebar visibility per track

*For any* track value `t` in `{ 'abroad', 'domestic', 'both' }`, `visibleSidebarPages(t)` returns a deterministic subset of nav items satisfying:
- `t === 'abroad'` ⇒ subset includes `visa-simulator` and `currency-risk` and excludes `domestic-admission-predictor` and `domestic-loan-center`;
- `t === 'domestic'` ⇒ subset excludes `visa-simulator` and `currency-risk` and includes `domestic-admission-predictor` and `domestic-loan-center`;
- `t === 'both'` ⇒ subset includes all four pages.

- Function under test: `filterNavSections(navSections, track)`.
- Generators: arbitrary track values.
- File: `tests/properties/domestic-track-sidebar.test.ts`.
- **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 10: SOP example list partitioning

*For any* track value, `sopExamplesFor(track)` equals: only abroad examples when `track === 'abroad'`; only domestic examples when `track === 'domestic'`; the union when `track === 'both'`.

- Function under test: `sopExamplesFor(track)` (new pure helper inside `SOPCopilot.tsx`).
- File: `tests/properties/domestic-track-sop-examples.test.ts`.
- **Validates: Requirements 10.3, 10.4, 10.5**

### Property 11: Onboarding Step 5 validation rules

*For any* numeric input, `validateStep5({ jeeAdvancedRank, gateRank, catPercentile, gateScoreYear })` rejects iff:
- `jeeAdvancedRank` or `gateRank` is present and `<= 0`;
- `catPercentile` is present and outside the inclusive range `[0, 100]`;
- `gateScoreYear` is present and outside `[currentYear - 4, currentYear]`;
and accepts otherwise.

- File: `tests/properties/domestic-track-onboarding-validation.test.ts`.
- **Validates: Requirements 3.5, 3.6, 3.7**

### Property 12: domesticExamScoreMissing flag

*For any* triple `(jeeAdvancedRank, gateScore, catPercentile)` where each component is independently either undefined or a number, `domesticExamScoreMissing(triple)` is `true` iff every component is undefined.

- File: `tests/properties/domestic-track-onboarding-validation.test.ts` (same suite).
- **Validates: Requirements 3.8**

### Property 13: EMI CSIS toggle delta is non-negative

*For any* eligible CSIS scenario and any `(principal, rate, months)`, `effectiveEmiWithCsis(principal, rate, months) <= effectiveEmiWithoutCsis(principal, rate, months)`. For any ineligible scenario, the two EMIs are equal.

- Function under test: `effectiveEmi(principal, rate, months, csisOn, csisEligible)` (extracted helper inside `EMICalculator.tsx` or co-located in `src/lib/csis.ts`).
- File: `tests/properties/domestic-track-emi-csis.test.ts`.
- **Validates: Requirements 9.3, 9.4**

### Property 14: Nudge cooldown invariant

*For any* nudge dismissal timestamp `t` and any "now" `n` such that `n - t < 7 days`, the Nudge Engine's `surfacedDomesticNudges(profile, n)` does not include the dismissed nudge. *For any* `track === 'abroad'`, `surfacedDomesticNudges` returns the empty set regardless of any other input.

- Function under test: `surfacedDomesticNudges(profile, now)` (new pure helper inside `NudgeEngine.tsx` or a sibling module).
- File: `tests/properties/domestic-track-nudge-cooldown.test.ts`.
- **Validates: Requirements 12.5, 12.6**

## Algorithms

### Predictor classification (pseudocode)

```ts
// src/lib/domesticPredictor.ts
const BUCKET_ORDER: Record<ReachMatchSafetyBucket, number> = {
  Safety: 3, Match: 2, Reach: 1, Out_Of_Range: 0,
}

export function classifyRecord(
  profile: Pick<StudentProfile,
    'jeeAdvancedRank' | 'gateRank' | 'catPercentile' | 'reservationCategory'>,
  record: DomesticUniversity,
): { bucket: ReachMatchSafetyBucket; usedFallbackCategory: boolean } {
  const cat: ReservationCategory = profile.reservationCategory ?? 'General'
  const usedFallbackCategory = !profile.reservationCategory
  const closing = record.closingRanks[cat]

  if (record.examType === 'JEE_Advanced') {
    if (profile.jeeAdvancedRank == null) return { bucket: 'Out_Of_Range', usedFallbackCategory }
    return { bucket: bucketByRank(profile.jeeAdvancedRank, closing), usedFallbackCategory }
  }
  if (record.examType === 'GATE') {
    if (profile.gateRank == null) return { bucket: 'Out_Of_Range', usedFallbackCategory }
    return { bucket: bucketByRank(profile.gateRank, closing), usedFallbackCategory }
  }
  if (record.examType === 'CAT') {
    if (profile.catPercentile == null) return { bucket: 'Out_Of_Range', usedFallbackCategory }
    return { bucket: bucketByPercentile(profile.catPercentile, closing), usedFallbackCategory }
  }
  return { bucket: 'Out_Of_Range', usedFallbackCategory } // exhaustiveness guard
}

function bucketByRank(userRank: number, closingRank: number): ReachMatchSafetyBucket {
  if (userRank <= closingRank * 0.70) return 'Safety'
  if (userRank <= closingRank * 1.10) return 'Match'
  return 'Reach'
}

function bucketByPercentile(userPct: number, closingPct: number): ReachMatchSafetyBucket {
  if (userPct >= closingPct + 5) return 'Safety'
  if (userPct >= closingPct - 5) return 'Match'
  return 'Reach'
}

export function classifyDataset(profile, dataset): {
  Reach: DomesticUniversity[]; Match: DomesticUniversity[];
  Safety: DomesticUniversity[]; Out_Of_Range: DomesticUniversity[];
  usedFallbackCategory: boolean;
} {
  // Group, then within each non-OOR bucket sort by ascending closingRank
  // (or descending closing percentile when examType === 'CAT').
}
```

The 70 % / 110 % thresholds and the 5 percentile-points threshold come straight from Requirements 4.2–4.4. The `usedFallbackCategory` flag drives the banner mandated by Requirement 4.6.

### Loan eligibility (pseudocode)

```ts
// src/lib/domesticLoan.ts
type CriterionResult = 'pass' | 'fail' | 'missing'

export function evaluateLoanProduct(
  product: DomesticLoanProduct,
  profile: Pick<StudentProfile,
    'familyAnnualIncomeINR' | 'coApplicantStr' | 'collateralAvailableStr' | 'targetInstituteId'>,
): { status: LoanEligibility; matched: string[]; unmatched: string[]; missing: string[] } {

  const checks: { name: string; result: CriterionResult }[] = []
  const c = product.criteria

  if (c.premierInstituteRequired) {
    const id = profile.targetInstituteId
    if (id == null) checks.push({ name: 'Premier institute target', result: 'missing' })
    else checks.push({ name: 'Premier institute target',
      result: premierInstituteList.includes(id) ? 'pass' : 'fail' })
  }
  if (c.coApplicantRequired) {
    const v = profile.coApplicantStr
    if (v == null || v === '') checks.push({ name: 'Co-applicant', result: 'missing' })
    else checks.push({ name: 'Co-applicant', result: v === 'Yes' ? 'pass' : 'fail' })
  }
  if (c.collateralRequired) {
    const v = profile.collateralAvailableStr
    if (v == null || v === '') checks.push({ name: 'Collateral', result: 'missing' })
    else checks.push({ name: 'Collateral', result: v === 'Yes' ? 'pass' : 'fail' })
  }
  if (c.maxFamilyAnnualIncomeINR != null) {
    const inc = profile.familyAnnualIncomeINR
    if (inc == null) checks.push({ name: `Family income <= ₹${c.maxFamilyAnnualIncomeINR}`, result: 'missing' })
    else checks.push({ name: `Family income <= ₹${c.maxFamilyAnnualIncomeINR}`,
      result: inc <= c.maxFamilyAnnualIncomeINR ? 'pass' : 'fail' })
  }

  const anyFail = checks.some(c => c.result === 'fail')
  const anyMissing = checks.some(c => c.result === 'missing')

  let status: LoanEligibility
  if (anyFail) status = 'Not_Eligible'
  else if (anyMissing) status = 'Conditionally_Eligible'
  else status = 'Eligible'

  return {
    status,
    matched: checks.filter(c => c.result === 'pass').map(c => c.name),
    unmatched: checks.filter(c => c.result === 'fail').map(c => c.name),
    missing: checks.filter(c => c.result === 'missing').map(c => c.name),
  }
}
```

`familyAnnualIncomeINR` is parsed from the existing `familyIncomeStr` bucket-string at evaluation time (e.g. "Below 3L" → 300_000, "3L – 6L" → 600_000 conservative upper bound). The parser is a small helper colocated in `src/lib/domesticLoan.ts`.

The classifier matches the Requirement 5.7–5.9 truth table exactly: only when there is no `missing` and no `fail` is the product `Eligible`; if there is any `fail` the product is `Not_Eligible`; otherwise (some `missing`, no `fail`) the product is `Conditionally_Eligible`. Property 7 above tests this.

### CSIS calculator (pseudocode)

```ts
// src/lib/csis.ts
export function computeCsisEligible(
  familyAnnualIncomeINR: number | undefined,
  isNotifiedForCSIS: boolean | undefined,
): { eligible: boolean; reason: 'income' | 'institute' | 'both' | 'ok' | 'missing-income' | 'missing-institute' } {
  if (familyAnnualIncomeINR == null) return { eligible: false, reason: 'missing-income' }
  if (isNotifiedForCSIS == null) return { eligible: false, reason: 'missing-institute' }
  const incomeOk = familyAnnualIncomeINR < 450000
  if (incomeOk && isNotifiedForCSIS) return { eligible: true, reason: 'ok' }
  if (!incomeOk && !isNotifiedForCSIS) return { eligible: false, reason: 'both' }
  if (!incomeOk) return { eligible: false, reason: 'income' }
  return { eligible: false, reason: 'institute' }
}

export function computeCsisSavings(
  eligible: boolean,
  principalINR: number,
  annualRatePct: number,
  moratoriumMonths: number,
): number {
  // Validation: any negative or non-numeric input -> NaN signal upstream
  if (principalINR < 0 || annualRatePct < 0 || moratoriumMonths < 0) return NaN
  if (!eligible) return 0
  // Simple interest over the moratorium period
  return principalINR * (annualRatePct / 100) * (moratoriumMonths / 12)
}
```

The CSIS calculator UI surfaces the `reason` to display the failing-condition banner mandated by Requirements 6.4, 6.6, and 6.7. Negative or non-numeric inputs are caught at the form layer (Requirement 6.8) before this function is called; the `< 0` guard is defense-in-depth. Zero values pass through and produce zero savings (Requirement 6.9).

## Onboarding Step 5 Changes

Step 5 today renders GRE / GMAT / IELTS / TOEFL inputs unconditionally. The change keeps every existing input but wraps an additional sub-section that is conditionally rendered based on the result of `useTrack()`:

- `track === 'abroad'`: render exactly the existing inputs. No new fields.
- `track === 'domestic'`: hide GRE / GMAT (still optional, but de-emphasized — moved into a collapsed "Other exams" disclosure) and render the Indian-exam inputs.
- `track === 'both'`: render every input (abroad set + Indian set).

The new Indian-exam inputs:

| Field | Type | Validation |
| --- | --- | --- |
| `jeeAdvancedRank` | number | must be `> 0` if present |
| `gateScore` | number | must be `>= 0` if present |
| `gateScoreYear` | number | must be in `[currentYear - 4, currentYear]` if present |
| `gateRank` | number | must be `> 0` if present |
| `catPercentile` | number | must be in `[0, 100]` if present |
| `reservationCategory` | enum | one of `General \| OBC-NCL \| EWS \| SC \| ST \| PwD` |
| `homeState` | string | non-empty if present |

`domesticExamScoreMissing` flow:
- Computed at submit time as `jeeAdvancedRank == null && gateScore == null && catPercentile == null` (when track is domestic or both).
- When `true`, submission is permitted (Requirement 3.8) and a soft banner appears on the next step encouraging the user to come back later.
- Persisted via the codec into `content_interest.domesticMeta.domesticExamScoreMissing`.

### Validation helper

```ts
// Local helper inside OnboardingFlow.tsx (or extracted to src/lib/onboardingValidation.ts)
export function validateStep5(input: {
  jeeAdvancedRank?: number; gateRank?: number; catPercentile?: number; gateScoreYear?: number;
}, currentYear: number): { ok: boolean; errors: Record<string, string> } { /* ... */ }
```

Property 11 covers this helper.

## Sidebar and PageType Wiring

```ts
// src/lib/types.ts
export type PageType =
  | /* existing values */
  | 'domestic-admission-predictor'
  | 'domestic-loan-center'
```

```ts
// src/components/DashboardLayout.tsx (sketch — no functional code outside design)
const navSectionsRaw = [ /* existing sections, unchanged */ ]

function visibleSections(track: Track) {
  return navSectionsRaw
    .map(section => ({
      ...section,
      items: section.items.filter(item => isItemVisible(item.page, track)),
    }))
    .filter(section => section.items.length > 0)
}

function isItemVisible(page: PageType, track: Track): boolean {
  if (track === 'abroad') {
    return page !== 'domestic-admission-predictor' && page !== 'domestic-loan-center'
  }
  if (track === 'domestic') {
    return page !== 'visa-simulator' && page !== 'currency-risk'
  }
  return true // 'both'
}

// In DashboardLayout component body:
const track = useTrack()
const navSections = useMemo(() => visibleSections(track), [track])
```

The `Evaluate` section receives a new entry `{ icon: Target, label: 'Domestic Predictor', page: 'domestic-admission-predictor' }` and the `Finance` section receives `{ icon: DollarSign, label: 'Domestic Loan Center', page: 'domestic-loan-center' }`. The `PageContent` switch grows two cases:

```ts
case 'domestic-admission-predictor': return <DomesticAdmissionPredictor />
case 'domestic-loan-center': return <DomesticLoanCenter />
```

Property 9 covers `isItemVisible`.

## ROI Calculator INR Mode

The existing ROI Calculator uses `formatINR` for display but internally already takes inputs in INR/lakhs (`loanAmount` is a number-of-lakhs slider) — the "USD" label is cosmetic. The change is to add a currency switch:

```ts
type Currency = 'INR' | 'USD'

function defaultCurrency(track: Track): Currency {
  switch (track) {
    case 'abroad': return 'USD'
    case 'domestic': return 'INR'
    case 'both': return 'INR'
  }
}
```

State: `const [currency, setCurrency] = useState<Currency>(defaultCurrency(track))`. When the user toggles, recompute outputs but preserve the typed input numbers (the input model is currency-agnostic; only the labels and the `formatINR`/`formatUSD` calls change). Validation rejects negative or non-numeric values inline (Requirement 8.5). When `track === 'both'` the switch is shown as a control; when `track === 'domestic'` it is shown but locked to INR; when `track === 'abroad'` the switch is hidden and behavior is identical to today (Requirement 13).

## EMI Calculator Domestic Presets and CSIS Toggle

Track-driven defaults inside `EMICalculator.tsx`:

```ts
const track = useTrack()
const interestRange = (track === 'abroad') ? { min: 5.0, max: 14.0 } : { min: 8.5, max: 12.0 }
const showCsisToggle = (track === 'domestic' || track === 'both')
```

When `showCsisToggle` is on, a checkbox appears. When checked AND the user has a `targetInstituteId` resolving to a `DomesticUniversity` AND `computeCsisEligible(...).eligible === true`, the EMI display shows two columns: "Without CSIS" and "With CSIS", where the CSIS column subtracts `computeCsisSavings(...)` from the total interest before redistributing into monthly EMI. When eligibility fails, the toggle still turns on but the calculator overlays a banner naming the failing condition (income / institute / both / missing).

Property 13 covers the EMI delta non-negativity.

## SOP Co-Pilot Relabel and Example Partitioning

Title and CTA become `'SOP / SOP-style note'` for every track value (Requirement 10.1). The prompt-construction and AI-call code is untouched (Requirement 10.2).

```ts
const ABROAD_EXAMPLES = [/* existing */]
const DOMESTIC_EXAMPLES = [
  { id: 'iit-mtech-research', label: 'IIT M.Tech research statement', body: '...' },
  { id: 'iim-watpi-note', label: 'IIM WAT-PI style note', body: '...' },
  // additional entries optional
]

function sopExamplesFor(track: Track) {
  if (track === 'abroad') return ABROAD_EXAMPLES
  if (track === 'domestic') return DOMESTIC_EXAMPLES
  return [...ABROAD_EXAMPLES, ...DOMESTIC_EXAMPLES] // 'both' = union, per Requirement 10.5
}
```

Note the partition is **replace, not union**, for `'abroad'` and `'domestic'` per Requirements 10.3 and 10.4; only `'both'` does the union per Requirement 10.5. Property 10 covers this.

## Scholarship Hunter Currency-Based Default

Add an Indian scholarships array to `mock-data.ts`:

```ts
export const indianScholarships: IndianScholarship[] = [
  { id: 'inspire', name: 'INSPIRE Scholarship', provider: 'DST', amount: 80000, currency: 'INR', country: 'India', deadline: '2025-09-30', eligibility: 'Top 1% in Class XII Boards', matchScore: 90, field: 'Sciences', type: 'Merit' },
  { id: 'inspire-manak', name: 'INSPIRE-MANAK', provider: 'DST', amount: 10000, currency: 'INR', country: 'India', deadline: '2025-08-31', eligibility: 'Class 6-10 students', matchScore: 70, field: 'Sciences', type: 'Merit' },
  { id: 'reliance-ug', name: 'Reliance Foundation UG Scholarship', provider: 'Reliance Foundation', amount: 200000, currency: 'INR', country: 'India', deadline: '2025-10-15', eligibility: 'UG students', matchScore: 85, field: 'Any', type: 'Need' },
  { id: 'tata-trust', name: 'Tata Trust Scholarship', provider: 'Tata Trust', amount: 150000, currency: 'INR', country: 'India', deadline: '2025-11-01', eligibility: 'Need-based', matchScore: 80, field: 'Any', type: 'Need' },
  { id: 'mh-merit', name: 'Maharashtra State Merit Scholarship', provider: 'Govt of Maharashtra', amount: 50000, currency: 'INR', country: 'India', deadline: '2025-09-15', eligibility: 'MH-domicile UG/PG', matchScore: 75, field: 'Any', type: 'Merit' },
  // ...8 to 10 total per Requirement 11.1
]
```

In `ScholarshipHunter.tsx`:

```ts
const track = useTrack()
const [explicitCurrency, setExplicitCurrency] = useState<string | undefined>(undefined)

function filterScholarshipsByCurrency(xs: Scholarship[], track: Track, override?: string): Scholarship[] {
  if (override) return xs.filter(s => s.currency === override)
  if (track === 'domestic') return xs.filter(s => s.currency === 'INR')
  if (track === 'abroad') return xs.filter(s => s.currency !== 'INR')
  return xs.slice().sort((a, b) => a.deadline.localeCompare(b.deadline))
}
```

Property 8 covers this filter. Combined dataset = `[...existingAbroadScholarships, ...indianScholarships]`.

## Nudge Engine Domestic Nudges

Three new nudge types, each gated by `track !== 'abroad'` and a 7-day cooldown keyed off the existing `notifications` array:

```ts
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function wasDismissedRecently(notifications: Notification[], type: string, now: number): boolean {
  const last = notifications.find(n => n.title.startsWith(type) && n.read)
  if (!last) return false
  return now - new Date(last.timestamp).getTime() < SEVEN_DAYS_MS
}

function surfacedDomesticNudges(profile, now): NudgeSpec[] {
  const t = deriveTrack(profile.studyGoal)
  if (t === 'abroad') return [] // Requirement 12.5

  const nudges: NudgeSpec[] = []

  // 1. CSIS eligibility
  const inst = domesticUniversities.find(u => u.id === profile.targetInstituteId)
  const csis = computeCsisEligible(profile.familyAnnualIncomeINR, inst?.isNotifiedForCSIS)
  if (csis.eligible && !wasDismissedRecently(profile.notifications, 'CSIS', now)) {
    nudges.push({ type: 'CSIS', actionPage: 'domestic-loan-center', /* ... */ })
  }

  // 2. JoSAA round dates (configured constants)
  for (const date of JOSAA_ROUND_DATES) {
    const diffDays = (date.getTime() - now) / (1000 * 60 * 60 * 24)
    if (diffDays >= 0 && diffDays <= 14 && !wasDismissedRecently(profile.notifications, 'JoSAA', now)) {
      nudges.push({ type: 'JoSAA', actionPage: 'domestic-admission-predictor', /* ... */ })
      break
    }
  }

  // 3. GATE validity
  const currentYear = new Date(now).getFullYear()
  if (profile.gateScoreYear) {
    const age = currentYear - profile.gateScoreYear
    if (age >= 2 && age <= 3 && !wasDismissedRecently(profile.notifications, 'GATE', now)) {
      nudges.push({ type: 'GATE', actionPage: 'onboarding', /* ... */ })
    }
  }

  return nudges
}
```

The cooldown reuses the existing `notifications` array on the store: when the user dismisses (marks as read) a domestic nudge, that notification carries a timestamp; the engine re-checks against `Date.now()`. No new state is added. Property 14 covers the cooldown and abroad-empty invariants.

## Error Handling

| Failure mode | Surface | Behavior |
| --- | --- | --- |
| `studyGoal` missing on hydration | useTrack | Default to `'abroad'`, console.warn once (Req 1.7) |
| Unknown `studyGoal` string | useTrack | Default to `'abroad'`, no warning (Req 1.8) |
| `reservationCategory` missing in predictor | DomesticAdmissionPredictor | Default lookup to `General`, banner (Req 4.6) |
| No exam score matching record's examType | DomesticAdmissionPredictor | All records → `Out_Of_Range`, banner with deep link to Onboarding Step 5 (Req 4.5) |
| `targetInstituteId` missing in CSIS | DomesticLoanCenter / EMICalculator | `csisEligible = false`, banner with deep link to Domestic Predictor (Req 6.7) |
| `familyAnnualIncomeINR` missing in CSIS | DomesticLoanCenter / EMICalculator | `csisEligible = false`, banner with deep link to Onboarding Step 7 (Req 6.6) |
| Negative numeric inputs (CSIS, ROI, EMI) | Form layer | Inline validation error; suppress derived output (Req 6.8, 8.5) |
| Loan product input missing | DomesticLoanCenter | `Conditionally_Eligible`, missing fields listed with deep link to Onboarding (Req 5.9) |
| Unknown `content_interest` JSON shape on hydration | decodeContentInterest | Degrade to empty payload; log once; user can re-fill in onboarding |
| Supabase write failure | OnboardingFlow.syncToDatabase | Existing `console.error` path is preserved; user can retry |

## Testing Strategy

### Property-based tests

Use **fast-check** (already a JS-ecosystem standard, MIT-licensed, zero new infra). Add it as a dev dependency. Configure each property test for a minimum of 100 iterations and tag it via a comment:

```ts
// Feature: domestic-track-mvp, Property 4: CSIS eligibility AND
import * as fc from 'fast-check'
// ...
```

Property tests live under `tests/properties/domestic-track-*.test.ts` and run via `vitest --run` (Vitest is the default Next.js 16 test runner; if Vitest is not yet wired up, add it in the same task as the first property test). Tests are pure, in-memory, fast; no Supabase, no DOM.

### Unit and integration tests

- Unit tests (Vitest, no DOM) for: `formatINR` / `parseFamilyIncome` parsing helpers, the codec on a handful of legacy + new fixtures, `validateStep5` representative cases, and the seven-product fixture in `domesticLoanProducts`.
- Component tests (Vitest + React Testing Library) for: Onboarding Step 5 conditional rendering across all three track values, sidebar visibility, ROI currency toggle interaction, EMI CSIS toggle interaction, ScholarshipHunter default-filter render.
- Integration tests (one per surface) for: hydration round-trip via a mock Supabase client (encode in `syncToDatabase`, decode in `fetchProfile`), and the new pages mounting under `DashboardLayout` without runtime errors.
- Smoke tests for: file existence at the four mandated paths in Requirement 16; nav entries present; both pages reachable from the sidebar.

The combination of property tests for pure logic and example/integration tests for UI gives the dual-coverage profile mandated by the workflow: 100+ inputs per property catch edge cases (boundary at 70 %, 110 %, 5 percentile points, ₹4.5L income, year-0 / year-4 GATE windows); concrete examples catch the "is it actually wired up?" failures.

## Theme Compatibility

Every new component uses the existing CSS-variable palette already exposed in `src/app/globals.css` and the existing utility classes from the abroad pages:

- Layout chrome: `card`, `glass`, `stat-card`.
- Buttons: `btn-primary`, `btn-secondary`.
- Form inputs: `input-field`.
- Color tokens: `var(--background)`, `var(--surface)`, `var(--foreground)`, `var(--foreground-secondary)`, `var(--foreground-muted)`, `var(--primary)`, `var(--primary-light)`, `var(--secondary)`, `var(--accent)`, `var(--info)`, `var(--success)`, `var(--warning)`, `var(--danger)`, `var(--border)`, `var(--gradient-primary)`.

No hex literal is introduced into the new files (Requirement 15.1, 15.2). Recharts colors that today use hex literals in `ROICalculator.tsx` and `EMICalculator.tsx` are left as-is for parity with the existing components.

## Backward Compatibility

- The existing `targetCountry`, `targetCountries`, `studyGoal`, and abroad exam fields on `StudentProfile` are preserved verbatim.
- `AdmissionPredictor.tsx`, `LoanCenter.tsx`, `VisaSimulator.tsx`, `CurrencyRisk.tsx` are not edited (Requirement 16.1, 16.2; Requirement 13.1).
- When `track === 'abroad'`, every track-aware surface renders the pre-MVP behavior:
  - Sidebar: today's section list verbatim.
  - ROI Calculator: today's USD-labeled flow.
  - EMI Calculator: today's interest range, no CSIS toggle.
  - SOP Co-Pilot: today's example list, with the new title.
  - Scholarship Hunter: today's filter behavior (non-INR by default for an abroad-tracked user).
  - Nudge Engine: no domestic nudges surfaced (Requirement 12.5).
- Pre-MVP rows on `profiles.content_interest` (legacy `string[]`) decode without error via the codec's array-shape branch.
- Local-storage-persisted profiles from before the MVP have no `track` field; `useTrack()` derives it on read so the user sees the abroad UI until they explicitly switch in Onboarding Step 4.

## Implementation Order Hint

This is a hint only — the formal task list belongs in `tasks.md`. Suggested file-touch sequence:

1. `src/lib/types.ts` — add `Track`, `ReservationCategory`, `ExamType`, `ReachMatchSafetyBucket`, `DomesticUniversity`, `DomesticLoanProduct`, `DomesticLoanCriteria`, `LoanEligibility`, `IndianScholarship`; add new fields to `StudentProfile`; add new entries to `PageType`.
2. `src/lib/mock-data.ts` — add `domesticUniversities`, `premierInstituteList`, `indianScholarships`.
3. `src/lib/useTrack.ts` — `deriveTrack`, `useTrack`.
4. `src/lib/contentInterestCodec.ts` — codec.
5. `src/lib/csis.ts` — `computeCsisEligible`, `computeCsisSavings`.
6. `src/lib/domesticPredictor.ts` — `classifyRecord`, `classifyDataset`.
7. `src/lib/domesticLoan.ts` — products + `evaluateLoanProduct`.
8. `src/lib/store.ts` — defaults for new fields (no other change needed).
9. `src/app/page.tsx` — `decodeContentInterest` on hydration; wire new camelCase fields.
10. `src/components/OnboardingFlow.tsx` — Step 5 conditional inputs; `encodeContentInterest` in `syncToDatabase`.
11. `src/components/DashboardLayout.tsx` — track-aware nav; `PageContent` cases for the two new pages.
12. `src/components/pages/DomesticAdmissionPredictor.tsx` — full page.
13. `src/components/pages/DomesticLoanCenter.tsx` — full page (embeds CSIS preview).
14. `src/components/pages/ROICalculator.tsx` — currency switch.
15. `src/components/pages/EMICalculator.tsx` — preset + CSIS toggle.
16. `src/components/pages/SOPCopilot.tsx` — relabel + example partition.
17. `src/components/pages/ScholarshipHunter.tsx` — track-driven default filter.
18. `src/components/NudgeEngine.tsx` — three domestic nudges with cooldown.
19. `tests/properties/domestic-track-*.test.ts` — fourteen property tests interleaved with the feature commits per the optional sub-task pattern in `tasks.md`.

This ordering keeps each step on a green build: pure-logic modules (steps 1–7) ship with property tests before any UI consumer is wired, then the persistence boundary (steps 8–10), then the navigation wiring, then the new pages, then the existing-page tweaks, then the Nudge Engine and remaining property tests.
