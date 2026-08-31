// Domestic college recommender route.
//
// Given the Indian entrance exam(s) a student appeared for (national or
// state level), their stream (Medical / Engineering), reservation category,
// a SPECIFIC branch they picked, and (optionally) a city, this route returns a
// single ranked list of up to 50 real Indian colleges that offer that branch
// through those exam(s), ordered best-first by closing cutoff. Cutoffs may be a
// rank (lower = better, e.g. JEE/NEET) or a percentile (higher = better, e.g.
// MHT CET); each row carries `cutoffType` so the client orders correctly.
// Uses Gemini (gemini-2.5-flash, structured JSON) with a curated fallback so
// the predictor never blocks when the key is missing or the call fails.
//
// Conventions verified against
// node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
// (Web Request/Response, POST handler, Response.json — Route Handlers are not
// cached by default, which is what we want here).

import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { generateContentWithFallback } from '@/lib/aiClient'
import type {
  DomesticCollegeResult,
  EntranceExamStream,
  ReservationCategory,
} from '@/lib/types'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' })

// Maximum number of colleges returned for a (branch[, city]) query.
const MAX_COLLEGES = 50

// Shape of one exam the student appeared for, sent from the client.
interface ExamInput {
  examName: string
  stream: EntranceExamStream
  region: string
  marks?: string
  rank?: string
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    colleges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          city: { type: Type.STRING },
          state: { type: Type.STRING },
          branch: { type: Type.STRING },
          collegeType: { type: Type.STRING },
          examName: { type: Type.STRING },
          stream: { type: Type.STRING },
          cutoffLabel: { type: Type.STRING },
          closingRank: { type: Type.NUMBER },
          cutoffType: { type: Type.STRING },
          qualityScore: { type: Type.NUMBER },
          feesLabel: { type: Type.STRING },
        },
        required: [
          'name',
          'city',
          'state',
          'branch',
          'collegeType',
          'examName',
          'cutoffLabel',
          'cutoffType',
          'qualityScore',
          'feesLabel',
        ],
      },
    },
  },
  required: ['colleges'],
}

function parseLeadingNumber(value: string | undefined): number | null {
  if (!value) return null
  const match = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

// Order the combined (cross-exam) list by genuine college quality. National
// rank-based exams and state percentile-based exams live on incomparable
// scales, so we rank primarily by `qualityScore` (a single 0–100 national
// desirability axis). Ties fall back to same-exam-type cutoff selectivity, then
// name for determinism.
function sameTypeSelectivity(c: DomesticCollegeResult): number {
  if (c.closingRank == null) return -Infinity
  return c.cutoffType === 'percentile' ? c.closingRank : -c.closingRank
}

function compareColleges(
  a: DomesticCollegeResult,
  b: DomesticCollegeResult,
): number {
  const qa = typeof a.qualityScore === 'number' ? a.qualityScore : -Infinity
  const qb = typeof b.qualityScore === 'number' ? b.qualityScore : -Infinity
  if (qb !== qa) return qb - qa
  // Same quality: if cutoffs are on the same scale, prefer the more selective.
  if (a.cutoffType === b.cutoffType) {
    const sa = sameTypeSelectivity(a)
    const sb = sameTypeSelectivity(b)
    if (sb !== sa) return sb - sa
  }
  return a.name.localeCompare(b.name)
}

function sortAndCap(rows: DomesticCollegeResult[]): DomesticCollegeResult[] {
  return [...rows].sort(compareColleges).slice(0, MAX_COLLEGES)
}

// ─────────────────────────────────────────────────────────────────────────────
// Curated fallback used when GEMINI_API_KEY is 'mock'/absent or the call fails.
// Branch-wise + city-wise General-category closing ranks (approximate,
// illustrative). Filtered to the requested branch when possible.
// ─────────────────────────────────────────────────────────────────────────────
type FallbackBranch = { branch: string; generalClosingRank: number }

type FallbackCollege = {
  name: string
  city: string
  state: string
  collegeType: string
  examName: string
  stream: EntranceExamStream
  feesLabel: string
  /** National desirability score in [0,100], comparable across exams. */
  quality: number
  branches: FallbackBranch[]
}

const ENGINEERING_FALLBACK: FallbackCollege[] = [
  {
    name: 'IIT Bombay', city: 'Mumbai', state: 'Maharashtra', collegeType: 'IIT',
    examName: 'JEE Advanced', stream: 'Engineering', feesLabel: '₹2.5L / year', quality: 99,
    branches: [
      { branch: 'Computer Science', generalClosingRank: 68 },
      { branch: 'Information Technology', generalClosingRank: 250 },
      { branch: 'Electrical Engineering', generalClosingRank: 320 },
      { branch: 'Mechanical Engineering', generalClosingRank: 1300 },
      { branch: 'Civil Engineering', generalClosingRank: 3200 },
    ],
  },
  {
    name: 'IIT Delhi', city: 'New Delhi', state: 'Delhi', collegeType: 'IIT',
    examName: 'JEE Advanced', stream: 'Engineering', feesLabel: '₹2.5L / year', quality: 98,
    branches: [
      { branch: 'Computer Science', generalClosingRank: 110 },
      { branch: 'Information Technology', generalClosingRank: 380 },
      { branch: 'Electrical Engineering', generalClosingRank: 480 },
      { branch: 'Mechanical Engineering', generalClosingRank: 1600 },
      { branch: 'Civil Engineering', generalClosingRank: 4000 },
    ],
  },
  {
    name: 'NIT Trichy', city: 'Tiruchirappalli', state: 'Tamil Nadu', collegeType: 'NIT',
    examName: 'JEE Main', stream: 'Engineering', feesLabel: '₹1.5L / year', quality: 90,
    branches: [
      { branch: 'Computer Science', generalClosingRank: 2100 },
      { branch: 'Information Technology', generalClosingRank: 4100 },
      { branch: 'Electronics & Communication', generalClosingRank: 5200 },
      { branch: 'Mechanical Engineering', generalClosingRank: 12000 },
      { branch: 'Civil Engineering', generalClosingRank: 21000 },
    ],
  },
  {
    name: 'NIT Warangal', city: 'Warangal', state: 'Telangana', collegeType: 'NIT',
    examName: 'JEE Main', stream: 'Engineering', feesLabel: '₹1.5L / year', quality: 88,
    branches: [
      { branch: 'Computer Science', generalClosingRank: 2600 },
      { branch: 'Electronics & Communication', generalClosingRank: 6400 },
      { branch: 'Electrical Engineering', generalClosingRank: 14000 },
    ],
  },
  {
    name: 'College of Engineering Pune (COEP)', city: 'Pune', state: 'Maharashtra', collegeType: 'State University',
    examName: 'MHT CET', stream: 'Engineering', feesLabel: '₹90K / year', quality: 82,
    branches: [
      { branch: 'Computer Science', generalClosingRank: 99 },
      { branch: 'Information Technology', generalClosingRank: 99 },
      { branch: 'Electrical Engineering', generalClosingRank: 98 },
      { branch: 'Mechanical Engineering', generalClosingRank: 97 },
    ],
  },
  {
    name: 'Veermata Jijabai Technological Institute (VJTI)', city: 'Mumbai', state: 'Maharashtra', collegeType: 'State University',
    examName: 'MHT CET', stream: 'Engineering', feesLabel: '₹85K / year', quality: 80,
    branches: [
      { branch: 'Computer Science', generalClosingRank: 99 },
      { branch: 'Information Technology', generalClosingRank: 99 },
      { branch: 'Electronics & Communication', generalClosingRank: 98 },
    ],
  },
]

const MEDICAL_FALLBACK: FallbackCollege[] = [
  {
    name: 'AIIMS Delhi', city: 'New Delhi', state: 'Delhi', collegeType: 'AIIMS',
    examName: 'NEET UG', stream: 'Medical', feesLabel: '₹6K / year', quality: 99,
    branches: [
      { branch: 'MBBS', generalClosingRank: 60 },
      { branch: 'BDS', generalClosingRank: 900 },
    ],
  },
  {
    name: 'Maulana Azad Medical College', city: 'New Delhi', state: 'Delhi', collegeType: 'Govt Medical',
    examName: 'NEET UG', stream: 'Medical', feesLabel: '₹25K / year', quality: 92,
    branches: [
      { branch: 'MBBS', generalClosingRank: 250 },
      { branch: 'BDS', generalClosingRank: 2800 },
    ],
  },
  {
    name: 'Grant Medical College', city: 'Mumbai', state: 'Maharashtra', collegeType: 'Govt Medical',
    examName: 'NEET UG', stream: 'Medical', feesLabel: '₹1L / year', quality: 86,
    branches: [
      { branch: 'MBBS', generalClosingRank: 3500 },
      { branch: 'BDS', generalClosingRank: 12000 },
    ],
  },
]

const CATEGORY_RELAXATION: Record<ReservationCategory, number> = {
  General: 1,
  'OBC-NCL': 1.8,
  EWS: 1.3,
  SC: 4,
  ST: 6,
  PwD: 5,
}

function branchMatches(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  const x = norm(a)
  const y = norm(b)
  return x === y || x.includes(y) || y.includes(x)
}

function buildFallback(
  stream: EntranceExamStream,
  category: ReservationCategory,
  branch: string,
  city: string,
): DomesticCollegeResult[] {
  const base = stream === 'Medical' ? MEDICAL_FALLBACK : ENGINEERING_FALLBACK
  const relax = CATEGORY_RELAXATION[category] ?? 1
  const rows: DomesticCollegeResult[] = []
  base.forEach((c, ci) => {
    if (city && c.city.toLowerCase() !== city.toLowerCase()) return
    c.branches.forEach((b, bi) => {
      if (branch && !branchMatches(b.branch, branch)) return
      const closingRank = Math.round(b.generalClosingRank * relax)
      rows.push({
        id: `fallback-${stream}-${ci}-${bi}`,
        name: c.name,
        city: c.city,
        state: c.state,
        branch: b.branch,
        collegeType: c.collegeType,
        examName: c.examName,
        stream: c.stream,
        closingRank,
        cutoffType: 'rank',
        qualityScore: c.quality,
        cutoffLabel: `Closing rank ~${closingRank.toLocaleString('en-IN')} (${category})`,
        feesLabel: c.feesLabel,
      })
    })
  })
  return sortAndCap(rows)
}

export async function POST(request: Request) {
  let stream: EntranceExamStream = 'Engineering'
  let category: ReservationCategory = 'General'
  let branch = ''
  let city = ''

  try {
    const body = await request.json()
    const exams: ExamInput[] = Array.isArray(body.exams) ? body.exams : []
    category =
      typeof body.reservationCategory === 'string' && body.reservationCategory
        ? (body.reservationCategory as ReservationCategory)
        : 'General'
    branch = typeof body.branch === 'string' ? body.branch.trim() : ''
    city = typeof body.city === 'string' ? body.city.trim() : ''

    if (exams.length === 0) {
      return NextResponse.json(
        { error: 'At least one exam is required' },
        { status: 400 },
      )
    }

    stream = exams.some((e) => e.stream === 'Medical') ? 'Medical' : 'Engineering'

    if (process.env.GEMINI_API_KEY === 'mock' || !process.env.GEMINI_API_KEY) {
      throw new Error('No API key')
    }

    const examSummary = exams
      .map(
        (e) =>
          `${e.examName} (${e.stream}, ${e.region}${
            e.rank ? `, rank ${e.rank}` : ''
          }${e.marks ? `, marks/percentile ${e.marks}` : ''})`,
      )
      .join('; ')

    const branchClause = branch
      ? `ONLY for the branch/program "${branch}" (treat close variants — e.g. "Computer Science", "Computer Engineering", "CSE" — as the same branch).`
      : `for the single most popular branch at each college.`

    const cityClause = city
      ? `Restrict the list to colleges located in the city "${city}" only. If that city genuinely has fewer than ${MAX_COLLEGES} such colleges, return only the ones that exist (do NOT invent extras).`
      : `Span colleges across several different cities and states.`

    const countClause = city
      ? `Return as many genuine colleges as exist for this branch in "${city}", up to ${MAX_COLLEGES}. Fewer than ${MAX_COLLEGES} is acceptable ONLY because a single city may not have that many — never pad with fake colleges.`
      : `Return EXACTLY ${MAX_COLLEGES} colleges — this is a hard requirement. There are far more than ${MAX_COLLEGES} genuine ${stream} colleges admitting through these exam(s) across India, so you MUST fill all ${MAX_COLLEGES} slots with real, currently-operating institutes spanning IITs, NITs, IIITs, GFTIs, state/autonomous and reputable private colleges across multiple states. Do not stop early. Do NOT invent colleges — but do not return fewer than ${MAX_COLLEGES} either.`

    const prompt = `An Indian student appeared for the following entrance exam(s): ${examSummary}.
Their reservation category is "${category}".
Build a SINGLE combined list of REAL Indian ${stream} colleges/institutes that admit students through ANY of these exam(s), as of 2025-2026, ${branchClause}
${cityClause}
When the student gave both a national exam (JEE Main/Advanced, NEET) and a state-level exam (MHT CET, KCET, WBJEE, etc.), include colleges admitting through BOTH in the same list — national institutes (IIT/NIT/IIIT/AIIMS) and the relevant state-quota colleges.
For each college provide: official college name, city, state, the branch/program, college type (IIT, NIT, IIIT, AIIMS, Govt Medical, Private Medical, State University, Autonomous, Private, etc.), the exam used for admission (examName — the specific exam from the list above that this seat is filled through), a human-readable closing cutoff for the "${category}" category (cutoffLabel), the numeric closing cutoff value (closingRank), the cutoffType, a qualityScore, and approximate annual fees (feesLabel).
CUTOFF UNITS — this is important:
- For exams scored on a PERCENTILE basis (e.g. MHT CET, where ~99.9 is the top), set cutoffType to "percentile" and put the closing percentile (0–100, higher = more selective) in closingRank.
- For exams scored on a RANK basis (e.g. JEE Main/Advanced AIR, NEET AIR, most state merit numbers), set cutoffType to "rank" and put the closing rank (a positive integer, lower = more selective) in closingRank.
QUALITY SCORE — this drives the final ordering and MUST be comparable across ALL exams:
- qualityScore is a number from 0 to 100 representing the college's genuine NATIONAL desirability/quality for this branch (placements, reputation, faculty, infrastructure), INDEPENDENT of which exam admits to it.
- Use a consistent national scale: top IITs ≈ 95–99; older IITs / IIT-CS ≈ 92–99; top NITs/IIITs (Trichy, Surathkal, IIIT-H) ≈ 86–93; strong state/autonomous institutes (e.g. COEP, VJTI, BITS-tier) ≈ 78–86; good private/state colleges ≈ 60–78; average colleges ≈ 40–60.
- This means a top national institute (e.g. an IIT) MUST receive a HIGHER qualityScore than a mid-tier state college even though their cutoffs are on different scales. Do NOT let a high state-exam percentile outrank a genuinely better national institute.
${countClause}
Order the array by qualityScore DESCENDING (best college first). Only return genuine, currently-operating institutes. Do not invent colleges or cutoffs.`

    // Bound the Gemini call; disable thinking for latency. Up to 50 entries make
    // the response larger, so give it generous headroom (45s) before aborting.
    const GEMINI_TIMEOUT_MS = 45_000
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), GEMINI_TIMEOUT_MS)

    let response
    try {
      response = await generateContentWithFallback(ai, {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.2,
          maxOutputTokens: 16384,
          thinkingConfig: { thinkingBudget: 0 },
          abortSignal: abortController.signal,
        },
      })
    } finally {
      clearTimeout(timeoutId)
    }

    const text = response.text
    if (!text) throw new Error('Empty response from AI')

    const parsed = JSON.parse(text) as {
      colleges?: Array<Partial<DomesticCollegeResult>>
    }
    const raw = Array.isArray(parsed.colleges) ? parsed.colleges : []
    if (raw.length === 0) throw new Error('No colleges returned')

    const colleges: DomesticCollegeResult[] = raw.map((c, i) => {
      const closingRank =
        typeof c.closingRank === 'number' && Number.isFinite(c.closingRank)
          ? c.closingRank
          : null
      const cutoffType: 'rank' | 'percentile' =
        c.cutoffType === 'percentile' ? 'percentile' : 'rank'
      const qualityScore =
        typeof c.qualityScore === 'number' && Number.isFinite(c.qualityScore)
          ? Math.max(0, Math.min(100, c.qualityScore))
          : undefined
      const resolvedStream: EntranceExamStream =
        c.stream === 'Medical' ? 'Medical' : c.stream === 'Engineering' ? 'Engineering' : stream
      return {
        id: `gemini-${i}`,
        name: String(c.name || '').trim(),
        city: String(c.city || '').trim(),
        state: String(c.state || '').trim(),
        branch: String(c.branch || '').trim(),
        collegeType: String(c.collegeType || '').trim(),
        examName: String(c.examName || '').trim(),
        stream: resolvedStream,
        cutoffLabel: String(c.cutoffLabel || '').trim() || 'Cutoff varies',
        closingRank:
          closingRank == null
            ? null
            : cutoffType === 'rank'
              ? Math.round(closingRank)
              : closingRank,
        cutoffType,
        qualityScore,
        feesLabel: String(c.feesLabel || '').trim() || 'Fees vary',
      }
    })

    return NextResponse.json({ colleges: sortAndCap(colleges), source: 'gemini' })
  } catch (err) {
    console.warn('Domestic-colleges route falling back to curated list:', err)
    return NextResponse.json({
      colleges: buildFallback(stream, category, branch, city),
      source: 'fallback',
    })
  }
}
