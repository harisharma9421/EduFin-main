// College Match — server-side filter API (CSV-backed, Gemini-aware)
// ----------------------------------------------------------------------------
// Reads the generated dataset from public/data/universities.csv, caches it in
// module memory after the first hit, and returns a paged list of programs
// bucketed into Guaranteed / Probable / Reach against the student's actual
// scores.
//
// Key behaviour:
//   • The exam-coverage gate is SOFT — programs that need an exam the
//     student has not taken are still returned, but flagged as `Reach` and
//     accompanied by a `missingExams` array so the UI can prompt the user
//     to add the exam.
//   • A free-text `aiQuery` is converted into structured filters by Gemini
//     (gemini-2.5-flash, JSON schema response) and merged with the explicit
//     filters from the client.
//   • Every row served back to the client is a flat object with stable
//     column keys so the page can render proper card grids.

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { parse as parseCsv } from 'csv-parse/sync'
import { GoogleGenAI, Type } from '@google/genai'
import { generateContentWithFallback } from '@/lib/aiClient'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' })

// ── CSV column shape used inside this route ──────────────────────────────────
interface UniRow {
  id: string
  university_name: string
  short_name: string
  country: string
  country_code: string
  city: string
  state_province: string
  tier: 'T1' | 'T2' | 'T3'
  qs_ranking_2025: number
  the_ranking_2025: number
  course_name: string
  course_short: string
  course_category: string
  duration_years: number
  degree_type: string
  language_of_instruction: string
  admission_category: string

  gre_required: boolean
  gre_min: number
  gre_avg: number
  gmat_required: boolean
  gmat_min: number
  gmat_avg: number
  ielts_required: boolean
  ielts_min: number
  toefl_required: boolean
  toefl_min: number
  gate_required: boolean
  gate_min: number
  cat_required: boolean
  cat_min_pct: number

  cgpa_min: number
  cgpa_avg: number
  acceptance_pct: number

  total_cost_inr: number
  tuition_per_year_inr: number
  living_per_year_inr: number
  avg_salary_inr: number
  scholarship_available: boolean
  scholarship_max_pct: number
  collateral_required: boolean

  this_year_cutoff_cgpa: number
  last_year_cutoff_cgpa: number
  this_year_avg_admit: number
  last_year_avg_admit: number
}

let DATA: UniRow[] | null = null

function num(v: any): number {
  if (v === undefined || v === null || v === '') return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
}
function bool(v: any): boolean {
  if (typeof v === 'boolean') return v
  return String(v).toLowerCase() === 'true'
}

function loadData(): UniRow[] {
  if (DATA) return DATA
  const csvPath = path.join(process.cwd(), 'public', 'data', 'universities.csv')
  const raw = fs.readFileSync(csvPath, 'utf-8')
  const parsed = parseCsv(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as Record<string, string>[]

  DATA = parsed.map((r): UniRow => ({
    id: r.id,
    university_name: r.university_name,
    short_name: r.short_name,
    country: r.country,
    country_code: r.country_code,
    city: r.city,
    state_province: r.state_province,
    tier: r.tier as UniRow['tier'],
    qs_ranking_2025: num(r.qs_ranking_2025),
    the_ranking_2025: num(r.the_ranking_2025),
    course_name: r.course_name,
    course_short: r.course_short,
    course_category: r.course_category,
    duration_years: num(r.duration_years),
    degree_type: r.degree_type,
    language_of_instruction: r.language_of_instruction,
    admission_category: r.admission_category,

    gre_required: bool(r['exams_required.gre.required']),
    gre_min: num(r['exams_required.gre.minimum_total']),
    gre_avg: num(r['exams_required.gre.average_admitted']),
    gmat_required: bool(r['exams_required.gmat.required']),
    gmat_min: num(r['exams_required.gmat.minimum_total']),
    gmat_avg: num(r['exams_required.gmat.average_admitted']),
    ielts_required: bool(r['exams_required.ielts.required']),
    ielts_min: num(r['exams_required.ielts.minimum_overall']),
    toefl_required: bool(r['exams_required.toefl.required']),
    toefl_min: num(r['exams_required.toefl.minimum_total']),
    gate_required: bool(r['exams_required.gate.required']),
    gate_min: num(r['exams_required.gate.minimum_score']),
    cat_required: bool(r['exams_required.cat.required']),
    cat_min_pct: num(r['exams_required.cat.minimum_percentile']),

    cgpa_min: num(r['academic_requirements.minimum_cgpa_10_scale']),
    cgpa_avg: num(r['academic_requirements.average_cgpa_10_scale']),
    acceptance_pct: num(r['admission_stats.acceptance_rate_percent']),

    total_cost_inr: num(r['financials.total_program_cost_inr']),
    tuition_per_year_inr: num(r['financials.tuition_per_year_inr']),
    living_per_year_inr: num(r['financials.living_cost_per_year_inr']),
    avg_salary_inr: num(r['outcomes.average_salary_inr']),
    scholarship_available: bool(r['financials.scholarship_available']),
    scholarship_max_pct: num(r['financials.scholarship_max_percent']),
    collateral_required: bool(r['loan_data.collateral_required']),

    this_year_cutoff_cgpa: num(r['cutoffs_history.this_year_cutoff_cgpa']),
    last_year_cutoff_cgpa: num(r['cutoffs_history.last_year_cutoff_cgpa']),
    this_year_avg_admit: num(r['cutoffs_history.this_year_avg_admit']),
    last_year_avg_admit: num(r['cutoffs_history.last_year_avg_admit']),
  }))

  return DATA as UniRow[]
}

interface FilterRequest {
  studentExams?: string[]
  studentScores?: Record<string, number>
  countries?: string[]
  categories?: string[]
  degrees?: string[]
  budgetINR?: number
  bucket?: 'Guaranteed' | 'Probable' | 'Reach' | 'all'
  page?: number
  pageSize?: number
  aiQuery?: string
}

// Identify which exams a row needs that the student has NOT taken yet.
function missingExamsFor(row: UniRow, taken: Set<string>): string[] {
  const missing: string[] = []
  const needsEnglish = row.ielts_required || row.toefl_required
  const hasEnglish =
    taken.has('IELTS') || taken.has('TOEFL') || taken.has('PTE') || taken.has('DUOLINGO')
  if (needsEnglish && !hasEnglish) missing.push('IELTS/TOEFL')
  if (row.gre_required && !taken.has('GRE')) missing.push('GRE')
  if (row.gmat_required && !taken.has('GMAT')) missing.push('GMAT')
  if (row.gate_required && !taken.has('GATE')) missing.push('GATE')
  if (row.cat_required && !taken.has('CAT')) missing.push('CAT')
  return missing
}

// Bucket a row by comparing the student's scores to the row's cutoffs.
// • Missing exams force the row into Reach.
// • Otherwise: all-min + 60% avg → Guaranteed; ≥70% min → Probable; ≥1 min → Reach.
function bucketRow(
  row: UniRow,
  scores: Record<string, number>,
  missing: string[],
): { bucket: 'Guaranteed' | 'Probable' | 'Reach'; gap: number } {
  if (missing.length > 0) return { bucket: 'Reach', gap: missing.length * 5 }

  let minHits = 0
  let avgHits = 0
  let total = 0
  let totalGap = 0

  if (scores.CGPA !== undefined && row.cgpa_min > 0) {
    total++
    if (scores.CGPA >= row.cgpa_min) minHits++
    if (scores.CGPA >= row.cgpa_avg) avgHits++
    totalGap += Math.max(0, row.cgpa_min - scores.CGPA)
  }
  if (row.gre_required) {
    total++
    if (scores.GRE !== undefined) {
      if (scores.GRE >= row.gre_min) minHits++
      if (scores.GRE >= row.gre_avg) avgHits++
      totalGap += Math.max(0, row.gre_min - scores.GRE) / 10
    }
  }
  if (row.gmat_required) {
    total++
    if (scores.GMAT !== undefined) {
      if (scores.GMAT >= row.gmat_min) minHits++
      if (scores.GMAT >= row.gmat_avg) avgHits++
      totalGap += Math.max(0, row.gmat_min - scores.GMAT) / 30
    }
  }
  if (row.ielts_required) {
    total++
    if (scores.IELTS !== undefined) {
      if (scores.IELTS >= row.ielts_min) minHits++
      if (scores.IELTS >= row.ielts_min + 0.5) avgHits++
      totalGap += Math.max(0, row.ielts_min - scores.IELTS)
    }
  }
  if (row.toefl_required) {
    total++
    if (scores.TOEFL !== undefined) {
      if (scores.TOEFL >= row.toefl_min) minHits++
      if (scores.TOEFL >= row.toefl_min + 5) avgHits++
      totalGap += Math.max(0, row.toefl_min - scores.TOEFL) / 5
    }
  }
  if (row.gate_required) {
    total++
    if (scores.GATE !== undefined) {
      if (scores.GATE >= row.gate_min) minHits++
      if (scores.GATE >= row.gate_min + 50) avgHits++
      totalGap += Math.max(0, row.gate_min - scores.GATE) / 30
    }
  }
  if (row.cat_required) {
    total++
    if (scores.CAT !== undefined) {
      if (scores.CAT >= row.cat_min_pct) minHits++
      if (scores.CAT >= row.cat_min_pct + 2) avgHits++
      totalGap += Math.max(0, row.cat_min_pct - scores.CAT)
    }
  }

  // No relevant cutoffs at all → call it Probable as a neutral default.
  if (total === 0) return { bucket: 'Probable', gap: 0 }

  if (minHits === total && avgHits >= Math.ceil(total * 0.6))
    return { bucket: 'Guaranteed', gap: totalGap }
  if (minHits >= Math.ceil(total * 0.7)) return { bucket: 'Probable', gap: totalGap }
  return { bucket: 'Reach', gap: totalGap }
}

// Ask Gemini to convert a free-text query into structured filter constraints.
async function aiQueryToFilters(q: string): Promise<Partial<FilterRequest>> {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock') return {}
  try {
    const resp = await generateContentWithFallback(ai, {
      model: 'gemini-2.5-flash',
      contents: `Convert this free-text college search into structured database filters. Return ONLY the fields explicitly stated or strongly implied — leave others as empty arrays.

Allowed countries (use exact spelling): USA, UK, Canada, Australia, Germany, Singapore, Ireland, Netherlands, France, Sweden, Switzerland, "New Zealand", Japan, "South Korea", India, Italy, Spain, "Hong Kong", China, UAE, Denmark, Finland, Norway, Belgium, Austria.

Allowed categories: Technology, Business, Science, Medicine, Arts, Design, Law.
Allowed degrees: MS, MBA, MIM, MA, MPH, M.Arch, LLM, MFA.
Allowed buckets: Guaranteed, Probable, Reach, all.

BUDGET RULES:
- "₹50L", "50L", "50 lakhs", "50 lakh" => budgetINR = 5000000
- "1Cr", "1 crore", "₹1Cr" => budgetINR = 10000000
- "under <X> lakhs" => budgetINR = X * 100000
- Always express budget in INR as an integer.

BUCKET CUES:
- "safe", "safer matches", "guaranteed" => bucket="Guaranteed"
- "stretch", "reach", "ambitious", "dream" => bucket="Reach"
- "realistic", "probable", "match" => bucket="Probable"

EXAMPLE 1
Query: "MS in AI in Canada under 50L only safer matches"
Output: {"countries":["Canada"],"categories":["Technology"],"degrees":["MS"],"budgetINR":5000000,"bucket":"Guaranteed"}

EXAMPLE 2
Query: "MBA in USA or UK ambitious schools"
Output: {"countries":["USA","UK"],"categories":["Business"],"degrees":["MBA"],"bucket":"Reach"}

EXAMPLE 3
Query: "Show me MS Computer Science programs in Germany"
Output: {"countries":["Germany"],"categories":["Technology"],"degrees":["MS"]}

QUERY: """${q}"""

Return strict JSON.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            countries: { type: Type.ARRAY, items: { type: Type.STRING } },
            categories: { type: Type.ARRAY, items: { type: Type.STRING } },
            degrees: { type: Type.ARRAY, items: { type: Type.STRING } },
            budgetINR: { type: Type.NUMBER },
            bucket: { type: Type.STRING },
          },
        },
        temperature: 0.1,
      },
    })
    const parsed = JSON.parse(resp.text || '{}')
    const cleaned: Partial<FilterRequest> = {}
    if (Array.isArray(parsed.countries) && parsed.countries.length) cleaned.countries = parsed.countries
    if (Array.isArray(parsed.categories) && parsed.categories.length) cleaned.categories = parsed.categories
    if (Array.isArray(parsed.degrees) && parsed.degrees.length) cleaned.degrees = parsed.degrees
    if (typeof parsed.budgetINR === 'number' && parsed.budgetINR > 0) cleaned.budgetINR = parsed.budgetINR
    if (
      typeof parsed.bucket === 'string' &&
      ['Guaranteed', 'Probable', 'Reach', 'all'].includes(parsed.bucket)
    )
      cleaned.bucket = parsed.bucket as any
    return cleaned
  } catch (err) {
    console.warn('college-match aiQueryToFilters failed:', (err as Error)?.message)
    return {}
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FilterRequest
    const data = loadData()

    let aiFilters: Partial<FilterRequest> = {}
    if (body.aiQuery && body.aiQuery.trim().length > 0) {
      aiFilters = await aiQueryToFilters(body.aiQuery)
    }

    const taken = new Set(body.studentExams || [])
    const scores = body.studentScores || {}
    const wantCountries = new Set([
      ...(body.countries || []),
      ...(aiFilters.countries || []),
    ])
    const wantCategories = new Set([
      ...(body.categories || []),
      ...(aiFilters.categories || []),
    ])
    const wantDegrees = new Set([
      ...(body.degrees || []),
      ...(aiFilters.degrees || []),
    ])
    const wantBucket = (aiFilters.bucket as any) || body.bucket || 'all'
    const budget = aiFilters.budgetINR || body.budgetINR || Infinity
    const page = Math.max(1, body.page || 1)
    const pageSize = Math.min(100, body.pageSize || 30)

    // Country counts across the WHOLE dataset (no exam gating).
    const countryCounts: Record<string, number> = {}
    for (const row of data) {
      countryCounts[row.country] = (countryCounts[row.country] || 0) + 1
    }

    // Filter + bucket
    const matched: any[] = []
    for (const row of data) {
      if (wantCountries.size > 0 && !wantCountries.has(row.country)) continue
      if (wantCategories.size > 0 && !wantCategories.has(row.course_category)) continue
      if (wantDegrees.size > 0 && !wantDegrees.has(row.degree_type)) continue
      if (row.total_cost_inr > 0 && row.total_cost_inr > budget) continue

      const missing = missingExamsFor(row, taken)
      const { bucket, gap } = bucketRow(row, scores, missing)
      if (wantBucket !== 'all' && bucket !== wantBucket) continue

      matched.push({
        id: row.id,
        university_name: row.university_name,
        short_name: row.short_name,
        country: row.country,
        country_code: row.country_code,
        city: row.city,
        state_province: row.state_province,
        tier: row.tier,
        qs_ranking_2025: row.qs_ranking_2025,
        course_name: row.course_name,
        course_short: row.course_short,
        course_category: row.course_category,
        degree_type: row.degree_type,
        duration_years: row.duration_years,
        admission_category: row.admission_category,
        bucket,
        gap,
        missingExams: missing,

        gre_required: row.gre_required,
        gre_min: row.gre_min,
        gmat_required: row.gmat_required,
        gmat_min: row.gmat_min,
        ielts_required: row.ielts_required,
        ielts_min: row.ielts_min,
        toefl_required: row.toefl_required,
        toefl_min: row.toefl_min,
        gate_required: row.gate_required,
        gate_min: row.gate_min,
        cat_required: row.cat_required,
        cat_min_pct: row.cat_min_pct,
        cgpa_min: row.cgpa_min,
        cgpa_avg: row.cgpa_avg,

        this_year_cutoff_cgpa: row.this_year_cutoff_cgpa,
        last_year_cutoff_cgpa: row.last_year_cutoff_cgpa,

        acceptance_pct: row.acceptance_pct,
        total_cost_inr: row.total_cost_inr,
        avg_salary_inr: row.avg_salary_inr,
        scholarship_available: row.scholarship_available,
        scholarship_max_pct: row.scholarship_max_pct,
        collateral_required: row.collateral_required,
      })
    }

    // Sort: Guaranteed first, smaller gaps first, then by ranking.
    const order = { Guaranteed: 0, Probable: 1, Reach: 2 } as Record<string, number>
    matched.sort((a, b) => {
      const ord = (order[a.bucket] ?? 9) - (order[b.bucket] ?? 9)
      if (ord !== 0) return ord
      if (a.gap !== b.gap) return a.gap - b.gap
      return (a.qs_ranking_2025 || 999) - (b.qs_ranking_2025 || 999)
    })

    const bucketCounts = matched.reduce((acc, m) => {
      acc[m.bucket] = (acc[m.bucket] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const totalMatched = matched.length
    const start = (page - 1) * pageSize
    const slice = matched.slice(start, start + pageSize)

    return NextResponse.json({
      total: totalMatched,
      page,
      pageSize,
      bucketCounts,
      countryCounts,
      datasetSize: data.length,
      aiFiltersApplied: aiFilters,
      results: slice,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
