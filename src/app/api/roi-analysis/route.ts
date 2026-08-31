// ROI Analysis — Gemini-backed insights for the ROI Calculator page.
//
// Returns:
//   • salaryRange: { p25, median, p75 } in USD per year for the program/uni.
//   • placementRatePct: 0–100 for the same university+course.
//   • indiaSalaryUSD: typical fresh-graduate salary in India for the same field.
//   • salaryGrowthPct: suggested annual growth % for that field/uni.
//   • riskRating: 'Low' | 'Medium' | 'High' (debt-to-income aware).
//   • narrative: one short paragraph explaining the verdict.
//   • alternatives: 2 universities (name, country, expectedSalaryUSDMedian,
//     totalCostUSD, breakevenYears) with similar/better ROI.
//
// Model: gemini-2.5-flash, JSON-schema constrained.

import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { generateContentWithFallback } from '@/lib/aiClient'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' })

interface AnalysisInput {
  university: string
  country: string
  city?: string
  program: string
  field?: string
  durationYears: number
  totalCostUSD: number
  loanAmountUSD: number
  interestRatePct: number
  loanTenureYears: number
  scholarshipUSD?: number
  preStudySavingsUSD?: number
  studentCgpa?: number | string
  workExperienceYears?: number | string
}

const FALLBACK = (input: AnalysisInput) => ({
  salaryRange: {
    p25USD: 65000,
    medianUSD: 95000,
    p75USD: 135000,
  },
  placementRatePct: 85,
  indiaSalaryUSD: 14000,
  salaryGrowthPct: 6,
  riskRating: 'Medium' as const,
  narrative: `Estimated ranges for ${input.program} at ${input.university}. Live AI grounding was unavailable — these numbers are conservative defaults based on typical post-MS outcomes for Indian students abroad.`,
  alternatives: [
    {
      name: 'University of Texas at Austin',
      country: 'USA',
      expectedSalaryUSDMedian: 110000,
      totalCostUSD: 90000,
      breakevenYears: 4,
    },
    {
      name: 'University of British Columbia',
      country: 'Canada',
      expectedSalaryUSDMedian: 85000,
      totalCostUSD: 70000,
      breakevenYears: 4,
    },
  ],
})

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalysisInput

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock') {
      return NextResponse.json({ data: FALLBACK(body), source: 'fallback' })
    }

    const annualEMIUSD =
      body.loanAmountUSD > 0 && body.interestRatePct > 0 && body.loanTenureYears > 0
        ? (() => {
            const r = body.interestRatePct / 12 / 100
            const n = body.loanTenureYears * 12
            const emi = (body.loanAmountUSD * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
            return Math.round(emi * 12)
          })()
        : 0

    const prompt = `You are a financial analyst sizing the return on investment for an Indian student studying abroad.
Provide realistic, current-year (${new Date().getFullYear()}) figures.

INPUTS
- University: ${body.university}
- Country: ${body.country}${body.city ? ` (${body.city})` : ''}
- Program: ${body.program}${body.field ? ` · field: ${body.field}` : ''}
- Duration: ${body.durationYears} years
- Total cost: USD ${body.totalCostUSD.toLocaleString('en-US')} (incl. tuition + living)
- Loan: USD ${body.loanAmountUSD.toLocaleString('en-US')} at ${body.interestRatePct}% for ${body.loanTenureYears}y (annual EMI ≈ USD ${annualEMIUSD.toLocaleString('en-US')})
- Scholarship: USD ${(body.scholarshipUSD || 0).toLocaleString('en-US')}
- Pre-study savings used: USD ${(body.preStudySavingsUSD || 0).toLocaleString('en-US')}
- Student CGPA: ${body.studentCgpa ?? 'unknown'}
- Work experience: ${body.workExperienceYears ?? 'unknown'} years

OUTPUTS — strict JSON only.

Rules
- Salary range = P25 / median / P75 starting full-time annual base salary in the country of study, in USD. Don't include sign-on bonus or RSU.
- placementRatePct = approximate share of full-time-employed graduates within 6 months for this exact program at this exact university.
- indiaSalaryUSD = typical fresh-graduate base salary in India for the same field / degree, in USD-equivalent.
- salaryGrowthPct = realistic annual growth rate for the first 7-10 years in this field/country (5-10% common; 6 is a safe default).
- riskRating: Low if annual EMI < 25% of P25 salary; Medium if 25-45%; High if > 45% or if loan > 1.5× P25.
- alternatives: 2 universities with comparable or better ROI for the same program. Use real, currently-operating institutions. Provide expectedSalaryUSDMedian, totalCostUSD (entire program), and breakevenYears (estimate).
- narrative: 2-3 sentences summarising the verdict and the single biggest swing factor.
- All numbers integers in USD.`

    const resp = await generateContentWithFallback(ai, {
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            salaryRange: {
              type: Type.OBJECT,
              properties: {
                p25USD: { type: Type.NUMBER },
                medianUSD: { type: Type.NUMBER },
                p75USD: { type: Type.NUMBER },
              },
              required: ['p25USD', 'medianUSD', 'p75USD'],
            },
            placementRatePct: { type: Type.NUMBER },
            indiaSalaryUSD: { type: Type.NUMBER },
            salaryGrowthPct: { type: Type.NUMBER },
            riskRating: { type: Type.STRING },
            narrative: { type: Type.STRING },
            alternatives: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  country: { type: Type.STRING },
                  expectedSalaryUSDMedian: { type: Type.NUMBER },
                  totalCostUSD: { type: Type.NUMBER },
                  breakevenYears: { type: Type.NUMBER },
                },
                required: ['name', 'country', 'expectedSalaryUSDMedian', 'totalCostUSD', 'breakevenYears'],
              },
            },
          },
          required: [
            'salaryRange',
            'placementRatePct',
            'indiaSalaryUSD',
            'salaryGrowthPct',
            'riskRating',
            'narrative',
            'alternatives',
          ],
        },
        temperature: 0.3,
      },
    })

    const parsed = JSON.parse(resp.text || '{}')

    // Guard against missing fields.
    if (!parsed.salaryRange || !parsed.alternatives) {
      return NextResponse.json({ data: FALLBACK(body), source: 'gemini-empty' })
    }

    return NextResponse.json({ data: parsed, source: 'gemini' })
  } catch (err: any) {
    console.warn('roi-analysis failed:', err?.message)
    return NextResponse.json(
      { data: FALLBACK({ university: '', country: '', program: '' } as any), source: 'fallback', error: err?.message },
      { status: 200 },
    )
  }
}
