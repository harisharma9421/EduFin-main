// Cost of Study — Gemini-grounded estimates for annual tuition + living cost
// in USD for a given university / country / program.
//
// Returns: { tuitionPerYearUSD, livingPerYearUSD, source, notes }
//
// Used by the ROI Calculator so the user does not have to manually enter
// these numbers when they change country or college.

import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { generateContentWithFallback } from '@/lib/aiClient'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' })

interface CostInput {
  university?: string
  country: string
  city?: string
  program?: string
  durationYears?: number
}

// Sensible per-country fallback tuitions (USD/yr for international Master's
// programs) — used only when Gemini is unavailable. Living costs are urban
// post-grad estimates.
const FALLBACK_TUITION: Record<string, number> = {
  USA: 45000,
  UK: 35000,
  Canada: 28000,
  Australia: 32000,
  Germany: 1500,
  Singapore: 30000,
  Ireland: 25000,
  Netherlands: 22000,
  France: 18000,
  Sweden: 18000,
  Switzerland: 2500,
  'New Zealand': 28000,
  Japan: 8000,
  'South Korea': 9000,
  Italy: 10000,
  Spain: 12000,
  'Hong Kong': 22000,
  China: 6000,
  UAE: 20000,
  Denmark: 18000,
  Finland: 15000,
  Norway: 0,
  Belgium: 14000,
  Austria: 8000,
  India: 5000,
}

const FALLBACK_LIVING: Record<string, number> = {
  USA: 18000,
  UK: 16000,
  Canada: 14000,
  Australia: 17000,
  Germany: 12000,
  Singapore: 18000,
  Ireland: 14000,
  Netherlands: 14000,
  France: 13000,
  Sweden: 12000,
  Switzerland: 22000,
  'New Zealand': 14000,
  Japan: 14000,
  'South Korea': 12000,
  Italy: 11000,
  Spain: 11000,
  'Hong Kong': 18000,
  China: 9000,
  UAE: 15000,
  Denmark: 14000,
  Finland: 11000,
  Norway: 16000,
  Belgium: 13000,
  Austria: 12000,
  India: 6000,
}

function fallbackFor(country: string) {
  const tuition = FALLBACK_TUITION[country] ?? 35000
  const living = FALLBACK_LIVING[country] ?? 14000
  return {
    tuitionPerYearUSD: tuition,
    livingPerYearUSD: living,
    source: 'fallback' as const,
    notes: 'Estimate based on country averages.',
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CostInput
    const country = body.country?.trim() || 'USA'
    const university = body.university?.trim() || ''
    const program = body.program?.trim() || "Master's"

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock') {
      return NextResponse.json(fallbackFor(country))
    }

    const prompt = `You are an admissions finance analyst. Estimate the annual cost of attendance for an Indian international student starting ${new Date().getFullYear()}.

Inputs
- University: ${university || 'a typical reputable university'}
- Country: ${country}${body.city ? ` (${body.city})` : ''}
- Program: ${program}
- Duration: ${body.durationYears || 2} years

Return strict JSON with two integers in USD:
- tuitionPerYearUSD: published international tuition for one academic year
- livingPerYearUSD: realistic on/off-campus living cost (rent + food + transport + insurance + misc) for one year in the host city

Rules
- Numbers must be in USD per year, integer.
- Use the latest published international tuition for ${country}; if the named university is well-known, anchor on it specifically.
- Living costs should reflect the named city when known, otherwise the largest student hub in ${country}.
- Add a 1-line "notes" field explaining what's included.`

    const resp = await generateContentWithFallback(ai, {
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tuitionPerYearUSD: { type: Type.NUMBER },
            livingPerYearUSD: { type: Type.NUMBER },
            notes: { type: Type.STRING },
          },
          required: ['tuitionPerYearUSD', 'livingPerYearUSD'],
        },
        temperature: 0.2,
      },
    })

    const parsed = JSON.parse(resp.text || '{}')
    const tuition = Number(parsed.tuitionPerYearUSD)
    const living = Number(parsed.livingPerYearUSD)

    if (!isFinite(tuition) || tuition < 0 || !isFinite(living) || living < 0) {
      return NextResponse.json(fallbackFor(country))
    }

    return NextResponse.json({
      tuitionPerYearUSD: Math.round(tuition),
      livingPerYearUSD: Math.round(living),
      source: 'gemini',
      notes: parsed.notes || '',
    })
  } catch (err: any) {
    console.warn('cost-of-study failed:', err?.message)
    return NextResponse.json(fallbackFor((await safeCountry(request)) ?? 'USA'))
  }
}

async function safeCountry(req: Request): Promise<string | null> {
  try {
    const cloned = req.clone()
    const body = (await cloned.json()) as CostInput
    return body.country || null
  } catch {
    return null
  }
}
